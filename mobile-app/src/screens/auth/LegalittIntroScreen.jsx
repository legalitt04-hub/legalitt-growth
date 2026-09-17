import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { Asset } from 'expo-asset';
import { ResizeMode, Video } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';

const INTRO_VIDEO = require('../../../assets/legalitt-intro.mp4');

export default function LegalittIntroScreen({ navigation, onAnimationComplete }) {
  const [assetReady, setAssetReady] = useState(false);
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const completedRef = useRef(false);

  const finishIntro = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start(() => {
      if (onAnimationComplete) {
        onAnimationComplete();
      } else if (navigation?.replace) {
        navigation.replace('RoleSelect');
      }
    });
  }, [navigation, onAnimationComplete, screenOpacity]);

  useEffect(() => {
    let mounted = true;

    const prepareVideo = async () => {
      try {
        await Asset.loadAsync(INTRO_VIDEO);
      } finally {
        if (!mounted) return;
        setAssetReady(true);
        try {
          await SplashScreen.hideAsync();
        } catch {
          // Native splash may already be hidden during fast refresh.
        }
      }
    };

    StatusBar.setBarStyle('light-content');
    StatusBar.setBackgroundColor('#000000');
    prepareVideo();

    // Never leave the user stuck if a device cannot decode the bundled video.
    const fallbackTimer = setTimeout(finishIntro, 10000);
    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
    };
  }, [finishIntro]);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />
      {assetReady && (
        <View style={styles.videoViewport}>
          <Video
            source={INTRO_VIDEO}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping={false}
            isMuted={Platform.OS === 'web'}
            useNativeControls={false}
            progressUpdateIntervalMillis={200}
            onPlaybackStatusUpdate={(status) => {
              if (status?.didJustFinish) finishIntro();
            }}
            onError={finishIntro}
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  videoViewport: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  video: {
    position: 'absolute',
    // The source is 1080x1920. A small edge crop keeps the generated-video
    // footer outside the visible launch area without adding an opaque banner.
    width: '114%',
    height: '114%',
    left: '-7%',
    top: '-7%',
  },
});
