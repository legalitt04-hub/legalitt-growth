// screens/auth/LegalittIntroScreen.jsx - Premium Cinematic Progressive Logo Reveal Splash
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
  Image,
  Easing,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LOGO_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 300);
const LOGO_HEIGHT = LOGO_WIDTH * 0.42;
const PARTICLE_COUNT = 20;


export default function LegalittIntroScreen({ navigation, onAnimationComplete }) {
  // Timeline Drivers
  // Progressive Logo Reveal Driver (0.5s - 2.5s)
  const revealAnim = useRef(new Animated.Value(0)).current;

  // Ambient Glow & Screen Fade
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const dollyScale = useRef(new Animated.Value(0.96)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const [assetsReady, setAssetsReady] = useState(false);

  // Floating Golden Dust Particles
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }).map(() => ({
      x: Math.random() * SCREEN_WIDTH,
      y: SCREEN_HEIGHT * 0.3 + Math.random() * (SCREEN_HEIGHT * 0.4),
      animY: new Animated.Value(0),
      animX: new Animated.Value(0),
      opacity: new Animated.Value(0),
      speedY: -0.3 - Math.random() * 0.5,
      speedX: (Math.random() - 0.5) * 0.3,
      size: 1.5 + Math.random() * 2.5,
    }))
  ).current;

  useEffect(() => {
    let isMounted = true;
    StatusBar.setBarStyle('light-content');
    StatusBar.setBackgroundColor('#07080A');

    const preloadAssets = async () => {
      try {
        const logoAsset = require('../../../assets/logo-transparent.png');
        await Asset.loadAsync(logoAsset);
        const resolved = Image.resolveAssetSource(logoAsset);
        if (resolved?.uri) {
          await Image.prefetch(resolved.uri);
        }
      } catch (err) {
        // Asset preloaded
      }

      if (!isMounted) return;
      setAssetsReady(true);

      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // Native splash hidden
      }
    };

    preloadAssets();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!assetsReady) return;

    // Start Floating Particles
    particles.forEach((p) => {
      Animated.timing(p.opacity, {
        toValue: 0.3 + Math.random() * 0.5,
        duration: 1000,
        useNativeDriver: true,
      }).start();

      Animated.timing(p.animY, {
        toValue: p.speedY * 150,
        duration: 5500,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();

      Animated.timing(p.animX, {
        toValue: p.speedX * 80,
        duration: 5500,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    });

    // Camera Dolly Scale
    Animated.timing(dollyScale, {
      toValue: 1.02,
      duration: 5500,
      easing: Easing.out(Easing.sin),
      useNativeDriver: true,
    }).start();

    // --- ANIMATION SEQUENCE (PURE PROGRESSIVE LOGO REVEAL) ---
    // 1. Matte black intro & ambient glow rise (0.0s - 0.5s)
    // 2. Progressive Left -> Right Logo Mask Reveal (0.5s - 2.5s)
    // 3. Logo completely visible at 2.5s
    // 4. Hold completed logo for 1.0s (2.5s - 3.5s)
    // 5. Fade screen & trigger completion callback AFTER 100% sequence finishes
    Animated.sequence([
      // 0.0s - 0.5s: Matte Black Intro & Ambient Glow Rise
      Animated.timing(glowOpacity, {
        toValue: 0.7,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),

      // 0.5s - 2.5s: Progressive Left -> Right Logo Mask Reveal
      Animated.timing(revealAnim, {
        toValue: 1,
        duration: 2000, // 2.0s
        easing: Easing.linear,
        useNativeDriver: false,
      }),

      // 2.5s: Logo 100% visible. Hold completed logo for 1.0 second
      Animated.delay(1000),

      // Fade screen smoothly before navigation
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      // ONLY trigger navigation upon explicit animation completion event
      if (finished) {
        if (onAnimationComplete) {
          onAnimationComplete();
        } else if (navigation?.replace) {
          navigation.replace('RoleSelect');
        }
      }
    });
  }, [assetsReady, navigation, onAnimationComplete]);

  // Synchronized Mask Width: Logo reveals progressively left to right (0 to LOGO_WIDTH + 10)
  const maskWidth = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, LOGO_WIDTH + 10],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="#07080A" translucent />

      {/* Warm Golden Ambient Glow */}
      <Animated.View style={[styles.ambientGlow, { opacity: glowOpacity }]} />

      {/* Floating Golden Dust Particles */}
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              opacity: p.opacity,
              transform: [
                { translateY: p.animY },
                { translateX: p.animX },
              ],
            },
          ]}
        />
      ))}

      {/* Animated Dolly-In Wrapper */}
      <Animated.View
        style={[
          styles.logoDollyWrapper,
          {
            transform: [{ scale: dollyScale }],
          },
        ]}
      >
        <View style={[styles.logoViewport, { width: LOGO_WIDTH, height: LOGO_HEIGHT }]}>
          {/* LOGO REVEAL LAYER (Progressive Clip Mask - Left to Right) */}
          <Animated.View style={[styles.maskContainer, { width: maskWidth }]}>
            <Image
              source={require('../../../assets/logo-transparent.png')}
              style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080A', // Matte Black
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: (SCREEN_WIDTH * 0.85) / 2,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 80,
    shadowOpacity: 0.5,
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#FFE4A0',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
    shadowOpacity: 0.8,
  },
  logoDollyWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoViewport: {
    position: 'relative',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  maskContainer: {
    height: '100%',
    overflow: 'hidden',
  },
});
