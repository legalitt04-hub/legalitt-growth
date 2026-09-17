import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import Button from '../common/Button';

const AdvocateCard = ({ advocate, onViewProfile, onBookNow }) => {
  const user = advocate.user || {};
  const specializations = (advocate.specializations || []).slice(0, 3).join(' • ');

  return (
    <View style={styles.card}>
      <View style={styles.avatarContainer}>
        {user.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{(user.name || 'A')[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={[styles.onlineDot, { backgroundColor: advocate.isOnline ? COLORS.online : COLORS.offline }]} />
        <View style={[styles.onlineBadge, { backgroundColor: advocate.isOnline ? '#dcfce7' : '#f3f4f6' }]}>
          <Text style={{ fontSize: 10, color: advocate.isOnline ? '#15803d' : COLORS.textMuted, fontWeight: '600' }}>
            {advocate.isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user.name || 'Advocate'}</Text>
          {advocate.isVerified && (
            <Ionicons name="checkmark-circle" size={16} color="#2563eb" style={{ marginLeft: 4 }} />
          )}
        </View>
        <Text style={styles.designation}>Senior Advocate</Text>
        <Text style={styles.specialization}>{specializations}</Text>

        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color={COLORS.star} />
          <Text style={styles.rating}>
            {advocate.rating?.count > 0 ? Number(advocate.rating.average || 0).toFixed(1) : 'No rating'}
          </Text>
          <Text style={styles.ratingCount}>
            ({advocate.rating?.count || 0} review)
          </Text>
        </View>

        <Text style={styles.fee}>
          <Text style={{ fontWeight: '700' }}>₹{advocate.consultationFee}/</Text>
          <Text style={{ color: COLORS.textSecondary }}> Consultation</Text>
        </Text>

        <View style={styles.actions}>
          <Button
            title="View Profile"
            variant="outline"
            size="sm"
            onPress={onViewProfile}
            fullWidth={false}
            style={{ flex: 1, marginRight: 8 }}
          />
          <Button
            title="Book Now"
            variant="primary"
            size="sm"
            onPress={onBookNow}
            fullWidth={false}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: SIZES.cardRadius, padding: SIZES.md,
    marginHorizontal: SIZES.screenPadding, marginBottom: SIZES.md,
    ...SHADOWS.md,
  },
  avatarContainer: { position: 'relative', marginRight: SIZES.md },
  avatar: { width: 90, height: 110, borderRadius: SIZES.radiusMd, backgroundColor: COLORS.backgroundGrey },
  avatarPlaceholder: {
    width: 90, height: 110, borderRadius: SIZES.radiusMd,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: COLORS.primary },
  onlineDot: { position: 'absolute', bottom: 28, left: 6, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  onlineBadge: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    borderRadius: 4, paddingVertical: 2, alignItems: 'center',
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: SIZES.subtitle, fontWeight: '700', color: COLORS.textPrimary },
  designation: { fontSize: SIZES.caption, color: COLORS.textSecondary, marginTop: 1 },
  specialization: { fontSize: SIZES.caption, color: COLORS.textSecondary, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rating: { fontSize: SIZES.caption, fontWeight: '700', color: COLORS.textPrimary, marginLeft: 3 },
  ratingCount: { fontSize: SIZES.caption, color: COLORS.textMuted, marginLeft: 2 },
  fee: { fontSize: SIZES.body, color: COLORS.textPrimary, marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: 10 },
});

export default AdvocateCard;
