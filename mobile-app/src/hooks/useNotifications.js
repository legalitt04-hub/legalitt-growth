import { useEffect, useRef, useLayoutEffect } from 'react';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import { authAPI } from '../services/api';
import { getSocket, connectSocket } from '../services/socket';

// Safe lazy-load: crashes if ExpoPushTokenManager native module is missing
let Notifications = null;
try { Notifications = require('expo-notifications'); } catch (e) {}

// ─── Configure foreground notification behaviour ──────────────────────────────
// Show banner + sound even when app is in foreground
if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
      }),
    });
  } catch (_) {}
}

/**
 * Registers the device for push notifications AND listens to socket events
 * to fire local push notifications for:
 *   - incoming_call  → "📞 Incoming Call" alert + push
 *   - new_message    → "💬 New Message" push
 *
 * Call this hook once after the user logs in.
 */
export const useNotifications = (isAuthenticated, navigationRef, user) => {
  const notificationListener = useRef();
  const responseListener     = useRef();

  // ── Register device for push ────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !Notifications) return;

    const register = async () => {
      try {
        // Create Android channels before token registration so remote messages
        // have valid high-priority destinations from the first launch.
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('calls', {
            name: 'Incoming Calls',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 200, 500],
            lightColor: '#B09C85',
            sound: 'default',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
            showBadge: true,
          });
          await Notifications.setNotificationChannelAsync('messages', {
            name: 'Messages',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250],
            lightColor: '#10B981',
            sound: 'default',
          });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.warn('[Push] Notification permission denied');
          return;
        }

        // Pass projectId explicitly so it works in both EAS dev client and production
        const projectId = Constants.expoConfig?.extra?.eas?.projectId
          || Constants.easConfig?.projectId
          || Constants.expoConfig?.extra?.projectId;

        if (!projectId) {
          console.warn('[Push] Expo project ID is missing');
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;
        console.log('[Push] ✅ Device registered for notifications');

        // Save token to backend so server can wake the device when app is killed
        try { await authAPI.updateFCMToken?.(token); } catch (_) {}

      } catch (err) {
        console.warn('[Push] Registration failed:', err?.message);
      }
    };

    register();

    // ── Foreground notification received (from Expo Push / remote) ──────────
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      // Notification already shown by handler above — no extra action needed
    });

    // ── Notification tapped → navigate ──────────────────────────────────────
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      
      const tryNavigate = (attempt = 0) => {
        const nav = navigationRef?.current;
        if (!nav?.isReady?.()) {
          if (attempt < 10) setTimeout(() => tryNavigate(attempt + 1), 500);
          return;
        }

        if (data.type === 'new_message' && data.chatId) {
          nav.navigate('Chat', { chatId: data.chatId });
        } else if (data.type === 'incoming_call') {
          nav.navigate('IncomingCall', {
            ...data,
            callerName: data.clientName || data.callerName || 'Caller',
            callerAvatar: data.clientAvatar || data.callerAvatar || null,
            zegoToken: data.zegoToken || data.advocateToken || data.clientToken || null,
          });
        } else if (data.bookingId) {
          nav.navigate('MyBookings');
        }
      };
      
      tryNavigate();
    });

    return () => {
      if (notificationListener.current) {
        if (typeof notificationListener.current.remove === 'function') {
          notificationListener.current.remove();
        } else if (Notifications?.removeNotificationSubscription) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
      }
      if (responseListener.current) {
        if (typeof responseListener.current.remove === 'function') {
          responseListener.current.remove();
        } else if (Notifications?.removeNotificationSubscription) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      }
    };
  }, [isAuthenticated]);

  // ── Keep a ref to user so handlers always read the latest value ────────────
  const userRef = useRef(user);
  useLayoutEffect(() => { userRef.current = user; }, [user]);

  // ── Socket event listeners for foreground in-app notifications ─────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    let socket = null;
    let handleIncomingCall = null;
    let appStateSubscription = null;
    let retryTimer = null;
    let didSetup = false; // prevent duplicate listener attachment

    const setupListeners = async () => {
      if (didSetup) return; // already attached

      // Try existing socket first, then connect if needed
      socket = getSocket();
      if (!socket || !socket.connected) {
        socket = await connectSocket();
      }
      if (!socket) {
        console.warn('[useNotifications] Socket unavailable — retrying in 3s');
        retryTimer = setTimeout(setupListeners, 3000);
        return;
      }

      didSetup = true;
      socket.emit('app_state', { state: AppState.currentState });
      appStateSubscription = AppState.addEventListener('change', (state) => {
        socket?.emit('app_state', { state });
      });

      // ── Incoming Call (foreground) ──────────────────────────────────────────
      handleIncomingCall = (data) => {
        console.log('[useNotifications] incoming_call received:', data);
        const u = userRef.current; // always latest user — no stale closure
        const callerName   = data.callerName || data.clientName || data.advocateName || 'Someone';
        const callerAvatar = data.callerAvatar || data.clientAvatar || null;

        const trySocketNavigate = (attempt = 0) => {
          const nav = navigationRef?.current;
          if (nav?.isReady?.()) {
            const currentUserRole = u?.role || u?.user?.role || 'client';
            const targetRoute     = currentUserRole === 'advocate' ? 'AdvocateCall' : 'VideoCall';
            const myId   = u?._id || u?.user?._id || u?.id || u?.user?.id || '';
            const myName = u?.name || u?.user?.name || 'Me';

            nav.navigate('IncomingCall', {
              callerName,
              callerAvatar,
              mode:           data.mode || 'video',
              zegoRoomId:     data.zegoRoomId,
              zegoToken:      data.zegoToken || data.advocateToken || data.clientToken || null,
              zegoAppId:      data.zegoAppId || 0,
              bookingId:      data.bookingId,
              clientId:       data.clientId,
              advocateUserId: data.advocateUserId,
              myUserId:       String(myId),
              myUserName:     myName,
              targetRoute,
            });
          } else {
            if (attempt < 10) setTimeout(() => trySocketNavigate(attempt + 1), 500);
            else console.warn('[useNotifications] Nav not ready, dropping socket incoming_call');
          }
        };
        trySocketNavigate();

        // The backend always sends the high-priority remote call push. Creating
        // another local notification here caused duplicate incoming-call alerts.
      };

      socket.on('incoming_call',        handleIncomingCall);
      console.log('[useNotifications] ✅ Listeners attached. Socket:', socket.id);
    };

    setupListeners();

    return () => {
      // Cancel any pending retry
      if (retryTimer) clearTimeout(retryTimer);
      appStateSubscription?.remove?.();
      // Remove listeners from socket
      if (socket && handleIncomingCall) {
        socket.off('incoming_call', handleIncomingCall);
      }
    };
  // Note: 'user' removed from deps — we use userRef for latest value without re-attaching
  }, [isAuthenticated, navigationRef]);
};
