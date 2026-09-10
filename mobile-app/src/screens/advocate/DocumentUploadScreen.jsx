import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../constants/theme';
import { advocateAPI, uploadAPI } from '../../services/api';

export default function DocumentUploadScreen({ navigation, route }) {
  const registerData = route?.params?.registerData;

  const [idDoc, setIdDoc] = useState(null);       // { uri, name, size }
  const [certDoc, setCertDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);

  // ─── Pick ID Card (image or PDF) ────────────────────────────────────────────
  const pickIdCard = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      if (file.size > 5 * 1024 * 1024) {
        Alert.alert('File Too Large', 'ID Card must be under 5MB.');
        return;
      }

      setUploadingId(true);
      try {
        const uploadRes = await uploadAPI.uploadFile(file.uri, file.name, file.mimeType);
        setIdDoc({
          uri: file.uri,
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
          cloudUrl: uploadRes?.data?.data?.url,
        });
      } catch (uploadErr) {
        // Allow offline / fallback — store local
        setIdDoc({
          uri: file.uri,
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        });
      } finally {
        setUploadingId(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not pick file. Please try again.');
    }
  };

  // ─── Pick Certificate (PDF preferred) ───────────────────────────────────────
  const pickCertificate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      if (file.size > 10 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Certificate must be under 10MB.');
        return;
      }

      setUploadingCert(true);
      try {
        const uploadRes = await uploadAPI.uploadFile(file.uri, file.name, file.mimeType);
        setCertDoc({
          uri: file.uri,
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
          cloudUrl: uploadRes?.data?.data?.url,
        });
      } catch (uploadErr) {
        setCertDoc({
          uri: file.uri,
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        });
      } finally {
        setUploadingCert(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not pick file. Please try again.');
    }
  };

  // ─── Submit Application ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!idDoc || !certDoc) {
      Alert.alert('Documents Required', 'Please upload both your ID Card and Bar Council Certificate.');
      return;
    }

    setLoading(true);
    try {
      await advocateAPI.upsertProfile({
        barCouncilId: registerData?.barCouncilId || 'PENDING',
        documents: {
          idCard: idDoc.cloudUrl || idDoc.uri,
          certificate: certDoc.cloudUrl || certDoc.uri,
        },
      });
      navigation.replace('PendingApproval');
    } catch (profileErr) {
      console.log('Failed to upsert advocate profile:', profileErr.message);
      // Even if profile update fails, still go to pending (user is registered)
      navigation.replace('PendingApproval');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Verification docs</Text>
              <View style={styles.stepBadge}>
                <Text style={styles.stepText}>Step 2 of 2</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Upload your Bar Council ID and Certificate to verify your credentials.</Text>
          </View>
        </View>

        {/* Bar Council ID Upload */}
        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Bar Council ID Card</Text>
          <TouchableOpacity
            style={[styles.uploadBox, idDoc && styles.uploadBoxSuccess]}
            onPress={pickIdCard}
            activeOpacity={0.7}
            disabled={loading || uploadingId}
          >
            {uploadingId ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : (
              <>
                <View style={[styles.iconCircle, idDoc && styles.iconCircleSuccess]}>
                  <Ionicons
                    name={idDoc ? 'checkmark-circle' : 'cloud-upload-outline'}
                    size={32}
                    color={idDoc ? COLORS.primary : '#9CA3AF'}
                  />
                </View>
                <Text style={[styles.uploadText, idDoc && styles.uploadTextSuccess]}>
                  {idDoc ? idDoc.name : 'Tap to upload ID Card'}
                </Text>
                <Text style={styles.uploadSubtext}>
                  {idDoc ? idDoc.size : 'PNG, JPG or PDF • Max 5MB'}
                </Text>
                {idDoc && (
                  <TouchableOpacity
                    style={styles.changeBtn}
                    onPress={pickIdCard}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.changeBtnText}>Change</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Certificate Upload */}
        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Bar Council Certificate</Text>
          <TouchableOpacity
            style={[styles.uploadBox, certDoc && styles.uploadBoxSuccess]}
            onPress={pickCertificate}
            activeOpacity={0.7}
            disabled={loading || uploadingCert}
          >
            {uploadingCert ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : (
              <>
                <View style={[styles.iconCircle, certDoc && styles.iconCircleSuccess]}>
                  <Ionicons
                    name={certDoc ? 'checkmark-circle' : 'document-text-outline'}
                    size={32}
                    color={certDoc ? COLORS.primary : '#9CA3AF'}
                  />
                </View>
                <Text style={[styles.uploadText, certDoc && styles.uploadTextSuccess]}>
                  {certDoc ? certDoc.name : 'Tap to upload Certificate'}
                </Text>
                <Text style={styles.uploadSubtext}>
                  {certDoc ? certDoc.size : 'PDF preferred • Max 10MB'}
                </Text>
                {certDoc && (
                  <TouchableOpacity
                    style={styles.changeBtn}
                    onPress={pickCertificate}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.changeBtnText}>Change</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Security Info */}
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Your documents are encrypted and stored securely. They are only used for professional verification.
          </Text>
        </View>

        {/* Progress dots */}
        <View style={styles.progressRow}>
          <View style={[styles.progressDot, idDoc && styles.progressDotDone]}>
            {idDoc
              ? <Ionicons name="checkmark" size={12} color="#fff" />
              : <Text style={styles.progressDotNum}>1</Text>
            }
          </View>
          <View style={[styles.progressLine, idDoc && styles.progressLineDone]} />
          <View style={[styles.progressDot, certDoc && styles.progressDotDone]}>
            {certDoc
              ? <Ionicons name="checkmark" size={12} color="#fff" />
              : <Text style={styles.progressDotNum}>2</Text>
            }
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!idDoc || !certDoc || loading) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!idDoc || !certDoc || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.submitButtonContent}>
              <Text style={styles.submitButtonText}>Submit Application</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
    gap: 16,
  },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  headerTitleWrap: { flex: 1 },
  titleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4, flexWrap: 'wrap', gap: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
  stepBadge: {
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  stepText: { color: COLORS.primary, fontWeight: '700', fontSize: 11 },
  subtitle: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  uploadSection: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 15, fontWeight: '600', color: '#374151',
    marginBottom: 10, marginLeft: 4,
  },
  uploadBox: {
    borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed',
    borderRadius: 20, padding: 28, alignItems: 'center',
    backgroundColor: '#F9FAFB', minHeight: 140, justifyContent: 'center',
  },
  uploadBoxSuccess: {
    borderColor: COLORS.primary, backgroundColor: 'rgba(20, 184, 166, 0.05)',
    borderStyle: 'solid',
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  iconCircleSuccess: { backgroundColor: 'rgba(20, 184, 166, 0.1)' },
  uploadText: { fontSize: 15, fontWeight: '600', color: '#6B7280', marginBottom: 4, textAlign: 'center' },
  uploadTextSuccess: { color: '#1F2937' },
  uploadSubtext: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  changeBtn: {
    marginTop: 10, paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.primary,
  },
  changeBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },

  infoBox: {
    flexDirection: 'row', backgroundColor: 'rgba(20, 184, 166, 0.08)',
    padding: 16, borderRadius: 16, alignItems: 'center',
    marginTop: 4, marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 13, color: '#0D9488', marginLeft: 12, lineHeight: 18 },

  progressRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 28, gap: 0,
  },
  progressDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center',
  },
  progressDotDone: { backgroundColor: COLORS.primary },
  progressDotNum: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  progressLine: { flex: 1, maxWidth: 80, height: 3, backgroundColor: '#E5E7EB', marginHorizontal: 6 },
  progressLineDone: { backgroundColor: COLORS.primary },

  submitButton: {
    backgroundColor: COLORS.primary, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB', opacity: 0.5, shadowOpacity: 0, elevation: 0,
  },
  submitButtonContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
