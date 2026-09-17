// IncomingCallScreen.jsx — Full-screen incoming call UI (replaces Alert)
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, StatusBar, Image, Platform, ActivityIndicator, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { connectSocket, getSocket } from '../../services/socket';
import { bookingAPI } from '../../services/api';
import { Audio } from 'expo-av';

const AUTO_DECLINE_SECS = 35; // Auto-decline after 35s

export default function IncomingCallScreen({ navigation, route }) {
  const {
    callerName: _callerName,
    callerAvatar = null,
    clientName,
    advocateName,
    clientAvatar,
    advocateAvatar,
    mode = 'video',
    zegoRoomId,
    zegoToken,
    zegoAppId,
    bookingId,
    clientId,
    advocateUserId,
    myUserId,
    myUserName,
    targetRoute = 'VideoCall',
  } = route?.params ?? {};

  // Resolve caller display name from any field provided
  const callerName   = _callerName || clientName || advocateName || 'Unknown Caller';
  const callerPhoto  = callerAvatar || clientAvatar || advocateAvatar || null;

  const insets = useSafeAreaInsets();
  const [countdown, setCountdown] = useState(AUTO_DECLINE_SECS);

  // ── Ripple animations ─────────────────────────────────────────────────────
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    const a1 = pulse(ring1, 0);
    const a2 = pulse(ring2, 600);
    const a3 = pulse(ring3, 1200);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  // ── Countdown → auto-decline ──────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Listen for Caller cancelling the call ──────────────────────────────────
  useEffect(() => {
    let activeSocket = null;
    let isMounted = true;

    const setupListener = async () => {
      activeSocket = getSocket() || await connectSocket();
      
      if (!isMounted) return;

      const onCallEnded = () => {
        // Caller hung up before we picked up
        if (soundRef.current) soundRef.current.stopAsync();
        if (navigation.canGoBack()) navigation.goBack();
      };
      onCallEndedRef.current = onCallEnded;
      
      if (activeSocket) {
        activeSocket.on('call_ended', onCallEnded);
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (activeSocket && onCallEndedRef.current) activeSocket.off('call_ended', onCallEndedRef.current);
    };
  }, [navigation]);

  // ── Ringtone ──────────────────────────────────────────────────────────────
  const soundRef = useRef(null);
  
  useEffect(() => {
    let isMounted = true;
    const playRingtone = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          require('../../../assets/incoming-call.wav'),
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        if (isMounted) {
          soundRef.current = sound;
        } else {
          sound.unloadAsync();
        }
      } catch (err) {
        console.warn('Could not play incoming ringtone:', err);
      }
    };
    playRingtone();
    
    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.stopAsync().then(() => {
          soundRef.current?.unloadAsync();
        });
      }
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const [isAccepting, setIsAccepting] = useState(false);
  const onCallEndedRef = useRef(null);

  const handleDecline = async () => {
    if (soundRef.current) await soundRef.current.stopAsync();
    try {
      const socket = getSocket() || await connectSocket();
      if (socket) {
        socket.emit('call_ended', { bookingId, clientId, advocateUserId });
        socket.emit('call_missed', { bookingId, clientId, advocateUserId, mode });
      }
    } catch (err) {
      console.warn('Decline emit failed:', err);
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

  const handleAccept = async () => {
    if (isAccepting) return;
    setIsAccepting(true);
    if (soundRef.current) await soundRef.current.stopAsync();

    let callConfig = { zegoRoomId, zegoToken, zegoAppId };
    try {
      if (bookingId) {
        const response = await bookingAPI.canJoinCall(bookingId);
        const payload = response?.data;
        if (payload?.canJoin === false) {
          throw new Error(payload.message || 'This call is not available right now.');
        }
        callConfig = { ...callConfig, ...(payload?.data || {}) };
      }

      if (!callConfig.zegoRoomId || !callConfig.zegoToken || !Number(callConfig.zegoAppId)) {
        throw new Error('Secure call credentials are unavailable. Please try again.');
      }

      const socket = getSocket() || await connectSocket();
      if (socket) {
        socket.emit('call_accepted', { bookingId, clientId, advocateUserId });
      } else {
        console.warn('[IncomingCall] Failed to get socket for call_accepted');
      }
    } catch (err) {
      console.warn('Accept call failed:', err);
      Alert.alert('Unable to join call', err?.message || 'Please try again.');
      setIsAccepting(false);
      return;
    }

    navigation.replace(targetRoute, {
      zegoRoomId: callConfig.zegoRoomId,
      zegoToken: callConfig.zegoToken,
      zegoAppId: callConfig.zegoAppId,
      mode,
      bookingId,
      clientName:     callerName,
      advocateName:   callerName,
      callerName:     callerName,
      clientAvatar:   callerPhoto,
      advocateAvatar: callerPhoto,
      clientId,
      advocateUserId,
      myUserId:   callConfig.myUserId || myUserId || '',
      myUserName: callConfig.myUserName || myUserName || 'Me',
    });
  };

  // ── Ripple ring style ─────────────────────────────────────────────────────
  const ringStyle = (anim) => ({
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    transform: [{
      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }),
    }],
    opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.8, 0.4, 0] }),
  });

  const isVideo = mode === 'video';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1120" />

      {/* Dark gradient background */}
      <View style={styles.bg} />
      <View style={styles.bgOverlay} />

      {/* Top section */}
      <View style={[styles.top, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.callType}>
          {isVideo ? '📹 Incoming Video Call' : '📞 Incoming Voice Call'}
        </Text>
        <Text style={styles.subtitle}>
          from Legalitt
        </Text>

        {/* Ripple rings + Avatar */}
        <View style={styles.avatarWrap}>
          <Animated.View style={ringStyle(ring1)} />
          <Animated.View style={ringStyle(ring2)} />
          <Animated.View style={ringStyle(ring3)} />

          <View style={styles.avatar}>
            {callerPhoto ? (
              <Image source={{ uri: callerPhoto }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {callerName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.callerRole}>
          {targetRoute === 'AdvocateCall' ? 'Client · Legalitt' : 'Advocate · Legalitt'}
        </Text>

        {/* Countdown ring */}
        <Text style={styles.countdown}>Auto-decline in {countdown}s</Text>
      </View>

      {/* Bottom buttons */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 32 }]}>
        {/* Decline */}
        <View style={styles.btnWrap}>
          <TouchableOpacity style={[styles.callBtn, styles.declineBtn]} onPress={handleDecline} activeOpacity={0.8}>
            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.btnLabel}>Decline</Text>
        </View>

        {/* Accept */}
        <View style={styles.btnWrap}>
          <TouchableOpacity 
            style={[styles.callBtn, styles.acceptBtn]} 
            onPress={handleAccept} 
            activeOpacity={0.8}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name={isVideo ? 'videocam' : 'call'} size={32} color="#fff" />
            )}
          </TouchableOpacity>
          <Text style={styles.btnLabel}>{isAccepting ? 'Connecting...' : 'Accept'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0B1120' },
  bg:            { ...StyleSheet.absoluteFillObject, backgroundColor: '#0B1120' },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,184,166,0.07)',
  },

  top: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
  },

  callType: {
    color: '#14B8A6',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginBottom: 56,
  },

  avatarWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#14B8A6',
  },
  avatarImg:     { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 42, fontWeight: '700', color: '#14B8A6' },

  callerName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  callerRole: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginBottom: 20,
  },
  countdown: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginTop: 8,
  },

  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 48,
    paddingTop: 24,
  },
  btnWrap: { alignItems: 'center', gap: 10 },
  callBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  declineBtn: { backgroundColor: '#EF4444' },
  acceptBtn:  { backgroundColor: '#10B981' },
  btnLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
});
