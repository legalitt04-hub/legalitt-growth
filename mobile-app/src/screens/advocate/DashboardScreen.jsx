import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Switch, RefreshControl, Image, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useChatList } from '../../hooks/useChat';
import { COLORS } from '../../constants/theme';
import { formatINR } from '../../utils/helpers';
import { getSocket } from '../../services/socket';
import Constants from 'expo-constants';

// Subcomponents
import StatsCard from '../../components/advocate/StatsCard';
import AppointmentCard from '../../components/advocate/AppointmentCard';
import EarningsSummary from '../../components/advocate/EarningsSummary';
import RecentReviewsSection from '../../components/advocate/RecentReviewsSection';
import Svg, { Polyline, Circle } from 'react-native-svg';

// Mini line chart using SVG Polyline and Circle
const AnalyticsChart = ({ dataPoints, labels }) => {
  const width = 340;
  const height = 90;
  const padding = 15;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  
  const maxPoint = Math.max(...dataPoints, 1);
  const minPoint = Math.min(...dataPoints, 0);
  const range = maxPoint - minPoint || 1;
  
  const svgPoints = dataPoints.map((p, i) => {
    const x = padding + (i / (dataPoints.length - 1)) * chartWidth;
    const y = height - padding - ((p - minPoint) / range) * chartHeight;
    return { x, y };
  });
  
  const pointsStr = svgPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <View style={chartStyles.container}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <Polyline
          fill="none"
          stroke={COLORS.primary}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsStr}
        />
        {svgPoints.map((p, i) => (
          <View key={i}>
            <Circle cx={p.x} cy={p.y} r="4" fill={COLORS.primary} stroke="#FFFFFF" strokeWidth="1.5" />
          </View>
        ))}
      </Svg>
      <View style={chartStyles.labelRow}>
        {labels.map((l, i) => (
          <Text key={i} style={chartStyles.label}>{l}</Text>
        ))}
      </View>
    </View>
  );
};

// Mini bar chart component
const BarChart = ({ data, labels }) => {
  const max = Math.max(...data, 1);
  return (
    <View style={barChartStyles.container}>
      {data.map((val, i) => (
        <View key={i} style={barChartStyles.barWrap}>
          <View style={barChartStyles.barBg}>
            <View style={[barChartStyles.bar, { height: `${max ? (val / max) * 100 : 0}%`, backgroundColor: COLORS.primary }]} />
          </View>
          <Text style={barChartStyles.label}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
};

const barChartStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
    paddingTop: 16,
    paddingHorizontal: 8,
  },
  barWrap: {
    alignItems: 'center',
    flex: 1,
  },
  barBg: {
    width: 14,
    height: 60,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
  },
  label: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 8,
    fontWeight: '600',
  },
});

const chartStyles = StyleSheet.create({
  container: { height: 110, marginTop: 12, overflow: 'hidden', paddingHorizontal: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 12 },
  label: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
});

const AdvocateDashboardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { chats, refetch } = useChatList();
  const unreadCount = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const [online, setOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refetch();
    });
    return unsubscribe;
  }, [navigation, refetch]);
  
  // Dashboard state
  const [dashboardData, setDashboardData] = useState({
    todayAppointments: [],
    pendingMessagesCount: 0,
    recentReviews: [],
    ratingStats: null,
    earningsSummary: { daily: 0, weekly: 0, monthly: 0 },
    profileCompletion: 0,
    analytics: {
      labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      caseTrend: [0, 0, 0, 0, 0, 0, 0],
      earningsTrend: [0, 0, 0, 0, 0, 0, 0],
      labelsMonthly: ['Mon1', 'Mon2', 'Mon3', 'Mon4', 'Mon5', 'Mon6'],
      monthlyEarningsTrend: [0, 0, 0, 0, 0, 0]
    }
  });

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/advocate-dashboard/stats');
      if (response.data?.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.log('Error fetching advocate dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ─── Real-time: listen for new booking assigned by admin ────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const { ZEGO_APP_ID, ZEGO_APP_SIGN } = Constants.expoConfig?.extra || {};
    const advocateUser = user?.user || user || {};

    const handleNewBooking = (data) => {
      const modeEmoji = { chat: '💬', voice: '📞', video: '📹' };
      const emoji = modeEmoji[data.consultationMode] || '⚖️';

      Alert.alert(
        `${emoji} New Case Assigned!`,
        `${data.client?.name || 'A client'} needs ${data.consultationMode} consultation.\n\n"${(data.issue || '').substring(0, 80)}${(data.issue || '').length > 80 ? '...' : ''}"`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: data.consultationMode === 'chat' ? 'Open Chat' : 'Join Call',
            onPress: () => {
              if (data.consultationMode === 'chat' && data.chatId) {
                navigation.navigate('Chat', {
                  chatId: data.chatId,
                  advocateName: data.client?.name || 'Client',
                  advocateAvatar: data.client?.avatar,
                  advocateId: data.client?._id,
                });
              } else if (data.consultationMode === 'voice' || data.consultationMode === 'video') {
                navigation.navigate('AdvocateCall', {
                  clientName:   data.client?.name || 'Client',
                  clientAvatar: data.client?.avatar,
                  mode:         data.consultationMode,
                  bookingId:    data.bookingId,
                  clientId:     data.client?._id,
                  // Zego credentials from admin assignment notification
                  zegoRoomId:   data.zegoRoomId    || data.videoRoomId    || null,
                  zegoToken:    data.advocateToken || data.advocateVideoToken || null,
                  zegoAppId:    data.zegoAppId     || 0,
                  myUserId:     advocateUser._id   || advocateUser.id || '',
                  myUserName:   advocateUser.name  || 'Advocate',
                });
              }
            },
          },
        ]
      );
      // Also refresh dashboard counts
      fetchDashboardData();
    };

    const handleIncomingCall = (callData) => {
      // Show Alert so advocate can accept or decline — don't navigate blindly
      const modeLabel = callData?.mode === 'video' ? '📹 Video' : '📞 Voice';
      const clientName = callData?.clientName || callData?.client?.name || 'Client';

      Alert.alert(
        `${modeLabel} Call Incoming!`,
        `${clientName} is calling you right now.\nTap Accept to join the call.`,
        [
          { text: 'Decline', style: 'destructive' },
          {
            text: '✅ Accept',
            onPress: () => {
              navigation.navigate('AdvocateCall', {
                clientName,
                clientAvatar: callData?.clientAvatar || callData?.client?.avatar || null,
                mode:         callData?.mode || 'video',
                bookingId:    callData?.bookingId,
                clientId:     callData?.clientId || callData?.client?._id,
                zegoRoomId:   callData?.zegoRoomId   || callData?.videoRoomId   || null,
                zegoToken:    callData?.advocateToken || callData?.advocateVideoToken || null,
                zegoAppId:    callData?.zegoAppId    || 0,
                myUserId:     advocateUser._id || advocateUser.id || '',
                myUserName:   advocateUser.name || 'Advocate',
              });
            },
          },
        ],
        { cancelable: false }
      );
    };

    const handleSlotScheduled = (data) => {
      Alert.alert(
        '\uD83D\uDCC5 Consultation Scheduled',
        `${data?.clientName || 'Client'} has scheduled a ${data?.mode || ''} consultation.\n\nTime: ${data?.scheduledAt ? new Date(data.scheduledAt).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD'}`,
        [{ text: 'OK', onPress: () => fetchDashboardData() }]
      );
    };

    socket.on('new_booking_assigned', handleNewBooking);
    socket.on('incoming_call', handleIncomingCall);
    socket.on('slot_scheduled', handleSlotScheduled);
    return () => {
      socket.off('new_booking_assigned', handleNewBooking);
      socket.off('incoming_call', handleIncomingCall);
      socket.off('slot_scheduled', handleSlotScheduled);
    };
  }, [navigation, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handleProfilePress = () => {
    try {
      navigation.navigate('AdvocateProfileEdit');
    } catch (e) {
      const parent = navigation.getParent();
      if (parent) {
        try {
          parent.navigate('AdvocateProfileEdit');
        } catch (parentErr) {
          Alert.alert('Navigation Error', 'Could not open Profile: ' + parentErr.message);
        }
      } else {
        Alert.alert('Navigation Error', 'Could not find parent stack: ' + e.message);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your practice account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive', 
          onPress: async () => {
            // Each step wrapped individually — logout ALWAYS succeeds
            try { await AsyncStorage.removeItem('legalitt_onboarded'); } catch (_) {}
            try { await logout(); } catch (_) {}
            // AppNavigator's navigationRef handles redirect to Onboarding
          } 
        }
      ]
    );
  };

  const handleAcceptAppointment = async (id) => {
    try {
      await api.patch(`/bookings/${id}/status`, { status: 'confirmed' });
      Alert.alert('Success', 'Consultation accepted successfully!');
      fetchDashboardData();
    } catch {
      Alert.alert('Error', 'Failed to confirm booking.');
    }
  };

  const handleRejectAppointment = async (id) => {
    Alert.alert('Decline Booking', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: async () => {
        try {
          await api.patch(`/bookings/${id}/status`, { status: 'cancelled', cancellationReason: 'Declined by advocate' });
          fetchDashboardData();
        } catch {
          Alert.alert('Error', 'Failed to decline booking.');
        }
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleProfilePress} style={styles.avatarCircle}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
          ) : (
            <Text style={styles.avatarCircleText}>{(user?.name || 'A')[0].toUpperCase()}</Text>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: '#6B7280' }}>{getGreeting()},</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.textPrimary }}>{user?.name?.split(' ')[0] || 'Advocate'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => navigation.navigate('ChatList')} style={styles.headerIconBtn}>
            <View style={{ position: 'relative' }}>
              <Ionicons name="chatbubble-outline" size={20} color={COLORS.textPrimary} />
              {unreadCount > 0 && (
                <View style={styles.badgeDot} />
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.headerIconBtn}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.headerIconBtn}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(insets.bottom, 12) + 115,
        }}
      >
        {/* Profile Card & Completion Status */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardTop}>
            <TouchableOpacity 
              style={styles.profileClickableArea}
              activeOpacity={0.7}
              onPress={handleProfilePress}
            >
              <View style={styles.profileAvatarWrap}>
                <View style={styles.profileAvatar}>
                  {user?.avatar ? (
                    <Image source={{ uri: user.avatar }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                  ) : (
                    <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.primary }}>{(user?.name || 'A')[0].toUpperCase()}</Text>
                  )}
                </View>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.name || 'Advocate'}</Text>
                <View style={styles.verifiedRow}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                  <Text style={styles.verifiedText}>verified advocate</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.onlineToggle}>
              <Text style={[styles.onlineLabel, { color: online ? COLORS.primary : COLORS.textSecondary }]}>
                {online ? 'Online' : 'Offline'}
              </Text>
              <Switch
                value={online}
                onValueChange={(val) => {
                  setOnline(val);
                }}
                trackColor={{ false: '#E5E7EB', true: COLORS.primaryLight }}
                thumbColor={online ? COLORS.primary : '#9CA3AF'}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={styles.completionContainer}
            activeOpacity={0.7}
            onPress={handleProfilePress}
          >
            <View style={styles.completionLabelRow}>
              <Text style={styles.completionLabel}>Practice Profile Completion</Text>
              <Text style={styles.completionPercent}>{dashboardData.profileCompletion}%</Text>
            </View>
            <View style={styles.completionBarBg}>
              <View style={[styles.completionBar, { width: `${dashboardData.profileCompletion}%` }]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Dynamic Analytics StatsCards Grid */}
        <View style={styles.statsGrid}>
          <StatsCard 
            title="Today Cases" 
            value={dashboardData.todayAppointments.length} 
            subtitle="Appointments" 
            icon="calendar" 
            color={COLORS.primary} 
            onPress={() => navigation.navigate('TodayCases')}
          />
          <StatsCard 
            title="Pending Chats" 
            value={dashboardData.pendingMessagesCount} 
            subtitle="Unread" 
            icon="chatbubbles-outline" 
            color="#3B82F6" 
            onPress={() => navigation.navigate('ChatList')}
          />
        </View>

        {/* Dynamic Earnings breakdown progress summary */}
        <EarningsSummary summary={dashboardData.earningsSummary} />

        {/* Today's appointments Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TodayCases')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {dashboardData.todayAppointments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={32} color="#D1D5DB" />
            <Text style={styles.emptyText}>No appointments scheduled for today.</Text>
          </View>
        ) : (
          dashboardData.todayAppointments.map((item) => (
            <AppointmentCard 
              key={item._id}
              appointment={item}
              onAccept={() => handleAcceptAppointment(item._id)}
              onReject={() => handleRejectAppointment(item._id)}
              onViewDetails={() => navigation.navigate('CaseDetail', { booking: item })}
            />
          ))
        )}

        {/* SVG Analytics Chart trend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Earnings Analytics (Last 7 Days)</Text>
          <AnalyticsChart 
            dataPoints={dashboardData.analytics.earningsTrend} 
            labels={dashboardData.analytics.labels} 
          />
        </View>

        {/* Monthly Earnings Bar Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Earnings (Last 6 Months)</Text>
          <BarChart 
            data={dashboardData.analytics.monthlyEarningsTrend || [0, 0, 0, 0, 0, 0]} 
            labels={dashboardData.analytics.labelsMonthly || ['-', '-', '-', '-', '-', '-']} 
          />
        </View>

        {/* Quick actions panel */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Practice Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleProfilePress}>
              <View style={[styles.actionIconBg, { backgroundColor: 'rgba(20, 184, 166, 0.1)' }]}>
                <Ionicons name="create-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.actionLabel}>Edit Details</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Earnings')}>
              <View style={[styles.actionIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="wallet-outline" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.actionLabel}>Withdrawal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('Share Link', 'Copied your professional profile card link!')}>
              <View style={[styles.actionIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="share-social-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.actionLabel}>Share profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Client Reviews Section */}
        <RecentReviewsSection
          reviews={dashboardData.recentReviews || []}
          ratingStats={dashboardData.ratingStats}
          advocateRating={user?.rating}
          onViewAll={() => {
            try {
              navigation.navigate('ReviewRating');
            } catch {
              const parent = navigation.getParent();
              if (parent) {
                try {
                  parent.navigate('ReviewRating');
                } catch (e) {
                  console.log('Navigation to ReviewRating failed:', e);
                }
              }
            }
          }}
          onReviewPress={(rev) => {
            if (rev.booking?._id || rev.booking) {
              const bookingObj = typeof rev.booking === 'object' ? rev.booking : { _id: rev.booking };
              try {
                navigation.navigate('CaseDetail', { booking: bookingObj });
              } catch {
                // Ignore if not applicable
              }
            }
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderColor: '#F3F4F6'
  },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(20, 184, 166, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarCircleText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  greeting: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  profileCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    marginBottom: 16
  },
  profileCardTop: { flexDirection: 'row', alignItems: 'center' },
  profileClickableArea: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  profileAvatarWrap: { marginRight: 16 },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(20, 184, 166, 0.1)', alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  verifiedText: { fontSize: 12, color: COLORS.primary, fontWeight: '600', textTransform: 'capitalize' },
  onlineToggle: { alignItems: 'center', gap: 4 },
  onlineLabel: { fontSize: 11, fontWeight: '600' },
  
  completionContainer: { marginTop: 14 },
  completionLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  completionLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  completionPercent: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  completionBarBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  completionBar: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },

  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  viewAllText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 16 },
  emptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 8, fontWeight: '500', textAlign: 'center' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    marginBottom: 16
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  actionsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  actionBtn: { alignItems: 'center', flex: 1 },
  actionIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  actionLabel: { fontSize: 11, color: COLORS.textPrimary, fontWeight: '600' },
  badgeDot: {
    position: 'absolute',
    right: -4,
    top: -4,
    backgroundColor: '#EF4444',
    borderRadius: 5,
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});

export default AdvocateDashboardScreen;
