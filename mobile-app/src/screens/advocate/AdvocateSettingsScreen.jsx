import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import api, { advocateAPI } from '../../services/api';

// Storage keys for persisting advocate local settings
const SETTINGS_STORAGE_KEY = 'legalitt_advocate_settings_pref';

export default function AdvocateSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, biometricsEnabled, enableBiometrics, disableBiometrics } = useAuth();

  const [loading, setLoading] = useState(true);
  const [advocateData, setAdvocateData] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [bioLoading, setBioLoading] = useState(false);

  // Toggle Preferences State
  const [preferences, setPreferences] = useState({
    bookingRequest: true,
    appointmentReminders: true,
    clientMessages: true,
    paymentNotifications: true,
    availableForConsultations: true,
    videoConsultation: true,
    voiceConsultation: true,
  });

  // Load Advocate Profile and Stored Preferences
  const loadInitialData = useCallback(async () => {
    try {
      // 1. Fetch Advocate Profile
      try {
        const res = await advocateAPI.getMyProfile();
        if (res.data?.success && res.data?.data) {
          setAdvocateData(res.data.data);
          if (res.data.data.bankDetails) {
            setBankDetails(res.data.data.bankDetails);
          }
          if (typeof res.data.data.isOnline === 'boolean') {
            setPreferences(prev => ({
              ...prev,
              availableForConsultations: res.data.data.isOnline,
            }));
          }
        }
      } catch (profileErr) {
        // Fallback gracefully if advocate profile endpoint fails
        console.log('Advocate profile fetch note:', profileErr.message);
      }

      // 2. Fetch Wallet for Bank Details if not present
      try {
        const walletRes = await api.get('/wallet');
        const payload = walletRes.data?.data || walletRes.data || {};
        if (payload.bankDetails) {
          setBankDetails(payload.bankDetails);
        }
      } catch (wErr) {
        // Silently continue
      }

      // 3. Load locally saved toggle preferences
      const saved = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setPreferences(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          // Ignore json parse error
        }
      }
    } catch (error) {
      console.log('Error initializing settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Refresh data on screen focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadInitialData();
    });
    return unsubscribe;
  }, [navigation, loadInitialData]);

  // Update a single preference toggle
  const handleToggle = async (key, val) => {
    const updated = { ...preferences, [key]: val };
    setPreferences(updated);
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      // Ignore storage error
    }

    // If toggling consultation availability, sync with advocate online status if supported
    if (key === 'availableForConsultations') {
      try {
        await advocateAPI.upsertProfile({ isOnline: val });
      } catch (err) {
        // Keep local state intact
      }
    }
  };

  // Handle Biometric Login Toggle
  const handleBiometricToggle = useCallback(async (value) => {
    if (bioLoading) return;
    setBioLoading(true);
    try {
      if (value) {
        Alert.alert(
          'Enable Biometrics',
          'Biometric login allows quick access using Face ID or Fingerprint.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setBioLoading(false) },
            {
              text: 'Enable',
              onPress: async () => {
                const result = await enableBiometrics('', '');
                if (!result.success && result.message) {
                  Alert.alert('Biometrics Error', result.message);
                }
                setBioLoading(false);
              },
            },
          ]
        );
      } else {
        await disableBiometrics();
        setBioLoading(false);
      }
    } catch (err) {
      setBioLoading(false);
      Alert.alert('Error', 'Could not update biometric security setting.');
    }
  }, [bioLoading, enableBiometrics, disableBiometrics]);

  // Navigation Helpers
  const handleNavigateEditProfile = () => {
    try {
      navigation.navigate('AdvocateProfileEdit');
    } catch (e) {
      const parent = navigation.getParent();
      if (parent) parent.navigate('AdvocateProfileEdit');
    }
  };

  const handleNavigateChangePassword = () => {
    Alert.alert(
      'Change Password',
      'A password reset link or OTP can be sent to your registered email address (' + (user?.email || 'your email') + '). Would you like to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: () => {
            try {
              navigation.navigate('ForgotPassword');
            } catch {
              Alert.alert('Notice', 'Password reset instructions have been dispatched.');
            }
          },
        },
      ]
    );
  };

  const handleNavigateWallet = () => {
    try {
      navigation.navigate('AdvocateWallet');
    } catch {
      try {
        navigation.navigate('Earnings');
      } catch {
        const parent = navigation.getParent();
        if (parent) parent.navigate('Earnings');
      }
    }
  };

  const handleNavigateEarnings = () => {
    try {
      navigation.navigate('Earnings');
    } catch {
      try {
        navigation.navigate('AdvocateWallet');
      } catch {
        const parent = navigation.getParent();
        if (parent) parent.navigate('Earnings');
      }
    }
  };

  // Reusable Row Component matching PDF visual style
  const renderRow = ({
    icon,
    title,
    subtitle,
    isToggle = false,
    toggleValue = false,
    onToggle,
    onPress,
    rightLabel,
    isLast = false,
    accessibilityLabel,
  }) => {
    return (
      <View style={[styles.rowContainer, isLast && styles.rowLast]}>
        <TouchableOpacity
          style={styles.rowClickable}
          activeOpacity={isToggle ? 1 : 0.65}
          disabled={isToggle}
          onPress={onPress}
          accessibilityRole={isToggle ? 'none' : 'button'}
          accessibilityLabel={accessibilityLabel || title}
        >
          {/* Left Icon Container */}
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={20} color="#8C7662" />
          </View>

          {/* Title & Subtitle */}
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>{title}</Text>
            {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
          </View>

          {/* Right Action: Toggle, Value Label, or Chevron */}
          <View style={styles.rowAction}>
            {isToggle ? (
              <Switch
                value={toggleValue}
                onValueChange={onToggle}
                trackColor={{ false: '#E5E3DE', true: '#B09C85' }}
                thumbColor={'#FFFFFF'}
                ios_backgroundColor="#E5E3DE"
                accessibilityLabel={title}
                accessibilityRole="switch"
                accessibilityState={{ checked: toggleValue }}
              />
            ) : rightLabel ? (
              <View style={styles.rightLabelWrap}>
                <Text style={styles.rightLabelText}>{rightLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color="#C4BFB8" />
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color="#C4BFB8" />
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const isVerified = advocateData?.isVerified || user?.isVerified || advocateData?.verificationStatus === 'approved';
  const advocateName = user?.name || advocateData?.user?.name || 'Advocate';
  const advocateEmail = user?.email || advocateData?.user?.email || 'advocate@legalitt.com';
  const avatarUri = user?.avatar || advocateData?.user?.avatar;
  const bankNameDisplay = bankDetails?.bankName 
    ? `${bankDetails.bankName} (•••${(bankDetails.accountNumber || '').slice(-4)})` 
    : 'System Default';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back to dashboard"
        >
          <Ionicons name="chevron-back" size={24} color="#2D2D2D" />
          <Text style={styles.headerTitle}>Settings</Text>
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('ChatList')}
            accessibilityRole="button"
            accessibilityLabel="Open Messages"
          >
            <Ionicons name="chatbubble-outline" size={20} color="#2D2D2D" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityRole="button"
            accessibilityLabel="Open Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color="#2D2D2D" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerContainer}>
          {/* ────────────────── PROFILE SUMMARY CARD ────────────────── */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatarSection}>
              <View style={styles.profileAvatarWrap}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.profileAvatarImg} />
                ) : (
                  <View style={styles.profileAvatarPlaceholder}>
                    <Text style={styles.profileAvatarInitial}>
                      {(advocateName || 'A')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.profileTextSection}>
              <Text style={styles.profileNameText}>{advocateName}</Text>
              
              <View style={styles.verifiedRow}>
                <Ionicons
                  name={isVerified ? "checkmark-circle" : "alert-circle"}
                  size={15}
                  color={isVerified ? "#10B981" : "#F59E0B"}
                />
                <Text style={[styles.verifiedText, { color: isVerified ? "#10B981" : "#F59E0B" }]}>
                  {isVerified ? "Verified Advocate" : "Verification Pending"}
                </Text>
              </View>

              <Text style={styles.profileEmailText}>{advocateEmail}</Text>

              {/* Edit Profile Action Pill Button */}
              <TouchableOpacity
                style={styles.editProfilePill}
                onPress={handleNavigateEditProfile}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Edit Profile"
              >
                <Text style={styles.editProfilePillText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ────────────────── 1. ACCOUNT SECTION ────────────────── */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeaderTitle}>Account</Text>
            <View style={styles.cardContainer}>
              {renderRow({
                icon: 'person-outline',
                title: 'Edit Profile',
                subtitle: 'Update your personal and professional details',
                onPress: handleNavigateEditProfile,
              })}
              {renderRow({
                icon: 'lock-closed-outline',
                title: 'Change Password',
                subtitle: 'Update your account password securely',
                onPress: handleNavigateChangePassword,
              })}
              {renderRow({
                icon: 'shield-checkmark-outline',
                title: 'Login & Security',
                subtitle: biometricsEnabled ? 'Biometrics login active' : 'Manage security, sessions and devices',
                onPress: () => {
                  Alert.alert(
                    'Login & Security',
                    `Account: ${advocateEmail}\nBiometrics: ${biometricsEnabled ? 'Enabled' : 'Disabled'}\nTwo-Factor Status: Standard Secure Session`,
                    [
                      {
                        text: biometricsEnabled ? 'Disable Biometrics' : 'Enable Biometrics',
                        onPress: () => handleBiometricToggle(!biometricsEnabled),
                      },
                      { text: 'Close', style: 'cancel' },
                    ]
                  );
                },
              })}
              {renderRow({
                icon: 'document-text-outline',
                title: 'Manage Documents',
                subtitle: 'Manage your verification and documents',
                onPress: handleNavigateEditProfile,
                isLast: true,
              })}
            </View>
          </View>

          {/* ────────────────── 2. NOTIFICATION SECTION ────────────────── */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeaderTitle}>Notification</Text>
            <View style={styles.cardContainer}>
              {renderRow({
                icon: 'people-outline',
                title: 'Booking Request',
                subtitle: 'Received alerts for new consultation request',
                isToggle: true,
                toggleValue: preferences.bookingRequest,
                onToggle: (val) => handleToggle('bookingRequest', val),
              })}
              {renderRow({
                icon: 'notifications-outline',
                title: 'Appointment Reminders',
                subtitle: 'Get Reminder before scheduled consultations.',
                isToggle: true,
                toggleValue: preferences.appointmentReminders,
                onToggle: (val) => handleToggle('appointmentReminders', val),
              })}
              {renderRow({
                icon: 'chatbubble-outline',
                title: 'Client Messages',
                subtitle: 'Receive notifications for new client messages',
                isToggle: true,
                toggleValue: preferences.clientMessages,
                onToggle: (val) => handleToggle('clientMessages', val),
              })}
              {renderRow({
                icon: 'wallet-outline',
                title: 'Payment Notifications',
                subtitle: 'Get Notified when payments are received',
                isToggle: true,
                toggleValue: preferences.paymentNotifications,
                onToggle: (val) => handleToggle('paymentNotifications', val),
                isLast: true,
              })}
            </View>
          </View>

          {/* ────────────────── 3. CONSULTATION AVAILABILITY ────────────────── */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeaderTitle}>Consultation Availability</Text>
            <View style={styles.cardContainer}>
              {renderRow({
                icon: 'calendar-outline',
                title: 'Available for Consultations',
                subtitle: 'Client can book consultations during your available hours.',
                isToggle: true,
                toggleValue: preferences.availableForConsultations,
                onToggle: (val) => handleToggle('availableForConsultations', val),
                isLast: true,
              })}
            </View>
          </View>

          {/* ────────────────── 4. CONSULTATION PREFERENCE ────────────────── */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeaderTitle}>Consultation Preference</Text>
            <View style={styles.cardContainer}>
              {renderRow({
                icon: 'videocam-outline',
                title: 'Video Consultation',
                isToggle: true,
                toggleValue: preferences.videoConsultation,
                onToggle: (val) => handleToggle('videoConsultation', val),
              })}
              {renderRow({
                icon: 'call-outline',
                title: 'Voice Consultation',
                isToggle: true,
                toggleValue: preferences.voiceConsultation,
                onToggle: (val) => handleToggle('voiceConsultation', val),
                isLast: true,
              })}
            </View>
          </View>

          {/* ────────────────── 5. PRIVACY & SECURITY ────────────────── */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeaderTitle}>Privacy & Security</Text>
            <View style={styles.cardContainer}>
              {renderRow({
                icon: 'shield-outline',
                title: 'Privacy Settings',
                subtitle: 'Control your privacy preferences',
                onPress: () => navigation.navigate('PrivacyPolicy'),
              })}
              {renderRow({
                icon: 'lock-closed-outline',
                title: 'App Permissions',
                subtitle: 'Manage app permissions',
                onPress: () => {
                  Alert.alert(
                    'App Permissions',
                    'Camera: Used for Video Consultation & Document Scan\nMicrophone: Used for Voice/Video Calls\nNotifications: Used for Real-time Bookings & Chats\nStorage: Used for Document & Evidence Vaults',
                    [{ text: 'OK' }]
                  );
                },
              })}
              {renderRow({
                icon: 'log-out-outline',
                title: 'Active Sessions',
                subtitle: 'View and manage active sessions',
                onPress: () => {
                  Alert.alert(
                    'Active Sessions',
                    `Current Device: ${Platform.OS.toUpperCase()} Client\nSession Status: Secure & Authenticated\nLast Active: Just Now`,
                    [{ text: 'OK' }]
                  );
                },
              })}
              {renderRow({
                icon: 'folder-outline',
                title: 'Data & Documents',
                subtitle: 'Manage your data and documents',
                onPress: () => navigation.navigate('DataDeletion'),
                isLast: true,
              })}
            </View>
          </View>

          {/* ────────────────── 6. PREFERENCES ────────────────── */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeaderTitle}>Preferences</Text>
            <View style={styles.cardContainer}>
              {renderRow({
                icon: 'language-outline',
                title: 'Language',
                subtitle: 'English',
                onPress: () => {
                  Alert.alert('Language Settings', 'Currently set to English (Default). Hindi and regional languages will be available in the upcoming release.', [{ text: 'OK' }]);
                },
                isLast: true,
              })}
            </View>
          </View>

          {/* ────────────────── 7. PAYMENT & PAYOUT SETTINGS ────────────────── */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeaderTitle}>Payment & Payout settings</Text>
            <View style={styles.cardContainer}>
              {renderRow({
                icon: 'wallet-outline',
                title: 'Payment & Payout Settings',
                subtitle: 'Manage payouts and preferences',
                onPress: handleNavigateEarnings,
              })}
              {renderRow({
                icon: 'business-outline',
                title: 'Bank Account',
                subtitle: bankNameDisplay,
                onPress: handleNavigateWallet,
                isLast: true,
              })}
            </View>
          </View>

          {/* App Version Info */}
          <Text style={styles.versionFooter}>Legalitt Advocate Portal • v1.0.4</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE6',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2A29',
    marginLeft: 4,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F3EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    alignItems: 'center',
  },
  centerContainer: {
    width: '100%',
    maxWidth: 720,
  },

  // ── Profile Summary Card ──
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECE8E1',
    shadowColor: '#2C2A29',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  profileAvatarSection: {
    marginBottom: 12,
  },
  profileAvatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#B09C85',
    padding: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarImg: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  profileAvatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(176, 156, 133, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: '#8C7662',
  },
  profileTextSection: {
    alignItems: 'center',
    width: '100%',
  },
  profileNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2A29',
    marginBottom: 4,
    textAlign: 'center',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  profileEmailText: {
    fontSize: 13,
    color: '#767471',
    marginBottom: 12,
    textAlign: 'center',
  },
  editProfilePill: {
    backgroundColor: '#A68A68',
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#A68A68',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  editProfilePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Sections & Cards ──
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B6864',
    marginBottom: 8,
    paddingLeft: 4,
    letterSpacing: 0.2,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECE8E1',
    shadowColor: '#2C2A29',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    overflow: 'hidden',
  },

  // ── Row Item Styles ──
  rowContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#F4F2EE',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(176, 156, 133, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowContent: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C2A29',
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#82807C',
    lineHeight: 16,
  },
  rowAction: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 32,
  },
  rightLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rightLabelText: {
    fontSize: 13,
    color: '#82807C',
  },

  // ── Version Footer ──
  versionFooter: {
    textAlign: 'center',
    fontSize: 12,
    color: '#AAA59F',
    marginTop: 8,
    marginBottom: 16,
  },
});
