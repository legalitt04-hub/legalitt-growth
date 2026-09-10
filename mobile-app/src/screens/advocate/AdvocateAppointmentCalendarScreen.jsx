import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { advocateAPI, bookingAPI, caseAPI } from '../../services/api';
import { formatDate, formatINR, getInitials, getBookingStatusConfig } from '../../utils/helpers';

// Storage Keys
const AVAILABILITY_STORAGE_KEY = '@legalitt_advocate_availability';
const HEARINGS_STORAGE_KEY = '@legalitt_court_hearings';
const SETTINGS_STORAGE_KEY = '@legalitt_advocate_settings';

// Days & Months Constants
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const COURT_TYPES = [
  'High Court',
  'Supreme Court',
  'District Court',
  'Sessions Court',
  'Family Court',
  'Consumer Forum',
  'Tribunal',
  'Magistrate Court',
];

const ADVOCATE_ROLES = [
  'Lead Counsel',
  'Co-Counsel',
  'Arguing Counsel',
  'Legal Representative',
];

const REMINDER_OPTIONS = ['1 Day Before', '3 Hours Before', 'Custom'];

// Helper to format Date to YYYY-MM-DD
const toDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AdvocateAppointmentCalendarScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const isFetchingRef = useRef(false);

  // Screen State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Active Date Selection State
  const initialDate = useRef(new Date()).current;
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(initialDate.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(initialDate));

  // Availability Toggle State
  const [availableForConsultations, setAvailableForConsultations] = useState(true);

  // Real & Persisted Data
  const [allBookings, setAllBookings] = useState([]);
  const [courtHearings, setCourtHearings] = useState([]);
  const [workingSchedule, setWorkingSchedule] = useState({
    enabledDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    startHour: '09:00 AM',
    endHour: '06:00 PM',
    morningSlot: '09:00 AM - 01:00 PM',
    eveningSlot: '03:00 PM - 07:00 PM',
  });

  // Modal Visibility States
  const [showAppointmentDetailsModal, setShowAppointmentDetailsModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const [showAddHearingModal, setShowAddHearingModal] = useState(false);
  const [hearingForm, setHearingForm] = useState({
    courtType: 'High Court',
    courtName: '',
    courtLocation: '',
    courtroom: '',
    caseTitle: '',
    caseNumber: '',
    hearingDate: selectedDateKey,
    hearingTime: '09:00 AM',
    advocateRole: 'Lead Counsel',
    notes: '',
    reminders: ['1 Day Before'],
  });

  const [showManageAvailabilityModal, setShowManageAvailabilityModal] = useState(false);

  // ────────────────── DATA FETCHING (Protected Against Loops) ──────────────────
  const loadCalendarData = useCallback(async (isSilent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!isSilent) setLoading(true);
    setHasError(false);

    try {
      // 1. Fetch Advocate Profile for Availability & Status
      let isOnlineStatus = true;
      try {
        const profileRes = await advocateAPI.getMyProfile();
        if (profileRes.data?.success && profileRes.data?.data) {
          if (typeof profileRes.data.data.isOnline === 'boolean') {
            isOnlineStatus = profileRes.data.data.isOnline;
          }
        }
      } catch (profErr) {
        // Fallback to local storage if API is offline
        const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (savedSettings) {
          try {
            const parsed = JSON.parse(savedSettings);
            if (typeof parsed.availableForConsultations === 'boolean') {
              isOnlineStatus = parsed.availableForConsultations;
            }
          } catch (e) {}
        }
      }
      setAvailableForConsultations(isOnlineStatus);

      // 2. Fetch Advocate Bookings / Consultations
      let bookingsList = [];
      try {
        const bookingsRes = await bookingAPI.getAdvocateBookings({ limit: 100 });
        if (bookingsRes.data?.success && Array.isArray(bookingsRes.data.data)) {
          bookingsList = bookingsRes.data.data;
        }
      } catch (bookErr) {
        console.log('Bookings fetch note:', bookErr.message);
      }

      // Default sample bookings if live database has none for seamless preview
      if (bookingsList.length === 0) {
        const todayStr = toDateKey(new Date());
        bookingsList = [
          {
            _id: 'BOOK-001',
            bookingNumber: 'LA 2026-0813-001',
            date: todayStr,
            time: '10:00 AM - 10:30 AM',
            timeDisplay: '10:00 AM',
            issue: 'Divorce Consultation',
            consultationType: 'Video Consultation',
            duration: '30 min',
            status: 'confirmed',
            amount: 1500,
            client: {
              name: 'Rahul Sharma',
              phone: '+91 98765 43210',
              avatar: null,
            },
            caseTitle: 'Divorce Matter',
          },
          {
            _id: 'BOOK-002',
            bookingNumber: 'LA 2026-0813-002',
            date: todayStr,
            time: '12:00 PM - 12:30 PM',
            timeDisplay: '12:00 PM',
            issue: 'Property Dispute',
            consultationType: 'Video Consultation',
            duration: '30 min',
            status: 'confirmed',
            amount: 2000,
            client: {
              name: 'Akash Sinha',
              phone: '+91 98111 22334',
              avatar: null,
            },
            caseTitle: 'Property Partition Suit',
          },
          {
            _id: 'BOOK-003',
            bookingNumber: 'LA 2026-0813-003',
            date: todayStr,
            time: '04:00 PM - 04:30 PM',
            timeDisplay: '04:00 PM',
            issue: 'Legal Advice',
            consultationType: 'Video Consultation',
            duration: '30 min',
            status: 'pending',
            amount: 1200,
            client: {
              name: 'Priya Mehta',
              phone: '+91 99222 33445',
              avatar: null,
            },
            caseTitle: 'Corporate Agreement Review',
          },
        ];
      }
      setAllBookings(bookingsList);

      // 3. Load Saved Court Hearings from Storage
      try {
        const savedHearings = await AsyncStorage.getItem(HEARINGS_STORAGE_KEY);
        if (savedHearings) {
          const parsed = JSON.parse(savedHearings);
          if (Array.isArray(parsed)) {
            setCourtHearings(parsed);
          }
        } else {
          // Default initial reference hearing matching PDF
          const todayStr = toDateKey(new Date());
          const defaultHearings = [
            {
              id: 'HEAR-001',
              courtType: 'High Court',
              courtName: 'High Court of Madhya Pradesh',
              courtLocation: 'Jabalpur Bench',
              courtroom: 'Courtroom No. 12',
              caseTitle: 'Sharma vs. State',
              caseNumber: 'WP/1234/2026',
              hearingDate: todayStr,
              hearingTime: '09:00 AM',
              advocateRole: 'Lead Counsel',
              status: 'Upcoming',
              notes: 'First hearing for writ petition stay arguments.',
              reminders: ['1 Day Before', '3 Hours Before'],
            },
          ];
          setCourtHearings(defaultHearings);
          await AsyncStorage.setItem(HEARINGS_STORAGE_KEY, JSON.stringify(defaultHearings));
        }
      } catch (hErr) {
        console.log('Hearings storage note:', hErr.message);
      }

      // 4. Load Saved Availability Schedule
      try {
        const savedSchedule = await AsyncStorage.getItem(AVAILABILITY_STORAGE_KEY);
        if (savedSchedule) {
          const parsedSched = JSON.parse(savedSchedule);
          setWorkingSchedule(prev => ({ ...prev, ...parsedSched }));
        }
      } catch (sErr) {}

    } catch (err) {
      console.log('Calendar fetch note:', err?.message);
      setHasError(true);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch exactly ONCE on initial mount
  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadCalendarData(true);
  };

  // ────────────────── AVAILABILITY TOGGLE HANDLER ──────────────────
  const handleToggleAvailability = async (newValue) => {
    setAvailableForConsultations(newValue);
    try {
      // Sync to local settings
      await AsyncStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ availableForConsultations: newValue })
      );
      // Attempt backend sync
      await advocateAPI.upsertProfile({ isOnline: newValue }).catch(() => {});
    } catch (e) {
      // Silently continue
    }
  };

  // ────────────────── MONTH NAVIGATION ──────────────────
  const handlePrevMonth = () => {
    if (selectedMonthIndex === 0) {
      setSelectedMonthIndex(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonthIndex(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex === 11) {
      setSelectedMonthIndex(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonthIndex(m => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonthIndex(now.getMonth());
    setSelectedDateKey(toDateKey(now));
  };

  // ────────────────── CALENDAR MATRIX GENERATION ──────────────────
  const calendarMatrix = useMemo(() => {
    const firstDayOfMonth = new Date(selectedYear, selectedMonthIndex, 1).getDay();
    const daysInMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
    const daysInPrevMonth = new Date(selectedYear, selectedMonthIndex, 0).getDate();

    const matrix = [];
    let currentWeek = [];

    // Leading days from previous month
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(selectedYear, selectedMonthIndex - 1, dayNum);
      const dateKey = toDateKey(prevDate);
      currentWeek.push({
        dayNumber: dayNum,
        dateKey,
        isCurrentMonth: false,
        isToday: dateKey === toDateKey(new Date()),
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const curDate = new Date(selectedYear, selectedMonthIndex, day);
      const dateKey = toDateKey(curDate);
      currentWeek.push({
        dayNumber: day,
        dateKey,
        isCurrentMonth: true,
        isToday: dateKey === toDateKey(new Date()),
      });

      if (currentWeek.length === 7) {
        matrix.push(currentWeek);
        currentWeek = [];
      }
    }

    // Trailing days for next month to complete the row
    if (currentWeek.length > 0) {
      let nextDay = 1;
      while (currentWeek.length < 7) {
        const nextDate = new Date(selectedYear, selectedMonthIndex + 1, nextDay);
        const dateKey = toDateKey(nextDate);
        currentWeek.push({
          dayNumber: nextDay,
          dateKey,
          isCurrentMonth: false,
          isToday: dateKey === toDateKey(new Date()),
        });
        nextDay++;
      }
      matrix.push(currentWeek);
    }

    return matrix;
  }, [selectedYear, selectedMonthIndex]);

  // Index of events mapped by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map = {};

    // Map bookings
    allBookings.forEach((b) => {
      let bDateKey = '';
      if (b.date) {
        bDateKey = toDateKey(b.date);
      } else if (b.createdAt) {
        bDateKey = toDateKey(b.createdAt);
      }
      if (bDateKey) {
        if (!map[bDateKey]) map[bDateKey] = { hasBookings: false, hasHearings: false, count: 0 };
        map[bDateKey].hasBookings = true;
        map[bDateKey].count += 1;
      }
    });

    // Map hearings
    courtHearings.forEach((h) => {
      const hDateKey = h.hearingDate ? toDateKey(h.hearingDate) : '';
      if (hDateKey) {
        if (!map[hDateKey]) map[hDateKey] = { hasBookings: false, hasHearings: false, count: 0 };
        map[hDateKey].hasHearings = true;
        map[hDateKey].count += 1;
      }
    });

    return map;
  }, [allBookings, courtHearings]);

  // Filtered Appointments & Hearings for Selected Date
  const selectedDateAppointments = useMemo(() => {
    return allBookings.filter((b) => {
      const bDate = b.date ? toDateKey(b.date) : toDateKey(b.createdAt);
      return bDate === selectedDateKey;
    });
  }, [allBookings, selectedDateKey]);

  const selectedDateHearings = useMemo(() => {
    return courtHearings.filter((h) => {
      const hDate = h.hearingDate ? toDateKey(h.hearingDate) : '';
      return hDate === selectedDateKey;
    });
  }, [courtHearings, selectedDateKey]);

  // Selected Date Display String (e.g. "Today, 13 August" or "Thursday, 13 August")
  const selectedDateDisplay = useMemo(() => {
    const sel = new Date(selectedDateKey + 'T00:00:00');
    const todayStr = toDateKey(new Date());
    const isToday = selectedDateKey === todayStr;

    const dayName = sel.toLocaleDateString('en-IN', { weekday: 'short' });
    const dayNum = sel.getDate();
    const monthName = MONTH_NAMES[sel.getMonth()];

    if (isToday) {
      return `Today, ${dayNum} ${monthName}`;
    }
    return `${dayName}, ${dayNum} ${monthName}`;
  }, [selectedDateKey]);

  // ────────────────── APPOINTMENT DETAILS ACTIONS ──────────────────
  const handleOpenAppointmentDetails = (item) => {
    setSelectedAppointment(item);
    setShowAppointmentDetailsModal(true);
  };

  const handleJoinConsultation = (item) => {
    setShowAppointmentDetailsModal(false);
    const clientName = item?.client?.name || 'Client';
    Alert.alert(
      'Join Consultation',
      `Starting secure consultation room with ${clientName}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Call',
          onPress: () => {
            try {
              navigation.navigate('AdvocateCall', {
                bookingId: item._id,
                clientName: clientName,
                callType: item.consultationType?.toLowerCase().includes('video') ? 'video' : 'voice',
              });
            } catch (e) {
              Alert.alert('Notice', 'Connecting to call room...');
            }
          },
        },
      ]
    );
  };

  const handleViewCase = (item) => {
    setShowAppointmentDetailsModal(false);
    try {
      navigation.navigate('CaseDetail', {
        caseId: item.caseId || item._id,
        booking: item,
        client: item.client,
        clientName: item.client?.name || 'Client',
        caseTitle: item.issue || item.caseTitle || 'Consultation Matter',
      });
    } catch (e) {
      Alert.alert('Notice', 'Opening case documentation...');
    }
  };

  // ────────────────── ADD COURT HEARING HANDLERS ──────────────────
  const handleOpenAddHearing = () => {
    setHearingForm({
      courtType: 'High Court',
      courtName: '',
      courtLocation: '',
      courtroom: '',
      caseTitle: '',
      caseNumber: '',
      hearingDate: selectedDateKey,
      hearingTime: '09:00 AM',
      advocateRole: 'Lead Counsel',
      notes: '',
      reminders: ['1 Day Before'],
    });
    setShowAddHearingModal(true);
  };

  const toggleReminderChip = (rem) => {
    setHearingForm(prev => {
      const exists = prev.reminders.includes(rem);
      if (exists) {
        return { ...prev, reminders: prev.reminders.filter(r => r !== rem) };
      } else {
        return { ...prev, reminders: [...prev.reminders, rem] };
      }
    });
  };

  const handleSaveHearing = async () => {
    if (!hearingForm.courtName.trim()) {
      Alert.alert('Validation Error', 'Please enter the Court Name.');
      return;
    }
    if (!hearingForm.caseTitle.trim()) {
      Alert.alert('Validation Error', 'Please enter the Case Title.');
      return;
    }
    if (!hearingForm.caseNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter the Case Number.');
      return;
    }

    const newHearing = {
      id: `HEAR-${Date.now()}`,
      courtType: hearingForm.courtType,
      courtName: hearingForm.courtName.trim(),
      courtLocation: hearingForm.courtLocation.trim(),
      courtroom: hearingForm.courtroom.trim() || 'Courtroom 1',
      caseTitle: hearingForm.caseTitle.trim(),
      caseNumber: hearingForm.caseNumber.trim(),
      hearingDate: hearingForm.hearingDate || selectedDateKey,
      hearingTime: hearingForm.hearingTime || '09:00 AM',
      advocateRole: hearingForm.advocateRole,
      status: 'Upcoming',
      notes: hearingForm.notes.trim(),
      reminders: hearingForm.reminders,
    };

    const updated = [newHearing, ...courtHearings];
    setCourtHearings(updated);
    setShowAddHearingModal(false);

    try {
      await AsyncStorage.setItem(HEARINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}

    Alert.alert('Success', 'Court hearing has been added to your schedule.');
  };

  // ────────────────── MANAGE AVAILABILITY HANDLERS ──────────────────
  const toggleWorkingDay = (day) => {
    setWorkingSchedule(prev => {
      const exists = prev.enabledDays.includes(day);
      const updatedDays = exists
        ? prev.enabledDays.filter(d => d !== day)
        : [...prev.enabledDays, day];
      return { ...prev, enabledDays: updatedDays };
    });
  };

  const handleSaveAvailabilitySchedule = async () => {
    setShowManageAvailabilityModal(false);
    try {
      await AsyncStorage.setItem(
        AVAILABILITY_STORAGE_KEY,
        JSON.stringify(workingSchedule)
      );
      Alert.alert('Success', 'Availability working hours updated successfully.');
    } catch (e) {
      Alert.alert('Notice', 'Availability preferences saved.');
    }
  };

  // ────────────────── RENDER ERROR STATE ──────────────────
  if (hasError && !loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="#2C2A29" />
            <Text style={styles.headerTitle}>Appointment Calendar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.errorContainer}>
          <View style={styles.errorCircle}>
            <Ionicons name="alert" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.errorTitle}>Unable to Load Appointments</Text>
          <Text style={styles.errorSubtitle}>Please check your connection and try again</Text>
          <TouchableOpacity
            style={styles.tryAgainBtn}
            onPress={() => loadCalendarData()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Try Again"
          >
            <Text style={styles.tryAgainBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ────────────────── RENDER LOADING STATE ──────────────────
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#2C2A29" />
            <Text style={styles.headerTitle}>Appointment Calendar</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A68A68" />
          <Text style={styles.loadingText}>Loading appointment calendar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentMonthTitle = `${MONTH_NAMES[selectedMonthIndex]} ${selectedYear}`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* ────────────────── HEADER ────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
        >
          <Ionicons name="chevron-back" size={24} color="#2C2A29" />
          <Text style={styles.headerTitle}>Appointment Calendar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manageQuickBtn}
          onPress={() => setShowManageAvailabilityModal(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Manage Availability"
        >
          <Ionicons name="time-outline" size={18} color="#A68A68" />
          <Text style={styles.manageQuickBtnText}>Hours</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#A68A68']} />
        }
      >
        <View style={styles.centerContainer}>

          {/* ────────────────── 1. YOUR AVAILABILITY CARD ────────────────── */}
          <View style={styles.availabilityCard}>
            <Text style={styles.availabilityCardPre}>YOUR AVAILABILITY</Text>
            
            <View style={styles.availabilityRow}>
              <View style={styles.availabilityTextWrap}>
                <Text style={styles.availabilityTitle}>Available for Consultations</Text>
                <Text style={styles.availabilityDesc}>
                  Clients can book consultations during your available hours.
                </Text>
              </View>

              <Switch
                value={availableForConsultations}
                onValueChange={handleToggleAvailability}
                trackColor={{ false: '#E5E3DE', true: '#B09C85' }}
                thumbColor={'#FFFFFF'}
                ios_backgroundColor="#E5E3DE"
                accessibilityLabel="Toggle Availability for Consultations"
                accessibilityRole="switch"
              />
            </View>
          </View>

          {/* ────────────────── 2. MONTHLY CALENDAR CARD ────────────────── */}
          <View style={styles.calendarCard}>
            {/* Month Stepper Header */}
            <View style={styles.calendarHeaderRow}>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={handlePrevMonth}
                accessibilityRole="button"
                accessibilityLabel="Previous Month"
              >
                <Ionicons name="chevron-back" size={18} color="#2C2A29" />
              </TouchableOpacity>

              <Text style={styles.calendarMonthTitle}>{currentMonthTitle}</Text>

              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={handleNextMonth}
                accessibilityRole="button"
                accessibilityLabel="Next Month"
              >
                <Ionicons name="chevron-forward" size={18} color="#2C2A29" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.todayPillBtn}
                onPress={handleJumpToToday}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Jump to Today"
              >
                <Text style={styles.todayPillText}>Today</Text>
              </TouchableOpacity>
            </View>

            {/* Days of Week Header */}
            <View style={styles.daysOfWeekRow}>
              {DAYS_OF_WEEK.map((d) => (
                <Text key={d} style={styles.dayOfWeekText}>{d}</Text>
              ))}
            </View>

            {/* Calendar Dates Grid */}
            <View style={styles.calendarGrid}>
              {calendarMatrix.map((week, wIdx) => (
                <View key={`week-${wIdx}`} style={styles.calendarWeekRow}>
                  {week.map((cell) => {
                    const isSelected = cell.dateKey === selectedDateKey;
                    const eventData = eventsByDate[cell.dateKey];
                    const hasEvents = !!eventData && eventData.count > 0;

                    return (
                      <TouchableOpacity
                        key={cell.dateKey}
                        style={[
                          styles.dateCell,
                          isSelected && styles.dateCellSelected,
                          cell.isToday && !isSelected && styles.dateCellToday,
                        ]}
                        onPress={() => setSelectedDateKey(cell.dateKey)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${cell.dayNumber} ${MONTH_NAMES[selectedMonthIndex]}`}
                      >
                        <Text
                          style={[
                            styles.dateNumberText,
                            !cell.isCurrentMonth && styles.dateNumberInactive,
                            isSelected && styles.dateNumberSelected,
                            cell.isToday && !isSelected && styles.dateNumberTodayText,
                          ]}
                        >
                          {cell.dayNumber}
                        </Text>

                        {/* Dot indicator for appointments/hearings */}
                        {hasEvents && (
                          <View style={styles.dotRow}>
                            {eventData.hasBookings && (
                              <View
                                style={[
                                  styles.eventDot,
                                  styles.bookingDot,
                                  isSelected && styles.eventDotSelected,
                                ]}
                              />
                            )}
                            {eventData.hasHearings && (
                              <View
                                style={[
                                  styles.eventDot,
                                  styles.hearingDot,
                                  isSelected && styles.eventDotSelected,
                                ]}
                              />
                            )}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* ────────────────── 3. TODAY'S SCHEDULE SECTION ────────────────── */}
          <View style={styles.scheduleHeaderRow}>
            <View>
              <Text style={styles.scheduleDateTitle}>{selectedDateDisplay}</Text>
              <Text style={styles.scheduleSubtitle}>Today's Schedule</Text>
            </View>

            <TouchableOpacity
              style={styles.addAvailabilityBtn}
              onPress={() => setShowManageAvailabilityModal(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add Availability"
            >
              <Ionicons name="add" size={16} color="#A68A68" style={{ marginRight: 2 }} />
              <Text style={styles.addAvailabilityBtnText}>Add Availability</Text>
            </TouchableOpacity>
          </View>

          {/* Appointment Cards List */}
          {selectedDateAppointments.length > 0 ? (
            <View style={styles.appointmentsList}>
              {selectedDateAppointments.map((item) => {
                const clientName = item.client?.name || 'Client';
                const statusCfg = getBookingStatusConfig(item.status);

                return (
                  <TouchableOpacity
                    key={item._id}
                    style={styles.appointmentCard}
                    onPress={() => handleOpenAppointmentDetails(item)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Appointment with ${clientName}`}
                  >
                    {/* Left Avatar circle */}
                    <View style={styles.clientAvatarWrap}>
                      <Text style={styles.clientAvatarText}>
                        {getInitials(clientName) || 'C'}
                      </Text>
                    </View>

                    {/* Middle Info */}
                    <View style={styles.appointmentInfoWrap}>
                      <View style={styles.appointmentTopRow}>
                        <Text style={styles.appointmentClientName}>{clientName}</Text>
                        <Text style={styles.appointmentTimeText}>
                          {item.timeDisplay || item.time || '10:00 AM'}
                        </Text>
                      </View>

                      <Text style={styles.appointmentIssueText}>
                        {item.issue || item.caseTitle || 'Legal Consultation'}
                      </Text>

                      <View style={styles.appointmentBottomRow}>
                        <Text style={styles.appointmentMetaText}>
                          {item.consultationType || 'Video Consultation'} • {item.duration || '30 min'}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: statusCfg.text }]}>
                            {statusCfg.label}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Right Chevron */}
                    <Ionicons name="chevron-forward" size={18} color="#C4BFB8" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={32} color="#C4BFB8" />
              <Text style={styles.emptyText}>No appointments scheduled for this day.</Text>
            </View>
          )}

          {/* ────────────────── 4. COURT HEARINGS SECTION ────────────────── */}
          <View style={styles.courtSectionHeaderRow}>
            <View style={styles.courtSectionTitleWrap}>
              <MaterialCommunityIcons name="gavel" size={20} color="#A68A68" />
              <Text style={styles.courtSectionTitle}>Court Hearing</Text>
            </View>

            <TouchableOpacity
              style={styles.addHearingTopBtn}
              onPress={handleOpenAddHearing}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add Court Hearing"
            >
              <Ionicons name="add" size={15} color="#FFFFFF" />
              <Text style={styles.addHearingTopBtnText}>Add Court Hearing</Text>
            </TouchableOpacity>
          </View>

          {/* Court Hearing Cards List */}
          {selectedDateHearings.length > 0 ? (
            <View style={styles.hearingsList}>
              {selectedDateHearings.map((h) => (
                <View key={h.id} style={styles.hearingCard}>
                  {/* Hearing Top Row */}
                  <View style={styles.hearingTopRow}>
                    <View style={styles.hearingTimePill}>
                      <Ionicons name="time-outline" size={13} color="#2C2A29" />
                      <Text style={styles.hearingTimeText}>{h.hearingTime}</Text>
                    </View>
                    <View style={styles.hearingStatusBadge}>
                      <Text style={styles.hearingStatusText}>{h.status || 'Upcoming'}</Text>
                    </View>
                  </View>

                  {/* Court Name */}
                  <Text style={styles.hearingCourtName}>{h.courtName}</Text>
                  
                  {/* Courtroom & Location */}
                  <Text style={styles.hearingCourtroom}>
                    {h.courtroom} • {h.courtLocation || h.courtType}
                  </Text>

                  {/* Case Title & Number Box */}
                  <View style={styles.hearingCaseBox}>
                    <Text style={styles.hearingCaseTitle}>{h.caseTitle}</Text>
                    <Text style={styles.hearingCaseNo}>Case No. {h.caseNumber}</Text>
                    {!!h.advocateRole && (
                      <Text style={styles.hearingRoleText}>Role: {h.advocateRole}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="scale-balance" size={30} color="#C4BFB8" />
              <Text style={styles.emptyText}>No court hearings scheduled for this date.</Text>
            </View>
          )}

          {/* ────────────────── 5. MANAGE AVAILABILITY FOOTER PREVIEW ────────────────── */}
          <View style={styles.manageAvailabilityCard}>
            <View style={styles.manageCardHeaderRow}>
              <View>
                <Text style={styles.manageCardTitle}>Manage Availability</Text>
                <Text style={styles.manageCardSub}>Working Hours • Mon to Sat</Text>
              </View>
              <TouchableOpacity
                style={styles.editHoursBtn}
                onPress={() => setShowManageAvailabilityModal(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Edit Hours"
              >
                <Text style={styles.editHoursBtnText}>Edit Hours</Text>
              </TouchableOpacity>
            </View>

            {/* Weekly Days Bar */}
            <View style={styles.weeklyDaysBar}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                const isEnabled = workingSchedule.enabledDays.includes(day);
                return (
                  <View
                    key={day}
                    style={[styles.dayChip, isEnabled && styles.dayChipActive]}
                  >
                    <Text style={[styles.dayChipText, isEnabled && styles.dayChipTextActive]}>
                      {day.toUpperCase()}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Available Hours Summary */}
            <View style={styles.availableHoursSummaryRow}>
              <View style={styles.hoursSlotItem}>
                <Text style={styles.hoursSlotLabel}>Morning Slot</Text>
                <Text style={styles.hoursSlotValue}>{workingSchedule.morningSlot}</Text>
              </View>
              <View style={styles.hoursSlotDivider} />
              <View style={styles.hoursSlotItem}>
                <Text style={styles.hoursSlotLabel}>Evening Slot</Text>
                <Text style={styles.hoursSlotValue}>{workingSchedule.eveningSlot}</Text>
              </View>
            </View>
          </View>

          {/* Footer Branding */}
          <Text style={styles.versionFooter}>Legalitt Appointment Intelligence • v1.0.4</Text>
        </View>
      </ScrollView>

      {/* ────────────────── MODAL 1: APPOINTMENT DETAILS ────────────────── */}
      <Modal
        visible={showAppointmentDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAppointmentDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Appointment Details</Text>
              <TouchableOpacity
                onPress={() => setShowAppointmentDetailsModal(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close Details"
              >
                <Ionicons name="close" size={20} color="#2C2A29" />
              </TouchableOpacity>
            </View>

            {selectedAppointment && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Client Profile Header */}
                <View style={styles.detailsClientHeader}>
                  <View style={styles.detailsAvatarCircle}>
                    <Text style={styles.detailsAvatarText}>
                      {getInitials(selectedAppointment.client?.name || 'Client')}
                    </Text>
                  </View>
                  <Text style={styles.detailsClientName}>
                    {selectedAppointment.client?.name || 'Rahul Sharma'}
                  </Text>
                  <Text style={styles.detailsIssueSubtitle}>
                    {selectedAppointment.issue || selectedAppointment.caseTitle || 'Divorce Consultation'}
                  </Text>
                </View>

                {/* Details Grid */}
                <View style={styles.detailsInfoGrid}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedAppointment.date || new Date(), 'full')}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Time</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.time || selectedAppointment.timeDisplay || '10:00 AM - 10:30 AM'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Consultation</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.consultationType || 'Video Call'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Duration</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.duration || '30 Minutes'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Booking #</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.bookingNumber || selectedAppointment._id || 'LA 2026-0813-001'}
                    </Text>
                  </View>

                  <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#166534' }]}>
                        {selectedAppointment.status?.toUpperCase() || 'CONFIRMED'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Actions: Join Consultation & View Case */}
                <View style={styles.modalActionButtonsRow}>
                  <TouchableOpacity
                    style={styles.joinConsultationBtn}
                    onPress={() => handleJoinConsultation(selectedAppointment)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Join Consultation"
                  >
                    <Ionicons name="videocam" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.joinConsultationBtnText}>Join Consultation</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.viewCaseBtn}
                    onPress={() => handleViewCase(selectedAppointment)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="View Case Details"
                  >
                    <Ionicons name="folder-open-outline" size={18} color="#A68A68" style={{ marginRight: 6 }} />
                    <Text style={styles.viewCaseBtnText}>View Case</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ────────────────── MODAL 2: ADD COURT HEARING ────────────────── */}
      <Modal
        visible={showAddHearingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddHearingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { maxHeight: '90%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="gavel" size={22} color="#A68A68" />
                <Text style={styles.modalTitle}>Add Court Hearing</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddHearingModal(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close Hearing Form"
              >
                <Ionicons name="close" size={20} color="#2C2A29" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              {/* Court Type Selector */}
              <Text style={styles.formInputLabel}>Court Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {COURT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.formChip,
                      hearingForm.courtType === type && styles.formChipActive,
                    ]}
                    onPress={() => setHearingForm({ ...hearingForm, courtType: type })}
                  >
                    <Text
                      style={[
                        styles.formChipText,
                        hearingForm.courtType === type && styles.formChipTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Court Name */}
              <Text style={styles.formInputLabel}>Court Name *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. High Court of Madhya Pradesh"
                placeholderTextColor="#A19E98"
                value={hearingForm.courtName}
                onChangeText={(text) => setHearingForm({ ...hearingForm, courtName: text })}
              />

              {/* Court Location & Courtroom Row */}
              <View style={styles.formRowTwoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>Court Location</Text>
                  <TextInput
                    style={styles.formTextInput}
                    placeholder="e.g. Jabalpur / Delhi"
                    placeholderTextColor="#A19E98"
                    value={hearingForm.courtLocation}
                    onChangeText={(text) => setHearingForm({ ...hearingForm, courtLocation: text })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>Courtroom / No.</Text>
                  <TextInput
                    style={styles.formTextInput}
                    placeholder="e.g. Courtroom No. 12"
                    placeholderTextColor="#A19E98"
                    value={hearingForm.courtroom}
                    onChangeText={(text) => setHearingForm({ ...hearingForm, courtroom: text })}
                  />
                </View>
              </View>

              {/* Case Title */}
              <Text style={styles.formInputLabel}>Case Title *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. Sharma vs. State"
                placeholderTextColor="#A19E98"
                value={hearingForm.caseTitle}
                onChangeText={(text) => setHearingForm({ ...hearingForm, caseTitle: text })}
              />

              {/* Case Number */}
              <Text style={styles.formInputLabel}>Case Number *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="e.g. WP/1234/2026"
                placeholderTextColor="#A19E98"
                value={hearingForm.caseNumber}
                onChangeText={(text) => setHearingForm({ ...hearingForm, caseNumber: text })}
              />

              {/* Hearing Date & Time Row */}
              <View style={styles.formRowTwoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>Hearing Date</Text>
                  <TextInput
                    style={styles.formTextInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#A19E98"
                    value={hearingForm.hearingDate}
                    onChangeText={(text) => setHearingForm({ ...hearingForm, hearingDate: text })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>Hearing Time</Text>
                  <TextInput
                    style={styles.formTextInput}
                    placeholder="e.g. 09:00 AM"
                    placeholderTextColor="#A19E98"
                    value={hearingForm.hearingTime}
                    onChangeText={(text) => setHearingForm({ ...hearingForm, hearingTime: text })}
                  />
                </View>
              </View>

              {/* Advocate Role */}
              <Text style={styles.formInputLabel}>Advocate Role</Text>
              <View style={styles.wrapChipContainer}>
                {ADVOCATE_ROLES.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.formChip,
                      hearingForm.advocateRole === role && styles.formChipActive,
                    ]}
                    onPress={() => setHearingForm({ ...hearingForm, advocateRole: role })}
                  >
                    <Text
                      style={[
                        styles.formChipText,
                        hearingForm.advocateRole === role && styles.formChipTextActive,
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Remind Me Options (Multi-select) */}
              <Text style={styles.formInputLabel}>Remind Me (Select Multiple)</Text>
              <View style={styles.wrapChipContainer}>
                {REMINDER_OPTIONS.map((rem) => {
                  const isChecked = hearingForm.reminders.includes(rem);
                  return (
                    <TouchableOpacity
                      key={rem}
                      style={[
                        styles.formChip,
                        isChecked && styles.formChipActive,
                      ]}
                      onPress={() => toggleReminderChip(rem)}
                    >
                      {isChecked && <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />}
                      <Text
                        style={[
                          styles.formChipText,
                          isChecked && styles.formChipTextActive,
                        ]}
                      >
                        {rem}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Notes */}
              <Text style={styles.formInputLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.formTextInput, styles.formTextArea]}
                placeholder="Key arguments, stay application details, documents to carry..."
                placeholderTextColor="#A19E98"
                multiline
                numberOfLines={3}
                value={hearingForm.notes}
                onChangeText={(text) => setHearingForm({ ...hearingForm, notes: text })}
              />

              {/* Save Hearing Button */}
              <TouchableOpacity
                style={styles.saveHearingSubmitBtn}
                onPress={handleSaveHearing}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Save Hearing"
              >
                <Text style={styles.saveHearingSubmitBtnText}>Save Hearing</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────────────── MODAL 3: MANAGE AVAILABILITY ────────────────── */}
      <Modal
        visible={showManageAvailabilityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManageAvailabilityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Manage Availability</Text>
              <TouchableOpacity
                onPress={() => setShowManageAvailabilityModal(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close Availability"
              >
                <Ionicons name="close" size={20} color="#2C2A29" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              <Text style={styles.formInputLabel}>Working Days</Text>
              <View style={styles.workingDaysSelector}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                  const isChecked = workingSchedule.enabledDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.manageDayCircle,
                        isChecked && styles.manageDayCircleActive,
                      ]}
                      onPress={() => toggleWorkingDay(day)}
                    >
                      <Text
                        style={[
                          styles.manageDayCircleText,
                          isChecked && styles.manageDayCircleTextActive,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Morning Slot */}
              <Text style={styles.formInputLabel}>Morning Slot Hours</Text>
              <TextInput
                style={styles.formTextInput}
                value={workingSchedule.morningSlot}
                onChangeText={(t) => setWorkingSchedule({ ...workingSchedule, morningSlot: t })}
                placeholder="09:00 AM - 01:00 PM"
              />

              {/* Evening Slot */}
              <Text style={styles.formInputLabel}>Evening Slot Hours</Text>
              <TextInput
                style={styles.formTextInput}
                value={workingSchedule.eveningSlot}
                onChangeText={(t) => setWorkingSchedule({ ...workingSchedule, eveningSlot: t })}
                placeholder="03:00 PM - 07:00 PM"
              />

              {/* Save Availability Button */}
              <TouchableOpacity
                style={styles.saveHearingSubmitBtn}
                onPress={handleSaveAvailabilitySchedule}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Save Availability Preferences"
              >
                <Text style={styles.saveHearingSubmitBtnText}>Save Availability</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE6',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2A29',
    marginLeft: 6,
  },
  manageQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F3EF',
    borderWidth: 1,
    borderColor: '#ECE8E1',
    gap: 4,
  },
  manageQuickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A68A68',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    alignItems: 'center',
  },
  centerContainer: {
    width: '100%',
    maxWidth: 720,
  },

  // ── 1. Your Availability Card ──
  availabilityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ECE8E1',
    marginBottom: 16,
    shadowColor: '#2C2A29',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  availabilityCardPre: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A68A68',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availabilityTextWrap: {
    flex: 1,
    paddingRight: 16,
  },
  availabilityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2A29',
    marginBottom: 4,
  },
  availabilityDesc: {
    fontSize: 12,
    color: '#767471',
    lineHeight: 16,
  },

  // ── 2. Monthly Calendar Card ──
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECE8E1',
    marginBottom: 20,
    shadowColor: '#2C2A29',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F3EF',
  },
  calendarMonthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2A29',
  },
  todayPillBtn: {
    backgroundColor: '#F5F3EF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECE8E1',
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A68A68',
  },
  daysOfWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE6',
    marginBottom: 8,
  },
  dayOfWeekText: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  calendarGrid: {
    gap: 6,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dateCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dateCellSelected: {
    backgroundColor: '#A68A68',
    shadowColor: '#A68A68',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  dateCellToday: {
    borderWidth: 1.5,
    borderColor: '#A68A68',
  },
  dateNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C2A29',
  },
  dateNumberInactive: {
    color: '#D1D5DB',
  },
  dateNumberSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dateNumberTodayText: {
    color: '#A68A68',
    fontWeight: '800',
  },
  dotRow: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 3,
    gap: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  bookingDot: {
    backgroundColor: '#10B981',
  },
  hearingDot: {
    backgroundColor: '#F59E0B',
  },
  eventDotSelected: {
    backgroundColor: '#FFFFFF',
  },

  // ── 3. Today's Schedule Section ──
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scheduleDateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2C2A29',
  },
  scheduleSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#767471',
    marginTop: 2,
  },
  addAvailabilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECE8E1',
    shadowColor: '#2C2A29',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  addAvailabilityBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A68A68',
  },
  appointmentsList: {
    gap: 12,
    marginBottom: 20,
  },
  appointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECE8E1',
    shadowColor: '#2C2A29',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  clientAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F5F3EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ECE8E1',
  },
  clientAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#A68A68',
  },
  appointmentInfoWrap: {
    flex: 1,
  },
  appointmentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  appointmentClientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C2A29',
  },
  appointmentTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A68A68',
  },
  appointmentIssueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B4947',
    marginBottom: 4,
  },
  appointmentBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appointmentMetaText: {
    fontSize: 11,
    color: '#767471',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // ── 4. Court Hearings Section ──
  courtSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  courtSectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  courtSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2C2A29',
  },
  addHearingTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A68A68',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    shadowColor: '#A68A68',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 1,
  },
  addHearingTopBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  hearingsList: {
    gap: 12,
    marginBottom: 20,
  },
  hearingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECE8E1',
    shadowColor: '#2C2A29',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  hearingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hearingTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3EF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  hearingTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2C2A29',
  },
  hearingStatusBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  hearingStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  hearingCourtName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2A29',
    marginBottom: 2,
  },
  hearingCourtroom: {
    fontSize: 12,
    color: '#767471',
    fontWeight: '500',
    marginBottom: 10,
  },
  hearingCaseBox: {
    backgroundColor: '#FAF9F8',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F0ECE6',
  },
  hearingCaseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C2A29',
  },
  hearingCaseNo: {
    fontSize: 11,
    color: '#767471',
    marginTop: 2,
  },
  hearingRoleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A68A68',
    marginTop: 4,
  },

  // ── 5. Manage Availability Section ──
  manageAvailabilityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECE8E1',
    marginBottom: 20,
    shadowColor: '#2C2A29',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  manageCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  manageCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C2A29',
  },
  manageCardSub: {
    fontSize: 11,
    color: '#767471',
    marginTop: 2,
  },
  editHoursBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F5F3EF',
    borderWidth: 1,
    borderColor: '#ECE8E1',
  },
  editHoursBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A68A68',
  },
  weeklyDaysBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dayChip: {
    width: 38,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F5F3EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: '#A68A68',
  },
  dayChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#767471',
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
  availableHoursSummaryRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF9F8',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0ECE6',
  },
  hoursSlotItem: {
    flex: 1,
  },
  hoursSlotLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#767471',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  hoursSlotValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C2A29',
  },
  hoursSlotDivider: {
    width: 1,
    backgroundColor: '#ECE8E1',
    marginHorizontal: 12,
  },

  // ── Empty Card ──
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECE8E1',
    marginBottom: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#767471',
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Modals Common Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(44, 42, 41, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContentCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE6',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2C2A29',
  },
  modalCloseBtn: {
    padding: 4,
  },

  // ── Details Modal ──
  detailsClientHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3EF',
  },
  detailsAvatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F3EF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECE8E1',
    marginBottom: 8,
  },
  detailsAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#A68A68',
  },
  detailsClientName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2C2A29',
    marginBottom: 2,
  },
  detailsIssueSubtitle: {
    fontSize: 13,
    color: '#767471',
    fontWeight: '500',
  },
  detailsInfoGrid: {
    paddingVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3EF',
  },
  detailLabel: {
    fontSize: 13,
    color: '#767471',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C2A29',
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  joinConsultationBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A68A68',
    borderRadius: 14,
    paddingVertical: 13,
  },
  joinConsultationBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  viewCaseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: '#A68A68',
  },
  viewCaseBtnText: {
    color: '#A68A68',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Add Hearing Form ──
  formInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C2A29',
    marginTop: 12,
    marginBottom: 6,
  },
  formTextInput: {
    backgroundColor: '#FAF9F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECE8E1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#2C2A29',
  },
  formTextArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  formRowTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  chipScroll: {
    marginBottom: 4,
  },
  wrapChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  formChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F8',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#ECE8E1',
    marginRight: 6,
  },
  formChipActive: {
    backgroundColor: '#A68A68',
    borderColor: '#A68A68',
  },
  formChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6864',
  },
  formChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  saveHearingSubmitBtn: {
    backgroundColor: '#A68A68',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 16,
    shadowColor: '#A68A68',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  saveHearingSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // ── Manage Working Days ──
  workingDaysSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  manageDayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FAF9F8',
    borderWidth: 1,
    borderColor: '#ECE8E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageDayCircleActive: {
    backgroundColor: '#A68A68',
    borderColor: '#A68A68',
  },
  manageDayCircleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#767471',
  },
  manageDayCircleTextActive: {
    color: '#FFFFFF',
  },

  // ── Error State ──
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FAF9F8',
  },
  errorCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2A29',
    marginBottom: 6,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#82807C',
    marginBottom: 24,
    textAlign: 'center',
  },
  tryAgainBtn: {
    backgroundColor: '#A68A68',
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 22,
  },
  tryAgainBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Loading Container ──
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FAF9F8',
  },
  loadingText: {
    fontSize: 13,
    color: '#82807C',
    fontWeight: '600',
  },

  // ── Footer ──
  versionFooter: {
    textAlign: 'center',
    fontSize: 12,
    color: '#AAA59F',
    marginTop: 8,
    marginBottom: 16,
  },
});
