import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard, Search, Download, RefreshCw, ChevronLeft, ChevronRight,
  TrendingUp, IndianRupee, CheckCircle2, Clock, XCircle, Filter
} from 'lucide-react';
import api from '../lib/api';

interface Payment {
  _id: string;
  client?: { name: string; email: string; avatar?: string; phone?: string };
  advocate?: { user?: { name: string; avatar?: string } };
  payment: {
    amount: number;
    status: string;
    paidAt?: string;
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
  };
  serviceType: string;
  consultationMode: string;
  createdAt: string;
}

const statusColor: Record<string, string> = {
  paid:    'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  failed:  'bg-red-50 text-red-600',
  refunded:'bg-blue-50 text-blue-700',
  not_required: 'bg-gray-50 text-gray-500',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

export default function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any>({});
  const LIMIT = 20;

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/admin/payment-history', { params });
      setPayments(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.pages || 1);
      setSummary(data.summary || {});
    } catch { setPayments([]); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const filtered = payments.filter(p =>
    !search ||
    p.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.client?.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.payment?.razorpayPaymentId?.includes(search)
  );

  const exportCSV = () => {
    const rows = [['Date', 'Client', 'Email', 'Advocate', 'Service', 'Amount', 'Status', 'Razorpay ID']];
    payments.forEach(p => rows.push([
      p.payment?.paidAt ? new Date(p.payment.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString(),
      p.client?.name || '—',
      p.client?.email || '—',
      p.advocate?.user?.name || '—',
      p.serviceType?.replace(/_/g, ' ') || '—',
      String(p.payment?.amount || 0),
      p.payment?.status || '—',
      p.payment?.razorpayPaymentId || '—',
    ]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `payment-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const statCards = [
    { label: 'Total Collected', value: fmt(summary.totalCollected || 0), sub: `${summary.totalBookings || 0} paid bookings`, icon: IndianRupee, color: 'from-teal-500 to-emerald-500', bg: 'bg-teal-50', tc: 'text-teal-600' },
    { label: 'Average Payment', value: fmt(summary.avgAmount || 0), sub: 'Per booking', icon: TrendingUp, color: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50', tc: 'text-blue-600' },
    { label: 'Paid', value: summary.paidCount || 0, sub: 'Successful transactions', icon: CheckCircle2, color: 'from-emerald-500 to-green-500', bg: 'bg-emerald-50', tc: 'text-emerald-600' },
    { label: 'Pending', value: summary.pendingCount || 0, sub: 'Awaiting payment', icon: Clock, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', tc: 'text-amber-600' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-teal-600" /> Payment History
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total payment records</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={fetchPayments} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-3`}>
              <c.icon className={`w-5 h-5 ${c.tc}`} />
            </div>
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, payment ID..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none">
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Loading payments...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No payment records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Date', 'Client', 'Advocate', 'Service', 'Amount', 'Status', 'Transaction ID'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <tr key={p._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {p.payment?.paidAt
                        ? new Date(p.payment.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-indigo-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {p.client?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{p.client?.name || '—'}</p>
                          <p className="text-xs text-gray-400">{p.client?.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.advocate?.user?.name || <span className="text-gray-300">Not assigned</span>}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold capitalize">
                        {p.serviceType?.replace(/_/g, ' ') || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900">{fmt(p.payment?.amount || 0)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor[p.payment?.status] || 'bg-gray-50 text-gray-500'}`}>
                        {p.payment?.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-400">
                        {p.payment?.razorpayPaymentId ? p.payment.razorpayPaymentId.slice(0, 18) + '…' : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} total</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
