// screens/shared/CallHistoryScreen.jsx
// Shows call history for both advocate and client roles

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, ActivityIndicator, Image, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { callsAPI, bookingAPI } from '../../services/api';
import { initiateCall } from '../../services/socket';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

const MODE_CONFIG = {
  video: { icon: 'videocam',      color: '#3B82F6', label: 'Video Call' },
  voice: { icon: 'call',          color: '#10B981', label: 'Voice Call' },
};

const STATUS_CONFIG = {
  completed:            { icon: 'checkmark-circle', color: '#10B981', label: 'Completed' },
  COMPLETED:            { icon: 'checkmark-circle', color: '#10B981', label: 'Completed' },
  user_ended:           { icon: 'checkmark-circle', color: '#10B981', label: 'Completed' },
  USER_ENDED:           { icon: 'checkmark-circle', color: '#10B981', label: 'Completed' },
  missed:               { icon: 'close-circle',     color: '#EF4444', label: 'Missed'    },
  MISSED:               { icon: 'close-circle',     color: '#EF4444', label: 'Missed'    },
  rejected:             { icon: 'ban',              color: '#F59E0B', label: 'Rejected'  },
  REJECTED:             { icon: 'ban',              color: '#F59E0B', label: 'Rejected'  },
  cancelled:            { icon: 'ban',              color: '#F59E0B', label: 'Cancelled' },
  CANCELLED:            { icon: 'ban',              color: '#F59E0B', label: 'Cancelled' },
  timeout:              { icon: 'time',             color: '#6B7280', label: 'Timeout'   },
  TIMEOUT:              { icon: 'time',             color: '#6B7280', label: 'Timeout'   },
  failed:               { icon: 'alert-circle',     color: '#EF4444', label: 'Failed'    },
  FAILED:               { icon: 'alert-circle',     color: '#EF4444', label: 'Failed'    },
  network_disconnected: { icon: 'wifi-outline',     color: '#EC4899', label: 'Disconnected' },
  NETWORK_DISCONNECTED: { icon: 'wifi-outline',     color: '#EC4899', label: 'Disconnected' },
  appointment_expired:  { icon: 'hourglass-outline',color: '#8B5CF6', label: 'Expired'   },
  APPOINTMENT_EXPIRED:  { icon: 'hourglass-outline',color: '#8B5CF6', label: 'Expired'   },
};

const formatDuration = (seconds) => {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

const formatDate = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CallItem = ({ item, myRole }) => {
  const mode   = MODE_CONFIG[item.mode]   || MODE_CONFIG.video;
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.completed;
  const other  = myRole === 'advocate' ? item.client : item.advocateUser;
  const name   = other?.name || 'Unknown';
  const avatar = other?.avatar || null;
  const initial = name[0]?.toUpperCase() || '?';
  const { useNavigation } = require('@react-navigation/native');
  const navigation = useNavigation();

  const handleCallBack = async () => {
    const bookingId = item.booking?._id || item.bookingId;
    if (!bookingId) return Alert.alert('Call unavailable', 'This call has no linked booking.');
    try {
      const { data } = await bookingAPI.canJoinCall(bookingId);
      if (data?.canJoin === false) throw new Error(data.message || 'The call window is closed.');
      const config = data?.data || {};
      await initiateCall({
        bookingId,
        zegoRoomId: config.zegoRoomId,
        mode: item.mode || 'voice',
      });
      navigation.navigate(myRole === 'advocate' ? 'AdvocateCall' : 'VideoCall', {
        ...config,
        mode: item.mode || 'voice',
        bookingId,
        clientName: name,
        clientAvatar: avatar,
        clientId: item.client?._id || item.clientId,
        advocateUserId: item.advocateUser?._id,
      });
    } catch (err) {
      Alert.alert('Call unavailable', err.response?.data?.message || err.message || 'Could not start this call.');
    }
  };

  return (
    <View style={s.callRow}>
      {/* Avatar with photo */}
      <View style={[s.avatarWrap, { backgroundColor: mode.color + '18' }]}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={s.avatarImg} />
        ) : (
          <Text style={[s.avatarText, { color: mode.color }]}>{initial}</Text>
        )}
        {/* Call type badge */}
        <View style={[s.modeBadge, { backgroundColor: mode.color }]}>
          <Ionicons name={mode.icon} size={8} color="#fff" />
        </View>
      </View>

      {/* Info */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.callerName}>{name}</Text>
        <View style={s.metaRow}>
          <Ionicons name={mode.icon} size={12} color={mode.color} />
          <Text style={[s.metaText, { color: mode.color }]}>{mode.label}</Text>
          <Text style={s.metaDot}>·</Text>
          <Ionicons name={status.icon} size={12} color={status.color} />
          <Text style={[s.metaText, { color: status.color }]}>{status.label}</Text>
        </View>
        {item.duration > 0 && (
          <Text style={s.duration}>Duration: {formatDuration(item.duration)}</Text>
        )}
      </View>

      {/* Date + callback button */}
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Text style={s.dateText}>{formatDate(item.createdAt)}</Text>
        <View style={[s.callbackBtn, { backgroundColor: mode.color + '15' }]}>
          <Ionicons name={item.mode === 'video' ? 'videocam-outline' : 'call-outline'} size={14} color={mode.color} />
        </View>
      </View>

      {/* Action: Call Back button */}
      <TouchableOpacity style={s.callbackBtn} onPress={handleCallBack} activeOpacity={0.7}>
        <Ionicons name={item.mode === 'video' ? 'videocam' : 'call'} size={20} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
};

