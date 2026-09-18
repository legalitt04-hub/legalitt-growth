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
import { getSocket, initiateCall } from '../../services/socket';
import { COLORS } from '../../constants/theme';
import { LEGAL_THEME } from '../../constants/legalAdviceTheme';
import { usePricing } from '../../context/PricingContext';
import SkeletonLoader from '../../components/common/SkeletonLoader';

const STATUS_CONFIG = {
  pending_payment: {
    bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C', icon: 'alert-circle-outline',
    label: 'Booking Failed / Unpaid',
  },
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
  failed: {
    bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C', icon: 'alert-circle-outline',
    label: 'Booking Failed',
  },
  payment_failed: {
    bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C', icon: 'card-outline',
    label: 'Payment Failed',
  },
};

const MODE_ICON = { chat: 'chatbubbles-outline', voice: 'call-outline', video: 'videocam-outline' };
const MODE_LABEL = { chat: 'Chat Consultation', voice: 'Voice Call', video: 'Video Call' };

// ─── Time slot generator ─────────────────────────────────────────────────────
const generateTimeSlots = () => {
  const slots = [];
  for (let h = 9; h <= 20; h++) {
    ['00', '30'].forEach(m => {
      if (h === 20 && m === '30') return;
      const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? 'PM' : 'AM';
      slots.push({ label: `${hour12}:${m} ${ampm}`, hour: h, minute: parseInt(m) });
    });
  }
  return slots;
};

// ─── Calendar helpers ─────────────────────────────────────────────────────────
const DAYS_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const buildCalendarGrid = (year, month) => {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];
  let week = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { grid.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); grid.push(week); }
  return grid;
};

