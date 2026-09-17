import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, UserCheck, Clock, CheckCircle2, AlertTriangle,
  FileText, MessageSquare, Video, Phone, RefreshCw, X, ChevronDown,
  MapPin, Star, Eye, AlertCircle, Loader2, Users, ArrowRight,
  Download, Image as ImageIcon, Paperclip
} from 'lucide-react';
import api from '../lib/api';
import { connectAdminSocket, disconnectAdminSocket } from '../lib/socket';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Booking {
  _id: string;
  client: { _id: string; name: string; email: string; phone: string; avatar?: string; address?: any };
  advocate?: { _id: string; user?: { name: string; avatar?: string; phone?: string } };
  consultationMode: 'chat' | 'voice' | 'video';
  serviceType: string;
  issue: string;
  status: string;
  payment: { amount: number; status: string };
  documents: { url: string; name: string; type: string }[];
  advocateDocuments?: { url: string; name: string; type: string }[];
  clientCity?: string;
  notes?: string;
  internalNotes?: { note: string; addedBy?: string; addedAt?: string }[];
  assignmentDeadline: string;
  assignedAt?: string;
  assignedBy?: { name: string };
  chat?: string;
  videoRoomUrl?: string;
  sla?: { hoursRemaining: number; isOverdue: boolean; isUrgent: boolean };
  createdAt: string;
}

interface NearbyAdvocate {
  _id: string;
  user: { _id: string; name: string; avatar?: string; phone?: string; email?: string };
  specializations: string[];
  rating?: { average: number; count: number };
  consultationFee?: number;
  location?: { address?: { city?: string } };
  verificationStatus: string;
}

const fixCloudinaryPdfUrl = (url?: string) => {
  if (!url) return '#';
  if (url.includes('/image/upload/') && !url.includes('/fl_attachment/') && url.toLowerCase().includes('.pdf')) {
    return url.replace('/image/upload/', '/image/upload/fl_attachment/');
  }
  return url;
};

// ─── Status Config ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  pending_assignment: { color: '#D97706', bg: '#FEF3C7', label: 'Awaiting Assignment', icon: <Clock size={13} /> },
  pending:           { color: '#7C3AED', bg: '#EDE9FE', label: 'Pending',              icon: <AlertCircle size={13} /> },
  confirmed:         { color: '#059669', bg: '#DCFCE7', label: 'Confirmed',            icon: <CheckCircle2 size={13} /> },
  in_progress:       { color: '#2563EB', bg: '#DBEAFE', label: 'In Progress',          icon: <Video size={13} /> },
  completed:         { color: '#0891B2', bg: '#E0F2FE', label: 'Completed',            icon: <CheckCircle2 size={13} /> },
  cancelled:         { color: '#DC2626', bg: '#FEE2E2', label: 'Cancelled',            icon: <X size={13} /> },
};

const MODE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  chat:  { icon: <MessageSquare size={14} />, label: 'Chat',       color: '#0891B2' },
  voice: { icon: <Phone size={14} />,         label: 'Voice Call', color: '#059669' },
  video: { icon: <Video size={14} />,         label: 'Video Call', color: '#7C3AED' },
};

const SERVICE_LABELS: Record<string, string> = {
  legal_advice:       'Legal Advice',
  legal_notice:       'Legal Notice',
  property_research:  'Property Research',
  fir_draft:          'FIR Draft',
  document_forensic:  'Document Forensic',
  consultation:       'Consultation',
};

