// screens/advocate/LegalNoticeResponseScreen.jsx
// Full-featured Legal Notice Response workflow with AI Draft, Document Viewer & Backend Integration
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
  Alert, ActivityIndicator, TextInput, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { legalAdviceAPI, uploadAPI } from '../../services/api';

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

  /* Params from CaseDetailScreen */
  const bookingId     = route?.params?.bookingId || route?.params?.caseId;
  const routeAdvocateDocs = route?.params?.advocateDocs || [];
  const routeClientDoc = route?.params?.documentUrl ? [{
    url: route.params.documentUrl,
    name: route?.params?.documentName || 'Client document',
  }] : [];

  /* The route params make the first paint fast; the authorized booking response
     becomes the source of truth as soon as it loads. */
  const [caseData, setCaseData] = useState(null);
  const serviceType   = caseData?.serviceType || route?.params?.serviceType || 'legal_notice';
  const isLegalAdvice = serviceType === 'legal_advice';
  const clientName    = caseData?.client?.name || route?.params?.clientName || 'Client';
  const caseTitle     = caseData?.issue || caseData?.issueDescription || route?.params?.caseTitle || (isLegalAdvice ? 'Legal Advice' : 'Legal Notice');
  const issueDesc     = caseData?.issueDescription || caseData?.issue || route?.params?.issueDescription || route?.params?.issue || '';
  const clientDocs    = caseData?.documents?.length ? caseData.documents : routeClientDoc;
  const advocateDocs  = caseData?.advocateDocuments || routeAdvocateDocs;

  /* Step state */
  const [step, setStep] = useState(0); // 0=review, 1=draft, 2=upload

  /* Draft state */
  const [draftText,    setDraftText]    = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiGenerated,  setAiGenerated]  = useState(false);

  /* Upload state */
  const [responseDoc,  setResponseDoc]  = useState(
    routeAdvocateDocs.length > 0 ? routeAdvocateDocs[routeAdvocateDocs.length - 1] : null
  );
  const [uploading,    setUploading]    = useState(false);
  const [submitted,    setSubmitted]    = useState(!!responseDoc);

  /* Pre-populated draft from backend (if admin already generated) */
  const [backendDraft, setBackendDraft] = useState(null);
  const [loadingCase,  setLoadingCase]  = useState(false);
  const [caseLoadError, setCaseLoadError] = useState('');

  /* Animations */
  const fadeAnim = useRef(new Animated.Value(1)).current;

  /* ── Load booking data to get AI draft if available ─ */
  const loadCase = async () => {
    if (!bookingId) {
      setCaseLoadError('This workspace needs an assigned legal service booking.');
      return;
    }
    setLoadingCase(true);
    setCaseLoadError('');
    try {
      const { data } = await legalAdviceAPI.getRequestDetail(bookingId);
      const booking = data.data || data;
      setCaseData(booking);
      setBackendDraft(booking?.aiDraft || null);
      const docs = booking?.advocateDocuments || [];
      const lastDoc = docs[docs.length - 1] || null;
      const isShared = !!lastDoc && (
        lastDoc.reviewStatus === 'shared_with_client' || booking.status === 'completed'
      );
      setResponseDoc(isShared ? lastDoc : null);
      setSubmitted(isShared);
    } catch (e) {
      setCaseLoadError(e.response?.data?.message || 'Could not load this legal service. Pull back and try again.');
    } finally {
      setLoadingCase(false);
    }
  };

  useEffect(() => { loadCase(); }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!bookingId) {
      Alert.alert('Booking unavailable', 'Open this screen from an assigned legal notice booking.');
      return;
    }

    setAiLoading(true);
    try {
      const { data } = await legalAdviceAPI.generateDraft(
        bookingId,
        issueDesc ? `Focus on this matter: ${issueDesc}` : ''
      );
      const draft = data.data?.draft || '';
      if (draft) {
        setDraftText(draft);
        setBackendDraft(draft);
        setAiGenerated(true);
        Alert.alert('✨ AI Draft Generated', 'Review and edit the draft before uploading your response.');
      }
    } catch (e) {
      Alert.alert('Draft generation failed', e.response?.data?.message || 'Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  /* ── Load backend AI draft ── */
  const handleLoadSavedDraft = () => {
    if (backendDraft) {
      setDraftText(backendDraft);
      setAiGenerated(false);
      Alert.alert('Draft Loaded', 'Your saved draft has been loaded. Review it before uploading the signed response.');
    }
  };

  /* ── Persist advocate draft ── */
  const handleSaveDraft = async () => {
    if (!draftText.trim()) {
      Alert.alert('Empty Draft', 'Please write or generate a draft first.');
      return false;
    }
    if (!bookingId) {
      Alert.alert('Booking unavailable', 'Open this screen from an assigned legal notice booking.');
      return false;
    }
    try {
      const { data } = await legalAdviceAPI.saveDraft(bookingId, draftText.trim());
      setBackendDraft(data.data?.draft || draftText.trim());
      Alert.alert('✅ Draft Saved', 'Your draft has been saved. Proceed to upload your signed response.');
      return true;
    } catch (e) {
      Alert.alert('Save Failed', e.response?.data?.message || 'Please try again.');
      return false;
    }
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

      if (!bookingId) throw new Error('Legal notice booking is missing.');
      const { data } = await legalAdviceAPI.submitDocument(bookingId, {
        name: filename,
        url: docUrl,
        type: mimeType,
      });
      const savedDocument = data.data?.document || { name: filename, url: docUrl, type: mimeType };
      setCaseData(prev => ({
        ...(prev || {}),
        status: 'completed',
        advocateDocuments: [...(prev?.advocateDocuments || routeAdvocateDocs), savedDocument],
      }));
      setResponseDoc(savedDocument);
      setSubmitted(true);
      Alert.alert(
        '✅ Response Submitted!',
        `Your ${isLegalAdvice ? 'legal advice document' : 'legal notice response'} is now available in the client chat and admin case record.`,
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

  if (loadingCase) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={T.bg} />
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={T.dark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Legal Service Workspace</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={s.centerState}>
          <ActivityIndicator size="large" color={T.primary} />
          <Text style={s.centerStateText}>Loading booking, documents and saved draft…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (caseLoadError) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={T.bg} />
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={T.dark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Legal Service Workspace</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={s.centerState}>
          <Ionicons name="alert-circle-outline" size={42} color={T.warning} />
          <Text style={s.centerStateTitle}>Workspace unavailable</Text>
          <Text style={s.centerStateText}>{caseLoadError}</Text>
          {!!bookingId && (
            <TouchableOpacity style={[s.primaryBtn, { alignSelf: 'stretch' }]} onPress={loadCase}>
              <Ionicons name="refresh-outline" size={18} color="#FFF" />
              <Text style={s.primaryBtnText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  /* ─────────────────────── RENDER ─────────────────────── */
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={T.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isLegalAdvice ? 'Legal Advice Workspace' : 'Legal Notice Response'}</Text>
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

              {/* Client source documents */}
              <View style={s.card}>
                <Text style={s.cardTitle}>{isLegalAdvice ? '📄 Client Documents' : '📄 Original Legal Notice'}</Text>
                {clientDocs.length > 0 ? clientDocs.map((doc, index) => (
                  <TouchableOpacity
                    key={doc._id || doc.url || index}
                    style={s.sourceDocRow}
                    onPress={() => openViewer(doc.url, doc.name || `Client document ${index + 1}`)}
                    activeOpacity={0.8}
                  >
                    <View style={s.docIcon}>
                      <Ionicons name="document-text-outline" size={22} color={T.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.docName}>{doc.name || `Client document ${index + 1}`}</Text>
                      <Text style={s.docMeta}>Uploaded by client · Tap to view</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={T.primary} />
                  </TouchableOpacity>
                )) : (
                  <View style={s.emptyDocState}>
                    <Ionicons name="document-outline" size={24} color={T.subtle} />
                    <Text style={s.docMeta}>No client document has been uploaded for this request.</Text>
                  </View>
                )}
              </View>

              {/* Saved working draft */}
              {backendDraft && (
                <TouchableOpacity style={s.aiAvailableCard} onPress={handleLoadSavedDraft} activeOpacity={0.85}>
                  <View style={s.aiAvailableBadge}>
                    <Ionicons name="sparkles" size={18} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.aiAvailableTitle}>Saved Draft Available</Text>
                    <Text style={s.aiAvailableSub}>Tap to continue editing the latest saved draft</Text>
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
                  {isLegalAdvice
                    ? 'Prepare a clear legal opinion for the client. Use AI for a structured first draft.'
                    : 'Write your formal legal notice response below. Use AI to generate a professional draft.'}
                </Text>

                {/* AI Action Row */}
                <View style={s.aiRow}>
                  {backendDraft ? (
                    <TouchableOpacity style={s.aiBtn} onPress={handleLoadSavedDraft} activeOpacity={0.8}>
                      <Ionicons name="download-outline" size={16} color="#7C3AED" />
                      <Text style={s.aiBtnText}>Load Saved Draft</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[s.aiBtn, aiLoading && { opacity: 0.7 }]}
                    onPress={handleAIGenerate}
                    disabled={aiLoading}
                    activeOpacity={0.8}
                  >
                    {aiLoading ? (
                      <ActivityIndicator size="small" color="#7C3AED" />
                    ) : (
                      <Ionicons name="sparkles-outline" size={16} color="#7C3AED" />
                    )}
                    <Text style={s.aiBtnText}>
                      {aiLoading ? 'Generating…' : backendDraft ? 'Generate New AI Draft' : 'Generate with AI'}
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
                  onPress={async () => {
                    if (draftText.trim()) {
                      const saved = await handleSaveDraft();
                      if (saved) goToStep(2);
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
                  Upload the final {isLegalAdvice ? 'legal advice' : 'legal notice response'} document (PDF or image). It will appear immediately in the client chat and admin case record.
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
                        <Text style={s.uploadZoneText}>PDF, JPG, PNG • Max 25MB</Text>
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
                    <TouchableOpacity key={doc._id || doc.url || i} style={s.prevDocRow} onPress={() => openViewer(doc.url, doc.name)} activeOpacity={0.8}>
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
  centerState: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 14 },
  centerStateTitle: { fontSize: 18, fontWeight: '700', color: T.dark },
  centerStateText: { fontSize: 13, lineHeight: 20, color: T.muted, textAlign: 'center' },
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
  sourceDocRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderColor: T.border,
  },
  emptyDocState: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
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
  aiRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
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