// ─── Schedule Slot Modal (Full Calendar) ─────────────────────────────────────
const ScheduleModal = ({ visible, booking, onClose, onConfirm }) => {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null); // { year, month, day }
  const [selectedTime, setSelectedTime] = useState(null);
  const [saving, setSaving] = useState(false);
  const timeSlots = generateTimeSlots();

  const grid = buildCalendarGrid(viewYear, viewMonth);
  const todayY = today.getFullYear(), todayM = today.getMonth(), todayD = today.getDate();

  const isPast = (day) => {
    if (!day) return true;
    if (viewYear < todayY) return true;
    if (viewYear === todayY && viewMonth < todayM) return true;
    if (viewYear === todayY && viewMonth === todayM && day < todayD) return true;
    return false;
  };

  const isSelected = (day) =>
    selectedDate &&
    selectedDate.year  === viewYear  &&
    selectedDate.month === viewMonth &&
    selectedDate.day   === day;

  const isToday = (day) =>
    day === todayD && viewMonth === todayM && viewYear === todayY;

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDayPress = (day) => {
    if (!day || isPast(day)) return;
    setSelectedDate({ year: viewYear, month: viewMonth, day });
    setSelectedTime(null);
  };

  const canGoPrev = !(viewYear === todayY && viewMonth === todayM);

  const handleConfirm = async () => {
    if (!selectedDate || selectedTime === null) {
      Alert.alert('Select Date & Time', 'Please pick a date and time slot.');
      return;
    }
    const chosenDate = new Date(
      selectedDate.year, selectedDate.month, selectedDate.day,
      timeSlots[selectedTime].hour, timeSlots[selectedTime].minute, 0, 0
    );
    setSaving(true);
    try {
      await api.patch(`/bookings/${booking._id}/schedule`, { scheduledAt: chosenDate.toISOString() });
      onConfirm(chosenDate);
      Alert.alert(
        '✅ Slot Confirmed!',
        `Scheduled for ${chosenDate.toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.\n\nYour advocate will be notified.`
      );
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not schedule. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const selectedLabel = selectedDate
    ? `${selectedDate.day} ${MONTH_NAMES[selectedDate.month].slice(0,3)} ${selectedDate.year}`
    : null;
  const timeLabel = selectedTime !== null ? timeSlots[selectedTime].label : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={schedStyles.overlay}>
        <TouchableOpacity style={schedStyles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={schedStyles.sheet}>

          {/* Handle + Title */}
          <View style={schedStyles.sheetHeader}>
            <View style={schedStyles.pill} />
            <Text style={schedStyles.sheetTitle}>📅 Schedule Consultation</Text>
            <Text style={schedStyles.sheetSubtitle}>Select a date & time — your advocate will be notified</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>

            {/* Month Navigator */}
            <View style={schedStyles.monthNav}>
              <TouchableOpacity
                onPress={goPrev} disabled={!canGoPrev}
                style={[schedStyles.navBtn, !canGoPrev && { opacity: 0.3 }]}>
                <Ionicons name="chevron-back" size={20} color="#2E2A26" />
              </TouchableOpacity>
              <Text style={schedStyles.monthLabel}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={goNext} style={schedStyles.navBtn}>
                <Ionicons name="chevron-forward" size={20} color="#2E2A26" />
              </TouchableOpacity>
            </View>

            {/* Day-of-week headers */}
            <View style={schedStyles.weekRow}>
              {DAYS_SHORT.map(d => (
                <Text key={d} style={schedStyles.weekDayLabel}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            {grid.map((week, wi) => (
              <View key={wi} style={schedStyles.calRow}>
                {week.map((day, di) => {
                  const past = isPast(day);
                  const sel  = isSelected(day);
                  const tod  = isToday(day);
                  return (
                    <TouchableOpacity
                      key={di}
                      onPress={() => handleDayPress(day)}
                      disabled={!day || past}
                      activeOpacity={0.7}
                      style={[
                        schedStyles.calCell,
                        sel  && schedStyles.calCellSelected,
                        tod && !sel && schedStyles.calCellToday,
                        (!day || past) && schedStyles.calCellDisabled,
                      ]}
                    >
                      <Text style={[
                        schedStyles.calDay,
                        sel  && schedStyles.calDaySelected,
                        tod && !sel && schedStyles.calDayToday,
                        (!day || past) && schedStyles.calDayDisabled,
                      ]}>
                        {day || ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Selected date summary */}
            {selectedLabel && (
              <View style={schedStyles.selSummary}>
                <Ionicons name="calendar" size={14} color="#B89A6A" />
                <Text style={schedStyles.selSummaryText}>{selectedLabel}</Text>
                {timeLabel && (
                  <>
                    <Text style={schedStyles.selDot}>·</Text>
                    <Ionicons name="time" size={14} color="#B89A6A" />
                    <Text style={schedStyles.selSummaryText}>{timeLabel}</Text>
                  </>
                )}
              </View>
            )}

            {/* Time slots */}
            {selectedDate && (
              <>
                <Text style={schedStyles.sectionLabel}>SELECT TIME</Text>
                <View style={schedStyles.timeGrid}>
                  {timeSlots.map((t, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[schedStyles.timeChip, selectedTime === i && schedStyles.timeChipActive]}
                      onPress={() => setSelectedTime(i)}
                    >
                      <Text style={[schedStyles.timeLabel, selectedTime === i && schedStyles.timeLabelActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Confirm */}
            <TouchableOpacity
              style={[
                schedStyles.confirmBtn,
                (!selectedDate || selectedTime === null || saving) && schedStyles.confirmBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedDate || selectedTime === null || saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={schedStyles.confirmBtnText}>Confirm Slot</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default function MyBookingsScreen({ navigation }) {
  const { user, isAuthenticated } = useAuth();
  const { getPrice } = usePricing();
  const [bookings, setBookings] = useState([]);
  const userData = user?.user || user || {};

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

    // Also handle the event emitted from CasesScreen when adv accepts/declines
    const handleStatusChanged = (data) => {
      fetchBookings();
      if (data?.status === 'confirmed') {
        Alert.alert(
          '✅ Booking Confirmed!',
          'Your advocate has accepted your request. You can now proceed.',
          [{ text: 'OK', onPress: () => fetchBookings() }]
        );
      }
    };

    socket.on('booking_assigned', handleAssigned);
    socket.on('booking_status_updated', handleStatusUpdated);
    socket.on('booking_status_changed', handleStatusChanged);

    return () => {
      socket.off('booking_assigned', handleAssigned);
      socket.off('booking_status_updated', handleStatusUpdated);
      socket.off('booking_status_changed', handleStatusChanged);
    };
  }, [fetchBookings]);


  const handleOpenSession = async (actionType, item, params) => {
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
      try {
        const { data } = await bookingAPI.canJoinCall(params.bookingId);
        if (data?.canJoin === false) throw new Error(data.message || 'The call window is not open.');
        const callConfig = data?.data || {};
        await initiateCall({
          bookingId: params.bookingId,
          zegoRoomId: callConfig.zegoRoomId,
          mode: params.mode || 'video',
        });
        navigation.navigate('VideoCall', {
          ...params,
          ...callConfig,
          zegoRoomId: callConfig.zegoRoomId,
          zegoToken: callConfig.zegoToken,
          zegoAppId: callConfig.zegoAppId,
          myUserId: callConfig.myUserId || params.myUserId,
          myUserName: callConfig.myUserName || params.myUserName,
        });
      } catch (err) {
        Alert.alert('Call unavailable', err.response?.data?.message || err.message || 'Could not connect to the call server.');
      }
    }
  };

  const getActionButtons = (item) => {
    const advocate = item.advocate?.user || {};
    const advocateName = advocate.name || 'Advocate';
    const advocateAvatar = advocate.avatar || null;
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
                chatId:        item.chat,
                advocateName,  advocateAvatar,
                advocateId:    advocate._id || item.advocate?._id,
                zegoRoomId:    item.videoRoomId  || `legalitt-${item._id}`,
                zegoToken:     item.videoRoomToken || null,
                zegoAppId:     item.zegoAppId || 0,
                zegoAppSign:   item.advocateVideoToken ? String(require('expo-constants').default.expoConfig?.extra?.ZEGO_APP_SIGN || '') : '',
                mode:          item.consultationMode,
                scheduledSlot: slotText,
                bookingId:     item._id,
                advocateUserId: item.advocate?.user?._id || item.advocate?._id || null,
              })}>
              <Ionicons name="chatbubbles-outline" size={17} color="#FFFFFF" />
              <Text style={styles.chatBtnText}>Start Chat</Text>
            </TouchableOpacity>
          )}

          {(mode === 'voice' || mode === 'video') && (
            <TouchableOpacity
              style={[styles.callBtn, styles.videoBtn]}
              onPress={() => {
                const bid = item._id || item.id;
                const roomId = item.videoRoomId || `legalitt-${bid}`;
                const baseParams = {
                  zegoRoomId:     roomId,
                  zegoToken:      item.videoRoomToken || null,
                  zegoAppId:      item.zegoAppId || 0,
                  advocateName,
                  advocateAvatar,
                  myUserId:       userData._id || userData.id || '',
                  myUserName:     userData.name || 'Client',
                  bookingId:      bid,
                  advocateUserId: item.advocate?.user?._id || item.advocate?._id || null,
                };

                // Ask user: Voice or Video?
                Alert.alert(
                  '📞 Start Call',
                  'Kaise connect karna chahte ho?',
                  [
                    {
                      text: '🎙️ Voice Call',
                      onPress: () => handleOpenSession('call', item, { ...baseParams, mode: 'voice' }),
                    },
                    {
                      text: '📹 Video Call',
                      onPress: () => handleOpenSession('call', item, { ...baseParams, mode: 'video' }),
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}>
              <Ionicons name="call-outline" size={17} color="#FFFFFF" />
              <Text style={styles.callBtnText}>Start Call</Text>
            </TouchableOpacity>
          )}
        </View>
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
                  experience: advObj.experience || 0,
                  consultationFee: advObj.consultationFee || getPrice('chat_consultation', 999),
                  rating: advObj.rating?.average || 0,
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
              <Text style={styles.metaValue}>₹{item.payment?.amount || getPrice(item.type === 'fir_draft' ? 'fir_draft' : 'chat_consultation', 499)}</Text>
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
        <View style={{ padding: 16 }}>
          <SkeletonLoader type="clientRow" count={5} />
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
  overlay:   { flex: 1, justifyContent: 'flex-end' },
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '92%', paddingTop: 12,
  },
  sheetHeader: {
    alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#F1EDE6',
  },
  pill: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2D8CC', marginBottom: 14 },
  sheetTitle:    { fontSize: 18, fontWeight: '800', color: '#2E2A26', marginBottom: 4 },
  sheetSubtitle: { fontSize: 12, color: '#8D7865', textAlign: 'center' },

  // Month navigator
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F8F4EC', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E8E2D8',
  },
  monthLabel: { fontSize: 16, fontWeight: '800', color: '#2E2A26' },

  // Calendar grid
  weekRow: {
    flexDirection: 'row', paddingHorizontal: 12, marginBottom: 6,
  },
  weekDayLabel: {
    flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700',
    color: '#A89484', textTransform: 'uppercase',
  },
  calRow: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 4 },
  calCell: {
    flex: 1, height: 42, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, marginHorizontal: 2,
  },
  calCellSelected:  { backgroundColor: '#B89A6A' },
  calCellToday:     { backgroundColor: '#F8F4EC', borderWidth: 1.5, borderColor: '#B89A6A' },
  calCellDisabled:  { opacity: 0.25 },
  calDay:         { fontSize: 15, fontWeight: '700', color: '#2E2A26' },
  calDaySelected: { color: '#FFFFFF' },
  calDayToday:    { color: '#B89A6A' },
  calDayDisabled: { color: '#B0A899' },

  // Selected summary pill
  selSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginHorizontal: 20, marginTop: 4, marginBottom: 4,
    backgroundColor: '#FDF8F2', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E8E2D8',
  },
  selSummaryText: { fontSize: 12, fontWeight: '700', color: '#8D7865' },
  selDot: { color: '#C4B5A5', fontSize: 12 },

  // Time
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 1.2, paddingHorizontal: 20, marginBottom: 10, marginTop: 14,
  },
  timeGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 8, marginBottom: 16,
  },
  timeChip: {
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 10, backgroundColor: '#F8F4EC',
    borderWidth: 1.5, borderColor: '#E8E2D8',
  },
  timeChipActive:  { backgroundColor: '#B89A6A', borderColor: '#B89A6A' },
  timeLabel:       { fontSize: 13, fontWeight: '600', color: '#4B3F35' },
  timeLabelActive: { color: '#FFFFFF', fontWeight: '700' },

  // Confirm button
  confirmBtn: {
    marginHorizontal: 20, height: 54, borderRadius: 16,
    backgroundColor: '#2E2A26', alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  confirmBtnDisabled: { backgroundColor: '#C4B5A5' },
  confirmBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
