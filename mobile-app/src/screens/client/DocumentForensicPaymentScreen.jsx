import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { legalAdviceAPI, paymentAPI, uploadAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { usePricing } from '../../context/PricingContext';
import RazorpayCheckout from 'react-native-razorpay';

// ─── COLOR PALETTE ─────────────────────────────────────────────────────────────
const PALETTE = {
  pageBg: '#FFFFFF',
  cardBg: '#F5EFEB',
  cardBorder: '#E8DFD5',
  cardBgLight: '#FAF7F2',
  selectedCardBg: '#FAF6F0',
  selectedCardBorder: '#8C6E52',
  iconCircleBg: '#E9DFC2',
  primaryButton: '#8C6E52',
  primaryButtonText: '#FFFFFF',
  textHeading: '#2A241E',
  textBody: '#453B32',
  textMuted: '#766D64',
  textSubtitle: '#8C8278',
  dividerColor: '#E0D4C5',
  radioActive: '#8C6E52',
  radioInactive: '#D4C6B6',
  white: '#FFFFFF',
};

const PAYMENT_METHODS = [
  {
    id: 'upi',
    title: 'Pay using any UPI app',
    icon: 'phone-portrait-outline',
  },
  {
    id: 'card',
    title: 'Visa, MasterCard, Rupay',
    icon: 'card-outline',
  },
  {
    id: 'netbanking',
    title: 'All major banks supported',
    icon: 'business-outline',
  },
];

export default function DocumentForensicPaymentScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { document, documentType, additionalNotes } = route?.params || {};
  const { isAuthenticated, user } = useAuth();
  const { getPrice } = usePricing();

  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [processing, setProcessing] = useState(false);

  const totalPrice = getPrice('document_forensic', 2999);
  const platformFee = 199;
  const taxableAmount = Math.max(0, Math.round((totalPrice - platformFee) / 1.18));
  const gstAmount = totalPrice - platformFee - taxableAmount;

  const handlePayAndStart = async () => {
    // Auth gate
    if (!isAuthenticated) {
      Alert.alert(
        '🔐 Login Required',
        'Please login to submit your Document Forensic request.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login Now', onPress: () => navigation.navigate('LoginRegister', { role: 'client' }) },
        ]
      );
      return;
    }

    setProcessing(true);
    try {
      if (!document?.uri) {
        throw new Error('Please select a document before continuing.');
      }

      const uploadRes = await uploadAPI.uploadFile(
        document.uri,
        document.name || 'forensic_document',
        document.mimeType || 'application/octet-stream'
      );
      const uploaded = uploadRes.data?.data;
      if (!uploaded?.url) throw new Error('The document upload did not complete.');

      const bookingRes = await legalAdviceAPI.createRequest({
        serviceType: 'document_forensic',
        consultationMode: 'chat',
        issueDescription: `[forensic] Document Forensic Analysis Request\nDocument: ${document?.name || 'N/A'}\nType: ${documentType || 'N/A'}\nNotes: ${additionalNotes || 'None'}`,
        issueCategory: 'forensic',
        documentName: document?.name,
        documentType,
        documents: [{
          url: uploaded.url,
          name: uploaded.name || document.name || 'Forensic Document',
          type: document.mimeType || 'document',
        }],
      });

      const { bookingId, amount: bookingAmount } = bookingRes.data.data;
      const orderRes = await paymentAPI.createOrder(bookingId);
      const { orderId, amount: orderAmount, currency, keyId } = orderRes.data.data;

      const paymentData = await RazorpayCheckout.open({
        description: 'Document Forensic Analysis',
        currency: currency || 'INR',
        key: keyId,
        amount: orderAmount,
        name: 'Legalitt',
        order_id: orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: { color: PALETTE.primaryButton },
      });

      await legalAdviceAPI.confirmPayment({
        bookingId,
        razorpayOrderId: paymentData.razorpay_order_id,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySignature: paymentData.razorpay_signature,
      });

      navigation.navigate('DocumentForensicSuccess', {
        requestId: `#DF-${bookingId.slice(-6).toUpperCase()}`,
        bookingId,
        document,
        documentType,
        totalAmount: `₹${bookingAmount}/-`,
      });
    } catch (err) {
      if (err?.code === 'PAYMENT_CANCELLED' || err?.code === 2 || err?.description?.toLowerCase?.().includes('cancel')) {
        Alert.alert('Payment Cancelled', 'Your payment was not completed. You can try again when ready.');
      } else {
        const message = err?.response?.data?.message || err?.message || 'Could not submit your request.';
        console.log('Forensic request error:', message);
        Alert.alert('Request Not Completed', message);
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: PALETTE.pageBg }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          disabled={processing}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={PALETTE.textHeading} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Complete Payment</Text>
        </View>

        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 30 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 1. SERVICE SUMMARY CARD ──────────────────────────────────── */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardSectionHeading}>Service Summary</Text>

          <View style={styles.serviceRow}>
            <View style={styles.serviceIconCircle}>
              <Ionicons name="business-outline" size={20} color={PALETTE.primaryButton} />
            </View>
            <View style={styles.serviceTextCol}>
              <Text style={styles.serviceTitle}>Online Documents Forensic</Text>
              <Text style={styles.serviceSubtitle}>
                Comprehensive forensic analysis and{'\n'}expert verification
              </Text>
            </View>
          </View>
        </View>

        {/* ─── 2. PRICE CARD ────────────────────────────────────────────── */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardSectionHeading}>
            Professional Document Analysis
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service Fee</Text>
            <Text style={styles.priceValue}>₹{taxableAmount}/-</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>GST (18%)</Text>
            <Text style={styles.priceValue}>₹{gstAmount}/-</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Platform fee</Text>
            <Text style={styles.priceValue}>₹{platformFee}/-</Text>
          </View>

          <View style={styles.priceDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{totalPrice}/-</Text>
          </View>
        </View>

        {/* ─── 3. PAYMENT METHODS ───────────────────────────────────────── */}
        <Text style={styles.paymentMethodsHeading}>Select Payment Method</Text>

        <View style={styles.methodsList}>
          {PAYMENT_METHODS.map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodCard,
                  isSelected && styles.methodCardSelected,
                ]}
                onPress={() => setSelectedMethod(method.id)}
                activeOpacity={0.8}
              >
                <View style={styles.methodIconBox}>
                  <Ionicons
                    name={method.icon}
                    size={20}
                    color={isSelected ? PALETTE.primaryButton : PALETTE.textBody}
                  />
                </View>
                <Text style={styles.methodTitle}>{method.title}</Text>
                <View
                  style={[
                    styles.radioCircle,
                    isSelected && styles.radioCircleSelected,
                  ]}
                >
                  {isSelected && <View style={styles.radioInnerDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── 4. PAY BUTTON & SECURITY MESSAGE ─────────────────────────── */}
        <View style={styles.bottomActionSection}>
          <TouchableOpacity
            style={[styles.payButton, processing && styles.payButtonDisabled]}
            onPress={handlePayAndStart}
            activeOpacity={0.85}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.payButtonText}>Pay & Start Analysis</Text>
            )}
          </TouchableOpacity>

          {/* Security Message */}
          <View style={styles.securityMessageRow}>
            <Ionicons name="shield-checkmark-outline" size={15} color={PALETTE.textMuted} />
            <Text style={styles.securityMessageText}>
              Your information is safe with us and will never be shared
            </Text>
          </View>
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
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
  },
  backBtn: {
    padding: 4,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: PALETTE.textHeading,
    letterSpacing: 0.1,
  },
  headerRight: {
    width: 28,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // ── Large Beige Cards
  cardContainer: {
    backgroundColor: PALETTE.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
    shadowColor: '#8C6E52',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  cardSectionHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    color: PALETTE.textHeading,
    marginBottom: 10,
    letterSpacing: -0.1,
  },

  // ── Service Row
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PALETTE.iconCircleBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTextCol: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.textHeading,
  },
  serviceSubtitle: {
    fontSize: 12,
    color: PALETTE.textMuted,
    lineHeight: 17,
    marginTop: 2,
  },

  // ── Price Rows
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  priceLabel: {
    fontSize: 13,
    color: PALETTE.textMuted,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 13.5,
    color: PALETTE.textHeading,
    fontWeight: '600',
  },
  priceDivider: {
    height: 1,
    backgroundColor: PALETTE.dividerColor,
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  totalLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    color: PALETTE.textHeading,
  },
  totalValue: {
    fontSize: 15.5,
    fontWeight: '700',
    color: PALETTE.textHeading,
  },

  // ── Payment Methods
  paymentMethodsHeading: {
    fontSize: 14.5,
    fontWeight: '700',
    color: PALETTE.textHeading,
    marginTop: 8,
    marginBottom: 10,
  },
  methodsList: {
    gap: 10,
    marginBottom: 20,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  methodCardSelected: {
    backgroundColor: PALETTE.selectedCardBg,
    borderColor: PALETTE.selectedCardBorder,
    borderWidth: 1.5,
  },
  methodIconBox: {
    marginRight: 12,
  },
  methodTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: PALETTE.textHeading,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PALETTE.radioInactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: PALETTE.radioActive,
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PALETTE.radioActive,
  },

  // ── Bottom Action Section
  bottomActionSection: {
    marginTop: 10,
    alignItems: 'center',
  },
  payButton: {
    backgroundColor: PALETTE.primaryButton,
    height: 50,
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
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    color: PALETTE.primaryButtonText,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  securityMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
  },
  securityMessageText: {
    fontSize: 11.5,
    color: PALETTE.textMuted,
    textAlign: 'center',
  },
});
