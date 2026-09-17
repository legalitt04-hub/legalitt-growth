import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Search, X, RefreshCw, Download,
  Eye, Edit2, Trash2, ChevronLeft, ChevronRight,
  List, LayoutGrid, User, Calendar, FileText, Clock,
  CheckCircle2, AlertCircle, RotateCcw, XCircle,
  Paperclip, Upload, Shield, UserX, CheckCircle, AlertTriangle
} from 'lucide-react';
import api from '../lib/api';

interface PropertyResearch {
  _id: string;
  caseNumber?: string;
  title?: string;
  client?: { name: string; email: string; phone?: string };
  advocate?: { _id?: string; user?: { name: string; avatar?: string }; specializations?: string[] } | null;
  serviceType?: string;
  status: 'open' | 'pending' | 'in_progress' | 'closed' | 'resolved';
  priority?: 'low' | 'medium' | 'high';
  payment?: { amount?: number; status?: 'paid' | 'pending' | 'failed' | 'partial' };
  description?: string;
  notes?: string;
  documents?: Array<{ url: string; name?: string; type?: string; uploadedAt?: string }>;
  advocateDocuments?: Array<{ url: string; name?: string; type?: string; uploadedAt?: string }>;
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
  open:        { label: 'Open',        color: 'text-blue-700 bg-blue-50 border-blue-200',     icon: <AlertCircle className="w-3 h-3" />,  dot: 'bg-blue-500' },
  pending:     { label: 'Pending',     color: 'text-amber-700 bg-amber-50 border-amber-200',   icon: <Clock className="w-3 h-3" />,        dot: 'bg-amber-500' },
  in_progress: { label: 'In Progress', color: 'text-violet-700 bg-violet-50 border-violet-200',icon: <RotateCcw className="w-3 h-3" />,    dot: 'bg-violet-500' },
  closed:      { label: 'Closed',      color: 'text-gray-700 bg-gray-100 border-gray-200',     icon: <XCircle className="w-3 h-3" />,      dot: 'bg-gray-400' },
  resolved:    { label: 'Completed',   color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" />, dot: 'bg-emerald-500' },
};

const KANBAN_COLS: (keyof typeof STATUS_CONFIG)[] = ['open', 'pending', 'in_progress', 'resolved', 'closed'];

const PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: 'text-gray-500 bg-gray-50 border-gray-200' },
  medium: { label: 'Medium', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  high:   { label: 'High',   color: 'text-red-700 bg-red-50 border-red-200' },
};

const SERVICE_TYPES = [
  'legal_notice', 'legal_advice', 'fir_draft', 'property_dispute',
  'cheque_bounce', 'court_representation', 'general_consultation'
];

const fixCloudinaryPdfUrl = (url?: string) => {
  if (!url) return '#';
  if (url.includes('/image/upload/') && !url.includes('/fl_attachment/') && url.toLowerCase().includes('.pdf')) {
    return url.replace('/image/upload/', '/image/upload/fl_attachment/');
  }
  return url;
};

