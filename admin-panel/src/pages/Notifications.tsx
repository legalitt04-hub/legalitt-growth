import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Bell, Search, Send, MessageSquare, Mail, Smartphone, Edit2, Trash2, X } from 'lucide-react';
import { Input } from '../components/ui/input';
import api from '../lib/api';

const timeAgo = (value: string) => {
  const time = new Date(value).getTime(); if (!value || Number.isNaN(time)) return 'Never';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes} min ago`; if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`; return `${Math.floor(minutes / 1440)} days ago`;
};

const emptyBroadcast = { title: '', message: '', targetAudience: 'all' };
const emptyTemplate = { name: '', channel: 'push', triggerEvent: 'broadcast', titleTemplate: '', bodyTemplate: '', targetAudience: 'all', isActive: true };

export default function Notifications() {
  const [search, setSearch] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalSent: 0, sentToday: 0, unread: 0, activeTemplates: 0 });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [modal, setModal] = useState<'broadcast' | 'template' | null>(null);
  const [broadcast, setBroadcast] = useState(emptyBroadcast);
  const [template, setTemplate] = useState<any>(emptyTemplate);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [templateRes, statsRes] = await Promise.all([api.get('/admin/notifications/templates'), api.get('/admin/notifications/stats')]);
      setTemplates(templateRes.data?.data || []); setStats(statsRes.data?.data || { totalSent: 0, sentToday: 0, unread: 0, activeTemplates: 0 });
    } catch (err: any) { setFeedback(err.response?.data?.message || 'Notifications could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const sendBroadcast = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { const res = await api.post('/admin/notifications/broadcast', broadcast); setFeedback(`Broadcast sent to ${res.data?.data?.recipients || 0} users.`); setBroadcast(emptyBroadcast); setModal(null); await fetchData(); }
    catch (err: any) { setFeedback(err.response?.data?.message || 'Broadcast failed.'); }
    finally { setSaving(false); }
  };
  const saveTemplate = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { if (template._id) await api.put(`/admin/notifications/templates/${template._id}`, template); else await api.post('/admin/notifications/templates', template); setFeedback('Template saved.'); setModal(null); await fetchData(); }
    catch (err: any) { setFeedback(err.response?.data?.message || 'Template could not be saved.'); }
    finally { setSaving(false); }
  };
  const deleteTemplate = async (id: string) => {
    if (!window.confirm('Delete this notification template?')) return;
    try { await api.delete(`/admin/notifications/templates/${id}`); setFeedback('Template deleted.'); await fetchData(); }
    catch (err: any) { setFeedback(err.response?.data?.message || 'Template could not be deleted.'); }
  };
  const cards = [
    { label: 'Sent Today', value: stats.sentToday, icon: Send, color: 'bg-sky-100 text-sky-600' },
    { label: 'Total Sent', value: stats.totalSent, icon: Mail, color: 'bg-indigo-100 text-indigo-600' },
    { label: 'Unread', value: stats.unread, icon: Smartphone, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Active Templates', value: stats.activeTemplates, icon: MessageSquare, color: 'bg-amber-100 text-amber-600' },
  ];
  const filtered = templates.filter(item => item.name?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"/></div>;
  return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Bell className="w-6 h-6 text-sky-500"/>Notifications Hub</h2><p className="text-slate-500 text-sm mt-1">Live in-app notification totals, templates and broadcasts.</p></div><div className="flex gap-2"><button onClick={() => { setTemplate(emptyTemplate); setModal('template'); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium">New Template</button><button onClick={() => setModal('broadcast')} className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 font-medium text-sm shadow-sm flex items-center gap-2"><Send className="w-4 h-4"/>New Broadcast</button></div></div>
    {feedback && <div className="p-3 rounded-lg bg-sky-50 text-sky-700 text-sm">{feedback}</div>}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">{cards.map(card => { const Icon = card.icon; return <Card key={card.label} className="p-5 bg-white border-slate-200"><div className="flex items-center gap-3"><div className={`p-3 ${card.color} rounded-xl`}><Icon className="w-5 h-5"/></div><div><p className="text-sm font-medium text-slate-500">{card.label}</p><p className="text-2xl font-bold text-slate-900">{card.value.toLocaleString('en-IN')}</p></div></div></Card>; })}</div>
    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4"><h3 className="font-bold text-slate-900">Notification Templates</h3><div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/><Input placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9"/></div></div>
      <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-slate-50 text-xs uppercase text-slate-500 border-b"><th className="p-4">Template</th><th className="p-4">Audience</th><th className="p-4">Channel</th><th className="p-4">Updated</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y">{filtered.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">No notification templates found.</td></tr> : filtered.map(item => <tr key={item._id}><td className="p-4 font-bold text-slate-900">{item.name}</td><td className="p-4"><Badge variant="outline" className="capitalize">{item.targetAudience}</Badge></td><td className="p-4 text-sm uppercase text-slate-600">{item.channel}</td><td className="p-4 text-sm text-slate-500">{timeAgo(item.updatedAt)}</td><td className="p-4"><span className={`text-xs px-2 py-1 rounded-full ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.isActive ? 'Active' : 'Draft'}</span></td><td className="p-4"><div className="flex justify-end gap-2"><button onClick={() => { setTemplate(item); setModal('template'); }} className="p-1.5 border rounded-md"><Edit2 className="w-4 h-4"/></button><button onClick={() => deleteTemplate(item._id)} className="p-1.5 border rounded-md text-red-500"><Trash2 className="w-4 h-4"/></button></div></td></tr>)}</tbody></table></div>
    </Card>
    {modal && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6"><div className="flex justify-between mb-5"><h3 className="font-bold text-lg">{modal === 'broadcast' ? 'Send Broadcast' : template._id ? 'Edit Template' : 'New Template'}</h3><button onClick={() => setModal(null)}><X className="w-5 h-5"/></button></div>{modal === 'broadcast' ? <form onSubmit={sendBroadcast} className="space-y-4"><Input required placeholder="Title" value={broadcast.title} onChange={e => setBroadcast({ ...broadcast, title: e.target.value })}/><textarea required rows={4} placeholder="Message" value={broadcast.message} onChange={e => setBroadcast({ ...broadcast, message: e.target.value })} className="w-full border rounded-md p-3"/><select value={broadcast.targetAudience} onChange={e => setBroadcast({ ...broadcast, targetAudience: e.target.value })} className="w-full border rounded-md p-2"><option value="all">All users</option><option value="clients">Clients</option><option value="advocates">Advocates</option></select><button disabled={saving} className="w-full bg-sky-500 text-white rounded-lg py-2">{saving ? 'Sending...' : 'Send Broadcast'}</button></form> : <form onSubmit={saveTemplate} className="space-y-4"><Input required placeholder="Template name" value={template.name} onChange={e => setTemplate({ ...template, name: e.target.value })}/><div className="grid grid-cols-2 gap-3"><select value={template.channel} onChange={e => setTemplate({ ...template, channel: e.target.value })} className="border rounded-md p-2"><option value="push">Push</option><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select><select value={template.targetAudience} onChange={e => setTemplate({ ...template, targetAudience: e.target.value })} className="border rounded-md p-2"><option value="all">All</option><option value="clients">Clients</option><option value="advocates">Advocates</option></select></div><Input required placeholder="Trigger event" value={template.triggerEvent} onChange={e => setTemplate({ ...template, triggerEvent: e.target.value })}/><Input required placeholder="Notification title" value={template.titleTemplate} onChange={e => setTemplate({ ...template, titleTemplate: e.target.value })}/><textarea required rows={4} placeholder="Notification body" value={template.bodyTemplate} onChange={e => setTemplate({ ...template, bodyTemplate: e.target.value })} className="w-full border rounded-md p-3"/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={template.isActive} onChange={e => setTemplate({ ...template, isActive: e.target.checked })}/>Active</label><button disabled={saving} className="w-full bg-sky-500 text-white rounded-lg py-2">{saving ? 'Saving...' : 'Save Template'}</button></form>}</div></div>}
  </motion.div>;
}
