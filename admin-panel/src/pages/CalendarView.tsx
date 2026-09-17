import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, Video, MapPin, Scale } from 'lucide-react';
import api from '../lib/api';

type CalendarEvent = { id: string; title: string; date: string; startTime?: string; endTime?: string; mode?: string; location?: string; advocateName?: string; status?: string; source: 'booking' | 'case' | 'advocate_hearing' };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

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
      <div><h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><CalendarIcon className="w-6 h-6 text-purple-500"/>Calendar & Schedule</h2><p className="text-slate-500 text-sm mt-1">Live consultations and case timeline hearings.</p></div>
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
            {loading ? <p className="text-sm text-slate-400">Loading schedule...</p> : error ? <p className="text-sm text-red-500">{error}</p> : selectedEvents.length === 0 ? <p className="text-sm text-slate-400">No scheduled events for this day.</p> : selectedEvents.map(event => <div key={event.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 border-l-4 border-l-purple-500"><h4 className="text-sm font-bold text-slate-900 mb-1 capitalize">{event.title}</h4><div className="space-y-1 text-xs text-slate-500">{(event.startTime || event.endTime) && <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{[event.startTime,event.endTime].filter(Boolean).join(' – ')}</span>}<span className="flex items-center gap-1 capitalize">{event.source === 'booking' ? <Video className="w-3 h-3"/> : <Scale className="w-3 h-3"/>}{event.location || event.mode || 'Details not set'}</span>{event.advocateName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>Adv. {event.advocateName}</span>}</div></div>)}
          </div>
        </Card>
      </div>
      <div className="lg:col-span-2"><Card className="bg-white border-slate-200 h-full min-h-[600px] p-6"><h3 className="text-lg font-bold text-slate-900">{selectedLabel}</h3><p className="text-sm text-slate-500 mt-1 mb-6">{selectedEvents.length} scheduled {selectedEvents.length === 1 ? 'event' : 'events'}</p><div className="space-y-3">{selectedEvents.map(event => <div key={`detail-${event.id}`} className="border border-slate-200 rounded-xl p-4 flex gap-4"><div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">{event.source === 'booking' ? <CalendarIcon className="w-5 h-5"/> : <Scale className="w-5 h-5"/>}</div><div><p className="font-semibold text-slate-900 capitalize">{event.title}</p><p className="text-sm text-slate-500 mt-1 capitalize">{event.status || 'Scheduled'} · {event.location || event.mode || 'Details not set'}</p></div></div>)}{!loading && !error && selectedEvents.length === 0 && <div className="text-center py-20"><CalendarIcon className="w-16 h-16 text-slate-200 mx-auto mb-4"/><p className="text-slate-500 text-sm">Select a date with an event marker to view details.</p></div>}</div></Card></div>
    </div>
  </motion.div>;
}
