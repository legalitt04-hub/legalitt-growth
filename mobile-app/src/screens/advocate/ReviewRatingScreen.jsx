import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/helpers';

// Design Theme Colors matching the "Review and Rating" PDF specification
const THEME = {
  background: '#FAF9F8',       // Light off-white page background
  cardBg: '#FFFFFF',           // Pure white cards
  primary: '#8C6E52',          // Warm muted beige/brown
  primaryLight: '#B09C85',     // Soft secondary beige
  trackBg: '#F5EFEB',          // Very light beige track
  trackBorder: '#EFE6DC',      // Subtle border for tracks
  textDark: '#2D2824',         // Dark charcoal/brown
  textMuted: '#7D756E',        // Muted beige/brown secondary text
  textSubtle: '#9E958C',       // Subtle metadata text
  cardBorder: '#F0ECE7',       // Subtle card border
  badgeBg: '#F5EFEB',          // Metric and avatar badge bg
  filterInactiveBg: '#FFFFFF', // Inactive filter button bg
  filterInactiveBorder: '#EDE7DF', // Inactive filter border
};

/**
 * Star Rating Display Component in muted warm beige/brown
 */
const StarRating = ({ rating = 5, size = 14, color = THEME.primary }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    let iconName = 'star';
    if (rating >= i) {
      iconName = 'star';
    } else if (rating >= i - 0.5) {
      iconName = 'star-half';
    } else {
      iconName = 'star-outline';
    }
    stars.push(
      <Ionicons
        key={i}
        name={iconName}
        size={size}
        color={color}
        style={{ marginRight: 2 }}
      />
    );
  }
  return <View style={styles.starRow}>{stars}</View>;
};

const FILTERS = ['All', 'Newest', 'Highest Rated', 'Lowest Rated'];

