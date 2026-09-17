import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Clock, CheckCircle, XCircle, Search,
  RefreshCw, TrendingUp, Copy, Check, Download as DownloadIcon, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '../lib/api';

interface Withdrawal {
  _id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  bankDetails: {
    accountHolder: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    upiId?: string;
  };
  adminNote?: string;
  transactionId?: string;
  processedAt?: string;
  createdAt: string;
  advocateUser: { name: string; email: string; phone?: string };
  advocate: { _id?: string; barCouncilNumber?: string; wallet?: { balance: number; totalEarned: number } };
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',   color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  approved: { label: 'Approved',  color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  paid:     { label: 'Paid ✓',   color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  rejected: { label: 'Rejected',  color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
};

export default function Withdrawals() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [stats, setStats] = useState({ pendingCount: 0, paidCount: 0, rejectedCount: 0, requestsToday: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'paid' | 'rejected' | 'all'>('pending');
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [txnId, setTxnId] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/withdrawals', { params: { status: activeTab, page, limit: 20 } });
      setWithdrawals(data.data || []);
      if (data.pendingTotal !== undefined) setPendingTotal(data.pendingTotal);
      if (data.stats) setStats(data.stats);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const handleProcess = async (action: 'approve' | 'reject') => {
    if (!selected) return;
    if (action === 'approve' && !txnId.trim()) return alert('Transaction ID is required to approve.');
    setActionLoading(true);
    try {
      await api.patch(`/admin/withdrawals/${selected._id}/process`, {
        action,
        transactionId: txnId.trim() || undefined,
        adminNote: adminNote.trim() || undefined,
      });
      setSelected(null);
      setTxnId('');
      setAdminNote('');
      fetchWithdrawals();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const filteredWithdrawals = withdrawals.filter(w => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        w.advocateUser?.name?.toLowerCase().includes(q) ||
        w.advocateUser?.email?.toLowerCase().includes(q) ||
        w.transactionId?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (dateRange !== 'all') {
      const wDate = new Date(w.createdAt);
      const now = new Date();
      if (dateRange === 'today' && wDate.toDateString() !== now.toDateString()) return false;
      if (dateRange === '7days' && (now.getTime() - wDate.getTime()) > 7 * 24 * 60 * 60 * 1000) return false;
      if (dateRange === '30days' && (now.getTime() - wDate.getTime()) > 30 * 24 * 60 * 60 * 1000) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    if (filteredWithdrawals.length === 0) return alert('No data to export');
    const headers = ['Advocate Name', 'Email', 'Amount', 'Status', 'Requested At', 'Bank Name', 'Account Number', 'IFSC', 'UPI ID', 'Transaction ID'];
    const rows = filteredWithdrawals.map(w => [
      `"${w.advocateUser?.name || 'N/A'}"`,
      w.advocateUser?.email || 'N/A',
      w.amount,
      w.status,
      new Date(w.createdAt).toLocaleDateString('en-IN'),
      `"${w.bankDetails?.bankName || 'N/A'}"`,
      `"'${w.bankDetails?.accountNumber || ''}"`,
      w.bankDetails?.ifscCode || 'N/A',
      w.bankDetails?.upiId || 'N/A',
      w.transactionId || 'N/A'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Withdrawals_Export_${new Date().toLocaleDateString('en-IN')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Withdrawal Requests</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage advocate payout requests</p>
        </div>
        <button onClick={fetchWithdrawals}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Payout', value: `₹${pendingTotal.toLocaleString('en-IN')}`, color: 'from-amber-500 to-orange-500', icon: <Clock className="w-5 h-5 text-white" /> },
          { label: 'Requests Today', value: stats.requestsToday, color: 'from-blue-500 to-indigo-500', icon: <Wallet className="w-5 h-5 text-white" /> },
          { label: 'Pending Count', value: stats.pendingCount, color: 'from-rose-500 to-pink-500', icon: <TrendingUp className="w-5 h-5 text-white" /> },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center flex-shrink-0`}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-0 border-b border-slate-100">
          <div className="flex gap-1">
            {(['pending', 'paid', 'rejected', 'all'] as const).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); }}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-amber-500 text-amber-700 bg-amber-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by advocate, email, or TXN ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as any)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition-colors">
            <DownloadIcon className="w-4 h-4" /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {['Advocate', 'Amount', 'Bank / UPI', 'Status', 'Requested', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading...</td></tr>
              ) : filteredWithdrawals.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">No withdrawal requests found.</td></tr>
              ) : filteredWithdrawals.map(w => {
                const cfg = STATUS_CONFIG[w.status];
                return (
                  <motion.tr key={w._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900 text-sm">{w.advocateUser?.name}</span>
                      <p className="text-xs text-slate-400">{w.advocateUser?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-lg font-bold text-slate-900">₹{w.amount.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-700">{w.bankDetails?.bankName}</p>
                      <p className="text-xs text-slate-400 font-mono">
                        ••••{w.bankDetails?.accountNumber?.slice(-4)} · {w.bankDetails?.ifscCode}
                      </p>
                      {w.bankDetails?.upiId && <p className="text-xs text-indigo-500">{w.bankDetails.upiId}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.color} ${cfg.bg}`}>
                        {cfg.label}
                      </span>
                      {w.transactionId && (
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">TXN: {w.transactionId}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(w.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setSelected(w); setTxnId(w.transactionId || ''); setAdminNote(w.adminNote || ''); }}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                          w.status === 'pending'
                            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {w.status === 'pending' ? 'Process' : 'View Details'}
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="p-1.5 border rounded-lg disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(value => value + 1)} className="p-1.5 border rounded-lg disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Process/View Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => e.target === e.currentTarget && setSelected(null)}>
            <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>

              <div className={`p-6 rounded-t-2xl ${
                selected.status === 'pending' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                selected.status === 'rejected' ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                'bg-gradient-to-r from-emerald-500 to-teal-500'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {selected.status === 'pending' ? 'Process Withdrawal' : 'Withdrawal Details'}
                    </h2>
                    <p className="text-white/80 text-sm">{selected.advocateUser?.name} · ₹{selected.amount.toLocaleString('en-IN')}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white text-2xl">×</button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Wallet Summary */}
                {selected.advocate?.wallet && (
                  <div className="flex gap-3">
                    <div className="flex-1 bg-amber-50 rounded-xl p-3 border border-amber-100">
                      <p className="text-[10px] font-bold text-amber-600 uppercase">Current Balance</p>
                      <p className="text-lg font-bold text-amber-900">₹{(selected.advocate.wallet.balance || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Total Earned</p>
                      <p className="text-lg font-bold text-slate-900">₹{(selected.advocate.wallet.totalEarned || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                )}

                {/* Bank Details */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Bank Details</p>
                  {[
                    { label: 'Account Holder', value: selected.bankDetails?.accountHolder },
                    { label: 'Account Number', value: selected.bankDetails?.accountNumber },
                    { label: 'IFSC Code', value: selected.bankDetails?.ifscCode },
                    { label: 'Bank Name', value: selected.bankDetails?.bankName },
                    ...(selected.bankDetails?.upiId ? [{ label: 'UPI ID', value: selected.bankDetails.upiId }] : []),
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 font-mono">{item.value}</span>
                        <button onClick={() => copyText(item.value || '', item.label)}
                          className="text-slate-400 hover:text-amber-600 transition-colors">
                          {copied === item.label ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {selected.status === 'pending' ? (
                  <>
                    {/* Transaction ID (required for approve) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Transaction ID <span className="text-red-400">*</span>
                        <span className="text-slate-400 font-normal ml-1">(Bank ref / UTR number — required to approve)</span>
                      </label>
                      <input
                        value={txnId}
                        onChange={e => setTxnId(e.target.value)}
                        placeholder="e.g. UTR123456789 or TXN12345"
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 font-mono"
                      />
                    </div>

                    {/* Admin note */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Note to Advocate <span className="text-slate-400 font-normal">(optional)</span>
                      </label>
                      <textarea
                        value={adminNote}
                        onChange={e => setAdminNote(e.target.value)}
                        placeholder="e.g. Transferred via NEFT on 8 Aug 2026..."
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => handleProcess('approve')}
                        disabled={actionLoading || !txnId.trim()}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {actionLoading ? 'Processing...' : 'Approve & Mark Paid'}
                      </button>
                      <button
                        onClick={() => handleProcess('reject')}
                        disabled={actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 text-center">
                      On approve: amount marked as paid, advocate notified. On reject: amount returned to wallet.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                        <p className={`text-sm font-semibold mt-1 capitalize ${
                          selected.status === 'rejected' ? 'text-red-600' : 'text-emerald-600'
                        }`}>{selected.status}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Processed On</p>
                        <p className="text-sm font-semibold text-slate-700 mt-1">
                          {selected.processedAt ? new Date(selected.processedAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    {selected.transactionId && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Transaction ID / UTR</label>
                        <div className="px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700">
                          {selected.transactionId}
                        </div>
                      </div>
                    )}
                    {selected.adminNote && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Admin Note</label>
                        <div className="px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 whitespace-pre-wrap">
                          {selected.adminNote}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
