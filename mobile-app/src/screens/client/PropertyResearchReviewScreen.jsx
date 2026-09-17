// screens/client/PropertyResearchReviewScreen.jsx
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
import { SHADOWS } from '../../constants/theme';

const PRIMARY_BEIGE = '#C2A98B';

export default function PropertyResearchReviewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { propertyData } = route.params || {};

  if (!propertyData) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text>Property details are unavailable. Please return to the form.</Text>
      </View>
    );
  }

  const handleProceedToPayment = () => {
    navigation.navigate('PropertyResearchPayment', { propertyData });
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
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Request</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 3-Step Progress Indicator (Step 2 Active) */}
      <View style={styles.progressContainer}>
        <View style={styles.stepItem}>
          <View style={[styles.stepBadge, styles.stepBadgeDone]}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelDone]}>Your Details</Text>
        </View>

        <View style={[styles.stepConnectorLine, styles.stepConnectorDone]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepBadge, styles.stepBadgeActive]}>
            <Text style={styles.stepBadgeTextActive}>2</Text>
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelActive]}>Confirmation</Text>
        </View>

        <View style={styles.stepConnectorLine} />

        <View style={styles.stepItem}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>3</Text>
          </View>
          <Text style={styles.stepLabel}>Payment</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Property Details Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="document-text-outline" size={20} color={PRIMARY_BEIGE} />
              <Text style={styles.cardHeaderTitle}>Property Details</Text>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color={PRIMARY_BEIGE} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Applicant Info */}
          <DetailRow label="Full Name" value={propertyData.fullName} />
          <DetailRow label="Phone Number" value={propertyData.phone} />
          <DetailRow label="Email Address" value={propertyData.email} />

          <View style={styles.subDivider} />

          {/* Property Info */}
          <DetailRow label="Property Address" value={propertyData.address} multiline />
          <DetailRow label="City / State" value={`${propertyData.city}, ${propertyData.state}`} />
          <DetailRow label="Pincode" value={propertyData.pincode} />
          <DetailRow label="Property Type" value={propertyData.propertyType} isBadge />
          <DetailRow label="Purpose of Report" value={propertyData.purpose} isBadge />
        </View>

        {/* Estimated Delivery & Verification Badge Card */}
        <View style={styles.deliveryCard}>
          <View style={styles.deliveryRow}>
            <View style={styles.deliveryIconBg}>
              <Ionicons name="time" size={24} color={PRIMARY_BEIGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deliveryTitle}>Estimated Delivery</Text>
              <Text style={styles.deliverySubtitle}>3–5 Working Days</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-seal" size={14} color="#FFFFFF" />
              <Text style={styles.verifiedBadgeText}>Verified by Legalitt</Text>
            </View>
          </View>
        </View>

        {/* Guarantee Info Box */}
        <View style={styles.guaranteeBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#64748B" />
          <Text style={styles.guaranteeText}>
            Our experienced property advocate team will directly pull records from local sub-registrar offices.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Sticky Button */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleProceedToPayment}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Proceed to Payment</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DetailRow({ label, value, multiline = false, isBadge = false }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      {isBadge ? (
        <View style={styles.valueBadge}>
          <Text style={styles.valueBadgeText}>{value}</Text>
        </View>
      ) : (
        <Text style={[styles.detailValue, multiline && styles.detailValueMultiline]}>
          {value || 'N/A'}
        </Text>
      )}
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    ...SHADOWS.medium,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_BEIGE,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  subDivider: {
    height: 1,
    backgroundColor: '#F8FAFC',
    marginVertical: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'right',
    flex: 1.2,
  },
  detailValueMultiline: {
    lineHeight: 18,
  },
  valueBadge: {
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  valueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_BEIGE,
  },
  deliveryCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deliveryIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  deliveryTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  deliverySubtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guaranteeText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
    lineHeight: 17,
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
  primaryButton: {
    backgroundColor: PRIMARY_BEIGE,
    height: 54,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.medium,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
