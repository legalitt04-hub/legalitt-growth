import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar, Alert, Text, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';
import ZegoUIKitPrebuiltCallComponent, {
  ONE_ON_ONE_VIDEO_CALL_CONFIG,
  ONE_ON_ONE_VOICE_CALL_CONFIG,
} from '@zegocloud/zego-uikit-prebuilt-call-rn';
import { getSocket } from '../services/socket';

const ZegoUIKitPrebuiltCall: any = ZegoUIKitPrebuiltCallComponent;
const { ZEGO_APP_ID, ZEGO_APP_SIGN } = Constants.expoConfig?.extra || {};

export default function VideoCallScreen({ navigation, route }: any) {
  const {
    zegoRoomId,
    zegoToken,
    advocateName = 'Advocate',
    myUserId = '',
    myUserName = 'User',
    mode = 'video',
    bookingId,
    advocateUserId,
  } = route?.params || {};

  useEffect(() => {
    if (!zegoRoomId || !zegoToken || !ZEGO_APP_ID) {
      Alert.alert(
        'Call Not Ready',
        'The call room is not ready yet. Please wait a moment after advocate is assigned, then try again.',
        [{ text: 'Go Back', onPress: () => navigation.goBack() }]
      );
    }
  }, []);

  // Listen for advocate hanging up — close screen on client side too
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => navigation.goBack();
    socket.on('call_ended', handler);
    return () => socket.off('call_ended', handler);
  }, []);

  if (!zegoRoomId || !zegoToken || !ZEGO_APP_ID) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#14B8A6" />
        <Text style={styles.waitText}>Setting up call room...</Text>
      </View>
    );
  }

  const handleHangUp = () => {
    // Notify advocate that client hung up
    const socket = getSocket();
    if (socket && bookingId) {
      socket.emit('call_ended', {
        bookingId,
        advocateUserId: advocateUserId || null,
      });
    }
    navigation.goBack();
  };

  const callConfig = mode === 'video'
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
      <ZegoUIKitPrebuiltCall
        appID={Number(ZEGO_APP_ID)}
        appSign={ZEGO_APP_SIGN || ''}
        userID={String(myUserId)}
        userName={String(myUserName)}
        callID={String(zegoRoomId)}
        token={zegoToken}
        config={{
          ...callConfig,
          onHangUp: handleHangUp,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  waitText: { color: '#94A3B8', fontSize: 14, marginTop: 12 },
});
