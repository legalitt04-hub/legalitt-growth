// screens/advocate/AdvocateCallScreen.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { getSocket } from '../../services/socket';
import { callsAPI } from '../../services/api';

// ── Safe lazy load — only in EAS builds ───────────────────────────────────
let ZegoUIKitPrebuiltCall = null;
let ONE_ON_ONE_VIDEO_CALL_CONFIG = null;
let ONE_ON_ONE_VOICE_CALL_CONFIG = null;

try {
  if (Constants.appOwnership !== 'expo') {
    const zego = require('@zegocloud/zego-uikit-prebuilt-call-rn');
    ZegoUIKitPrebuiltCall        = zego.ZegoUIKitPrebuiltCall        ?? null;
    ONE_ON_ONE_VIDEO_CALL_CONFIG = zego.ONE_ON_ONE_VIDEO_CALL_CONFIG ?? null;
    ONE_ON_ONE_VOICE_CALL_CONFIG = zego.ONE_ON_ONE_VOICE_CALL_CONFIG ?? null;
  }
} catch (_) {}

// ── Zego credentials ──────────────────────────────────────────────────────
function resolveAppId(param) {
  const fromParam = Number(param);
  return fromParam > 0 ? fromParam : 0;
}
function resolveAppSign() {
  return '';
}

// ─────────────────────────────────────────────────────────────────────────

export default function AdvocateCallScreen({ navigation, route }) {
  const {
    zegoRoomId: paramRoomId,
    zegoToken,
    zegoAppId,
    clientName   = 'Client',
    myUserId     = '',
    myUserName   = 'Advocate',
    mode         = 'video',
    bookingId,
    clientId,
    advocateUserId,
  } = route?.params ?? {};

  const stableUserIdRef = useRef(
    myUserId ? String(myUserId) : ''
  );
  const callStartRef = useRef(Date.now());

  const effectiveAppId   = resolveAppId(zegoAppId);
  const effectiveAppSign = resolveAppSign();
  const zegoRoomId       = paramRoomId || (bookingId ? `legalitt-${bookingId}` : null);
  const isCallReady      = !!zegoRoomId && effectiveAppId > 0 && !!zegoToken && !!stableUserIdRef.current;

  const [permissionsGranted, setPermissionsGranted] = useState(Platform.OS === 'ios');
  const [zegoReady, setZegoReady] = useState(false);

  // ── Request permissions ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isCallReady) {
      Alert.alert(
        'Call Not Ready',
        'The call room is not set up yet. Please go back and try again.',
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
        const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
        if (mode === 'video') perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (Platform.Version >= 31) perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);

        const result = await PermissionsAndroid.requestMultiple(perms);
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

  // ── Socket: listen for remote hang-up ───────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onEnded = () => navigation.goBack();
    socket.on('call_ended', onEnded);
    return () => { socket.off('call_ended', onEnded); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hang-up handler ──────────────────────────────────────────────────────
  const handleHangUp = () => {
    try {
      const socket = getSocket();
      if (socket) {
        socket.emit('call_ended', {
          bookingId,
          clientId,
          advocateUserId: stableUserIdRef.current,
        });
      }
    } catch (_) {}

    // Log call duration (fire & forget)
    try {
      const durationSec = Math.round((Date.now() - callStartRef.current) / 1000);
      callsAPI.logCall({
        bookingId,
        clientUserId:   clientId,
        advocateUserId: stableUserIdRef.current,
        mode,
        status:    durationSec > 5 ? 'completed' : 'missed',
        duration:  durationSec,
        startedAt: new Date(callStartRef.current).toISOString(),
        endedAt:   new Date().toISOString(),
        zegoRoomId,
      }).catch(() => {});
    } catch (_) {}

    navigation.goBack();
  };

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

  // ── Expo Go / module-not-loaded fallback ─────────────────────────────────
  if (!ZegoUIKitPrebuiltCall || Constants.appOwnership === 'expo') {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <Text style={styles.devIcon}>{mode === 'video' ? '📹' : '🎙️'}</Text>
        <Text style={styles.devTitle}>{mode === 'video' ? 'Video Call' : 'Voice Call'}</Text>
        <Text style={styles.devRoom}>Room: {zegoRoomId}</Text>
        <Text style={styles.devNote}>
          Calling is only available in the EAS build.{'\n'}
          This is an Expo Go / dev build — native modules not linked.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Zego config — default preset + required no-op stubs ─────────────────
  // IMPORTANT: Zego internally calls onJoinRoom, onUserJoin, onCallEnd etc.
  // Passing undefined for these causes "undefined is not a function" crash.
  const callConfig = {
    ...(mode === 'video' ? (ONE_ON_ONE_VIDEO_CALL_CONFIG ?? {}) : (ONE_ON_ONE_VOICE_CALL_CONFIG ?? {})),
    turnOnCameraWhenJoining:     mode === 'video',
    turnOnMicrophoneWhenJoining: true,
    useSpeakerWhenJoining:       true,
    onJoinRoom:       () => {},
    onUserJoin:       () => {},
    onCallEnd:        () => { handleHangUp(); },
    onDurationUpdate: () => {},
    bottomMenuBarConfig: {
      buttons: mode === 'video' 
        ? ['toggleCameraButton', 'switchCameraButton', 'hangUpButton', 'toggleMicrophoneButton']
        : ['toggleMicrophoneButton', 'hangUpButton', 'switchAudioOutputButton'],
    },
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <ZegoUIKitPrebuiltCall
        appID={effectiveAppId}
        appSign={effectiveAppSign}
        userID={stableUserIdRef.current}
        userName={String(myUserName || 'Advocate')}
        callID={String(zegoRoomId)}
        config={callConfig}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  waitText:    { color: '#94A3B8', fontSize: 14, marginTop: 12, textAlign: 'center' },
  devIcon:     { fontSize: 64, marginBottom: 16 },
  devTitle:    { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  devRoom:     { color: '#14B8A6', fontSize: 13, marginBottom: 16 },
  devNote:     { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 32, paddingHorizontal: 32 },
  backBtn:     { backgroundColor: '#14B8A6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  backBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
