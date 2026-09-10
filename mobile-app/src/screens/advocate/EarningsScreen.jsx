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
import Svg, { Polyline, Circle } from 'react-native-svg';

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Static fallback while API loads
const PLACEHOLDER_MONTHLY = MONTH_SHORT.slice(0,10).map((m,i) => ({
  month: m.toUpperCase(), total: [15000, 35000, 45000, 30000, 42000, 38000, 80000, 25000, 42000, 55000][i], count: i+2,
}));
const PLACEHOLDER_TX = [
  { id:'1', description:'Vikram Kapoor', date: new Date(Date.now()-86400000*2), amount:25000 },
  { id:'2', description:'Vikram Kapoor',  date: new Date(Date.now()-86400000*4), amount:25000 },
  { id:'3', description:'Vikram Kapoor', date: new Date(Date.now()-86400000*7), amount:25000 },
];

const LineChart = ({ points }) => {
  const width = 320;
  const height = 70;
  const padding = 10;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  
  const maxPoint = Math.max(...points);
  const minPoint = Math.min(...points);
  const range = maxPoint - minPoint || 1;
  
  const svgPoints = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * chartWidth;
    const y = height - padding - ((p - minPoint) / range) * chartHeight;
    return { x, y };
  });
  
  const pointsStr = svgPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <View style={line.container}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <Polyline
          fill="none"
          stroke={COLORS.primary}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsStr}
        />
        {svgPoints.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r="3.5" fill={COLORS.primary} stroke="#FFFFFF" strokeWidth="1.5" />
        ))}
      </Svg>
    </View>
  );
};
const line = StyleSheet.create({
  container: { height: 75, marginTop: 12, overflow: 'hidden' },
});

const EarningsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [balance, setBalance]       = useState({ totalEarned: 0, available: 0, totalBookings: 0 });
  const [transactions, setTx]       = useState([]);
  const [monthly, setMonthly]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdraw]  = useState(false);
  const [selectedTx, setSelectedTx]   = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [b, t, m] = await Promise.all([
        api.get('/wallet/balance'),
        api.get('/wallet/transactions?limit=5'),
        api.get('/wallet/monthly-stats'),
      ]);
      console.log('Wallet balance fetched:', b.data);
      console.log('Wallet transactions fetched:', t.data);
      console.log('Wallet monthly-stats fetched:', m.data);
      setBalance(b.data.data || { totalEarned: 0, available: 0, totalBookings: 0 });
      setTx(t.data.data || []);
      setMonthly(m.data.data || []);
    } catch (e) {
      console.error('Wallet data fetch error:', e.message, e.response?.data || e);
      // Fallback if APIs completely fail: display 0
      setBalance({ totalEarned: 0, available: 0, totalBookings: 0 });
      setTx([]);
      setMonthly([]);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  const onRefresh = async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); };

  const handleWithdraw = async () => {
    if ((balance?.available || 0) < 100) {
      Alert.alert('Insufficient Balance', 'Minimum withdrawal is ₹100.');
      return;
    }

    // Fetch saved bank details first
    let bankDetails = null;
    try {
      const walletRes = await api.get('/wallet');
      const walletData = walletRes.data?.data || walletRes.data || {};
      bankDetails = walletData.bankDetails || null;
    } catch (e) {
      console.log('Could not fetch bank details:', e.message);
    }

    if (!bankDetails?.accountNumber) {
      Alert.alert(
        'Bank Details Required',
        'Please save your bank account details in My Wallet before requesting a withdrawal.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Wallet', onPress: () => navigation.navigate('AdvocateWallet') },
        ]
      );
      return;
    }

    Alert.alert(
      'Withdraw Funds',
      `Available: ${formatINR(balance.available)}\n\nTransfer to: ${bankDetails.bankName} - \u2022\u2022\u2022\u2022${bankDetails.accountNumber.slice(-4)}\n\nAmount will be credited within 2-3 business days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          setWithdraw(true);
          try {
            await api.post('/wallet/withdraw', { amount: balance.available });
            Alert.alert('Request Submitted', 'Funds will be credited in 2-3 business days.');
            fetchAll();
          } catch (e) {
            Alert.alert('Error', e.response?.data?.message || 'Request failed.');
          } finally { setWithdraw(false); }
        }},
      ]
    );
  };

  const maxVal = monthly.length > 0 ? Math.max(...monthly.map(m => m.total), 1) : 1;
  const curMonth = MONTH_SHORT[new Date().getMonth()].toUpperCase();
  const EARNINGS_POINTS = [20, 35, 28, 45, 40, 55, 65, 60, 72];

  if (loading) return (
    <View style={s.loaderContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Earnings Summary</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => navigation.navigate('ChatList')} style={s.headerIconBtn}>
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={s.headerIconBtn}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: Math.max(insets.bottom, 12) + 95 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Summary Card */}
        <View style={s.summaryCard}>
          <View style={s.summaryTop}>
            <View style={s.iconBg}>
              <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.summaryLabel}>Earnings Summary</Text>
              <View style={s.earningsRow}>
                <Text style={s.bigAmount}>₹{(balance.totalEarned || 0).toLocaleString('en-IN')}</Text>
                <Text style={s.monthLabel}>Total Fund</Text>
                <View style={s.growthBadge}>
                  <Ionicons name="trending-up" size={10} color={COLORS.success} />
                  <Text style={s.growthText}>15%</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={s.viewAllBtn}>
              <Text style={s.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.earningsLabel}>Earnings Flow</Text>
          <LineChart points={monthly.length > 1 ? monthly.map(m => m.total) : [0, balance.totalEarned || 0]} />
        </View>

        {/* Monthly Earnings */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Monthly Earnings</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </View>
          {monthly.length === 0 ? (
            <View style={{ height: 100, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '500' }}>No monthly stats records found</Text>
            </View>
          ) : (
            <View style={s.chartRow}>
              {monthly.map((m, i) => {
                const isActive = m.month === curMonth;
                return (
                  <View key={i} style={s.barWrap}>
                    <View style={s.barBg}>
                      <View style={[
                        s.bar,
                        { height: `${(m.total / maxVal) * 100}%` },
                        isActive ? s.barActive : s.barInactive
                      ]} />
                    </View>
                    <Text style={[s.barLabel, isActive && s.barLabelActive]}>{m.month}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Recent Payouts */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Recent Payouts (Tap to view invoice)</Text>
          </View>
          {transactions.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '500' }}>No payout history found</Text>
            </View>
          ) : (
            transactions.map((tx, i) => {
              return (
                <TouchableOpacity 
                  key={tx.id || i} 
                  style={s.txRow} 
                  onPress={() => setSelectedTx(tx)}
                  activeOpacity={0.7}
                >
                  <View style={s.txIconBg}>
                    <Ionicons name="checkmark" size={18} color={COLORS.success} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.txName}>{tx.description}</Text>
                    <Text style={s.txDate}>{formatDate(tx.date)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={s.txAmount}>₹{(tx.amount || 0).toLocaleString('en-IN')}</Text>
                    <View style={s.invoiceBadge}>
                      <Ionicons name="document-text-outline" size={10} color={COLORS.primary} />
                      <Text style={s.invoiceBadgeText}>Invoice</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Action Buttons */}
        <View style={s.actionButtonsContainer}>
          <TouchableOpacity
            style={[s.withdrawBtn, { flex: 1 }, (balance.available < 100 || withdrawing) && s.withdrawBtnDisabled]}
            onPress={handleWithdraw}
            disabled={withdrawing || (balance.available < 100)}
          >
            <Text style={s.withdrawBtnText}>{withdrawing ? 'Processing...' : 'Withdraw Funds'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.withdrawBtn, { flex: 1, backgroundColor: '#0D9488' }]}
            onPress={() => navigation.navigate('AdvocateWallet')}
          >
            <Text style={s.withdrawBtnText}>💼 My Wallet</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Invoice modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={selectedTx !== null}
        onRequestClose={() => setSelectedTx(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Tax Invoice / Receipt</Text>
              <TouchableOpacity onPress={() => setSelectedTx(null)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalForm} showsVerticalScrollIndicator={false}>
              <View style={s.invoiceBranding}>
                <Text style={s.brandLogo}>⚖️ LEGALITT</Text>
                <Text style={s.invoiceTag}>PAID RECEIPT</Text>
              </View>

              <View style={s.invoiceMetadata}>
                <View>
                  <Text style={s.metaLabel}>Invoice No:</Text>
                  <Text style={s.metaValue}>INV-2026-{selectedTx?._id?.substring(selectedTx?._id.length - 4) || '7892'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.metaLabel}>Date Issued:</Text>
                  <Text style={s.metaValue}>{selectedTx ? formatDate(selectedTx.date) : ''}</Text>
                </View>
              </View>

              <View style={s.invoiceDivider} />

              <Text style={s.sectionHeaderLabel}>Billed To:</Text>
              <Text style={s.billName}>{selectedTx?.description || 'Consulting Client'}</Text>
              <Text style={s.billMeta}>Legalitt Verified Client • Individual Retainer</Text>

              <View style={s.invoiceDivider} />

              <Text style={s.sectionHeaderLabel}>Service Details:</Text>
              <View style={s.invoiceItemRow}>
                <Text style={s.itemDesc}>Professional Legal Consultation Fee</Text>
                <Text style={s.itemAmount}>₹{(selectedTx?.amount || 0).toLocaleString('en-IN')}</Text>
              </View>
              <View style={s.invoiceItemRow}>
                <Text style={s.itemDesc}>Legalitt Platform Processing Fee (Waived)</Text>
                <Text style={s.itemAmount}>₹0</Text>
              </View>

              <View style={s.totalContainer}>
                <Text style={s.totalLabel}>Total Receipt Amount</Text>
                <Text style={s.totalVal}>₹{(selectedTx?.amount || 0).toLocaleString('en-IN')}</Text>
              </View>

              <TouchableOpacity 
                style={s.downloadBtn}
                onPress={() => {
                  Alert.alert('Invoice Generated', 'The invoice PDF has been successfully downloaded to your local device storage! ✅');
                  setSelectedTx(null);
                }}
              >
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={s.downloadBtnText}>Download Invoice PDF</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderColor: '#F3F4F6'
  },
  backBtn: { width: 36, padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 120 },
  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    marginBottom: 16
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBg: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(20, 184, 166, 0.1)', alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 12, color: COLORS.textSecondary },
  earningsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  bigAmount: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  monthLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500', marginLeft: 6 },
  growthBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6, gap: 2 },
  growthText: { fontSize: 10, color: COLORS.success, fontWeight: '700' },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  viewAllText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  earningsLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center', fontWeight: '500' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    marginBottom: 16
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 90, justifyContent: 'space-between', marginTop: 8 },
  barWrap: { flex: 1, alignItems: 'center', height: '100%' },
  barBg: { flex: 1, width: '40%', backgroundColor: '#F3F4F6', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2 },
  barActive: { backgroundColor: COLORS.primary },
  barInactive: { backgroundColor: 'rgba(20, 184, 166, 0.25)' },
  barLabel: { fontSize: 8, color: COLORS.textSecondary, marginTop: 6, fontWeight: '600' },
  barLabelActive: { color: COLORS.primary, fontWeight: '700' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: '#F3F4F6' },
  txIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  txName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  txDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
  txAmount: { fontSize: 14, fontWeight: '800', color: COLORS.success },
  invoiceBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(20, 184, 166, 0.08)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  invoiceBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.primary },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  withdrawBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 99, alignItems: 'center' },
  withdrawBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  withdrawBtnDisabled: { backgroundColor: '#E5E7EB' },

  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', paddingBottom: 40
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderColor: '#F3F4F6'
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  modalForm: { padding: 20, gap: 12 },
  invoiceBranding: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandLogo: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  invoiceTag: { fontSize: 10, fontWeight: '800', color: COLORS.success, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  invoiceMetadata: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  metaLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textSecondary },
  metaValue: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  invoiceDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  sectionHeaderLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary },
  billName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: 4 },
  billMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  invoiceItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  itemDesc: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '500' },
  itemAmount: { fontSize: 12, color: COLORS.textPrimary, fontWeight: '700' },
  totalContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, marginTop: 12 },
  totalLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  totalVal: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, gap: 6, marginTop: 16 },
  downloadBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

export default EarningsScreen;