export default function CallHistoryScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [calls, setCalls]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefresh]  = useState(false);
  const [filter, setFilter]       = useState('all'); // all | video | voice

  const fetch = useCallback(async () => {
    try {
      const params = {};
      if (filter !== 'all') params.mode = filter;
      const { data } = await callsAPI.getHistory(params);
      setCalls(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      console.error('CallHistory fetch:', e.message);
      setCalls([]);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [filter]);

  useEffect(() => { fetch(); }, [fetch]);
  const onRefresh = () => { setRefresh(true); fetch(); };

  const totalCalls     = calls.length;
  const completedCalls = calls.filter(c => c.status === 'completed').length;
  const missedCalls    = calls.filter(c => c.status === 'missed').length;
  const totalMins      = Math.round(calls.reduce((sum, c) => sum + (c.duration || 0), 0) / 60);

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F8" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Call History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        {[
          { label: 'Total',     value: totalCalls,     color: COLORS.primary },
          { label: 'Completed', value: completedCalls, color: '#10B981' },
          { label: 'Missed',    value: missedCalls,    color: '#EF4444' },
          { label: 'Minutes',   value: totalMins,      color: '#3B82F6' },
        ].map(stat => (
          <View key={stat.label} style={s.statBox}>
            <Text style={[s.statVal, { color: stat.color }]}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {['all', 'video', 'voice'].map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterBtn, filter === f && s.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Ionicons
              name={f === 'all' ? 'list' : f === 'video' ? 'videocam-outline' : 'call-outline'}
              size={14} color={filter === f ? '#FFFFFF' : COLORS.textPrimary}
            />
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={calls}
          keyExtractor={(item, i) => item._id || String(i)}
          renderItem={({ item }) => <CallItem item={item} myRole={user?.role} />}
          contentContainerStyle={[
            s.list,
            { paddingBottom: Math.max(insets.bottom, 12) + 110 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="call-outline" size={48} color="#D1D5DB" />
              <Text style={s.emptyTitle}>No calls yet</Text>
              <Text style={s.emptySubtitle}>Your call history will appear here</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F8' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#F3F4F6' },
  backBtn:    { width: 40 },
  headerTitle:{ fontSize: 17, fontWeight: '800', color: '#1C1917' },

  statsRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  statBox:  { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 20, fontWeight: '900' },
  statLabel:{ fontSize: 10, color: '#78716C', fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },

  filterRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#F3F4F6' },
  filterBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F5F5F4', borderWidth: 1, borderColor: '#E7E5E4' },
  filterBtnActive:{ backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText:     { fontSize: 12, fontWeight: '700', color: '#57534E' },
  filterTextActive:{ color: '#FFFFFF' },

  list: { paddingTop: 8, paddingHorizontal: 16 },
  separator: { height: 1, backgroundColor: '#F5F5F4' },

  callRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  avatarWrap:  { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  avatarImg:   { width: 48, height: 48, borderRadius: 24 },
  avatarText:  { fontSize: 18, fontWeight: '800' },
  modeBadge:   { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FAF9F8' },
  callerName:  { fontSize: 14, fontWeight: '700', color: '#1C1917', marginBottom: 4 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:    { fontSize: 11, fontWeight: '600' },
  metaDot:     { fontSize: 11, color: '#D1D5DB' },
  duration:    { fontSize: 11, color: '#78716C', marginTop: 4 },
  dateText:    { fontSize: 10, color: '#A8A29E', fontWeight: '500' },
  callbackBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  empty:        { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: '#1C1917' },
  emptySubtitle:{ fontSize: 13, color: '#A8A29E' },
});
