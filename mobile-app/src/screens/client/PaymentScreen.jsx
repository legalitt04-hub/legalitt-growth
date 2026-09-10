// screens/client/PaymentScreen.jsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { paymentAPI, bookingAPI } from '../../services/api';
import RazorpayCheckout from 'react-native-razorpay';

const PaymentScreen = ({ navigation, route }) => {
  const { isAuthenticated } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('select'); // 'select' | 'processing' | 'verifying'

  // Get parameters
  const { bookingId, amount, advocateName, advocateAvatar, advocateId } = route?.params || {};
  const consultationFee = amount || route?.params?.fee || 800;
  const platformFee = 0;
  const totalAmount = consultationFee + platformFee;

  const paymentMethods = [
    {
      id: 'upi',
      icon: 'phone-portrait-outline',
      title: 'UPI',
      subtitle: 'Pay using any UPI app',
    },
    {
      id: 'card',
      icon: 'card-outline',
      title: 'Credit/Debit Card',
      subtitle: 'Debit card or credit card',
    },
    {
      id: 'netbanking',
      icon: 'business-outline',
      title: 'Net Banking',
      subtitle: 'Net Banking',
    },
  ];

  const handlePayment = async () => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRegister', { role: 'client' });
      return;
    }
    if (!selectedMethod) {
      Alert.alert('Selection Required', 'Please select a payment method');
      return;
    }
    if (!bookingId) {
      Alert.alert('Error', 'Invalid booking. Please go back and try again.');
      return;
    }

    setLoading(true);
    setStep('processing');
    try {
      // ── Step 1: Create Razorpay order on backend ────────────────────────────
      const orderRes = await paymentAPI.createOrder(bookingId);
      if (!orderRes.data?.success) {
        throw new Error('Failed to create payment order. Please try again.');
      }

      const { orderId, amount: orderAmount, currency, keyId } = orderRes.data.data;

      let razorpay_payment_id, razorpay_signature, razorpay_order_id;

      if (__DEV__) {
        // ── DEV MODE: bypass real payment for testing ──────────────────────
        razorpay_payment_id = 'pay_dev_' + Math.random().toString(36).substring(2, 11);
        razorpay_order_id   = orderId;
        razorpay_signature  = 'dev_bypass';
      } else {
        // ── PRODUCTION: open real Razorpay payment sheet ───────────────────
        setStep('processing');
        const paymentData = await RazorpayCheckout.open({
          key: keyId,
          order_id: orderId,
          amount: orderAmount,       // in paise (already from backend)
          currency: currency || 'INR',
          name: 'Legalitt Legal Services',
          description: `Consultation with ${advocateName || 'Advocate'}`,
          image: 'https://legalitt-growth.onrender.com/logo.png',
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
          },
          notes: { bookingId },
          theme: { color: '#14B8A6' },
          modal: {
            ondismiss: () => {
              setLoading(false);
              setStep('select');
            },
          },
        });

        razorpay_payment_id = paymentData.razorpay_payment_id;
        razorpay_order_id   = paymentData.razorpay_order_id;
        razorpay_signature  = paymentData.razorpay_signature;
      }

      setStep('verifying');

      // ── Step 3: Verify HMAC signature on backend + create chat + Zego room ───
      const verifyRes = await paymentAPI.verifyPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        bookingId,
      });

      if (verifyRes.data?.success) {
        const respData = verifyRes.data?.data || {};
        const updatedBooking = respData.booking;
        const chatId    = updatedBooking?.chat || respData.chatId;
        const zegoRoomId = updatedBooking?.videoRoomId || respData.zegoRoomId || null;
        const zegoToken  = updatedBooking?.videoRoomToken || respData.zegoToken || null;
        const zegoAppId  = updatedBooking?.zegoAppId || respData.zegoAppId || 0;

        navigation.replace('PaymentSuccess', {
          amount: totalAmount,
          method: selectedMethod,
          chatId,
          advocateName,
          advocateAvatar,
          advocateId,
          bookingId,
          zegoRoomId,
          zegoToken,
          zegoAppId,
        });
      } else {
        throw new Error('Payment verification failed. Contact support if amount was deducted.');
      }
    } catch (error) {
      // User dismissed Razorpay modal — not an error
      if (error?.code === 'PAYMENT_CANCELLED' || error?.description?.includes('cancel')) {
        setLoading(false);
        setStep('select');
        return;
      }
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Payment could not be completed. Please try again.';
      Alert.alert('Payment Failed', msg);
    } finally {
      setLoading(false);
      setStep('select');
    }
  };

  const stepLabel = step === 'processing'
    ? 'Creating order…'
    : step === 'verifying'
    ? 'Verifying payment…'
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
          disabled={loading}
        >
          <Ionicons name="chevron-back" size={24} color={loading ? '#D1D5DB' : '#1F2937'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Razorpay Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>⚡ Razorpay</Text>
        </View>

        {/* Fee Breakdown Card */}
        <View style={styles.feeCard}>
          <FeeRow label="Consultation Fee" value={`₹${consultationFee}/-`} />
          <FeeRow label="Platform Fee" value={`₹${platformFee}/-`} />

          <View style={styles.divider} />

          <FeeRow label="Total" value={`₹${totalAmount}/-`} bold />
        </View>

        {/* Payment Methods Section */}
        <Text style={styles.sectionTitle}>Pay ₹{totalAmount}/-</Text>

        <View style={styles.methodsContainer}>
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                selectedMethod === method.id && styles.methodCardSelected,
              ]}
              onPress={() => setSelectedMethod(method.id)}
              activeOpacity={0.7}
              disabled={loading}
            >
              <View style={styles.methodIcon}>
                <Ionicons name={method.icon} size={20} color={COLORS.primary} />
              </View>

              <View style={styles.methodContent}>
                <Text style={styles.methodTitle}>{method.title}</Text>
                <Text style={styles.methodSubtitle}>{method.subtitle}</Text>
              </View>

              {selectedMethod === method.id ? (
                <View style={styles.radioSelected}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Spacer */}
        <View style={{ flex: 1, minHeight: 40 }} />
      </ScrollView>

      {/* Pay Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.payButton,
            (!selectedMethod || loading) && styles.payButtonDisabled,
          ]}
          onPress={handlePayment}
          disabled={!selectedMethod || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              {stepLabel && <Text style={styles.payButtonText}>{stepLabel}</Text>}
            </View>
          ) : (
            <Text style={styles.payButtonText}>Pay ₹{totalAmount}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// Fee Row Component
const FeeRow = ({ label, value, bold = false }) => (
  <View style={styles.feeRow}>
    <Text style={[styles.feeLabel, bold && styles.feeLabelBold]}>
      {label}
    </Text>
    <Text style={[styles.feeValue, bold && styles.feeValueBold]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  feeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feeLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  feeLabelBold: {
    fontWeight: '700',
    color: '#1F2937',
  },
  feeValue: {
    fontSize: 14,
    color: '#1F2937',
  },
  feeValueBold: {
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  methodsContainer: {
    gap: 12,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDFA',
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodContent: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  methodSubtitle: {
    fontSize: 11,
    color: '#6B7280',
  },
  radioSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  payButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payButtonDisabled: {
    backgroundColor: '#D1D5DB',
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PaymentScreen;
