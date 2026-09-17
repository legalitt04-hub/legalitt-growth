import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert, StatusBar, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { exportFIRToPDF } from '../../utils/pdfExport';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';
import { firAPI } from '../../services/api';

const FIRPreviewScreen = ({ route, navigation }) => {
  const { isAuthenticated } = useAuth();
  const { draft } = route.params || {};
  const [content, setContent] = useState(draft?.aiDraft || '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleShare = async () => {
    try {
      await Share.share({
        message: content,
        title: `${String(draft?.type || 'FIR').toUpperCase()} FIR Draft`
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share the draft.');
    }
  };

  const handleSaveToDevice = async () => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRegister', { role: 'client' });
      return;
    }
    try {
      await exportFIRToPDF({ ...draft, aiDraft: content });
    } catch (error) {
      Alert.alert('Error', 'Could not save the PDF.');
    }
  };

  const handleSaveChanges = async () => {
    if (!draft?._id) {
      Alert.alert('Save unavailable', 'This FIR draft is missing its saved record ID.');
      return;
    }
    if (content.trim().length < 20) {
      Alert.alert('Draft too short', 'Please keep at least 20 characters in the FIR draft.');
      return;
    }
    try {
      setSaving(true);
      const response = await firAPI.updateDraft(draft._id, { aiDraft: content.trim() });
      setContent(response.data?.data?.aiDraft || content.trim());
      setEditing(false);
      Alert.alert('Saved', 'Your FIR draft changes were saved.');
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={[COLORS.primary, COLORS.primaryDark || '#8D7865']} style={[styles.header, { paddingTop: insets.top + 5 }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>FIR Draft Preview</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>FIR DRAFT PREVIEW</Text>
          </View>
          
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={editing ? handleSaveChanges : () => setEditing(true)}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name={editing ? 'save-outline' : 'create-outline'} size={17} color={COLORS.primary} />
              )}
              <Text style={styles.editButtonText}>{editing ? 'Save Changes' : 'Edit Draft'}</Text>
            </TouchableOpacity>
          </View>

          {editing ? (
            <TextInput
              style={styles.draftInput}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              autoFocus
            />
          ) : (
            <Text style={styles.draftContent}>{content || 'Draft content is not available yet.'}</Text>
          )}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            This is a computer-generated draft. Please review all details carefully before submitting to the police station.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={20} color={COLORS.primary} />
          <Text style={styles.shareBtnText}>Share Draft</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.downloadBtn} 
          onPress={handleSaveToDevice}
        >
          <Ionicons name="save-outline" size={20} color="#fff" />
          <Text style={styles.downloadBtnText}>Save to Device</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerInner: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginLeft: 15 },
  scroll: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  statusBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(176, 156, 133, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 15 },
  statusText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  editButtonText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  draftContent: { fontSize: 14, color: '#334155', lineHeight: 22, fontFamily: 'monospace' },
  draftInput: { minHeight: 360, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 14, fontSize: 14, color: '#334155', lineHeight: 22, fontFamily: 'monospace', backgroundColor: '#F8FAFC' },
  infoBox: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginTop: 20, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  infoText: { flex: 1, fontSize: 12, color: '#64748b', marginLeft: 10, lineHeight: 18 },
  footer: { flexDirection: 'row', padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e2e8f0' },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary, marginRight: 10 },
  shareBtnText: { marginLeft: 8, fontSize: 14, fontWeight: '600', color: COLORS.primary },
  downloadBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, padding: 16, borderRadius: 12 },
  downloadBtnText: { marginLeft: 8, fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default FIRPreviewScreen;
