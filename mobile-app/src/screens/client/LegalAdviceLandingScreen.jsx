import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeScreen from '../../components/SafeScreen';
import { LEGAL_THEME } from '../../constants/legalAdviceTheme';
import { LogoHeader } from '../../components/legalAdvice/LogoHeader';
import { ConsultationCard } from '../../components/legalAdvice/ConsultationCard';
import { FeatureCard } from '../../components/legalAdvice/FeatureCard';
import { usePricing } from '../../context/PricingContext';

export default function LegalAdviceLandingScreen({ navigation }) {
  const { getPrice } = usePricing();
  const consultationTypes = [
    {
      id: 'chat',
      title: 'Chat Consultation',
      description: 'Quick text-based legal advice & instant document check with an expert advocate.',
      duration: '30 Mins',
      price: String(getPrice('chat_consultation', 499)),
      iconName: 'chatbubbles-outline',
      accentColor: LEGAL_THEME.colors.pastelChat,
    },
    {
      id: 'audio',
      title: 'Audio Consultation',
      description: 'Direct phone call with a senior advocate to clarify all legal queries.',
      duration: '20 Mins',
      price: String(getPrice('voice_consultation', 499)),
      iconName: 'call-outline',
      accentColor: LEGAL_THEME.colors.pastelAudio,
    },
    {
      id: 'video',
      title: 'Video Consultation',
      description: 'Face-to-face video call for comprehensive strategy & document review.',
      duration: '30 Mins',
      price: String(getPrice('video_consultation', 1199)),
      iconName: 'videocam-outline',
      accentColor: LEGAL_THEME.colors.pastelVideo,
    },
  ];

  const features = [
    {
      iconName: 'ribbon-outline',
      title: 'Experienced Experts',
      description: 'Handpicked lawyers with 10+ years of domain practice.',
    },
    {
      iconName: 'person-outline',
      title: 'Personalized Care',
      description: 'Tailored strategy & action plan for your legal concern.',
    },
    {
      iconName: 'flash-outline',
      title: 'Fast Consultation',
      description: 'Quick callback and instant slot confirmation.',
    },
    {
      iconName: 'wallet-outline',
      title: 'Affordable Pricing',
      description: '100% transparent upfront fees with no hidden costs.',
    },
  ];

  const handleSelectConsultation = (type) => {
    navigation.navigate('LegalMatter', { selectedType: type });
  };

  return (
    <SafeScreen backgroundColor={LEGAL_THEME.colors.white} barStyle="dark-content">
      <LogoHeader onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO SECTION */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            Get Expert{' '}
            <Text style={styles.heroTitleHighlight}>Legal Advice</Text>
          </Text>

          <Text style={styles.heroSubtitle}>
            Connect with experienced legal professionals and receive personalized guidance for your legal concerns.
          </Text>

          {/* Trust badge */}
          <View style={styles.badgeContainer}>
            <View style={styles.avatarRow}>
              <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="shield-checkmark" size={22} color={LEGAL_THEME.colors.primaryGold} />
              </View>
            </View>
            <View style={styles.badgeTextCol}>
              <Text style={styles.badgeCountText}>Verified advocates</Text>
              <Text style={styles.badgeSubText}>Secure consultation workflow</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* CONSULTATION TYPES SECTION */}
        <View style={styles.consultationSection}>
          <Text style={styles.sectionHeading}>Do you want to choose Video Call or Voice Call?</Text>
          <Text style={styles.sectionSubheading}>Select a consultation type that suits you best.</Text>

          <View style={styles.cardsList}>
            {consultationTypes.map((item) => (
              <ConsultationCard
                key={item.id}
                title={item.title}
                description={item.description}
                duration={item.duration}
                price={item.price}
                iconName={item.iconName}
                accentColor={item.accentColor}
                onPress={() => handleSelectConsultation(item)}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* WHY CHOOSE US */}
        <View style={styles.whySection}>
          <Text style={styles.sectionHeading}>Why Choose Us</Text>
          <Text style={styles.sectionSubheading}>Premium legal assistance at your fingertips</Text>

          <View style={styles.featuresGrid}>
            {features.map((feat, index) => (
              <FeatureCard
                key={index}
                iconName={feat.iconName}
                title={feat.title}
                description={feat.description}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LEGAL_THEME.colors.white,
  },
  scrollContent: {
    paddingHorizontal: LEGAL_THEME.spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heroSection: {
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: LEGAL_THEME.colors.primaryText,
    lineHeight: 36,
    marginBottom: 8,
  },
  heroTitleHighlight: {
    color: LEGAL_THEME.colors.darkGold,
  },
  heroSubtitle: {
    fontSize: 14,
    color: LEGAL_THEME.colors.secondaryText,
    lineHeight: 20,
    marginBottom: 16,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LEGAL_THEME.colors.cream,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LEGAL_THEME.colors.border,
    alignSelf: 'flex-start',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: LEGAL_THEME.colors.white,
  },
  badgeTextCol: {
    justifyContent: 'center',
  },
  badgeCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: LEGAL_THEME.colors.primaryText,
  },
  badgeSubText: {
    fontSize: 10,
    color: LEGAL_THEME.colors.secondaryText,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: LEGAL_THEME.colors.border,
    marginVertical: 16,
  },
  consultationSection: {
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: LEGAL_THEME.colors.primaryText,
    marginBottom: 4,
  },
  sectionSubheading: {
    fontSize: 13,
    color: LEGAL_THEME.colors.secondaryText,
    marginBottom: 16,
  },
  cardsList: {
    marginTop: 4,
  },
  whySection: {
    marginTop: 6,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});
