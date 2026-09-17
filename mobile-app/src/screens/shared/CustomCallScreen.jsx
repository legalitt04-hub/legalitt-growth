/**
 * CustomCallScreen.jsx
 * Custom video/voice call screen using Zego Express Engine.
 * Shows caller name, photo, call duration, and controls.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Platform, PermissionsAndroid, StatusBar, Animated, Easing, Alert,
  findNodeHandle
} from 'react-native';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSocket } from '../../services/socket';
import { callsAPI } from '../../services/api';

// ── Safe lazy-load Zego (only in EAS builds, not Expo Go) ────────────────────
let ZegoExpressEngine = null;
let ZegoSurfaceView   = null;
let ZegoViewClass     = null; // ZegoView constructor — required for startPreview / startPlayingStream

try {
  const zegoLib = require('zego-express-engine-reactnative');
  ZegoExpressEngine = zegoLib.ZegoExpressEngine ?? zegoLib.default ?? zegoLib;
  // iOS uses ZegoTextureView (UIView-backed), Android uses ZegoSurfaceView
  ZegoSurfaceView = Platform.OS === 'ios'
    ? (zegoLib.ZegoTextureView ?? zegoLib.ZegoSurfaceView ?? null)
    : (zegoLib.ZegoSurfaceView ?? null);
  ZegoViewClass = zegoLib.ZegoView ?? null; // class-based constructor
} catch (err) {
  console.log('Failed to load Zego natively:', err);
}

// App ID and short-lived room token must come from the authenticated backend.
function getAppId(param) { const n = Number(param); return n > 0 ? n : 0; }
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

// ─────────────────────────────────────────────────────────────────────────────
export default function CustomCallScreen({ navigation, route }) {
  const {
    zegoRoomId,
    zegoToken,
    zegoAppId,
    mode          = 'video',
    clientName    = '',
    clientAvatar  = null,
    advocateName,
    advocateAvatar = null,
    callerName,       // passed from IncomingCallScreen
    callerAvatar,     // passed from IncomingCallScreen
    myUserId      = '',
    myUserName    = 'Me',
    bookingId,
    advocateUserId,
    clientId,
  } = route?.params ?? {};

  const insets   = useSafeAreaInsets();
  const isVideo  = mode === 'video';

  // Peer display info — accept any field name
  const peerName   = callerName || clientName || advocateName || 'Caller';
  const peerAvatar = callerAvatar || clientAvatar || advocateAvatar || null;


  // ── State ─────────────────────────────────────────────────────────────────
  const [status,         setStatus]         = useState('connecting');
  const [micOn,          setMicOn]          = useState(true);
  const [cameraOn,       setCameraOn]       = useState(isVideo);
  const [isFront,        setIsFront]        = useState(true);
  const [speakerOn,      setSpeakerOn]      = useState(true);
  const [duration,       setDuration]       = useState(0);
  const [remoteHere,     setRemoteHere]     = useState(false);
  const [networkQuality, setNetworkQuality] = useState('🟢 Good');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [remoteCameraOff, setRemoteCameraOff] = useState(false);
  const [remoteMicOff,   setRemoteMicOff]   = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const engineRef    = useRef(null);
  const localRef     = useRef(null);
  const remoteRef    = useRef(null);
  const timerRef     = useRef(null);
  const startRef     = useRef(null);
  const cleanedUp    = useRef(false);
  const hangupCalled = useRef(false);          // prevent double hangup
  const pendingStreamId = useRef(null);        // store stream ID if remoteRef not ready yet
  const stableId     = useRef(myUserId ? String(myUserId) : '');
  const roomId       = zegoRoomId || (bookingId ? `legalitt-${bookingId}` : null);
  const appID        = getAppId(zegoAppId);

  // ── Pulse animation ───────────────────────────────────────────────────────
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (remoteHere) return;
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [remoteHere]);

  // ── Cleanup Zego engine ───────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (cleanedUp.current) return;
    cleanedUp.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      if (engineRef.current) {
        engineRef.current.stopPublishingStream();
        if (roomId) engineRef.current.logoutRoom(roomId);
      }
      if (ZegoExpressEngine?.destroyEngine) ZegoExpressEngine.destroyEngine();
    } catch (_) {}
    engineRef.current = null;
  }, [roomId]);

  // ── HANG UP — THE MOST IMPORTANT FUNCTION ────────────────────────────────
  const handleHangUp = useCallback(async () => {
    if (hangupCalled.current) return;
    hangupCalled.current = true;

    // Calculate duration OUTSIDE try block so it's available for navigation
    const finalDuration = startRef.current
      ? Math.floor((Date.now() - startRef.current) / 1000)
      : 0;

    let recordedBySocket = false;
    // Emit socket events. The socket backend persists the call log and chat event.
    try {
      const socket = getSocket();
      if (socket) {
        if (finalDuration > 0) {
          socket.emit('call_completed', { bookingId, clientId, advocateUserId, mode, duration: finalDuration });
        } else {
          socket.emit('call_missed', { bookingId, clientId, advocateUserId, mode });
        }
        socket.emit('call_ended', { bookingId, clientId, advocateUserId });
        recordedBySocket = true;
      }
    } catch (_) {}

    // REST is a fallback only when the socket is unavailable; doing both created
    // duplicate call-history entries.
    try {
      const resolvedClientId = clientId || (advocateUserId !== stableId.current ? stableId.current : null);
      if (!recordedBySocket && resolvedClientId) {
        await callsAPI.logCall({
          bookingId:      bookingId || null,
          clientUserId:   resolvedClientId,
          advocateUserId: advocateUserId,
          duration:       finalDuration,
          mode:           mode || (isVideo ? 'video' : 'voice'),
          status:         finalDuration > 0 ? 'completed' : 'missed',
          endReason:      finalDuration > 0 ? 'USER_ENDED' : 'MISSED',
        });
      }
    } catch (_) {}

    cleanup();

    // Navigate — slight delay so engine cleanup runs first
    setTimeout(() => {
      if (finalDuration > 0 && bookingId) {
        navigation.replace('CallFeedback', { bookingId, advocateUserId, clientId, duration: finalDuration });
      } else {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.replace('Home');
      }
    }, 250);
  }, [bookingId, clientId, advocateUserId, mode, isVideo, cleanup, navigation]);

  // ── Init Zego Express Engine ──────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !appID || !zegoToken || !stableId.current) {
      setStatus('failed');
      Alert.alert('Call unavailable', 'Secure call credentials are missing. Please return and try again.');
      return;
    }
    if (!ZegoExpressEngine) {
      setStatus('connected');
      return;
    }

    const init = async () => {
      // 1. Permissions
      if (Platform.OS === 'android') {
        try {
          const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
          if (isVideo) perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
          if ((Platform.Version ?? 0) >= 31) perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
          await PermissionsAndroid.requestMultiple(perms);
        } catch (_) {}
      }

      try {
        // 2. Create engine
        const engine = await ZegoExpressEngine.createEngineWithProfile({
          appID,
          appSign: '',
          scenario: 0,
        });
        engineRef.current = engine;

        // 3. Event listeners
        engine.on('networkQuality', (userId, upstream, downstream) => {
          const maxLevel = Math.max(upstream, downstream);
          if (maxLevel <= 1) setNetworkQuality('🟢 Good');
          else if (maxLevel === 2) setNetworkQuality('🟡 Fair');
          else setNetworkQuality('🔴 Poor');
        });

        engine.on('remoteCameraStateUpdate', (streamID, state) => {
          setRemoteCameraOff(state !== 0);
        });

        engine.on('remoteMicStateUpdate', (streamID, state) => {
          setRemoteMicOff(state !== 0);
        });

        engine.on('roomStateUpdate', (rId, state, errCode) => {
          if (state === 2) {
            // Connected
            setStatus('connected');
            setIsReconnecting(false);
          } else if (state === 1 && status === 'connected') {
            setIsReconnecting(true);
          } else if (state === 0 && errCode !== 0) {
            handleHangUp();
          }
        });

        // 4. Remote stream — play as soon as we have a view handle
        engine.on('roomStreamUpdate', (rId, updateType, streamList) => {
          if (updateType === 0 && streamList?.length > 0) {
            const streamID = streamList[0].streamID;
            pendingStreamId.current = streamID;

            const tryPlay = (attempt = 0) => {
              try {
                if (isVideo && remoteRef.current) {
                  const reactTag = findNodeHandle(remoteRef.current);
                  if (reactTag) {
                    const zegoView = { reactTag, viewMode: 1, backgroundColor: 0 };
                    engine.startPlayingStream(streamID, zegoView, {});
                    pendingStreamId.current = null;
                    return;
                  }
                } else if (!isVideo) {
                  engine.startPlayingStream(streamID, undefined, {});
                  pendingStreamId.current = null;
                  return;
                }
              } catch (e) {
                Alert.alert('Play Error', e.message);
                return;
              }
              if (attempt < 10) setTimeout(() => tryPlay(attempt + 1), 300);
            };

            setTimeout(() => tryPlay(), 400);
            setRemoteHere(true);
            if (!startRef.current) startRef.current = Date.now();
            if (!timerRef.current) {
              timerRef.current = setInterval(() => {
                setDuration(Math.floor((Date.now() - startRef.current) / 1000));
              }, 1000);
            }
          }
        });

        // 5. Login room
        await engine.loginRoom(
          roomId,
          { userID: stableId.current, userName: myUserName },
          { isUserStatusNotify: true, token: zegoToken }
        );

        // 6. Start local camera preview — retry until localRef is mounted
        const startLocalPreview = (attempt = 0) => {
          try {
            if (isVideo && localRef.current) {
              const localTag = findNodeHandle(localRef.current);
              if (localTag) {
                const localView = { reactTag: localTag, viewMode: 1, backgroundColor: 0 };
                engine.startPreview(localView, undefined);
                return;
              } else if (attempt === 9) {
                Alert.alert('Preview Error', 'localTag is null. View style might be 0x0 or unmounted.');
              }
            }
          } catch (e) {
            Alert.alert('Preview Error', e.message);
            return;
          }
          if (attempt < 10) setTimeout(() => startLocalPreview(attempt + 1), 300);
        };
        setTimeout(() => startLocalPreview(), 300);

        // 7. Start publishing
        engine.startPublishingStream(`${stableId.current}_stream`);

        // 8. Initial device state
        try { engine.enableCamera(isVideo); }           catch (_) {}
        try { engine.muteMicrophone(false); }           catch (_) {}
        try { engine.setAudioRouteToSpeaker(true); }   catch (_) {}
        try { engine.useFrontCamera(true); }            catch (_) {}

      } catch (err) {
        console.warn('[CustomCall] init error:', err?.message);
        setStatus('failed');
        Alert.alert('Call connection failed', err?.message || 'Please try again.');
      }
    };

    init();
    return () => { cleanup(); };
  }, []); // eslint-disable-line

  // ── Socket: remote hang-up & busy ─────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onEnded = () => {
      const finalDuration = startRef.current
        ? Math.floor((Date.now() - startRef.current) / 1000)
        : 0;
      cleanup();
      setTimeout(() => {
        if (finalDuration > 0 && bookingId) {
          navigation.replace('CallFeedback', { bookingId, advocateUserId, clientId, duration: finalDuration });
        } else if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }, 250);
    };

    const onBusy = (data) => {
      Alert.alert('User Busy', data?.message || 'The user is currently on another call.');
      cleanup();
      if (navigation.canGoBack()) navigation.goBack();
    };

    socket.on('call_ended', onEnded);
    socket.on('call_busy',  onBusy);

    return () => {
      socket.off('call_ended', onEnded);
      socket.off('call_busy',  onBusy);
    };
  }, [cleanup, navigation, bookingId, advocateUserId, clientId]);

  // ── 40-Second Timeout → Missed Call ──────────────────────────────────────
  useEffect(() => {
    if (remoteHere) return;

    const timeout = setTimeout(async () => {
      try {
        const socket = getSocket();
        if (socket) {
          socket.emit('call_missed', { bookingId, clientId, advocateUserId, mode });
          socket.emit('call_ended',  { bookingId, clientId, advocateUserId });
        } else {
          const resolvedClientId = clientId || stableId.current;
          if (!resolvedClientId) throw new Error('Client ID unavailable');
          await callsAPI.logCall({
            bookingId:      bookingId || null,
            clientUserId:   resolvedClientId,
            advocateUserId: advocateUserId,
            duration:       0,
            mode:           mode || (isVideo ? 'video' : 'voice'),
            status:         'missed',
            endReason:      'TIMEOUT',
          });
        }
      } catch (_) {}
      cleanup();
      if (navigation.canGoBack()) navigation.goBack();
    }, 40000);

    return () => clearTimeout(timeout);
  }, [remoteHere]); // eslint-disable-line

  // ── Dial Tone ─────────────────────────────────────────────────────────────
  const dialSoundRef = useRef(null);
  useEffect(() => {
    if (remoteHere) {
      // Stop dial tone when remote joins
      if (dialSoundRef.current) {
        dialSoundRef.current.stopAsync().then(() => dialSoundRef.current?.unloadAsync());
        dialSoundRef.current = null;
      }
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
        const { sound } = await Audio.Sound.createAsync(
          // Reliable outgoing ringtone/dialling tone
          { uri: 'https://www.soundjay.com/phone/sounds/telephone-ring-02a.mp3' },
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        if (isMounted && !remoteHere) {
          dialSoundRef.current = sound;
        } else {
          sound.unloadAsync();
        }
      } catch (_) {}
    })();

    return () => {
      isMounted = false;
      if (dialSoundRef.current) {
        dialSoundRef.current.stopAsync().then(() => {
          dialSoundRef.current?.unloadAsync();
          dialSoundRef.current = null;
        });
      }
    };
  }, [remoteHere]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleMic = () => {
    try { engineRef.current?.muteMicrophone(micOn); } catch (_) {}
    setMicOn(v => !v);
  };

  const toggleCamera = () => {
    try { engineRef.current?.enableCamera(!cameraOn); } catch (_) {}
    setCameraOn(v => !v);
  };

  const switchCamera = () => {
    try {
      engineRef.current?.useFrontCamera(!isFront);
      setIsFront(v => !v);
    } catch (err) {
      console.warn('[CustomCall] camera flip warn:', err?.message);
    }
  };

  const toggleSpeaker = () => {
    try { engineRef.current?.setAudioRouteToSpeaker(!speakerOn); } catch (_) {}
    setSpeakerOn(v => !v);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* ── BACKGROUND: remote video stream OR dark bg ── */}
      {isVideo && ZegoSurfaceView ? (
        <ZegoSurfaceView ref={remoteRef} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.voiceBg]} />
      )}

      {/* ── Dark scrim overlay ── */}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />

      {/* ── TOP: caller info ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.callerRow}>
          <Animated.View style={[styles.avatarFrame, { transform: [{ scale: pulse }] }]}>
            {peerAvatar ? (
              <Image source={{ uri: peerAvatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{peerName?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
            )}
            <View style={[styles.onlineRing, status === 'connected' && styles.onlineRingGreen]} />
          </Animated.View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.peerName} numberOfLines={1}>{peerName}</Text>
            <Text style={styles.callStatusText}>
              {!remoteHere
                ? '⏳ Ringing...'
                : `${isVideo ? '📹 Video' : '📞 Voice'} · ${fmt(duration)}`}
            </Text>
            {remoteHere && <Text style={styles.networkText}>{networkQuality}</Text>}
          </View>
        </View>
      </View>

      {/* ── LOCAL CAMERA PREVIEW (bottom-right pip) ── */}
      {isVideo && ZegoSurfaceView && cameraOn && (
        <View style={[styles.localCamWrap, { bottom: insets.bottom + 110 }]}>
          <ZegoSurfaceView ref={localRef} style={styles.localCam} />
          <View style={styles.localLabel}>
            <Text style={styles.localLabelText}>You</Text>
          </View>
        </View>
      )}

      {/* ── VIDEO: avatar when waiting OR remote camera off ── */}
      {isVideo && (!remoteHere || remoteCameraOff) && (
        <View style={styles.waitingCenter} pointerEvents="none">
          <Animated.View style={[styles.waitAvatarFrame, !remoteHere && { transform: [{ scale: pulse }] }]}>
            {peerAvatar ? (
              <Image source={{ uri: peerAvatar }} style={styles.waitAvatar} />
            ) : (
              <View style={styles.waitAvatarFallback}>
                <Text style={styles.waitAvatarInitial}>{peerName?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
            )}
          </Animated.View>
          <Text style={styles.waitName}>{peerName}</Text>
          <Text style={styles.waitSub}>{!remoteHere ? 'Ringing...' : 'Camera is off'}</Text>
        </View>
      )}

      {/* ── VOICE CALL: large centered avatar ── */}
      {!isVideo && (
        <View style={styles.voiceCenter} pointerEvents="none">
          <Animated.View style={[styles.voiceAvatarFrame, { transform: [{ scale: pulse }] }]}>
            {peerAvatar ? (
              <Image source={{ uri: peerAvatar }} style={styles.voiceAvatar} />
            ) : (
              <View style={styles.voiceAvatarFallback}>
                <Text style={styles.voiceAvatarInitial}>{peerName?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
            )}
          </Animated.View>
          <Text style={styles.voiceName}>{peerName}</Text>
          <Text style={styles.voiceSub}>
            {!remoteHere ? '⏳ Ringing...' : `📞 Voice Call · ${fmt(duration)}`}
          </Text>
        </View>
      )}

      {/* ── Status pills ── */}
      {remoteHere && remoteMicOff && (
        <View style={styles.remoteMutedPill}>
          <Ionicons name="mic-off" size={14} color="#fff" />
          <Text style={styles.mutedText}>{peerName} is muted</Text>
        </View>
      )}
      {remoteHere && !micOn && (
        <View style={styles.localMutedPill}>
          <Ionicons name="mic-off" size={14} color="#EF4444" />
          <Text style={styles.mutedTextRed}>You are muted</Text>
        </View>
      )}
      {isReconnecting && (
        <View style={styles.reconnectOverlay}>
          <Ionicons name="warning-outline" size={32} color="#FBBF24" />
          <Text style={styles.reconnectText}>Reconnecting...</Text>
        </View>
      )}

      {/* ── BOTTOM: control bar ── */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
        {/* Camera flip — video only */}
        {isVideo ? (
          <CtrlButton icon="camera-reverse-outline" label="Flip" onPress={switchCamera} />
        ) : (
          <View style={{ width: 60 }} />
        )}

        {/* Mute mic */}
        <CtrlButton
          icon={micOn ? 'mic' : 'mic-off'}
          label={micOn ? 'Mute' : 'Unmute'}
          onPress={toggleMic}
          active={!micOn}
        />

        {/* HANG UP — big red button */}
        <TouchableOpacity style={styles.hangupBtn} onPress={handleHangUp} activeOpacity={0.85}>
          <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>

        {/* Camera toggle / Speaker */}
        {isVideo ? (
          <CtrlButton
            icon={cameraOn ? 'videocam' : 'videocam-off'}
            label={cameraOn ? 'Camera' : 'No Cam'}
            onPress={toggleCamera}
            active={!cameraOn}
          />
        ) : (
          <CtrlButton
            icon={speakerOn ? 'volume-high' : 'volume-mute'}
            label={speakerOn ? 'Speaker' : 'Earpiece'}
            onPress={toggleSpeaker}
            active={!speakerOn}
          />
        )}

        {/* Speaker — video only */}
        {isVideo ? (
          <CtrlButton
            icon={speakerOn ? 'volume-high' : 'volume-mute'}
            label={speakerOn ? 'Speaker' : 'Earpiece'}
            onPress={toggleSpeaker}
            active={!speakerOn}
          />
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>
    </View>
  );
}

// ── Control button component ──────────────────────────────────────────────────
function CtrlButton({ icon, label, onPress, active }) {
  return (
    <TouchableOpacity
      style={[s.ctrlBtn, active && s.ctrlBtnActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={22} color="#fff" />
      <Text style={s.ctrlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0B1120' },
  voiceBg: { flex: 1, backgroundColor: '#0B1120' },
  scrim:   { backgroundColor: 'rgba(0,0,0,0.45)' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },
  callerRow:      { flexDirection: 'row', alignItems: 'center' },
  avatarFrame:    { width: 52, height: 52, borderRadius: 26, position: 'relative' },
  avatarImg:      { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { fontSize: 22, fontWeight: '700', color: '#14B8A6' },
  onlineRing:     { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#6B7280', borderWidth: 2, borderColor: '#0B1120' },
  onlineRingGreen:{ backgroundColor: '#10B981' },
  peerName:       { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  callStatusText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },
  networkText:    { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4, fontWeight: '500' },

  localCamWrap: { position: 'absolute', right: 16, width: 90, height: 130, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', zIndex: 20 },
  localCam:     { flex: 1 },
  localLabel:   { position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center' },
  localLabelText: { color: '#fff', fontSize: 10, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },

  waitingCenter:      { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  waitAvatarFrame:    { width: 110, height: 110, borderRadius: 55, overflow: 'hidden', borderWidth: 3, borderColor: '#14B8A6', marginBottom: 16 },
  waitAvatar:         { width: '100%', height: '100%' },
  waitAvatarFallback: { flex: 1, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' },
  waitAvatarInitial:  { fontSize: 44, fontWeight: '700', color: '#14B8A6' },
  waitName:           { color: '#fff', fontSize: 22, fontWeight: '700' },
  waitSub:            { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6 },

  voiceCenter:          { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  voiceAvatarFrame:     { width: 130, height: 130, borderRadius: 65, overflow: 'hidden', borderWidth: 3, borderColor: '#14B8A6', marginBottom: 20, elevation: 16, shadowColor: '#14B8A6', shadowOpacity: 0.5, shadowRadius: 20 },
  voiceAvatar:          { width: '100%', height: '100%' },
  voiceAvatarFallback:  { flex: 1, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' },
  voiceAvatarInitial:   { fontSize: 52, fontWeight: '800', color: '#14B8A6' },
  voiceName:            { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  voiceSub:             { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8, textAlign: 'center' },

  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingTop: 20,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 30,
  },
  hangupBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#EF4444', shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },

  remoteMutedPill: {
    position: 'absolute', top: 90, left: 20, zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, gap: 6,
  },
  localMutedPill: {
    position: 'absolute', top: 90, right: 20, zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, gap: 6,
    borderColor: '#EF4444', borderWidth: 1,
  },
  mutedText:    { color: '#fff', fontSize: 12, fontWeight: '500' },
  mutedTextRed: { color: '#EF4444', fontSize: 12, fontWeight: '500' },
  reconnectOverlay: {
    position: 'absolute', top: '35%', left: 0, right: 0, zIndex: 25,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)', paddingVertical: 20, marginHorizontal: 40, borderRadius: 16,
  },
  reconnectText: { color: '#FBBF24', fontSize: 16, fontWeight: '600', marginTop: 10 },
});

const s = StyleSheet.create({
  ctrlBtn:       { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  ctrlBtnActive: { backgroundColor: 'rgba(239,68,68,0.4)' },
  ctrlLabel:     { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '600', marginTop: 2 },
});
