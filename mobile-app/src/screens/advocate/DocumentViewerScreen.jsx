import React, { useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Share,
  Alert,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Theme Colors matching "Documents Viewer.pdf"
const THEME = {
  background: '#FAF9F8',       // Light cream / off-white page bg
  cardBg: '#FFFFFF',           // Pure white
  primary: '#8C6E52',          // Muted warm beige / brown
  primaryLight: '#B09C85',     // Soft secondary beige
  viewerBg: '#FAF8F5',         // Very light cream document viewer bg
  viewerBorder: '#EDE7DF',     // Subtle viewer border
  cardBorder: '#F0ECE7',       // Card border
  badgeBg: '#F5EFEB',          // Icon circle / tool button bg
  textDark: '#2D2824',         // Dark charcoal / brown
  textMuted: '#7D756E',        // Muted secondary text
  textSubtle: '#9E958C',       // Subtle metadata text
  disabledIcon: '#D1C7BD',     // Disabled navigation arrow
};

export default function DocumentViewerScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  // Extract actual data passed from route navigation
  const clientName = route?.params?.clientName || 'Client';
  const caseTitle = route?.params?.caseTitle || 'Legal Matter';
  const documentUrl = route?.params?.documentUrl || null;
  const documents = route?.params?.documents || (documentUrl ? [documentUrl] : []);
  const hasDocument = route?.params?.hasDocument !== undefined 
    ? route.params.hasDocument 
    : (documents.length > 0 || !!documentUrl);

  const fileName = route?.params?.fileName || (
    documents.length > 0 
      ? (typeof documents[0] === 'object' && documents[0]?.name ? documents[0].name : (documentUrl ? documentUrl.split('/').pop() : `${clientName.replace(/\s+/g, '_')}_Document.pdf`))
      : 'Document.pdf'
  );

  // Viewer UI States: 'success' | 'error' | 'empty'
  const [viewerState, setViewerState] = useState(hasDocument ? 'success' : 'empty');
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, documents.length > 0 ? documents.length : 1);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [moreModalVisible, setMoreModalVisible] = useState(false);
  const activeDocument = documents[currentPage - 1] || documentUrl;
  const activeDocumentUrl = typeof activeDocument === 'object' ? (activeDocument?.url || activeDocument?.uri || activeDocument?.fileUrl) : activeDocument;
  const activeFileName = typeof activeDocument === 'object' && activeDocument?.name ? activeDocument.name : fileName;

  // ─── TOOLBAR ACTION HANDLERS ───────────────────────────────────────────────

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(2.0, Number((prev + 0.25).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.75, Number((prev - 0.25).toFixed(2))));
  };

  const handleFitToScreen = () => {
    setZoomLevel(1.0);
  };

  const downloadToCache = async () => {
    if (!activeDocumentUrl) throw new Error('No document URL is available.');
    const safeName = String(activeFileName || `document_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const result = await FileSystem.downloadAsync(activeDocumentUrl, `${FileSystem.cacheDirectory}${Date.now()}_${safeName}`);
    if (result.status < 200 || result.status >= 300) throw new Error(`Download failed with status ${result.status}`);
    return result.uri;
  };

  const handleDownload = async () => {
    if (!hasDocument || !activeDocumentUrl) {
      Alert.alert('No Document', 'No document file is available to download.');
      return;
    }
    try {
      if (Platform.OS === 'web') return Linking.openURL(activeDocumentUrl);
      const localUri = await downloadToCache();
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(localUri, { dialogTitle: `Save ${activeFileName}` });
      else Alert.alert('Downloaded', `${activeFileName} was downloaded to the app cache.`);
    } catch (error) {
      Alert.alert('Download Failed', error?.message || 'Could not download this document.');
    }
  };

  const handleShare = async () => {
    if (!hasDocument || !activeDocumentUrl) {
      Alert.alert('No Document', 'No document file is available to share.');
      return;
    }
    try {
      if (Platform.OS === 'web') await Share.share({ title: activeFileName, message: activeDocumentUrl });
      else {
        const localUri = await downloadToCache();
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(localUri, { dialogTitle: `Share ${activeFileName}` });
        else await Share.share({ title: activeFileName, message: activeDocumentUrl });
      }
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleTryAgain = () => {
    setViewerState(hasDocument ? 'success' : 'empty');
  };

  const handleBackToCase = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F8" />

      {/* ─── 1. PAGE HEADER ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerIconButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.textDark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Document Viewer</Text>

        <TouchableOpacity
          onPress={() => setMoreModalVisible(true)}
          style={styles.headerIconButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={THEME.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 30 },
        ]}
      >
        {/* ─── 2. DOCUMENT INFORMATION CARD ────────────────────────────────── */}
        <View style={styles.infoCard}>
          <View style={styles.infoLeftCol}>
            <Text style={styles.fileNameText} numberOfLines={1}>
              {activeFileName}
            </Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Client</Text>
              <Text style={styles.metaVal}>{clientName}</Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Case</Text>
              <Text style={styles.metaVal} numberOfLines={1}>
                {caseTitle}
              </Text>
            </View>
          </View>

          <View style={styles.infoRightCol}>
            <View style={styles.docIconBox}>
              <Ionicons
                name="document-text-outline"
                size={24}
                color={THEME.primary}
              />
            </View>
            <Text style={styles.docIconLabel}>Client documents</Text>
          </View>
        </View>

        {/* ─── 3. MAIN DOCUMENT VIEWER CONTAINER ───────────────────────────── */}
        <View style={styles.viewerContainer}>
          {viewerState === 'success' && (
            /* ── STATE 1: DOCUMENT AVAILABLE & LOADED ── */
            <View style={[styles.docPreviewWrapper, { height: '100%', width: '100%', flex: 1 }]}>
              {activeDocumentUrl ? (
                (() => {
                  const isPdf = activeDocumentUrl.toLowerCase().includes('.pdf') || (activeFileName && activeFileName.toLowerCase().endsWith('.pdf'));
                  if (/\.(jpe?g|png|webp|gif)(?:$|[?#])/i.test(activeDocumentUrl) || /\.(jpe?g|png|webp|gif)$/i.test(activeFileName || '')) {
                    return <Image source={{ uri: activeDocumentUrl }} resizeMode="contain" style={{ width: '100%', height: '100%', transform: [{ scale: zoomLevel }] }} onError={() => setViewerState('error')} />;
                  }
                  const viewerUri = isPdf 
                    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(activeDocumentUrl)}`
                    : activeDocumentUrl;
                  
                  return (
                    <WebView
                      source={{ uri: viewerUri }}
                      style={{ flex: 1, width: '100%', borderRadius: 8 }}
                      startInLoadingState={true}
                      onError={(e) => {
                        console.log('WebView Error:', e.nativeEvent);
                        setViewerState('error');
                      }}
                      onHttpError={(e) => {
                        console.log('WebView HTTP Error:', e.nativeEvent);
                        // gview sometimes throws HTTP errors intermittently, don't immediately crash the viewer if it's a PDF
                        if (!isPdf || e.nativeEvent.statusCode === 404) {
                           setViewerState('error');
                        }
                      }}
                    />
                  );
                })()
              ) : (
                <Text>No Document URL Provided</Text>
              )}
            </View>
          )}

          {viewerState === 'error' && (
            /* ── STATE 2: UNABLE TO LOAD DOCUMENT ── */
            <View style={styles.stateCenterBox}>
              <View style={styles.stateIconCircle}>
                <Ionicons
                  name="document-text-outline"
                  size={36}
                  color={THEME.primary}
                />
                <View style={styles.errorDotBadge}>
                  <Ionicons name="close" size={12} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.stateTitle}>Unable to load document</Text>
              <Text style={styles.stateSubtitle}>
                Something went wrong while{'\n'}loading this document
              </Text>
              <TouchableOpacity
                style={styles.stateActionButton}
                activeOpacity={0.8}
                onPress={handleTryAgain}
              >
                <Text style={styles.stateActionText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {viewerState === 'empty' && (
            /* ── STATE 3: NO DOCUMENT AVAILABLE ── */
            <View style={styles.stateCenterBox}>
              <View style={styles.stateIconCircle}>
                <Ionicons
                  name="folder-open-outline"
                  size={36}
                  color={THEME.primary}
                />
              </View>
              <Text style={styles.stateTitle}>No document available</Text>
              <Text style={styles.stateSubtitle}>
                There is no document uploaded{'\n'}for this case yet
              </Text>
              <TouchableOpacity
                style={styles.stateActionButton}
                activeOpacity={0.8}
                onPress={handleBackToCase}
              >
                <Text style={styles.stateActionText}>Back to Case</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── 4. DOCUMENT PAGE NAVIGATION ─────────────────────────────────── */}
        <View style={styles.pageNavRow}>
          <TouchableOpacity
            style={[
              styles.pageNavArrow,
              currentPage === 1 && styles.pageNavArrowDisabled,
            ]}
            onPress={handlePrevPage}
            disabled={currentPage === 1 || viewerState !== 'success'}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={currentPage === 1 ? THEME.disabledIcon : THEME.primary}
            />
          </TouchableOpacity>

          <Text style={styles.pageNavText}>
            {totalPages > 1 ? `Document ${currentPage} of ${totalPages}` : 'Document preview'}
          </Text>

          <TouchableOpacity
            style={[
              styles.pageNavArrow,
              currentPage === totalPages && styles.pageNavArrowDisabled,
            ]}
            onPress={handleNextPage}
            disabled={currentPage === totalPages || viewerState !== 'success'}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={
                currentPage === totalPages ? THEME.disabledIcon : THEME.primary
              }
            />
          </TouchableOpacity>
        </View>

        {/* ─── 5. DOCUMENT TOOLBAR (6 ACTIONS) ─────────────────────────────── */}
        <View style={styles.toolbarCard}>
          {/* Zoom Out */}
          <TouchableOpacity
            style={styles.toolItem}
            activeOpacity={0.75}
            onPress={handleZoomOut}
          >
            <View style={styles.toolIconBtn}>
              <Ionicons name="remove-circle-outline" size={20} color={THEME.primary} />
            </View>
            <Text style={styles.toolLabel}>Zoom Out</Text>
          </TouchableOpacity>

          {/* Zoom In */}
          <TouchableOpacity
            style={styles.toolItem}
            activeOpacity={0.75}
            onPress={handleZoomIn}
          >
            <View style={styles.toolIconBtn}>
              <Ionicons name="add-circle-outline" size={20} color={THEME.primary} />
            </View>
            <Text style={styles.toolLabel}>Zoom In</Text>
          </TouchableOpacity>

          {/* Fit to Screen */}
          <TouchableOpacity
            style={styles.toolItem}
            activeOpacity={0.75}
            onPress={handleFitToScreen}
          >
            <View style={styles.toolIconBtn}>
              <Ionicons name="scan-outline" size={19} color={THEME.primary} />
            </View>
            <Text style={styles.toolLabel}>Fit to Screen</Text>
          </TouchableOpacity>

          {/* Download */}
          <TouchableOpacity
            style={styles.toolItem}
            activeOpacity={0.75}
            onPress={handleDownload}
          >
            <View style={styles.toolIconBtn}>
              <Ionicons name="download-outline" size={20} color={THEME.primary} />
            </View>
            <Text style={styles.toolLabel}>Download</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            style={styles.toolItem}
            activeOpacity={0.75}
            onPress={handleShare}
          >
            <View style={styles.toolIconBtn}>
              <Ionicons name="share-social-outline" size={19} color={THEME.primary} />
            </View>
            <Text style={styles.toolLabel}>Share</Text>
          </TouchableOpacity>

          {/* More */}
          <TouchableOpacity
            style={styles.toolItem}
            activeOpacity={0.75}
            onPress={() => setMoreModalVisible(true)}
          >
            <View style={styles.toolIconBtn}>
              <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={THEME.primary} />
            </View>
            <Text style={styles.toolLabel}>More</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ─── MORE OPTIONS MODAL ──────────────────────────────────────────── */}
      <Modal
        visible={moreModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMoreModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMoreModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Document Options</Text>
              <TouchableOpacity onPress={() => setMoreModalVisible(false)}>
                <Ionicons name="close" size={22} color={THEME.textDark} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalOptionRow}
              onPress={() => {
                setMoreModalVisible(false);
                handleDownload();
              }}
            >
              <Ionicons name="download-outline" size={20} color={THEME.primary} />
              <Text style={styles.modalOptionText}>Save to Device</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOptionRow}
              onPress={() => {
                setMoreModalVisible(false);
                handleShare();
              }}
            >
              <Ionicons name="share-social-outline" size={20} color={THEME.primary} />
              <Text style={styles.modalOptionText}>Share with Client</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOptionRow}
              onPress={() => {
                setMoreModalVisible(false);
                Alert.alert(
                  'Document Details',
                  `Filename: ${activeFileName}\nClient: ${clientName}\nCase: ${caseTitle}\nDocuments in viewer: ${totalPages}`
                );
              }}
            >
              <Ionicons name="information-circle-outline" size={20} color={THEME.primary} />
              <Text style={styles.modalOptionText}>Document Details</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.background,
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
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE7DF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textDark,
  },
  scrollContent: {
    padding: 16,
  },

  // ─── 2. DOCUMENT INFORMATION CARD ───────────────────────────────────
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#2D2824',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1.5,
    marginBottom: 16,
  },
  infoLeftCol: {
    flex: 1,
    gap: 4,
  },
  fileNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.textDark,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaKey: {
    fontSize: 12,
    color: THEME.textMuted,
    fontWeight: '500',
    width: 50,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textDark,
    flex: 1,
  },
  infoRightCol: {
    alignItems: 'center',
    marginLeft: 12,
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#EFEAE4',
  },
  docIconLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.textMuted,
  },

  // ─── 3. MAIN DOCUMENT VIEWER CONTAINER ──────────────────────────────
  viewerContainer: {
    backgroundColor: THEME.viewerBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.viewerBorder,
    height: 480,
    minHeight: 380,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#2D2824',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  docPreviewWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  a4DocumentPaper: {
    width: '94%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBE4DB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  docPaperHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  docEmblem: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  docHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textDark,
    letterSpacing: 0.5,
  },
  docHeaderSub: {
    fontSize: 8,
    fontWeight: '600',
    color: THEME.textMuted,
    marginTop: 1,
  },
  docDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#EAE4DC',
    marginTop: 8,
  },
  docPaperBody: {
    gap: 8,
  },
  docMatterTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textDark,
  },
  docParagraph: {
    fontSize: 9,
    lineHeight: 14,
    color: '#443E38',
    fontWeight: '400',
  },
  docPlaceholderLines: {
    gap: 5,
    marginTop: 4,
  },
  docLine: {
    height: 4,
    backgroundColor: '#F0EBE4',
    borderRadius: 2,
  },
  docPaperFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F5EFEB',
  },
  docSeal: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.primaryLight,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docSignBlock: {
    alignItems: 'center',
    width: 100,
  },
  docSignLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#9E958C',
    marginBottom: 4,
  },
  docSignText: {
    fontSize: 8,
    fontWeight: '600',
    color: THEME.textMuted,
  },

  // ─── ERROR & EMPTY STATES ───────────────────────────────────────────
  stateCenterBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  stateIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EDE7DF',
    position: 'relative',
  },
  errorDotBadge: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textDark,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
  },
  stateActionButton: {
    backgroundColor: THEME.primary,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  stateActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ─── 4. PAGE NAVIGATION ─────────────────────────────────────────────
  pageNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 14,
  },
  pageNavArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFEBE4',
  },
  pageNavArrowDisabled: {
    opacity: 0.5,
    borderColor: '#F5F1EB',
  },
  pageNavText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textDark,
  },

  // ─── 5. DOCUMENT TOOLBAR (6 ACTIONS) ─────────────────────────────────
  toolbarCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.cardBg,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    shadowColor: '#2D2824',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  toolItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  toolIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: THEME.textMuted,
    textAlign: 'center',
  },

  // ─── MODAL STYLES ───────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textDark,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F5F1EB',
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textDark,
  },
});
