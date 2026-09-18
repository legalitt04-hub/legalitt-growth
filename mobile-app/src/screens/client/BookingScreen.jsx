// BookingScreen.jsx - Premium, streamlined booking screen with calendar/time-slot picker
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Image,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookingAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';

const TIME_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
];

const BookingScreen = ({ route, navigation }) => {
  const { isAuthenticated } = useAuth();
  const { advocateId, advocateName, fee, advocateAvatar } = route.params || {};
  const insets = useSafeAreaInsets();

  const [issue, setIssue] = useState('');
  const [loading, setLoading] = useState(false);

  // Generate next 14 days dynamically for the horizontal calendar selector
  const dates = useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push({
        id: i.toString(),
        rawDate: d,
        isoString: d.toISOString().split('T')[0],
        dayNum: d.getDate(),
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
        monthName: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()],
      });
    }
    return list;
  }, []);

  const [selectedDate, setSelectedDate] = useState(dates[0].isoString);
  const [selectedTime, setSelectedTime] = useState(null);

  const handleBook = async () => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRegister', { role: 'client' });
      return;
    }
    if (!issue.trim()) {
      Alert.alert('Required', 'Please describe your legal issue.');
      return;
    }
    if (!selectedDate) {
      Alert.alert('Required', 'Please select a preferred date from the calendar.');
      return;
    }
    if (!selectedTime) {
      Alert.alert('Required', 'Please select a preferred time slot.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await bookingAPI.create({
        advocateId,
        issue: issue.trim(),
        date: selectedDate,
        timeSlot: { startTime: selectedTime, endTime: selectedTime },
        type: 'video',             // Allow video/voice calls
        consultationMode: 'video', // Required for canJoinCall to allow call access
      });

      // Navigate to payment checkout
      navigation.navigate('Payment', { 
        bookingId: data.data._id, 
        amount: fee, 
        advocateName,
        advocateAvatar,
        advocateId
      });
    } catch (err) {
      console.error('❌ Booking failed:', err);
      Alert.alert('Booking Failed', err.response?.data?.message || 'Failed to book consultation. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Book Consultation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Simple & Clean Advocate Profile Header */}
        <View style={s.advocateHeader}>
          {advocateAvatar ? (
            <Image source={{ uri: advocateAvatar }} style={s.avatar} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Ionicons name="person" size={28} color="#FFFFFF" />
            </View>
          )}
          <View style={s.advocateMeta}>
            <Text style={s.advocateName}>{advocateName || 'Legal Advocate'}</Text>
            <Text style={s.advocateFee}>₹{fee} / Consultation</Text>
          </View>
        </View>

        {/* Date Selector Section */}
        <View style={s.sectionContainer}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Select Date</Text>
            <Text style={s.sectionSub}>{dates.find(d => d.isoString === selectedDate)?.monthName} {dates.find(d => d.isoString === selectedDate)?.dayNum}</Text>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={dates}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.datesContainer}
            renderItem={({ item }) => {
              const isSelected = selectedDate === item.isoString;
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setSelectedDate(item.isoString)}
                  style={[
                    s.dateCard,
                    isSelected && s.dateCardSelected
                  ]}
                >
                  <Text style={[s.dateMonth, isSelected && s.textWhiteSelected]}>
                    {item.monthName}
                  </Text>
                  <Text style={[s.dateDayNum, isSelected && s.textWhiteSelected]}>
                    {item.dayNum}
                  </Text>
                  <Text style={[s.dateDayName, isSelected && s.textWhiteSelected]}>
                    {item.dayName}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Time Selector Section */}
        <View style={s.sectionContainer}>
          <Text style={s.sectionTitle}>Select Time Slot</Text>
          <View style={s.slotsGrid}>
            {TIME_SLOTS.map((slot) => {
              const isSelected = selectedTime === slot;
              return (
                <TouchableOpacity
                  key={slot}
                  activeOpacity={0.8}
                  onPress={() => setSelectedTime(slot)}
                  style={[
                    s.slotCard,
                    isSelected && s.slotCardSelected
                  ]}
                >
                  <Ionicons 
                    name={isSelected ? "time" : "time-outline"} 
                    size={16} 
                    color={isSelected ? "#FFFFFF" : COLORS.primary} 
                  />
                  <Text style={[s.slotText, isSelected && s.textWhiteSelected]}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Describe Issue Section */}
        <View style={s.sectionContainer}>
          <Text style={s.sectionTitle}>Describe your legal issue</Text>
          <Input 
            placeholder="Tell your advocate about your legal issues or goals..." 
            value={issue} 
            onChangeText={setIssue} 
            multiline
            numberOfLines={4}
          />
        </View>
      </ScrollView>

      {/* Checkout Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={s.priceInfo}>
          <Text style={s.priceLabel}>Total Amount</Text>
          <Text style={s.priceValue}>₹{fee}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 20 }}>
          <Button 
            title={`Proceed to Pay ₹${fee}`} 
            onPress={handleBook} 
            loading={loading} 
            style={{ borderRadius: 16 }}
          />
        </View>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  advocateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  advocateMeta: {
    flex: 1,
  },
  advocateName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  advocateFee: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  datesContainer: {
    paddingRight: 20,
  },
  dateCard: {
    width: 65,
    height: 85,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dateCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  dateMonth: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  dateDayNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  dateDayName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  textWhiteSelected: {
    color: '#FFFFFF',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '48%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  slotCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  slotText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingTop: 16,
    ...SHADOWS.large,
  },
  priceInfo: {
    justifyContent: 'center',
  },
  priceLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
});

export default BookingScreen;
