import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LEGAL_THEME } from '../../constants/legalAdviceTheme';

export const LawyerCard = ({
  name = "Assigned Advocate",
  title = "Verified Advocate",
  experience = "",
  rating = 0,
  reviewsCount = 0,
  avatarUri = null,
  onContact,
  compact = false,
}) => {
  return (
    <View style={styles.cardContainer}>
      <View style={styles.headerRow}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{String(name || 'A').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>{name}</Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-sharp" size={10} color={LEGAL_THEME.colors.white} />
            </View>
          </View>

          <Text style={styles.titleText} numberOfLines={1}>{title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>{rating}</Text>
              <Text style={styles.reviewsText}>({reviewsCount})</Text>
            </View>
            <Text style={styles.dotSeparator}>•</Text>
            <Text style={styles.expText}>{experience}</Text>
          </View>
        </View>
      </View>

      {!compact && onContact && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={onContact}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={LEGAL_THEME.colors.primaryGold} />
            <Text style={styles.actionText}>Message Advocate</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    ...LEGAL_THEME.cards.container,
    padding: 14,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: LEGAL_THEME.colors.cream,
    marginRight: 12,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: LEGAL_THEME.colors.primaryGold,
    fontSize: 22,
    fontWeight: '700',
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '700',
    color: LEGAL_THEME.colors.primaryText,
  },
  verifiedBadge: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: LEGAL_THEME.colors.primaryGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 12,
    color: LEGAL_THEME.colors.secondaryText,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: LEGAL_THEME.colors.primaryText,
  },
  reviewsText: {
    fontSize: 11,
    color: LEGAL_THEME.colors.secondaryText,
  },
  dotSeparator: {
    color: LEGAL_THEME.colors.secondaryText,
    fontSize: 12,
  },
  expText: {
    fontSize: 11,
    fontWeight: '600',
    color: LEGAL_THEME.colors.darkGold,
  },
  actionsRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LEGAL_THEME.colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: LEGAL_THEME.colors.cream,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: LEGAL_THEME.colors.primaryGold,
  },
});
