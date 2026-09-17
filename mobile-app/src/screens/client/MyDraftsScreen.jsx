import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { firAPI, legalAdviceAPI } from '../../services/api';
import { COLORS } from '../../constants/theme';

const LABELS = {
  draft: 'Draft',
  finalized: 'Finalized',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  completed: 'Completed',
  pending_assignment: 'Awaiting Advocate',
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  cancelled: 'Cancelled',
};

const MyDraftsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [drafts, setDrafts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const fetchDrafts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');

    const [draftResult, requestResult] = await Promise.allSettled([
      firAPI.getMyDrafts(),
      legalAdviceAPI.getMyRequests({ serviceType: 'fir_draft' }),
    ]);

    if (draftResult.status === 'fulfilled' && draftResult.value.data?.success) {
      setDrafts(draftResult.value.data.data || []);
    } else {
      setDrafts([]);
    }

    if (requestResult.status === 'fulfilled' && requestResult.value.data?.success) {
      setRequests(requestResult.value.data.data || []);
    } else {
      setRequests([]);
    }

    if (draftResult.status === 'rejected' && requestResult.status === 'rejected') {
      const apiMessage = draftResult.reason?.response?.data?.message
        || requestResult.reason?.response?.data?.message;
      setError(apiMessage || 'Your FIR drafts could not be loaded. Please try again.');
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchDrafts();
    const unsubscribe = navigation.addListener('focus', () => fetchDrafts({ silent: true }));
    return unsubscribe;
  }, [fetchDrafts, navigation]);

  const items = useMemo(() => {
    const generated = drafts.map((draft) => ({
      id: draft._id,
      kind: 'generated',
      title: `${String(draft.type || 'FIR').replace(/_/g, ' ').toUpperCase()} FIR Draft`,
      subtitle: draft.aiDraft?.trim() || 'Draft content is pending.',
      status: LABELS[draft.status] || 'Draft',
      date: draft.updatedAt || draft.createdAt,
      raw: draft,
    }));

    const assisted = requests.map((request) => ({
      id: request._id,
      kind: 'assisted',
      title: 'Assisted FIR Draft Request',
      subtitle: request.issue || request.issueDescription || 'FIR drafting assistance request',
      status: LABELS[request.status] || request.status || 'Pending',
      date: request.updatedAt || request.createdAt,
      raw: request,
    }));

    return [...generated, ...assisted].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );
  }, [drafts, requests]);

  const openItem = (item) => {
    if (item.kind === 'generated') {
      navigation.navigate('FIRPreview', { draft: item.raw });
      return;
    }
    navigation.navigate('TrackConsultation', {
      bookingData: item.raw,
      requestId: item.id,
    });
  };

  const deleteDraft = (item) => {
    Alert.alert('Delete FIR Draft', 'This permanently removes the saved draft.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingId(item.id);
            await firAPI.deleteDraft(item.id);
            setDrafts((current) => current.filter((draft) => draft._id !== item.id));
          } catch (err) {
            Alert.alert('Delete failed', err?.response?.data?.message || 'Please try again.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openItem(item)} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={item.kind === 'generated' ? 'document-text' : 'people'}
            size={22}
            color={COLORS.primary}
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.draftType}>{item.title}</Text>
          <Text style={styles.draftDate}>
            {item.date ? new Date(item.date).toLocaleDateString('en-IN') : 'Date unavailable'}
            {' • '}
            <Text style={styles.statusText}>{item.status}</Text>
          </Text>
        </View>
        {item.kind === 'generated' ? (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(event) => {
              event.stopPropagation?.();
              deleteDraft(item);
            }}
            disabled={deletingId === item.id}
          >
            {deletingId === item.id
              ? <ActivityIndicator size="small" color="#DC2626" />
              : <Ionicons name="trash-outline" size={19} color="#DC2626" />}
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
        )}
      </View>
      <Text style={styles.previewText} numberOfLines={3}>{item.subtitle}</Text>
      <Text style={styles.openHint}>
        {item.kind === 'generated' ? 'Tap to view, edit, save or share' : 'Tap to track this drafting request'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark || '#8D7865']}
        style={[styles.header, { paddingTop: insets.top + 5 }]}
      >
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My FIR Drafts</Text>
          <TouchableOpacity onPress={() => navigation.navigate('FIRDraft')} style={styles.addButton}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchDrafts()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : items.length ? (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchDrafts({ silent: true }); }}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          )}
        />
      ) : (
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No FIR drafts yet</Text>
          <Text style={styles.emptySub}>Generated drafts and assisted FIR drafting requests will appear here.</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('FIRDraft')}>
            <Text style={styles.createBtnText}>Create FIR Draft Request</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingBottom: 22, paddingHorizontal: 20 },
  headerInner: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginLeft: 15 },
  addButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconContainer: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(176,156,133,0.15)', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: 12 },
  draftType: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  draftDate: { fontSize: 12, color: '#64748B', marginTop: 3 },
  statusText: { color: '#0F766E', fontWeight: '700' },
  previewText: { fontSize: 13, color: '#475569', lineHeight: 19 },
  openHint: { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 10 },
  deleteButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 20 },
  emptySub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  createBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 24 },
  createBtnText: { color: '#FFFFFF', fontWeight: '700' },
  errorBanner: { margin: 16, marginBottom: 0, borderRadius: 12, backgroundColor: '#FEF2F2', padding: 12, flexDirection: 'row', alignItems: 'center' },
  errorText: { flex: 1, color: '#991B1B', fontSize: 12 },
  retryText: { color: '#B91C1C', fontWeight: '700', marginLeft: 12 },
});

export default MyDraftsScreen;
