import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import * as DocumentPicker from 'expo-document-picker';
import { legalAdviceAPI, paymentAPI, uploadAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import RazorpayCheckout from 'react-native-razorpay';
import { usePricing } from '../../context/PricingContext';
import TestModeBanner from '../../components/TestModeBanner';

const { width } = Dimensions.get('window');

const QUICK_CATEGORIES = [
  'Property Dispute',
  'Money Recovery',
  'Tenant Issue',
  'Family Dispute',
  'Cheque Bounce',
  'Consumer Complaint',
  'Employment Issue',
  'Cyber Crime',
  'Loan Recovery',
  'Other',
];

const INITIAL_DOC_TYPES = [
  { id: 'aadhaar', title: 'Aadhaar Card', sub: 'Govt Identity Proof (Front & Back)', icon: 'card-outline' },
  { id: 'property', title: 'Property Papers', sub: 'Ownership or Lease Agreement Docs', icon: 'document-text-outline' },
  { id: 'sale_deed', title: 'Sale Deed', sub: 'Registered Property Sale Records', icon: 'journal-outline' },
  { id: 'agreement', title: 'Agreement', sub: 'Signed Contract or Rental Agreement', icon: 'clipboard-outline' },
  { id: 'whatsapp', title: 'WhatsApp Chats', sub: 'Chat Screenshots or PDF Export', icon: 'chatbubbles-outline' },
  { id: 'email', title: 'Email Evidence', sub: 'Important Communications or Receipts', icon: 'mail-outline' },
  { id: 'screenshots', title: 'Screenshots', sub: 'Payment Receipts or Notice Messages', icon: 'image-outline' },
  { id: 'audio', title: 'Audio Recording', sub: 'MP3 / WAV Audio Evidence', icon: 'mic-outline' },
  { id: 'video', title: 'Video', sub: 'MP4 Incident or Property Footage', icon: 'videocam-outline' },
  { id: 'other', title: 'Other Documents', sub: 'Any additional supporting evidence', icon: 'folder-open-outline' },
];

export default function AILegalNoticeScreen({ navigation }) {
  const { user, isAuthenticated } = useAuth();
  const { getPrice } = usePricing();
  const userData = user?.user || user || {};
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  // Form States
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [issueDescription, setIssueDescription] = useState('');

  // Step 2: Recipient Details
  const [recipientName, setRecipientName] = useState('');
  const [recipientRelation, setRecipientRelation] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');

  // Step 3: Client Details
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderAddress, setSenderAddress] = useState('');

  // Step 4: Documents Upload State
  const [documents, setDocuments] = useState(
    INITIAL_DOC_TYPES.map(doc => ({ ...doc, uploaded: false, uploading: false, progress: 0 }))
  );

  // Step 5: Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (nextStepAction) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    nextStepAction();
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!selectedCategory && !issueDescription.trim()) {
        Alert.alert('Selection Required', 'Please select a legal issue category or describe your issue.');
        return;
      }
    } else if (currentStep === 2) {
      if (!recipientName.trim() || !recipientAddress.trim()) {
        Alert.alert('Required Fields', 'Please fill in Notice Recipient Name and Complete Address.');
        return;
      }
    } else if (currentStep === 3) {
      if (!senderName.trim() || !senderPhone.trim() || !senderEmail.trim() || !senderAddress.trim()) {
        Alert.alert('Required Fields', 'Please fill in all required personal details before continuing.');
        return;
      }
    }

    if (currentStep < totalSteps) {
      animateTransition(() => setCurrentStep(prev => prev + 1));
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1 && !isSubmitted) {
      animateTransition(() => setCurrentStep(prev => prev - 1));
    } else {
      navigation.goBack();
    }
  };

  const handleRealUpload = async (id) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];

      setDocuments(prev =>
        prev.map(doc => (doc.id === id ? { ...doc, uploading: true, progress: 0.5 } : doc))
      );

      const response = await uploadAPI.uploadFile(
        file.uri,
        file.name || `document_${id}.pdf`,
        file.mimeType || 'application/pdf'
      );
      const uploadedUrl = response.data?.data?.url;
      if (!uploadedUrl) throw new Error('The server did not return a document URL.');

      setDocuments(prev =>
        prev.map(doc => {
          if (doc.id === id) {
            return {
              ...doc,
              uploading: false,
              uploaded: true,
              uploadedUrl,
              fileName: file.name,
            };
          }
          return doc;
        })
      );
      Alert.alert('✔ Uploaded', `File "${file.name}" attached successfully.`);
    } catch (err) {
      console.error('Document upload error:', err);
      setDocuments(prev =>
        prev.map(doc => (doc.id === id ? { ...doc, uploading: false } : doc))
      );
      Alert.alert('Upload Failed', err?.message || 'Could not upload document. Please try again.');
    }
  };

  const handleSubmitReview = async () => {
    // ─── Auth gate: require login before submission ───────────────────────────
    if (!isAuthenticated) {
      Alert.alert(
        '🔐 Login Required',
        'Please login to submit your Legal Notice request.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Login Now',
            style: 'default',
            onPress: () => navigation.navigate('LoginRegister', { role: 'client' }),
          },
        ]
      );
      return;
    }

    if (!selectedCategory) return Alert.alert('Required', 'Please select a legal notice category.');
    if (!issueDescription.trim() || issueDescription.trim().length < 10) {
      return Alert.alert('Required', 'Please describe your issue (min 10 characters).');
    }
    if (!senderName.trim()) return Alert.alert('Required', 'Please enter your name.');
    if (!senderPhone.trim()) return Alert.alert('Required', 'Please enter your phone number.');
    if (!recipientName.trim()) return Alert.alert('Required', 'Please enter the legal notice recipient name.');
    if (!recipientAddress.trim()) return Alert.alert('Required', 'Please enter the recipient address.');

    setIsSubmitting(true);
    try {
      const amount = getPrice('legal_notice', 1499); // Legal Notice base price

      // Step 1: Create booking on backend
      const bookingRes = await legalAdviceAPI.createRequest({
        consultationMode: 'chat',
        serviceType: 'legal_notice',
        issueCategory: selectedCategory,
        issueDescription: `${issueDescription.trim()}\n\nSender: ${senderName.trim()}\nSender phone: ${senderPhone.trim()}\nSender email: ${senderEmail.trim() || 'Not provided'}\nSender address: ${senderAddress.trim() || 'Not provided'}\n\nRecipient: ${recipientName.trim()}${recipientRelation.trim() ? ` (${recipientRelation.trim()})` : ''}\nRecipient phone: ${recipientPhone.trim() || 'Not provided'}\nRecipient email: ${recipientEmail.trim() || 'Not provided'}\nRecipient address: ${recipientAddress.trim()}`,
        preferredSlot: 'Within 24 Hours',
        documents: documents.filter(d => d.uploaded && d.uploadedUrl).map(d => ({
          url: d.uploadedUrl,
          name: d.fileName || d.title,
          type: d.fileName?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'document',
        })),
        clientCity: senderAddress || userData.address?.city || '',
        amount,
        recipientDetails: {
          name: recipientName,
          relation: recipientRelation,
          phone: recipientPhone,
          email: recipientEmail,
          address: recipientAddress,
        },
      });

      const { bookingId, amount: bookingAmount } = bookingRes.data.data;

      // Step 2: Razorpay payment
      const orderRes = await paymentAPI.createOrder(bookingId);
      const { orderId, amount: orderAmount, currency, keyId } = orderRes.data.data;

      let paymentData;
      try {
        paymentData = await RazorpayCheckout.open({
          description: 'Legal Notice Drafting & Review',
          image: 'https://res.cloudinary.com/legalitt/image/upload/v1/legalitt-logo.png',
          currency: currency || 'INR',
          key: keyId,
          amount: orderAmount,
          name: 'Legalitt',
          order_id: orderId,
          prefill: {
            email: senderEmail || userData.email,
            contact: senderPhone.replace(/\D/g, '').slice(-10),
            name: senderName,
          },
          theme: { color: '#B09C85' },
        });
      } catch (rzpErr) {
        if (rzpErr?.code === 'PAYMENT_CANCELLED' || rzpErr?.description?.includes('cancel')) {
          setIsSubmitting(false); // ← Fix: button was stuck in spinner after cancel
          Alert.alert('Payment Cancelled', 'You cancelled the payment. Request not submitted.');
          return;
        }
        throw rzpErr;
      }

      // Step 3: Confirm payment
      await legalAdviceAPI.confirmPayment({
        bookingId,
        razorpayOrderId: paymentData.razorpay_order_id,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySignature: paymentData.razorpay_signature,
      });

      setIsSubmitting(false);
      setIsSubmitted(true);

      // Navigate to success after a moment
      setTimeout(() => {
        navigation.navigate('ConsultationScheduled', {
          bookingData: {
            bookingId,
            requestId: `NOT-${bookingId.substring(bookingId.length - 6).toUpperCase()}`,
            selectedType: { title: 'Legal Notice', price: String(amount) },
            selectedMatter: { title: selectedCategory },
            serviceType: 'legal_notice',
            clientDetails: { fullName: senderName, phone: senderPhone },
            totalAmount: bookingAmount,
          },
        });
      }, 1500);
    } catch (err) {
      setIsSubmitting(false);
      if (err?.code === 'PAYMENT_CANCELLED') {
        Alert.alert('Payment Cancelled', 'Your legal notice request was not submitted.');
      } else {
        const status = err?.response?.status;
        const msg = err?.response?.data?.message || err?.message || '';
        if (status === 401 || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('not authenticated')) {
          Alert.alert('🔐 Login Required', 'Please login to continue.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Login Now', onPress: () => navigation.navigate('LoginRegister', { role: 'client' }) },
          ]);
        } else {
          Alert.alert('Error', msg || 'Submission failed. Please try again.');
        }
      }
    }
  };

  const uploadedDocCount = documents.filter(d => d.uploaded).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      {!isSubmitted && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handlePrevStep} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Legal Notice Assistance</Text>
            <View style={styles.headerSubtitleRow}>
              <Ionicons name="shield-outline" size={12} color={COLORS.primary} />
              <Text style={styles.headerSubtitle}>Secure &amp; Confidential</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>
      )}

      {/* Progress Bar */}
      {!isSubmitted && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTextRow}>
            <Text style={styles.progressStepText}>Step {currentStep} of {totalSteps}</Text>
            <Text style={styles.progressPercentText}>{Math.round((currentStep / totalSteps) * 100)}% Completed</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(currentStep / totalSteps) * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Main Content */}
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
        {isSubmitted ? (
          <View style={styles.successContainer}>
            <View style={styles.successBadgeOuter}>
              <View style={styles.successBadgeInner}>
                <Ionicons name="checkmark-circle" size={64} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.successTitle}>Legal Notice Submitted{"\n"}Successfully</Text>
            <Text style={styles.successSubtitle}>
              Our legal experts will review your request and begin drafting your legal notice.
            </Text>

            <View style={styles.timeBadge}>
              <Ionicons name="time-outline" size={18} color={COLORS.primary} />
              <Text style={styles.timeBadgeText}>Estimated Review Time: 24–48 Hours</Text>
            </View>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => navigation.navigate('ClientMain')}
              activeOpacity={0.88}
            >
              <Text style={styles.ctaButtonText}>Return to Home</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* STEP 1 */}
            {currentStep === 1 && (
              <>
                <View style={styles.avatarWrap}>
                  <View style={styles.avatarGlow}>
                    <Ionicons name="sparkles" size={36} color="#FFFFFF" />
                    <View style={styles.onlineDot} />
                  </View>
                </View>

                <View style={styles.chatBubble}>
                  <View style={styles.gavelCircle}>
                    <Ionicons name="hammer-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.chatMessage}>
                    Hello 👋{"\n\n"}I'm your AI Legal Assistant.{"\n\n"}Please tell me what legal issue you're facing today.
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>Quick Actions</Text>

                <View style={styles.chipsWrap}>
                  {QUICK_CATEGORIES.map(cat => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => setSelectedCategory(isSelected ? null : cat)}
                        activeOpacity={0.8}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                        )}
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.multilineInput}
                    placeholder="Describe your legal issue in simple words..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    value={issueDescription}
                    onChangeText={setIssueDescription}
                  />
                </View>
              </>
            )}

            {/* STEP 2 */}
            {currentStep === 2 && (
              <>
                <View style={styles.chatBubble}>
                  <View style={styles.gavelCircle}>
                    <Ionicons name="hammer-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.chatMessage}>Who would you like to send the legal notice to?</Text>
                </View>

                <View style={styles.formContainer}>
                  <FormInput
                    label="Notice Recipient Full Name"
                    placeholder="e.g., Rajesh Kumar"
                    icon="person-outline"
                    value={recipientName}
                    onChangeText={setRecipientName}
                  />

                  <FormInput
                    label="Relationship (Optional)"
                    placeholder="e.g., Landlord, Ex-Employer, Borrower"
                    icon="people-outline"
                    value={recipientRelation}
                    onChangeText={setRecipientRelation}
                  />

                  <FormInput
                    label="Mobile Number (Optional)"
                    placeholder="e.g., +91 98765 43210"
                    icon="call-outline"
                    keyboardType="phone-pad"
                    value={recipientPhone}
                    onChangeText={setRecipientPhone}
                  />

                  <FormInput
                    label="Email Address (Optional)"
                    placeholder="e.g., recipient@example.com"
                    icon="mail-outline"
                    keyboardType="email-address"
                    value={recipientEmail}
                    onChangeText={setRecipientEmail}
                  />

                  <FormInput
                    label="Complete Address"
                    placeholder="House/Flat No., Building, Street, City, State, Pincode"
                    icon="location-outline"
                    multiline
                    value={recipientAddress}
                    onChangeText={setRecipientAddress}
                  />
                </View>
              </>
            )}

            {/* STEP 3 */}
            {currentStep === 3 && (
              <>
                <View style={styles.chatBubble}>
                  <View style={styles.gavelCircle}>
                    <Ionicons name="hammer-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.chatMessage}>Please provide your details.</Text>
                </View>

                <View style={styles.formContainer}>
                  <FormInput
                    label="Full Name"
                    placeholder="e.g., Ananya Sharma"
                    icon="person-outline"
                    value={senderName}
                    onChangeText={setSenderName}
                  />

                  <FormInput
                    label="Phone Number"
                    placeholder="e.g., +91 98765 43210"
                    icon="call-outline"
                    keyboardType="phone-pad"
                    value={senderPhone}
                    onChangeText={setSenderPhone}
                  />

                  <FormInput
                    label="Email Address"
                    placeholder="e.g., ananya.sharma@example.com"
                    icon="mail-outline"
                    keyboardType="email-address"
                    value={senderEmail}
                    onChangeText={setSenderEmail}
                  />

                  <FormInput
                    label="Complete Address"
                    placeholder="House/Flat No., Building, Street, City, State, Pincode"
                    icon="location-outline"
                    multiline
                    value={senderAddress}
                    onChangeText={setSenderAddress}
                  />
                </View>
              </>
            )}

            {/* STEP 4 */}
            {currentStep === 4 && (
              <>
                <View style={styles.chatBubble}>
                  <View style={styles.gavelCircle}>
                    <Ionicons name="hammer-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.chatMessage}>Upload Supporting Documents</Text>
                </View>

                <View style={styles.docList}>
                  {documents.map(doc => (
                    <TouchableOpacity
                      key={doc.id}
                      style={[styles.docCard, doc.uploaded && styles.docCardUploaded]}
                      onPress={() => handleRealUpload(doc.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.docIconCircle, doc.uploaded && styles.docIconCircleUploaded]}>
                        <Ionicons name={doc.icon} size={22} color={doc.uploaded ? '#FFFFFF' : COLORS.primary} />
                      </View>

                      <View style={styles.docTextWrap}>
                        <Text style={styles.docTitle}>{doc.title}</Text>
                        <Text style={[styles.docSub, doc.uploaded && styles.docSubUploaded]}>
                          {doc.uploaded
                            ? '✔ Uploaded'
                            : doc.uploading
                            ? 'Uploading...'
                            : doc.sub}
                        </Text>
                      </View>

                      {doc.uploading ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : doc.uploaded ? (
                        <View style={styles.uploadedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                          <Text style={styles.uploadedBadgeText}>Uploaded</Text>
                        </View>
                      ) : (
                        <View style={styles.uploadIconCircle}>
                          <Ionicons name="cloud-upload-outline" size={18} color={COLORS.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* STEP 5 */}
            {currentStep === 5 && (
              <>
                <View style={styles.chatBubble}>
                  <View style={styles.gavelCircle}>
                    <Ionicons name="hammer-outline" size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.chatMessage}>
                    Please review your legal notice details before final submission.
                  </Text>
                </View>

                <View style={styles.summaryCard}>
                  <SummaryRow
                    title="Client Information"
                    lines={[senderName || 'Not provided', senderPhone || 'Not provided', senderAddress || 'Not provided']}
                    onEdit={() => setCurrentStep(3)}
                  />

                  <View style={styles.divider} />

                  <SummaryRow
                    title="Recipient Information"
                    lines={[recipientName || 'Not provided', recipientRelation ? `Relation: ${recipientRelation}` : null, recipientAddress || 'Not provided'].filter(Boolean)}
                    onEdit={() => setCurrentStep(2)}
                  />

                  <View style={styles.divider} />

                  <SummaryRow
                    title="Notice Type & Issue"
                    lines={[selectedCategory || 'Not selected', issueDescription || 'Not provided']}
                    onEdit={() => setCurrentStep(1)}
                  />

                  <View style={styles.divider} />

                  <SummaryRow
                    title="Uploaded Documents"
                    badge={`${uploadedDocCount} Uploaded`}
                    lines={
                      uploadedDocCount > 0
                        ? documents.filter(d => d.uploaded).map(d => `📄 ${d.title}`)
                        : ['No documents attached']
                    }
                    onEdit={() => setCurrentStep(4)}
                  />
                </View>
              </>
            )}

            {/* Security Lock Note */}
            <View style={styles.securityNote}>
              <Ionicons name="lock-closed-outline" size={14} color={COLORS.primary} />
              <Text style={styles.securityText}>Your information is safe and confidential.</Text>
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomArea}>
              {currentStep === 5 && <TestModeBanner />}
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={currentStep === 5 ? handleSubmitReview : handleNextStep}
                disabled={isSubmitting}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.ctaButtonText}>
                    {currentStep === 5 ? 'Submit Legal Review' : 'Continue'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const FormInput = ({ label, placeholder, icon, multiline, keyboardType, value, onChangeText }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.fieldBox, multiline && { height: 90, alignItems: 'flex-start', paddingTop: 12 }]}>
      <Ionicons name={icon} size={20} color="#6B7280" style={{ marginRight: 10 }} />
      <TextInput
        style={[styles.fieldInput, multiline && { textAlignVertical: 'top' }]}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  </View>
);

const SummaryRow = ({ title, lines, badge, onEdit }) => (
  <View style={styles.summarySection}>
    <View style={styles.summaryHeader}>
      <Text style={styles.summaryTitle}>{title}</Text>
      {badge && (
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>{badge}</Text>
        </View>
      )}
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
        <Ionicons name="create-outline" size={14} color={COLORS.primary} />
        <Text style={styles.editText}>Edit</Text>
      </TouchableOpacity>
    </View>
    {lines.map((line, idx) => (
      <Text key={idx} style={styles.summaryLine}>{line}</Text>
    ))}
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  headerSubtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerSubtitle: { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  progressContainer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressStepText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  progressPercentText: { fontSize: 11, fontWeight: '500', color: '#6B7280' },
  progressTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },

  avatarWrap: { alignItems: 'center', marginVertical: 12 },
  avatarGlow: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  chatBubble: {
    backgroundColor: '#FAFAF8',
    borderRadius: 22,
    borderTopLeftRadius: 6,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  gavelCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F4EFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMessage: { flex: 1, fontSize: 14, color: '#1F2937', lineHeight: 20, fontWeight: '500' },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: '#1F2937', fontWeight: '500' },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '700' },

  inputWrap: { marginBottom: 20 },
  multilineInput: {
    backgroundColor: '#FAFAF8',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 16,
    fontSize: 14,
    color: '#1F2937',
    textAlignVertical: 'top',
  },

  formContainer: { gap: 14, marginBottom: 20 },
  fieldWrap: {},
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#1F2937', marginBottom: 6, marginLeft: 4 },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 16,
    height: 52,
  },
  fieldInput: { flex: 1, fontSize: 14, color: '#1F2937' },

  docList: { gap: 10, marginBottom: 20 },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 14,
  },
  docCardUploaded: { backgroundColor: '#F4EFEA', borderColor: COLORS.primary },
  docIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F4EFEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  docIconCircleUploaded: { backgroundColor: COLORS.primary },
  docTextWrap: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  docSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  docSubUploaded: { color: '#10B981', fontWeight: '600' },
  uploadedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  uploadedBadgeText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  uploadIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F4EFEA', alignItems: 'center', justifyContent: 'center' },

  summaryCard: {
    backgroundColor: '#FAFAF8',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 18,
    gap: 16,
    marginBottom: 20,
  },
  summarySection: {},
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  summaryBadge: { backgroundColor: 'rgba(176, 156, 133, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  summaryBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  summaryLine: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#E8E2D9' },

  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 },
  securityText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  bottomArea: { marginTop: 8 },
  ctaButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  successContainer: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  successBadgeOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F4EFEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 28,
  },
  successBadgeInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#1F2937', textAlign: 'center', lineHeight: 30, marginBottom: 12 },
  successSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4EFEA',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(176, 156, 133, 0.3)',
  },
  timeBadgeText: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
});
