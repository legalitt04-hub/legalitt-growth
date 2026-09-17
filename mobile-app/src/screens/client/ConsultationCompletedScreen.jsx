import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeScreen from '../../components/SafeScreen';
import { LEGAL_THEME } from '../../constants/legalAdviceTheme';
import { LogoHeader } from '../../components/legalAdvice/LogoHeader';
import { LawyerCard } from '../../components/legalAdvice/LawyerCard';
import { RecommendationCard } from '../../components/legalAdvice/RecommendationCard';
import { PrimaryButton } from '../../components/legalAdvice/PrimaryButton';
import { SecondaryButton } from '../../components/legalAdvice/SecondaryButton';
import { bookingAPI, reviewAPI } from '../../services/api';

export default function ConsultationCompletedScreen({ navigation, route }) {
  const initialBooking = route?.params?.bookingData || null;
  const bookingId = route?.params?.bookingId || initialBooking?._id || initialBooking?.id;
  const [bookingData, setBookingData] = useState(initialBooking);
  const [loadingBooking, setLoadingBooking] = useState(!!bookingId);

  useEffect(() => {
    if (!bookingId) {
      setLoadingBooking(false);
      return;
    }
    let mounted = true;
    bookingAPI.getBooking(bookingId)
      .then(({ data }) => {
        if (mounted && data?.success) setBookingData(data.data);
      })
      .catch((error) => {
        if (mounted) Alert.alert('Unable to Load', error?.response?.data?.message || 'Consultation details could not be loaded.');
      })
      .finally(() => mounted && setLoadingBooking(false));
    return () => { mounted = false; };
  }, [bookingId]);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedReview, setSubmittedReview] = useState(false);

  const handleSubmitReview = async () => {
    if (!rating) return Alert.alert('Rating Required', 'Please select a star rating.');
    setSubmitting(true);
    try {
      await reviewAPI.create({
        advocateId: bookingData.advocate?._id || bookingData.lawyer?._id || bookingData.lawyer?.id,
        bookingId: bookingData._id || bookingData.id,
        rating,
        comment,
      });
      setSubmittedReview(true);
      Alert.alert('Review Submitted', 'Thank you for rating your advocate!');
    } catch (err) {
      console.log('Review submission failed:', err?.message);
      Alert.alert('Review Not Submitted', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const deliveredDocuments = bookingData?.advocateDocuments || [];
  const keyPoints = [bookingData?.issueDescription || bookingData?.issue].filter(Boolean);
  const recommendations = deliveredDocuments.map((document, index) => document?.name || `Document ${index + 1}`);

  const handleDownload = async () => {
    const document = deliveredDocuments[0];
    const url = typeof document === 'string' ? document : document?.url;
    if (!url) {
      Alert.alert('No Document', 'The advocate has not uploaded consultation notes yet.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to Open', 'The consultation document link is unavailable.');
    }
  };

  const handleFollowUp = () => {
    navigation.navigate('LegalAdviceLanding');
  };

  const handleBackHome = () => {
    navigation.navigate('ClientMain', { screen: 'Home' });
  };

  if (loadingBooking || !bookingData) {
    return (
      <SafeScreen backgroundColor={LEGAL_THEME.colors.white} barStyle="dark-content">
        <LogoHeader title="Consultation Summary" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {loadingBooking ? <ActivityIndicator color={LEGAL_THEME.colors.primaryGold} /> : <Text>Consultation details are unavailable.</Text>}
        </View>
      </SafeScreen>
    );
  }

  const advocate = bookingData.advocate || bookingData.lawyer || {};
  const advocateUser = advocate.user || advocate;
  const matterTitle = bookingData.selectedMatter?.title || bookingData.issueCategory || bookingData.serviceType || 'Legal consultation';

  return (
    <SafeScreen backgroundColor={LEGAL_THEME.colors.white} barStyle="dark-content">
      <LogoHeader title="Consultation Summary" onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* TOP HERO */}
          <View style={styles.completedHeader}>
            <View style={styles.badgeCircle}>
              <Ionicons name="checkmark-circle" size={44} color={LEGAL_THEME.colors.primaryGold} />
            </View>
            <Text style={styles.completedTitle}>Consultation Completed</Text>
            <Text style={styles.completedSubtitle}>
              Your consultation for {String(matterTitle).replace(/_/g, ' ')} has concluded successfully.
            </Text>
          </View>

          {/* ADVOCATE CARD */}
          <Text style={styles.sectionTitle}>Consulted Advocate</Text>
          <LawyerCard
            name={advocateUser.name || 'Assigned Advocate'}
            title={advocate.title || 'Verified Advocate'}
            experience={advocate.experience ? `${advocate.experience} Years Exp.` : ''}
            rating={advocate.rating?.average || 0}
            reviewsCount={advocate.rating?.count || 0}
            avatarUri={advocateUser.avatar || null}
            compact
          />

          {/* KEY POINTS SUMMARY */}
          <RecommendationCard
            title="Matter Summary"
            items={keyPoints}
            iconName="list-outline"
          />

          {/* RECOMMENDATIONS */}
          <RecommendationCard
            title="Delivered Documents"
            items={recommendations}
            iconName="shield-checkmark-outline"
          />

          {/* RATE & REVIEW SECTION */}
          <View style={styles.reviewBoxContainer}>
            <Text style={styles.sectionTitle}>Rate Your Experience</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  activeOpacity={0.7}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= rating ? '#F59E0B' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {submittedReview ? (
              <View style={styles.submittedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.submittedText}>Thank you for your feedback!</Text>
              </View>
            ) : (
              <View style={styles.reviewInputWrapper}>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Write a brief review about your consultation..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  style={styles.reviewTextInput}
                />
                <TouchableOpacity
                  style={[styles.submitReviewBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmitReview}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitReviewText}>
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* DOWNLOAD NOTES CARD */}
          <View style={styles.downloadCard}>
            <View style={styles.downloadLeft}>
              <View style={styles.pdfIconCircle}>
                <Ionicons name="document-text" size={24} color={LEGAL_THEME.colors.primaryGold} />
              </View>
              <View style={styles.downloadInfo}>
                <Text style={styles.pdfNameText}>{recommendations[0] || 'Consultation document pending'}</Text>
                <Text style={styles.pdfMetaText}>{recommendations.length ? `Uploaded by ${advocateUser.name || 'advocate'}` : 'You will be notified after upload'}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
              <Ionicons name="download-outline" size={18} color={LEGAL_THEME.colors.white} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* BOTTOM ACTION BUTTONS */}
        <View style={styles.bottomFooter}>
          <PrimaryButton
            title="Book Follow-up Consultation"
            onPress={handleFollowUp}
          />
          <View style={styles.secondaryRow}>
            <SecondaryButton
              title="Download Notes PDF"
              onPress={handleDownload}
              style={styles.halfBtn}
            />
            <SecondaryButton
              title="Back Home"
              onPress={handleBackHome}
              style={styles.halfBtn}
            />
          </View>
        </View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LEGAL_THEME.colors.white,
  },
  scrollContent: {
    paddingHorizontal: LEGAL_THEME.spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 170,
  },
  completedHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badgeCircle: {
    marginBottom: 8,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: LEGAL_THEME.colors.primaryText,
    marginBottom: 4,
  },
  completedSubtitle: {
    fontSize: 13,
    color: LEGAL_THEME.colors.secondaryText,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: LEGAL_THEME.colors.primaryText,
    marginBottom: 10,
  },
  downloadCard: {
    ...LEGAL_THEME.cards.container,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#FFFCF8',
    borderColor: LEGAL_THEME.colors.primaryGold,
  },
  downloadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pdfIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: LEGAL_THEME.colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  downloadInfo: {
    flex: 1,
  },
  pdfNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: LEGAL_THEME.colors.primaryText,
  },
  pdfMetaText: {
    fontSize: 11,
    color: LEGAL_THEME.colors.secondaryText,
    marginTop: 2,
  },
  downloadBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: LEGAL_THEME.colors.primaryGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  bottomFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: LEGAL_THEME.colors.white,
    paddingHorizontal: LEGAL_THEME.spacing.screenPadding,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: LEGAL_THEME.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
    gap: 10,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  halfBtn: {
    flex: 1,
  },
});
