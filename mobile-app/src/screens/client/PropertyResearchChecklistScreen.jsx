// screens/client/PropertyResearchChecklistScreen.jsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS } from '../../constants/theme';

const PRIMARY_BEIGE = '#C2A98B';

const CHECKLIST_ITEMS = [
  'Ownership Verification',
  'Title Verification',
  'Registry Verification',
  'Encumbrance Certificate Check',
  'Mortgage Verification',
  'Court Litigation Search',
  'Property Tax Verification',
  'Government Land Record Verification',
  'Land Use Verification',
  'Zoning Verification',
  'Easement Verification',
  'Legal Risk Assessment',
  'Final Report Preparation',
];

export default function PropertyResearchChecklistScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const handleContactExpert = () => navigation.navigate('Support');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Navigation Header */}
      <View style={[styles.navHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>What We Are Checking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Graphic Box */}
        <View style={styles.illustrationContainer}>
          <View style={styles.illustrationBackground}>
            <View style={styles.iconBoxMain}>
              <Ionicons name="shield-checkmark" size={42} color={PRIMARY_BEIGE} />
            </View>

            <View style={styles.iconBoxSubTopLeft}>
              <Ionicons name="home" size={24} color="#475569" />
            </View>

            <View style={styles.iconBoxSubTopRight}>
              <Ionicons name="document-text" size={24} color="#0D9488" />
            </View>

            <View style={styles.iconBoxSubBottomLeft}>
              <Ionicons name="search" size={22} color="#F59E0B" />
            </View>

            <View style={styles.iconBoxSubBottomRight}>
              <Ionicons name="ribbon" size={24} color={PRIMARY_BEIGE} />
            </View>
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Comprehensive Property Due Diligence</Text>
          <Text style={styles.subtitle}>
            Our experienced property advocates leave no stone unturned. Every report covers 13 deep verification layers.
          </Text>
        </View>

        {/* Professional Property Due Diligence Badge */}
        <View style={styles.badgeContainer}>
          <Ionicons name="ribbon" size={16} color={PRIMARY_BEIGE} />
          <Text style={styles.badgeText}>Professional Property Due Diligence</Text>
        </View>

        {/* Checklist Card */}
        <View style={styles.checklistCard}>
          <Text style={styles.checklistTitle}>13-Point Legal Inspection List</Text>
          <View style={styles.divider} />

          {CHECKLIST_ITEMS.map((item, index) => (
            <View key={item} style={styles.checkRow}>
              <View style={styles.checkIconBg}>
                <Ionicons name="checkmark-sharp" size={14} color="#FFFFFF" />
              </View>
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={22} color={PRIMARY_BEIGE} />
          <Text style={styles.infoText}>
            Verification generally takes 3–5 working days depending on government authority response and property records availability.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Contact Expert Button */}
      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={styles.expertButton}
          onPress={handleContactExpert}
          activeOpacity={0.85}
        >
          <Ionicons name="person" size={18} color="#FFFFFF" />
          <Text style={styles.expertButtonText}>Contact Legalitt Expert</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  illustrationBackground: {
    width: 220,
    height: 170,
    borderRadius: 24,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EFEAE2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...SHADOWS.small,
  },
  iconBoxMain: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: PRIMARY_BEIGE,
    ...SHADOWS.medium,
  },
  iconBoxSubTopLeft: {
    position: 'absolute',
    top: 16,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  iconBoxSubTopRight: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  iconBoxSubBottomLeft: {
    position: 'absolute',
    bottom: 16,
    left: 22,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  iconBoxSubBottomRight: {
    position: 'absolute',
    bottom: 16,
    right: 22,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_BEIGE,
  },
  checklistCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEAE2',
    ...SHADOWS.medium,
  },
  checklistTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 7,
  },
  checkIconBg: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FAF8F5',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EFEAE2',
  },
  infoText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    flex: 1,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingTop: 12,
    ...SHADOWS.large,
  },
  expertButton: {
    backgroundColor: PRIMARY_BEIGE,
    height: 54,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.medium,
  },
  expertButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
