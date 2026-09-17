// screens/client/PropertyResearchLandingScreen.jsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';

const PRIMARY_BEIGE = '#C2A98B';

export default function PropertyResearchLandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const handleCallSupport = () => {
    navigation.navigate('Support');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Navigation */}
      <View style={[styles.navHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Section Header */}
        <View style={styles.mainHeaderSection}>
          <Text style={styles.mainHeading}>Property Research Report</Text>
          <Text style={styles.subtitle}>
            Get a professionally verified property research report before buying, selling or investing in any property.
          </Text>
        </View>

        {/* Premium Illustration Box */}
        <View style={styles.illustrationContainer}>
          <View style={styles.illustrationBackground}>
            <View style={styles.iconBoxMain}>
              <Ionicons name="home" size={44} color={PRIMARY_BEIGE} />
            </View>

            <View style={styles.iconBoxSubTopRight}>
              <Ionicons name="document-text" size={26} color="#475569" />
            </View>

            <View style={styles.iconBoxSubBottomLeft}>
              <Ionicons name="search" size={24} color="#0D9488" />
            </View>

            <View style={styles.iconBoxSubBottomRight}>
              <Ionicons name="shield-checkmark" size={28} color={PRIMARY_BEIGE} />
            </View>
          </View>
        </View>

        {/* Premium Benefits Card */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardHeaderTitle}>Why Get A Research Report?</Text>

          <View style={styles.benefitRow}>
            <View style={styles.benefitIconWrapper}>
              <Ionicons name="checkmark-done-circle" size={24} color={PRIMARY_BEIGE} />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTitle}>Verified Information</Text>
              <Text style={styles.benefitSubtitle}>
                Accurate ownership and legal verification.
              </Text>
            </View>
          </View>

          <View style={styles.benefitDivider} />

          <View style={styles.benefitRow}>
            <View style={styles.benefitIconWrapper}>
              <Ionicons name="shield-half" size={24} color={PRIMARY_BEIGE} />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTitle}>Legal Protection</Text>
              <Text style={styles.benefitSubtitle}>
                Make confident property decisions.
              </Text>
            </View>
          </View>

          <View style={styles.benefitDivider} />

          <View style={styles.benefitRow}>
            <View style={styles.benefitIconWrapper}>
              <Ionicons name="sparkles" size={24} color={PRIMARY_BEIGE} />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTitle}>Peace of Mind</Text>
              <Text style={styles.benefitSubtitle}>
                Professionally verified reports.
              </Text>
            </View>
          </View>
        </View>

        {/* Large Rounded Primary Button: Get Started */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('PropertyResearchForm')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        {/* Need Expert Assistance Card */}
        <View style={styles.assistanceCard}>
          <View style={styles.assistanceHeaderRow}>
            <View style={styles.assistanceIconBg}>
              <Ionicons name="headset" size={22} color={PRIMARY_BEIGE} />
            </View>
            <Text style={styles.assistanceTitle}>Need Expert Assistance?</Text>
          </View>
          <Text style={styles.assistanceDescription}>
            Our legal verification specialists will personally help you collect property information and guide you throughout the verification process.
          </Text>
          <TouchableOpacity
            style={styles.supportButton}
            onPress={handleCallSupport}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={18} color={PRIMARY_BEIGE} />
            <Text style={styles.supportButtonText}>Call Legalitt Support</Text>
          </TouchableOpacity>
        </View>

        {/* Legalitt Protection Promise Card */}
        <View style={styles.promiseCard}>
          <Ionicons name="ribbon" size={28} color={PRIMARY_BEIGE} style={{ marginBottom: 6 }} />
          <Text style={styles.promiseTitle}>Legalitt Protection Promise</Text>
          <Text style={styles.promiseDescription}>
            Certified legal verification by experienced professionals.
          </Text>
        </View>

        {/* Footer Information Strip */}
        <View style={styles.footerStrip}>
          <View style={styles.footerRow}>
            <Ionicons name="lock-closed" size={16} color="#64748B" />
            <Text style={styles.footerText}>Your property information remains confidential.</Text>
          </View>
          <View style={styles.footerRow}>
            <Ionicons name="time" size={16} color="#64748B" />
            <Text style={styles.footerText}>
              Estimated Response Time: <Text style={styles.footerBold}>Within 12–24 Hours</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    color: PRIMARY_BEIGE,
  },
  logoBadge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY_BEIGE,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  mainHeaderSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  mainHeading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  illustrationBackground: {
    width: 220,
    height: 180,
    borderRadius: 24,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EFEAE2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...SHADOWS.small,
  },
  iconBoxMain: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: PRIMARY_BEIGE,
    ...SHADOWS.medium,
  },
  iconBoxSubTopRight: {
    position: 'absolute',
    top: 20,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  iconBoxSubBottomLeft: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  iconBoxSubBottomRight: {
    position: 'absolute',
    bottom: 18,
    right: 28,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    ...SHADOWS.medium,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  benefitIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  benefitSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  benefitDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  primaryButton: {
    backgroundColor: PRIMARY_BEIGE,
    height: 56,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...SHADOWS.medium,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  assistanceCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  assistanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  assistanceIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistanceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  assistanceDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  supportButton: {
    backgroundColor: '#FFFFFF',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: PRIMARY_BEIGE,
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_BEIGE,
  },
  promiseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    ...SHADOWS.small,
  },
  promiseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  promiseDescription: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  footerStrip: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
  },
  footerBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
});
