// screens/auth/LoginRegisterScreen.jsx
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
import { COLORS } from '../../constants/theme';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { sanitizeInput } from '../../utils/security';
import { GoogleSignin, statusCodes } from '../../utils/GoogleSigninMock';

const LoginRegisterScreen = ({ navigation, route }) => {
  const selectedRole = route?.params?.role || 'client';
  const { login, logout, googleLogin, biometricLogin, biometricsEnabled, consentAccepted } = useAuth();
  
  // Toggle between Login and Register modes
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Pre-fill consent checkbox if user already accepted during the onboarding gate
  const [agreeToTerms, setAgreeToTerms] = useState(consentAccepted);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [termsError, setTermsError] = useState(false);

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation — min 8 chars, at least one letter and one digit
  const validatePassword = (pwd) => {
    return pwd.length >= 8 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd);
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (mode === 'login') {
      if (!password.trim()) {
        newErrors.password = 'Password is required';
      } else if (!validatePassword(password)) {
        newErrors.password = 'Password must be 8+ characters with letters & numbers';
      }
    }

    // ── Privacy Policy acceptance is required for BOTH login and register ──
    if (!agreeToTerms) {
      setTermsError(true);
      Alert.alert(
        'Privacy Policy Required',
        'Please read and accept the Terms & Conditions and Privacy Policy before continuing.'
      );
      return false;
    }

    setTermsError(false);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateForm()) return;

    // Sanitize email input before submission (XSS prevention)
    const safeEmail = sanitizeInput(email.trim().toLowerCase());
    const safePassword = password.trim();

    setLoading(true);
    try {
      if (mode === 'login') {
        const response = await login(safeEmail, safePassword);
        
        if (response.success && response.user) {
          // Account logged in successfully.
          // AppNavigator handles routing to AdvocateMain or ClientMain based on user.role
        } else {
          const errorMsg = response.message || '';
          if (errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('username') || errorMsg.toLowerCase().includes('invalid')) {
            Alert.alert('Incorrect password or username', 'Please check your credentials and try again.');
          } else {
            Alert.alert('Incorrect password or username', errorMsg || 'Invalid credentials.');
          }
        }
      } else {
        // REGISTER MODE — sanitize and proceed to OTP
        navigation.navigate('OTP', { 
          email: safeEmail, 
          role: selectedRole,
          mode: 'register' 
        });
      }
    } catch (error) {
      const errorMsg = error?.response?.data?.message || error.message || 'Something went wrong';
      if (mode === 'login' && (errorMsg.toLowerCase().includes('credential') || errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('username') || errorMsg.toLowerCase().includes('invalid'))) {
        Alert.alert('Incorrect password or username', 'Please check your credentials and try again.');
      } else {
        Alert.alert(
          mode === 'login' ? 'Incorrect password or username' : 'Registration Failed',
          errorMsg
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const result = await biometricLogin();
      if (!result.success) {
        Alert.alert('Biometric Login Failed', result.message || 'Could not verify your identity.');
      }
    } catch (err) {
      Alert.alert('Error', 'Biometric authentication encountered an error.');
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
      Alert.alert('Social Login', `${provider} login will be implemented soon`);
      return;
    }

    setLoading(true);
    try {
      // Check Play Services availability
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Trigger native Google account picker
      const signInResult = await GoogleSignin.signIn();

      // v13 returns { data: { idToken, user, ... } } or { idToken, user, ... }
      const idToken  = signInResult?.data?.idToken  || signInResult?.idToken;
      const userData = signInResult?.data?.user      || signInResult?.user;

      if (!idToken) {
        // Should not happen — idToken always present if signIn succeeded
        throw new Error('Google Sign-In did not return an ID token. Please try again.');
      }

      // Send idToken to Legalitt backend for verification + JWT issue
      const userRole = selectedRole === 'advocate' ? 'advocate' : 'client';
      const response = await googleLogin(idToken, userRole);

      if (!response.success) {
        Alert.alert(
          'Google Sign-In Failed',
          response.message || 'Could not verify your Google account. Please try again.',
          [{ text: 'OK' }]
        );
      }
      // On success, AuthContext auto-navigates via isAuthenticated state
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User pressed back — silent
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Please Wait', 'Google Sign-In is already in progress.');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          'Play Services Required',
          'Google Play Services is not available or needs an update. Please update it from the Play Store.',
          [{ text: 'OK' }]
        );
      } else {
        console.error('[Google Sign-In Error]', error);
        Alert.alert(
          'Sign-In Error',
          error.message || 'Something went wrong with Google Sign-In. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLoading(false);
    }
  };


  const handleModeChange = (newMode) => {
    setMode(newMode);
    setErrors({});
    setTermsError(false);
    setPassword('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom','left','right']}>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
              <Text style={styles.title}>
                {selectedRole === 'advocate' ? 'Advocate Portal' : 'Login / Register'}
              </Text>
              <Text style={styles.subtitle}>
                {selectedRole === 'advocate'
                  ? mode === 'login' ? 'Sign in to your Advocate account' : 'Register as an Advocate'
                  : mode === 'login' ? 'Login With Your Account' : 'Register With Your Account'}
              </Text>
            </View>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'login' && styles.modeButtonActive]}
              onPress={() => handleModeChange('login')}
              disabled={loading}
            >
              <Text style={[styles.modeButtonText, mode === 'login' && styles.modeButtonTextActive]}>
                Login
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'register' && styles.modeButtonActive]}
              onPress={() => handleModeChange('register')}
              disabled={loading}
            >
              <Text style={[styles.modeButtonText, mode === 'register' && styles.modeButtonTextActive]}>
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email/Mobile Input */}
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
                // Strip any HTML/script injection attempt in real time
                const safe = sanitizeInput(text);
                setEmail(safe);
                if (errors.email) {
                  setErrors({ ...errors, email: null });
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* Password Input (only in LOGIN mode) */}
          {mode === 'login' && (
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
          )}

          {/* Forgot Password (only in LOGIN mode) */}
          {mode === 'login' && (
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Next Button */}
          <TouchableOpacity
            style={[
              styles.nextButton,
              (!email || (mode === 'login' && !password) || !agreeToTerms || loading) && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!email || (mode === 'login' && !password) || !agreeToTerms || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.nextButtonText}>Next</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Biometric Login Button — only visible in LOGIN mode when enabled */}
          {mode === 'login' && biometricsEnabled && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={loading}
              accessibilityLabel="Login with biometrics"
            >
              <Ionicons name="finger-print" size={22} color={COLORS.primary} />
              <Text style={styles.biometricButtonText}>Login with Biometrics</Text>
            </TouchableOpacity>
          )}

          {/* Google Sign-In — Full Width Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => handleSocialLogin('Google')}
            disabled={loading}
            accessibilityLabel="Continue with Google"
          >
            <GoogleIcon />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Spacer */}
          <View style={{ flex: 1, minHeight: 40 }} />

          {/* Terms & Privacy — required for both Login and Register */}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Google Icon Component
const GoogleIcon = () => (
  <View style={styles.iconContainer}>
    <Svg width="22" height="22" viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
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
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 25,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 21,
  },
  modeButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeButtonTextActive: {
    color: COLORS.primary,
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
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    marginTop: 16,
    backgroundColor: 'rgba(20,184,166,0.05)',
  },
  biometricButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  termsContainerError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
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
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxError: {
    borderColor: '#EF4444',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  termsTextError: {
    color: '#7F1D1D',
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  termsErrorHint: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 4,
  },
});

export default LoginRegisterScreen;
