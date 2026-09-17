// screens/client/PropertyResearchTrackScreen.jsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS } from '../../constants/theme';
import { bookingAPI } from '../../services/api';

const PRIMARY_BEIGE = '#C2A98B';

export default function PropertyResearchTrackScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bookingId, requestId } = route.params || {};
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId) {
      setError('A valid property research request is required.');
      setLoading(false);
      return;
    }
    let mounted = true;
    bookingAPI.getBooking(bookingId)
      .then(({ data }) => mounted && data?.success && setBooking(data.data))
      .catch(err => mounted && setError(err?.response?.data?.message || 'Unable to load this request.'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [bookingId]);

  if (loading || error || !booking) {
    return <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>{loading ? <ActivityIndicator color={PRIMARY_BEIGE} /> : <Text>{error || 'Request not found.'}</Text>}</View>;
  }

  const displayId = requestId || `PR-${bookingId.slice(-6).toUpperCase()}`;
  const documents = [...(booking.advocateDocuments || []), ...(booking.adminDocuments || [])];
  const paid = booking.payment?.status === 'paid';
  const assigned = !!booking.advocate;
  const active = ['confirmed', 'in_progress'].includes(booking.status);
  const completed = booking.status === 'completed';
  const submittedAt = booking.createdAt ? new Date(booking.createdAt).toLocaleString('en-IN') : 'Not recorded';
  const paidAt = booking.payment?.paidAt ? new Date(booking.payment.paidAt).toLocaleString('en-IN') : 'Pending';

  const openReport = () => {
    if (!documents.length) return Alert.alert('Report Pending', 'The property research report has not been uploaded yet.');
    navigation.navigate('DocumentViewer', { documents, hasDocument: true, fileName: documents[0]?.name || 'Property Research Report', caseTitle: `Property Research ${displayId}` });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={[styles.navHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#1F2937" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Track Your Request</Text><View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 90 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.cardTopRow}>
            <View><Text style={styles.requestIdLabel}>Request ID</Text><Text style={styles.requestIdValue}>{displayId}</Text></View>
            <View style={styles.statusBadge}><View style={styles.pulseDot} /><Text style={styles.statusBadgeText}>{String(booking.status).replace(/_/g, ' ')}</Text></View>
          </View>
          <View style={styles.divider} />
          <View style={styles.etaRow}><Ionicons name="location-outline" size={18} color={PRIMARY_BEIGE} /><Text style={styles.etaText}>{booking.propertyAddress || booking.clientCity || 'Location not provided'}</Text></View>
        </View>
        <Text style={styles.timelineSectionTitle}>Live Verification Progress</Text>
        <View style={styles.timelineContainer}>
          <TimelineItem status="completed" title="Request Submitted" timestamp={submittedAt} isFirst />
          <TimelineItem status={paid ? 'completed' : 'current'} title="Payment Received" timestamp={paidAt} />
          <TimelineItem status={assigned ? 'completed' : paid ? 'current' : 'upcoming'} title="Advocate Assigned" timestamp={assigned ? 'Assigned' : 'Pending assignment'} />
          <TimelineItem status={completed ? 'completed' : active ? 'current' : 'upcoming'} title="Property Verification" timestamp={completed ? 'Completed' : active ? 'In progress' : undefined} />
          <TimelineItem status={documents.length ? 'completed' : completed ? 'current' : 'upcoming'} title="Report Delivered" timestamp={documents.length ? `${documents.length} document(s) available` : 'Pending'} isLast />
        </View>
        {documents.length > 0 && <TouchableOpacity style={styles.supportButton} onPress={openReport}><Ionicons name="document-text" size={20} color="#FFFFFF" /><Text style={styles.supportButtonText}>View Report</Text></TouchableOpacity>}
      </ScrollView>
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.supportButton} onPress={() => navigation.navigate('Support')}><Ionicons name="headset" size={20} color="#FFFFFF" /><Text style={styles.supportButtonText}>Contact Support</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function TimelineItem({ status, title, timestamp, isFirst = false, isLast = false }) {
  const isCompleted = status === 'completed';
  const isCurrent = status === 'current';

  return (
    <View style={styles.timelineRow}>
      {/* Line & Icon Column */}
      <View style={styles.timelineLineColumn}>
        {!isFirst && <View style={[styles.lineUpper, (isCompleted || isCurrent) && styles.lineActive]} />}
        
        <View style={[styles.dotWrapper, isCompleted && styles.dotCompleted, isCurrent && styles.dotCurrent]}>
          {isCompleted && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
          {isCurrent && <View style={styles.innerPulseDot} />}
          {!isCompleted && !isCurrent && <View style={styles.dotUpcoming} />}
        </View>

        {!isLast && <View style={[styles.lineLower, isCompleted && styles.lineActive]} />}
      </View>

      {/* Content Column */}
      <View style={[styles.timelineContentCard, isCurrent && styles.timelineContentCardCurrent]}>
        <Text style={[styles.timelineTitle, isCurrent && styles.timelineTitleCurrent]}>
          {title}
        </Text>
        {timestamp && <Text style={styles.timelineTimestamp}>{timestamp}</Text>}
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
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    ...SHADOWS.small,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestIdLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  requestIdValue: {
    fontSize: 18,
    fontWeight: '800',
    color: PRIMARY_BEIGE,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  divider: {
    height: 1,
    backgroundColor: '#EFEAE2',
    marginVertical: 12,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  etaText: {
    fontSize: 13,
    color: '#475569',
  },
  etaBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  timelineSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  timelineContainer: {
    paddingLeft: 6,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 12,
  },
  timelineLineColumn: {
    width: 32,
    alignItems: 'center',
  },
  lineUpper: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
  },
  lineLower: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
  },
  lineActive: {
    backgroundColor: PRIMARY_BEIGE,
  },
  dotWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  dotCompleted: {
    backgroundColor: '#10B981',
  },
  dotCurrent: {
    backgroundColor: PRIMARY_BEIGE,
    ...SHADOWS.small,
  },
  dotUpcoming: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
  },
  innerPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  timelineContentCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineContentCardCurrent: {
    backgroundColor: '#FAF8F5',
    borderColor: PRIMARY_BEIGE,
    borderWidth: 1.5,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  timelineTitleCurrent: {
    color: '#0F172A',
    fontWeight: '700',
  },
  timelineTimestamp: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
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
  supportButton: {
    backgroundColor: PRIMARY_BEIGE,
    height: 54,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.medium,
  },
  supportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
