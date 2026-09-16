import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, X, RefreshCw, Eye, Trash2,
  ChevronLeft, ChevronRight, List, LayoutGrid, User, Calendar,
  CheckCircle2, AlertCircle, RotateCcw, XCircle, Clock,
  Paperclip, Upload, Shield, Sparkles, Download, ExternalLink,
  MessageSquare, AlertTriangle, CheckCircle, Send,
} from 'lucide-react';
import api from '../lib/api';

interface LegalNotice {
  _id: string;
  caseNumber?: string;
  client?: { name: string; email: string; phone?: string; avatar?: string };
  advocate?: { _id?: string; user?: { name: string; avatar?: string }; specializations?: string[] } | null;
  status: 'open' | 'pending' | 'in_progress' | 'resolved' | 'closed';
  issueDescription?: string;
  issueCategory?: string;
  consultationMode?: string;
  payment?: { amount?: number; status?: string };
  amount?: number;
  documents?: Array<{ url: string; name?: string; type?: string; uploadedAt?: string }>;
  adminDocuments?: Array<{ url: string; name?: string; type?: string; uploadedAt?: string }>;
  advocateDocuments?: Array<{ url: string; name?: string; type?: string; uploadedAt?: string }>;
  aiDraft?: string | null;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface AdvocateOption {
  _id: string;
  user?: { name: string; email: string; avatar?: string };
  specializations?: string[];
  location?: { address?: { city?: string } };
}

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: 'text-blue-700 bg-blue-50 border-blue-200',      icon: <AlertCircle className="w-3 h-3" />,   dot: 'bg-blue-500' },
  pending:     { label: 'Pending',     color: 'text-amber-700 bg-amber-50 border-amber-200',    icon: <Clock className="w-3 h-3" />,         dot: 'bg-amber-500' },
  in_progress: { label: 'In Progress', color: 'text-violet-700 bg-violet-50 border-violet-200', icon: <RotateCcw className="w-3 h-3" />,     dot: 'bg-violet-500' },
  resolved:    { label: 'Resolved',    color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" />, dot: 'bg-emerald-500' },
  closed:      { label: 'Closed',      color: 'text-gray-700 bg-gray-100 border-gray-200',      icon: <XCircle className="w-3 h-3" />,       dot: 'bg-gray-400' },
};

const KANBAN_COLS: (keyof typeof STATUS_CONFIG)[] = ['open', 'pending', 'in_progress', 'resolved', 'closed'];

const fixCloudinaryPdfUrl = (url?: string) => {
  if (!url) return '#';
  if (url.includes('/image/upload/') && !url.includes('/fl_attachment/') && url.toLowerCase().includes('.pdf')) {
    return url.replace('/image/upload/', '/image/upload/fl_attachment/');
  }
  return url;
};