// ─── Countdown Component ──────────────────────────────────────────────────────
const SLABadge: React.FC<{ deadline: string }> = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setIsOverdue(true); setTimeLeft('Overdue!'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setIsUrgent(h < 4);
      setTimeLeft(`${h}h ${m}m`);
    };
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
      isOverdue ? 'bg-red-100 text-red-700' : isUrgent ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
    }`}>
      <Clock size={11} />
      {timeLeft}
    </span>
  );
};

// ─── Main Consultations Page ─────────────────────────────────────────────────
export default function Consultations() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending_assignment' | 'active_cases' | 'completed' | 'all'>('pending_assignment');
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');  // 'legal_advice' | 'legal_notice' | ''

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [nearbyAdvocates, setNearbyAdvocates] = useState<NearbyAdvocate[]>([]);
  const [allAdvocates, setAllAdvocates] = useState<NearbyAdvocate[]>([]);
  const [totalAdvocatesCount, setTotalAdvocatesCount] = useState(0);
  const [specFilter, setSpecFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'rating' | 'fee_low' | 'fee_high' | 'name'>('rating');

  const [summary, setSummary] = useState({ pending: 0, active: 0, completed: 0, total: 0, revenue: 0 });

  const wsRef = useRef<WebSocket | null>(null);
  const [newBookingAlert, setNewBookingAlert] = useState<{ clientName: string; serviceType: string } | null>(null);

  // ─── Phase 4 State: Manual Case Creation & Internal Notes ───
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submittingCase, setSubmittingCase] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [servicePrices, setServicePrices] = useState<Record<string, number>>({});
  const [createForm, setCreateForm] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientCity: '',
    serviceType: 'legal_advice',
    consultationMode: 'chat',
    preferredSlot: '',
    issueDescription: '',
    amount: 0,
    advocateId: '',
    documents: [] as { url: string; name: string; type: string }[],
  });
  const [newInternalNote, setNewInternalNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [bookingChatMessages, setBookingChatMessages] = useState<any[]>([]);
  const [loadingChatMessages, setLoadingChatMessages] = useState(false);

  useEffect(() => {
    api.get('/pricing').then(res => {
      const prices = (res.data?.data || []).reduce((map: Record<string, number>, item: any) => {
        map[item.serviceId] = Number(item.basePrice) || 0;
        return map;
      }, {});
      setServicePrices(prices);
      setCreateForm(prev => ({ ...prev, amount: prices.chat_consultation || 0 }));
    }).catch(() => setServicePrices({}));
  }, []);

  const priceKeyFor = (serviceType: string, mode: string) => serviceType === 'legal_advice'
    ? `${mode === 'voice' ? 'voice' : mode === 'video' ? 'video' : 'chat'}_consultation`
    : serviceType;

  const updateCreateService = (serviceType: string, consultationMode = createForm.consultationMode) => {
    setCreateForm(prev => ({ ...prev, serviceType, consultationMode, amount: servicePrices[priceKeyFor(serviceType, consultationMode)] || 0 }));
  };

  useEffect(() => {
    if (selectedBooking?._id) {
      setLoadingChatMessages(true);
      api.get(`/admin/bookings/${selectedBooking._id}/chat-messages`)
        .then(res => {
          if (res.data?.success) {
            setBookingChatMessages(res.data.data?.messages || []);
          }
        })
        .catch(() => setBookingChatMessages([]))
        .finally(() => setLoadingChatMessages(false));
    } else {
      setBookingChatMessages([]);
    }
  }, [selectedBooking?._id]);

  const handleFileUploadForAdmin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/admin/upload-for-client', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setCreateForm(prev => ({
          ...prev,
          documents: [...prev.documents, { url: res.data.data.url, name: res.data.data.name, type: file.type.includes('image') ? 'image' : 'pdf' }],
        }));
      }
    } catch (err: any) {
      alert('Upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleCreateCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.clientEmail.trim()) return alert('Client email is required.');
    if (!createForm.issueDescription.trim()) return alert('Issue description is required.');

    setSubmittingCase(true);
    try {
      const res = await api.post('/admin/create-case-for-client', createForm);
      if (res.data.success) {
        alert(res.data.data.message || 'Case created successfully!');
        setShowCreateModal(false);
        setCreateForm({
          clientName: '', clientEmail: '', clientPhone: '', clientCity: '',
          serviceType: 'legal_advice', consultationMode: 'chat', preferredSlot: '',
          issueDescription: '', amount: servicePrices.chat_consultation || 0, advocateId: '', documents: [],
        });
        fetchBookings();
      }
    } catch (err: any) {
      alert('Failed to create case: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingCase(false);
    }
  };

  const handleAddInternalNote = async () => {
    if (!selectedBooking || !newInternalNote.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await api.post(`/admin/bookings/${selectedBooking._id}/internal-notes`, { note: newInternalNote.trim() });
      if (res.data.success) {
        const updatedNotes = res.data.data;
        setSelectedBooking(prev => prev ? { ...prev, internalNotes: updatedNotes } : null);
        setBookings(prev => prev.map(b => b._id === selectedBooking._id ? { ...b, internalNotes: updatedNotes } : b));
        setNewInternalNote('');
      }
    } catch (err: any) {
      alert('Failed to add internal note: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingNote(false);
    }
  };

  // ─── Fetch Bookings ──────────────────────────────────────────────────────
  const fetchBookings = useCallback(async () => {
    // Also fetch FIR Drafts and merge them as bookings
    const fetchFIRDrafts = async () => {
      try {
        const res = await api.get('/admin/fir-drafts');
        const drafts = (res.data?.data || []).map((d: any) => ({
          _id: d._id,
          client: d.user || d.userId,
          issue: d.incident?.description || d.aiDraft?.substring(0, 100) || 'FIR Draft',
          serviceType: 'fir_draft',
          status: d.status === 'finalized' ? 'completed' : d.status === 'submitted' ? 'confirmed' : 'pending_assignment',
          payment: { amount: 0, status: 'not_required' },
          documents: d.evidence || [],
          createdAt: d.createdAt,
          assignmentDeadline: d.createdAt,
          consultationMode: 'chat',
          _isFIRDraft: true,
        }));
        return drafts;
      } catch { return []; }
    };

    setLoading(true);
    try {
      let statusParam: string | undefined;
      if (activeTab === 'pending_assignment') statusParam = 'pending_assignment';
      else if (activeTab === 'active_cases') statusParam = 'confirmed,in_progress';
      else if (activeTab === 'completed') statusParam = 'completed';

      const [res, firDrafts] = await Promise.all([
        api.get('/admin/bookings', { params: { status: statusParam, limit: 100 } }),
        fetchFIRDrafts(),
      ]);
      const allBookings = [...(res.data?.data?.bookings || res.data?.data || []), ...firDrafts];
      allBookings.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(allBookings);
      setSummary({
        pending:   allBookings.filter((b: any) => b.status === 'pending_assignment').length,
        active:    allBookings.filter((b: any) => ['confirmed','in_progress'].includes(b.status)).length,
        completed: allBookings.filter((b: any) => b.status === 'completed').length,
        revenue:   allBookings.filter((b: any) => b.payment?.status === 'paid').reduce((sum: number, b: any) => sum + (b.payment?.amount || 0), 0),
        total:     allBookings.length,
      });
    } catch (err) {
      console.error('Failed to load bookings', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // ─── Real-time: Socket.io via admin_room ────────────────────────────────
  useEffect(() => {
    const socket = connectAdminSocket();
    if (!socket) {
      // Fallback: 30s poll if socket unavailable
      const poll = setInterval(() => {
        if (activeTab === 'pending_assignment') fetchBookings();
      }, 30000);
      return () => clearInterval(poll);
    }

    const handleNewBooking = (data: any) => {
      setNewBookingAlert({ clientName: data.clientName, serviceType: data.serviceType });
      setTimeout(() => setNewBookingAlert(null), 6000);
      fetchBookings(); // Refresh list immediately
    };

    const handlePaymentConfirmed = (data: any) => {
      fetchBookings(); // Refresh to show payment status update
    };

    socket.on('admin:new_booking',        handleNewBooking);
    socket.on('admin:payment_confirmed',  handlePaymentConfirmed);

    return () => {
      socket.off('admin:new_booking',       handleNewBooking);
      socket.off('admin:payment_confirmed', handlePaymentConfirmed);
    };
  }, [activeTab, fetchBookings]);

  const [advocateSearch, setAdvocateSearch] = useState('');
  const [advocatePage, setAdvocatePage]     = useState(1);
  const [advTotalPages, setAdvTotalPages]   = useState(1);
  const [advTotalCount, setAdvTotalCount]   = useState(0);
  const ADV_PAGE_SIZE = 20;
  const [assigning, setAssigning] = useState<string | null>(null);
  const [showAllAdvocates, setShowAllAdvocates] = useState(true);
  const [panelOpen, setPanelOpen]   = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch advocates from server with page + search
  const fetchAdvocates = React.useCallback(async (
    bookingId: string, page = 1, search = '', showAll = true
  ) => {
    setLoadingNearby(true);
    try {
      const res = await api.get(`/admin/bookings/${bookingId}/nearby-advocates`, {
        params: { page, limit: ADV_PAGE_SIZE, search: search || undefined },
      });
      if (res.data?.success) {
        const d = res.data.data;
        if (showAll) {
          setAllAdvocates(d.allAdvocates || []);
          setNearbyAdvocates(d.nearbyAdvocates || []);
        } else {
          setNearbyAdvocates(d.nearbyAdvocates || []);
        }
        setTotalAdvocatesCount(d.totalAdvocates || 0);
        setAdvTotalPages(d.pages || 1);
        setAdvTotalCount(d.totalAdvocates || 0);
      }
    } catch (err) {
      console.error('Failed to fetch advocates', err);
    } finally {
      setLoadingNearby(false);
    }
  }, []);

  const openPanel = async (booking: Booking) => {
    setSelectedBooking(booking);
    setPanelOpen(true);
    setShowAllAdvocates(true);
    setAdvocateSearch('');
    setSpecFilter('');
    setCityFilter('');
    setMinRating(0);
    setSortBy('rating');
    setAdvocatePage(1);
    await fetchAdvocates(booking._id, 1, '', true);
  };

  // Unique lists for filter dropdowns
  const uniqueSpecs = Array.from(new Set(
    allAdvocates.flatMap(a => a.specializations || [])
  )).filter(Boolean).sort();

  const uniqueCities = Array.from(new Set(
    allAdvocates.map(a => a.location?.address?.city).filter(Boolean) as string[]
  )).sort();

  // Filtered & Sorted Advocates List
  const advocatesDisplay = (showAllAdvocates ? allAdvocates : nearbyAdvocates).filter(a => {
    if (advocateSearch) {
      const q = advocateSearch.toLowerCase();
      const matchSearch =
        a.user?.name?.toLowerCase().includes(q) ||
        a.user?.email?.toLowerCase().includes(q) ||
        a.location?.address?.city?.toLowerCase().includes(q) ||
        a.specializations?.some(s => s.toLowerCase().includes(q));
      if (!matchSearch) return false;
    }
    if (specFilter && !a.specializations?.some(s => s.toLowerCase() === specFilter.toLowerCase())) {
      return false;
    }
    if (cityFilter && (a.location?.address?.city || '').toLowerCase() !== cityFilter.toLowerCase()) {
      return false;
    }
    if (minRating > 0 && (a.rating?.average || 0) < minRating) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'rating') return (b.rating?.average || 0) - (a.rating?.average || 0);
    if (sortBy === 'fee_low') return (a.consultationFee || 0) - (b.consultationFee || 0);
    if (sortBy === 'fee_high') return (b.consultationFee || 0) - (a.consultationFee || 0);
    if (sortBy === 'name') return (a.user?.name || '').localeCompare(b.user?.name || '');
    return 0;
  });
  // ─── Assign Advocate ─────────────────────────────────────────────────────
  const handleAssign = async (advocateId: string, advocateName: string) => {
    if (!selectedBooking) return;
    if (!window.confirm(`Assign ${advocateName} to this case?`)) return;
    setAssigning(advocateId);
    try {
      const res = await api.post(`/admin/bookings/${selectedBooking._id}/assign`, {
        advocateId,
        sendWhatsApp: false,
      });
      if (res.data?.success) {
        alert(`✅ ${advocateName} has been assigned successfully!\n\nClient and advocate have been notified via app.`);
        setPanelOpen(false);
        setSelectedBooking(null);
        fetchBookings();
      }
    } catch (err: any) {
      alert(`❌ Assignment failed: ${err?.response?.data?.message || 'Please try again.'}`);
    } finally {
      setAssigning(null);
    }
  };

  // ─── Update Status ───────────────────────────────────────────────────────
  const handleUpdateStatus = async (bookingId: string, status: string) => {
    try {
      await api.patch(`/admin/bookings/${bookingId}/status`, { status });
      fetchBookings();
      if (selectedBooking?._id === bookingId) {
        setSelectedBooking(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      alert('Failed to update status');
    }
  };

  // ─── Filtered Display ─────────────────────────────────────────────────────
  const filtered = bookings.filter(b => {
    const s = search.toLowerCase();
    const matchSearch = !s || b.client?.name?.toLowerCase().includes(s) ||
      b.issue?.toLowerCase().includes(s) || b._id.includes(s) || b.clientCity?.toLowerCase().includes(s);
    const matchService = !serviceFilter || b.serviceType === serviceFilter;
    return matchSearch && matchService;
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Real-time New Booking Toast ── */}
      <AnimatePresence>
        {newBookingAlert && (
          <motion.div
            initial={{ opacity: 0, y: -60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -60 }}
            className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 max-w-sm"
          >
            <span className="text-xl">🔔</span>
            <div>
              <p className="font-bold text-sm">New Booking Request!</p>
              <p className="text-xs text-emerald-100">
                {newBookingAlert.clientName} — {newBookingAlert.serviceType?.replace('_', ' ')}
              </p>
            </div>
            <button onClick={() => setNewBookingAlert(null)} className="ml-auto text-emerald-200 hover:text-white">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Legal Requests</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage client legal advice & notice assignments</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-sm text-sm">
              <Paperclip size={15} />
              + Create Case / Upload Docs
            </button>
            <button onClick={fetchBookings}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors">
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
          {[
            { key: 'pending_assignment', label: 'Needs Assignment', count: summary.pending, isUrgent: true },
            { key: 'active_cases', label: 'Active Cases', count: summary.active },
            { key: 'completed', label: 'Completed Cases', count: summary.completed },
            { key: 'all', label: 'All Requests', count: summary.total }
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-white shadow text-teal-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
              <span className={`text-xs rounded-full px-2 py-0.5 font-bold ${
                tab.isUrgent && tab.count > 0 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

        {/* Filters */}
      <div className="px-6 py-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search client, city, issue..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        {/* Service Type Quick Filters */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: '', label: '🗂 All Services' },
            { value: 'legal_advice', label: '⚖️ Legal Advice' },
            { value: 'legal_notice', label: '📄 Legal Notice' },
            { value: 'property_research', label: '🏠 Property' },
            { value: 'fir_draft', label: '📋 FIR Draft' },
            { value: 'document_forensic', label: '🔬 Forensic' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setServiceFilter(f.value)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                serviceFilter === f.value
                  ? 'bg-teal-600 text-white border-teal-600 shadow'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="px-6 mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending Assignment', count: summary.pending, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Active Assigned Cases', count: summary.active, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
          { label: 'Completed Cases', count: summary.completed, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Paid Revenue', count: `₹${summary.revenue}`, color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border rounded-2xl p-4 flex flex-col justify-between shadow-sm`}>
            <span className="text-xs font-semibold text-gray-500">{s.label}</span>
            <span className={`text-2xl font-black mt-1 ${s.color}`}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Booking Cards Grid */}
      <div className="px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-teal-600" size={32} />
            <span className="ml-3 text-gray-500">Loading requests...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle2 size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {activeTab === 'pending_assignment' ? 'All requests have been assigned! 🎉' : 'No requests found.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(booking => {
              const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
              const mode = MODE_CONFIG[booking.consultationMode] || MODE_CONFIG.chat;
              const isPending = booking.status === 'pending_assignment';

              return (
                <motion.div key={booking._id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`bg-white rounded-2xl shadow-sm border-2 transition-all hover:shadow-md cursor-pointer ${
                    isPending ? 'border-orange-200' : 'border-gray-100'
                  }`}
                  onClick={() => openPanel(booking)}>

                  {/* Card Header */}
                  <div className="p-4 border-b border-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.icon} {cfg.label}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600"
                        style={{ color: mode.color }}>
                        {mode.icon} {mode.label}
                      </span>
                    </div>
                    {isPending && <SLABadge deadline={booking.assignmentDeadline} />}
                  </div>

                  {/* Client Info */}
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm flex-shrink-0">
                        {booking.client?.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{booking.client?.name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          {booking.clientCity && <><MapPin size={10} /> {booking.clientCity} · </>}
                          <span className="font-medium text-teal-600">{SERVICE_LABELS[booking.serviceType] || booking.serviceType}</span>
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 whitespace-pre-wrap break-words bg-gray-50 rounded-lg px-3 py-2 mb-3">
                      {booking.issue}
                    </p>

                    {/* Booking Time / Slot Display */}
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 mb-3 font-semibold">
                      <Clock size={13} className="text-amber-600 flex-shrink-0" />
                      <span>Slot: {booking.notes?.replace('Preferred slot: ', '') || (booking.createdAt ? new Date(booking.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Flexible Slot (Within 24h)')}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span className={`font-semibold ${booking.payment.status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                        ₹{booking.payment.amount} · {booking.payment.status === 'paid' ? '✓ Paid' : 'Pending'}
                      </span>
                    </div>

                    {/* Direct Clickable Uploaded Documents Pills */}
                    {booking.documents?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <span className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 mb-1.5">
                          <Paperclip size={11} className="text-teal-600" /> Attached Documents ({booking.documents.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {booking.documents.map((doc, idx) => (
                            <a key={idx} href={fixCloudinaryPdfUrl(doc.url)} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 transition-colors">
                              {doc.type === 'image' ? <ImageIcon size={11} /> : <FileText size={11} />}
                              <span>{doc.name || `Doc ${idx + 1}`}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Case Progress Bar */}
                  <div className="px-4 pb-3">
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 mb-1.5">
                        <span>Progress</span>
                        <span className="text-teal-700 font-bold">
                          {booking.status === 'completed' ? '100% Completed' : booking.status === 'in_progress' ? '75% In Progress' : booking.advocate ? '50% Advocate Assigned' : '25% Pending Assignment'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            booking.status === 'completed' ? 'bg-emerald-500 w-full' :
                            booking.status === 'in_progress' ? 'bg-indigo-500 w-3/4' :
                            booking.advocate ? 'bg-teal-500 w-1/2' : 'bg-amber-500 w-1/4'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="px-4 pb-4">
                    {isPending ? (
                      <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors"
                        onClick={e => { e.stopPropagation(); openPanel(booking); }}>
                        <UserCheck size={15} /> Assign Advocate
                      </button>
                    ) : booking.advocate ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between bg-emerald-50/80 rounded-xl p-2.5 border border-emerald-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {booking.advocate.user?.name?.charAt(0) || 'A'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-emerald-900 truncate">Assigned to {booking.advocate.user?.name}</p>
                              {booking.advocate.user?.phone && <p className="text-[10px] text-emerald-700">{booking.advocate.user.phone}</p>}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={e => { e.stopPropagation(); openPanel(booking); }}
                            className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors">
                            Manage & Re-assign
                          </button>
                          {booking.status !== 'completed' && (
                            <button
                              onClick={e => { e.stopPropagation(); handleUpdateStatus(booking._id, 'completed'); }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors">
                              Mark Completed
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Assignment Side Panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {panelOpen && selectedBooking && (
          <>
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
              onClick={() => setPanelOpen(false)} />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white z-50 shadow-2xl overflow-y-auto">

              {/* Panel Header */}
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Assign Advocate</h2>
                    <p className="text-sm text-gray-500">
                      #{selectedBooking._id.slice(-8).toUpperCase()} · {SERVICE_LABELS[selectedBooking.serviceType]}
                    </p>
                  </div>
                  <button onClick={() => setPanelOpen(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* ── Booking Details ── */}
                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                  <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Request Details</h3>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Client</span><p className="font-semibold">{selectedBooking.client?.name}</p></div>
                    <div><span className="text-gray-500">Phone</span><p className="font-semibold">{selectedBooking.client?.phone || '—'}</p></div>
                    <div><span className="text-gray-500">City</span><p className="font-semibold">{selectedBooking.clientCity || '—'}</p></div>
                    <div><span className="text-gray-500">Mode</span>
                      <p className="font-semibold flex items-center gap-1" style={{ color: MODE_CONFIG[selectedBooking.consultationMode]?.color }}>
                        {MODE_CONFIG[selectedBooking.consultationMode]?.icon}
                        {MODE_CONFIG[selectedBooking.consultationMode]?.label}
                      </p>
                    </div>
                    <div><span className="text-gray-500">Amount</span><p className="font-semibold text-green-700">₹{selectedBooking.payment.amount}</p></div>
                    <div><span className="text-gray-500">SLA</span><SLABadge deadline={selectedBooking.assignmentDeadline} /></div>
                  </div>

                  <div className="border-t border-gray-200 pt-3">
                    <span className="text-gray-500 text-sm">Issue Description</span>
                    <p className="text-sm text-gray-800 mt-1 leading-relaxed whitespace-pre-wrap break-words">{selectedBooking.issue}</p>
                  </div>

                  {/* Documents */}
                  {selectedBooking.documents?.length > 0 && (
                    <div className="border-t border-gray-200 pt-3">
                      <span className="text-gray-500 text-sm font-medium flex items-center gap-1 mb-2">
                        <Paperclip size={13} /> Documents ({selectedBooking.documents.length})
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selectedBooking.documents.map((doc, i) => (
                          <a key={i} href={fixCloudinaryPdfUrl(doc.url)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                            {doc.type === 'image' ? <ImageIcon size={12} /> : <FileText size={12} />}
                            {doc.name?.length > 20 ? doc.name.substring(0, 20) + '...' : doc.name || `Document ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Internal Admin Notes ── */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-amber-900 text-sm flex items-center gap-1.5">
                      <FileText size={14} className="text-amber-700" /> Internal Admin Notes (Private)
                    </h3>
                  </div>

                  {(selectedBooking.internalNotes && selectedBooking.internalNotes.length > 0) ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {selectedBooking.internalNotes.map((n: any, idx: number) => (
                        <div key={idx} className="bg-white p-2.5 rounded-xl border border-amber-100 text-xs shadow-2xs">
                          <p className="text-gray-800 font-medium">{n.note}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            — {n.addedBy || 'Admin'} · {new Date(n.addedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 italic">No internal notes added yet.</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add private note for admin team..."
                      value={newInternalNote}
                      onChange={e => setNewInternalNote(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      onClick={handleAddInternalNote}
                      disabled={submittingNote || !newInternalNote.trim()}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex-shrink-0"
                    >
                      {submittingNote ? 'Saving...' : 'Add Note'}
                    </button>
                  </div>
                </div>

                {/* ── Live Consultation Chat Messages ── */}
                <div className="bg-indigo-50/60 border border-indigo-200/70 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-indigo-900 text-sm flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-indigo-700" /> Live Consultation Chat History
                    </h3>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                      {bookingChatMessages.length} messages
                    </span>
                  </div>

                  {loadingChatMessages ? (
                    <div className="text-center py-4 text-xs text-indigo-500 animate-pulse">Loading chat messages...</div>
                  ) : bookingChatMessages.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {bookingChatMessages.map((m: any, idx: number) => {
                        const isClient = m.senderRole === 'client';
                        return (
                          <div key={idx} className={`p-2.5 rounded-xl text-xs max-w-[85%] ${
                            isClient ? 'bg-white text-gray-800 border border-indigo-100 self-start mr-auto' : 'bg-teal-700 text-white self-end ml-auto'
                          }`}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`font-bold text-[10px] ${isClient ? 'text-teal-700' : 'text-teal-100'}`}>
                                {m.senderName} ({m.senderRole === 'advocate' ? 'Advocate' : 'Client'})
                              </span>
                              <span className={`text-[9px] ${isClient ? 'text-gray-400' : 'text-teal-200'}`}>
                                {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="leading-relaxed">{m.content}</p>
                            {m.fileUrl && (
                              <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 mt-1 font-bold underline text-[10px] ${isClient ? 'text-blue-600' : 'text-yellow-200'}`}>
                                📎 {m.fileName || 'Attachment'}
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-indigo-700 italic">No chat messages exchanged yet for this booking.</p>
                  )}
                </div>

                {/* ── Status Actions ── */}
                {selectedBooking.status !== 'pending_assignment' && (
                  <div>
                    <h3 className="font-semibold text-gray-700 text-sm mb-3">Update Status</h3>
                    <div className="flex flex-wrap gap-2">
                      {['confirmed', 'in_progress', 'completed', 'cancelled'].map(s => {
                        const cfg = STATUS_CONFIG[s];
                        return (
                          <button key={s}
                            onClick={() => handleUpdateStatus(selectedBooking._id, s)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all hover:shadow-sm"
                            style={{ borderColor: cfg.color, color: cfg.color, backgroundColor: selectedBooking.status === s ? cfg.bg : 'white' }}>
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Advocate Selection ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
                      {showAllAdvocates ? (
                        <>All Advocates</>
                      ) : (
                        <>
                          Nearby Advocates
                          {selectedBooking.clientCity && (
                            <span className="text-xs bg-teal-50 text-teal-700 font-semibold px-2 py-0.5 rounded-full">
                              in {selectedBooking.clientCity}
                            </span>
                          )}
                        </>
                      )}
                    </h3>
                    <button onClick={() => {
                        const next = !showAllAdvocates;
                        setShowAllAdvocates(next);
                        setAdvocatePage(1);
                        if (selectedBooking) fetchAdvocates(selectedBooking._id, 1, advocateSearch, next);
                      }}
                      className="text-xs text-teal-600 font-semibold hover:underline flex items-center gap-1 bg-teal-50 px-2.5 py-1 rounded-lg">
                      {showAllAdvocates ? 'Show Nearby Advocates' : 'Show All Advocates'}
                      <Users size={12} />
                    </button>
                  </div>

                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={advocateSearch}
                      onChange={e => {
                        const val = e.target.value;
                        setAdvocateSearch(val);
                        setAdvocatePage(1);
                        // Debounced server-side search across all advocates
                        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                        searchTimerRef.current = setTimeout(() => {
                          if (selectedBooking) fetchAdvocates(selectedBooking._id, 1, val, showAllAdvocates);
                        }, 400);
                      }}
                      placeholder="Search across all advocates by name, city, email, specialization..."
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>

                  {/* ── Advocate Filters Bar ── */}
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 mb-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                      <span className="flex items-center gap-1.5"><Filter size={12} className="text-teal-600" /> Filter Advocates</span>
                      {(specFilter || cityFilter || minRating > 0 || advocateSearch) && (
                        <button onClick={() => { setSpecFilter(''); setCityFilter(''); setMinRating(0); setAdvocateSearch(''); setAdvocatePage(1); }}
                          className="text-xs text-red-600 hover:underline flex items-center gap-1">
                          <X size={12} /> Reset Filters
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {/* Specialization Filter */}
                      <div>
                        <select value={specFilter} onChange={e => { setSpecFilter(e.target.value); setAdvocatePage(1); }}
                          className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-gray-700">
                          <option value="">All Specializations</option>
                          {uniqueSpecs.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* City Filter */}
                      <div>
                        <select value={cityFilter} onChange={e => { setCityFilter(e.target.value); setAdvocatePage(1); }}
                          className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-gray-700">
                          <option value="">All Cities</option>
                          {uniqueCities.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Rating Filter */}
                      <div>
                        <select value={minRating} onChange={e => { setMinRating(Number(e.target.value)); setAdvocatePage(1); }}
                          className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-gray-700">
                          <option value="0">All Ratings</option>
                          <option value="4.0">⭐ 4.0 & above</option>
                          <option value="4.5">⭐ 4.5 & above</option>
                          <option value="4.8">⭐ 4.8 & above</option>
                        </select>
                      </div>

                      {/* Sort By */}
                      <div>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                          className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-gray-700">
                          <option value="rating">Top Rated First</option>
                          <option value="fee_low">Fee: Low to High</option>
                          <option value="fee_high">Fee: High to Low</option>
                          <option value="name">Name: A to Z</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {loadingNearby ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin text-teal-500 mr-2" size={20} />
                      <span className="text-sm text-gray-500">Finding nearby advocates...</span>
                    </div>
                  ) : advocatesDisplay.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl">
                      <Users size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">No advocates found.</p>
                      {!showAllAdvocates && (
                        <button onClick={() => setShowAllAdvocates(true)}
                          className="mt-2 text-teal-600 text-sm font-semibold hover:underline">
                          Show all advocates →
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                       <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {(showAllAdvocates ? allAdvocates : nearbyAdvocates).map(adv => (
                            <motion.div key={adv._id}
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className="flex items-center gap-3 p-4 border-2 border-gray-100 rounded-2xl hover:border-teal-200 hover:bg-teal-50/30 transition-all">

                              <div className="w-11 h-11 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold flex-shrink-0">
                                {adv.user?.avatar ? (
                                  <img src={adv.user.avatar} className="w-11 h-11 rounded-full object-cover" alt="" />
                                ) : (
                                  adv.user?.name?.charAt(0)?.toUpperCase()
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm">{adv.user?.name}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {adv.specializations?.slice(0, 2).join(', ') || 'General Practice'}
                                </p>
                                <div className="flex items-center flex-wrap gap-2 mt-1.5">
                                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-md font-bold">
                                    <Star size={11} fill="currentColor" className="text-amber-500" /> Client rating: {adv.rating?.count ? `${adv.rating.average.toFixed(1)} (${adv.rating.count})` : 'No ratings'}
                                  </span>
                                  {adv.consultationFee ? (
                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">₹{adv.consultationFee}</span>
                                  ) : null}
                                  {adv.location?.address?.city ? (
                                    <span className="flex items-center gap-0.5 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md font-medium">
                                      <MapPin size={10} /> {adv.location.address.city}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <button
                                onClick={() => handleAssign(adv._id, adv.user?.name || 'Advocate')}
                                disabled={!!assigning}
                                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors whitespace-nowrap flex-shrink-0">
                                {assigning === adv._id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <UserCheck size={14} />
                                )}
                                Assign
                              </button>
                            </motion.div>
                          ))}
                      </div>

                      {/* Server-side Pagination */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs">
                        <span className="text-gray-500 font-medium">
                          Page {advocatePage} of {advTotalPages} · {advTotalCount.toLocaleString()} advocates total
                        </span>
                        <div className="flex gap-2">
                          <button
                            disabled={advocatePage <= 1 || loadingNearby}
                            onClick={() => {
                              const p = advocatePage - 1;
                              setAdvocatePage(p);
                              if (selectedBooking) fetchAdvocates(selectedBooking._id, p, advocateSearch, showAllAdvocates);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 font-semibold disabled:opacity-40 hover:bg-gray-50">
                            ← Previous
                          </button>
                          <button
                            disabled={advocatePage >= advTotalPages || loadingNearby}
                            onClick={() => {
                              const p = advocatePage + 1;
                              setAdvocatePage(p);
                              if (selectedBooking) fetchAdvocates(selectedBooking._id, p, advocateSearch, showAllAdvocates);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 font-semibold disabled:opacity-40 hover:bg-gray-50">
                            Next →
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* ── Create Case Modal ── */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">+ Create Case & Upload Documents</h2>
                  <p className="text-xs text-gray-500">Auto-register client and create booking directly from Admin Panel</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
              </div>

              <form onSubmit={handleCreateCaseSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-gray-700 mb-1 block">Client Full Name</label>
                    <input type="text" placeholder="e.g. Ramesh Sharma" value={createForm.clientName}
                      onChange={e => setCreateForm({ ...createForm, clientName: e.target.value })}
                      className="w-full p-2.5 border rounded-xl bg-gray-50 text-gray-900" />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 mb-1 block">Client Email (Required)</label>
                    <input type="email" required placeholder="client@example.com" value={createForm.clientEmail}
                      onChange={e => setCreateForm({ ...createForm, clientEmail: e.target.value })}
                      className="w-full p-2.5 border rounded-xl bg-gray-50 text-gray-900" />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 mb-1 block">Phone Number</label>
                    <input type="text" placeholder="9876543210" value={createForm.clientPhone}
                      onChange={e => setCreateForm({ ...createForm, clientPhone: e.target.value })}
                      className="w-full p-2.5 border rounded-xl bg-gray-50 text-gray-900" />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 mb-1 block">City</label>
                    <input type="text" placeholder="Jabalpur" value={createForm.clientCity}
                      onChange={e => setCreateForm({ ...createForm, clientCity: e.target.value })}
                      className="w-full p-2.5 border rounded-xl bg-gray-50 text-gray-900" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-gray-700 mb-1 block">Service Type</label>
                    <select value={createForm.serviceType} onChange={e => updateCreateService(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-gray-50 font-medium text-gray-900">
                      <option value="legal_advice">Legal Advice</option>
                      <option value="legal_notice">Legal Notice</option>
                      <option value="property_research">Property Research</option>
                      <option value="fir_draft">FIR Draft</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 mb-1 block">Mode</label>
                    <select value={createForm.consultationMode} onChange={e => updateCreateService(createForm.serviceType, e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-gray-50 font-medium text-gray-900">
                      <option value="chat">Chat</option>
                      <option value="voice">Voice Call</option>
                      <option value="video">Video Call</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700 mb-1 block">Amount (₹)</label>
                    <input type="number" value={createForm.amount} onChange={e => setCreateForm({ ...createForm, amount: Number(e.target.value) })}
                      className="w-full p-2.5 border rounded-xl bg-gray-50 font-bold text-teal-700" />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 mb-1 block">Scheduled Slot</label>
                  <input type="text" value={createForm.preferredSlot} onChange={e => setCreateForm({ ...createForm, preferredSlot: e.target.value })}
                    className="w-full p-2.5 border rounded-xl bg-gray-50 text-gray-900" placeholder="e.g. Tomorrow, 10:30 AM" />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 mb-1 block">Legal Issue Description (Required)</label>
                  <textarea rows={3} required placeholder="Describe the legal concern or agreement details..." value={createForm.issueDescription}
                    onChange={e => setCreateForm({ ...createForm, issueDescription: e.target.value })}
                    className="w-full p-2.5 border rounded-xl bg-gray-50 text-gray-900" />
                </div>

                {/* File Upload Section */}
                <div className="border-t pt-3">
                  <label className="font-semibold text-gray-700 mb-1.5 block flex items-center gap-1">
                    <Paperclip size={13} className="text-teal-600" /> Upload Case Documents (Client Files)
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="file" onChange={handleFileUploadForAdmin} disabled={uploadingDoc}
                      className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100" />
                    {uploadingDoc && <span className="text-xs text-teal-600 font-semibold animate-pulse">Uploading file...</span>}
                  </div>
                  {createForm.documents.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {createForm.documents.map((d, idx) => (
                        <span key={idx} className="bg-teal-50 border border-teal-200 text-teal-800 text-[11px] px-2.5 py-1 rounded-lg font-medium flex items-center gap-1">
                          📄 {d.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded-xl font-medium">Cancel</button>
                  <button type="submit" disabled={submittingCase} className="px-5 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700">
                    {submittingCase ? 'Creating Case...' : 'Create Case & Register'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
