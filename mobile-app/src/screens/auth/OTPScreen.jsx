// screens/auth/OTPScreen.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Each box: 6 boxes + 5 gaps of 10px each, with 48px horizontal padding
const OTP_BOX_SIZE = Math.min(52, Math.floor((SCREEN_WIDTH - 48 - 5 * 10) / 6));
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import Constants from 'expo-constants';

const OTPScreen = ({ navigation, route }) => {
  const { email, role, mode, password: loginPassword, registerData } = route.params;
  const { register, login } = useAuth();

  // OTP Input — 6 digits
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  // Password Setup (for registration only)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Flow control
  const [otpVerified, setOtpVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Resend countdown
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef(null);

  const startCountdown = () => {
    setCountdown(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // Live password validation criteria
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[#?!@$%^&*-]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  useEffect(() => {
    inputRefs.current[0]?.focus();
    handleResendOTP();
    return () => clearInterval(timerRef.current);
  }, []);

  const handleOtpChange = (text, index) => {
    if (text && !/^\d+$/.test(text)) return;

    const newOtp = [...otp];
    // Handle paste — fill from current index
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, 6).split('');
      const filled = [...Array(6)].map((_, i) => digits[i] || '');
      setOtp(filled);
      inputRefs.current[Math.min(digits.length - 1, 5)]?.focus();
      return;
    }
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const validatePasswordSchema = (pwd) => {
    return pwd.length >= 8 && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#?!@$%^&*-]).{8,}$/.test(pwd);
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) return;

    setVerifying(true);
    try {
      const { data } = await authAPI.verifyOTP(email.trim().toLowerCase(), otpCode, role);

      if (data.success) {
        if (mode === 'login') {
          const response = await login(email.trim().toLowerCase(), loginPassword);
          if (!response.success) Alert.alert('Verification failed', response.message || 'OTP verification failed');
        } else if (registerData?.password) {
          await handleCompleteRegistration(registerData.password);
        } else {
          setOtpVerified(true);
        }
      } else {
        Alert.alert('Verification Failed', 'Incorrect OTP entered.');
      }
    } catch (error) {
      const serverMsg = error.response?.data?.message;
      Alert.alert('Verification Failed', serverMsg || 'The server is waking up. Please tap Verify once more.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCompleteRegistration = async (overridePassword) => {
    if (submitting) return;

    const passToUse = overridePassword || newPassword;
    if (!overridePassword) {
      if (!newPassword || !confirmPassword) return;
      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match!');
        return;
      }
      if (!validatePasswordSchema(newPassword)) {
        Alert.alert(
          'Password Invalid',
          'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (#?!@$%^&*-).'
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const mobileAppSecret = Constants.expoConfig?.extra?.MOBILE_APP_SECRET || 'mock_captcha_token';
      const rawName = registerData?.name || email.split('@')[0];
      const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

      const response = await register({
        name: cleanName,
        email: email.trim().toLowerCase(),
        password: passToUse,
        role: role || 'client',
        barCouncilId: registerData?.barCouncilId || undefined,
        captchaToken: mobileAppSecret,
      });

      if (!response.success) {
        Alert.alert('Registration Failed', response.message || 'Registration failed');
      } else if (role === 'advocate') {
        // Advocates go to document upload after registration
        navigation.replace('DocumentUpload', { registerData });
      }
    } catch (error) {
      Alert.alert('Registration Error', error.message || 'Registration encountered an error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      await authAPI.sendOTP(email.trim().toLowerCase());
      startCountdown();
    } catch (err) {
      console.log('Error triggering OTP resend:', err.message);
    }
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  };

  // Show OTP Entry Screen
  if (!otpVerified) {
    const otpFull = otp.join('').length === 6;
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Enter verification code</Text>
              <Text style={styles.subtitle}>6-digit code sent to {email}</Text>
            </View>

            {/* 6-digit OTP Inputs */}
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[styles.otpInput, digit && styles.otpInputFilled]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                />
              ))}
            </View>

            {/* Resend with countdown */}
            <TouchableOpacity
              onPress={countdown === 0 ? handleResendOTP : undefined}
              disabled={countdown > 0}
              style={styles.resendContainer}
            >
              <Text style={styles.resendText}>
                {countdown > 0
                  ? `Resend OTP in ${countdown}s`
                  : <Text style={styles.resendLink}>Resend OTP</Text>
                }
              </Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.nextButton, (!otpFull || verifying) && styles.nextButtonDisabled]}
              onPress={handleVerifyOTP}
              disabled={!otpFull || verifying}
            >
              {verifying
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={styles.nextButtonText}>Verify Code</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Show Password Setup Screen (Registration only)
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Password</Text>
            <Text style={styles.subtitle}>
              Set up a secure password for your account
            </Text>
          </View>

          {/* New Password Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="New Password"
              placeholderTextColor="#9CA3AF"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowNewPassword(!showNewPassword)}
            >
              <Ionicons
                name={showNewPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          {/* Password Requirements */}
          <View style={styles.requirementsContainer}>
            <View style={styles.requirementRow}>
              <Ionicons 
                name={hasMinLength ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={hasMinLength ? "#10B981" : "#9CA3AF"} 
              />
              <Text style={[styles.requirementText, hasMinLength && styles.requirementTextValid]}>
                At least 8 characters
              </Text>
            </View>

            <View style={styles.requirementRow}>
              <Ionicons 
                name={(hasUpper && hasLower && hasNumber && hasSpecial) ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={(hasUpper && hasLower && hasNumber && hasSpecial) ? "#10B981" : "#9CA3AF"} 
              />
              <Text style={[styles.requirementText, (hasUpper && hasLower && hasNumber && hasSpecial) && styles.requirementTextValid]}>
                Uppercase, lowercase, number &amp; special char (#?!@$%^&amp;*-)
              </Text>
            </View>

            <View style={styles.requirementRow}>
              <Ionicons 
                name={passwordsMatch ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={passwordsMatch ? "#10B981" : "#9CA3AF"} 
              />
              <Text style={[styles.requirementText, passwordsMatch && styles.requirementTextValid]}>
                Passwords match
              </Text>
            </View>
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Complete Registration Button */}
          <TouchableOpacity
            style={[
              styles.nextButton,
              (!newPassword || !confirmPassword || submitting) && styles.nextButtonDisabled,
            ]}
            onPress={() => handleCompleteRegistration()}
            disabled={!newPassword || !confirmPassword || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.nextButtonText}>Complete Registration</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  otpInput: {
    width: OTP_BOX_SIZE,
    height: OTP_BOX_SIZE,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    fontSize: Math.floor(OTP_BOX_SIZE * 0.42),
    fontWeight: '600',
    textAlign: 'center',
    color: '#1F2937',
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDFA',
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#6B7280',
  },
  resendLink: {
    color: COLORS.primary,
    fontWeight: '600',
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
  eyeIcon: {
    position: 'absolute',
    right: 20,
    top: 18,
  },
  requirementsContainer: {
    paddingLeft: 12,
    marginBottom: 24,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 12,
    color: '#6B7280',
  },
  requirementTextValid: {
    color: '#10B981',
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
});

export default OTPScreen;
