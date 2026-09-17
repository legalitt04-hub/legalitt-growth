import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { profileAPI } from '../../services/profileAPI';

const SettingsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState(true);
  const [bioLoading, setBioLoading] = useState(false);

  const { biometricsEnabled, enableBiometrics, disableBiometrics, user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    profileAPI.getMe().then(({ data }) => {
      if (typeof data?.data?.preferences?.notifications === 'boolean') setNotifications(data.data.preferences.notifications);
    }).catch(() => {});
  }, [isAuthenticated]);

  const handleNotificationsToggle = async (value) => {
    const previous = notifications;
    setNotifications(value);
    try {
      await profileAPI.updateProfile({ preferences: { notifications: value } });
    } catch (err) {
      setNotifications(previous);
      Alert.alert('Update Failed', err?.response?.data?.message || 'Could not save notification settings.');
    }
  };

  const handleBiometricToggle = useCallback(async (value) => {
    if (bioLoading) return;
    setBioLoading(true);
    try {
      if (value) {
        // Prompt user to confirm with a password before enabling
        Alert.alert(
          'Enable Biometrics',
          'Biometric login lets you sign in with Face ID or fingerprint. You will be prompted to verify your identity.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setBioLoading(false) },
            {
              text: 'Enable',
              onPress: async () => {
                // enableBiometrics requires stored credentials — they are already
                // in SecureStore from the last password login, so pass empty strings
                // as the AuthContext reads from secure store directly.
                const result = await enableBiometrics('', '');
                if (!result.success && result.message) {
                  Alert.alert('Could not enable biometrics', result.message);
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
      Alert.alert('Error', 'Could not update biometric settings.');
    }
  }, [bioLoading, enableBiometrics, disableBiometrics]);

  const renderSettingItem = (icon, title, subtitle, onPress, rightComponent) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      activeOpacity={0.7} 
      disabled={!!rightComponent && !onPress}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.rightComponent}>
        {rightComponent || <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {renderSettingItem('person-outline', 'Personal Information', 'Update your details', () => navigation.navigate('ProfileEdit'))}
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.settingItem}>
            <View style={styles.iconContainer}>
              <Ionicons name="finger-print" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Biometric Login</Text>
              <Text style={styles.settingSubtitle}>
                {biometricsEnabled ? 'Face ID / Fingerprint enabled' : 'Use Face ID or fingerprint to sign in'}
              </Text>
            </View>
            <View style={styles.rightComponent}>
              {bioLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Switch
                  value={biometricsEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: '#D1D5DB', true: COLORS.primary }}
                  thumbColor={'#FFFFFF'}
                />
              )}
            </View>
          </View>
          {renderSettingItem(
            'lock-closed-outline',
            'Privacy & Security',
            'Manage password & account security',
            () => navigation.navigate('ForgotPassword')
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          {renderSettingItem('notifications-outline', 'Notifications', 'Manage alerts & updates', null,
            <Switch 
              value={notifications} 
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: '#D1D5DB', true: COLORS.primary }}
              thumbColor={'#FFFFFF'}
            />
          )}
          {renderSettingItem('settings-outline', 'App Permissions', 'Camera, microphone and notifications', () => Linking.openSettings())}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          {renderSettingItem('help-circle-outline', 'Help Center', 'FAQ & Contact Support', () => navigation.navigate('Support'))}
          {renderSettingItem('document-text-outline', 'Terms of Service', 'Read our usage agreement', () => navigation.navigate('TermsConditions'))}
          {renderSettingItem('shield-checkmark-outline', 'Privacy Policy', 'Read our privacy practices', () => navigation.navigate('PrivacyPolicy'))}
          {renderSettingItem('trash-outline', 'Data Deletion Request', 'Permanently delete your account', () => navigation.navigate('DataDeletion'))}
        </View>
        
        <Text style={styles.versionText}>Legalitt Version 1.0.3</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(176, 156, 133, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  rightComponent: {
    marginLeft: 12,
  },
  versionText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 13,
    color: '#9CA3AF',
  },
});

export default SettingsScreen;
