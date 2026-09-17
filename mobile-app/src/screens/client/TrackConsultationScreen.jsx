import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeScreen from '../../components/SafeScreen';
import { LEGAL_THEME } from '../../constants/legalAdviceTheme';
import { LogoHeader } from '../../components/legalAdvice/LogoHeader';
import { LawyerCard } from '../../components/legalAdvice/LawyerCard';
import { StatusTimeline } from '../../components/legalAdvice/StatusTimeline';
import { PrimaryButton } from '../../components/legalAdvice/PrimaryButton';
import { SecondaryButton } from '../../components/legalAdvice/SecondaryButton';
import { bookingAPI, legalAdviceAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function TrackConsultationScreen({ navigation, route }) {
  const initialData = route?.params?.bookingData || null;
  const { user } = useAuth();

  const [bookingData, setBookingData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchLiveConsultation = async () => {
    const id = route?.params?.bookingId || route?.params?.id || route?.params?.requestId || route?.params?.bookingData?._id || route?.params?.bookingData?.id;
    if (!id) {
      setLoadError('A valid consultation ID is required.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      let res;
      try {
        res = await bookingAPI.getBooking(id);
      } catch {
        res = await legalAdviceAPI.getRequestDetail(id);
      }
      if (!res.data?.success || !res.data?.data) throw new Error('Consultation was not found.');
      const live = res.data.data;
      setBookingData({
        ...live,
        requestId: live.requestId || live._id?.slice(-8)?.toUpperCase(),
        selectedType: { title: live.consultationMode || live.type || 'Consultation' },
        selectedMatter: { title: live.issueCategory || live.serviceType || 'Legal Advice' },
        scheduledTime: live.date ? new Date(live.date).toLocaleString('en-IN') : 'Time not scheduled',
        lawyer: live.advocate ? {
          id: live.advocate._id,
          userId: live.advocate.user?._id,
          name: live.advocate.user?.name || 'Assigned Advocate',
          title: live.advocate.title || 'Verified Advocate',
          experience: live.advocate.experience ? `${live.advocate.experience} Years Exp.` : '',
          rating: live.advocate.rating?.average || 0,
          reviewsCount: live.advocate.rating?.count || 0,
          avatarUri: live.advocate.user?.avatar || null,
        } : null,
      });
    } catch (err) {
      setLoadError(err?.response?.data?.message || err.message || 'Unable to load consultation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveConsultation();
  }, []);

  const handleJoin = async () => {
    const id = bookingData?._id || bookingData?.id;
    if (!id || !bookingData?.lawyer) {
      Alert.alert('Call Not Ready', 'An advocate must be assigned before the consultation can start.');
      return;
    }
    try {
      const { data } = await bookingAPI.canJoinCall(id);
      if (!data?.success || !data.canJoin) {
        Alert.alert('Call Not Available', data?.message || 'The consultation call window is not open.');
        return;
      }
      const call = data.data || {};
      navigation.navigate('VideoCall', {
        bookingId: id,
        zegoRoomId: call.zegoRoomId,
        zegoToken: call.zegoToken,
        zegoAppId: call.zegoAppId,
        mode: bookingData.consultationMode || bookingData.type || 'video',
        advocateName: bookingData.lawyer.name,
        advocateAvatar: bookingData.lawyer.avatarUri,
        advocateUserId: bookingData.lawyer.userId,
        clientId: user?._id || user?.id,
        myUserId: user?._id || user?.id,
        myUserName: user?.name || 'Client',
      });
    } catch (error) {
      Alert.alert('Call Not Available', error?.response?.data?.message || 'Secure call credentials could not be loaded.');
    }
  };

  const handleReschedule = () => navigation.navigate('MyBookings');
  const handleSupport = () => navigation.navigate('Support');
  const handleContact = () => {
    if (!bookingData?.chat) {
      Alert.alert('Chat Not Ready', 'Chat will be available after advocate assignment and payment confirmation.');
      return;
    }
    navigation.navigate('Chat', {
      chatId: bookingData.chat,
      bookingId: bookingData._id,
      advocateName: bookingData.lawyer?.name,
      advocateAvatar: bookingData.lawyer?.avatarUri,
      advocateId: bookingData.lawyer?.id,
    });
  };

  if (loading || loadError || !bookingData) {
    return (
      <SafeScreen backgroundColor="#07080A" barStyle="light-content">
        <LogoHeader title="Track Consultation" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {loading ? <ActivityIndicator color="#D4AF37" /> : <Text style={{ color: '#FFFFFF', textAlign: 'center' }}>{loadError || 'Consultation details are unavailable.'}</Text>}
        </View>
      </SafeScreen>
    );
  }

  const statusLabel = String(bookingData.status || 'pending').replace(/_/g, ' ');

  return (
    <SafeScreen backgroundColor="#07080A" barStyle="light-content">
      <LogoHeader title="Track Consultation" onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* STATUS HEADER CARD */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeaderRow}>
              <View style={styles.idContainer}>
                <Text style={styles.idLabel}>Request ID</Text>
                <Text style={styles.idText}>#{bookingData.requestId}</Text>
              </View>

              <View style={styles.statusBadge}>
                <View style={styles.greenDot} />
                <Text style={styles.statusBadgeText}>{statusLabel}</Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.meetingDetailRow}>
              <Ionicons name="calendar-outline" size={18} color="#D4AF37" />
              <Text style={styles.meetingTimeText}>{bookingData.scheduledTime}</Text>
            </View>

            <View style={styles.meetingDetailRow}>
              <Ionicons name="hardware-chip-outline" size={18} color="#D4AF37" />
              <Text style={styles.meetingTypeText}>{String(bookingData.selectedType?.title || 'Consultation').replace(/_/g, ' ')}</Text>
            </View>
          </View>

          {/* ADVOCATE CARD */}
          <Text style={styles.sectionTitle}>Your Assigned Advocate</Text>
          <LawyerCard
            name={bookingData.lawyer?.name}
            title={bookingData.lawyer?.title}
            experience={bookingData.lawyer?.experience}
            rating={bookingData.lawyer?.rating}
            reviewsCount={bookingData.lawyer?.reviewsCount}
            avatarUri={bookingData.lawyer?.avatarUri}
            onContact={handleContact}
          />

          {/* TIMELINE */}
          <StatusTimeline activeIndex={2} />

          {/* PRE-CONSULTATION NOTES / CHECKLIST */}
          <View style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <Ionicons name="information-circle-outline" size={20} color="#D4AF37" />
              <Text style={styles.notesTitle}>Pre-Consultation Checklist</Text>
            </View>
            <View style={styles.notesDivider} />
            <Text style={styles.bulletText}>• Ensure your phone/device has stable internet connectivity.</Text>
            <Text style={styles.bulletText}>• Keep relevant legal documents and property deeds handy.</Text>
            <Text style={styles.bulletText}>• Prepare key questions you want the advocate to address.</Text>
          </View>
        </ScrollView>

        {/* BOTTOM BUTTONS */}
        <View style={styles.bottomFooter}>
          <PrimaryButton
            title="Join Consultation Now"
            onPress={handleJoin}
            icon={<Ionicons name="call" size={18} color="#07080A" />}
          />

          <View style={styles.secondaryRow}>
            <SecondaryButton
              title="Reschedule"
              onPress={handleReschedule}
              style={styles.halfBtn}
            />
            <SecondaryButton
              title="Contact Support"
              onPress={handleSupport}
              style={styles.halfBtn}
            />
          </View>
        </View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080A',
  },
  scrollContent: {
    paddingHorizontal: LEGAL_THEME.spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 160,
  },
  statusCard: {
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#121722',
    borderColor: '#1E2638',
    borderRadius: 18,
    borderWidth: 1,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idContainer: {},
  idLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  idText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34D399',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#1E2638',
    marginVertical: 12,
  },
  meetingDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  meetingTimeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  meetingTypeText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  notesCard: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#121722',
    borderColor: '#1E2638',
    borderRadius: 18,
    borderWidth: 1,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  notesDivider: {
    height: 1,
    backgroundColor: '#1E2638',
    marginVertical: 10,
  },
  bulletText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 4,
  },
  bottomFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F131C',
    paddingHorizontal: LEGAL_THEME.spacing.screenPadding,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E2638',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    gap: 10,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  halfBtn: {
    flex: 1,
  },
});
