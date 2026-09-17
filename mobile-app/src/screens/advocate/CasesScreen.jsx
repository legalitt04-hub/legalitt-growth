import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { bookingAPI } from '../../services/api';
import { COLORS } from '../../constants/theme';
import { formatDate } from '../../utils/helpers';
import SkeletonLoader from '../../components/common/SkeletonLoader';

import { getSocket } from '../../services/socket';

const REQUEST_TABS = ['All', 'Pending', 'Accepted', 'Rejected'];

const CasesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // ─── Today's Cases State ───────────────────────────────────────────────────
  const [todayCases, setTodayCases] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);

  // ─── Case Requests State (Default to 'Pending' as requested) ───────────────
  const [activeRequestTab, setActiveRequestTab] = useState('Pending');
  const [caseRequests, setCaseRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  // ─── Data Fetching ─────────────────────────────────────────────────────────
  const fetchTodayCases = async () => {
    try {
      if (todayCases.length === 0) setLoadingToday(true);
      const response = await bookingAPI.getAdvocateBookings({ today: 'true', status: 'confirmed' });
      if (response.data?.success) {
        setTodayCases(response.data.data || []);
      } else {
        setTodayCases([]);
      }
    } catch (err) {
      console.log('Error fetching today cases:', err?.message);
      setTodayCases([]);
    } finally {
      setLoadingToday(false);
    }
  };

  const fetchCaseRequests = async (tab = activeRequestTab) => {
    try {
      if (caseRequests.length === 0) setLoadingRequests(true);
      const statusMap = {
        All: undefined,
        Pending: 'pending',
        Accepted: 'confirmed',
        Rejected: 'cancelled',
      };
      const response = await bookingAPI.getAdvocateBookings({ status: statusMap[tab] });
      if (response.data?.success) {
        setCaseRequests(response.data.data || []);
      } else {
        setCaseRequests([]);
      }
    } catch (err) {
      console.log('Error fetching case requests:', err?.message);
      setCaseRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadAllData = useCallback(async () => {
    await Promise.all([fetchTodayCases(), fetchCaseRequests(activeRequestTab)]);
  }, [activeRequestTab]);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadAllData();
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      else if (unsubscribe?.remove) unsubscribe.remove();
    };
  }, [navigation, loadAllData]);

  useEffect(() => {
    fetchCaseRequests(activeRequestTab);
  }, [activeRequestTab]);

  // Real-time socket listener for assigned bookings
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewRequest = () => {
      loadAllData();
    };

    socket.on('new_case_request', handleNewRequest);
    socket.on('new_booking_assigned', handleNewRequest);

    return () => {
      socket?.off?.('new_case_request', handleNewRequest);
      socket?.off?.('new_booking_assigned', handleNewRequest);
    };
  }, [loadAllData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTodayCases(), fetchCaseRequests(activeRequestTab)]);
    setRefreshing(false);
  };

  // ─── Case Request Action Handlers (Accept / Reject) ────────────────────────
  const handleRequestAction = async (bookingId, action) => {
    try {
      const targetStatus = action === 'accept' ? 'confirmed' : 'cancelled';
      await bookingAPI.updateStatus(bookingId, { status: targetStatus });

      // Emit socket event so client's app updates in real-time
      const socket = getSocket();
      if (socket) {
        socket.emit('booking_status_changed', { bookingId, status: targetStatus });
      }

      Alert.alert(
        'Success',
        action === 'accept'
          ? '✅ Consultation request accepted!'
          : 'Consultation request declined.'
      );
      // Refresh both lists
      fetchTodayCases();
      fetchCaseRequests(activeRequestTab);
    } catch (err) {
      console.error('handleRequestAction error:', err?.message);
      Alert.alert('Error', 'Could not update status. Please try again.');
    }
  };


  const handleNavigateToCase = (item) => {
    const caseId = item.caseId || item._id;
    if (!caseId) {
      Alert.alert('Case Unavailable', 'This case does not have a valid identifier.');
      return;
    }
    navigation.navigate('CaseDetail', {
      caseId,
      booking: item,
      client: item.client,
      clientName: item.client?.name || 'Client',
      caseTitle: item.issue || item.caseType || 'Legal matter',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ─── SINGLE PAGE HEADER: CASES ────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cases</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('ChatList')}
            style={styles.headerIconBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.headerIconBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 12) + 115 },
        ]}
      >
        {/* ─── SECTION 1: TODAY'S CASES ───────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Today's Cases</Text>
        </View>

        {loadingToday ? (
          <View style={{ paddingVertical: 10 }}>
            <SkeletonLoader type="card" count={1} />
          </View>
        ) : todayCases.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>⚖️</Text>
            <Text style={styles.emptyText}>No appointments scheduled for today</Text>
          </View>
        ) : (
          <View style={styles.cardsList}>
            {todayCases.map((item) => {
              const client = item.client || {};
              return (
                <View key={item._id} style={styles.card}>
                  <View style={styles.cardContent}>
                    {/* Avatar */}
                    {client.avatar ? (
                      <Image source={{ uri: client.avatar }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitial}>
                          {(client.name || 'R')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.textContent}>
                      <View style={styles.nameRow}>
                        <Text style={styles.cardTitle}>{client.name || 'Client'}</Text>
                        {client.isVerified !== false && (
                          <Ionicons name="checkmark-circle" size={15} color={COLORS.primary} />
                        )}
                      </View>
                      <Text style={styles.caseType}>{item.issue || `${item.serviceType ? item.serviceType.replace('_', ' ').toUpperCase() : 'Legal'} Request`}</Text>
                      <Text style={styles.consultationLabel}>
                        {(item.consultationMode || item.type || 'Chat').toUpperCase()} Consultation
                      </Text>
                      <View style={styles.timeRow}>
                        <Ionicons name="time-outline" size={13} color={COLORS.primary} />
                        <Text style={styles.timeText}>
                          Today • {item.timeSlot?.startTime || formatDate(item.createdAt, 'time')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.viewCaseBtn}
                    activeOpacity={0.8}
                    onPress={() => handleNavigateToCase(item)}
                  >
                    <Text style={styles.viewCaseBtnText}>View Case</Text>
                    <Ionicons name="chevron-forward" size={15} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ─── SECTION 2: CASE REQUESTS ───────────────────────────────────── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text style={styles.sectionHeading}>Case Requests</Text>
        </View>

        {/* Filter Tabs (All, Pending, Accepted, Rejected) */}
        <View style={styles.tabContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScrollWrap}
          >
            <View style={styles.tabRow}>
              {REQUEST_TABS.map((tab) => {
                const isActive = activeRequestTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveRequestTab(tab)}
                    activeOpacity={0.8}
                    style={[styles.tab, isActive && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Case Requests List / Empty State */}
        {loadingRequests ? (
          <View style={{ paddingVertical: 10 }}>
            <SkeletonLoader type="card" count={2} />
          </View>
        ) : caseRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No requests in {activeRequestTab}</Text>
          </View>
        ) : (
          <View style={styles.cardsList}>
            {caseRequests.map((item) => {
              const statusStr = (item.status || 'pending').toLowerCase();
              const isPending = statusStr === 'pending';
              const isAccepted = statusStr === 'accepted' || statusStr === 'confirmed';
              const isRejected = statusStr === 'rejected' || statusStr === 'cancelled';
              const client = item.client || {};

              const svcLabel = {
                legal_advice: 'Legal Advice',
                legal_notice: 'Legal Notice',
                property_research: 'Property Research',
                document_forensic: 'Document Forensic',
                fir_draft: 'FIR Draft',
              }[item.serviceType] || 'Consultation';

              const docName = item.documents?.[0]?.name || item.documentName || (item.documents?.length > 0 ? 'Uploaded Document' : 'No document attached');
              const docUrl = item.documents?.[0]?.url || item.documentUrl || null;

              return (
                <View key={item._id} style={styles.caseRequestCard}>
                  {/* Top Row: Client Info & Status Badge */}
                  <View style={styles.requestCardTop}>
                    <View style={styles.clientAvatarRow}>
                      {client.avatar ? (
                        <Image source={{ uri: client.avatar }} style={styles.reqAvatarImg} />
                      ) : (
                        <View style={styles.reqAvatarFallback}>
                          <Text style={styles.reqAvatarInitial}>
                            {(client.name || 'C')[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ marginLeft: 10 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.reqClientName}>{client.name || 'Client'}</Text>
                          {client.isVerified !== false && (
                            <Ionicons name="checkmark-circle" size={15} color={COLORS.primary} />
                          )}
                        </View>
                        <Text style={styles.reqCategoryText}>
                          {item.issue?.substring(0, 40) || svcLabel} • {svcLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Status Badge */}
                    <View
                      style={[
                        styles.reqStatusBadge,
                        isPending && styles.pendingBadge,
                        isAccepted && styles.acceptedBadge,
                        isRejected && styles.rejectedBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.reqStatusBadgeText,
                          isPending && styles.pendingBadgeText,
                          isAccepted && styles.acceptedBadgeText,
                          isRejected && styles.rejectedBadgeText,
                        ]}
                      >
                        {isPending ? 'Pending' : isAccepted ? 'Accepted' : 'Rejected'}
                      </Text>
                    </View>
                  </View>

                  {/* Document & Dates Row */}
                  <View style={styles.reqDetailsBox}>
                    <TouchableOpacity 
                      style={styles.detailRow}
                      activeOpacity={0.7}
                      disabled={!docUrl}
                      onPress={() => {
                        navigation.navigate('DocumentViewer', {
                          documentUrl: docUrl,
                          fileName: docName,
                          clientName: client.name || 'Client',
                          caseTitle: item.issue || svcLabel,
                        });
                      }}
                    >
                      <Ionicons name="document-text-outline" size={14} color={docUrl ? COLORS.primary : '#999'} />
                      <Text style={[styles.detailDocName, !docUrl && { color: '#999' }]} numberOfLines={1}>
                        {docName}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.dateMetaGrid}>
                      <View style={styles.dateCol}>
                        <Text style={styles.dateLabel}>Request Date</Text>
                        <Text style={styles.dateValue}>{formatDate(item.createdAt)}</Text>
                      </View>
                      <View style={styles.dateCol}>
                        <Text style={styles.dateLabel}>Response Due</Text>
                        <Text style={styles.dateValue}>{item.assignmentDeadline ? formatDate(item.assignmentDeadline) : 'Within 24 Hours'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.reqActionsRow}>
                    <TouchableOpacity
                      style={styles.reqViewCaseBtn}
                      activeOpacity={0.8}
                      onPress={() => handleNavigateToCase(item)}
                    >
                      <Text style={styles.reqViewCaseBtnText}>View Case</Text>
                      <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                    </TouchableOpacity>

                    {isPending && (
                      <View style={styles.pendingActionBtns}>
                        <TouchableOpacity
                          style={styles.quickAcceptBtn}
                          onPress={() => handleRequestAction(item._id, 'accept')}
                        >
                          <Ionicons name="checkmark" size={16} color="#16A34A" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickRejectBtn}
                          onPress={() => handleRequestAction(item._id, 'reject')}
                        >
                          <Ionicons name="close" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
  },

  // ─── Section Headings ──────────────────────────────────────────────────────
  sectionHeaderRow: {
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardsList: {
    gap: 12,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Today's Cases Card ───────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  textContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  caseType: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  consultationLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  viewCaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  viewCaseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ─── Case Requests Tabs ────────────────────────────────────────────────────
  tabContainer: {
    marginBottom: 12,
  },
  tabScrollWrap: {
    flexDirection: 'row',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 4,
    borderRadius: 99,
    gap: 4,
    flex: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 99,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ─── Case Request Card ─────────────────────────────────────────────────────
  caseRequestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    gap: 12,
  },
  requestCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  clientAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reqAvatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  reqAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqAvatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  reqClientName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  reqCategoryText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  reqStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reqStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },
  pendingBadgeText: {
    color: '#B45309',
  },
  acceptedBadge: {
    backgroundColor: '#DCFCE7',
  },
  acceptedBadgeText: {
    color: '#15803D',
  },
  rejectedBadge: {
    backgroundColor: '#FEE2E2',
  },
  rejectedBadgeText: {
    color: '#B91C1C',
  },

  // Details Box
  reqDetailsBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailDocName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  priorityHigh: {
    backgroundColor: '#FEE2E2',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  priorityHighText: {
    color: '#DC2626',
  },
  dateMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    paddingTop: 8,
  },
  dateCol: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },

  // Actions Row
  reqActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reqViewCaseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  reqViewCaseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pendingActionBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  quickAcceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  quickRejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  // ─── Empty States ──────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default CasesScreen;
