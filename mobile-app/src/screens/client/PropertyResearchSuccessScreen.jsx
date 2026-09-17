// screens/client/PropertyResearchSuccessScreen.jsx
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

export default function PropertyResearchSuccessScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { requestId, bookingId, propertyData } = route.params || {};

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 24) + 10, paddingBottom: Math.max(insets.bottom, 24) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Animated Green Success Header */}
        <View style={styles.successHeader}>
          <View style={styles.successIconOuter}>
            <View style={styles.successIconInner}>
              <Ionicons name="checkmark" size={44} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.heading}>Request Submitted Successfully!</Text>
          <Text style={styles.subtitle}>
            Your Property Research Report request has been successfully received and confirmed.
          </Text>
        </View>

        {/* Request Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="receipt-outline" size={20} color={PRIMARY_BEIGE} />
            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Request ID</Text>
            <Text style={styles.detailValueHighlight}>{requestId || (bookingId ? `PR-${bookingId.slice(-6).toUpperCase()}` : 'Not available')}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Property Address</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {propertyData?.propertyAddress || propertyData?.address || 'Not provided'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estimated Delivery</Text>
            <Text style={styles.detailValue}>3–5 Working Days</Text>
          </View>
        </View>

        {/* What Happens Next Section */}
        <View style={styles.nextSectionCard}>
          <Text style={styles.nextSectionTitle}>What Happens Next?</Text>
          <View style={styles.divider} />

          <View style={styles.stepRow}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.stepText}>Payment Confirmed</Text>
          </View>

          <View style={styles.stepRow}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.stepText}>Property verification assigned to legal experts</Text>
          </View>

          <View style={styles.stepRow}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.stepText}>Government records verification begins</Text>
          </View>

          <View style={styles.stepRow}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.stepText}>Report preparation starts</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            navigation.navigate('PropertyResearchTrack', { bookingId, requestId, propertyData })
          }
          activeOpacity={0.85}
        >
          <Ionicons name="stats-chart" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Track Request</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate('PropertyResearchChecklist', { paymentStatus: 'SUCCESS' })
          }
          activeOpacity={0.8}
        >
          <Ionicons name="list-circle-outline" size={20} color={PRIMARY_BEIGE} />
          <Text style={styles.secondaryButtonText}>What We Are Checking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tertiaryButton}
          onPress={() => navigation.navigate('ClientMain', { screen: 'Home' })}
          activeOpacity={0.7}
        >
          <Text style={styles.tertiaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  summaryCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: '#EFEAE2',
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
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
  nextSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    ...SHADOWS.small,
  },
  nextSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  primaryButton: {
    backgroundColor: PRIMARY_BEIGE,
    height: 54,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    ...SHADOWS.medium,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    height: 50,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FAF8F5',
    borderWidth: 1.5,
    borderColor: PRIMARY_BEIGE,
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_BEIGE,
  },
  tertiaryButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
});
