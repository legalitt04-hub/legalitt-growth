// screens/client/DocumentForensicTrackScreen.jsx
import React, { useEffect, useState } from 'react';
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
import { bookingAPI } from '../../services/api';

const PALETTE = {
  pageBg: '#FFFFFF', cardBg: '#F5EFEB', cardBorder: '#E8DFD5', securityCardBg: '#FAF5EE',
  securityCardBorder: '#EFE3D3', iconCircleBg: '#E9DFC2', completedGreen: '#16A34A',
  completedGreenLine: '#16A34A', activeTan: '#8C6E52', pendingBorder: '#D8CDC0',
  pendingText: '#A89F95', pendingTitle: '#8C8278', inProgressBadgeBg: '#FEF3C7',
  inProgressBadgeText: '#92400E', inProgressBadgeBorder: '#FDE68A', primaryButton: '#8C6E52',
  textHeading: '#2A241E', textBody: '#453B32', textMuted: '#766D64', textSubtitle: '#8C8278',
  dividerColor: '#E0D4C5', lineInactive: '#DCD4C8',
};

export default function DocumentForensicTrackScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const bookingId = route?.params?.bookingId;
  const passedRequestId = route?.params?.requestId;
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId) {
      setError('A valid forensic request ID is required.');
      setLoading(false);
      return;
    }
    let mounted = true;
    bookingAPI.getBooking(bookingId)
      .then(({ data }) => {
        if (mounted && data?.success) setBooking(data.data);
      })
      .catch(err => mounted && setError(err?.response?.data?.message || 'Unable to load forensic request.'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [bookingId]);

  const requestId = passedRequestId || (bookingId ? `#DF-${bookingId.slice(-6).toUpperCase()}` : 'Not available');
  const documents = [...(booking?.advocateDocuments || []), ...(booking?.adminDocuments || [])];
  const reportReady = documents.length > 0;
  const completed = booking?.status === 'completed';
  const analysisActive = ['confirmed', 'in_progress'].includes(booking?.status);
  const formatTime = value => value ? new Date(value).toLocaleString('en-IN') : 'Not recorded';

  const openReport = () => {
    if (!reportReady) {
      Alert.alert('Report Pending', 'The forensic report has not been uploaded yet.');
      return;
    }
    navigation.navigate('DocumentViewer', {
      documents,
      hasDocument: true,
      fileName: documents[0]?.name || 'Forensic Report',
      caseTitle: `Forensic Request ${requestId}`,
    });
  };

  const Step = ({ title, state, subtitle, last = false }) => (
    <View style={styles.timelineStepRow}>
      <View style={styles.timelineColLeft}>
        {state === 'completed' ? (
          <View style={styles.completedCircle}><Ionicons name="checkmark" size={16} color="#FFFFFF" /></View>
        ) : state === 'active' ? (
          <View style={styles.activeCircle}><View style={styles.activeInnerDot} /></View>
        ) : <View style={styles.pendingCircle} />}
        {!last && <View style={state === 'completed' ? styles.completedVerticalLine : styles.inactiveVerticalLine} />}
      </View>
      <View style={styles.timelineColRight}>
        <Text style={state === 'completed' ? styles.stepTitleCompleted : state === 'active' ? styles.stepTitleActive : styles.stepTitlePending}>{title}</Text>
        <Text style={state === 'completed' ? styles.stepSubtitle : state === 'active' ? styles.stepSubtitleActive : styles.stepSubtitlePending}>{subtitle}</Text>
      </View>
    </View>
  );

  if (loading || error || !booking) {
    return (
      <View style={[styles.container, { backgroundColor: PALETTE.pageBg, alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        {loading ? <ActivityIndicator color={PALETTE.primaryButton} /> : <Text style={{ color: PALETTE.textBody, textAlign: 'center' }}>{error || 'Request not found.'}</Text>}
      </View>
    );
  }

  const displayStatus = String(booking.status || 'pending_assignment').replace(/_/g, ' ');
  return (
    <View style={[styles.container, { backgroundColor: PALETTE.pageBg }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={PALETTE.textHeading} />
        </TouchableOpacity>
        <View style={styles.headerCenter}><Text style={styles.headerTitle}>Track Analysis</Text></View>
        <View style={styles.headerRight} />
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 30 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.requestCard}>
          <View style={styles.requestIconBox}><Ionicons name="document-text-outline" size={20} color={PALETTE.primaryButton} /></View>
          <View style={styles.requestTextCol}><Text style={styles.requestLabel}>Request ID</Text><Text style={styles.requestValue}>{requestId}</Text></View>
          <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>{displayStatus}</Text></View>
        </View>
        <Text style={styles.timelineHeading}>Analysis Progress</Text>
        <View style={styles.timelineCard}>
          <Step title="Payment Received" state={booking.payment?.status === 'paid' ? 'completed' : 'pending'} subtitle={formatTime(booking.payment?.paidAt)} />
          <Step title="Document Uploaded" state={(booking.documents || []).length ? 'completed' : 'pending'} subtitle={(booking.documents || []).length ? `${booking.documents.length} document(s)` : 'Pending'} />
          <Step title="Forensic Analysis" state={completed ? 'completed' : analysisActive ? 'active' : 'pending'} subtitle={completed ? 'Completed' : analysisActive ? 'In progress' : 'Awaiting assignment'} />
          <Step title="Expert Review" state={completed ? 'completed' : booking.status === 'in_progress' ? 'active' : 'pending'} subtitle={completed ? 'Completed' : booking.status === 'in_progress' ? 'In progress' : 'Pending'} />
          <Step title="Report Ready" state={reportReady ? 'completed' : 'pending'} subtitle={reportReady ? `${documents.length} report document(s)` : 'Pending'} last />
        </View>
        {reportReady && (
          <TouchableOpacity style={styles.contactSupportBtn} onPress={openReport} activeOpacity={0.8}>
            <Ionicons name="document-text-outline" size={18} color={PALETTE.primaryButton} style={styles.supportIcon} />
            <Text style={styles.contactSupportBtnText}>View Forensic Report</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.contactSupportBtn} onPress={() => navigation.navigate('Support')} activeOpacity={0.8}>
          <Ionicons name="headset-outline" size={18} color={PALETTE.primaryButton} style={styles.supportIcon} />
          <Text style={styles.contactSupportBtnText}>Contact Support</Text>
        </TouchableOpacity>
        <View style={styles.securityCard}>
          <View style={styles.securityIconBox}><Ionicons name="lock-closed" size={18} color={PALETTE.primaryButton} /></View>
          <View style={styles.securityTextCol}>
            <Text style={styles.securityHeading}>Confidential & Secure</Text>
            <Text style={styles.securityDesc}>Your documents are available only to authorized participants.</Text>
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

  // ── Request Card
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#8C6E52',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  requestIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PALETTE.iconCircleBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  requestTextCol: {
    flex: 1,
  },
  requestLabel: {
    fontSize: 11,
    color: PALETTE.textMuted,
    fontWeight: '500',
  },
  requestValue: {
    fontSize: 14.5,
    fontWeight: '700',
    color: PALETTE.textHeading,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: PALETTE.inProgressBadgeBg,
    borderWidth: 1,
    borderColor: PALETTE.inProgressBadgeBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: PALETTE.inProgressBadgeText,
  },

  // ── Timeline Section
  timelineHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.textHeading,
    marginTop: 20,
    marginBottom: 12,
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  timelineStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineColLeft: {
    alignItems: 'center',
    width: 28,
    marginRight: 14,
  },
  timelineColRight: {
    flex: 1,
    paddingBottom: 22,
    justifyContent: 'center',
  },

  // Step Indicators
  completedCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PALETTE.completedGreen,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  completedVerticalLine: {
    width: 2,
    height: 38,
    backgroundColor: PALETTE.completedGreenLine,
    marginVertical: -1,
  },
  activeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PALETTE.activeTan,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 3,
    borderColor: '#EFE8DD',
  },
  activeInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  inactiveVerticalLine: {
    width: 2,
    height: 38,
    backgroundColor: PALETTE.lineInactive,
    marginVertical: -1,
  },
  pendingCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PALETTE.pendingBorder,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },

  // Step Typography
  stepTitleCompleted: {
    fontSize: 13.5,
    fontWeight: '700',
    color: PALETTE.textHeading,
  },
  stepSubtitle: {
    fontSize: 11.5,
    color: PALETTE.textMuted,
    marginTop: 2,
  },
  stepTitleActive: {
    fontSize: 13.5,
    fontWeight: '700',
    color: PALETTE.activeTan,
  },
  stepSubtitleActive: {
    fontSize: 11.5,
    fontWeight: '600',
    color: PALETTE.activeTan,
    marginTop: 2,
  },
  stepTitlePending: {
    fontSize: 13.5,
    fontWeight: '600',
    color: PALETTE.pendingTitle,
  },
  stepSubtitlePending: {
    fontSize: 11.5,
    color: PALETTE.pendingText,
    marginTop: 2,
  },

  // ── Contact Support Button
  contactSupportBtn: {
    backgroundColor: '#FFFFFF',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.primaryButton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  supportIcon: {
    marginRight: 8,
  },
  contactSupportBtnText: {
    color: PALETTE.primaryButton,
    fontSize: 14.5,
    fontWeight: '700',
  },

  // ── Security Card
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.securityCardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.securityCardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 14,
    gap: 12,
  },
  securityIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PALETTE.iconCircleBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTextCol: {
    flex: 1,
  },
  securityHeading: {
    fontSize: 13.5,
    fontWeight: '700',
    color: PALETTE.textHeading,
    marginBottom: 2,
  },
  securityDesc: {
    fontSize: 11.5,
    color: PALETTE.textMuted,
    lineHeight: 16,
  },
});
