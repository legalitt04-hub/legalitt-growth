import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, Video, MapPin, Scale, Timer } from 'lucide-react';
import api from '../lib/api';

type CalendarEvent = { id: string; title: string; date: string; startTime?: string; endTime?: string; mode?: string; location?: string; advocateName?: string; status?: string; source: 'booking' | 'case' | 'advocate_hearing'; sessionExpiresAt?: string };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// ─── Session expiry pill ──────────────────────────────────────────────────────
function SessionExpiryPill({ expiresAt }: { expiresAt?: string }) {
  const [label, setLabel] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setExpired(true); setLabel('Expired'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setLabel(h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${expired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── Extend Session Modal ─────────────────────────────────────────────────────
function ExtendSessionModal({ bookingId, onClose, onSuccess }: { bookingId: string; onClose: () => void; onSuccess: (newExpiry: string) => void }) {
  const [hours, setHours] = useState('2');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const h = parseFloat(hours);
    if (!h || h < 0.5 || h > 72) { setError('Enter between 0.5 and 72 hours.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.patch(`/admin/bookings/${bookingId}/extend-session`, { addHours: h, reason });
      onSuccess(res.data?.data?.sessionExpiresAt);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to extend session.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <Timer className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Extend Session</h3>
            <p className="text-xs text-slate-500">Chat/voice/video access will be extended</p>
          </div>
        </div>

        <label className="block text-sm font-semibold text-slate-700 mb-1">Extend by (hours)</label>
        <div className="flex gap-2 mb-3">
          {['1', '2', '4', '6', '12', '24'].map(h => (
            <button key={h} onClick={() => setHours(h)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                hours === h ? 'bg-purple-500 text-white border-purple-500' : 'border-slate-200 text-slate-600 hover:border-purple-300'
              }`}>{h}h</button>
          ))}
        </div>
        <input type="number" min="0.5" max="72" step="0.5" value={hours}
          onChange={e => setHours(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
          placeholder="Custom hours (e.g. 3.5)" />

        <label className="block text-sm font-semibold text-slate-700 mb-1">Reason (optional)</label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400"
          placeholder="e.g. Client requested more time" />

        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 disabled:opacity-50">
            {loading ? 'Extending…' : 'Extend Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarView() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState<any[]>([]);
  const [advocateSearch, setAdvocateSearch] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [extendTarget, setExtendTarget] = useState<{ id: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setAvailability([]); setAvailabilityError('Loading availability…');
      try {
        const date = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const res = await api.get('/admin/calendar', { params: { availabilityDate: date, search: advocateSearch } });
        if (!cancelled) { setAvailability(res.data.data || []); setAvailabilityError(''); }
      } catch { if (!cancelled) setAvailabilityError('Availability could not be loaded.'); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedDate, advocateSearch]);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true); setError('');
      try {
        const from = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const to = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
        const res = await api.get('/admin/calendar', { params: { from: from.toISOString(), to: to.toISOString() } });
        setEvents(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err: any) {
        setEvents([]); setError(err.response?.data?.message || 'Calendar events could not be loaded.');
      } finally { setLoading(false); }
    };
    fetchEvents();
  }, [currentDate]);

  const firstWeekday = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, i) => i < firstWeekday ? null : i - firstWeekday + 1);
  const selectedEvents = useMemo(() => events.filter(event => sameDay(new Date(event.date), selectedDate)), [events, selectedDate]);
  const monthLabel = currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const selectedLabel = selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const changeMonth = (offset: number) => { const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1); setCurrentDate(next); setSelectedDate(next); };

  return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 h-full flex flex-col">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div><h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><CalendarIcon className="w-6 h-6 text-purple-500"/>Calendar &amp; Schedule</h2><p className="text-slate-500 text-sm mt-1">Live consultations and case timeline hearings.</p></div>
      <button onClick={() => navigate('/consultations')} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium text-sm transition-colors shadow-sm flex items-center gap-2"><Plus className="w-4 h-4"/>Schedule Consultation</button>
    </div>
    <Card className="p-4 space-y-3">
      <h3 className="font-bold">Advocate availability — {selectedLabel}</h3>
      <input className="border rounded-lg p-2 w-full" placeholder="Search advocate name (up to 50 results)" value={advocateSearch} onChange={e => setAdvocateSearch(e.target.value)} />
      {availabilityError && <p>{availabilityError}</p>}
      <div className="max-h-80 overflow-y-auto space-y-3">{availability.map(a => <div key={a.id} className="border rounded-lg p-3"><b>{a.name}</b><div className="flex flex-wrap gap-2 mt-2">{a.slots.length ? a.slots.map((slot: any, i: number) => <span key={i} className={`text-sm rounded px-2 py-1 ${slot.status === 'Available' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>{slot.startTime}–{slot.endTime}: {slot.status}</span>) : <span className="text-sm text-gray-500">Availability not published for this day</span>}</div>{a.hearings.map((h: any, i: number) => <p key={i} className="text-sm text-amber-700">Hearing: {h.time || 'Time not set'} · {h.title}</p>)}</div>)}</div>
    </Card>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
      <div className="lg:col-span-1 space-y-6 flex flex-col h-full">
        <Card className="bg-white border-slate-200 p-4">
          <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-900 text-lg">{monthLabel}</h3><div className="flex gap-1"><button onClick={() => changeMonth(-1)} aria-label="Previous month" className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft className="w-5 h-5"/></button><button onClick={() => changeMonth(1)} aria-label="Next month" className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight className="w-5 h-5"/></button></div></div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <div key={day} className="text-xs font-semibold text-slate-400 py-1">{day}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">{cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`}/>;
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const selected = sameDay(date, selectedDate); const hasEvents = events.some(event => sameDay(new Date(event.date), date));
            return <button key={day} onClick={() => setSelectedDate(date)} className={`relative h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${selected ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}>{day}{hasEvents && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-purple-500'}`}/>}</button>;
          })}</div>
        </Card>
        <Card className="bg-white border-slate-200 p-4 flex-1 overflow-hidden flex flex-col">
          <h3 className="font-bold text-slate-900 mb-1">Selected Day</h3><p className="text-xs text-slate-500 mb-4">{selectedLabel}</p>
          <div className="space-y-4 overflow-y-auto hidden-scrollbar pr-2 flex-1">
            {loading ? <p className="text-sm text-slate-400">Loading schedule...</p> : error ? <p className="text-sm text-red-500">{error}</p> : selectedEvents.length === 0 ? <p className="text-sm text-slate-400">No scheduled events for this day.</p> : selectedEvents.map(event => <div key={event.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 border-l-4 border-l-purple-500"><h4 className="text-sm font-bold text-slate-900 mb-1 capitalize">{event.title}</h4><div className="space-y-1 text-xs text-slate-500">{(event.startTime || event.endTime) && <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{[event.startTime,event.endTime].filter(Boolean).join(' – ')}</span>}<span className="flex items-center gap-1 capitalize">{event.source === 'booking' ? <Video className="w-3 h-3"/> : <Scale className="w-3 h-3"/>}{event.location || event.mode || 'Details not set'}</span>{event.advocateName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>Adv. {event.advocateName}</span>}</div>{event.source === 'booking' && <div className="mt-2 flex items-center gap-2"><SessionExpiryPill expiresAt={event.sessionExpiresAt} /><button onClick={() => setExtendTarget({ id: event.sourceId || event.id.replace('booking-','') })} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"><Timer className="w-3 h-3"/>Extend</button></div>}</div>)}
          </div>
        </Card>
      </div>
      <div className="lg:col-span-2"><Card className="bg-white border-slate-200 h-full min-h-[600px] p-6"><h3 className="text-lg font-bold text-slate-900">{selectedLabel}</h3><p className="text-sm text-slate-500 mt-1 mb-6">{selectedEvents.length} scheduled {selectedEvents.length === 1 ? 'event' : 'events'}</p><div className="space-y-3">{selectedEvents.map(event => <div key={`detail-${event.id}`} className="border border-slate-200 rounded-xl p-4 flex gap-4"><div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">{event.source === 'booking' ? <CalendarIcon className="w-5 h-5"/> : <Scale className="w-5 h-5"/>}</div><div className="flex-1"><p className="font-semibold text-slate-900 capitalize">{event.title}</p><p className="text-sm text-slate-500 mt-1 capitalize">{event.status || 'Scheduled'} · {event.location || event.mode || 'Details not set'}</p>{event.source === 'booking' && <div className="mt-3 flex flex-wrap items-center gap-2"><SessionExpiryPill expiresAt={event.sessionExpiresAt} /><button onClick={() => setExtendTarget({ id: event.sourceId || event.id.replace('booking-','') })} className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors"><Timer className="w-3 h-3"/>Extend Session</button></div>}</div></div>)}{!loading && !error && selectedEvents.length === 0 && <div className="text-center py-20"><CalendarIcon className="w-16 h-16 text-slate-200 mx-auto mb-4"/><p className="text-slate-500 text-sm">Select a date with an event marker to view details.</p></div>}</div></Card></div>
    </div>
    {extendTarget && (
      <ExtendSessionModal
        bookingId={extendTarget.id}
        onClose={() => setExtendTarget(null)}
        onSuccess={(newExpiry) => {
          setEvents(prev => prev.map(e =>
            (e.sourceId === extendTarget.id || e.id === `booking-${extendTarget.id}`)
              ? { ...e, sessionExpiresAt: newExpiry }
              : e
          ));
          setExtendTarget(null);
        }}
      />
    )}
  </motion.div>;
}