export default function PropertyResearch() {
  const [cases, setCases] = useState<PropertyResearch[]>([]);
  const [advocatesList, setAdvocatesList] = useState<AdvocateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals
  const [selectedCase, setSelectedCase] = useState<PropertyResearch | null>(null);
  const [editCase, setEditCase] = useState<PropertyResearch | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadModalCase, setUploadModalCase] = useState<PropertyResearch | null>(null);
  const [uploadSide, setUploadSide] = useState<'client' | 'advocate'>('client');

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const LIMIT = 15;

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (statusFilter) params.status = statusFilter;
      if (serviceFilter) params.serviceType = serviceFilter;
      if (search) params.search = search;
      const { data } = await api.get('/admin/property-research', { params });
      setCases(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.pages || 1);
    } catch { setCases([]); }
    finally { setLoading(false); }
  }, [page, statusFilter, serviceFilter, search]);

  const fetchAdvocates = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/advocates?limit=100');
      setAdvocatesList(data.data || []);
    } catch (e) {
      console.warn('Failed to fetch advocates dropdown:', e);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    fetchAdvocates();
  }, [fetchCases, fetchAdvocates]);

  const handleSaveEdit = async () => {
    if (!editCase) return;
    try {
      await api.put(`/admin/property-research/${editCase._id}/status`, {
        status: editCase.status,
        notes: editCase.notes,
        priority: editCase.priority,
        advocateId: editCase.advocate?._id || null,
        paymentStatus: editCase.payment?.status,
      });
      setEditCase(null);
      fetchCases();
    } catch { alert('Failed to update case.'); }
  };

  const handleUploadCaseDoc = async () => {
    if (!uploadModalCase || !uploadFile) return alert('Please select a file to upload.');
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', uploadFile);
      formData.append('bookingId', uploadModalCase._id);
      formData.append('side', uploadSide);

      await api.post(`/admin/property-research/${uploadModalCase._id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      alert(`✔ ${uploadSide === 'advocate' ? 'Advocate Document' : 'Client Document'} attached successfully!`);
      setUploadFile(null);
      setUploadModalCase(null);
      fetchCases();
    } catch (err: any) {
      alert(`Upload failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/property-research/${id}`);
      setDeleteId(null);
      fetchCases();
    } catch { alert('Delete failed.'); }
  };

  const exportCSV = () => {
    const rows = [['Case #', 'Title', 'Client Name', 'Advocate Status', 'Advocate Name', 'User Docs', 'Adv Docs', 'Status', 'Amount', 'Created']];
    cases.forEach(c => rows.push([
      c.caseNumber || c._id.slice(-6),
      `"${c.title || c.serviceType || '—'}"`,
      (c.client || (c as any).user)?.name || '—',
      c.advocate?.user?.name ? 'ASSIGNED' : 'NOT ASSIGNED',
      c.advocate?.user?.name || 'Unassigned',
      String(c.documents?.length || 0),
      String(c.advocateDocuments?.length || 0),
      c.status,
      String(c.payment?.amount || 0),
      new Date(c.createdAt).toLocaleDateString(),
    ]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cases.csv'; a.click();
  };

  // Filtered list by assignment status
  const filteredCases = cases.filter(c => {
    if (assignmentFilter === 'assigned' && !c.advocate?.user?.name) return false;
    if (assignmentFilter === 'unassigned' && c.advocate?.user?.name) return false;
    return true;
  });

  const kanbanData = KANBAN_COLS.reduce<Record<string, PropertyResearch[]>>((acc, col) => {
    acc[col] = filteredCases.filter(c => c.status === col);
    return acc;
  }, {});

  const CaseCard = ({ c }: { c: PropertyResearch }) => {
    const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.open;
    const isAssigned = !!c.advocate?.user?.name;
    const userDocsCount = c.documents?.length || 0;
    const advDocsCount = c.advocateDocuments?.length || 0;

    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all space-y-3">
        <div className="flex items-start justify-between">
          <span className="text-xs text-gray-400 font-mono font-bold">#{(c.caseNumber || c._id.slice(-6)).toUpperCase()}</span>
          {isAssigned ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3 h-3 text-emerald-600" /> Assigned
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-3 h-3 text-amber-600" /> NOT ASSIGNED
            </span>
          )}
        </div>

        <div>
          <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{c.title || c.serviceType || 'Legal Case'}</p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <User className="w-3 h-3 text-teal-600" /> Client: <strong className="text-gray-800">{(c.client || (c as any).user)?.name || '—'}</strong>
          </p>
        </div>

        {/* Advocate Assignment Banner */}
        <div className={`p-2.5 rounded-xl border text-xs ${isAssigned ? 'bg-indigo-50/70 border-indigo-100 text-indigo-950' : 'bg-amber-50/80 border-amber-200 text-amber-900'}`}>
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1 text-[11px]">
              <Shield className="w-3.5 h-3.5" /> {isAssigned ? `Adv. ${c.advocate?.user?.name}` : 'No Advocate Assigned'}
            </span>
            {!isAssigned && (
              <button
                onClick={() => setEditCase({ ...c })}
                className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 shadow-sm"
              >
                + Assign
              </button>
            )}
          </div>
        </div>

        {/* Uploaded Documents List Directly On Card */}
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Uploaded Documents:</p>
          
          {/* User Docs */}
          {userDocsCount > 0 ? (
            <div className="flex flex-wrap gap-1">
              {c.documents?.map((d: any, i: number) => (
                <a key={i} href={fixCloudinaryPdfUrl(d.url)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md border border-teal-200 hover:bg-teal-100">
                  <FileText className="w-3 h-3" /> 👤 {d.name?.substring(0, 14) || `User Doc ${i + 1}`}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">👤 No user docs uploaded</p>
          )}

          {/* Advocate Docs */}
          {advDocsCount > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {c.advocateDocuments?.map((d: any, i: number) => (
                <a key={i} href={fixCloudinaryPdfUrl(d.url)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 hover:bg-indigo-100">
                  <FileText className="w-3 h-3" /> ⚖️ {d.name?.substring(0, 14) || `Adv Draft ${i + 1}`}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">⚖️ No advocate docs uploaded</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold border px-2.5 py-0.5 rounded-full ${sc.color}`}>
            {sc.icon} {sc.label}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setSelectedCase(c)} title="View Case Details" className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"><Eye className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditCase({ ...c })} title="Edit Status & Assign Advocate" className="p-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100"><Edit2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => setUploadModalCase(c)} title="Upload Document" className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100"><Paperclip className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-teal-600" /> Case & Legal Notice Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total registered cases in database</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <button onClick={() => setView('list')} className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-white shadow text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}><List className="w-4 h-4" /></button>
            <button onClick={() => setView('kanban')} className={`p-2 rounded-lg transition-colors ${view === 'kanban' ? 'bg-white shadow text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid className="w-4 h-4" /></button>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50"><Download className="w-4 h-4" /> Export</button>
          <button onClick={fetchCases} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Status Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {KANBAN_COLS.map(col => {
          const sc = STATUS_CONFIG[col];
          const count = cases.filter(c => c.status === col).length;
          return (
            <button
              key={col}
              onClick={() => setStatusFilter(statusFilter === col ? '' : col)}
              className={`bg-white rounded-2xl border p-3.5 text-center shadow-sm hover:shadow-md transition-all ${
                statusFilter === col ? 'ring-2 ring-teal-500 border-teal-500 bg-teal-50/20' : 'border-gray-100'
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${sc.dot} mx-auto mb-1.5`} />
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs font-medium text-gray-500 mt-0.5">{sc.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by case #, client name, advocate name..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
          />
        </div>

        {/* Advocate Assignment Filter */}
        <select
          value={assignmentFilter}
          onChange={e => setAssignmentFilter(e.target.value as any)}
          className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold text-gray-700"
        >
          <option value="all">All Advocate Statuses</option>
          <option value="assigned">✅ Assigned Advocates Only</option>
          <option value="unassigned">⚠️ Unassigned Advocates Only</option>
        </select>

        {/* Service Type Filter */}
        <select
          value={serviceFilter}
          onChange={e => { setServiceFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-gray-700 capitalize"
        >
          <option value="">All Services</option>
          {SERVICE_TYPES.map(st => (
            <option key={st} value={st}>{st.replace(/_/g, ' ').toUpperCase()}</option>
          ))}
        </select>

        {(statusFilter || serviceFilter || assignmentFilter !== 'all' || search) && (
          <button
            onClick={() => { setStatusFilter(''); setServiceFilter(''); setAssignmentFilter('all'); setSearch(''); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-200 hover:bg-red-100"
          >
            <X className="w-3.5 h-3.5" /> Clear Filters
          </button>
        )}
      </div>

      {/* KANBAN VIEW */}
      {view === 'kanban' && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {KANBAN_COLS.map(col => {
            const sc = STATUS_CONFIG[col];
            const colCases = kanbanData[col] || [];
            return (
              <div key={col} className="bg-gray-50/70 rounded-2xl p-4 min-h-[240px] border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-2.5 h-2.5 rounded-full ${sc.dot}`} />
                  <h3 className="font-bold text-gray-700 text-sm">{sc.label}</h3>
                  <span className="ml-auto text-xs font-bold text-gray-500 bg-white px-2.5 py-0.5 rounded-full border border-gray-200">{colCases.length}</span>
                </div>
                <div className="space-y-3">
                  {colCases.length === 0 && <p className="text-xs text-gray-400 text-center py-8">No cases in this column</p>}
                  {colCases.map(c => <CaseCard key={c._id} c={c} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 animate-pulse font-medium">Loading case management records...</div>
          ) : filteredCases.length === 0 ? (
            <div className="p-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No cases found matching criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['Case #', 'Title & Client', 'Advocate Assignment', 'Uploaded Documents', 'Status', 'Amount', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCases.map(c => {
                    const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.open;
                    const isAssigned = !!c.advocate?.user?.name;
                    return (
                      <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5 text-xs font-mono font-bold text-gray-600">
                          #{(c.caseNumber || c._id.slice(-6)).toUpperCase()}
                        </td>

                        {/* Title & Client */}
                        <td className="px-4 py-3.5 max-w-[200px]">
                          <p className="font-bold text-gray-900 truncate">{c.title || c.serviceType || '—'}</p>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <User className="w-3 h-3 text-teal-600" /> {(c.client || (c as any).user)?.name || '—'} ({(c.client || (c as any).user)?.phone || (c.client || (c as any).user)?.email || ''})
                          </p>
                        </td>

                        {/* Advocate Assignment Status */}
                        <td className="px-4 py-3.5 text-xs">
                          {isAssigned ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 font-bold">
                              <Shield size={13} className="text-emerald-600" /> Adv. {c.advocate?.user?.name}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 font-bold">
                              <AlertTriangle size={13} className="text-amber-600" /> NOT ASSIGNED
                              <button
                                onClick={() => setEditCase({ ...c })}
                                className="ml-1 px-2 py-0.5 bg-amber-600 text-white rounded text-[10px] font-extrabold hover:bg-amber-700"
                              >
                                Assign
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Uploaded Documents directly in table */}
                        <td className="px-4 py-3.5 text-xs max-w-[240px]">
                          <div className="space-y-1">
                            {/* User Docs */}
                            {c.documents && c.documents.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {c.documents.map((d, i) => (
                                  <a key={i} href={fixCloudinaryPdfUrl(d.url)} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-teal-50 text-teal-700 rounded border border-teal-200 hover:bg-teal-100">
                                    <FileText size={10} /> 👤 {d.name?.substring(0, 12) || `User ${i + 1}`}
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">👤 No user docs</span>
                            )}

                            {/* Adv Docs */}
                            {c.advocateDocuments && c.advocateDocuments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {c.advocateDocuments.map((d, i) => (
                                  <a key={i} href={fixCloudinaryPdfUrl(d.url)} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 hover:bg-indigo-100">
                                    <FileText size={10} /> ⚖️ {d.name?.substring(0, 12) || `Adv ${i + 1}`}
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic"> | ⚖️ No adv docs</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${sc.color}`}>
                            {sc.icon} {sc.label}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-xs font-bold text-emerald-700">
                          ₹{c.payment?.amount || 0}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-gray-400 font-mono">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelectedCase(c)} title="View Full Details" className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditCase({ ...c })} title="Assign / Edit Advocate" className="p-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setUploadModalCase(c)} title="Upload Document" className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100"><Upload className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteId(c._id)} title="Delete Record" className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
      )}

      {/* ── VIEW CASE DETAILS MODAL ── */}
      <AnimatePresence>
        {selectedCase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <div>
                  <span className="text-xs text-teal-600 font-mono font-bold">#{(selectedCase.caseNumber || selectedCase._id.slice(-6)).toUpperCase()}</span>
                  <h3 className="text-lg font-bold text-gray-900">{selectedCase.title || 'Case Details'}</h3>
                </div>
                <button onClick={() => setSelectedCase(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-gray-100">
                  <div>
                    <span className="text-xs text-gray-500 font-medium">Client Info</span>
                    <p className="font-bold text-gray-900">{selectedCase.client?.name || '—'}</p>
                    <p className="text-xs text-gray-500">{selectedCase.client?.phone || selectedCase.client?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 font-medium">Advocate Assignment</span>
                    {selectedCase.advocate?.user?.name ? (
                      <p className="font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                        <CheckCircle size={14} /> Adv. {selectedCase.advocate.user.name}
                      </p>
                    ) : (
                      <p className="font-bold text-amber-700 flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={14} /> NOT ASSIGNED
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Status', value: STATUS_CONFIG[selectedCase.status]?.label },
                    { label: 'Service Type', value: selectedCase.serviceType?.replace(/_/g, ' ').toUpperCase() || '—' },
                    { label: 'Amount', value: `₹${selectedCase.payment?.amount || 0}` },
                    { label: 'Created At', value: new Date(selectedCase.createdAt).toLocaleString() },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-500 font-medium">{label}</span>
                      <span className="font-bold text-gray-800 text-right">{value}</span>
                    </div>
                  ))}
                </div>

                {selectedCase.description && (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-700 mb-1">Issue Description</p>
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{selectedCase.description}</p>
                  </div>
                )}

                {/* Documents Shared Between Advocate & Client */}
                <div className="space-y-4">
                  {/* Client / User Documents */}
                  <div className="bg-teal-50/60 border border-teal-100 rounded-2xl p-4">
                    <p className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Paperclip size={13} className="text-teal-600" />
                      Client Documents ({selectedCase.documents?.length || 0})
                    </p>
                    {selectedCase.documents && selectedCase.documents.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedCase.documents.map((doc, i) => (
                          <a key={i} href={fixCloudinaryPdfUrl(doc.url)} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 bg-white text-teal-700 rounded-xl text-xs font-bold hover:bg-teal-50 border border-teal-200 shadow-sm transition-all">
                            <FileText size={12} />
                            <div>
                              <p>{doc.name || `Client Doc ${i + 1}`}</p>
                              {doc.uploadedAt && <p className="text-[10px] text-gray-400 font-normal">{new Date(doc.uploadedAt).toLocaleDateString()}</p>}
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No client documents uploaded yet</p>
                    )}
                  </div>

                  {/* Advocate Documents */}
                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4">
                    <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Shield size={13} className="text-indigo-600" />
                      Advocate Documents / Drafts ({selectedCase.advocateDocuments?.length || 0})
                    </p>
                    {selectedCase.advocateDocuments && selectedCase.advocateDocuments.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedCase.advocateDocuments.map((doc, i) => (
                          <a key={i} href={fixCloudinaryPdfUrl(doc.url)} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 bg-white text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-50 border border-indigo-200 shadow-sm transition-all">
                            <FileText size={12} />
                            <div>
                              <p>{doc.name || `Advocate Draft ${i + 1}`}</p>
                              {doc.uploadedAt && <p className="text-[10px] text-gray-400 font-normal">{new Date(doc.uploadedAt).toLocaleDateString()}</p>}
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No advocate documents uploaded yet</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={() => { setEditCase({ ...selectedCase }); setSelectedCase(null); }} className="flex-1 py-2.5 bg-teal-600 text-white font-bold text-xs rounded-xl hover:bg-teal-700">Assign / Edit Advocate</button>
                <button onClick={() => setSelectedCase(null)} className="py-2.5 px-4 bg-gray-100 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-200">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EDIT CASE & ASSIGN ADVOCATE MODAL ── */}
      <AnimatePresence>
        {editCase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-slate-50">
                <h2 className="text-lg font-bold text-gray-900">Assign Advocate & Edit Case</h2>
                <button onClick={() => setEditCase(null)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Assign Advocate *</label>
                  <select
                    value={editCase.advocate?._id || ''}
                    onChange={e => {
                      const selAdvId = e.target.value;
                      const selAdv = advocatesList.find(a => a._id === selAdvId);
                      setEditCase(p => p ? { ...p, advocate: selAdvId ? { _id: selAdvId, user: selAdv?.user } : null } : p);
                    }}
                    className="w-full px-3 py-2.5 border border-indigo-200 bg-indigo-50/50 rounded-xl text-sm focus:outline-none font-bold text-indigo-900"
                  >
                    <option value="">-- UNASSIGNED (No Advocate) --</option>
                    {advocatesList.map(a => (
                      <option key={a._id} value={a._id}>Adv. {a.user?.name || 'Unknown'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Case Status</label>
                  <select value={editCase.status} onChange={e => setEditCase(p => p ? { ...p, status: e.target.value as any } : p)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none font-semibold">
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Internal Admin Notes</label>
                  <textarea value={editCase.notes || ''} onChange={e => setEditCase(p => p ? { ...p, notes: e.target.value } : p)} rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none resize-none" placeholder="Add internal notes..." />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setEditCase(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSaveEdit} className="flex-1 py-2.5 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700">Save Assignment</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── UPLOAD CASE DOCUMENT MODAL ── */}
      <AnimatePresence>
        {uploadModalCase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-teal-600" /> Upload Document
                </h3>
                <button onClick={() => setUploadModalCase(null)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-gray-200 space-y-2">
                  <label className="block text-xs font-bold text-gray-700">Upload Target Side:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUploadSide('client')}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                        uploadSide === 'client' ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      👤 Client Document
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadSide('advocate')}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                        uploadSide === 'advocate' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      ⚖️ Advocate Document
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setUploadModalCase(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-bold text-xs rounded-xl">Cancel</button>
                  <button onClick={handleUploadCaseDoc} disabled={isUploading || !uploadFile} className="flex-1 py-2.5 bg-teal-600 text-white font-bold text-xs rounded-xl hover:bg-teal-700 disabled:opacity-50">
                    {isUploading ? 'Uploading...' : 'Upload & Attach'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
              <Trash2 className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 text-lg">Delete Case Record?</h3>
              <p className="text-xs text-gray-500 mt-1 mb-5">This action will remove the case permanently.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl">Cancel</button>
                <button onClick={() => handleDelete(deleteId!)} className="flex-1 py-2.5 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
