import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '../../utils/helpers';

// Design Theme Colors matching "Review and Rating" specification
const THEME = {
  primary: '#8C6E52',          // Muted warm beige / brown
  primaryLight: '#B09C85',     // Soft secondary beige
  trackBg: '#F5EFEB',          // Very light beige background track
  trackBorder: '#EFE6DC',      // Subtle track border
  textDark: '#2D2824',         // Dark charcoal / brown
  textMuted: '#7D756E',        // Muted beige / brown secondary text
  textSubtle: '#9E958C',       // Subtle metadata text
  cardBg: '#FFFFFF',           // Pure white
  innerCardBg: '#FAF8F5',      // Very subtle warm white
  innerCardBorder: '#EDE7DF',  // Subtle inner border
  badgeBg: '#F5EFEB',          // Stat chip background
};

/**
 * Renders 5 star rating icons dynamically in muted warm beige/brown
 */
const StarRating = ({ rating = 5, size = 13, color = THEME.primary }) => {
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

export default function RecentReviewsSection({
  reviews = [],
  ratingStats = null,
  advocateRating = null,
  onViewAll,
  onReviewPress,
}) {
  // Aggregate dynamic metrics from stats or review items
  const totalReviews = ratingStats?.totalReviews ?? (reviews.length || advocateRating?.count || 0);
  const averageRating = Number(
    ratingStats?.averageRating ?? advocateRating?.average ?? (reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / reviews.length).toFixed(1)
      : 0)
  );
  
  const positiveReviewsPercent = ratingStats?.positivePercentage ?? (reviews.length > 0
    ? Math.round((reviews.filter((r) => Number(r.rating || 0) >= 4).length / reviews.length) * 100)
    : 0);

  // Rating distribution counts (5, 4, 3, 2, 1)
  const distribution = ratingStats?.distribution || (() => {
    if (reviews.length > 0) {
      const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviews.forEach((r) => {
        const star = Math.min(5, Math.max(1, Math.round(Number(r.rating || 0))));
        dist[star] = (dist[star] || 0) + 1;
      });
      return dist;
    }
    return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  })();

  const hasReviews = totalReviews > 0 || (reviews && reviews.length > 0);
  const recentReview = reviews && reviews.length > 0 ? reviews[0] : null;

  // Format consultation type
  const getConsultationType = (rev) => {
    if (!rev) return 'Legal Consultation';
    if (rev.booking?.type) {
      const t = rev.booking.type;
      return t.charAt(0).toUpperCase() + t.slice(1) + ' Consultation';
    }
    if (rev.consultationType) return rev.consultationType;
    if (rev.booking?.issue) {
      const issue = rev.booking.issue.trim();
      return issue.length > 22 ? `${issue.slice(0, 22)}...` : issue;
    }
    return 'Consultation';
  };

  // Format timestamp (e.g. "2 hours ago")
  const getReviewTimestamp = (rev) => {
    if (!rev?.createdAt) return 'Recently';
    return formatDate(rev.createdAt, 'relative') || 'Recently';
  };

  return (
    <View style={styles.container}>
      {/* ─── SECTION HEADER ────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>RECENT CLIENT REVIEWS</Text>
        <TouchableOpacity
          onPress={onViewAll}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.viewAllText}>View All Reviews</Text>
        </TouchableOpacity>
      </View>

      {!hasReviews ? (
        /* ─── EMPTY STATE (Exact PDF wording & styled speech icon) ─── */
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={24}
              color={THEME.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>No Review Yet</Text>
          <Text style={styles.emptySubtitle}>
            Client reviews will appear here{'\n'}after completed consultations
          </Text>
        </View>
      ) : (
        /* ─── ACTIVE REVIEW CONTENT ─────────────────────────────────── */
        <View style={styles.contentWrap}>
          {/* 1. Rating Summary Header */}
          <View style={styles.summaryTopRow}>
            <View style={styles.ratingScoreBlock}>
              <Text style={styles.ratingLabel}>Your Rating</Text>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreNumber}>
                  {averageRating > 0 ? averageRating.toFixed(1) : '4.8'}
                </Text>
                <Ionicons
                  name="star"
                  size={18}
                  color={THEME.primary}
                  style={styles.scoreStar}
                />
              </View>
              <Text style={styles.basedOnText}>
                Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
              </Text>
            </View>

            {/* Metric Chips */}
            <View style={styles.metricsContainer}>
              <View style={styles.metricItem}>
                <Text style={styles.metricVal}>{totalReviews}</Text>
                <Text style={styles.metricLabel}>Total Reviews</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricVal}>{positiveReviewsPercent}%</Text>
                <Text style={styles.metricLabel}>Positive Reviews</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricVal}>
                  {averageRating > 0 ? averageRating.toFixed(1) : '4.8'}
                </Text>
                <Text style={styles.metricLabel}>Average Rating</Text>
              </View>
            </View>
          </View>

          {/* 2. Rating Distribution Horizontal Bars */}
          <View style={styles.distributionBox}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star] || 0;
              const maxCount = Math.max(...Object.values(distribution), 1);
              const fillPercent =
                totalReviews > 0
                  ? Math.min(100, Math.round((count / totalReviews) * 100))
                  : 0;

              return (
                <View key={star} style={styles.distRow}>
                  <View style={styles.distStarLabelWrap}>
                    <Text style={styles.distStarNum}>{star}</Text>
                    <Ionicons name="star" size={10} color={THEME.primary} />
                  </View>
                  <View style={styles.distTrack}>
                    <View
                      style={[
                        styles.distFill,
                        { width: `${fillPercent}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.distCount}>{count}</Text>
                </View>
              );
            })}
          </View>

          {/* 3. Recent Client Review Card */}
          {recentReview ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.reviewCard}
              onPress={() => onReviewPress && onReviewPress(recentReview)}
            >
              {/* Card Top: Avatar + Name + Stars */}
              <View style={styles.cardHeader}>
                <View style={styles.clientInfo}>
                  {recentReview.client?.avatar ? (
                    <Image
                      source={{ uri: recentReview.client.avatar }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitial}>
                        {(recentReview.client?.name || 'Client')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.nameWrap}>
                    <Text style={styles.clientName} numberOfLines={1}>
                      {recentReview.client?.name || 'Client'}
                    </Text>
                  </View>
                </View>
                <StarRating rating={Number(recentReview.rating || 0)} size={12} />
              </View>

              {/* Review Text */}
              <Text style={styles.reviewComment} numberOfLines={3}>
                {recentReview.comment || 'No written comment provided.'}
              </Text>

              {/* Card Footer: Consultation Type, Timestamp, Right Chevron */}
              <View style={styles.cardFooter}>
                <View style={styles.footerLeft}>
                  <Text style={styles.consultationTag}>
                    {getConsultationType(recentReview)}
                  </Text>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.timestampText}>
                    {getReviewTimestamp(recentReview)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={THEME.textSubtle}
                />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.cardBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0ECE7',
    shadowColor: '#2D2824',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textDark,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.primary,
  },
  contentWrap: {
    gap: 14,
  },

  // ─── Summary Header ──────────────────────────────────────────
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0EBE4',
  },
  ratingScoreBlock: {
    paddingRight: 10,
    borderRightWidth: 1,
    borderColor: '#EAE3D9',
  },
  ratingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textMuted,
    marginBottom: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.textDark,
  },
  scoreStar: {
    marginTop: -2,
  },
  basedOnText: {
    fontSize: 10,
    fontWeight: '500',
    color: THEME.textSubtle,
    marginTop: 2,
  },
  metricsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingLeft: 6,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textDark,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: THEME.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },

  // ─── Rating Distribution ──────────────────────────────────────
  distributionBox: {
    backgroundColor: '#FAF8F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F0EBE4',
    gap: 6,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distStarLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 26,
    gap: 2,
  },
  distStarNum: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
  },
  distTrack: {
    flex: 1,
    height: 6,
    backgroundColor: THEME.trackBg,
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  distFill: {
    height: '100%',
    backgroundColor: THEME.primary,
    borderRadius: 3,
  },
  distCount: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.textMuted,
    minWidth: 24,
    textAlign: 'right',
  },

  // ─── Recent Review Card ──────────────────────────────────────
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEBE4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.primary,
  },
  nameWrap: {
    flex: 1,
  },
  clientName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textDark,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewComment: {
    fontSize: 12,
    lineHeight: 18,
    color: '#443E38',
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderColor: '#F5F2ED',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  consultationTag: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.primary,
  },
  bulletDot: {
    fontSize: 11,
    color: THEME.textSubtle,
  },
  timestampText: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.textSubtle,
  },

  // ─── Empty State ──────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.trackBorder,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.textDark,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
});