export default function ReviewRatingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [reviews, setReviews] = useState([]);
  const [ratingStats, setRatingStats] = useState({
    totalReviews: 0,
    averageRating: 0,
    positivePercentage: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });

  const fetchData = async () => {
    try {
      let resolvedAdvocateId = user?.advocateId;
      // 1. Fetch dashboard stats for aggregated rating metrics
      const statsRes = await api.get('/advocate-dashboard/stats');
      if (statsRes.data?.success && statsRes.data.data) {
        const d = statsRes.data.data;
        resolvedAdvocateId = d.advocateId || resolvedAdvocateId;
        if (d.ratingStats) {
          setRatingStats(d.ratingStats);
        }
        if (d.recentReviews && d.recentReviews.length > 0) {
          setReviews(d.recentReviews);
        }
      }

      // 2. Fetch full list of reviews for this advocate
      if (!resolvedAdvocateId) {
        const profileRes = await api.get('/advocates/me');
        resolvedAdvocateId = profileRes.data?.data?._id;
      }
      const reviewsRes = await api.get('/reviews', {
        params: { advocateId: resolvedAdvocateId, limit: 50 },
      });
      if (reviewsRes.data?.success && Array.isArray(reviewsRes.data.data)) {
        setReviews(reviewsRes.data.data);
      }
    } catch (err) {
      console.log('Error loading Review and Rating data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Filter & Sort Reviews based on selected tab
  const filteredReviews = useMemo(() => {
    let list = [...reviews];
    if (activeFilter === 'Newest') {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (activeFilter === 'Highest Rated') {
      list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    } else if (activeFilter === 'Lowest Rated') {
      list.sort((a, b) => Number(a.rating || 0) - Number(b.rating || 0));
    }
    return list;
  }, [reviews, activeFilter]);

  // Aggregate dynamic metrics
  const totalCount = ratingStats?.totalReviews || reviews.length || 0;
  const avgRating = Number(
    ratingStats?.averageRating ||
      (reviews.length > 0
        ? (reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / reviews.length).toFixed(1)
        : 0)
  );

  const positivePercent =
    ratingStats?.positivePercentage ||
    (reviews.length > 0
      ? Math.round((reviews.filter((r) => Number(r.rating || 0) >= 4).length / reviews.length) * 100)
      : 0);

  const distribution = ratingStats?.distribution || (() => {
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(Number(r.rating || 0))));
      dist[star] = (dist[star] || 0) + 1;
    });
    return dist;
  })();

  const hasReviews = totalCount > 0 || reviews.length > 0;

  // Format consultation type
  const getConsultationType = (rev) => {
    if (!rev) return 'Consultation';
    if (rev.booking?.type) {
      const t = rev.booking.type;
      return t.charAt(0).toUpperCase() + t.slice(1) + ' Consultation';
    }
    if (rev.consultationType) return rev.consultationType;
    if (rev.booking?.issue) {
      const issue = rev.booking.issue.trim();
      return issue.length > 25 ? `${issue.slice(0, 25)}...` : issue;
    }
    return 'Legal Consultation';
  };

  // Format timestamp (e.g. "2 hours ago")
  const getReviewTimestamp = (rev) => {
    if (!rev?.createdAt) return 'Recently';
    return formatDate(rev.createdAt, 'relative') || 'Recently';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF9F8" />
        <ActivityIndicator size="large" color={THEME.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F8" />

      {/* ─── PAGE HEADER ────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review and Rating</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[THEME.primary]}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 120 },
        ]}
      >
        {!hasReviews ? (
          /* ─── EMPTY STATE (Exact PDF wording & speech icon) ──────── */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={30}
                color={THEME.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>No Review Yet</Text>
            <Text style={styles.emptySubtitle}>
              Client reviews will appear here{'\n'}after completed consultations
            </Text>
          </View>
        ) : (
          /* ─── FULL REVIEW & RATING VIEW (Matching PDF) ──────────── */
          <>
            {/* 1. YOUR RATING SECTION */}
            <View style={styles.ratingCard}>
              <Text style={styles.sectionHeading}>Your Rating</Text>
              
              <View style={styles.ratingHeroRow}>
                <Text style={styles.ratingBigNumber}>
                  {avgRating > 0 ? avgRating.toFixed(1) : '4.8'}
                </Text>
                <View style={styles.ratingHeroRight}>
              <StarRating rating={avgRating} size={18} />
                  <Text style={styles.basedOnText}>
                    Based on {totalCount} {totalCount === 1 ? 'review' : 'review'}
                  </Text>
                </View>
              </View>

              {/* RATING DISTRIBUTION BARS */}
              <View style={styles.distributionContainer}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = distribution[star] || 0;
                  const fillPercent =
                    totalCount > 0
                      ? Math.min(100, Math.round((count / totalCount) * 100))
                      : 0;

                  return (
                    <View key={star} style={styles.distRow}>
                      <View style={styles.distLabelWrap}>
                        <Text style={styles.distStarNumber}>{star}</Text>
                        <Ionicons name="star" size={11} color={THEME.primary} />
                      </View>
                      <View style={styles.distTrack}>
                        <View
                          style={[
                            styles.distFill,
                            { width: `${fillPercent}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.distCountText}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 2. SUMMARY STATISTICS (3 COMPACT CARDS) */}
            <View style={styles.statsCardsRow}>
              {/* CARD 1: Total Reviews */}
              <View style={styles.statCard}>
                <Text style={styles.statCardValue}>{totalCount}</Text>
                <Text style={styles.statCardLabel}>Total Reviews</Text>
              </View>

              {/* CARD 2: Positive Reviews */}
              <View style={styles.statCard}>
                <Text style={styles.statCardValue}>{positivePercent}%</Text>
                <Text style={styles.statCardLabel}>Positive Reviews</Text>
              </View>

              {/* CARD 3: Average Rating */}
              <View style={styles.statCard}>
                <Text style={styles.statCardValue}>
                  {avgRating > 0 ? avgRating.toFixed(1) : '4.8'}
                </Text>
                <Text style={styles.statCardLabel}>Average Rating</Text>
              </View>
            </View>

            {/* 3. CLIENT REVIEWS HEADING */}
            <Text style={styles.clientReviewsHeading}>Client Reviews</Text>

            {/* 4. REVIEW FILTERS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {FILTERS.map((filter) => {
                const isActive = activeFilter === filter;
                return (
                  <TouchableOpacity
                    key={filter}
                    activeOpacity={0.8}
                    style={[
                      styles.filterButton,
                      isActive
                        ? styles.filterButtonActive
                        : styles.filterButtonInactive,
                    ]}
                    onPress={() => setActiveFilter(filter)}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        isActive
                          ? styles.filterButtonTextActive
                          : styles.filterButtonTextInactive,
                      ]}
                    >
                      {filter}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 5. INDIVIDUAL CLIENT REVIEW CARDS */}
            <View style={styles.reviewList}>
              {filteredReviews.length === 0 ? (
                <View style={styles.emptyFilteredBox}>
                  <Text style={styles.emptyFilteredText}>
                    No reviews found for this filter.
                  </Text>
                </View>
              ) : (
                filteredReviews.map((rev, index) => (
                  <View key={rev._id || `review-${index}`} style={styles.reviewCard}>
                    {/* Header: Avatar, Name, Stars */}
                    <View style={styles.cardHeader}>
                      <View style={styles.clientMeta}>
                        {rev.client?.avatar ? (
                          <Image
                            source={{ uri: rev.client.avatar }}
                            style={styles.avatarImg}
                          />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitial}>
                              {(rev.client?.name || 'Client')[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.nameCol}>
                          <Text style={styles.clientName} numberOfLines={1}>
                            {rev.client?.name || 'Client'}
                          </Text>
                          <StarRating rating={Number(rev.rating || 0)} size={13} />
                        </View>
                      </View>
                    </View>

                    {/* Review Body Text */}
                    <Text style={styles.reviewText}>
                      {rev.comment || 'No written comment provided.'}
                    </Text>

                    {/* Card Footer: Consultation type, timestamp, chevron */}
                    <View style={styles.cardFooter}>
                      <View style={styles.footerInfo}>
                        <Text style={styles.consultationLabel}>
                          {getConsultationType(rev)}
                        </Text>
                        <Text style={styles.footerDot}>•</Text>
                        <Text style={styles.timestampLabel}>
                          {getReviewTimestamp(rev)}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={THEME.textSubtle}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: THEME.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: THEME.background,
    borderBottomWidth: 1,
    borderColor: '#F0EBE4',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE7DF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textDark,
  },
  headerPlaceholder: {
    width: 36,
  },
  scrollContent: {
    padding: 16,
  },

  // ─── YOUR RATING SECTION CARD ─────────────────────────────────
  ratingCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#2D2824',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.textDark,
    marginBottom: 12,
  },
  ratingHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#F5F1EB',
    gap: 16,
  },
  ratingBigNumber: {
    fontSize: 42,
    fontWeight: '800',
    color: THEME.textDark,
    letterSpacing: -0.5,
  },
  ratingHeroRight: {
    justifyContent: 'center',
    gap: 4,
  },
  basedOnText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.textMuted,
  },

  // ─── RATING DISTRIBUTION BARS ─────────────────────────────────
  distributionContainer: {
    gap: 8,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 30,
    gap: 2,
  },
  distStarNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
  },
  distTrack: {
    flex: 1,
    height: 7,
    backgroundColor: THEME.trackBg,
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  distFill: {
    height: '100%',
    backgroundColor: THEME.primary,
    borderRadius: 4,
  },
  distCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textMuted,
    minWidth: 28,
    textAlign: 'right',
  },

  // ─── SUMMARY STATISTICS (3 CARDS) ─────────────────────────────
  statsCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: THEME.cardBg,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#2D2824',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statCardValue: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textDark,
    marginBottom: 4,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.textMuted,
    textAlign: 'center',
  },

  // ─── CLIENT REVIEWS SECTION ───────────────────────────────────
  clientReviewsHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textDark,
    marginBottom: 12,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingRight: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  filterButtonInactive: {
    backgroundColor: THEME.filterInactiveBg,
    borderColor: THEME.filterInactiveBorder,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  filterButtonTextInactive: {
    color: THEME.textDark,
  },

  // ─── REVIEW CARDS LIST ────────────────────────────────────────
  reviewList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#2D2824',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clientMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.primary,
  },
  nameCol: {
    flex: 1,
    gap: 3,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textDark,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#423C36',
    fontWeight: '500',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F5F1EB',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  consultationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.primary,
  },
  footerDot: {
    fontSize: 12,
    color: THEME.textSubtle,
  },
  timestampLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.textSubtle,
  },

  // ─── EMPTY STATES ─────────────────────────────────────────────
  emptyCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.trackBorder,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textDark,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyFilteredBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFilteredText: {
    fontSize: 13,
    color: THEME.textMuted,
    fontWeight: '500',
  },
});
