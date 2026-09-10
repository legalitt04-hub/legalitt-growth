import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { advocateAPI } from '../../services/api';
import { COLORS } from '../../constants/theme';
import { sanitizeInput } from '../../utils/security';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [errors, setErrors] = useState({});
  const [termsError, setTermsError] = useState(false);

  const { login, logout, googleLogin, biometricLogin, biometricsEnabled } = useAuth();

  const handleBiometricLogin = async () => {
    if (!agreeToTerms) {
      setTermsError(true);
      Alert.alert(
        'Consent Required',
        'Please read and agree to the Terms & Conditions and Privacy Policy to continue.'
      );
      return;
    }
    setLoading(true);
    try {
      const result = await biometricLogin();
      if (!result.success) {
        Alert.alert('Biometric Login Failed', result.message || 'Could not verify identity.');
      }
    } catch {
      Alert.alert('Error', 'Biometric authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    if (!agreeToTerms) {
      setTermsError(true);
      Alert.alert(
        'Consent Required',
        'Please read and agree to the Terms & Conditions and Privacy Policy to continue.'
      );
      return;
    }

    if (provider !== 'Google') {
      Alert.alert('Social Login', `${provider} login will be implemented soon.`);
      return;
    }

    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.idToken || userInfo.data?.idToken;
      if (!idToken) {
        throw new Error('Google Sign-In did not return an ID token.');
      }

      const response = await googleLogin(idToken, 'advocate');

      if (response.success && response.user) {
        // AppNavigator auto-switches when isAuthenticated=true & role=advocate
        try {
          const profileRes = await advocateAPI.getMyProfile();
          if (profileRes.data.success && profileRes.data.data) {
            const profile = profileRes.data.data;
            if (profile.verificationStatus !== 'approved') {
              navigation.replace('PendingApproval', { status: profile.verificationStatus });
            }
            // approved → AppNavigator handles routing automatically
          } else {
            navigation.replace('DocumentUpload', { 
              registerData: { name: response.user.name, email: response.user.email, barCouncilId: 'GOOGLE_SIGNIN' } 
            });
          }
        } catch (profileErr) {
          if (profileErr.response?.status === 404) {
            navigation.replace('DocumentUpload', { 
              registerData: { name: response.user.name, email: response.user.email, barCouncilId: 'GOOGLE_SIGNIN' } 
            });
          } else {
            console.log('Google Profile fetch error:', profileErr.message);
          }
        }
      } else {
        Alert.alert('Google Sign-In Failed', response.message || 'Could not verify credentials.');
      }
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Google Sign-In cancelled by user');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Google Sign-In is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services are not available or outdated.');
      } else {
        console.error('Google sign-in error:', error);
        Alert.alert('Google Sign-In Error', error.message || 'Google sign-in encountered an error.');
      }
    } finally {
      setLoading(false);
    }
  };


  const handleLogin = async () => {
    if (!agreeToTerms) {
      setTermsError(true);
      Alert.alert(
        'Consent Required',
        'Please read and agree to the Terms & Conditions and Privacy Policy to continue.'
      );
      return;
    }

    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    }
    if (!password.trim()) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const safeEmail = sanitizeInput(email.trim().toLowerCase());
    const safePassword = sanitizeInput(password.trim());
    setLoading(true);
    setErrors({});
    setTermsError(false);

    try {
      const response = await login(safeEmail, safePassword);

      if (response.success && response.user) {
        const user = response.user;

        // Verify user role
        if (user.role !== 'advocate') {
          await logout();
          Alert.alert(
            'Access Denied',
            'This account is not registered as an advocate. Please use the client portal login.'
          );
          setLoading(false);
          return;
        }

        // Check advocate profile status
        // AppNavigator auto-switches to AdvocateTabs when isAuthenticated=true & role=advocate
        // Only navigate manually for non-approved states
        try {
          const profileRes = await advocateAPI.getMyProfile();
          if (profileRes.data.success && profileRes.data.data) {
            const profile = profileRes.data.data;
            if (profile.verificationStatus !== 'approved') {
              navigation.replace('PendingApproval', { status: profile.verificationStatus });
            }
            // approved → AppNavigator handles routing to AdvocateMain automatically
          } else {
            navigation.replace('DocumentUpload');
          }
        } catch (profileErr) {
          if (profileErr.response?.status === 404) {
            navigation.replace('DocumentUpload');
          } else {
            console.log('Profile fetch error:', profileErr.message);
            // Let AppNavigator handle routing on auth state change
          }
        }
      } else {
        const errorMsg = response.message || '';
        if (errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('username') || errorMsg.toLowerCase().includes('invalid')) {
          Alert.alert('Incorrect password or username', 'Please check your credentials and try again.');
        } else {
          Alert.alert('Incorrect password or username', errorMsg || 'Invalid credentials.');
        }
      }
    } catch (error) {
      console.log('Login error details:', error.message);
      const errorMsg = error?.response?.data?.message || error.message || '';
      if (errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('username') || errorMsg.toLowerCase().includes('invalid')) {
        Alert.alert('Incorrect password or username', 'Please check your credentials and try again.');
      } else {
        Alert.alert('Incorrect password or username', 'Please check your connection and credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.replace('RoleSelect');
                }
              }}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.title}>Advocate Portal</Text>
              <Text style={styles.subtitle}>Sign in to manage your practice and connect with clients.</Text>
            </View>
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                errors.email && styles.inputError
              ]}
              placeholder="Email Address"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={(text) => {
                setEmail(sanitizeInput(text));
                if (errors.email) {
                  setErrors({ ...errors, email: null });
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                errors.password && styles.inputError
              ]}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) {
                  setErrors({ ...errors, password: null });
                }
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotPassword}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.nextButton,
              (!email || !password || !agreeToTerms || loading) && styles.nextButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={!email || !password || !agreeToTerms || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.nextButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Biometric Login Button */}
          {biometricsEnabled && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={loading}
            >
              <Ionicons name="finger-print" size={22} color={COLORS.primary} />
              <Text style={styles.biometricButtonText}>Login with Biometrics</Text>
            </TouchableOpacity>
          )}

          {/* Social Login Buttons */}
          <View style={styles.socialContainer}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialLogin('Google')}
              disabled={loading}
            >
              <GoogleIcon />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.socialButtonFacebook]}
              onPress={() => handleSocialLogin('Facebook')}
              disabled={loading}
            >
              <FbIcon />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.socialButtonApple]}
              onPress={() => handleSocialLogin('Apple')}
              disabled={loading}
            >
              <AppleIcon />
            </TouchableOpacity>
          </View>


          {/* Spacer */}
          <View style={{ flex: 1, minHeight: 40 }} />

          {/* Terms & Privacy acceptance */}
          <TouchableOpacity
            style={[
              styles.termsContainer,
              termsError && styles.termsContainerError,
            ]}
            onPress={() => {
              setAgreeToTerms(!agreeToTerms);
              setTermsError(false);
            }}
            activeOpacity={0.7}
            disabled={loading}
          >
            <View style={[
              styles.checkbox,
              agreeToTerms && styles.checkboxChecked,
              termsError && styles.checkboxError,
            ]}>
              {agreeToTerms && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
            <Text style={[styles.termsText, termsError && styles.termsTextError]}>
              I agree to the{' '}
              <Text
                style={styles.termsLink}
                onPress={(e) => {
                  e.stopPropagation();
                  navigation.navigate('TermsConditions');
                }}
              >
                Terms &amp; Conditions
              </Text>
              {' and '}
              <Text
                style={styles.termsLink}
                onPress={(e) => {
                  e.stopPropagation();
                  navigation.navigate('PrivacyPolicy');
                }}
              >
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>
          {termsError && (
            <Text style={styles.termsErrorHint}>
              ⚠ You must accept the Privacy Policy to continue.
            </Text>
          )}

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>New to Legalitt?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AdvocateRegister')}>
              <Text style={styles.registerText}> Apply as Advocate</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    gap: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  input: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 24,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 24,
  },
  eyeIcon: {
    position: 'absolute',
    right: 20,
    top: 18,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -12,
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonDisabled: {
    backgroundColor: '#D1D5DB',
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#9CA3AF',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(20, 184, 166, 0.05)',
    marginBottom: 24,
  },
  biometricButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  termsContainerError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxError: {
    borderColor: '#EF4444',
  },
  termsText: {
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
    lineHeight: 18,
  },
  termsTextError: {
    color: '#991B1B',
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  termsErrorHint: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -16,
    marginBottom: 20,
    marginLeft: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#6B7280',
    fontSize: 15,
  },
  registerText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  socialButtonFacebook: {
    backgroundColor: '#1877F2',
    borderWidth: 0,
  },
  socialButtonApple: {
    backgroundColor: '#000000',
    borderWidth: 0,
  },
  iconContainer: {
    width: 24,
    height: 24,
  },
});

// Social Icons Components
const GoogleIcon = () => (
  <View style={styles.iconContainer}>
    <Svg width="24" height="24" viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  </View>
);

const FbIcon = () => (
  <Ionicons name="logo-facebook" size={24} color="#FFFFFF" />
);

const AppleIcon = () => (
  <Ionicons name="logo-apple" size={24} color="#FFFFFF" />
);

// Simple SVG component wrapper (if react-native-svg is not installed, fallback to text)
const Svg = ({ children, ...props }) => {
  try {
    const RNSvg = require('react-native-svg').Svg;
    return <RNSvg {...props}>{children}</RNSvg>;
  } catch (error) {
    return (
      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#4285F4' }}>G</Text>
      </View>
    );
  }
};

const Path = ({ ...props }) => {
  try {
    const RNPath = require('react-native-svg').Path;
    return <RNPath {...props} />;
  } catch (error) {
    return null;
  }
};

