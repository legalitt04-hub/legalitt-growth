// screens/client/PropertyResearchPaymentScreen.jsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS } from '../../constants/theme';
import { legalAdviceAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import RazorpayCheckout from 'react-native-razorpay';
import Constants from 'expo-constants';

const PRIMARY_BEIGE = '#C2A98B';

const PAYMENT_METHODS = [
  { id: 'upi', name: 'UPI', subtitle: 'Google Pay, PhonePe, Paytm', icon: 'qr-code-outline' },
  { id: 'credit', name: 'Credit Card', subtitle: 'Visa, Mastercard, RuPay', icon: 'card-outline' },
  { id: 'debit', name: 'Debit Card', subtitle: 'All major Indian banks', icon: 'card' },
  { id: 'netbanking', name: 'Net Banking', subtitle: 'HDFC, SBI, ICICI, Axis & more', icon: 'business-outline' },
  { id: 'wallet', name: 'Wallet', subtitle: 'Airtel Money, Mobikwik', icon: 'wallet-outline' },
];

export default function PropertyResearchPaymentScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { propertyData } = route.params || {};
  const { isAuthenticated } = useAuth();

  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [processing, setProcessing] = useState(false);

  const requestId = '#PR-' + Math.floor(100000 + Math.random() * 900000);

  const handlePayAndStart = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        '🔐 Login Required',
        'Please login to submit your Property Research request.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login Now', onPress: () => navigation.navigate('LoginRegister', { role: 'client' }) },
        ]
      );
      return;
    }

    setProcessing(true);
    try {
      const RAZORPAY_KEY = Constants.expoConfig?.extra?.RAZORPAY_KEY_ID || 'rzp_test_SeC9MGzYmAerqz';
      const AMOUNT_PAISE = 299900; // ₹2,999 in paise

      let paymentId;

      if (__DEV__) {
        // Dev bypass
        paymentId = 'pay_dev_pr_' + Math.random().toString(36).substring(2, 9);
      } else {
        // Real Razorpay payment
        const paymentData = await RazorpayCheckout.open({
          key: RAZORPAY_KEY,
          amount: AMOUNT_PAISE,
          currency: 'INR',
          name: 'Legalitt Legal Services',
          description: 'Property Research & Title Verification Report',
          prefill: { name: user?.name || '', email: user?.email || '' },
          notes: { requestId, serviceType: 'property_research' },
          theme: { color: '#C2A98B' },
        });
        paymentId = paymentData.razorpay_payment_id;
      }

      // Save to backend
      await legalAdviceAPI.createRequest({
        serviceType: 'property_research',
        consultationMode: 'chat',
        issueDescription: `Property Research Request\nAddress: ${propertyData?.propertyAddress || 'N/A'}\nType: ${propertyData?.propertyType || 'N/A'}\nDistrict: ${propertyData?.district || 'N/A'}, ${propertyData?.state || 'N/A'}\nPurpose: ${propertyData?.purpose || 'N/A'}`,
        issueCategory: 'property',
        amount: 2999,
        clientCity: propertyData?.district || '',
        requestId,
        propertyData,
        paymentMethod: selectedMethod,
        razorpayPaymentId: paymentId,
      });

      navigation.replace('PropertyResearchSuccess', {
        paymentStatus: 'SUCCESS',
        requestId,
        propertyData,
        amountPaid: '2,999',
      });
    } catch (err) {
      if (err?.code === 'PAYMENT_CANCELLED' || err?.description?.includes('cancel')) {
        return; // User dismissed — not an error
      }
      console.log('Property research payment error:', err?.message);
      Alert.alert('Payment Failed', err?.message || 'Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Navigation Header */}
      <View style={[styles.navHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          disabled={processing}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 3-Step Progress Indicator (Step 3 Active) */}
      <View style={styles.progressContainer}>
        <View style={styles.stepItem}>
          <View style={[styles.stepBadge, styles.stepBadgeDone]}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelDone]}>Your Details</Text>
        </View>

        <View style={[styles.stepConnectorLine, styles.stepConnectorDone]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepBadge, styles.stepBadgeDone]}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelDone]}>Confirmation</Text>
        </View>

        <View style={[styles.stepConnectorLine, styles.stepConnectorDone]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepBadge, styles.stepBadgeActive]}>
            <Text style={styles.stepBadgeTextActive}>3</Text>
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelActive]}>Payment</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Service Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.serviceHeaderRow}>
            <View style={styles.serviceBadgeIcon}>
              <Ionicons name="shield-checkmark" size={20} color={PRIMARY_BEIGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>Property Research Report</Text>
              <Text style={styles.requestIdText}>Request ID: {requestId}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Property Address</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {propertyData?.address || 'Plot 42, Green Avenue, Sector 5, Indore'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Property Type</Text>
            <Text style={styles.detailValue}>{propertyData?.propertyType || 'Residential'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estimated Delivery</Text>
            <Text style={styles.detailValueHighlight}>3–5 Working Days</Text>
          </View>
        </View>

        {/* Price Details Card */}
        <View style={styles.priceCard}>
          <Text style={styles.cardHeaderTitle}>Price Breakdown</Text>
          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service Fee</Text>
            <Text style={styles.priceValue}>₹ 2,499</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>GST (18%)</Text>
            <Text style={styles.priceValue}>₹ 450</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Platform Charges</Text>
            <Text style={styles.priceValue}>₹ 50</Text>
          </View>

          <View style={styles.totalDivider} />

          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹ 2,999</Text>
          </View>
        </View>

        {/* Payment Methods Selector */}
        <Text style={styles.sectionHeaderTitle}>Select Payment Method</Text>

        <View style={styles.methodsContainer}>
          {PAYMENT_METHODS.map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <TouchableOpacity
                key={method.id}
                style={[styles.methodCard, isSelected && styles.methodCardSelected]}
                onPress={() => setSelectedMethod(method.id)}
                activeOpacity={0.8}
                disabled={processing}
              >
                <View style={[styles.methodIconBg, isSelected && styles.methodIconBgSelected]}>
                  <Ionicons
                    name={method.icon}
                    size={20}
                    color={isSelected ? PRIMARY_BEIGE : '#64748B'}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.methodName}>{method.name}</Text>
                  <Text style={styles.methodSubtitle}>{method.subtitle}</Text>
                </View>

                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Sticky Payment Action */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.payButton, processing && styles.payButtonDisabled]}
          onPress={handlePayAndStart}
          activeOpacity={0.85}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.payButtonText}>Pay ₹ 2,999 & Start Verification</Text>
              <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark" size={14} color="#10B981" />
          <Text style={styles.securityText}>
            100% Secure Payment • Protected by encrypted payment gateway.
          </Text>
        </View>
      </View>
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8F5',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEAE2',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: {
    backgroundColor: '#10B981',
  },
  stepBadgeActive: {
    backgroundColor: PRIMARY_BEIGE,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  stepBadgeTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  stepLabelDone: {
    color: '#10B981',
  },
  stepLabelActive: {
    color: PRIMARY_BEIGE,
    fontWeight: '700',
  },
  stepConnectorLine: {
    width: 24,
    height: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 8,
  },
  stepConnectorDone: {
    backgroundColor: '#10B981',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  summaryCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  serviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  requestIdText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#EFEAE2',
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'right',
    maxWidth: '60%',
  },
  detailValueHighlight: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY_BEIGE,
  },
  priceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    ...SHADOWS.small,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  priceLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: PRIMARY_BEIGE,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  methodsContainer: {
    gap: 10,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
  },
  methodCardSelected: {
    borderColor: PRIMARY_BEIGE,
    backgroundColor: '#FAF8F5',
  },
  methodIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconBgSelected: {
    backgroundColor: '#FFFFFF',
  },
  methodName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  methodSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: PRIMARY_BEIGE,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY_BEIGE,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingTop: 12,
    ...SHADOWS.large,
  },
  payButton: {
    backgroundColor: PRIMARY_BEIGE,
    height: 54,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.medium,
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  securityText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
});
