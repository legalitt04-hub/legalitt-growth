import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, StatusBar, Alert,
  Modal, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api, { bookingAPI, legalAdviceAPI, firAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../services/socket';
import { COLORS } from '../../constants/theme';
import { LEGAL_THEME } from '../../constants/legalAdviceTheme';

const STATUS_CONFIG = {
  pending_assignment: {
    bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', icon: 'time-outline',
    label: 'Awaiting Advocate (24h)', isWaiting: true,
  },
  pending: {
    bg: '#FEF9C3', border: '#FDE047', text: '#854D0E', icon: 'hourglass-outline',
    label: 'Pending Confirmation',
  },
  confirmed: {
    bg: '#ECFDF5', border: '#A7F3D0', text: '#047857', icon: 'checkmark-circle-outline',
    label: 'Confirmed',
  },
  in_progress: {
    bg: '#F3E8FF', border: '#DDD6FE', text: '#6B21A8', icon: 'radio-outline',
    label: 'In Progress',
  },
  completed: {
    bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', icon: 'shield-checkmark-outline',
    label: 'Completed',
  },
  cancelled: {
    bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B', icon: 'close-circle-outline',
    label: 'Cancelled',
  },
};

const MODE_ICON = { chat: 'chatbubbles-outline', voice: 'call-outline', video: 'videocam-outline' };
const MODE_LABEL = { chat: 'Chat Consultation', voice: 'Voice Call', video: 'Video Call' };

// ─── Time slot generator ──────────────────────────────────────────────────────
const generateTimeSlots = () => {
  const slots = [];
  for (let h = 9; h <= 20; h++) {
    ['00', '30'].forEach(m => {
      if (h === 20 && m === '30') return;
      const hour12 = h > 12 ? h - 12 : h;
      const ampm = h >= 12 ? 'PM' : 'AM';
      slots.push({ label: `${hour12}:${m} ${ampm}`, hour: h, minute: parseInt(m) });
    });
  }
  return slots;
};

// ─── Next 7 days generator ────────────────────────────────────────────────────
const getNext7Days = () => {
  const days = [];
  const today = new Date();
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      date: d,
      dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
      month: MONTH_NAMES[d.getMonth()],
    });
  }
  return days;
};

