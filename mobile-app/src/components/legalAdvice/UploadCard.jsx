import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LEGAL_THEME } from '../../constants/legalAdviceTheme';

export const UploadCard = ({ files = [], onPickFile, onRemoveFile }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Attach Documents (Optional)</Text>
      <Text style={styles.sectionSubtitle}>Upload relevant legal files, court notices, or contracts</Text>

      {/* Upload Zone */}
      <TouchableOpacity
        style={styles.dashedBox}
        onPress={onPickFile}
        activeOpacity={0.8}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-upload-outline" size={24} color={LEGAL_THEME.colors.primaryGold} />
        </View>

        <Text style={styles.uploadTitle}>Tap to Upload Documents</Text>
        <Text style={styles.uploadSubtext}>Supports PDF, DOC, JPG, PNG (Max 10MB)</Text>

        <View style={styles.pillsRow}>
          <View style={styles.pill}><Text style={styles.pillText}>PDF</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>Images</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>Docs</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>Other</Text></View>
        </View>
      </TouchableOpacity>

      {/* File List */}
      {files.length > 0 && (
        <View style={styles.filesList}>
          {files.map((file, index) => (
            <View key={index} style={styles.fileItem}>
              <Ionicons name="document-text-outline" size={20} color={LEGAL_THEME.colors.primaryGold} />
              <View style={styles.fileDetails}>
                <Text style={styles.fileName} numberOfLines={1}>{file.name || `Document_${index + 1}.pdf`}</Text>
                <Text style={styles.fileSize}>
                  {typeof file.size === 'number'
                    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                    : (file.size || 'Size unavailable')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => onRemoveFile(index)}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: LEGAL_THEME.colors.primaryText,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: LEGAL_THEME.colors.secondaryText,
    marginBottom: 10,
  },
  dashedBox: {
    backgroundColor: LEGAL_THEME.colors.cream,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: LEGAL_THEME.colors.primaryGold,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LEGAL_THEME.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: LEGAL_THEME.colors.border,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LEGAL_THEME.colors.primaryText,
    marginBottom: 2,
  },
  uploadSubtext: {
    fontSize: 11,
    color: LEGAL_THEME.colors.secondaryText,
    marginBottom: 10,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    backgroundColor: LEGAL_THEME.colors.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LEGAL_THEME.colors.border,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
    color: LEGAL_THEME.colors.secondaryText,
  },
  filesList: {
    marginTop: 12,
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LEGAL_THEME.colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LEGAL_THEME.colors.border,
    padding: 10,
  },
  fileDetails: {
    flex: 1,
    marginLeft: 10,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    color: LEGAL_THEME.colors.primaryText,
  },
  fileSize: {
    fontSize: 11,
    color: LEGAL_THEME.colors.secondaryText,
  },
});
