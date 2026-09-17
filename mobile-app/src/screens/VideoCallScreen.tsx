import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Alert,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
  Animated,
  Easing,
  Image,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { getSocket } from '../services/socket';
import { callsAPI } from '../services/api';

// ── Safe lazy load — only in EAS builds ────────────────────────────────────
let ZegoUIKitPrebuiltCall: any = null;
let ONE_ON_ONE_VIDEO_CALL_CONFIG: any = null;
let ONE_ON_ONE_VOICE_CALL_CONFIG: any = null;

try {
  if (Constants.appOwnership !== 'expo') {
    const zego = require('@zegocloud/zego-uikit-prebuilt-call-rn');
    ZegoUIKitPrebuiltCall       = zego.ZegoUIKitPrebuiltCall       ?? null;
    ONE_ON_ONE_VIDEO_CALL_CONFIG = zego.ONE_ON_ONE_VIDEO_CALL_CONFIG ?? null;
    ONE_ON_ONE_VOICE_CALL_CONFIG = zego.ONE_ON_ONE_VOICE_CALL_CONFIG ?? null;
  }
} catch (_) {}

// ── Zego credentials ────────────────────────────────────────────────────────
function resolveAppId(param?: any): number {
  const fromParam = Number(param);
  return fromParam > 0 ? fromParam : 0;
}
function resolveAppSign(): string {
  return '';
}

// ────────────────────────────────────────────────────────────────────────────

