import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import SafeScreen from '../../components/SafeScreen';
import { LEGAL_THEME } from '../../constants/legalAdviceTheme';
import { LogoHeader } from '../../components/legalAdvice/LogoHeader';
import { Stepper } from '../../components/legalAdvice/Stepper';
import { InputField } from '../../components/legalAdvice/InputField';
import { TextArea } from '../../components/legalAdvice/TextArea';
import { PrimaryButton } from '../../components/legalAdvice/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { uploadAPI, legalAdviceAPI, paymentAPI } from '../../services/api';
import RazorpayCheckout from 'react-native-razorpay';
import { usePricing } from '../../context/PricingContext';
import TestModeBanner from '../../components/TestModeBanner';

const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 10;

export default function ConsultationDetailsScreen({ navigation, route }) {
  const { user, isAuthenticated } = useAuth();
  const { getPrice } = usePricing();
  const selectedType = route?.params?.selectedType || { id: 'chat', title: 'Chat Consultation', price: String(getPrice('chat_consultation', 499)) };
  const selectedMatter = route?.params?.selectedMatter || { id: 'property', title: 'Property Law' };
  const serviceType = route?.params?.serviceType || 'legal_advice'; // 'legal_advice' or 'legal_notice'

  const userData = user?.user || user || {};
  const [fullName, setFullName] = useState(userData.name || '');
  const [phone, setPhone] = useState(userData.phone || '');
  const [email, setEmail] = useState(userData.email || '');
  const [city, setCity] = useState(userData.address?.city || '');
  const [preferredSlot, setPreferredSlot] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [description, setDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ─── Calendar: next 14 days ─────────────────────────────────────────────────
  const calDates = useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      list.push({
        id: iso,
        iso,
        dayNum:  d.getDate(),
        dayName: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
        month:   ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()],
        label:   i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : null,
      });
    }
    return list;
  }, []);

  const TIME_SLOTS = [
    '09:00 AM','10:00 AM','11:00 AM','12:00 PM',
    '02:00 PM','03:00 PM','04:00 PM','05:00 PM',
  ];

  const handleSelectDate = (iso) => {
    setSelectedDate(iso);
    updateSlot(iso, selectedTime);
  };
  const handleSelectTime = (t) => {
    setSelectedTime(t);
    updateSlot(selectedDate, t);
  };
  const updateSlot = (date, time) => {
    if (date && time) {
      const d = calDates.find(x => x.iso === date);
      const label = d?.label || `${d?.dayName} ${d?.dayNum} ${d?.month}`;
      setPreferredSlot(`${label}, ${time}`);
    }
  };

  // ─── Real Document Picker ────────────────────────────────────────────────────
  const handlePickFile = useCallback(async () => {
    if (uploadedFiles.length >= MAX_FILES) {
      Alert.alert('Limit Reached', `You can upload up to ${MAX_FILES} documents.`);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      const fileSizeMB = (file.size || 0) / (1024 * 1024);

      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        Alert.alert('File Too Large', `Please select a file smaller than ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }

      // Upload to Cloudinary
      setUploading(true);
      try {
        const response = await uploadAPI.uploadFile(file.uri, file.name, file.mimeType);
        const cloudinaryUrl = response.data?.data?.url || response.data?.url;

        if (!cloudinaryUrl) throw new Error('Upload failed');

        setUploadedFiles(prev => [...prev, {
          url: cloudinaryUrl,
          name: file.name,
          type: file.mimeType?.includes('image') ? 'image' : 'pdf',
          size: fileSizeMB.toFixed(1) + ' MB',
        }]);
      } catch (uploadErr) {
        const msg = uploadErr?.response?.data?.message || uploadErr?.message || 'Could not upload document.';
        console.error('Upload document error:', uploadErr?.response?.data || uploadErr);
        Alert.alert('Upload Failed', msg);
      } finally {
        setUploading(false);
      }
    } catch (err) {
      console.log('Document picker error:', err);
    }
  }, [uploadedFiles]);

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Submit → Backend → Razorpay ────────────────────────────────────────────
  const handleContinue = async () => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRegister', { role: 'client' });
      return;
    }
    if (!fullName.trim()) return Alert.alert('Required', 'Please enter your full name.');
    if (!phone.trim()) return Alert.alert('Required', 'Please enter your phone number.');
    if (!description.trim() || description.trim().length < 10) {
      return Alert.alert('Required', 'Please describe your legal concern (min 10 characters).');
    }

    setSubmitting(true);
    try {
      const modeMap = { chat: 'chat', audio: 'voice', video: 'video' };
      const consultationMode = modeMap[selectedType.id] || 'chat';
      const amount = parseInt(selectedType.price || getPrice('chat_consultation', 499), 10);

      // Step 1: Create booking on backend
      const bookingRes = await legalAdviceAPI.createRequest({
        consultationMode,
        serviceType,
        issueCategory: selectedMatter.id,
        issueDescription: description.trim(),
        preferredSlot,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        documents: uploadedFiles.map((f, idx) => {
          if (typeof f === 'string') return { url: f, name: `Attachment_${idx + 1}`, type: f.endsWith('.pdf') ? 'pdf' : 'image' };
          return { url: f.url || f.uri || (typeof f === 'string' ? f : ''), name: f.name || `Attachment_${idx + 1}`, type: f.type || 'document' };
        }).filter(d => d.url),
        clientCity: city.trim() || userData.address?.city || '',
        amount,
      });

      const { bookingId, amount: bookingAmount } = bookingRes.data.data;

      // Step 2: Create Razorpay order
      const orderRes = await paymentAPI.createOrder(bookingId);
      const { orderId, amount: orderAmount, currency, keyId } = orderRes.data.data;

      // Step 3: Open Razorpay checkout
      const razorpayOptions = {
        description: `${selectedType.title} - ${selectedMatter.title}`,
        image: 'https://res.cloudinary.com/legalitt/image/upload/v1/legalitt-logo.png',
        currency: currency || 'INR',
        key: keyId,
        amount: orderAmount,
        name: 'Legalitt',
        order_id: orderId,
        prefill: {
          email: email.trim() || userData.email,
          contact: phone.replace(/\D/g, '').slice(-10),
          name: fullName.trim(),
        },
        theme: { color: '#14B8A6' },
      };

      let paymentData;
      try {
        paymentData = await RazorpayCheckout.open(razorpayOptions);
      } catch (rzpErr) {
        if (rzpErr?.code === 'PAYMENT_CANCELLED' || rzpErr?.description === 'Payment cancelled by user.') {
          setSubmitting(false); // ← Fix: was missing, button stayed stuck in "Processing..."
          Alert.alert('Payment Cancelled', 'You cancelled the payment. Your request was not submitted.');
          return;
        }
        throw rzpErr;
      }

      // Step 4: Confirm payment with backend
      await legalAdviceAPI.confirmPayment({
        bookingId,
        razorpayOrderId: paymentData.razorpay_order_id,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySignature: paymentData.razorpay_signature,
      });

      // Step 5: Navigate to success screen
      navigation.navigate('ConsultationScheduled', {
        bookingData: {
          bookingId,
          requestId: `LEG-${bookingId.substring(bookingId.length - 6).toUpperCase()}`,
          selectedType,
          selectedMatter,
          serviceType,
          clientDetails: { fullName, phone, email, preferredSlot, filesCount: uploadedFiles.length },
          totalAmount: bookingAmount,
        },
      });
    } catch (err) {
      // Razorpay cancelled by user
      if (err?.code === 'PAYMENT_CANCELLED' || err?.description === 'Payment cancelled by user.') {
        setSubmitting(false);
        Alert.alert('Payment Cancelled', 'You cancelled the payment. Your request has not been submitted.');
        return;
      }

      // Razorpay native error (bad key, network issue during checkout)
      if (err?.code !== undefined && err?.description) {
        Alert.alert(
          'Payment Failed',
          `Razorpay error: ${err.description}\n\nPlease try again or contact support.`
        );
        return;
      }

      // Backend API error — extract message properly
      const backendMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Something went wrong. Please try again.';

      console.error('ConsultationDetails error:', {
        status: err?.response?.status,
        message: backendMsg,
        url: err?.config?.url,
      });

      Alert.alert('Error', backendMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeScreen backgroundColor={LEGAL_THEME.colors.white} barStyle="dark-content">
      <LogoHeader onBack={() => navigation.goBack()} />
      <Stepper currentStep={1} />

      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>
              {serviceType === 'legal_notice' ? 'Legal Notice Details' : 'Tell Us About Your Legal Concern'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {serviceType === 'legal_notice'
                ? 'Provide details for your legal notice. Our advocates will draft & review it for you.'
                : `Accurate details help us assign the best ${selectedMatter.title} specialist.`}
            </Text>
          </View>

          <View style={styles.formContainer}>
            <InputField label="Full Name" value={fullName} onChangeText={setFullName}
              placeholder="e.g. Rahul Sharma" required />

            <InputField label="Phone Number" value={phone} onChangeText={setPhone}
              placeholder="e.g. +91 98765 43210" keyboardType="phone-pad" required />

            <InputField label="Email Address" value={email} onChangeText={setEmail}
              placeholder="e.g. rahul@example.com" keyboardType="email-address" />

            <InputField label="Your City" value={city} onChangeText={setCity}
              placeholder="e.g. Mumbai, Delhi, Bangalore" />

            {/* ── Calendar: Date + Time ─────────────────── */}
            <View style={styles.slotContainer}>
              <Text style={styles.slotLabel}>Preferred Consultation Slot *</Text>

              {/* Date row — horizontal ScrollView instead of FlatList to avoid crash inside ScrollView */}
              <Text style={styles.calSubLabel}>Select Date</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
                contentContainerStyle={{ paddingRight: 8 }}
              >
                {calDates.map(item => {
                  const sel = selectedDate === item.iso;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      onPress={() => handleSelectDate(item.iso)}
                      style={[styles.calDateCard, sel && styles.calDateCardSel]}
                    >
                      {item.label ? (
                        <Text style={[styles.calDateLabel, sel && styles.calTextSel]}>{item.label}</Text>
                      ) : (
                        <Text style={[styles.calDateMon, sel && styles.calTextSel]}>{item.month}</Text>
                      )}
                      <Text style={[styles.calDateNum, sel && styles.calTextSel]}>{item.dayNum}</Text>
                      <Text style={[styles.calDateDay, sel && styles.calTextSel]}>{item.dayName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Time grid */}
              <Text style={styles.calSubLabel}>Select Time</Text>
              <View style={styles.slotsGrid}>
                {TIME_SLOTS.map(t => {
                  const sel = selectedTime === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      activeOpacity={0.8}
                      onPress={() => handleSelectTime(t)}
                      style={[styles.slotChip, sel && styles.selectedSlotChip]}
                    >
                      <Ionicons name={sel ? 'time' : 'time-outline'} size={13}
                        color={sel ? '#fff' : LEGAL_THEME.colors.primaryGold} />
                      <Text style={[styles.slotText, sel && styles.selectedSlotText]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {preferredSlot ? (
                <View style={styles.selectedSlotBadge}>
                  <Ionicons name="checkmark-circle" size={15} color={LEGAL_THEME.colors.primaryGold} />
                  <Text style={styles.selectedSlotBadgeText}>Selected: {preferredSlot}</Text>
                </View>
              ) : null}
            </View>

            <TextArea label="Describe Your Legal Matter"
              value={description} onChangeText={setDescription}
              placeholder={serviceType === 'legal_notice'
                ? 'Describe who should receive the notice, the nature of the dispute, and what action you want...'
                : 'Briefly describe the facts of your case, key dates, or specific questions...'}
              maxLength={1000} required />

            {/* Document Upload */}
            <View style={styles.uploadSection}>
              <Text style={styles.uploadLabel}>Attach Documents (Optional)</Text>
              <Text style={styles.uploadSubLabel}>
                PDF, Word, or images • Max {MAX_FILE_SIZE_MB}MB each • Up to {MAX_FILES} files
              </Text>

              {uploadedFiles.map((file, idx) => (
                <View key={idx} style={styles.fileRow}>
                  <View style={styles.fileIcon}>
                    <Ionicons name={file.type === 'image' ? 'image-outline' : 'document-outline'}
                      size={20} color={LEGAL_THEME.colors.primaryGold} />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                    <Text style={styles.fileSize}>{file.size} • Uploaded ✓</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveFile(idx)} style={styles.removeBtn}>
                    <Ionicons name="close-circle" size={22} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {uploadedFiles.length < MAX_FILES && (
                <TouchableOpacity style={styles.uploadButton} onPress={handlePickFile}
                  disabled={uploading} activeOpacity={0.8}>
                  {uploading ? (
                    <ActivityIndicator size="small" color={LEGAL_THEME.colors.primaryGold} />
                  ) : (
                    <Ionicons name="cloud-upload-outline" size={20} color={LEGAL_THEME.colors.primaryGold} />
                  )}
                  <Text style={styles.uploadButtonText}>
                    {uploading ? 'Uploading...' : 'Upload Document'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomFooter}>
          <TestModeBanner />
          <PrimaryButton
            title={submitting ? 'Processing...' : `Proceed to Pay ₹${selectedType.price}`}
            onPress={handleContinue}
            disabled={submitting || uploading}
          />
          <View style={styles.privacyRow}>
            <Ionicons name="lock-closed" size={12} color={LEGAL_THEME.colors.secondaryText} />
            <Text style={styles.privacyText}>
              End-to-end encrypted • Secured by Razorpay
            </Text>
          </View>
        </View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LEGAL_THEME.colors.white },
  scrollContent: { paddingHorizontal: LEGAL_THEME.spacing.screenPadding, paddingTop: 16, paddingBottom: 140 },
  heroCard: {
    backgroundColor: LEGAL_THEME.colors.cream,
    borderRadius: 18, borderWidth: 1,
    borderColor: LEGAL_THEME.colors.border,
    padding: 16, marginBottom: 20,
  },
  heroTitle: { fontSize: 18, fontWeight: '800', color: LEGAL_THEME.colors.primaryText, marginBottom: 4 },
  heroSubtitle: { fontSize: 12, color: LEGAL_THEME.colors.secondaryText, lineHeight: 17 },
  formContainer: { marginBottom: 10 },
  slotContainer: { marginBottom: 16 },
  slotLabel: { fontSize: 13, fontWeight: '700', color: LEGAL_THEME.colors.primaryText, marginBottom: 10 },
  calSubLabel: { fontSize: 11, fontWeight: '600', color: LEGAL_THEME.colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  // Calendar date cards
  calDateCard: {
    width: 60, height: 78, borderRadius: 12, backgroundColor: LEGAL_THEME.colors.cream,
    borderWidth: 1, borderColor: LEGAL_THEME.colors.border,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  calDateCardSel: { backgroundColor: LEGAL_THEME.colors.primaryGold, borderColor: LEGAL_THEME.colors.primaryGold },
  calDateLabel: { fontSize: 9, fontWeight: '700', color: LEGAL_THEME.colors.secondaryText, textTransform: 'uppercase' },
  calDateMon:   { fontSize: 9, fontWeight: '600', color: LEGAL_THEME.colors.secondaryText },
  calDateNum:   { fontSize: 20, fontWeight: '800', color: LEGAL_THEME.colors.primaryText, marginVertical: 1 },
  calDateDay:   { fontSize: 9, fontWeight: '600', color: LEGAL_THEME.colors.secondaryText },
  calTextSel:   { color: '#FFFFFF' },

  // Time slot grid — 2 per row
  slotsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    width: '47%',
    backgroundColor: LEGAL_THEME.colors.cream,
    borderRadius: 12, borderWidth: 1, borderColor: LEGAL_THEME.colors.border,
    paddingHorizontal: 10, paddingVertical: 10,
    justifyContent: 'center',
  },
  selectedSlotChip: { backgroundColor: LEGAL_THEME.colors.primaryGold, borderColor: LEGAL_THEME.colors.primaryGold },
  slotText: { fontSize: 12, fontWeight: '600', color: LEGAL_THEME.colors.secondaryText },
  selectedSlotText: { color: LEGAL_THEME.colors.white },

  // Selected slot confirmation
  selectedSlotBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF8EC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: LEGAL_THEME.colors.primaryGold + '50', marginTop: 4,
  },
  selectedSlotBadgeText: { fontSize: 12, fontWeight: '600', color: LEGAL_THEME.colors.primaryGold },
  uploadSection: { marginBottom: 12 },
  uploadLabel: { fontSize: 13, fontWeight: '700', color: LEGAL_THEME.colors.primaryText, marginBottom: 2 },
  uploadSubLabel: { fontSize: 11, color: LEGAL_THEME.colors.secondaryText, marginBottom: 12 },
  fileRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0FDF4', borderRadius: 12,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#BBF7D0',
  },
  fileIcon: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: '#ECFDF5',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  fileSize: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  removeBtn: { padding: 4 },
  uploadButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 2, borderStyle: 'dashed', borderColor: LEGAL_THEME.colors.primaryGold,
    borderRadius: 14, paddingVertical: 14, backgroundColor: '#FFFBEB',
  },
  uploadButtonText: { fontSize: 14, fontWeight: '700', color: LEGAL_THEME.colors.primaryGold },
  bottomFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: LEGAL_THEME.colors.white,
    paddingHorizontal: LEGAL_THEME.spacing.screenPadding,
    paddingTop: 12, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: LEGAL_THEME.colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 8,
  },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  privacyText: { fontSize: 11, color: LEGAL_THEME.colors.secondaryText },
});
