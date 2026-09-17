// screens/client/AdvocateProfileScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Alert,
  Share,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/theme';
import { advocateAPI, chatAPI } from '../../services/api';
import profileAPI from '../../services/profileAPI';
import { useAuth } from '../../context/AuthContext';
import SkeletonLoader from '../../components/common/SkeletonLoader';

const AdvocateProfileScreen = ({ navigation, route }) => {
  const { isAuthenticated } = useAuth();
  const advocateId = route?.params?.id || route?.params?.advocateId;
  const prefetchedData = route?.params?.prefetchedData;
  const isSavedInitial = route?.params?.isSavedInitial ?? false;

  // ✅ ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('Overview');
  // Pre-fill with prefetched data for instant display — no loading flash with robust ID parsing
  const [advocate, setAdvocate] = useState(() => {
    if (!prefetchedData) return null;
    const rawTags = prefetchedData.tags || prefetchedData.specialization || prefetchedData.specializations || [];
    const tagsArr = Array.isArray(rawTags) ? rawTags : (typeof rawTags === 'string' ? rawTags.split('•').map(t => t.trim()) : [rawTags]).filter(Boolean);
    return {
      ...prefetchedData,
      id: prefetchedData.id || prefetchedData._id || prefetchedData.advocateId || advocateId,
      _id: prefetchedData._id || prefetchedData.id || prefetchedData.advocateId || advocateId,
      name: prefetchedData.name || prefetchedData.user?.name || "Advocate",
      tags: tagsArr.length > 0 ? tagsArr : ['Legal Services'],
      fee: prefetchedData.fee || prefetchedData.consultationFee || 500,
    };
  });
  const [loading, setLoading] = useState(!prefetchedData); // skip loading if we have data
  const [isSaved, setIsSaved] = useState(isSavedInitial);
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    const fetchAdvocate = async () => {
      try {
        // Only show loading spinner if we have NO prefetched data
        if (!prefetchedData) setLoading(true);

        const response = await advocateAPI.getAdvocate(advocateId);
        if (response.data.success) {
          const adv = response.data.data;
          setAdvocate({
            id: adv._id,
            userId: adv.user?._id,
            name: adv.user?.name || "Unknown",
            avatar: adv.user?.avatar || null,
            title: "Advocate",
            tags: adv.specializations?.slice(0, 3) || [],
            rating: adv.rating?.average || 0,
            reviews: adv.rating?.count || 0,
            fee: adv.consultationFee || 0,
            callRate: Math.round((adv.consultationFee || 0) * 0.3),
            experience: adv.experience || 0,
            city: adv.location?.address?.city || "Unknown",
            online: adv.user?.isActive || false,
            verified: adv.isVerified || false,
            available: true,
            documents: adv.documents || {},
          });
        }
        // Only check saved status if NOT pre-filled from params
        if (!isSavedInitial) {
          const savedRes = await profileAPI.getSavedAdvocates();
          if (savedRes?.data?.success) {
            const savedIds = (savedRes.data.data || []).map(a => typeof a === 'object' ? a._id : a);
            setIsSaved(savedIds.includes(advocateId));
          }
        }
      } catch (error) {
        console.error("❌ Error fetching advocate:", error);
      } finally {
        setLoading(false);
      }
    };
    if (advocateId) fetchAdvocate();
  }, [advocateId]);

  useEffect(() => {
    const checkActiveChat = async (targetUserId) => {
      if (!targetUserId) return;
      try {
        const chatRes = await chatAPI.getMyChats();
        if (chatRes.data.success) {
          const chats = chatRes.data.data;
          const matchedChat = chats.find(c =>
            c.participants.some(p => {
              const pIdStr = p._id?.toString() || p.toString();
              return pIdStr === targetUserId.toString();
            })
          );
          if (matchedChat) {
            setActiveChat(matchedChat);
          }
        }
      } catch (err) {
        console.log('Error checking active chats:', err);
      }
    };

    const targetUserId = advocate?.userId || advocate?.user?._id || advocate?.user;
    if (targetUserId) {
      checkActiveChat(targetUserId);
    }

    // Set up focus listener to re-verify chat status upon return from Booking
    const unsubscribe = navigation?.addListener?.('focus', () => {
      const targetUserIdFocus = advocate?.userId || advocate?.user?._id || advocate?.user;
      if (targetUserIdFocus) {
        checkActiveChat(targetUserIdFocus);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      else if (unsubscribe?.remove) unsubscribe.remove();
    };
  }, [advocate, navigation]);

  const toggleSave = async () => {
    try {
      const response = await profileAPI.toggleSavedAdvocate(advocateId);
      if (response?.data?.success) setIsSaved(response.data.isSaved);
    } catch (error) {
      console.error("Error toggling save", error);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top + 50, paddingHorizontal: 16 }}>
        <SkeletonLoader type="clientRow" count={4} />
      </View>
    );
  }

  if (!advocate) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: "#6B7280" }}>Advocate not found</Text>
      </View>
    );
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out Advocate ${advocate.name} on Legalitt. Specializations: ${(advocate.tags || advocate.specializations || []).join(', ')}. Consultation Fee: ₹${advocate.fee}.`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const tabs = ['Overview', 'Experience', 'Reviews'];

  return (
    <View style={styles.container}>
      {/* Header - floats over content */}
      <LinearGradient
        colors={['#B09C85', '#8D7865']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Advocate Profile</Text>

        <TouchableOpacity style={[styles.headerSaveBtn, isSaved && styles.headerSaveBtnActive]} onPress={toggleSave}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={isSaved ? '#B09C85' : '#FFFFFF'}
          />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {(advocate.avatar || route?.params?.advocateAvatar) ? (
              <Image
                source={{ uri: advocate.avatar || route?.params?.advocateAvatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{advocate.name?.[0]?.toUpperCase() || 'A'}</Text>
              </View>
            )}
            {advocate.online && (
              <View style={styles.onlineBadge}>
                <Text style={styles.onlineBadgeText}>● Online</Text>
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{advocate.name}</Text>
              {advocate.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={9} color="#FFFFFF" />
                </View>
              )}
            </View>

            <Text style={styles.title}>{advocate.title}</Text>
            <Text style={styles.tags}>{(advocate.tags || advocate.specializations || ['Legal Services']).join(' · ')}</Text>

            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#FCD34D" />
              <Text style={styles.ratingText}>{advocate.rating}</Text>
              <Text style={styles.reviewsText}>({advocate.reviews} reviews)</Text>
            </View>

            <Text style={styles.feeText}>
              <Text style={styles.feeBold}>₹{advocate.fee}/</Text> Consultation
            </Text>

            {advocate.available && (
              <View style={styles.availableBadge}>
                <View style={styles.availableDot} />
                <Text style={styles.availableText}>Available</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'Overview' && <OverviewTab advocate={advocate} navigation={navigation} />}
          {activeTab === 'Experience' && <ExperienceTab advocate={advocate} />}
          {activeTab === 'Reviews' && <ReviewsTab advocate={advocate} advocateId={advocateId} />}
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer: Book or Message */}
      {!activeChat && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.shareIconButton}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={24} color="#B09C85" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => {
              navigation.navigate('Booking', { 
                advocateId: advocate.id || advocate._id || advocateId,
                advocateName: advocate.name || route?.params?.advocateName || "Advocate",
                fee: advocate.fee || route?.params?.fee || 0,
                advocateAvatar: advocate.avatar || route?.params?.advocateAvatar
              });
            }}
          >
            <Text style={styles.bookButtonText}>Book Consultation</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// Overview Tab Component
const OverviewTab = ({ advocate, navigation }) => {
  const [loadingChat, setLoadingChat] = useState(false);

  const handleMessagePress = async () => {
    if (loadingChat) return;
    try {
      setLoadingChat(true);
      const response = await chatAPI.getMyChats();
      if (response.data.success) {
        const chats = response.data.data;
        const targetUserId = advocate.userId || advocate.user?._id || advocate.user;
        // Find if there is an active chat with this advocate
        const activeChat = chats.find(c =>
          c.participants.some(p => {
            const pIdStr = p._id?.toString() || p.toString();
            return pIdStr && targetUserId && pIdStr === targetUserId.toString();
          })
        );

        if (activeChat) {
          navigation.navigate('Chat', {
            chatId: activeChat._id,
            advocateName: advocate.name,
            advocateAvatar: advocate.avatar,
            advocateId: advocate.id
          });
        } else {
          Alert.alert(
            'Consultation Required',
            'Please book a consultation with this advocate to unlock secure direct messaging.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Book Now', onPress: () => navigation.navigate('Booking', { 
                  advocateId: advocate.id, 
                  advocateName: advocate.name, 
                  fee: advocate.fee,
                  advocateAvatar: advocate.avatar
                }) 
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error initiating chat:', error);
      Alert.alert('Error', 'Unable to initiate chat. Please try again.');
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <View style={styles.overviewContainer}>
      <Text style={styles.description}>
        {advocate.name} is a Senior Advocate with over {advocate.experience} years of
        experience in Criminal, Civil, and Property law. Known for a strategic legal
        approach, thorough case preparation, and client-focused guidance.
      </Text>

      <View style={styles.experienceSection}>
        <Text style={styles.sectionTitle}>
          {advocate.experience} Years Of Experience
        </Text>

        <View style={styles.callCard}>
          <View style={styles.callCardRow}>
            <Text style={styles.callCardLabel}>Call Charges:</Text>
            <Text style={styles.callCardValue}>₹{advocate.callRate}/min</Text>
          </View>

          <Text style={styles.callCardCity}>● {advocate.city}</Text>
          <Text style={styles.callCardInfo}>
            {advocate.name} is available to take your call. Just click.
          </Text>

          <TouchableOpacity 
            style={styles.messageButton} 
            onPress={handleMessagePress}
            disabled={loadingChat}
          >
            {loadingChat ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.primary} />
                <Text style={styles.messageButtonText}>Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Verification & Credentials Gallery */}
      {advocate.documents && Object.keys(advocate.documents).length > 0 && (
        <View style={styles.gallerySection}>
          <Text style={styles.sectionTitle}>Verification & Credentials</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryScroll}>
            {Object.entries(advocate.documents).map(([key, url]) => {
              if (!url) return null;
              const formattedName = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.galleryCard}
                  activeOpacity={0.8}
                  onPress={() => Alert.alert(formattedName, 'This credential has been verified by the Bar Council & Legalitt.')}
                >
                  <Image source={{ uri: url }} style={styles.galleryImage} />
                  <Text style={styles.galleryName} numberOfLines={1}>{formattedName}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

// Experience Tab — shows generic professional background based on advocate data
const ExperienceTab = ({ advocate }) => (
  <View style={styles.experienceContainer}>
    <Section
      title="Professional Background"
      items={[
        advocate?.experience !== undefined ? `${advocate.experience} Years of Legal Practice` : null,
        advocate?.barCouncilNumber ? `Bar Council: ${advocate.barCouncilNumber}` : null,
        advocate?.about || null,
      ].filter(Boolean)}
    />
    <Section
      title="Core Practice Areas"
      items={(advocate?.specializations || []).map(s => s)}
    />
    <Section
      title="Professional Approach"
      items={[
        'Strategic Case Preparation',
        'Client-Focused Legal Guidance',
        'Confidential & Ethical Practice',
        'Transparent Consultation Process',
      ]}
    />
  </View>
);

const Section = ({ title, items }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionItems}>
      {items.map((item, index) => (
        <Text key={index} style={styles.sectionItem}>
          • {item}
        </Text>
      ))}
    </View>
  </View>
);

// Reviews Tab Component
// Reviews Tab Component
const ReviewsTab = ({ advocate, advocateId }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedBookings, setCompletedBookings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);

  const fetchReviews = async () => {
    try {
      const { reviewAPI } = await import('../../services/api');
      const response = await reviewAPI.getAdvocateReviews(advocateId);
      if (response.data.success) {
        setReviews(response.data.data || []);
      }
    } catch (error) {
      console.log('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkEligibleBookings = async () => {
    try {
      const { bookingAPI } = await import('../../services/api');
      // Fetch user's completed bookings for this advocate
      const response = await bookingAPI.getMy({ advocateId, status: 'completed' });
      if (response.data.success) {
        const bookings = response.data.data || [];
        // Filter out bookings that already have a review
        const reviewedBookingIds = new Set(reviews.map(r => r.booking?.toString() || r.booking?._id?.toString()));
        const unreviewed = bookings.filter(b => !reviewedBookingIds.has(b._id.toString()));
        setCompletedBookings(unreviewed);
        if (unreviewed.length > 0) {
          setSelectedBookingId(unreviewed[0]._id);
        }
      }
    } catch (error) {
      console.log('Error checking eligible bookings:', error);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [advocateId]);

  useEffect(() => {
    if (reviews.length >= 0) {
      checkEligibleBookings();
    }
  }, [reviews]);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      navigation.navigate('LoginRegister', { role: 'client' });
      return;
    }
    const bId = selectedBookingId;
    if (!bId) {
      Alert.alert('No Booking', 'Please complete a consultation with this advocate before leaving a review.');
      return;
    }
    setSubmitting(true);
    try {
      const { reviewAPI } = await import('../../services/api');
      const response = await reviewAPI.create({
        bookingId: bId,
        advocateId,
        rating,
        comment,
      });
      if (response.data.success) {
        Alert.alert('Success', 'Thank you for your feedback!');
        setShowForm(false);
        setComment('');
        setRating(5);
        fetchReviews();
      }
    } catch (error) {
      console.log('Error submitting review:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate review average stats based on real reviews fetched
  const count = reviews.length;
  const average = count > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / count).toFixed(1) : 0;
  const ratingDistribution = [5, 4, 3, 2, 1].map(stars => {
    const starCount = reviews.filter(r => r.rating === stars).length;
    const percent = count > 0 ? Math.round((starCount / count) * 100) : 0;
    return { stars, percent };
  });

  return (
    <View style={styles.reviewsContainer}>
      {/* Rating Summary */}
      <View style={styles.ratingSummary}>
        <View style={styles.ratingLeft}>
          <Text style={styles.ratingBig}>{average}</Text>
          <Text style={styles.ratingSubtext}>Based on {count} reviews</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Ionicons key={i} name="star" size={12} color={i <= Math.round(average) ? '#F59E0B' : '#E5E7EB'} />
            ))}
          </View>
        </View>

        <View style={styles.ratingBars}>
          {ratingDistribution.map((item) => (
            <View key={item.stars} style={styles.ratingBarRow}>
              <Text style={styles.ratingBarLabel}>{item.stars}</Text>
              <View style={styles.ratingBarTrack}>
                <View
                  style={[styles.ratingBarFill, { width: `${item.percent}%` }]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Review Submission Section */}
      {!showForm && (
        <TouchableOpacity
          style={styles.addReviewBtn}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="create-outline" size={16} color="#FFFFFF" />
          <Text style={styles.addReviewBtnText}>Write a Review</Text>
        </TouchableOpacity>
      )}

      {showForm && (
        <View style={styles.reviewForm}>
          <Text style={styles.formTitle}>Rate your consultation</Text>
          <View style={styles.formStarsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color="#F59E0B"
                />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.formInput}
            placeholder="Share your experience (optional)..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
          />
          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelFormBtn}
              onPress={() => setShowForm(false)}
              disabled={submitting}
            >
              <Text style={styles.cancelFormBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitFormBtn}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitFormBtnText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reviews List */}
      <View style={styles.reviewsList}>
        <Text style={styles.reviewsListTitle}>All Reviews</Text>
        
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 12 }} />
        ) : reviews.length === 0 ? (
          <Text style={styles.noReviewsText}>No reviews yet. Be the first to leave one!</Text>
        ) : (
          reviews.map((item) => (
            <View key={item._id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                {item.client?.avatar ? (
                  <Image source={{ uri: item.client.avatar }} style={styles.reviewAvatar} />
                ) : (
                  <View style={[styles.reviewAvatar, styles.avatarPlaceholder]}>
                    <Text style={styles.reviewAvatarInitial}>
                      {(item.client?.name || 'A')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.reviewHeaderMeta}>
                  <Text style={styles.reviewName}>{item.client?.name || 'Anonymous User'}</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Ionicons key={i} name="star" size={10} color={i <= item.rating ? '#F59E0B' : '#E5E7EB'} />
                    ))}
                  </View>
                </View>
              </View>
              {item.comment && <Text style={styles.reviewText}>{item.comment}</Text>}
              <Text style={styles.reviewDate}>
                {new Date(item.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  headerSaveBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveBtnActive: {
    backgroundColor: '#CCFBF1',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerShareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  avatarPlaceholder: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  onlineBadge: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    transform: [{ translateX: -28 }],
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  onlineBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#B09C85',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  tags: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  reviewsText: {
    fontSize: 12,
    color: '#6B7280',
  },
  feeText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  feeBold: {
    fontWeight: '600',
    color: '#1F2937',
  },
  availableBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  availableText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#10B981',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingBottom: 8,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#B09C85',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#B09C85',
    fontWeight: '700',
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  overviewContainer: {
    gap: 16,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
  experienceSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  callCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  callCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  callCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  callCardValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  callCardCity: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  callCardInfo: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 12,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  experienceContainer: {
    gap: 12,
  },
  section: {
    marginBottom: 12,
  },
  sectionItems: {
    gap: 4,
  },
  sectionItem: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  reviewsContainer: {
    gap: 16,
  },
  ratingSummary: {
    flexDirection: 'row',
    gap: 16,
  },
  ratingLeft: {
    alignItems: 'flex-start',
  },
  ratingBig: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1F2937',
  },
  ratingSubtext: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingBars: {
    flex: 1,
    gap: 4,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBarLabel: {
    fontSize: 10,
    color: '#6B7280',
    width: 8,
  },
  ratingBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  reviewsList: {
    gap: 8,
  },
  reviewsListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  reviewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewAvatarInitial: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  reviewName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  reviewText: {
    fontSize: 12,
    color: '#1F2937',
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 10,
    color: '#6B7280',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  shareIconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#B09C85',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF2E8',
  },
  bookButton: {
    flex: 1,
    backgroundColor: '#B09C85',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B09C85',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Gallery Styles
  gallerySection: {
    marginTop: 8,
    gap: 8,
  },
  galleryScroll: {
    gap: 12,
    paddingRight: 20,
  },
  galleryCard: {
    width: 120,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    paddingBottom: 8,
  },
  galleryImage: {
    width: '100%',
    height: 80,
    backgroundColor: '#E5E7EB',
  },
  galleryName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
    marginTop: 6,
    paddingHorizontal: 6,
    textAlign: 'center',
  },
  // Add Review Button
  addReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  addReviewBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  // Review Form Styles
  reviewForm: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
    marginTop: 8,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  formStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 12,
    fontSize: 13,
    color: '#374151',
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelFormBtnText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 13,
  },
  submitFormBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitFormBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  // Other Review styles
  noReviewsText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  reviewHeaderMeta: {
    flex: 1,
    gap: 2,
  },
});

export default AdvocateProfileScreen;
