import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Animated,
  Dimensions, TouchableOpacity, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Path, G, Defs, ClipPath, Rect, Circle, Ellipse,
  LinearGradient, Stop, Polygon, Line,
} from 'react-native-svg';
import { COLORS } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

const TEAL   = '#00897B';
const NAVY   = '#012464';
const TEAL2  = '#00989F';
const WHITE  = '#FFFFFF';

const SLIDES = [
  {
    id: '1',
    title: 'Find Verified Advocates\nNearby',
    subtitle: 'Connect with trusted, verified advocates around you. Chat, call, or book consultations easily.',
  },
  {
    id: '2',
    title: 'AI Legal Assistant &\nDocument Storage',
    subtitle: 'Ask legal questions anytime. Upload, save, and manage your documents securely with AI support.',
  },
  {
    id: '3',
    title: 'Easy Case & Document\nHandling',
    subtitle: 'Secure document handling with seamless case, chat, and update management.',
  },
];

// ── Illustration 1: Advocate cards with verified badges ──────────────────────
const Illustration1 = () => (
  <View style={ill.wrap}>
    {/* Background circle */}
    <View style={ill.bgCircle} />

    {/* Card row top */}
    {[
      { left: width * 0.04, top: 20,  emoji: '👨‍⚖️', name: 'Adv. Sharma',   spec: 'Civil Law'    },
      { left: width * 0.52, top: 8,   emoji: '👩‍⚖️', name: 'Adv. Priya',    spec: 'Family Law'   },
    ].map((card, i) => (
      <View key={i} style={[ill.card, { left: card.left, top: card.top }]}>
        <View style={ill.avatar}>
          <Text style={{ fontSize: 26 }}>{card.emoji}</Text>
          <View style={ill.badge}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>✓</Text>
          </View>
        </View>
        <View style={{ marginLeft: 8, flex: 1 }}>
          <Text style={ill.cardName}>{card.name}</Text>
          <Text style={ill.cardSpec}>{card.spec}</Text>
          <View style={ill.stars}>
            {[1,2,3,4,5].map(s => <Text key={s} style={{ fontSize: 9, color: '#f59e0b' }}>★</Text>)}
          </View>
        </View>
      </View>
    ))}

    {/* Card row middle */}
    {[
      { left: width * 0.08, top: 120, emoji: '👨🏽‍⚖️', name: 'Adv. Rahul',   spec: 'Criminal Law' },
      { left: width * 0.48, top: 110, emoji: '👩🏻‍⚖️', name: 'Adv. Meena',   spec: 'Corporate'    },
    ].map((card, i) => (
      <View key={i} style={[ill.card, { left: card.left, top: card.top }]}>
        <View style={ill.avatar}>
          <Text style={{ fontSize: 26 }}>{card.emoji}</Text>
          <View style={ill.badge}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>✓</Text>
          </View>
        </View>
        <View style={{ marginLeft: 8, flex: 1 }}>
          <Text style={ill.cardName}>{card.name}</Text>
          <Text style={ill.cardSpec}>{card.spec}</Text>
          <View style={ill.stars}>
            {[1,2,3,4,5].map(s => <Text key={s} style={{ fontSize: 9, color: '#f59e0b' }}>★</Text>)}
          </View>
        </View>
      </View>
    ))}

    {/* Card bottom center */}
    <View style={[ill.card, { left: width * 0.22, top: 218, width: width * 0.56 }]}>
      <View style={ill.avatar}>
        <Text style={{ fontSize: 26 }}>👨🏾‍⚖️</Text>
        <View style={ill.badge}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>✓</Text>
        </View>
      </View>
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={ill.cardName}>Adv. Verma</Text>
        <Text style={ill.cardSpec}>Property Law</Text>
        <View style={ill.stars}>
          {[1,2,3,4,5].map(s => <Text key={s} style={{ fontSize: 9, color: '#f59e0b' }}>★</Text>)}
        </View>
      </View>
      <View style={ill.bookBtn}>
        <Text style={ill.bookTxt}>Book</Text>
      </View>
    </View>
  </View>
);

