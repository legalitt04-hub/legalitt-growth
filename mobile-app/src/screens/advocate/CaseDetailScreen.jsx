import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  StatusBar, Alert, ActivityIndicator, Modal, TextInput, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import api, { caseAPI, bookingAPI, chatAPI, legalAdviceAPI, uploadAPI } from '../../services/api';
import { COLORS } from '../../constants/theme';
import { formatDate, formatINR } from '../../utils/helpers';

const Section = ({ title, actionIcon, onActionPress, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionIcon && (
        <TouchableOpacity onPress={onActionPress}>
          <Ionicons name={actionIcon} size={18} color={COLORS.primary} />
        </TouchableOpacity>
      )}
    </View>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

const CaseDetailScreen = ({ route, navigation }) => {
  const { caseId, booking } = route.params || {};
  const [legalCase, setLegalCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [clientDocs, setClientDocs] = useState([]);

  // Modal forms states
  const [timelineModalVisible, setTimelineModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  
  const [timelineForm, setTimelineForm] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().substring(0, 10),
    status: 'scheduled'
  });

  const [noteForm, setNoteForm] = useState({ note: '' });
  const [loadingChat, setLoadingChat] = useState(false);

  const handleMessagePress = async () => {
    const clientUser = legalCase?.client || {};
    if (!clientUser._id) {
      Alert.alert('Error', 'Client profile not found.');
      return;
    }
    if (loadingChat) return;
    setLoadingChat(true);
    try {
      const response = await chatAPI.getMyChats();
      if (response.data?.success) {
        const chats = response.data.data || [];
        const targetUserId = clientUser._id;
        
        // Find if there is an active chat with this client
        const activeChat = chats.find(c =>
          c.participants.some(p => {
            const pIdStr = p._id?.toString() || p.toString();
            return pIdStr && targetUserId && pIdStr === targetUserId.toString();
          })
        );

        if (activeChat) {
          navigation.navigate('Chat', {
            chatId: activeChat._id,
            advocateName: clientUser.name,
            advocateAvatar: clientUser.avatar,
          });
        } else {
          Alert.alert(
            'No Active Chat',
            'No secure chat room could be found for this client. Please ensure the booking is fully confirmed.'
          );
        }
      }
    } catch (err) {
      console.log('Error initiating chat:', err);
      Alert.alert('Error', 'Failed to open chat room.');
    } finally {
      setLoadingChat(false);
    }
  };

  const fetchCaseDetails = async () => {
    try {
      const response = await caseAPI.getOne(caseId);
      if (response.data?.success) {
        setLegalCase(response.data.data);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.log('Case API getOne error, falling back to the assigned booking payload:', err);
    }

    // Use the linked booking when a dedicated case record is unavailable.
    if (booking) {
      const svcLabel = {
        property_research: 'Property Research',
        document_forensic: 'Document Forensic',
        fir_draft: 'FIR Draft',
        legal_notice: 'Legal Notice',
        legal_advice: 'Legal Advice',
        consultation: 'Consultation',
      }[booking.serviceType] || 'Consultation';

      setLegalCase({
        isBooking: true,
        serviceType: booking.serviceType,
        title: booking.issue || `${svcLabel} Request`,
        description: booking.issue || 'No description provided.',
        caseNumber: `REQ-${(booking._id || '').toString().slice(-8).toUpperCase()}`,
        client: booking.client || {},
        status: booking.status || 'pending',
        date: booking.createdAt || new Date().toISOString(),
        timeSlot: booking.timeSlot || null,
        payment: booking.payment || { amount: 0 },
        type: booking.consultationMode || booking.type || 'chat',
        timeline: booking.timeline || [],
        documents: booking.documents || [],
        notes: booking.notes || [],
        _id: booking._id || caseId,
        // Property Research fields
        propertyAddress:    booking.propertyAddress,
        propertyType:       booking.propertyType,
        surveyNumber:       booking.surveyNumber,
        registrationNumber: booking.registrationNumber,
        district:           booking.district,
        state:              booking.state,
        purpose:            booking.purpose,
        // Forensic fields
        documentName: booking.documentName,
        documentType: booking.documentType,
        advocateDocuments: booking.advocateDocuments || [],
      });
      setClientDocs(booking.documents || []);
    } else {
      // No booking and no case found — show empty
      setLegalCase(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCaseDetails();
  }, [caseId, booking]);

  const handleAccept = async () => {
    try {
      await bookingAPI.updateStatus(legalCase._id, 'confirmed');
      Alert.alert('Success', 'Booking confirmed successfully!');
      navigation.goBack();
    } catch (err) { 
      Alert.alert('Error', err.response?.data?.message || 'Could not confirm booking.'); 
    }
  };

  const handleReject = () => {
    Alert.alert('Reject Booking', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        try {
          await bookingAPI.updateStatus(legalCase._id, 'cancelled');
          navigation.goBack();
        } catch { Alert.alert('Error', 'Could not reject booking.'); }
      }},
    ]);
  };

  const handleUpdateStatus = async (status) => {
    if (legalCase?.isBooking) return;
    try {
      const response = await caseAPI.update(caseId, { status });
      if (response.data?.success) {
        setLegalCase(response.data.data);
        Alert.alert('Status Updated', 'Case status set to ' + status.toUpperCase());
      }
    } catch {
      Alert.alert('Error', 'Could not update status.');
    }
  };

  const handleAddTimeline = async () => {
    if (!timelineForm.title || !timelineForm.date) {
      Alert.alert('Required Fields', 'Please fill in Event Title and Date.');
      return;
    }
    try {
      const response = await caseAPI.addTimeline(caseId, timelineForm);
      if (response.data?.success) {
        setLegalCase(response.data.data);
        setTimelineModalVisible(false);
        Alert.alert('Success', 'Court date added to timeline!');
      }
    } catch {
      Alert.alert('Error', 'Could not add timeline event.');
    }
  };

  const handleAddNote = async () => {
    if (!noteForm.note) {
      Alert.alert('Required Fields', 'Note content cannot be empty.');
      return;
    }
    try {
      const response = await caseAPI.addNote(caseId, noteForm);
      if (response.data?.success) {
        setLegalCase(response.data.data);
        setNoteModalVisible(false);
        setNoteForm({ note: '' });
        Alert.alert('Success', 'Case update note added!');
      }
    } catch {
      Alert.alert('Error', 'Could not save case note.');
    }
  };

  const handleAddDocument = async () => {
    // Let advocate choose: Image/Photo OR PDF/Document
    Alert.alert(
      '📎 Share Document with Client',
      'Select what to upload. It will also be sent to the client chat automatically.',
      [
        {
          text: '🖼️ Image / Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Photo library access is required.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: false,
              quality: 0.85,
            });
            if (!result.canceled && result.assets?.[0]) {
              await _uploadAndAttach(result.assets[0].uri, result.assets[0].uri.split('/').pop(), 'image/jpeg');
            }
          },
        },
        {
          text: '📄 PDF / Document',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/msword',
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                       'text/plain', '*/*'],
                copyToCacheDirectory: true,
              });
              if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                await _uploadAndAttach(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
              }
            } catch {
              Alert.alert('Error', 'Could not open document picker.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Shared upload+attach helper used by image and document branches
  const _uploadAndAttach = async (uri, filename, mimeType) => {
    setUploading(true);
    try {
      const response = await uploadAPI.uploadFile(uri, filename, mimeType);
      const docUrl = response?.data?.data?.url || response?.data?.url;

      if (!docUrl) {
        Alert.alert('Upload Failed', 'Server did not return a file URL. Please try again.');
        return;
      }

      // Save document to the case (backend will also auto-send to client chat)
      const docRes = await caseAPI.addDoc(caseId, { name: filename, url: docUrl });

      if (docRes.data?.success) {
        setLegalCase(docRes.data.data);
        Alert.alert(
          '✅ Document Uploaded',
          `"${filename}" has been added to the case and sent to the client in chat automatically.`
        );
      } else {
        Alert.alert('Error', 'Document saved but case update returned unexpected response.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Upload failed.';
      Alert.alert('Upload Error', msg);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  if (!legalCase) return (
    <View style={styles.center}>
      <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
      <Text style={{ color: '#6B7280', fontSize: 14, marginTop: 12 }}>Case details not found.</Text>
    </View>
  );

  const client = legalCase.client || {};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{legalCase.title}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {legalCase.serviceType === 'property_research' ? 'PROPERTY'
              : legalCase.serviceType === 'document_forensic' ? 'FORENSIC'
              : legalCase.serviceType === 'fir_draft' || legalCase.serviceType === 'fir_draft_assistance' ? 'FIR DRAFT'
              : legalCase.serviceType === 'legal_notice' ? 'LEGAL NOTICE'
              : legalCase.isBooking ? 'CONSULTATION'
              : legalCase.status?.toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Case Info */}
        <View style={styles.cardHeader}>
          <Text style={styles.caseNumberText}>Case No: {legalCase.caseNumber || 'Not assigned'}</Text>
          <Text style={styles.courtNameText}>Court: {legalCase.courtName || 'Not assigned'}</Text>
          <Text style={styles.descText}>{legalCase.description || 'No description provided.'}</Text>
          
          {!legalCase.isBooking && (
            <View style={styles.statusActionRow}>
              <Text style={styles.updateStatusLabel}>Update Status:</Text>
              <View style={styles.statusBtnGroup}>
                {['active', 'completed', 'dismissed'].map(st => (
                  <TouchableOpacity
                    key={st}
                    onPress={() => handleUpdateStatus(st)}
                    style={[styles.statusBtn, legalCase.status === st && styles.statusBtnActive]}
                  >
                    <Text style={[styles.statusBtnText, legalCase.status === st && styles.statusBtnTextActive]}>
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Client Linked */}
        <Section title="Linked Client">
          <View style={styles.clientCardContent}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientAvatarText}>{(client.name || 'C')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientName}>{client.name || 'Client'}</Text>
              <Text style={styles.clientMeta}>Contact protected · In-app chat enabled</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {legalCase.status === 'cancelled' ? (
                <View style={[styles.callBtn, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="chatbubble-ellipses" size={16} color="#9CA3AF" />
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.callBtn, { backgroundColor: COLORS.primary }]}
                  onPress={handleMessagePress}
                  disabled={loadingChat}
                >
                  {loadingChat ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="chatbubble-ellipses" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Section>

        {/* Consultation Details (If it is a booking) */}
        {legalCase.isBooking && (
          <>
            <Section title="Consultation Fee">
              <Text style={styles.fee}>{formatINR(legalCase.payment?.amount)}</Text>
              <Text style={styles.feeType}>{legalCase.type === 'video' ? 'Video Consultation' : 'In-person Consultation'}</Text>
            </Section>

            <Section title="Scheduled Time">
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                <Text style={styles.meta}>{formatDate(legalCase.date)}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                <Text style={styles.meta}>{legalCase.timeSlot?.startTime || 'TBD'}</Text>
              </View>
            </Section>

            {/* Service-specific Details Card */}
            {legalCase.serviceType === 'property_research' && (
              <Section title="🏠 Property Details">
                {[
                  { label: 'Address',          value: legalCase.propertyAddress },
                  { label: 'Property Type',    value: legalCase.propertyType },
                  { label: 'Survey No',        value: legalCase.surveyNumber },
                  { label: 'Registration No',  value: legalCase.registrationNumber },
                  { label: 'District',         value: legalCase.district },
                  { label: 'State',            value: legalCase.state },
                  { label: 'Purpose',          value: legalCase.purpose },
                ].filter(f => f.value).map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: '#6B7280', width: 120 }}>{f.label}:</Text>
                    <Text style={{ fontSize: 12, color: '#111827', flex: 1, fontWeight: '600' }}>{f.value}</Text>
                  </View>
                ))}
                {!legalCase.propertyAddress && !legalCase.district && (
                  <Text style={styles.emptyText}>No property details available.</Text>
                )}
              </Section>
            )}

            {legalCase.serviceType === 'document_forensic' && (
              <Section title="🔬 Forensic Document Details">
                {[
                  { label: 'Document Name', value: legalCase.documentName },
                  { label: 'Document Type', value: legalCase.documentType },
                ].filter(f => f.value).map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: '#6B7280', width: 130 }}>{f.label}:</Text>
                    <Text style={{ fontSize: 12, color: '#111827', flex: 1, fontWeight: '600' }}>{f.value}</Text>
                  </View>
                ))}
                {!legalCase.documentName && (
                  <Text style={styles.emptyText}>No forensic document details available.</Text>
                )}
              </Section>
            )}

            {/* Client Uploaded Documents */}
            <Section title="📎 Documents from Client">
              {clientDocs.length === 0 ? (
                <Text style={styles.emptyText}>Client has not uploaded any documents yet.</Text>
              ) : (
                <View style={styles.docsList}>
                  {clientDocs.map((doc, idx) => (
                    <TouchableOpacity
                      key={doc._id || idx}
                      style={styles.docRow}
                      onPress={() => {
                        if (doc.url) {
                          navigation.navigate('DocumentViewer', {
                            documentUrl: doc.url,
                            fileName: doc.name || `Document ${idx + 1}`,
                            clientName: client?.name || 'Client',
                            caseTitle: legalCase.title || legalCase.issue || 'Case Document',
                          });
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={doc.type === 'pdf' ? 'document-text' : 'image-outline'}
                        size={20}
                        color={COLORS.primary}
                      />
                      <Text style={styles.docName} numberOfLines={1}>{doc.name || `Document ${idx + 1}`}</Text>
                      <View style={styles.docViewBtn}>
                        <Text style={styles.docViewBtnText}>Open ↗</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Section>

            {/* Admin / Expert Uploaded Documents */}
            {(legalCase?.advocateDocuments?.length > 0 || legalCase?.adminDocuments?.length > 0) && (
              <Section title="📋 Documents from Admin / Expert">
                <View style={styles.docsList}>
                  {[...(legalCase.advocateDocuments || []), ...(legalCase.adminDocuments || [])].map((doc, idx) => (
                    <TouchableOpacity
                      key={doc._id || idx}
                      style={[styles.docRow, { backgroundColor: '#F0FDF4', borderRadius: 8, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 8 }]}
                      onPress={() => {
                        if (doc.url) {
                          navigation.navigate('DocumentViewer', {
                            documentUrl: doc.url,
                            fileName: doc.name || `Admin Document ${idx + 1}`,
                            clientName: client?.name || 'Client',
                            caseTitle: legalCase.title || legalCase.issue || 'Case Document',
                          });
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={doc.type === 'pdf' || doc.name?.toLowerCase().endsWith('.pdf') ? 'document-text' : 'image-outline'}
                        size={20}
                        color="#16A34A"
                      />
                      <Text style={[styles.docName, { color: '#15803D' }]} numberOfLines={1}>
                        {doc.name || `Admin Document ${idx + 1}`}
                      </Text>
                      <View style={[styles.docViewBtn, { backgroundColor: '#16A34A' }]}>
                        <Text style={styles.docViewBtnText}>Open ↗</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>
            )}

            {/* Legal Notice Response Workflow Module */}
            {(['legal_notice', 'legal_advice'].includes(legalCase.serviceType) || ['legal_notice', 'legal_advice'].includes(booking?.serviceType)) && (
              legalCase.status === 'cancelled' ? (
                <Section title="⚖️ Workflow Status">
                  <View style={[styles.legalNoticePromoCard, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', justifyContent: 'center', paddingVertical: 16 }]}>
                    <Text style={{ color: '#B91C1C', fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      ❌ Consultation Rejected
                    </Text>
                  </View>
                </Section>
              ) : (
                <Section title={legalCase.serviceType === 'legal_advice' ? '⚖️ Legal Advice Workspace' : '⚖️ Legal Notice & Response'}>
                  <View style={styles.legalNoticePromoCard}>
                    <View style={styles.legalNoticePromoLeft}>
                      <Text style={styles.legalNoticePromoTitle}>
                        {legalCase.serviceType === 'legal_advice' ? 'Legal Advice & Opinion' : 'Legal Notice Response'}
                      </Text>
                      <Text style={styles.legalNoticePromoSub}>
                        {legalCase.serviceType === 'legal_advice'
                          ? 'Review documents, draft advice with AI, and share the final opinion'
                          : 'Prepare, draft with AI, sign & submit formal response'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.legalNoticePromoBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        const legalNoticeBookingId = booking?._id || legalCase.bookingId || (legalCase.isBooking ? legalCase._id : null);
                        if (!legalNoticeBookingId) {
                          Alert.alert('Booking unavailable', 'Open this workflow from an assigned legal notice booking.');
                          return;
                        }
                        const doc = legalCase.documents?.[0] || clientDocs?.[0] || null;
                        navigation.navigate('LegalNoticeResponse', {
                          bookingId: legalNoticeBookingId,
                          caseId: legalNoticeBookingId,
                          clientId: legalCase.client?._id,
                          clientName: legalCase.client?.name,
                          caseTitle: legalCase.issue || legalCase.title,
                          serviceType: legalCase.serviceType || booking?.serviceType || 'legal_notice',
                          documentUrl: doc?.url,
                          documentName: doc?.name,
                          advocateDocs: legalCase.advocateDocuments || [],
                        });
                      }}
                    >
                      <Text style={styles.legalNoticePromoBtnText}>Open Workflow →</Text>
                    </TouchableOpacity>
                  </View>
                </Section>
              )
            )}
          </>
        )}

        {/* Ongoing Case Modules */}
        {!legalCase.isBooking && (
          <>
            {/* Timeline / Court Dates */}
            <Section 
              title="Timeline & Court Dates" 
              actionIcon="calendar-outline" 
              onActionPress={() => setTimelineModalVisible(true)}
            >
              {legalCase.timeline.length === 0 ? (
                <Text style={styles.emptyText}>No court hearings or timeline events scheduled.</Text>
              ) : (
                <View style={styles.timelineList}>
                  {legalCase.timeline.map((ev, idx) => (
                    <View key={ev._id || idx} style={styles.timelineRow}>
                      <View style={styles.timelinePoint}>
                        <View style={styles.timelineBullet} />
                        {idx !== legalCase.timeline.length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.timelineBody}>
                        <Text style={styles.timelineTitle}>{ev.title}</Text>
                        <Text style={styles.timelineDate}>{formatDate(ev.date)} • {ev.status}</Text>
                        {ev.description && <Text style={styles.timelineDesc}>{ev.description}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Section>

            {/* Document sharing */}
            <Section 
              title="Case Evidence & Documents" 
              actionIcon={uploading ? null : "cloud-upload-outline"} 
              onActionPress={handleAddDocument}
            >
              {uploading && <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 10 }} />}
              {legalCase.documents.length === 0 ? (
                <Text style={styles.emptyText}>No documents uploaded for this case yet.</Text>
              ) : (
                <View style={styles.docsList}>
                  {(legalCase.documents || []).map((doc, idx) => (
                    <View key={doc._id || idx} style={styles.docRow}>
                      <Ionicons name="document-text" size={20} color={COLORS.primary} />
                      <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                      <TouchableOpacity onPress={() => {
                        if (doc.url) {
                          navigation.navigate('DocumentViewer', {
                            documentUrl: doc.url,
                            fileName: doc.name || `Document ${idx + 1}`,
                            clientName: client?.name || 'Client',
                            caseTitle: legalCase.title || legalCase.issue || 'Case Document',
                          });
                        }
                      }}>
                        <Text style={styles.docViewBtnText}>View</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </Section>

            {/* Case notes and Updates */}
            <Section 
              title="Case Notes & Private Board" 
              actionIcon="create-outline" 
              onActionPress={() => setNoteModalVisible(true)}
            >
              {legalCase.notes.length === 0 ? (
                <Text style={styles.emptyText}>No case notes left yet. Leave case updates to track strategy.</Text>
              ) : (
                <View style={styles.notesList}>
                  {legalCase.notes.map((n, idx) => (
                    <View key={n._id || idx} style={styles.noteRow}>
                      <Text style={styles.noteBody}>{n.note}</Text>
                      <Text style={styles.noteTime}>{formatDate(n.createdAt)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Section>
          </>
        )}
      </ScrollView>

      {/* Booking confirmation controls */}
      {legalCase?.isBooking && legalCase.status === 'pending' && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
            <Text style={styles.acceptButtonText}>Accept Consultation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
            <Text style={styles.rejectButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TIMELINE EVENT MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={timelineModalVisible}
        onRequestClose={() => setTimelineModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Court Date / Event</Text>
              <TouchableOpacity onPress={() => setTimelineModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              <Text style={styles.label}>Event / Hearing Title *</Text>
              <TextInput
                style={styles.input}
                value={timelineForm.title}
                onChangeText={(v) => setTimelineForm(p => ({ ...p, title: v }))}
                placeholder="e.g. Submission of Land Deed Evidence"
              />

              <Text style={styles.label}>Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                value={timelineForm.date}
                onChangeText={(v) => setTimelineForm(p => ({ ...p, date: v }))}
                placeholder="e.g. 2026-06-15"
              />

              <Text style={styles.label}>Action / Agenda Description</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={timelineForm.description}
                onChangeText={(v) => setTimelineForm(p => ({ ...p, description: v }))}
                multiline
                numberOfLines={3}
                placeholder="Details of expectations or client preparation requirements..."
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleAddTimeline}>
                <Text style={styles.submitBtnText}>Add Hearing Date</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CASE NOTES MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={noteModalVisible}
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Write Case Note Update</Text>
              <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              <Text style={styles.label}>Update Note Details *</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={noteForm.note}
                onChangeText={(v) => setNoteForm({ note: v })}
                multiline
                numberOfLines={5}
                placeholder="Spoke with client. Client agreed to pay full registration fee. Prepared evidence pack for June hearing..."
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleAddNote}>
                <Text style={styles.submitBtnText}>Add Note</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  backBtn: { width: 36, padding: 4 },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginRight: 10 },
  statusBadge: {
    backgroundColor: 'rgba(20, 184, 166, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12
  },
  statusText: { color: COLORS.primary, fontSize: 9, fontWeight: '800' },
  
  scroll: { padding: 16, gap: 16, paddingBottom: 120 },
  
  cardHeader: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F3F4F6'
  },
  caseNumberText: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  courtNameText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },
  descText: { fontSize: 13, color: '#4B5563', lineHeight: 20, marginTop: 12 },
  
  statusActionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16,
    borderTopWidth: 1, borderColor: '#F3F4F6', paddingTop: 16
  },
  updateStatusLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textPrimary },
  statusBtnGroup: { flexDirection: 'row', gap: 6, flex: 1 },
  statusBtn: {
    flex: 1, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6',
    alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6'
  },
  statusBtnActive: {
    backgroundColor: 'rgba(20, 184, 166, 0.08)', borderColor: COLORS.primary
  },
  statusBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  statusBtnTextActive: { color: COLORS.primary, fontWeight: '800' },

  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  sectionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1
  },

  clientCardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(20, 184, 166, 0.1)',
    alignItems: 'center', justifyContent: 'center'
  },
  clientAvatarText: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  clientName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  clientMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  callBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center'
  },

  emptyText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingVertical: 8, fontWeight: '500' },
  
  // Timeline styles
  timelineList: { gap: 12 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelinePoint: { alignItems: 'center', width: 12 },
  timelineBullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  timelineBody: { flex: 1, paddingBottom: 10 },
  timelineTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  timelineDate: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },
  timelineDesc: { fontSize: 12, color: '#4B5563', lineHeight: 18, marginTop: 4 },

  // Docs styles
  docsList: { gap: 10 },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderColor: '#F3F4F6'
  },
  docName: { fontSize: 13, color: COLORS.textPrimary, flex: 1 },
  docViewBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(20,184,166,0.1)', borderRadius: 8 },
  docViewBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  // Notes styles
  notesList: { gap: 12 },
  noteRow: {
    padding: 12, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB'
  },
  noteBody: { fontSize: 12, color: COLORS.textPrimary, lineHeight: 18 },
  noteTime: { fontSize: 10, color: '#9CA3AF', marginTop: 6, fontWeight: '600' },

  // Scheduled / Booking styles
  fee: { fontSize: 24, fontWeight: '900', color: COLORS.primary },
  feeType: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  metaDot: { fontSize: 12, color: COLORS.textSecondary },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12,
    backgroundColor: '#FFFFFF', padding: 16, paddingBottom: 36, borderTopWidth: 1, borderColor: '#F3F4F6'
  },
  acceptButton: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 99, alignItems: 'center' },
  acceptButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  rejectButton: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 12, borderRadius: 99, alignItems: 'center' },
  rejectButtonText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },

  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', paddingBottom: 40
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderColor: '#F3F4F6'
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  modalForm: { padding: 20, gap: 12 },
  label: { fontSize: 11, fontWeight: '800', color: COLORS.textPrimary },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, padding: 12, fontSize: 13, color: COLORS.textPrimary
  },
  multilineInput: { height: 100, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 12
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Legal Notice Promo Styles
  legalNoticePromoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEAE4',
    gap: 10,
  },
  legalNoticePromoLeft: {
    flex: 1,
  },
  legalNoticePromoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2824',
  },
  legalNoticePromoSub: {
    fontSize: 11,
    color: '#7D756E',
    marginTop: 2,
  },
  legalNoticePromoBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  legalNoticePromoBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default CaseDetailScreen;
