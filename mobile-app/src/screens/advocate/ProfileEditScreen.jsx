import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Image, StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import api, { advocateAPI } from '../../services/api';
import profileAPI from '../../services/profileAPI';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

const SPECIALIZATIONS = [
  'Criminal Law','Civil Law','Family Law','Property Law',
  'Corporate Law','Labour Law','Tax Law','Consumer Law',
  'Cyber Law','Constitutional Law','Intellectual Property',
  'Banking Law','Environmental Law','Human Rights','Immigration Law'
];

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const PRESET_SLOTS = [
  { start: '09:00 AM', end: '10:00 AM' },
  { start: '10:00 AM', end: '11:00 AM' },
  { start: '11:00 AM', end: '12:00 PM' },
  { start: '12:00 PM', end: '01:00 PM' },
  { start: '02:00 PM', end: '03:00 PM' },
  { start: '03:00 PM', end: '04:00 PM' },
  { start: '04:00 PM', end: '05:00 PM' }
];

const ProfileEditScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Weekly tab selector
  const [activeDay, setActiveDay] = useState('Monday');

  const [form, setForm] = useState({
    name: '',
    phone: '',
    barCouncilNumber: '',
    experience: '',
    consultationFee: '',
    followUpFee: '',
    about: '',
    city: '',
    state: '',
    specializations: [],
    languages: ['Hindi', 'English'],
    availability: [],
    documents: {
      barCouncilCertificate: '',
      degreeDocument: '',
      idProof: ''
    }
  });

  useEffect(() => {
    advocateAPI.getMyProfile()
      .then(({ data }) => {
        const a = data.data || {};
        const u = a.user || {};
        setForm({
          name: u.name || user?.name || '',
          phone: u.phone || user?.phone || '',
          barCouncilNumber: a.barCouncilNumber || '',
          experience: String(a.experience || ''),
          consultationFee: String(a.consultationFee || ''),
          followUpFee: String(a.followUpFee || ''),
          about: a.about || '',
          city: a.location?.address?.city || '',
          state: a.location?.address?.state || 'Madhya Pradesh',
          specializations: a.specializations || [],
          languages: a.languages || ['Hindi', 'English'],
          availability: a.availability || [],
          documents: a.documents || { barCouncilCertificate: '', degreeDocument: '', idProof: '' }
        });
      })
      .catch(() => {
        setForm(p => ({
          ...p,
          name: user?.name || '',
          phone: user?.phone || '',
        }));
      })
      .finally(() => setLoading(false));
  }, [user]);

  const updateField = (key, value) => {
    setForm(p => ({ ...p, [key]: value }));
  };

  const toggleSpec = (spec) => {
    setForm(p => ({
      ...p,
      specializations: p.specializations.includes(spec)
        ? p.specializations.filter(s => s !== spec)
        : [...p.specializations, spec],
    }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need photo library access to change your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled) {
      handleUpload(result.assets[0].uri);
    }
  };

  const handleUpload = async (uri) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      formData.append('avatar', { uri, name: filename, type });

      const response = await profileAPI.updateAvatar(formData);
      if (response.data.success) {
        updateUser({ avatar: response.data.data.avatar });
        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch {
      Alert.alert('Error', 'Failed to upload profile picture.');
    } finally {
      setUploading(false);
    }
  };

  // Credentials certificate pick and upload
  const handleDocUpload = async (field) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need photo library access to change your documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      setUploading(true);
      try {
        const formData = new FormData();
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;

        formData.append('file', { uri, name: filename, type });

        const { uploadAPI } = require('../../services/api');
        const response = await uploadAPI.uploadFile(uri, filename, type);

        if (response.data.success) {
          const docUrl = response.data.data.url;
          setForm(p => ({
            ...p,
            documents: {
              ...p.documents,
              [field]: docUrl
            }
          }));
          Alert.alert('Success', 'Certificate uploaded successfully!');
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to upload document.');
      } finally {
        setUploading(false);
      }
    }
  };

  // Add availability slot to a day
  const handleAddSlot = (slot) => {
    setForm(p => {
      const avail = [...p.availability];
      let dayIndex = avail.findIndex(a => a.day === activeDay);
      
      if (dayIndex === -1) {
        avail.push({
          day: activeDay,
          slots: [{ startTime: slot.start, endTime: slot.end, isBooked: false }]
        });
      } else {
        const slots = [...avail[dayIndex].slots];
        const conflict = slots.some(s => s.startTime === slot.start && s.endTime === slot.end);
        if (conflict) {
          Alert.alert('Duplicate Slot', 'This time slot is already added for ' + activeDay);
          return p;
        }
        slots.push({ startTime: slot.start, endTime: slot.end, isBooked: false });
        avail[dayIndex] = { ...avail[dayIndex], slots };
      }

      return { ...p, availability: avail };
    });
  };

  // Remove availability slot from a day
  const handleRemoveSlot = (slotIndex) => {
    setForm(p => {
      const avail = [...p.availability];
      const dayIndex = avail.findIndex(a => a.day === activeDay);
      if (dayIndex !== -1) {
        const slots = avail[dayIndex].slots.filter((_, idx) => idx !== slotIndex);
        if (slots.length === 0) {
          // If no slots left, remove the entire day configuration
          return { ...p, availability: avail.filter(a => a.day !== activeDay) };
        } else {
          avail[dayIndex] = { ...avail[dayIndex], slots };
        }
      }
      return { ...p, availability: avail };
    });
  };

  const handleSave = async () => {
    if (!form.name || !form.barCouncilNumber || !form.experience || !form.consultationFee) {
      Alert.alert('Required Fields', 'Please fill in Name, Bar Council Number, Experience, and Fee.');
      return;
    }
    setSaving(true);
    try {
      const response = await advocateAPI.upsertProfile({
        name: form.name,
        phone: form.phone,
        barCouncilNumber: form.barCouncilNumber,
        experience: Number(form.experience),
        consultationFee: Number(form.consultationFee),
        followUpFee: Number(form.followUpFee) || 0,
        about: form.about,
        specializations: form.specializations,
        languages: form.languages,
        location: {
          type: 'Point',
          coordinates: [79.9864, 23.1815],
          address: { city: form.city, state: form.state },
        },
        availability: form.availability,
        documents: form.documents,
      });
      if (response.data.success) {
        updateUser({ name: form.name, phone: form.phone });
        Alert.alert('Success', 'Practice Profile saved successfully!');
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  const activeDaySlots = form.availability.find(a => a.day === activeDay)?.slots || [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={[COLORS.primary, COLORS.primary]} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Practice Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtn}>Save</Text>}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* AVATAR SECTION */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} disabled={uploading}>
              <View style={styles.avatarWrapper}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={40} color="#64748B" />
                  </View>
                )}
                <View style={styles.cameraBtn}>
                  <Ionicons name="camera" size={18} color="#fff" />
                </View>
                {uploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to change practice photo</Text>
          </View>

          {/* BASIC INFORMATION */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <Text style={styles.label}>Full Name *</Text>
            <TextInput 
              style={styles.input} 
              value={form.name} 
              onChangeText={(v) => updateField('name', v)}
              placeholder="e.g. Priya Sharma"
            />
            
            <Text style={styles.label}>Phone Number</Text>
            <TextInput 
              style={styles.input} 
              value={form.phone} 
              keyboardType="phone-pad"
              onChangeText={(v) => updateField('phone', v)}
              placeholder="e.g. +91 9876543210"
            />
          </View>

          {/* ADVOCATE SPECIFICS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Practice details</Text>

            <Text style={styles.label}>Bar Council Number *</Text>
            <TextInput 
              style={styles.input} 
              value={form.barCouncilNumber} 
              onChangeText={(v) => updateField('barCouncilNumber', v)}
              placeholder="e.g. MP/1234/2020"
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>Experience (Years) *</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.experience} 
                  keyboardType="number-pad"
                  onChangeText={(v) => updateField('experience', v)}
                  placeholder="e.g. 10"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Consultation Fee (₹) *</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.consultationFee} 
                  keyboardType="number-pad"
                  onChangeText={(v) => updateField('consultationFee', v)}
                  placeholder="e.g. 800"
                />
              </View>
            </View>

            <Text style={styles.label}>Follow-up Fee (₹)</Text>
            <TextInput 
              style={styles.input} 
              value={form.followUpFee} 
              keyboardType="number-pad"
              onChangeText={(v) => updateField('followUpFee', v)}
              placeholder="e.g. 200"
            />
          </View>

          {/* AVAILABILITY CALENDAR SLOTS BUILDER */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability Calendar</Text>
            <Text style={styles.label}>Manage your time slots per day</Text>
            
            {/* Days row selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysContainer}>
              {DAYS_OF_WEEK.map(day => (
                <TouchableOpacity 
                  key={day}
                  onPress={() => setActiveDay(day)}
                  style={[styles.dayTab, activeDay === day && styles.dayTabActive]}
                >
                  <Text style={[styles.dayTabText, activeDay === day && styles.dayTabActiveText]}>
                    {day.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.subLabel}>Active slots for {activeDay}:</Text>
            
            {activeDaySlots.length === 0 ? (
              <View style={styles.emptySlotsBox}>
                <Text style={styles.emptySlotsText}>No availability slots configured.</Text>
              </View>
            ) : (
              <View style={styles.slotsGrid}>
                {activeDaySlots.map((s, idx) => (
                  <View key={idx} style={styles.activeSlotChip}>
                    <Text style={styles.activeSlotText}>{s.startTime} - {s.endTime}</Text>
                    <TouchableOpacity onPress={() => handleRemoveSlot(idx)}>
                      <Ionicons name="close-circle" size={16} color="#EF4444" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={[styles.subLabel, { marginTop: 16 }]}>Tap to add preset slot hours:</Text>
            <View style={styles.presetGrid}>
              {PRESET_SLOTS.map((slot, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.presetChip}
                  onPress={() => handleAddSlot(slot)}
                >
                  <Ionicons name="add" size={14} color={COLORS.primary} />
                  <Text style={styles.presetText}>{slot.start}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* CREDENTIALS / CERTIFICATES UPLOAD */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Credentials & Certificates</Text>
            <Text style={styles.label}>Upload copies for verification</Text>

            {/* 1. Bar Certificate */}
            <View style={styles.uploadRow}>
              <View style={styles.uploadInfo}>
                <Text style={styles.uploadName}>Bar Council Certificate</Text>
                <Text style={styles.uploadStatus}>
                  {form.documents?.barCouncilCertificate ? 'Uploaded Successfully ✅' : 'Missing Certificate ⚠️'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.uploadBtn, form.documents?.barCouncilCertificate && styles.uploadedBtn]}
                onPress={() => handleDocUpload('barCouncilCertificate')}
              >
                <Text style={[styles.uploadBtnText, form.documents?.barCouncilCertificate && styles.uploadedBtnText]}>
                  {form.documents?.barCouncilCertificate ? 'Replace' : 'Upload'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 2. Degree Certificate */}
            <View style={styles.uploadRow}>
              <View style={styles.uploadInfo}>
                <Text style={styles.uploadName}>Degree Document (LLB / LLM)</Text>
                <Text style={styles.uploadStatus}>
                  {form.documents?.degreeDocument ? 'Uploaded Successfully ✅' : 'Missing Document ⚠️'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.uploadBtn, form.documents?.degreeDocument && styles.uploadedBtn]}
                onPress={() => handleDocUpload('degreeDocument')}
              >
                <Text style={[styles.uploadBtnText, form.documents?.degreeDocument && styles.uploadedBtnText]}>
                  {form.documents?.degreeDocument ? 'Replace' : 'Upload'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 3. ID Proof */}
            <View style={styles.uploadRow}>
              <View style={styles.uploadInfo}>
                <Text style={styles.uploadName}>Government Issued ID Proof</Text>
                <Text style={styles.uploadStatus}>
                  {form.documents?.idProof ? 'Uploaded ID ✅' : 'Missing ID ⚠️'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.uploadBtn, form.documents?.idProof && styles.uploadedBtn]}
                onPress={() => handleDocUpload('idProof')}
              >
                <Text style={[styles.uploadBtnText, form.documents?.idProof && styles.uploadedBtnText]}>
                  {form.documents?.idProof ? 'Replace' : 'Upload'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* LOCATION */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Areas / Location</Text>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>City</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.city} 
                  onChangeText={(v) => updateField('city', v)}
                  placeholder="e.g. Bhopal"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>State</Text>
                <TextInput 
                  style={styles.input} 
                  value={form.state} 
                  onChangeText={(v) => updateField('state', v)}
                  placeholder="e.g. Madhya Pradesh"
                />
              </View>
            </View>
          </View>

          {/* BIO */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About / Bio</Text>
            <Text style={styles.label}>Describe your expertise</Text>
            <TextInput 
              style={[styles.input, styles.multilineInput]} 
              value={form.about} 
              onChangeText={(v) => updateField('about', v)}
              multiline
              numberOfLines={4}
              placeholder="Provide a professional description of your cases, results, and practice..."
            />
          </View>

          {/* SPECIALIZATIONS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specializations</Text>
            <View style={styles.specsGrid}>
              {SPECIALIZATIONS.map(spec => {
                const isActive = form.specializations.includes(spec);
                return (
                  <TouchableOpacity
                    key={spec}
                    onPress={() => toggleSpec(spec)}
                    style={[styles.specChip, isActive && styles.specChipActive]}
                  >
                    <Text style={[styles.specText, isActive && styles.specTextActive]}>{spec}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  header: {
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  saveBtn: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  scroll: {
    flex: 1,
    padding: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  
  // Availability styles
  daysContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  dayTabActive: {
    backgroundColor: COLORS.primary,
  },
  dayTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  dayTabActiveText: {
    color: '#FFFFFF',
  },
  emptySlotsBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotsText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeSlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.2)',
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
  },
  activeSlotText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // Upload styles
  uploadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  uploadInfo: {
    flex: 1,
    marginRight: 10,
  },
  uploadName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  uploadStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  uploadBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  uploadedBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  uploadedBtnText: {
    color: COLORS.primary,
  },

  // Spec styles
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  specChipActive: {
    backgroundColor: 'rgba(20, 184, 166, 0.08)',
    borderColor: COLORS.primary,
  },
  specText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  specTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});

export default ProfileEditScreen;