// ── Illustration 2: AI chat bubbles ──────────────────────────────────────────
const Illustration2 = () => (
  <View style={ill.wrap}>
    <View style={[ill.bgCircle, { backgroundColor: 'rgba(176, 156, 133, 0.15)' }]} />

    {/* Phone preview */}
    <View style={ill.phone}>
      {/* Header */}
      <View style={ill.phoneHeader}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14 }}>⚖️</Text>
        </View>
        <Text style={{ marginLeft: 8, fontWeight: '700', color: '#0F172A', fontSize: 12 }}>AI Legal Assistant</Text>
        <View style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
      </View>

      {/* Chat bubbles */}
      <View style={{ paddingHorizontal: 10, paddingTop: 8, gap: 8 }}>
        {/* User bubble */}
        <View style={{ alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderRadius: 14, borderBottomRightRadius: 4, padding: 8, maxWidth: '75%' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>Can my landlord evict me without notice?</Text>
        </View>
        {/* AI bubble */}
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#f0fdf4', borderRadius: 14, borderBottomLeftRadius: 4, padding: 8, maxWidth: '80%', borderWidth: 1, borderColor: '#d1fae5' }}>
          <Text style={{ color: '#0F172A', fontSize: 10, lineHeight: 15 }}>No. Under the Rent Control Act, your landlord must give proper written notice before eviction. 📋</Text>
        </View>
        {/* User bubble 2 */}
        <View style={{ alignSelf: 'flex-end', backgroundColor: COLORS.primaryDark, borderRadius: 14, borderBottomRightRadius: 4, padding: 8, maxWidth: '65%' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>What's the notice period?</Text>
        </View>
        {/* AI typing */}
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#f3f4f6', borderRadius: 14, borderBottomLeftRadius: 4, padding: 10, flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#9ca3af' }} />
          ))}
        </View>
      </View>

      {/* Input bar */}
      <View style={ill.inputBar}>
        <Text style={{ color: '#9ca3af', fontSize: 10, flex: 1 }}>Ask a legal question…</Text>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 12 }}>↑</Text>
        </View>
      </View>
    </View>

    {/* Floating doc badge */}
    <View style={ill.docBadge}>
      <Text style={{ fontSize: 18 }}>📄</Text>
      <Text style={{ fontSize: 10, color: '#0F172A', fontWeight: '700', marginLeft: 6 }}>12 Docs saved</Text>
    </View>
  </View>
);

// ── Illustration 3: Document / Aadhaar cards ─────────────────────────────────
const Illustration3 = () => (
  <View style={ill.wrap}>
    <View style={[ill.bgCircle, { backgroundColor: 'rgba(176, 156, 133, 0.12)' }]} />

    {/* Stacked document cards */}
    {[
      { top: 30,  rotate: '-4deg', color: '#fef3c7', icon: '📋', label: 'Case File — HC Mumbai',    sub: 'Updated 2 days ago'    },
      { top: 62,  rotate: '2deg',  color: '#f0fdf4', icon: '⚖️',  label: 'Property Dispute — 2024', sub: 'Hearing on Apr 22'      },
      { top: 94,  rotate: '-1deg', color: '#fdf2f8', icon: '📝',  label: 'Agreement Draft',          sub: 'Shared with advocate'  },
    ].map((doc, i) => (
      <View key={i} style={[ill.docCard, { top: doc.top, transform: [{ rotate: doc.rotate }], backgroundColor: doc.color, zIndex: i }]}>
        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18 }}>{doc.icon}</Text>
        </View>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={{ fontSize: 11, color: '#0F172A', fontWeight: '700' }}>{doc.label}</Text>
          <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{doc.sub}</Text>
        </View>
        <Text style={{ fontSize: 16 }}>›</Text>
      </View>
    ))}

    {/* Aadhaar-style ID card */}
    <View style={ill.idCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Flag stripe */}
        <View style={{ width: 6, borderRadius: 3, height: 46, overflow: 'hidden', marginRight: 10 }}>
          <View style={{ flex: 1, backgroundColor: '#FF9933' }} />
          <View style={{ flex: 1, backgroundColor: '#fff' }} />
          <View style={{ flex: 1, backgroundColor: '#138808' }} />
        </View>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>👤</Text>
        </View>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={{ fontSize: 12, color: '#0F172A', fontWeight: '800' }}>Government of India</Text>
          <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2, letterSpacing: 2 }}>XXXX  XXXX  XXXX</Text>
        </View>
        <View style={{ width: 32, height: 32 }}>
          {/* Simple QR placeholder */}
          <View style={{ width: 32, height: 32, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 }}>⬛</Text>
          </View>
        </View>
      </View>
    </View>
  </View>
);

