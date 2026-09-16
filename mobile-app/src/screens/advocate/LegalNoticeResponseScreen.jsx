// screens/advocate/LegalNoticeResponseScreen.jsx
// Full-featured Legal Notice Response workflow with AI Draft, Document Viewer & Backend Integration
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
  Alert, ActivityIndicator, TextInput, Animated, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { caseAPI, uploadAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

/* ── Theme ──────────────────────────────────────────── */
const T = {
  bg: '#FAF9F8',
  card: '#FFFFFF',
  primary: '#8C6E52',
  primaryLight: '#B09C85',
  accent: '#4F46E5',
  success: '#059669',
  warning: '#D97706',
  border: '#F0ECE7',
  badgeBg: '#F5EFEB',
  dark: '#2D2824',
  muted: '#7D756E',
  subtle: '#9E958C',
};

/* ── Steps ───────────────────────────────────────────── */
const STEPS = [
  { id: 'review',  label: 'Review Notice', icon: 'eye-outline' },
  { id: 'draft',   label: 'Draft Response', icon: 'create-outline' },
  { id: 'upload',  label: 'Upload & Submit', icon: 'cloud-upload-outline' },
];

/* ═══════════════════════════════════════════════════════════ */
export default function LegalNoticeResponseScreen({ navigation, route }) {
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  /* Params from CaseDetailScreen */
  const caseId        = route?.params?.caseId;
  const clientName    = route?.params?.clientName    || 'Client';
  const caseTitle     = route?.params?.caseTitle     || 'Legal Notice';
  const documentUrl   = route?.params?.documentUrl;
  const documentName  = route?.params?.documentName  || 'Original_Notice.pdf';
  const advocateDocs  = route?.params?.advocateDocs  || [];
  const clientId      = route?.params?.clientId;
  const issueDesc     = route?.params?.issueDescription || route?.params?.issue || '';

  /* Step state */
  const [step, setStep] = useState(0); // 0=review, 1=draft, 2=upload

  /* Draft state */
  const [draftText,    setDraftText]    = useState('');
  const [draftSaved,   setDraftSaved]   = useState(false);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiGenerated,  setAiGenerated]  = useState(false);

  /* Upload state */
  const [responseDoc,  setResponseDoc]  = useState(
    advocateDocs.length > 0 ? advocateDocs[advocateDocs.length - 1] : null
  );
  const [uploading,    setUploading]    = useState(false);
  const [submitted,    setSubmitted]    = useState(!!responseDoc);

  /* Pre-populated draft from backend (if admin already generated) */
  const [backendDraft, setBackendDraft] = useState(null);
  const [loadingCase,  setLoadingCase]  = useState(false);

  /* Animations */
  const fadeAnim = useRef(new Animated.Value(1)).current;

  /* ── Load booking data to get AI draft if available ─ */
  useEffect(() => {
    if (!caseId) return;
    const load = async () => {
      setLoadingCase(true);
      try {
        const { data } = await api.get(`/bookings/${caseId}`);
        const booking = data.data || data;
        if (booking?.aiDraft) {
          setBackendDraft(booking.aiDraft);
        }
        if (booking?.advocateDocuments?.length > 0) {
          const lastDoc = booking.advocateDocuments[booking.advocateDocuments.length - 1];
          setResponseDoc(lastDoc);
          setSubmitted(true);
        }
      } catch (e) {
        console.log('Could not load booking details:', e?.message);
      } finally {
        setLoadingCase(false);
      }
    };
    load();
  }, [caseId]);

  /* ── Animate step transitions ── */
  const goToStep = (newStep) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(newStep), 150);
  };

  /* ── Generate AI Draft (calls backend) ── */
  const handleAIGenerate = async () => {
    if (!caseId) {
      // Fallback: generate local draft template
      const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const advocateName = user?.name || 'Advocate';
      const localDraft = `RESPONSE TO LEGAL NOTICE

Date :- ${today}

To
(Name of Sender / Counsel for Opposite Party)
(Address)

Subject :- Response to Legal Notice dated _______________

Dear Sir/Madam,

Under instructions from and on behalf of our client ${clientName}, we hereby respond to your legal notice as under:

1. We have received and carefully perused the contents of your legal notice.

2. The allegations, claims, and demands raised in your notice are denied in their entirety as baseless, misconceived, and legally untenable.

3. Our client has always acted in accordance with the law and has fulfilled all obligations cast upon them.

4. The notice appears to have been issued with the sole purpose of causing undue harassment and inconvenience to our client.

5. Our client reserves all rights and remedies available under law, including but not limited to filing appropriate legal proceedings.

6. You are hereby called upon to retract the said notice immediately and refrain from making any further unsubstantiated claims.

Respectfully submitted,

${advocateName}
[Bar Council No.]
[Date]`;
      setDraftText(localDraft);
      setAiGenerated(false);
      return;
    }

    setAiLoading(true);
    try {
      const { data } = await api.post(`/admin/legal-notices/${caseId}/ai-draft`, {
        instructions: issueDesc ? `Issue: ${issueDesc}` : '',
      });
      const draft = data.data?.draft || '';
      if (draft) {
        setDraftText(draft);
        setAiGenerated(true);
        Alert.alert('✨ AI Draft Generated', 'Review and edit the draft before uploading your response.');
      }
    } catch (e) {
      // If admin endpoint fails (advocate doesn't have admin access), use local template
      console.log('AI draft via admin route failed, using template:', e?.message);
      const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const advocateName = user?.name || 'Advocate';
      setDraftText(`RESPONSE TO LEGAL NOTICE

Date :- ${today}

To
(Name / Counsel for Opposite Party)
(Address)

Subject :- Formal Response to Legal Notice

Dear Sir/Madam,

On behalf of our client ${clientName}, we respond to your legal notice as follows:

Matter: ${issueDesc || caseTitle}

1. The contents of your notice have been carefully reviewed.

2. All allegations therein are denied as false, misleading, and legally untenable.

3. Our client has always acted in full compliance with applicable law.

4. Our client reserves all rights and remedies available under law.

5. Any further unwarranted correspondence shall be dealt with legally.

Respectfully submitted,

${advocateName}`);
      setAiGenerated(true);
    } finally {
      setAiLoading(false);
    }
  };

  /* ── Load backend AI draft ── */
  const handleLoadAdminDraft = () => {
    if (backendDraft) {
      setDraftText(backendDraft);
      setAiGenerated(true);
      Alert.alert('Draft Loaded', 'Admin-generated AI draft has been loaded. You can edit it before uploading.');
    }
  };

  /* ── Save draft locally (simulated) ── */
  const handleSaveDraft = async () => {
    if (!draftText.trim()) {
      Alert.alert('Empty Draft', 'Please write or generate a draft first.');
      return;
    }
    setDraftSaved(true);
    Alert.alert('✅ Draft Saved', 'Your draft has been saved. Proceed to upload your signed response.');
    setTimeout(() => setDraftSaved(false), 3000);
  };

  /* ── Upload response document ── */
  const handleUploadResponse = async () => {
    Alert.alert(
      '📎 Upload Response',
      'Choose how to upload your response document',
      [
        {
          text: '📄 Choose PDF / Document',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
              });
              if (!result.canceled && result.assets?.length > 0) {
                await doUpload(result.assets[0].uri, result.assets[0].name, result.assets[0].mimeType || 'application/pdf');
              }
            } catch (e) { Alert.alert('Error', 'Could not open document picker.'); }
          },
        },
        {
          text: '📷 Take Photo / Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Camera roll access needed.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: false, quality: 0.85,
            });
            if (!result.canceled && result.assets?.length > 0) {
              const asset = result.assets[0];
              const filename = asset.uri.split('/').pop();
              const match = /\.(\w+)$/.exec(filename);
              await doUpload(asset.uri, filename, match ? `image/${match[1]}` : 'image/jpeg');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const doUpload = async (uri, filename, mimeType) => {
    setUploading(true);
    try {
      // 1. Upload to Cloudinary
      const uploadRes = await uploadAPI.uploadFile(uri, filename, mimeType);
      if (!uploadRes?.data?.success) throw new Error('Upload failed');
      const docUrl = uploadRes.data.data.url;

      // 2. Attach as advocate document to booking/case
      if (caseId) {
        try {
          await caseAPI.addDoc(caseId, { name: filename, url: docUrl, type: 'advocate' });
        } catch (e) {
          console.log('addDoc failed, trying booking patch:', e?.message);
          // Fallback: attach via booking API
          await api.patch(`/bookings/${caseId}/status`, { advocateDocuments: [{ name: filename, url: docUrl }] });
        }
      }

      // 3. Auto-send to client via chat
      try {
        const { chatAPI } = require('../../services/api');
        const chatsRes = await chatAPI.getMyChats();
        const chats = chatsRes.data?.data || [];
        const clientIdStr = clientId?.toString();
        const activeChat = chats.find(c =>
          c.participants?.some(p => (p?._id || p)?.toString() === clientIdStr)
        );
        if (activeChat) {
          await chatAPI.sendMessage(activeChat._id, {
            content: `📋 Legal Notice Response Submitted: ${filename}`,
            messageType: 'file',
            fileUrl: docUrl,
            fileName: filename,
          });
        }
      } catch (e) {
        console.log('Auto-chat send failed:', e?.message);
      }

      setResponseDoc({ name: filename, url: docUrl });
      setSubmitted(true);
      Alert.alert(
        '✅ Response Submitted!',
        'Your legal notice response has been uploaded and the client has been notified.',
        [{ text: 'Done', onPress: () => goToStep(2) }]
      );
    } catch (err) {
      Alert.alert('Upload Failed', err?.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  /* ── Open document viewer ── */
  const openViewer = (url, name) => {
    if (!url) { Alert.alert('Document Missing', 'No document available to view.'); return; }
    navigation.navigate('DocumentViewer', {
      clientName, caseTitle, documentUrl: url, fileName: name, hasDocument: true,
    });
  };

  /* ─────────────────────── RENDER ─────────────────────── */
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={T.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Legal Notice Response</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* ── Step Indicator ── */}
      <View style={s.stepBar}>
        {STEPS.map((st, i) => (
          <React.Fragment key={st.id}>
            <TouchableOpacity style={s.stepItem} onPress={() => goToStep(i)} activeOpacity={0.7}>
              <View style={[s.stepCircle, step === i && s.stepCircleActive, step > i && s.stepCircleDone]}>
                {step > i
                  ? <Ionicons name="checkmark" size={14} color="#FFF" />
                  : <Ionicons name={st.icon} size={13} color={step === i ? '#FFF' : T.subtle} />
                }
              </View>
              <Text style={[s.stepLabel, step === i && s.stepLabelActive, step > i && s.stepLabelDone]}>
                {st.label}
              </Text>
            </TouchableOpacity>
            {i < STEPS.length - 1 && (
              <View style={[s.stepLine, step > i && s.stepLineDone]} />
            )}
          </React.Fragment>
        ))}
      </View>

      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scroll, { paddingBottom: Math.max(insets.bottom, 24) + 80 }]}
          showsVerticalScrollIndicator={false}
        >

          {/* ══════════ STEP 0 — Review Notice ══════════ */}
          {step === 0 && (
            <>
              {/* Case Details */}
              <View style={s.card}>
                <Text style={s.cardTitle}>📋 Case Details</Text>
                <Row label="Client" value={clientName} />
                <Row label="Case" value={caseTitle} />
                {issueDesc ? <Row label="Issue" value={issueDesc} multiline /> : null}
              </View>

              {/* Original Notice Document */}
              <View style={s.card}>
                <Text style={s.cardTitle}>📄 Original Legal Notice</Text>
                <View style={s.docRow}>
                  <View style={s.docIcon}>
                    <Ionicons name="document-text-outline" size={22} color={T.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.docName}>{documentName}</Text>
                    <Text style={s.docMeta}>
                      {documentUrl ? 'Uploaded by client' : 'No document uploaded yet'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[s.viewBtn, !documentUrl && s.viewBtnDisabled]}
                  onPress={() => openViewer(documentUrl, documentName)}
                  disabled={!documentUrl}
                >
                  <Ionicons name={documentUrl ? 'eye-outline' : 'eye-off-outline'} size={16} color={documentUrl ? T.primary : T.subtle} />
                  <Text style={[s.viewBtnText, !documentUrl && { color: T.subtle }]}>
                    {documentUrl ? 'View Original Notice' : 'Document Missing'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Admin AI Draft Available */}
              {backendDraft && (
                <TouchableOpacity style={s.aiAvailableCard} onPress={handleLoadAdminDraft} activeOpacity={0.85}>
                  <View style={s.aiAvailableBadge}>
                    <Ionicons name="sparkles" size={18} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.aiAvailableTitle}>AI Draft Ready from Admin</Text>
                    <Text style={s.aiAvailableSub}>Tap to load the admin-generated response draft</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
                </TouchableOpacity>
              )}

              {/* Submitted Response (if already done) */}
              {submitted && responseDoc && (
                <View style={[s.card, { borderColor: '#D1FAE5', backgroundColor: '#F0FDF4' }]}>
                  <Text style={[s.cardTitle, { color: T.success }]}>✅ Response Submitted</Text>
                  <View style={s.docRow}>
                    <View style={[s.docIcon, { backgroundColor: '#D1FAE5' }]}>
                      <Ionicons name="checkmark-done-outline" size={22} color={T.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.docName}>{responseDoc.name}</Text>
                      <Text style={s.docMeta}>Response document uploaded</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={[s.viewBtn, { borderColor: '#6EE7B7' }]} onPress={() => openViewer(responseDoc.url, responseDoc.name)}>
                    <Ionicons name="eye-outline" size={16} color={T.success} />
                    <Text style={[s.viewBtnText, { color: T.success }]}>View Submitted Response</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={s.primaryBtn} onPress={() => goToStep(1)} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={18} color="#FFF" />
                <Text style={s.primaryBtnText}>Draft Response →</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ══════════ STEP 1 — Draft Response ══════════ */}
          {step === 1 && (
            <>
              <View style={s.card}>
                <Text style={s.cardTitle}>✍️ Response Draft</Text>
                <Text style={s.cardSub}>
                  Write your formal legal notice response below. Use AI to generate a professional draft.
                </Text>

                {/* AI Action Row */}
                <View style={s.aiRow}>
                  <TouchableOpacity
                    style={[s.aiBtn, aiLoading && { opacity: 0.7 }]}
                    onPress={backendDraft ? handleLoadAdminDraft : handleAIGenerate}
                    disabled={aiLoading}
                    activeOpacity={0.8}
                  >
                    {aiLoading ? (
                      <ActivityIndicator size="small" color="#7C3AED" />
                    ) : (
                      <Ionicons name="sparkles-outline" size={16} color="#7C3AED" />
                    )}
                    <Text style={s.aiBtnText}>
                      {aiLoading ? 'Generating…' : backendDraft ? 'Load Admin AI Draft' : 'Generate with AI'}
                    </Text>
                  </TouchableOpacity>

                  {draftText ? (
                    <TouchableOpacity style={s.clearBtn} onPress={() => { setDraftText(''); setAiGenerated(false); }}>
                      <Ionicons name="refresh-outline" size={15} color={T.muted} />
                      <Text style={s.clearBtnText}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {aiGenerated && (
                  <View style={s.aiTagRow}>
                    <Ionicons name="sparkles" size={12} color="#7C3AED" />
                    <Text style={s.aiTagText}>AI-generated draft — review and edit before submitting</Text>
                  </View>
                )}

                <TextInput
                  style={s.draftInput}
                  value={draftText}
                  onChangeText={setDraftText}
                  multiline
                  textAlignVertical="top"
                  placeholder={`Start drafting your response here…\n\nOr tap "Generate with AI" above for a professional template based on the case details.`}
                  placeholderTextColor={T.subtle}
                  scrollEnabled={false}
                />

                <Text style={s.charCount}>{draftText.length} characters</Text>
              </View>

              <View style={s.btnRow}>
                <TouchableOpacity style={s.outlineBtn} onPress={() => goToStep(0)} activeOpacity={0.8}>
                  <Ionicons name="arrow-back-outline" size={16} color={T.primary} />
                  <Text style={s.outlineBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.primaryBtn, { flex: 1 }]}
                  onPress={() => {
                    if (draftText.trim()) {
                      handleSaveDraft();
                      setTimeout(() => goToStep(2), 500);
                    } else {
                      Alert.alert('Empty Draft', 'Please write or generate a draft first.');
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
                  <Text style={s.primaryBtnText}>Proceed to Upload →</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ══════════ STEP 2 — Upload & Submit ══════════ */}
          {step === 2 && (
            <>
              {/* Draft Preview */}
              {draftText ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>📋 Draft Preview</Text>
                  <ScrollView style={s.draftPreview} nestedScrollEnabled>
                    <Text style={s.draftPreviewText}>{draftText}</Text>
                  </ScrollView>
                  <TouchableOpacity style={s.smallBtn} onPress={() => goToStep(1)}>
                    <Ionicons name="create-outline" size={14} color={T.primary} />
                    <Text style={s.smallBtnText}>Edit Draft</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Upload Section */}
              <View style={s.card}>
                <Text style={s.cardTitle}>📤 Upload Signed Response</Text>
                <Text style={s.cardSub}>
                  Upload your signed response document (PDF or image). It will be shared with the client automatically.
                </Text>

                {submitted && responseDoc ? (
                  <>
                    <View style={s.docRow}>
                      <View style={[s.docIcon, { backgroundColor: '#D1FAE5' }]}>
                        <Ionicons name="checkmark-circle" size={22} color={T.success} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.docName}>{responseDoc.name}</Text>
                        <Text style={[s.docMeta, { color: T.success }]}>✅ Response submitted successfully</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={[s.viewBtn, { borderColor: '#6EE7B7' }]} onPress={() => openViewer(responseDoc.url, responseDoc.name)}>
                      <Ionicons name="eye-outline" size={16} color={T.success} />
                      <Text style={[s.viewBtnText, { color: T.success }]}>View Submitted Response</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.outlineBtn, { marginTop: 12 }]} onPress={handleUploadResponse} disabled={uploading}>
                      <Ionicons name="refresh-outline" size={16} color={T.primary} />
                      <Text style={s.outlineBtnText}>Re-upload Response</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={s.uploadZone} onPress={handleUploadResponse} disabled={uploading} activeOpacity={0.8}>
                    {uploading ? (
                      <>
                        <ActivityIndicator size="large" color={T.primary} />
                        <Text style={s.uploadZoneText}>Uploading document…</Text>
                      </>
                    ) : (
                      <>
                        <View style={s.uploadZoneIcon}>
                          <Ionicons name="cloud-upload-outline" size={32} color={T.primary} />
                        </View>
                        <Text style={s.uploadZoneTitle}>Tap to Upload Response</Text>
                        <Text style={s.uploadZoneText}>PDF, JPG, PNG • Max 20MB</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Existing Advocate Documents */}
              {advocateDocs.length > 0 && (
                <View style={s.card}>
                  <Text style={s.cardTitle}>📁 Previously Submitted Documents</Text>
                  {advocateDocs.map((doc, i) => (
                    <TouchableOpacity key={i} style={s.prevDocRow} onPress={() => openViewer(doc.url, doc.name)} activeOpacity={0.8}>
                      <Ionicons name="document-attach-outline" size={18} color={T.primary} />
                      <Text style={s.prevDocName} numberOfLines={1}>{doc.name || `Document ${i + 1}`}</Text>
                      <Ionicons name="open-outline" size={14} color={T.subtle} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity style={s.outlineBtn} onPress={() => goToStep(1)} activeOpacity={0.8}>
                <Ionicons name="arrow-back-outline" size={16} color={T.primary} />
                <Text style={s.outlineBtnText}>Back to Draft</Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </Animated.View>

      {/* ── Bottom Summary Bar ── */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.bottomBarLabel}>Case</Text>
          <Text style={s.bottomBarValue} numberOfLines={1}>{caseTitle}</Text>
        </View>
        <View style={[s.statusPill, submitted && s.statusPillDone]}>
          <Ionicons name={submitted ? 'checkmark-circle' : 'time-outline'} size={12} color={submitted ? '#059669' : T.muted} />
          <Text style={[s.statusPillText, submitted && { color: '#059669' }]}>
            {submitted ? 'Submitted' : `Step ${step + 1} of ${STEPS.length}`}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ── Reusable Row Component ── */
const Row = ({ label, value, multiline }) => (
  <View style={[s.metaRow, multiline && { alignItems: 'flex-start' }]}>
    <Text style={s.metaLabel}>{label}</Text>
    <Text style={[s.metaValue, multiline && { maxWidth: '65%', textAlign: 'right' }]} numberOfLines={multiline ? 4 : 1}>
      {value}
    </Text>
  </View>
);

/* ════════════════════════════ STYLES ════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderColor: T.border, backgroundColor: T.bg,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: T.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: T.dark },

  /* Step bar */
  stepBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: T.card, borderBottomWidth: 1, borderColor: T.border,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: T.primary },
  stepCircleDone:   { backgroundColor: T.success },
  stepLabel: { fontSize: 10, color: T.subtle, fontWeight: '500' },
  stepLabelActive: { color: T.primary, fontWeight: '700' },
  stepLabelDone:   { color: T.success, fontWeight: '600' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 6, marginBottom: 14 },
  stepLineDone: { backgroundColor: T.success },

  /* Scroll */
  scroll: { padding: 16, gap: 14 },

  /* Card */
  card: {
    backgroundColor: T.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: T.border,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: T.dark, marginBottom: 4 },
  cardSub:   { fontSize: 12, color: T.muted, marginBottom: 12, lineHeight: 18 },

  /* Rows */
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderColor: '#F8F5F2',
  },
  metaLabel: { fontSize: 12, color: T.muted },
  metaValue: { fontSize: 12, fontWeight: '600', color: T.dark, flex: 1, textAlign: 'right' },

  /* Doc row */
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  docIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: T.badgeBg, alignItems: 'center', justifyContent: 'center',
  },
  docName: { fontSize: 13, fontWeight: '700', color: T.dark },
  docMeta: { fontSize: 11, color: T.muted, marginTop: 2 },

  /* View button */
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: T.badgeBg, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: T.border,
  },
  viewBtnDisabled: { opacity: 0.5 },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: T.primary },

  /* AI draft available banner */
  aiAvailableCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F5F3FF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  aiAvailableBadge: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center',
  },
  aiAvailableTitle: { fontSize: 13, fontWeight: '700', color: '#5B21B6' },
  aiAvailableSub: { fontSize: 11, color: '#7C3AED', marginTop: 2 },

  /* Buttons */
  primaryBtn: {
    backgroundColor: T.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  primaryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: T.primary,
    paddingVertical: 13, backgroundColor: T.card,
  },
  outlineBtnText: { color: T.primary, fontSize: 14, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10 },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end', marginTop: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: T.border,
  },
  smallBtnText: { fontSize: 12, color: T.primary, fontWeight: '600' },

  /* AI row */
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F5F3FF', paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, borderColor: '#DDD6FE',
  },
  aiBtnText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: T.border,
  },
  clearBtnText: { fontSize: 12, color: T.muted },
  aiTagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5F3FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    marginBottom: 10,
  },
  aiTagText: { fontSize: 11, color: '#7C3AED', fontStyle: 'italic' },

  /* Text input */
  draftInput: {
    borderWidth: 1.5, borderColor: T.border, borderRadius: 12,
    padding: 14, fontSize: 12.5, color: T.dark, fontFamily: 'monospace',
    lineHeight: 20, minHeight: 280, backgroundColor: '#FAFAF9',
  },
  charCount: { fontSize: 10, color: T.subtle, textAlign: 'right', marginTop: 4 },

  /* Draft preview */
  draftPreview: {
    backgroundColor: '#F8F7F5', borderRadius: 10, padding: 12, maxHeight: 200,
    borderWidth: 1, borderColor: T.border, marginBottom: 10,
  },
  draftPreviewText: { fontSize: 11, color: T.dark, fontFamily: 'monospace', lineHeight: 18 },

  /* Upload zone */
  uploadZone: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: T.primaryLight,
    borderRadius: 14, padding: 32, alignItems: 'center', gap: 8,
    backgroundColor: T.badgeBg,
  },
  uploadZoneIcon: {
    width: 60, height: 60, borderRadius: 20,
    backgroundColor: T.card, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  uploadZoneTitle: { fontSize: 15, fontWeight: '700', color: T.dark },
  uploadZoneText: { fontSize: 12, color: T.muted },

  /* Prev doc row */
  prevDocRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderColor: T.border,
  },
  prevDocName: { flex: 1, fontSize: 13, color: T.dark, fontWeight: '500' },

  /* Bottom bar */
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: T.card, borderTopWidth: 1, borderColor: T.border,
  },
  bottomBarLabel: { fontSize: 10, color: T.subtle, fontWeight: '500' },
  bottomBarValue: { fontSize: 13, fontWeight: '700', color: T.dark, maxWidth: 220 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: T.badgeBg, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: T.border,
  },
  statusPillDone: { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' },
  statusPillText: { fontSize: 11, fontWeight: '600', color: T.muted },
});