export default function VideoCallScreen({ navigation, route }: any) {
  const {
    zegoRoomId,
    zegoToken,
    advocateName  = 'Advocate',
    advocateAvatar = null,
    myUserId      = '',
    myUserName    = 'User',
    mode          = 'video',
    bookingId,
    advocateUserId,
    clientId,
    zegoAppId,
  } = route?.params ?? {};

  const stableUserIdRef = useRef<string>(
    myUserId ? String(myUserId) : ''
  );

  const effectiveAppId   = resolveAppId(zegoAppId);
  const effectiveAppSign = resolveAppSign();
  const effectiveRoomId  = zegoRoomId || (bookingId ? `legalitt-${bookingId}` : null);
  const isCallReady      = !!effectiveRoomId && effectiveAppId > 0 && !!zegoToken && !!stableUserIdRef.current;

  const [permissionsGranted, setPermissionsGranted] = useState(Platform.OS === 'ios');
  const [zegoReady, setZegoReady]       = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const hangupCalledRef = useRef(false); // prevent double-hangup
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (remoteJoined) return;
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [remoteJoined, pulse]);

  // ── Request permissions ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isCallReady) {
      Alert.alert(
        'Call Not Ready',
        'Missing booking or room info. Please go back and try again.',
        [{ text: 'Go Back', onPress: () => navigation.goBack() }]
      );
      return;
    }

    if (Platform.OS !== 'android') {
      setPermissionsGranted(true);
      return;
    }

    (async () => {
      try {
        const perms: string[] = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
        if (mode === 'video') perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        if ((Platform.Version as number) >= 31) perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);

        const result = await PermissionsAndroid.requestMultiple(perms as any);
        const micOk = result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        const camOk = mode !== 'video' || result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;

        if (micOk && camOk) {
          setPermissionsGranted(true);
        } else {
          Alert.alert(
            'Permission Required',
            mode === 'video' ? 'Camera & microphone access needed.' : 'Microphone access needed.',
            [{ text: 'Go Back', onPress: () => navigation.goBack() }]
          );
        }
      } catch {
        // Optimistic fallback — proceed anyway
        setPermissionsGranted(true);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wait a tick after permissions so Zego mounts cleanly ────────────────
  useEffect(() => {
    if (!permissionsGranted) return;
    const t = setTimeout(() => setZegoReady(true), 300);
    return () => clearTimeout(t);
  }, [permissionsGranted]);

  // ── Hang-up handler ──────────────────────────────────────────────────────
  // useCallback ensures stable reference so Zego config doesn't recreate it
  const handleHangUp = useCallback(async () => {
    if (hangupCalledRef.current) return; // prevent double call
    hangupCalledRef.current = true;

    let duration = 0;
    if (callStartTime) {
      duration = Math.floor((Date.now() - callStartTime) / 1000);
    }

    try {
      const socket = getSocket();
      if (socket) {
        if (duration > 0) {
          socket.emit('call_completed', {
            bookingId,
            clientId: clientId || stableUserIdRef.current,
            advocateUserId: advocateUserId ?? null,
            mode,
            duration,
          });
        } else {
          socket.emit('call_missed', {
            bookingId,
            clientId: clientId || stableUserIdRef.current,
            advocateUserId: advocateUserId ?? null,
            mode,
          });
        }
        socket.emit('call_ended', {
          bookingId,
          clientId: clientId || stableUserIdRef.current,
          advocateUserId: advocateUserId ?? null,
        });
      }

      // Log call to backend
      await callsAPI.logCall({
        bookingId,
        advocateUserId: advocateUserId ?? null,
        clientUserId: clientId || stableUserIdRef.current,
        mode: mode ?? 'video',
        status: duration > 0 ? 'completed' : 'missed',
        duration,
        endedAt: new Date().toISOString(),
      });
    } catch (_) {}

    // Navigate away — use timeout so Zego engine can clean up first
    setTimeout(() => {
      if (duration > 0 && bookingId) {
        navigation.replace('CallFeedback', {
          bookingId,
          duration,
          advocateUserId: advocateUserId ?? null,
          mode,
        });
      } else {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.replace('Home');
      }
    }, 300);
  }, [callStartTime, bookingId, clientId, advocateUserId, mode, navigation]);

  // ── Socket: listen for remote hang-up ───────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onEnded = () => { handleHangUp(); };
    socket.on('call_ended', onEnded);
    return () => { socket.off('call_ended', onEnded); };
  }, [handleHangUp]);

  // ── Loading / permission gate ────────────────────────────────────────────
  if (!isCallReady || !permissionsGranted || !zegoReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#14B8A6" />
        <Text style={styles.waitText}>
          {!isCallReady
            ? 'Setting up room...'
            : !permissionsGranted
            ? mode === 'video' ? 'Requesting camera & mic...' : 'Requesting mic...'
            : 'Starting call...'}
        </Text>
      </View>
    );
  }

  // ── Expo Go fallback ─────────────────────────────────────────────────────
  if (!ZegoUIKitPrebuiltCall || Constants.appOwnership === 'expo') {
    return (
      <View style={styles.container}>
        <Ionicons name="code-working-outline" size={64} color="#14B8A6" style={{ marginBottom: 16 }} />
        <Text style={styles.devTitle}>Expo Go Detected</Text>
        <Text style={styles.devRoom}>Room: {effectiveRoomId}</Text>
        <Text style={styles.devNote}>Native calling modules cannot run inside Expo Go. Use the EAS build.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Zego config ──────────────────────────────────────────────────────────
  const callConfig = {
    ...(mode === 'video' ? (ONE_ON_ONE_VIDEO_CALL_CONFIG ?? {}) : (ONE_ON_ONE_VOICE_CALL_CONFIG ?? {})),
    turnOnCameraWhenJoining:     mode === 'video',
    turnOnMicrophoneWhenJoining: true,
    useSpeakerWhenJoining:       true,
    // Remote user joined → hide our ringing overlay
    onUserJoin: () => {
      setRemoteJoined(true);
      if (!callStartTime) setCallStartTime(Date.now());
    },
    onUserLeave: () => {
      setRemoteJoined(false);
    },
    // Both onHangUp and onCallEnd should trigger our cleanup
    onHangUp:  () => { handleHangUp(); },
    onCallEnd: () => { handleHangUp(); },
    // No-ops to prevent Zego crash
    onJoinRoom: () => {},
    onDurationUpdate: () => {},
    bottomMenuBarConfig: {
      buttons: mode === 'video'
        ? ['toggleCameraButton', 'switchCameraButton', 'hangUpButton', 'toggleMicrophoneButton']
        : ['toggleMicrophoneButton', 'hangUpButton', 'switchAudioOutputButton'],
    },
  };

  // ── Peer info ────────────────────────────────────────────────────────────
  const peerName   = advocateName || 'Advocate';
  const peerAvatar = advocateAvatar || null;

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar hidden />

      {/* ── Zego renders camera and call UI ── */}
      <ZegoUIKitPrebuiltCall
        appID={effectiveAppId}
        appSign={effectiveAppSign}
        userID={stableUserIdRef.current}
        userName={String(myUserName || 'User')}
        callID={String(effectiveRoomId)}
        config={callConfig}
      />

      {/* ── Ringing overlay — only before remote joins, pointer-events none so Zego buttons work ── */}
      {!remoteJoined && (
        <View
          style={[
            styles.ringingOverlay,
            { backgroundColor: mode === 'voice' ? '#0f172a' : 'rgba(15,23,42,0.55)' },
          ]}
          pointerEvents="none"  // <<< CRITICAL: lets touches pass through to Zego hangup button
        >
          <Animated.View style={[styles.ringingAvatarFrame, { transform: [{ scale: pulse }] }]}>
            {peerAvatar ? (
              <Image source={{ uri: peerAvatar }} style={styles.ringingAvatar} />
            ) : (
              <View style={styles.ringingAvatarFallback}>
                <Text style={styles.ringingAvatarInitial}>{peerName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </Animated.View>
          <Text style={styles.ringingName}>Calling {peerName}...</Text>
          <Text style={styles.ringingSub}>Waiting for them to join</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  waitText:    { color: '#94A3B8', fontSize: 14, marginTop: 12, textAlign: 'center' },
  devTitle:    { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  devRoom:     { color: '#14B8A6', fontSize: 13, marginBottom: 16 },
  devNote:     { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 32, paddingHorizontal: 32 },
  backBtn:     { backgroundColor: '#14B8A6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  backBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  ringingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // bottom is NOT limited — we cover full screen but pointerEvents="none" lets touches through
    zIndex: 5,
  },
  ringingAvatarFrame: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, borderColor: '#14B8A6',
    marginBottom: 24,
    backgroundColor: '#1E293B',
    elevation: 10,
    shadowColor: '#14B8A6', shadowOpacity: 0.5, shadowRadius: 15,
    overflow: 'hidden',
  },
  ringingAvatar:         { width: '100%', height: '100%' },
  ringingAvatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringingAvatarInitial:  { fontSize: 48, fontWeight: '700', color: '#14B8A6' },
  ringingName: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  ringingSub:  { color: 'rgba(255,255,255,0.7)', fontSize: 16, textAlign: 'center' },
});
