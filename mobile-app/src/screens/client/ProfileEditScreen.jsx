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
import profileAPI from '../../services/profileAPI';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { normalize, widthPct, SCREEN_WIDTH } from '../../utils/responsive';

const ProfileEditScreen = ({ navigation }) => {
  // ✅ ALL HOOKS BEFORE ANY EARLY RETURNS
  const insets = useSafeAreaInsets();
  const { user, updateUser, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    personal: { dateOfBirth: '', gender: 'male' },
    address: { street: '', city: '', state: '', pincode: '' },
    emergency: { contactName: '', contactPhone: '', relationship: '' }
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await profileAPI.getMe();
      if (response.data.success) {
        const user = response.data.data;
        setFormData({
          name: user.name || '',
          phone: user.phone || '',
          personal: user.personal || { dateOfBirth: '', gender: 'male' },
          address: user.address || { street: '', city: '', state: '', pincode: '' },
          emergency: user.emergency || { contactName: '', contactPhone: '', relationship: '' }
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const updateNested = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  const handleSave = async () => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRegister', { role: 'client' });
      return;
    }
    setSaving(true);
    try {
      const response = await profileAPI.updateProfile(formData);
      if (response.data.success) {
        updateUser(response.data.data); // Update global state
        Alert.alert('Success', 'Profile updated successfully!');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your photos to update your avatar.');
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
        updateUser({ avatar: response.data.data.avatar }); // Update global avatar
        Alert.alert('Success', 'Avatar updated!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={[COLORS.primary, COLORS.primaryDark || '#8D7865']} style={[styles.header, { paddingTop: insets.top + normalize(5) }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
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
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
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
            <Text style={styles.avatarHint}>Tap to change profile picture</Text>
          </View>

          {/* PERSONAL INFO */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <Text style={styles.label}>Full Name</Text>
            <TextInput 
              style={styles.input} 
              autoFocus={true}
              value={formData.name} 
              onChangeText={(v) => setFormData({...formData, name: v})}
            />
            
            <Text style={styles.label}>Phone Number</Text>
            <TextInput 
              style={styles.input} 
              value={formData.phone} 
              keyboardType="phone-pad"
              onChangeText={(v) => setFormData({...formData, phone: v})}
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.genderRow}>
                  {['male', 'female', 'other'].map(g => (
                    <TouchableOpacity 
                      key={g} 
                      onPress={() => updateNested('personal', 'gender', g)}
                      style={[styles.genderBtn, formData.personal.gender === g && styles.genderBtnActive]}
                    >
                      <Text style={[styles.genderText, formData.personal.gender === g && styles.genderTextActive]}>
                        {g.charAt(0).toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* ADDRESS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Address</Text>
            <Text style={styles.label}>Street Address</Text>
            <TextInput 
              style={styles.input} 
              value={formData.address.street} 
              onChangeText={(v) => updateNested('address', 'street', v)}
            />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.label}>City</Text>
                <TextInput 
                  style={styles.input} 
                  value={formData.address.city} 
                  onChangeText={(v) => updateNested('address', 'city', v)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Pincode</Text>
                <TextInput 
                  style={styles.input} 
                  value={formData.address.pincode} 
                  keyboardType="number-pad"
                  onChangeText={(v) => updateNested('address', 'pincode', v)}
                />
              </View>
            </View>
          </View>

          {/* EMERGENCY CONTACT */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            <Text style={styles.label}>Contact Person Name</Text>
            <TextInput 
              style={styles.input} 
              value={formData.emergency.contactName} 
              onChangeText={(v) => updateNested('emergency', 'contactName', v)}
            />
            <Text style={styles.label}>Contact Phone</Text>
            <TextInput 
              style={styles.input} 
              value={formData.emergency.contactPhone} 
              keyboardType="phone-pad"
              onChangeText={(v) => updateNested('emergency', 'contactPhone', v)}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: normalize(5), paddingBottom: normalize(25), paddingHorizontal: normalize(20) },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: normalize(18), fontWeight: '700', color: '#fff' },
  saveBtn: { fontSize: normalize(16), fontWeight: '700', color: '#fff' },
  scroll: { flex: 1, padding: normalize(20) },
  avatarSection: { alignItems: 'center', marginBottom: normalize(25) },
  avatarWrapper: { width: normalize(100), height: normalize(100), borderRadius: normalize(50), position: 'relative' },
  avatar: { width: normalize(100), height: normalize(100), borderRadius: normalize(50), backgroundColor: '#e2e8f0' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.primary, width: normalize(32), height: normalize(32), borderRadius: normalize(16), alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  uploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: normalize(50), alignItems: 'center', justifyContent: 'center' },
  avatarHint: { fontSize: normalize(12), color: '#64748b', marginTop: normalize(10), fontWeight: '500' },
  section: { backgroundColor: '#fff', borderRadius: normalize(16), padding: normalize(16), marginBottom: normalize(20), shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: normalize(16), fontWeight: '700', color: COLORS.primary, marginBottom: normalize(15) },
  label: { fontSize: normalize(13), fontWeight: '600', color: '#64748b', marginBottom: normalize(8), marginTop: normalize(10) },
  input: { backgroundColor: '#f1f5f9', borderRadius: normalize(12), padding: normalize(12), fontSize: normalize(15), color: '#1e293b' },
  row: { flexDirection: 'row' },
  genderRow: { flexDirection: 'row', marginTop: normalize(5) },
  genderBtn: { paddingHorizontal: normalize(15), paddingVertical: normalize(8), borderRadius: normalize(10), backgroundColor: '#f1f5f9', marginRight: normalize(10) },
  genderBtnActive: { backgroundColor: COLORS.primary },
  genderText: { fontSize: normalize(14), fontWeight: '600', color: '#64748b' },
  genderTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});

export default ProfileEditScreen;
