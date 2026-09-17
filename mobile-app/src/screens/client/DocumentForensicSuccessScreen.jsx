// screens/client/DocumentForensicSuccessScreen.jsx
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

// ─── COLOR PALETTE ─────────────────────────────────────────────────────────────
const PALETTE = {
  pageBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  cardBorder: '#E8DFD5',
  creamCardBg: '#F5EFEB',
  creamCardBorder: '#E8DFD5',
  iconCircleBg: '#F7F3EC',
  successGreen: '#22C55E',
  primaryButton: '#8C6E52',
  primaryButtonText: '#FFFFFF',
  secondaryButtonText: '#8C6E52',
  secondaryButtonBorder: '#8C6E52',
  textHeading: '#2A241E',
  textBody: '#453B32',
  textMuted: '#766D64',
  textSubtitle: '#8C8278',
  dividerColor: '#F0EAE1',
  checkColor: '#8C6E52',
};

export default function DocumentForensicSuccessScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const {
    requestId: passedRequestId,
    bookingId,
    document,
    documentType,
    totalAmount,
  } = route?.params || {};

  // Formatted Request ID
  const requestId = passedRequestId || (bookingId ? `#DF-${bookingId.slice(-6).toUpperCase()}` : 'Not available');

  const handleTrackAnalysis = () => {
    navigation.navigate('DocumentForensicTrack', {
      requestId,
      bookingId,
      document,
      documentType,
      totalAmount,
    });
  };

  const handleBackToHome = () => {
    navigation.navigate('ClientMain');
  };

  return (
    <View style={[styles.container, { backgroundColor: PALETTE.pageBg }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ─── HEADER (Back Arrow Only, No Large Nav Title) ────────────────── */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBackToHome}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={PALETTE.textHeading} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 30 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── SUCCESS ICON ─────────────────────────────────────────────── */}
        <View style={styles.successIconBox}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={34} color="#FFFFFF" />
          </View>
        </View>

        {/* ─── SUCCESS MESSAGE ──────────────────────────────────────────── */}
        <Text style={styles.successHeading}>
          Request Submitted{'\n'}Successfully!
        </Text>
        <Text style={styles.successSubtitle}>
          Your document has been submitted for{'\n'}forensic analysis
        </Text>

        {/* ─── REQUEST DETAILS CARD ─────────────────────────────────────── */}
        <View style={styles.detailsCard}>
          {/* Row 1: Request ID */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconCircle}>
              <Ionicons name="document-text-outline" size={18} color={PALETTE.primaryButton} />
            </View>
            <View style={styles.detailTextCol}>
              <Text style={styles.detailLabel}>Request ID</Text>
              <Text style={styles.detailValue}>{requestId}</Text>
            </View>
          </View>

          <View style={styles.rowDivider} />

          {/* Row 2: Estimated Delivery */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconCircle}>
              <Ionicons name="time-outline" size={18} color={PALETTE.primaryButton} />
            </View>
            <View style={styles.detailTextCol}>
              <Text style={styles.detailLabel}>Estimated Delivery</Text>
              <Text style={styles.detailValue}>24-48 Hours</Text>
            </View>
          </View>
        </View>

        {/* ─── WHAT HAPPENS NEXT CARD ───────────────────────────────────── */}
        <View style={styles.whatNextCard}>
          <Text style={styles.whatNextHeading}>What Happens Next</Text>

          <View style={styles.checklistGroup}>
            <View style={styles.checkItemRow}>
              <Text style={styles.checkSymbol}>✓</Text>
              <Text style={styles.checkItemText}>
                Our experts will start the forensic analysis
              </Text>
            </View>

            <View style={styles.checkItemRow}>
              <Text style={styles.checkSymbol}>✓</Text>
              <Text style={styles.checkItemText}>
                We will thoroughly examine your document
              </Text>
            </View>

            <View style={styles.checkItemRow}>
              <Text style={styles.checkSymbol}>✓</Text>
              <Text style={styles.checkItemText}>
                You will receive then report via email & app
              </Text>
            </View>
          </View>
        </View>

        {/* ─── BUTTONS ──────────────────────────────────────────────────── */}
        <View style={styles.buttonGroup}>
          {/* Primary Button */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleTrackAnalysis}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Track Analysis</Text>
          </TouchableOpacity>

          {/* Secondary Button */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleBackToHome}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    alignItems: 'center',
  },

  // ── Success Icon
  successIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  successCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: PALETTE.successGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PALETTE.successGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  // ── Success Message
  successHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: PALETTE.textHeading,
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  successSubtitle: {
    fontSize: 13,
    color: PALETTE.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },

  // ── Request Details Card
  detailsCard: {
    width: '100%',
    backgroundColor: PALETTE.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  detailIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PALETTE.iconCircleBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11.5,
    color: PALETTE.textMuted,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.textHeading,
    marginTop: 2,
  },
  copyBtn: {
    padding: 6,
  },
  rowDivider: {
    height: 1,
    backgroundColor: PALETTE.dividerColor,
    marginVertical: 10,
  },

  // ── What Happens Next Card
  whatNextCard: {
    width: '100%',
    backgroundColor: PALETTE.creamCardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.creamCardBorder,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 14,
    shadowColor: '#8C6E52',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  whatNextHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    color: PALETTE.textHeading,
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  checklistGroup: {
    gap: 8,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkSymbol: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.checkColor,
    lineHeight: 18,
  },
  checkItemText: {
    flex: 1,
    fontSize: 12.5,
    color: PALETTE.textBody,
    lineHeight: 18,
    fontWeight: '500',
  },

  // ── Buttons
  buttonGroup: {
    width: '100%',
    marginTop: 24,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: PALETTE.primaryButton,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: PALETTE.primaryButton,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  primaryBtnText: {
    color: PALETTE.primaryButtonText,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.secondaryButtonBorder,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  secondaryBtnText: {
    color: PALETTE.secondaryButtonText,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