const illustrations = [<Illustration1 />, <Illustration2 />, <Illustration3 />];

// ── Main component ────────────────────────────────────────────────────────────
const OnboardingScreen = ({ navigation, route }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef  = useRef(null);
  const scrollX      = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;

  const handleNext = async () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();

    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else {
      await AsyncStorage.setItem('legalitt_onboarded', 'true');
      navigation.replace('ClientMain');
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('legalitt_onboarded', 'true');
    navigation.replace('ClientMain');
  };

  const renderSlide = ({ item, index }) => (
    <View style={styles.slide}>
      <View style={styles.illustrationArea}>
        {illustrations[index]}
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Back button */}
      <TouchableOpacity 
        style={styles.backBtn} 
        onPress={() => navigation.replace('ClientMain')}
      >
        <Ionicons name="chevron-back" size={24} color="#9ca3af" />
      </TouchableOpacity>

      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipTxt}>Skip</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => {
          const dotWidth = scrollX.interpolate({
            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const dotColor = scrollX.interpolate({
            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
            outputRange: ['#d1d5db', COLORS.primary, '#d1d5db'],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width: dotWidth, backgroundColor: dotColor }]}
            />
          );
        })}
      </View>

      {/* CTA Button */}
      <View style={styles.buttonArea}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity style={styles.btn} onPress={handleNext} activeOpacity={0.9}>
            <Text style={styles.btnText}>
              {isLast ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Advocate Portal Link — only on last slide */}
        {isLast && (
          <TouchableOpacity
            onPress={() => navigation.navigate('AdvocateFlow')}
            style={{ marginTop: 16, alignItems: 'center', paddingVertical: 8 }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, color: '#6B7280' }}>
              Are you an Advocate?{' '}
              <Text style={{ color: '#B89A6A', fontWeight: '700' }}>
                Sign In to Advocate Portal →
              </Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ── Sub-styles for illustrations ─────────────────────────────────────────────
const ill = StyleSheet.create({
  wrap: {
    width,
    height: height * 0.46,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bgCircle: {
    position: 'absolute',
    width: width * 0.78,
    height: width * 0.78,
    borderRadius: (width * 0.78) / 2,
    backgroundColor: 'rgba(176, 156, 133, 0.1)',
    top: '10%',
  },
  // Advocate cards
  card: {
    position: 'absolute',
    width: width * 0.42,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  avatar: {
    width: 42, height: 42,
    borderRadius: 21,
    backgroundColor: '#e0f2f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2, right: -2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    width: 14, height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  cardName: { fontSize: 10, fontWeight: '700', color: '#0F172A' },
  cardSpec: { fontSize: 9,  color: '#6b7280', marginTop: 1 },
  stars:    { flexDirection: 'row', marginTop: 2 },
  bookBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 6,
  },
  bookTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  // AI screen
  phone: {
    width: width * 0.72,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  phoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  docBadge: {
    position: 'absolute',
    bottom: 16,
    right: width * 0.06,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  // Document cards
  docCard: {
    position: 'absolute',
    left: width * 0.06,
    right: width * 0.06,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  idCard: {
    position: 'absolute',
    bottom: 12,
    left: width * 0.06,
    right: width * 0.06,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    zIndex: 10,
  },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#fff' },
  slide:           { width, flex: 1, backgroundColor: '#fff' },
  illustrationArea:{ flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: {
    paddingHorizontal: 32,
    paddingBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
  skipBtn: {
    position: 'absolute',
    top: 52,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipTxt: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonArea: {
    paddingBottom: 44,
    paddingHorizontal: 24,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 32,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default OnboardingScreen;