export default function LegalNotices() {
  const [notices, setNotices] = useState<LegalNotice[]>([]);
  const [advocatesList, setAdvocatesList] = useState<AdvocateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals
  const [selectedNotice, setSelectedNotice] = useState<LegalNotice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadModalNotice, setUploadModalNotice] = useState<LegalNotice | null>(null);
  const [uploadSide, setUploadSide] = useState<'admin' | 'advocate'>('admin');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // AI Draft
  const [aiDraftNotice, setAiDraftNotice] = useState<LegalNotice | null>(null);
  const [aiDraftText, setAiDraftText] = useState('');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiInstructions, setAiInstructions] = useState('');

  const LIMIT = 15;

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await api.get('/admin/legal-notices', { params });
      setNotices(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.pages || 1);
    } catch { setNotices([]); }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  const fetchAdvocates = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/advocates?limit=100');
      setAdvocatesList(data.data || []);
    } catch (e) { console.warn('Failed to fetch advocates:', e); }
  }, []);

  useEffect(() => { fetchNotices(); fetchAdvocates(); }, [fetchNotices, fetchAdvocates]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.put(`/admin/legal-notices/${id}/status`, { status: newStatus });
      fetchNotices();
      if (selectedNotice?._id === id) {
        setSelectedNotice(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
    } catch (e: any) { alert('Failed to update status: ' + (e?.response?.data?.message || e.message)); }
  };

  const handleAssignAdvocate = async (id: string, advocateId: string) => {
    try {
      await api.post(`/admin/legal-notices/${id}/assign`, { advocateId });
      fetchNotices();
      alert('✅ Advocate assigned successfully!');
    } catch (e: any) { alert('Assignment failed: ' + (e?.response?.data?.message || e.message)); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/admin/legal-notices/${deleteId}`);
      setDeleteId(null);
      fetchNotices();
    } catch (e: any) { alert('Delete failed: ' + (e?.response?.data?.message || e.message)); }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadModalNotice) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', uploadFile);
      formData.append('side', uploadSide);
      await api.post(`/admin/legal-notices/${uploadModalNotice._id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadModalNotice(null);
      setUploadFile(null);
      fetchNotices();
      alert('✅ Document uploaded successfully!');
    } catch (e: any) { alert('Upload failed: ' + (e?.response?.data?.message || e.message)); }
    finally { setIsUploading(false); }
  };

  const handleGenerateAIDraft = async () => {
    if (!aiDraftNotice) return;
    setAiDraftLoading(true);
    try {
      const { data } = await api.post(`/admin/legal-notices/${aiDraftNotice._id}/ai-draft`, {
        instructions: aiInstructions,
      });
      setAiDraftText(data.data?.draft || '');
      fetchNotices();
    } catch (e: any) { alert('AI draft generation failed: ' + (e?.response?.data?.message || e.message)); }
    finally { setAiDraftLoading(false); }
  };

  const filteredNotices = notices.filter(n => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.client?.name?.toLowerCase().includes(q) ||
      n.client?.email?.toLowerCase().includes(q) ||
      n.caseNumber?.toLowerCase().includes(q) ||
      n.issueDescription?.toLowerCase().includes(q)
    );
  });

  const kanbanCols = KANBAN_COLS.reduce((acc, col) => {
    acc[col] = filteredNotices.filter(n => n.status === col);
    return acc;
  }, {} as Record<string, LegalNotice[]>);

  const NoticeCard = ({ n }: { n: LegalNotice }) => {
    const sc = STATUS_CONFIG[n.status] || STATUS_CONFIG.open;
    const userDocs = n.documents?.length || 0;
    const adminDocs = (n.adminDocuments?.length || 0) + (n.advocateDocuments?.length || 0);
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
        onClick={() => setSelectedNotice(n)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">
              {n.client?.name?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{n.client?.name || 'Unknown Client'}</p>
              <p className="text-[11px] text-gray-400">{n.caseNumber}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.color}`}>
            {sc.icon}{sc.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{n.issueDescription || 'No description'}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {userDocs > 0 && (
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 flex items-center gap-1">
                <Paperclip className="w-2.5 h-2.5" />{userDocs} client doc{userDocs > 1 ? 's' : ''}
              </span>
            )}
            {adminDocs > 0 && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" />{adminDocs} admin doc{adminDocs > 1 ? 's' : ''}
              </span>
            )}
            {n.aiDraft && (
              <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 rounded px-1.5 py-0.5 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />AI Draft
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400">{new Date(n.createdAt).toLocaleDateString('en-IN')}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-600" /> Legal Notices
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage legal notice requests & AI-assisted responses</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchNotices} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setView(v => v === 'list' ? 'kanban' : 'list')} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            {view === 'list' ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {KANBAN_COLS.map(col => {
          const sc = STATUS_CONFIG[col];
          const count = notices.filter(n => n.status === col).length;
          return (
            <button
              key={col}
              onClick={() => setStatusFilter(statusFilter === col ? '' : col)}
              className={`rounded-xl border p-3 text-left transition-all ${statusFilter === col ? 'ring-2 ring-amber-500 border-amber-400 bg-amber-50/30' : 'border-gray-100 bg-white hover:border-amber-200'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                <span className="text-lg font-bold text-gray-900">{count}</span>
              </div>
              <p className="text-xs font-medium text-gray-600">{sc.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by client, case #, or issue..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>
        {(statusFilter || search) && (
          <button onClick={() => { setStatusFilter(''); setSearch(''); }} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-2">
            <X className="w-3 h-3" />Clear filters
          </button>
        )}
        <span className="text-sm text-gray-500 ml-auto">{total} total notices</span>
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLS.map(col => {
            const sc = STATUS_CONFIG[col];
            return (
              <div key={col} className="min-w-[280px] max-w-[280px]">
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border border-b-0 ${sc.color}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold">{sc.icon}{sc.label}</div>
                  <span className="text-xs font-bold bg-white/60 rounded-full px-2 py-0.5">{kanbanCols[col]?.length}</span>
                </div>
                <div className="border border-gray-100 rounded-b-xl bg-gray-50 p-2 space-y-2 min-h-[200px]">
                  {kanbanCols[col]?.map(n => <NoticeCard key={n._id} n={n} />)}
                  {kanbanCols[col]?.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-400">No notices</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />Loading...
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No legal notices found</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    {['Case #', 'Client', 'Issue', 'Advocate', 'Documents', 'Status', 'Amount', 'Created', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredNotices.map(n => {
                    const sc = STATUS_CONFIG[n.status] || STATUS_CONFIG.open;
                    const userDocs = n.documents?.length || 0;
                    const adminDocs = (n.adminDocuments?.length || 0) + (n.advocateDocuments?.length || 0);
                    return (
                      <tr key={n._id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-amber-700 font-bold whitespace-nowrap">{n.caseNumber}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs shrink-0">
                              {n.client?.name?.charAt(0)?.toUpperCase() || 'C'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 leading-tight">{n.client?.name || '—'}</p>
                              <p className="text-[10px] text-gray-400">{n.client?.phone || n.client?.email || ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <p className="text-xs text-gray-600 line-clamp-2">{n.issueDescription || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          {n.advocate ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                              <CheckCircle className="w-3 h-3" />{n.advocate.user?.name || 'Assigned'}
                            </span>
                          ) : (
                            <button
                              onClick={() => setSelectedNotice(n)}
                              className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5 font-medium hover:bg-orange-100 transition"
                            >
                              + Assign
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {userDocs > 0 && (
                              <span className="text-[10px] text-blue-700 flex items-center gap-1">
                                <User className="w-2.5 h-2.5" />{userDocs} user doc{userDocs > 1 ? 's' : ''}
                              </span>
                            )}
                            {adminDocs > 0 && (
                              <span className="text-[10px] text-emerald-700 flex items-center gap-1">
                                <Shield className="w-2.5 h-2.5" />{adminDocs} admin doc{adminDocs > 1 ? 's' : ''}
                              </span>
                            )}
                            {n.aiDraft && (
                              <span className="text-[10px] text-purple-700 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" />AI Draft
                              </span>
                            )}
                            {userDocs === 0 && adminDocs === 0 && !n.aiDraft && (
                              <span className="text-[10px] text-gray-400">No docs</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.color}`}>
                            {sc.icon}{sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700">
                          {n.payment?.amount || n.amount ? `₹${(n.payment?.amount || n.amount)?.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {new Date(n.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelectedNotice(n)} className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition" title="View Details">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setAiDraftNotice(n); setAiDraftText(n.aiDraft || ''); setAiInstructions(''); }} className="p-1.5 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition" title="AI Draft">
                              <Sparkles className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setUploadModalNotice(n); setUploadSide('admin'); setUploadFile(null); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition" title="Upload Document">
                              <Upload className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteId(n._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border disabled:opacity-40 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border disabled:opacity-40 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Detail Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedNotice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setSelectedNotice(null)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Legal Notice Detail</h2>
                  <p className="text-xs text-amber-600 font-mono font-bold">{selectedNotice.caseNumber}</p>
                </div>
                <button onClick={() => setSelectedNotice(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 space-y-6">
                {/* Client Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1"><User className="w-3 h-3" />Client</p>
                    <p className="font-semibold text-gray-900">{selectedNotice.client?.name || '—'}</p>
                    <p className="text-sm text-gray-500">{selectedNotice.client?.email || ''}</p>
                    <p className="text-sm text-gray-500">{selectedNotice.client?.phone || ''}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1"><Calendar className="w-3 h-3" />Details</p>
                    <p className="text-sm"><span className="text-gray-500">Mode:</span> <span className="font-medium capitalize">{selectedNotice.consultationMode || '—'}</span></p>
                    <p className="text-sm"><span className="text-gray-500">Amount:</span> <span className="font-medium">₹{selectedNotice.payment?.amount || selectedNotice.amount || 0}</span></p>
                    <p className="text-sm"><span className="text-gray-500">Created:</span> <span className="font-medium">{new Date(selectedNotice.createdAt).toLocaleDateString('en-IN')}</span></p>
                  </div>
                </div>

                {/* Issue */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Issue Description</p>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
                    {selectedNotice.issueDescription || 'No description provided.'}
                  </div>
                </div>

                {/* Status Update */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(STATUS_CONFIG) as (keyof typeof STATUS_CONFIG)[]).map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(selectedNotice._id, s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${selectedNotice.status === s ? STATUS_CONFIG[s].color + ' ring-2 ring-offset-1' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                      >
                        {STATUS_CONFIG[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assign Advocate */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Assign Advocate</p>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      defaultValue={selectedNotice.advocate?._id || ''}
                      onChange={e => handleAssignAdvocate(selectedNotice._id, e.target.value)}
                    >
                      <option value="">— Select Advocate —</option>
                      {advocatesList.map(a => (
                        <option key={a._id} value={a._id}>{a.user?.name || 'Unknown'} {a.location?.address?.city ? `(${a.location.address.city})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  {selectedNotice.advocate && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Currently: {selectedNotice.advocate.user?.name}</p>
                  )}
                </div>

                {/* Client Documents */}
                {(selectedNotice.documents?.length || 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1"><User className="w-3 h-3" />Client Documents</p>
                    <div className="space-y-2">
                      {selectedNotice.documents?.map((doc, i) => (
                        <a key={i} href={fixCloudinaryPdfUrl(doc.url)} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition group">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700">{doc.name || `Document ${i + 1}`}</span>
                          </div>
                          <ExternalLink className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin/Advocate Documents */}
                {((selectedNotice.adminDocuments?.length || 0) + (selectedNotice.advocateDocuments?.length || 0)) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1"><Shield className="w-3 h-3" />Admin / Advocate Documents</p>
                    <div className="space-y-2">
                      {[...(selectedNotice.adminDocuments || []), ...(selectedNotice.advocateDocuments || [])].map((doc, i) => (
                        <a key={i} href={fixCloudinaryPdfUrl(doc.url)} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition group">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-medium text-emerald-700">{doc.name || `Document ${i + 1}`}</span>
                          </div>
                          <ExternalLink className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Draft Preview */}
                {selectedNotice.aiDraft && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3 text-purple-500" />AI Generated Draft</p>
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">{selectedNotice.aiDraft}</pre>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => { setAiDraftNotice(selectedNotice); setAiDraftText(selectedNotice.aiDraft || ''); setAiInstructions(''); setSelectedNotice(null); }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition">
                    <Sparkles className="w-4 h-4" />Generate AI Draft
                  </button>
                  <button onClick={() => { setUploadModalNotice(selectedNotice); setUploadSide('admin'); setUploadFile(null); setSelectedNotice(null); }}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition">
                    <Upload className="w-4 h-4" />Upload Document
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Draft Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {aiDraftNotice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setAiDraftNotice(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">AI Legal Notice Draft</h2>
                    <p className="text-xs text-gray-500">{aiDraftNotice.client?.name} · {aiDraftNotice.caseNumber}</p>
                  </div>
                </div>
                <button onClick={() => setAiDraftNotice(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">
                  <strong>Issue:</strong> {aiDraftNotice.issueDescription || 'No description'}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Additional Instructions (Optional)</label>
                  <textarea
                    value={aiInstructions}
                    onChange={e => setAiInstructions(e.target.value)}
                    placeholder="e.g. Include reference to Section 138 NI Act, mention court jurisdiction..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                <button
                  onClick={handleGenerateAIDraft}
                  disabled={aiDraftLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-60"
                >
                  {aiDraftLoading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />Generating with AI...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" />{aiDraftText ? 'Regenerate Draft' : 'Generate AI Draft'}</>
                  )}
                </button>

                {aiDraftText && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Generated Draft</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(aiDraftText)}
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />Copy to Clipboard
                      </button>
                    </div>
                    <div className="bg-gray-900 text-gray-100 rounded-xl p-4 max-h-80 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{aiDraftText}</pre>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">✅ Draft saved to this legal notice record. Advocate can view it in their case details.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Upload Document Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {uploadModalNotice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setUploadModalNotice(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Upload Document</h2>
                <button onClick={() => setUploadModalNotice(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex gap-2">
                  {(['admin', 'advocate'] as const).map(side => (
                    <button
                      key={side}
                      onClick={() => setUploadSide(side)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition capitalize ${uploadSide === side ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'}`}
                    >
                      {side === 'admin' ? '🛡️ Admin Doc' : '⚖️ Advocate Doc'}
                    </button>
                  ))}
                </div>
                <label className="block border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-amber-400 transition">
                  <input type="file" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                  {uploadFile ? (
                    <div>
                      <FileText className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700">{uploadFile.name}</p>
                      <p className="text-xs text-gray-400">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Click to select file</p>
                      <p className="text-xs text-gray-400">PDF, JPG, PNG supported</p>
                    </div>
                  )}
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setUploadModalNotice(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button onClick={handleUpload} disabled={!uploadFile || isUploading}
                    className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {isUploading ? <><RefreshCw className="w-4 h-4 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4" />Upload</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirm Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Legal Notice?</h3>
              <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
