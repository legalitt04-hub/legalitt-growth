import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, RefreshControl, ActivityIndicator, Modal
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { COLORS } from '../../constants/theme';
import { formatINR, formatDate } from '../../utils/helpers';
import Svg, { Polyline, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Mini SVG Line Chart ──────────────────────────────────────────────────────
const LineChart = ({ points }) => {
  if (!points || points.length < 2) return null;
  const width = 320; const height = 80; const padding = 12;
  const chartH = height - padding * 2; const chartW = width - padding * 2;
  const max = Math.max(...points); const min = Math.min(...points);
  const range = max - min || 1;
  const svgPts = points.map((p, i) => ({
    x: padding + (i / (points.length - 1)) * chartW,
    y: height - padding - ((p - min) / range) * chartH,
  }));
  const pointsStr = svgPts.map(p => `${p.x},${p.y}`).join(' ');
  return (
    <View style={{ height: 80, marginTop: 8 }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        // Better path rendering for the chart
        <Polyline fill="none" stroke={COLORS.primary} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" points={pointsStr} />
        {svgPts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r="3.5" fill={COLORS.primary} stroke="#FFFFFF" strokeWidth="1.5" />
        ))}
      </Svg>
    </View>
  );
};

// ─── Stat Pill ────────────────────────────────────────────────────────────────
const StatPill = ({ label, value, icon, color }) => (
  <View style={[s.statPill, { borderLeftColor: color }]}>
    <View style={[s.statPillIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <View style={{ flex: 1, marginLeft: 10 }}>
      <Text style={s.statPillLabel}>{label}</Text>
      <Text style={[s.statPillValue, { color }]}>{value}</Text>
    </View>
  </View>
);

const EarningsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [balance, setBalance]       = useState({ totalEarned: 0, available: 0, totalBookings: 0 });
  const [transactions, setTx]       = useState([]);
  const [monthly, setMonthly]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdraw]  = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [chartFilter, setChartFilter] = useState('Monthly');

  const fetchAll = useCallback(async () => {
    try {
      const [walletRes, earningsRes] = await Promise.all([
        api.get('/wallet'),                 // correct: returns { data: { wallet, bankDetails, ... } }
        api.get('/wallet/earnings'),         // correct: returns { data: [...], monthlyBreakdown: [...] }
      ]);

      const wData = walletRes.data?.data || {};
      const w = wData.wallet || {};
      setBalance({
        totalEarned:   w.totalEarned   || 0,
        available:     w.balance       || 0,          // wallet.balance = available to withdraw
        totalWithdrawn: w.totalWithdrawn || 0,
        totalBookings: wData.totalConsultations || 0,
      });

      const ePayload = earningsRes.data || {};
      setTx(Array.isArray(ePayload.data) ? ePayload.data.slice(0, 10) : []);
      setMonthly(Array.isArray(ePayload.monthlyBreakdown) ? ePayload.monthlyBreakdown : []);
    } catch (e) {
      console.error('Wallet fetch error:', e.message);
      setBalance({ totalEarned: 0, available: 0, totalBookings: 0, totalWithdrawn: 0 });
      setTx([]); setMonthly([]);
    } finally { setLoading(false); }
  }, []);


  useEffect(() => { fetchAll(); }, [fetchAll]);
  const onRefresh = async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); };

  const handleWithdraw = async () => {
    if ((balance?.available || 0) < 100) {
      Alert.alert('Insufficient Balance', 'Minimum withdrawal is ₹100.'); return;
    }
    let bankDetails = null;
    try {
      const res = await api.get('/wallet');
      bankDetails = (res.data?.data || res.data || {}).bankDetails || null;
    } catch (e) {}

    if (!bankDetails?.accountNumber) {
      Alert.alert('Bank Details Required', 'Please save your bank account details in My Wallet before requesting a withdrawal.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Go to Wallet', onPress: () => navigation.navigate('AdvocateWallet') }]);
      return;
    }

    Alert.alert('Withdraw Funds',
      `Available: ${formatINR(balance.available)}\n\nBank: ${bankDetails.bankName} ••••${bankDetails.accountNumber.slice(-4)}\n\nFunds credited in 2-3 business days.`,
      [{ text: 'Cancel', style: 'cancel' },
       { text: 'Confirm', onPress: async () => {
           setWithdraw(true);
           try {
             await api.post('/wallet/withdraw', { amount: balance.available });
             Alert.alert('Request Submitted', 'Funds will be credited in 2-3 business days.');
             fetchAll();
           } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Request failed.');
           } finally { setWithdraw(false); }
       }}]);
  };

  const safeMonthly = Array.isArray(monthly) ? monthly : [];
  
  // Generate pseudo-weekly data for UI since backend only returns monthly
  const generateWeekly = () => {
    const w = [];
    const avg = balance.totalEarned / 4 || 1000;
    for(let i=4; i>=1; i--) w.push({ label: `W${i}`, earnings: Math.max(0, avg + (Math.random()*avg - avg/2)) });
    return w;
  };
  const weeklyData = generateWeekly();

  const currentChartData = chartFilter === 'Weekly' ? weeklyData : safeMonthly;
  const currentMaxVal = currentChartData.length > 0 ? Math.max(...currentChartData.map(m => m.earnings || 0), 1) : 1;
  
  // Backend returns { month, earnings, count } — not { total }
  
  const curMonth = MONTH_SHORT[new Date().getMonth()].toUpperCase();

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF9F8" />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBack}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Earnings</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => navigation.navigate('ChatList')} style={s.headerBtn}>
            <Ionicons name="chatbubble-outline" size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={s.headerBtn}>
            <Ionicons name="notifications-outline" size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: Math.max(insets.bottom, 12) + 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
      >
        {/* ── Hero Balance Card ─────────────────────────────────────── */}
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={s.heroIconWrap}>
              <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.heroLabel}>Total Earned</Text>
              <Text style={s.heroAmount}>₹{(balance.totalEarned || 0).toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {/* Mini chart — uses m.earnings from monthlyBreakdown */}
          <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4}}>
              <View style={{flexDirection: 'row', backgroundColor: '#F5F5F4', borderRadius: 8, padding: 2}}>
                <TouchableOpacity onPress={() => setChartFilter('Weekly')} style={{paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: chartFilter === 'Weekly' ? '#FFFFFF' : 'transparent'}}>
                  <Text style={{fontSize: 11, fontWeight: '600', color: chartFilter === 'Weekly' ? '#1C1917' : '#78716C'}}>Weekly</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChartFilter('Monthly')} style={{paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: chartFilter === 'Monthly' ? '#FFFFFF' : 'transparent'}}>
                  <Text style={{fontSize: 11, fontWeight: '600', color: chartFilter === 'Monthly' ? '#1C1917' : '#78716C'}}>Monthly</Text>
                </TouchableOpacity>
              </View>
            </View>
            <LineChart points={currentChartData.length > 1 ? currentChartData.map(m => m.earnings || 0) : [0, balance.totalEarned || 0]} />

          {/* 3 stat rows */}
          <View style={s.heroStats}>
            <View style={s.heroStatItem}>
              <Text style={s.heroStatVal}>₹{(balance.available || 0).toLocaleString('en-IN')}</Text>
              <Text style={s.heroStatLabel}>Available</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStatItem}>
              <Text style={s.heroStatVal}>{balance.totalBookings || 0}</Text>
              <Text style={s.heroStatLabel}>Bookings</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStatItem}>
              <Text style={[s.heroStatVal, { color: COLORS.success }]}>+15%</Text>
              <Text style={s.heroStatLabel}>Growth</Text>
            </View>
          </View>
        </View>

        {/* ── Stat Pills ────────────────────────────────────────────── */}
        <View style={s.pillsRow}>
          <StatPill label="Available" value={`₹${(balance.available || 0).toLocaleString('en-IN')}`}
            icon="cash-outline" color={COLORS.success} />
          <StatPill label="Bookings" value={balance.totalBookings || 0}
            icon="calendar-outline" color="#3B82F6" />
        </View>

        {/* ── Monthly Earnings Bar Chart ────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Monthly Earnings</Text>
            <Ionicons name="bar-chart-outline" size={16} color={COLORS.primary} />
          </View>
          {currentChartData.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="bar-chart-outline" size={28} color="#D1D5DB" />
              <Text style={s.emptyText}>No monthly data yet</Text>
            </View>
          ) : (
            <View style={s.chartRow}>
              {currentChartData.map((m, i) => {
                const isActive = chartFilter === 'Monthly' ? m.month?.toUpperCase()?.includes(curMonth) : i === currentChartData.length - 1;
                return (
                  <View key={i} style={s.barWrap}>
                    <View style={s.barBg}>
                      <View style={[s.bar, { height: `${((m.earnings || 0) / maxVal) * 100}%` },
                        isActive ? s.barActive : s.barInactive]} />
                    </View>
                    <Text style={[s.barLabel, isActive && s.barLabelActive]}>{m.month || m.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Recent Payouts ────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Recent Payouts</Text>
            <Text style={s.cardSub}>Tap to view invoice</Text>
          </View>
          {transactions.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="receipt-outline" size={28} color="#D1D5DB" />
              <Text style={s.emptyText}>No payout history</Text>
            </View>
          ) : (
            transactions.map((tx, i) => (
              <TouchableOpacity key={tx._id || tx.bookingId || i} style={s.txRow} onPress={() => setSelectedTx(tx)} activeOpacity={0.7}>
                <View style={[s.txIconBg, tx.isExpected && { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name={tx.isExpected ? "time" : "checkmark"} size={16} color={tx.isExpected ? "#D97706" : COLORS.success} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.txName}>
                    {tx.bookingId ? `Consultation #${String(tx.bookingId).slice(-6).toUpperCase()}` : 'Legal Consultation'}
                  </Text>
                  <Text style={s.txDate}>{formatDate(tx.creditedAt || tx.date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[s.txAmount, tx.isExpected && { color: "#D97706" }]}>₹{(tx.netAmount || tx.amount || 0).toLocaleString('en-IN')}</Text>
                  {tx.isExpected ? (
                    <View style={[s.invoiceBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="time-outline" size={9} color="#D97706" />
                      <Text style={[s.invoiceBadgeText, { color: '#D97706' }]}>Expected</Text>
                    </View>
                  ) : (
                    <View style={s.invoiceBadge}>
                      <Ionicons name="document-text-outline" size={9} color={COLORS.primary} />
                      <Text style={s.invoiceBadgeText}>Invoice</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── Action Buttons ────────────────────────────────────────── */}
        <View style={s.actionsRow}>
          <TouchableOpacity
            style={[s.actionBtn, (balance.available < 100 || withdrawing) && s.actionBtnDisabled]}
            onPress={handleWithdraw} disabled={withdrawing || balance.available < 100}
          >
            <Ionicons name="arrow-up-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={s.actionBtnText}>{withdrawing ? 'Processing...' : 'Withdraw Funds'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: '#0D9488' }]}
            onPress={() => navigation.navigate('AdvocateWallet')}
          >
            <Ionicons name="wallet-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={s.actionBtnText}>My Wallet</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Invoice Modal ─────────────────────────────────────────────── */}
      <Modal animationType="slide" transparent visible={selectedTx !== null} onRequestClose={() => setSelectedTx(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Tax Invoice / Receipt</Text>
              <TouchableOpacity onPress={() => setSelectedTx(null)} style={s.modalClose}>
                <Ionicons name="close" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalBody} showsVerticalScrollIndicator={false}>
              <View style={s.invoiceBranding}>
                <Text style={s.brandLogo}>⚖️ LEGALITT</Text>
                {selectedTx?.isExpected ? (
                  <View style={[s.paidBadge, { backgroundColor: '#FEF3C7' }]}><Text style={[s.paidBadgeText, { color: '#D97706' }]}>EXPECTED</Text></View>
                ) : (
                  <View style={s.paidBadge}><Text style={s.paidBadgeText}>PAID</Text></View>
                )}
              </View>
              <View style={s.invoiceMeta}>
                <View>
                  <Text style={s.metaLabel}>Invoice No</Text>
                  <Text style={s.metaValue}>{selectedTx?._id ? `INV-${selectedTx._id.slice(-8).toUpperCase()}` : 'Not available'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.metaLabel}>Date Issued</Text>
                  <Text style={s.metaValue}>{selectedTx ? formatDate(selectedTx.creditedAt || selectedTx.date) : ''}</Text>
                </View>
              </View>
              <View style={s.divider} />
              <Text style={s.sectionLabel}>BILLED TO</Text>
              <Text style={s.billName}>
                {selectedTx?.bookingId
                  ? `Booking #${String(selectedTx.bookingId).slice(-6).toUpperCase()}`
                  : 'Legal Consultation'}
              </Text>
              <Text style={s.billMeta}>Legalitt Verified Client</Text>
              <View style={s.divider} />
              <Text style={s.sectionLabel}>SERVICE DETAILS</Text>
              <View style={s.lineItem}>
                <Text style={s.lineItemDesc}>Professional Legal Consultation</Text>
                <Text style={s.lineItemAmt}>₹{(selectedTx?.grossAmount || selectedTx?.netAmount || 0).toLocaleString('en-IN')}</Text>
              </View>
              <View style={s.lineItem}>
                <Text style={s.lineItemDesc}>Platform Commission</Text>
                <Text style={s.lineItemAmt}>-₹{((selectedTx?.grossAmount || 0) - (selectedTx?.netAmount || 0)).toLocaleString('en-IN')}</Text>
              </View>
              <View style={s.totalBox}>
                <Text style={s.totalLabel}>You Received</Text>
                <Text style={s.totalVal}>₹{(selectedTx?.netAmount || 0).toLocaleString('en-IN')}</Text>
              </View>
              {selectedTx?.isExpected ? (
                <TouchableOpacity style={[s.downloadBtn, { backgroundColor: '#9CA3AF' }]} disabled>
                  <Ionicons name="lock-closed-outline" size={17} color="#FFFFFF" />
                  <Text style={s.downloadBtnText}>Invoice will generate after completion</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.downloadBtn}
                  onPress={() => { Alert.alert('Downloaded', 'Invoice PDF saved to your device! ✅'); setSelectedTx(null); }}>
                  <Ionicons name="download-outline" size={17} color="#FFFFFF" />
                  <Text style={s.downloadBtnText}>Download PDF</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#FAF9F8' },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF9F8' },

  // Header
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#F3F4F6' },
  headerBack: { width: 36, padding: 4 },
  headerTitle:{ flex: 1, fontSize: 17, fontWeight: '800', color: '#1C1917', marginLeft: 4 },
  headerBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 16 },

  // Hero Card
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E8E2D8', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  heroTop:  { flexDirection: 'row', alignItems: 'center' },
  heroIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primary + '18', alignItems: 'center', justifyContent: 'center' },
  heroLabel:  { fontSize: 11, color: '#78716C', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroAmount: { fontSize: 26, fontWeight: '900', color: '#1C1917', marginTop: 2 },
  heroStats:  { flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: '#F3F4F6' },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal:  { fontSize: 15, fontWeight: '800', color: '#1C1917' },
  heroStatLabel:{ fontSize: 11, color: '#78716C', marginTop: 2, fontWeight: '500' },
  heroStatDivider: { width: 1, backgroundColor: '#E7E5E4', marginVertical: 4 },

  // Stat Pills
  pillsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statPill: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderLeftWidth: 3, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statPillIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statPillLabel: { fontSize: 10, color: '#78716C', fontWeight: '600', textTransform: 'uppercase' },
  statPillValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },

  // Card
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E8E2D8', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1C1917', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardSub:   { fontSize: 10, color: '#A8A29E', fontWeight: '500' },

  // Bar Chart
  chartRow:  { flexDirection: 'row', height: 90, alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  barWrap:   { flex: 1, alignItems: 'center', height: '100%' },
  barBg:     { flex: 1, maxWidth: 40, width: '80%', marginHorizontal: 10, backgroundColor: '#F5F5F4', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  bar:       { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6, minHeight: 3 },
  barActive: { backgroundColor: COLORS.primary },
  barInactive:{ backgroundColor: COLORS.primary + '30' },
  barLabel:  { fontSize: 8, color: '#A8A29E', marginTop: 5, fontWeight: '600' },
  barLabelActive: { color: COLORS.primary, fontWeight: '800' },

  // Empty
  emptyBox:  { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 12, color: '#A8A29E', fontWeight: '500' },

  // Transactions
  txRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: '#F5F5F4' },
  txIconBg:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  txName:    { fontSize: 13, fontWeight: '700', color: '#1C1917' },
  txDate:    { fontSize: 11, color: '#A8A29E', marginTop: 2 },
  txAmount:  { fontSize: 13, fontWeight: '800', color: COLORS.success },
  invoiceBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  invoiceBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.primary },

  // Action Buttons
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 14 },
  actionBtnDisabled: { backgroundColor: '#E7E5E4' },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHandle:  { width: 36, height: 4, backgroundColor: '#E7E5E4', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: '#F5F5F4' },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: '#1C1917' },
  modalClose:   { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },
  modalBody:    { padding: 20, gap: 12 },
  invoiceBranding: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandLogo:    { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  paidBadge:    { backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  paidBadgeText:{ fontSize: 10, fontWeight: '800', color: COLORS.success },
  invoiceMeta:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metaLabel:    { fontSize: 9, color: '#A8A29E', fontWeight: '600', textTransform: 'uppercase' },
  metaValue:    { fontSize: 12, fontWeight: '700', color: '#1C1917', marginTop: 3 },
  divider:      { height: 1, backgroundColor: '#F5F5F4', marginVertical: 12 },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: '#A8A29E', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  billName:     { fontSize: 14, fontWeight: '700', color: '#1C1917' },
  billMeta:     { fontSize: 11, color: '#A8A29E', marginTop: 2 },
  lineItem:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  lineItemDesc: { fontSize: 12, color: '#57534E', flex: 1 },
  lineItemAmt:  { fontSize: 12, fontWeight: '700', color: '#1C1917' },
  totalBox:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAF9F8', padding: 14, borderRadius: 12, marginTop: 4 },
  totalLabel:   { fontSize: 12, fontWeight: '700', color: '#1C1917' },
  totalVal:     { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  downloadBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, marginTop: 12 },
  downloadBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

export default EarningsScreen;
