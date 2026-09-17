// screens/client/FIRDraftScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { legalAdviceAPI } from '../../services/api';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

// ─── COLOR PALETTE ─────────────────────────────────────────────────────────────
const PALETTE = {
  pageBg: '#FAF7F2',
  cardBg: '#F3EDE4',
  cardBorder: '#E6DDCF',
  pillBg: '#EFE8DD',
  pillBorder: '#DFD4C4',
  iconCircleBg: '#E6DDD0',
  primaryButton: '#8C6E52',
  primaryButtonText: '#FFFFFF',
  textHeading: '#2B241E',
  textBody: '#4A3F35',
  textMuted: '#7D7266',
  inputBg: '#FFFFFF',
  inputBorder: '#D8CDC0',
  inputPlaceholder: '#A29689',
  accentOrange: '#F97316',
  accentOrangeLight: '#FFEDD5',
  diamondColor: '#9C8E7E',
  dividerColor: '#D8CDC0',
};

const CALL_TIME_OPTIONS = [
  'Morning (9:00 AM - 12:00 PM)',
  'Afternoon (12:00 PM - 4:00 PM)',
  'Evening (4:00 PM - 8:00 PM)',
  'Anytime (Immediate Assistance)',
];

export default function FIRDraftScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();

  // Form State
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Pre-fill user data if authenticated
  useEffect(() => {
    if (user) {
      if (user.fullName || user.name) {
        setFullName(user.fullName || user.name);
      }
      if (user.phone || user.mobile) {
        setMobileNumber(user.phone || user.mobile);
      }
    }
  }, [user]);

  // Validation & Submission
  const handleSubmit = async () => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRegister', { role: 'client' });
      return;
    }
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your full name.');
      return;
    }
    const cleanPhone = mobileNumber.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      await legalAdviceAPI.createRequest({
        serviceType: 'fir_draft',
        consultationMode: 'voice',
        issueCategory: 'criminal',
        issueDescription: `FIR draft assistance requested by ${fullName.trim()} (${cleanPhone}). Preferred contact time: ${preferredTime || 'Anytime'}.`,
        preferredSlot: preferredTime || 'Anytime',
      });
      setShowSuccessModal(true);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Could not submit your request. Please try again.';
      console.log('FIR draft request submission failed:', message);
      Alert.alert('Request Not Submitted', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: PALETTE.pageBg }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ─── 1. TOP NAVIGATION ───────────────────────────────────────────── */}
      <View style={[styles.topNav, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={PALETTE.textHeading} />
        </TouchableOpacity>
        <View style={styles.topNavCenter}>
          {/* Keep clear spacing matching reference */}
        </View>
        <View style={styles.topNavRight} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 30 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 2. HERO SECTION ──────────────────────────────────────────── */}
          <View style={styles.heroSection}>
            <View style={styles.heroLeftCol}>
              <Text style={styles.heroHeading}>
                FIR Draft{'\n'}Service
              </Text>
              <Text style={styles.heroSupportingText}>
                Our legal experts will contact you and assist you in preparing a professionally drafted FIR application
              </Text>
            </View>

            {/* Document Illustration */}
            <View style={styles.heroRightCol}>
              <View style={styles.documentIllustrationCard}>
                {/* Top decorative badge */}
                <View style={styles.docHeaderBanner}>
                  <View style={styles.docOrangeBadge}>
                    <Text style={styles.docOrangeBadgeText}>FIR</Text>
                  </View>
                  <View style={styles.docMiniLineTop} />
                </View>

                {/* Document text placeholder lines */}
                <View style={styles.docBodyLines}>
                  <View style={[styles.docLine, { width: '85%' }]} />
                  <View style={[styles.docLine, { width: '100%' }]} />
                  <View style={[styles.docLine, { width: '70%' }]} />
                  <View style={[styles.docLine, { width: '90%' }]} />
                  <View style={[styles.docLine, { width: '60%' }]} />
                </View>

                {/* Official seal badge */}
                <View style={styles.docSealBadge}>
                  <Ionicons name="checkmark-sharp" size={14} color="#FFFFFF" />
                </View>
              </View>
            </View>
          </View>

          {/* ─── 3. TURNAROUND-TIME PILL ──────────────────────────────────── */}
          <View style={styles.turnaroundPill}>
            <Ionicons name="time-outline" size={17} color={PALETTE.primaryButton} />
            <Text style={styles.turnaroundPillText}>
              Estimate Turnaround Time: 12-24 Hours
            </Text>
          </View>

          {/* ─── 4. HOW IT WORKS CARD ────────────────────────────────────── */}
          <View style={styles.cardContainer}>
            {/* Centered Title with decorative lines & diamond */}
            <View style={styles.decorativeTitleRow}>
              <View style={styles.decLine} />
              <View style={styles.decDiamond} />
              <Text style={styles.cardTitleText}>How It Works</Text>
              <View style={styles.decDiamond} />
              <View style={styles.decLine} />
            </View>

            {/* 5 Steps Grid/Flow */}
            <View style={styles.stepsContainer}>
              {/* Step 1 */}
              <View style={styles.stepItem}>
                <View style={styles.stepIconCircle}>
                  <Ionicons name="document-text-outline" size={20} color={PALETTE.primaryButton} />
                </View>
                <Text style={styles.stepLabelText}>Submit{'\n'}Request</Text>
              </View>

              <View style={styles.stepConnector}>
                <Ionicons name="chevron-forward" size={14} color={PALETTE.diamondColor} />
              </View>

              {/* Step 2 */}
              <View style={styles.stepItem}>
                <View style={styles.stepIconCircle}>
                  <Ionicons name="headset-outline" size={20} color={PALETTE.primaryButton} />
                </View>
                <Text style={styles.stepLabelText}>Legaliit Team{'\n'}Contact You</Text>
              </View>

              <View style={styles.stepConnector}>
                <Ionicons name="chevron-forward" size={14} color={PALETTE.diamondColor} />
              </View>

              {/* Step 3 */}
              <View style={styles.stepItem}>
                <View style={styles.stepIconCircle}>
                  <Ionicons name="clipboard-outline" size={20} color={PALETTE.primaryButton} />
                </View>
                <Text style={styles.stepLabelText}>Information{'\n'}Collection</Text>
              </View>

              <View style={styles.stepConnector}>
                <Ionicons name="chevron-forward" size={14} color={PALETTE.diamondColor} />
              </View>

              {/* Step 4 */}
              <View style={styles.stepItem}>
                <View style={styles.stepIconCircle}>
                  <Ionicons name="create-outline" size={20} color={PALETTE.primaryButton} />
                </View>
                <Text style={styles.stepLabelText}>FIR Draft{'\n'}Preparation</Text>
              </View>

              <View style={styles.stepConnector}>
                <Ionicons name="chevron-forward" size={14} color={PALETTE.diamondColor} />
              </View>

              {/* Step 5 */}
              <View style={styles.stepItem}>
                <View style={styles.stepIconCircle}>
                  <Ionicons name="download-outline" size={20} color={PALETTE.primaryButton} />
                </View>
                <Text style={styles.stepLabelText}>PDF Delivered{'\n'}to You</Text>
              </View>
            </View>
          </View>

          {/* ─── 5. REQUEST FIR DRAFT ASSISTANCE FORM CARD ────────────────── */}
          <View style={styles.cardContainer}>
            {/* Form Title & Icon */}
            <View style={styles.formHeaderRow}>
              <View style={styles.formHeaderIconCircle}>
                <Ionicons name="person" size={16} color={PALETTE.primaryButton} />
              </View>
              <Text style={styles.formTitleText}>Request FIR Draft Assistance</Text>
            </View>
            <Text style={styles.formSubText}>
              Submit your request and our legal team will get in touch with you
            </Text>

            {/* Input 1: Full Name */}
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconBox}>
                <Ionicons name="person-outline" size={18} color={PALETTE.textMuted} />
              </View>
              <TextInput
                style={styles.textInputField}
                placeholder="Enter Your full name"
                placeholderTextColor={PALETTE.inputPlaceholder}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            {/* Input 2: Mobile Number */}
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconBox}>
                <Ionicons name="call-outline" size={18} color={PALETTE.textMuted} />
              </View>
              <TextInput
                style={styles.textInputField}
                placeholder="Enter your mobile number"
                placeholderTextColor={PALETTE.inputPlaceholder}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                keyboardType="phone-pad"
                maxLength={12}
              />
            </View>

            {/* Input 3: Preferred Call Time(Option) */}
            <TouchableOpacity
              style={styles.inputWrapper}
              activeOpacity={0.8}
              onPress={() => setIsDropdownOpen(true)}
            >
              <View style={styles.inputIconBox}>
                <Ionicons name="time-outline" size={18} color={PALETTE.textMuted} />
              </View>
              <Text
                style={[
                  styles.dropdownText,
                  !preferredTime && { color: PALETTE.inputPlaceholder },
                ]}
                numberOfLines={1}
              >
                {preferredTime || 'Preferred Call Time(Option)'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={PALETTE.textMuted} />
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Request FIR Draft Assistance</Text>
              )}
            </TouchableOpacity>

            {/* Security Note */}
            <View style={styles.securityRow}>
              <Ionicons name="lock-closed-outline" size={13} color={PALETTE.textMuted} />
              <Text style={styles.securityText}>
                Our legal team will contact you to collect all the necessary details
              </Text>
            </View>
          </View>

          {/* ─── 6. WHY CHOOSE LEGALIIT? CARD ─────────────────────────────── */}
          <View style={[styles.cardContainer, { marginBottom: 20 }]}>
            {/* Centered Title with decorative lines & diamond */}
            <View style={styles.decorativeTitleRow}>
              <View style={styles.decLine} />
              <View style={styles.decDiamond} />
              <Text style={styles.cardTitleText}>Why Choose Legaliit?</Text>
              <View style={styles.decDiamond} />
              <View style={styles.decLine} />
            </View>

            {/* 3 Columns */}
            <View style={styles.whyChooseRow}>
              {/* Feature 1 */}
              <View style={styles.whyChooseCol}>
                <View style={styles.featureIconCircle}>
                  <Ionicons name="ribbon-outline" size={24} color={PALETTE.primaryButton} />
                </View>
                <Text style={styles.featureTitleText}>Expert Legal Support</Text>
              </View>

              {/* Feature 2 */}
              <View style={styles.whyChooseCol}>
                <View style={styles.featureIconCircle}>
                  <Ionicons name="people-outline" size={24} color={PALETTE.primaryButton} />
                </View>
                <Text style={styles.featureTitleText}>Personalized Assistance</Text>
              </View>

              {/* Feature 3 */}
              <View style={styles.whyChooseCol}>
                <View style={styles.featureIconCircle}>
                  <Ionicons name="shield-checkmark-outline" size={24} color={PALETTE.primaryButton} />
                </View>
                <Text style={styles.featureTitleText}>100% Secure</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── DROPDOWN TIME PICKER MODAL ──────────────────────────────────── */}
      <Modal
        visible={isDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDropdownOpen(false)}
        >
          <View style={styles.dropdownModalContent}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>Select Preferred Call Time</Text>
              <TouchableOpacity onPress={() => setIsDropdownOpen(false)}>
                <Ionicons name="close" size={20} color={PALETTE.textHeading} />
              </TouchableOpacity>
            </View>
            {CALL_TIME_OPTIONS.map((time, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.dropdownOptionItem,
                  preferredTime === time && styles.dropdownOptionItemSelected,
                ]}
                onPress={() => {
                  setPreferredTime(time);
                  setIsDropdownOpen(false);
                }}
              >
                <Ionicons
                  name={preferredTime === time ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={preferredTime === time ? PALETTE.primaryButton : PALETTE.textMuted}
                />
                <Text
                  style={[
                    styles.dropdownOptionText,
                    preferredTime === time && styles.dropdownOptionTextSelected,
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── SUCCESS CONFIRMATION MODAL ─────────────────────────────────── */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={54} color={PALETTE.primaryButton} />
            </View>
            <Text style={styles.successModalHeading}>Request Received!</Text>
            <Text style={styles.successModalBody}>
              Thank you, <Text style={{ fontWeight: '700' }}>{fullName}</Text>. Our legal drafting team has received your request and will contact you on <Text style={{ fontWeight: '700' }}>{mobileNumber}</Text> shortly.
            </Text>
            <TouchableOpacity
              style={styles.successModalBtn}
              onPress={() => {
                setShowSuccessModal(false);
                navigation.navigate('MyDrafts');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.successModalBtnText}>View My FIR Drafts</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topNav: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
  },
  backButton: {
    padding: 4,
  },
  topNavCenter: {
    flex: 1,
  },
  topNavRight: {
    width: 28,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },

  // ── Hero Section
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  heroLeftCol: {
    flex: 1,
    paddingRight: 8,
  },
  heroHeading: {
    fontSize: 30,
    fontWeight: '800',
    color: PALETTE.textHeading,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  heroSupportingText: {
    fontSize: 13,
    color: PALETTE.textMuted,
    lineHeight: 19,
    marginTop: 8,
  },
  heroRightCol: {
    width: 105,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentIllustrationCard: {
    width: 96,
    height: 122,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E8E1D5',
    shadowColor: '#8C6E52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
  },
  docHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  docOrangeBadge: {
    backgroundColor: PALETTE.accentOrange,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  docOrangeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  docMiniLineTop: {
    flex: 1,
    height: 3,
    backgroundColor: '#EAE2D7',
    borderRadius: 2,
    marginLeft: 6,
  },
  docBodyLines: {
    gap: 6,
  },
  docLine: {
    height: 4,
    backgroundColor: '#EAE2D7',
    borderRadius: 2,
  },
  docSealBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PALETTE.accentOrange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PALETTE.accentOrange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },

  // ── Turnaround Pill
  turnaroundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.pillBg,
    borderWidth: 1,
    borderColor: PALETTE.pillBorder,
    borderRadius: 50,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 14,
    gap: 8,
  },
  turnaroundPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: PALETTE.textBody,
    letterSpacing: 0.1,
  },

  // ── Large Beige Cards
  cardContainer: {
    backgroundColor: PALETTE.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#8C6E52',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },

  // ── Decorative Title
  decorativeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  decLine: {
    flex: 1,
    height: 1,
    backgroundColor: PALETTE.dividerColor,
  },
  decDiamond: {
    width: 5,
    height: 5,
    backgroundColor: PALETTE.diamondColor,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: 8,
  },
  cardTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.textHeading,
    letterSpacing: 0.2,
  },

  // ── How It Works Steps
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PALETTE.iconCircleBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: PALETTE.textBody,
    textAlign: 'center',
    lineHeight: 13,
    marginTop: 6,
  },
  stepConnector: {
    paddingTop: 12,
    alignItems: 'center',
  },

  // ── Request Form
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formHeaderIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PALETTE.iconCircleBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitleText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: PALETTE.textHeading,
  },
  formSubText: {
    fontSize: 12.5,
    color: PALETTE.textMuted,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 14,
  },
  inputWrapper: {
    backgroundColor: PALETTE.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.inputBorder,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  inputIconBox: {
    marginRight: 10,
  },
  textInputField: {
    flex: 1,
    fontSize: 13.5,
    color: PALETTE.textHeading,
    paddingVertical: 0,
  },
  dropdownText: {
    flex: 1,
    fontSize: 13.5,
    color: PALETTE.textHeading,
  },
  submitButton: {
    backgroundColor: PALETTE.primaryButton,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: PALETTE.primaryButton,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: PALETTE.primaryButtonText,
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 5,
  },
  securityText: {
    fontSize: 11,
    color: PALETTE.textMuted,
    textAlign: 'center',
  },

  // ── Why Choose Legaliit?
  whyChooseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: 4,
  },
  whyChooseCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  featureIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PALETTE.iconCircleBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitleText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: PALETTE.textBody,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },

  // ── Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE3',
  },
  dropdownModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.textHeading,
  },
  dropdownOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 10,
  },
  dropdownOptionItemSelected: {
    backgroundColor: '#F7F3EC',
  },
  dropdownOptionText: {
    fontSize: 13.5,
    color: PALETTE.textBody,
  },
  dropdownOptionTextSelected: {
    fontWeight: '700',
    color: PALETTE.primaryButton,
  },

  // Success Modal
  successModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  successIconCircle: {
    marginBottom: 14,
  },
  successModalHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: PALETTE.textHeading,
    marginBottom: 8,
    textAlign: 'center',
  },
  successModalBody: {
    fontSize: 13.5,
    color: PALETTE.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  successModalBtn: {
    backgroundColor: PALETTE.primaryButton,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  successModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