// ─── Schedule Slot Modal ──────────────────────────────────────────────────────
const ScheduleModal = ({ visible, booking, onClose, onConfirm }) => {
  const days = getNext7Days();
  const timeSlots = generateTimeSlots();
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (selectedTime === null) {
      Alert.alert('Select Time', 'Please select a time slot.');
      return;
    }
    const chosenDate = new Date(days[selectedDay].date);
    chosenDate.setHours(timeSlots[selectedTime].hour, timeSlots[selectedTime].minute, 0, 0);

    setSaving(true);
    try {
      await api.patch(`/bookings/${booking._id}/schedule`, { scheduledAt: chosenDate.toISOString() });
      onConfirm(chosenDate);
      Alert.alert('✅ Slot Confirmed!', `Your consultation is scheduled for ${chosenDate.toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.\n\nYour advocate will be notified.`);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not schedule. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={schedStyles.overlay}>
        <TouchableOpacity style={schedStyles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={schedStyles.sheet}>
          {/* Header */}
          <View style={schedStyles.sheetHeader}>
            <View style={schedStyles.sheetPill} />
            <Text style={schedStyles.sheetTitle}>📅 Schedule Consultation</Text>
            <Text style={schedStyles.sheetSubtitle}>Pick a date & time — your advocate will be notified</Text>
          </View>

          {/* Day Picker */}
          <Text style={schedStyles.sectionLabel}>SELECT DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={schedStyles.dayScroll}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[schedStyles.dayChip, selectedDay === i && schedStyles.dayChipActive]}
                onPress={() => setSelectedDay(i)}
              >
                <Text style={[schedStyles.dayName, selectedDay === i && schedStyles.dayNameActive]}>{d.dayName}</Text>
                <Text style={[schedStyles.dayNum, selectedDay === i && schedStyles.dayNumActive]}>{d.dayNum}</Text>
                <Text style={[schedStyles.dayMonth, selectedDay === i && schedStyles.dayMonthActive]}>{d.month}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Time Picker */}
          <Text style={[schedStyles.sectionLabel, { marginTop: 16 }]}>SELECT TIME</Text>
          <View style={schedStyles.timeGrid}>
            {timeSlots.map((t, i) => (
              <TouchableOpacity
                key={i}
                style={[schedStyles.timeChip, selectedTime === i && schedStyles.timeChipActive]}
                onPress={() => setSelectedTime(i)}
              >
                <Text style={[schedStyles.timeLabel, selectedTime === i && schedStyles.timeLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[schedStyles.confirmBtn, (saving || selectedTime === null) && schedStyles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={saving || selectedTime === null}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={schedStyles.confirmBtnText}>Confirm Slot</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function MyBookingsScreen({ navigation }) {
  const { user, isAuthenticated } = useAuth();
  const userData = user?.user || user || {};

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduleBooking, setScheduleBooking] = useState(null); // which booking is being scheduled

  // Guest guard handled inline in render (avoids Android addView crash)

  const fetchBookings = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [regularRes, legalRes, firRes] = await Promise.allSettled([
        bookingAPI.getMy(),           // includes property_research + document_forensic
        legalAdviceAPI.getMyRequests(), // legal_advice + legal_notice
        firAPI.getMyDrafts(),          // FIR drafts (separate model)
      ]);

      const regular = regularRes.status === 'fulfilled' ? (regularRes.value?.data?.data || []) : [];
      const legal   = legalRes.status === 'fulfilled'   ? (legalRes.value?.data?.data   || []) : [];
      // Normalize FIR drafts to booking-like shape for display
      const firDrafts = firRes.status === 'fulfilled'
        ? (firRes.value?.data?.data || firRes.value?.data || []).map(d => ({
            _id: d._id,
            serviceType: 'fir_draft',
            status: d.status === 'finalized' ? 'completed' : d.status === 'submitted' ? 'confirmed' : 'pending_assignment',
            createdAt: d.createdAt,
            issue: d.incident?.description || d.aiDraft?.substring(0, 80) || 'FIR Draft Request',
            notes: `Type: ${d.incident?.incidentType || 'General'}`,
            payment: { amount: 0, status: 'not_required' },
            _isFIRDraft: true,
            _raw: d,
          }))
        : [];

      // Merge and deduplicate by _id
      const bookingMap = new Map();
      [...regular, ...legal, ...firDrafts].forEach(item => {
        if (item?._id) bookingMap.set(item._id.toString(), item);
      });

      const all = Array.from(bookingMap.values()).sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      setBookings(all);
    } catch (err) {
      console.log('Error fetching bookings:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchBookings();
  }, [fetchBookings]));

  // Listen to live socket assignment & status updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleAssigned = () => {
      fetchBookings();
    };

    const handleStatusUpdated = (data) => {
      fetchBookings();
      if (data?.status === 'confirmed') {
        Alert.alert(
          'Consultation Confirmed! 🎉',
          'Your advocate has accepted the consultation request. You can now start chatting.',
          [{ text: 'OK', onPress: () => fetchBookings() }]
        );
      }
    };

    socket.on('booking_assigned', handleAssigned);
    socket.on('booking_status_updated', handleStatusUpdated);

    return () => {
      socket.off('booking_assigned', handleAssigned);
      socket.off('booking_status_updated', handleStatusUpdated);
    };
  }, [fetchBookings]);

  const handleOpenSession = (actionType, item, params) => {
    const rawSlot = item.notes?.replace('Preferred slot: ', '');
    if (rawSlot && item.status !== 'in_progress') {
      const slotDate = new Date(rawSlot);
      if (!isNaN(slotDate.getTime())) {
        const diffMins = (slotDate.getTime() - Date.now()) / 60000;
        if (diffMins > 15) {
          Alert.alert(
            '⏰ Session Not Started Yet',
            `Your consultation session is scheduled for: ${rawSlot}.\n\nChat and calls will open 15 minutes before your scheduled slot time. You will receive a push notification when it starts!`,
            [{ text: 'OK' }]
          );
          return;
        }
      }
    }

    if (actionType === 'chat') {
      navigation.navigate('Chat', params);
    } else if (actionType === 'call') {
      // Notify advocate that client is starting a call
      const socket = getSocket();
      if (socket && params.bookingId) {
        socket.emit('initiate_call', {
          bookingId: params.bookingId,
          zegoRoomId: params.zegoRoomId,
          mode: params.mode || 'video',
        });
      }
      navigation.navigate('VideoCall', params);
    }
  };

  const getActionButtons = (item) => {
    const advocate = item.advocate?.user || {};
    const advocateName = advocate.name || 'Advocate';
    const advocateAvatar = advocate.avatar || `https://i.pravatar.cc/150?u=${item.advocate?._id}`;
    const mode = item.consultationMode || item.type;
    const isConfirmed = item.status === 'confirmed' || item.status === 'in_progress';

    if (!isConfirmed || !item.advocate) return null;

    // Use booking.date if set, else fall back to notes
    const scheduledDate = item.date ? new Date(item.date) : null;
    const slotText = scheduledDate
      ? scheduledDate.toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : item.notes?.replace('Preferred slot: ', '') || null;

    return (
      <View style={{ gap: 10, marginTop: 4 }}>
        {/* Scheduled slot banner */}
        {slotText && (
          <View style={styles.slotBanner}>
            <Ionicons name="calendar-outline" size={14} color="#047857" />
            <Text style={styles.slotBannerText}>Scheduled: {slotText}</Text>
          </View>
        )}

        {/* Chat / Call buttons */}
        <View style={styles.actionsRow}>
          {item.chat && (
            <TouchableOpacity style={styles.chatBtn}
              onPress={() => handleOpenSession('chat', item, {
                chatId: item.chat,
                advocateName, advocateAvatar,
                advocateId: advocate._id || item.advocate?._id,
                zegoRoomId:  item.videoRoomId,
                zegoToken:   item.videoRoomToken,
                zegoAppId:   item.zegoAppId || 0,
                zegoAppSign: '',
                mode: item.consultationMode,
                scheduledSlot: slotText,
              })}>
              <Ionicons name="chatbubbles-outline" size={17} color="#FFFFFF" />
              <Text style={styles.chatBtnText}>Start Chat</Text>
            </TouchableOpacity>
          )}

          {(mode === 'voice' || mode === 'video') && item.videoRoomId && (
            <TouchableOpacity
              style={[styles.callBtn, mode === 'video' ? styles.videoBtn : styles.voiceBtn]}
              onPress={() => handleOpenSession('call', item, {
                zegoRoomId:     item.videoRoomId,
                zegoToken:      item.videoRoomToken,
                zegoAppId:      item.zegoAppId || 0,
                advocateName,
                myUserId:       userData._id || '',
                myUserName:     userData.name || 'Client',
                mode,
                bookingId:      item._id,
                advocateUserId: item.advocate?.user?._id || item.advocate?._id || null,
              })}>
              <Ionicons name={mode === 'video' ? 'videocam-outline' : 'call-outline'} size={17} color="#FFFFFF" />
              <Text style={styles.callBtnText}>{mode === 'video' ? 'Video Call' : 'Voice Call'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Schedule Slot Button */}
        <TouchableOpacity
          style={styles.scheduleBtn}
          onPress={() => setScheduleBooking(item)}
        >
          <Ionicons name="calendar-outline" size={16} color="#047857" />
          <Text style={styles.scheduleBtnText}>
            {item.date ? '\uD83D\uDCC5 Reschedule Slot' : '\uD83D\uDCC5 Schedule Slot'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };


  const renderBookingCard = ({ item }) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const advocate = item.advocate?.user || {};
    const advocateName = advocate.name || (item.status === 'pending_assignment' ? 'Being Assigned...' : 'Legal Counsel');
    const advocateAvatar = advocate.avatar;
    const mode = item.consultationMode || (item.type === 'phone' ? 'voice' : item.type) || 'chat';
    const isLegalNotice = item.serviceType === 'legal_notice';
    const isFIRDraft     = item.serviceType === 'fir_draft';
    const isProperty     = item.serviceType === 'property_research';
    const isForensic     = item.serviceType === 'document_forensic';

    // Service badge config
    const SERVICE_BADGE = {
      legal_notice:       { label: 'Legal Notice',      bg: '#FEF3C7', color: '#92400E' },
      fir_draft:          { label: 'FIR Draft',         bg: '#EDE9FE', color: '#5B21B6' },
      property_research:  { label: 'Property Research', bg: '#D1FAE5', color: '#065F46' },
      document_forensic:  { label: 'Forensic Analysis', bg: '#FCE7F3', color: '#9D174D' },
    };
    const serviceBadge = SERVICE_BADGE[item.serviceType];



    // 24h deadline countdown
    let deadlineText = null;
    if (item.status === 'pending_assignment' && item.assignmentDeadline) {
      const hours = Math.max(0, (new Date(item.assignmentDeadline) - Date.now()) / 3600000);
      deadlineText = hours > 0
        ? `${Math.floor(hours)}h ${Math.floor((hours % 1) * 60)}m remaining`
        : 'Assignment overdue — our team is on it';
    }

    return (
      <View style={[styles.card, item.status === 'pending_assignment' && styles.pendingCard]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusBadge, { backgroundColor: config.bg, borderColor: config.border }]}>
              <Ionicons name={config.icon} size={13} color={config.text} />
              <Text style={[styles.statusText, { color: config.text }]}>{config.label}</Text>
            </View>
            {serviceBadge && (
              <View style={[styles.noticeBadge, { backgroundColor: serviceBadge.bg }]}>
                <Text style={[styles.noticeBadgeText, { color: serviceBadge.color }]}>{serviceBadge.label}</Text>
              </View>
            )}
          </View>
          <View style={styles.modeBadge}>
            <Ionicons name={MODE_ICON[mode] || 'chatbubbles-outline'} size={13} color="#6D6A66" />
            <Text style={styles.modeText}>{MODE_LABEL[mode] || 'Chat'}</Text>
          </View>
        </View>

        {/* Advocate Info */}
        <TouchableOpacity
          style={styles.advocateRow}
          activeOpacity={item.advocate ? 0.7 : 1}
          onPress={() => {
            const advObj = item.advocate;
            const advId = typeof advObj === 'object' ? (advObj._id || advObj.id || advObj.user?._id) : advObj;
            if (advId) {
              navigation.navigate('AdvocateProfile', {
                advocateId: advId,
                advocateName,
                advocateAvatar,
                prefetchedData: typeof advObj === 'object' ? {
                  _id: advObj._id || advId,
                  id: advObj._id || advId,
                  userId: advObj.user?._id || advObj.user,
                  name: advocateName,
                  avatar: advocateAvatar,
                  specializations: advObj.specializations || [],
                  experience: advObj.experience || 5,
                  consultationFee: advObj.consultationFee || 999,
                  rating: advObj.rating?.average || 4.9,
                  location: advObj.location,
                } : null,
              });
            }
          }}>
          {advocateAvatar ? (
            <Image source={{ uri: advocateAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name={item.status === 'pending_assignment' ? 'time-outline' : 'person'}
                size={22} color="#B89A6A" />
            </View>
          )}
          <View style={styles.advocateDetails}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.advocateName}>{advocateName}</Text>
              {item.advocate && (
                <Ionicons name="chevron-forward" size={16} color="#B89A6A" />
              )}
            </View>
            <Text style={styles.advocateTitle}>
              {item.status === 'pending_assignment'
                ? '⏳ Admin is assigning best advocate for you'
                : (item.advocate?.specializations?.[0] ? `${item.advocate.specializations[0]} · Tap to view profile` : 'Advocate & Legal Advisor · Tap to view profile')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* 24h countdown */}
        {deadlineText && (
          <View style={styles.deadlineBanner}>
            <Ionicons name="alarm-outline" size={14} color="#B45309" />
            <Text style={styles.deadlineText}>{deadlineText}</Text>
          </View>
        )}

        {/* Issue + Meta */}
        <View style={styles.detailsBox}>
          <Text style={styles.issueText} numberOfLines={2}>
            {item.issue || 'Consultation regarding legal matters'}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="card-outline" size={14} color="#B89A6A" />
              <Text style={styles.metaValue}>₹{item.payment?.amount || 499}</Text>
            </View>
            {item.payment?.status === 'paid' && (
              <View style={styles.metaItem}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={[styles.metaValue, { color: '#10B981' }]}>Paid</Text>
              </View>
            )}
            {item.documents?.length > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="document-attach-outline" size={14} color="#6D6A66" />
                <Text style={styles.metaValue}>{item.documents.length} doc{item.documents.length > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        {getActionButtons(item) || (item.status === 'pending_assignment' && (
          <View style={styles.waitingBox}>
            <ActivityIndicator size="small" color="#B45309" />
            <Text style={styles.waitingText}>Advocate assignment in progress...</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="document-text-outline" size={40} color="#B89A6A" />
      </View>
      <Text style={styles.emptyTitle}>No Requests Yet</Text>
      <Text style={styles.emptyText}>
        You haven't requested any legal advice consultations yet.
      </Text>
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => navigation.navigate('LegalAdviceLanding')}>
        <Text style={styles.primaryBtnText}>Book Legal Advice</Text>
      </TouchableOpacity>
    </View>
  );


  // ─── Guest Gate: show login prompt inline (avoids Android addView crash on mount)
  if (isAuthenticated === false) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ClientMain')} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#2E2A26" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Requests</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="lock-closed-outline" size={36} color="#B89A6A" />
          </View>
          <Text style={styles.emptyTitle}>Sign In Required</Text>
          <Text style={styles.emptyText}>Please sign in to view your legal requests, bookings and consultations.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('LoginRegister', { role: 'client' })}>
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ClientMain')}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#2E2A26" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Requests</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => fetchBookings(true)}>
          <Ionicons name="refresh-outline" size={22} color="#B89A6A" />
        </TouchableOpacity>
      </View>

      {loading && bookings.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#B89A6A" />
          <Text style={styles.loadingText}>Loading your requests...</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item, index) => item._id ? `${item._id}_${index}` : `req_${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={renderBookingCard}
          ListEmptyComponent={renderEmpty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchBookings(true)} colors={['#B89A6A']} tintColor="#B89A6A" />}
        />
      )}

      {/* ── Schedule Slot Modal ── */}
      {scheduleBooking && (
        <ScheduleModal
          visible={!!scheduleBooking}
          booking={scheduleBooking}
          onClose={() => setScheduleBooking(null)}
          onConfirm={(chosenDate) => {
            // Update local booking so banner appears immediately
            setBookings(prev => prev.map(b =>
              b._id === scheduleBooking._id ? { ...b, date: chosenDate.toISOString() } : b
            ));
            setScheduleBooking(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E8E2D8',
  },
  backButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F8F4EC', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E8E2D8',
  },
  refreshButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F8F4EC', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E8E2D8',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#2E2A26', letterSpacing: 0.3 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6D6A66', fontWeight: '500' },
  listContent: { padding: 16, paddingBottom: 100, gap: 16 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#E8E2D8',
    elevation: 3, shadowColor: '#2E2A26', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10,
  },
  pendingCard: { borderColor: '#FDE047', borderWidth: 1.5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  noticeBadge: {
    backgroundColor: '#F3E8FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: '#DDD6FE',
  },
  noticeBadgeText: { fontSize: 10, fontWeight: '700', color: '#6B21A8' },
  modeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F8F4EC', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: '#E8E2D8',
  },
  modeText: { fontSize: 11, color: '#6D6A66', fontWeight: '600' },
  advocateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12, borderWidth: 1.5, borderColor: '#B89A6A' },
  avatarPlaceholder: {
    backgroundColor: '#F8F4EC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8E2D8',
  },
  advocateDetails: { flex: 1 },
  advocateName: { fontSize: 16, fontWeight: '700', color: '#2E2A26', marginBottom: 2 },
  advocateTitle: { fontSize: 12, color: '#6D6A66' },
  deadlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 10, marginBottom: 12,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  deadlineText: { fontSize: 12, color: '#B45309', fontWeight: '600', flex: 1 },
  detailsBox: {
    backgroundColor: '#F8F4EC', borderRadius: 14, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: '#E8E2D8',
  },
  issueText: { fontSize: 14, color: '#2E2A26', fontWeight: '600', lineHeight: 20, marginBottom: 10 },
  metaRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaValue: { fontSize: 12, fontWeight: '700', color: '#6D6A66' },
  actionsRow: { flexDirection: 'row', gap: 8 },
  slotBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FAF2E8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E8E2D8',
  },
  slotBannerText: { fontSize: 12, color: '#8D7865', fontWeight: '700' },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#B89A6A', paddingVertical: 13, borderRadius: 14,
    elevation: 2, shadowColor: '#9D7D4D', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
  },
  chatBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  callBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: 14,
  },
  voiceBtn: { backgroundColor: '#10B981' },
  videoBtn: { backgroundColor: '#8D7865' },
  callBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  scheduleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 12,
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
  },
  scheduleBtnText: { fontSize: 13, fontWeight: '700', color: '#047857' },
  waitingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFBEB', borderRadius: 12, paddingVertical: 12, gap: 8,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  waitingText: { fontSize: 13, color: '#B45309', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F8F4EC', alignItems: 'center',
    justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#E8E2D8',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#2E2A26', marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#6D6A66', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  primaryBtn: {
    backgroundColor: '#B89A6A', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

// ─── Schedule Modal Styles ────────────────────────────────────────────────────
const schedStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 36,
    paddingTop: 12,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetPill: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E2E8F0', marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13, color: '#64748B', textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 1.2, paddingHorizontal: 24, marginBottom: 10, marginTop: 16,
  },
  dayScroll: { flexGrow: 0 },
  dayChip: {
    width: 66, alignItems: 'center', paddingVertical: 12,
    borderRadius: 16, backgroundColor: '#F8FAFC',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  dayChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  dayName: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  dayNameActive: { color: '#94A3B8' },
  dayNum: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  dayNumActive: { color: '#FFFFFF' },
  dayMonth: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginTop: 2 },
  dayMonthActive: { color: '#64748B' },
  timeGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 20, gap: 8, marginBottom: 20,
  },
  timeChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12, backgroundColor: '#F8FAFC',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  timeChipActive: { backgroundColor: '#14B8A6', borderColor: '#14B8A6' },
  timeLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  timeLabelActive: { color: '#FFFFFF', fontWeight: '700' },
  confirmBtn: {
    marginHorizontal: 20, height: 54, borderRadius: 16,
    backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});

