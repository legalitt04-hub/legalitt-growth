// screens/advocate/AdvocateCallScreen.jsx
// Real ZEGOCLOUD video/voice call screen for Advocates
// Uses the same ZegoUIKitPrebuiltCall as the client VideoCallScreen
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import ZegoUIKitPrebuiltCallComponent, {
  ONE_ON_ONE_VIDEO_CALL_CONFIG,
  ONE_ON_ONE_VOICE_CALL_CONFIG,
} from '@zegocloud/zego-uikit-prebuilt-call-rn';
import { getSocket } from '../../services/socket';

const ZegoCall = ZegoUIKitPrebuiltCallComponent;
const { ZEGO_APP_ID, ZEGO_APP_SIGN } = Constants.expoConfig?.extra || {};

export default function AdvocateCallScreen({ navigation, route }) {
  const {
    // From CasesScreen / AdvocateDashboard when opening a call
    zegoRoomId,
    zegoToken,        // advocateVideoToken from booking
    zegoAppId,
    advocateName,
    clientName = 'Client',
    clientAvatar,
    myUserId = '',
    myUserName = 'Advocate',
    mode = 'video',
    bookingId,
    clientId,
  } = route?.params || {};

  // Determine effective appId: prefer param > env constant
  const effectiveAppId = Number(zegoAppId || ZEGO_APP_ID || 0);
  const effectiveAppSign = ZEGO_APP_SIGN || '';

  // If there's no room/token — tell advocate to wait for client to confirm booking
  useEffect(() => {
    if (!zegoRoomId || !zegoToken || !effectiveAppId) {
      Alert.alert(
        'Call Not Ready',
        'The call room is not set up yet. This happens when the client has not completed payment yet. Please wait for the client to confirm the booking.',
        [{ text: 'Go Back', onPress: () => navigation.goBack() }]
      );
    }
  }, []);

  // Listen for call_ended from socket (client hung up)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => navigation.goBack();
    socket.on('call_ended', handler);
    return () => socket.off('call_ended', handler);
  }, []);

  if (!zegoRoomId || !zegoToken || !effectiveAppId) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#14B8A6" />
        <Text style={styles.waitText}>Setting up call room...</Text>
        <Text style={styles.subText}>
          This call room opens once the client confirms payment.
        </Text>
      </View>
    );
  }

  const callConfig =
    mode === 'video'
      ? {
          ...ONE_ON_ONE_VIDEO_CALL_CONFIG,
          bottomMenuBarConfig: {
            buttons: [
              'toggleCameraButton',
              'switchCameraButton',
              'hangUpButton',
              'toggleMicrophoneButton',
            ],
          },
        }
      : {
          ...ONE_ON_ONE_VOICE_CALL_CONFIG,
          bottomMenuBarConfig: {
            buttons: ['toggleMicrophoneButton', 'hangUpButton'],
          },
        };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <ZegoCall
        appID={effectiveAppId}
        appSign={effectiveAppSign}
        userID={String(myUserId)}
        userName={String(myUserName)}
        callID={String(zegoRoomId)}
        token={zegoToken}
        config={{
          ...callConfig,
          onHangUp: () => {
            // Emit call_ended so client side also closes
            const socket = getSocket();
            if (socket && bookingId) {
              socket.emit('call_ended', { bookingId, clientId });
            }
            navigation.goBack();
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  subText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
