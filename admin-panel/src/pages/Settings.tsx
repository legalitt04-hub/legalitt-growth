import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/card';
import { Settings as SettingsIcon, Save, Megaphone, Activity, Upload } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import api from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

const Settings = () => {
  const [settings, setSettings] = useState<any>({
    commissionRate: 15,
    minFee: 200,
    maxAdvanceBookingDays: 30,
    maintenanceMode: false,
    branding: { primaryColor: '#f59e0b', logoUrl: '/logo.png', faviconUrl: '/logo.png' },
    sessionDuration: { chat: 24, voice: 1, video: 1 },
    sessionExtensionEnabled: true,
    maxExtensionHours: 24,
    features: { aiEnabled: false, pushEnabled: false, registrationsEnabled: true, googleEnabled: true },
    announcement: { text: '', type: '' }
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [uploadingAsset, setUploadingAsset] = useState<'logo' | 'favicon' | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [setRes, logsRes] = await Promise.all([
        api.get('/admin/settings'),
        api.get('/admin/logs?page=1&limit=20')
      ]);
      if (setRes.data.data) setSettings(setRes.data.data);
      if (logsRes.data.data) setLogs(logsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback('');
    try {
      const response = await api.put('/admin/settings', settings);
      if (response.data?.data) setSettings(response.data.data);
      window.dispatchEvent(new CustomEvent('legalitt-branding-updated', { detail: response.data?.data?.branding || settings.branding }));
      setFeedback('Settings saved successfully!');
      setTimeout(() => setFeedback(''), 3000);
    } catch (err: any) {
      setFeedback(`Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: any, isFeature = false) => {
    if (isFeature) {
      setSettings((prev: any) => ({ ...prev, features: { ...prev.features, [field]: value } }));
    } else {
      setSettings((prev: any) => ({ ...prev, [field]: value }));
    }
  };

  const handleAnnouncementChange = (field: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, announcement: { ...prev.announcement, [field]: value } }));
  };

  const handleBrandingChange = (field: string, value: string) => {
    setSettings((prev: any) => ({ ...prev, branding: { ...prev.branding, [field]: value } }));
  };

  const handleSessionDuration = (mode: string, value: number) => setSettings((prev: any) => ({ ...prev, sessionDuration: { ...prev.sessionDuration, [mode]: value } }));

  const handleBrandUpload = async (type: 'logo' | 'favicon', file?: File) => {
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (!allowedTypes.includes(file.type)) {
      setFeedback('Error: Use a PNG, JPG, WEBP or ICO image.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setFeedback('Error: Branding images must be 1 MB or smaller.');
      return;
    }
    const body = new FormData(); body.append('file', file); body.append('type', type); setUploadingAsset(type); setFeedback('');
    try {
      const response = await api.post('/admin/settings/branding-upload', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSettings((prev: any) => ({ ...prev, branding: response.data.data.branding }));
      window.dispatchEvent(new CustomEvent('legalitt-branding-updated', { detail: response.data.data.branding }));
      setFeedback(`${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully.`);
    } catch (err: any) { setFeedback(`Error: ${err.response?.data?.message || err.message}`); }
    finally {
      setUploadingAsset(null);
      if (type === 'logo' && logoInputRef.current) logoInputRef.current.value = '';
      if (type === 'favicon' && faviconInputRef.current) faviconInputRef.current.value = '';
    }
  };

  if (loading) return <div className="flex justify-center items-center py-20"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-8"
    >
      <div className="xl:col-span-2 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
          <div className="flex items-center gap-3">
            {feedback && <span className={`text-sm ${feedback.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>{feedback}</span>}
            <Button onClick={handleSave} disabled={saving} className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-medium">
              {saving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
            </Button>
          </div>
        </div>

        {/* Financial & Bookings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-white/50 border-slate-200 p-8 backdrop-blur-sm space-y-8">
          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-teal-500" />
              Financial & Booking Rules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-500">Commission Rate (%)</label>
                <Input 
                  type="number" 
                  value={settings.commissionRate} 
                  onChange={(e) => handleChange('commissionRate', Number(e.target.value))}
                  className="bg-slate-50/50 border-slate-200 text-slate-900" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-500">Min Consultation Fee (₹)</label>
                <Input 
                  type="number" 
                  value={settings.minFee} 
                  onChange={(e) => handleChange('minFee', Number(e.target.value))}
                  className="bg-slate-50/50 border-slate-200 text-slate-900" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-500">Max Advance Booking (Days)</label>
                <Input 
                  type="number" 
                  value={settings.maxAdvanceBookingDays} 
                  onChange={(e) => handleChange('maxAdvanceBookingDays', Number(e.target.value))}
                  className="bg-slate-50/50 border-slate-200 text-slate-900" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-500">Post-Consultation Expiry (Hours)</label>
                <Input 
                  type="number" 
                  value={settings.postConsultationBufferHours ?? 24} 
                  onChange={(e) => handleChange('postConsultationBufferHours', Number(e.target.value))}
                  className="bg-slate-50/50 border-slate-200 text-slate-900" 
                />
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Consultation session duration (hours)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{['chat','voice','video'].map(mode => <div key={mode}><label className="text-xs capitalize text-slate-500">{mode}</label><Input type="number" min="1" value={settings.sessionDuration?.[mode] ?? 1} onChange={e => handleSessionDuration(mode, Number(e.target.value))}/></div>)}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={settings.sessionExtensionEnabled ?? true} onChange={e => handleChange('sessionExtensionEnabled', e.target.checked)}/>Allow session extensions</label><div><label className="text-xs text-slate-500">Maximum extension hours</label><Input type="number" min="1" value={settings.maxExtensionHours ?? 24} onChange={e => handleChange('maxExtensionHours', Number(e.target.value))}/></div></div>
            </div>
          </div>
        </Card>
        </motion.div>

        {/* Branding & Appearance */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="bg-white/50 border-slate-200 p-8 backdrop-blur-sm space-y-8">
          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-teal-500" />
              Branding & Appearance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-500">Primary Brand Color</label>
                <div className="flex gap-3">
                  <input type="color" value={settings.branding?.primaryColor || '#f59e0b'} onChange={(e) => handleBrandingChange('primaryColor', e.target.value)} className="w-10 h-10 rounded border border-slate-200 shrink-0" />
                  <Input 
                    type="text" 
                    value={settings.branding?.primaryColor || '#f59e0b'}
                    onChange={(e) => handleBrandingChange('primaryColor', e.target.value)}
                    className="bg-slate-50/50 border-slate-200 text-slate-900" 
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Used for the portal navigation accent.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Company Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center p-2 border border-slate-200">
                      <img src={settings.branding?.logoUrl || '/logo.png'} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                    <input ref={logoInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.ico" className="hidden" onChange={e => handleBrandUpload('logo', e.target.files?.[0])}/><Button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingAsset === 'logo'} variant="outline"><Upload className="w-4 h-4 mr-2"/>{uploadingAsset === 'logo' ? 'Uploading...' : 'Upload logo'}</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-500">Favicon</label>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded border border-slate-200 p-1 bg-slate-100 flex items-center justify-center">
                      <img src={settings.branding?.faviconUrl || '/logo.png'} alt="Favicon" className="max-w-full max-h-full object-contain" />
                    </div>
                    <input ref={faviconInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.ico" className="hidden" onChange={e => handleBrandUpload('favicon', e.target.files?.[0])}/><Button type="button" onClick={() => faviconInputRef.current?.click()} disabled={uploadingAsset === 'favicon'} variant="outline"><Upload className="w-4 h-4 mr-2"/>{uploadingAsset === 'favicon' ? 'Uploading...' : 'Upload favicon'}</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
        </motion.div>

        {/* Feature Flags */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-white/50 border-slate-200 p-8 backdrop-blur-sm">
          <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-teal-500" />
            Feature Flags
          </h3>
          <div className="space-y-4">
            {[
              { id: 'aiEnabled', label: 'AI Legal Assistant', desc: 'Enable AI assistant for clients' },
              { id: 'pushEnabled', label: 'Push Notifications', desc: 'Deliver push notifications via FCM' },
              { id: 'registrationsEnabled', label: 'New Registrations', desc: 'Allow new users to sign up' },
              { id: 'googleEnabled', label: 'Google Sign-In', desc: 'Enable Google OAuth login' },
            ].map((f) => (
              <div key={f.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/30">
                <div>
                  <p className="font-medium text-slate-900">{f.label}</p>
                  <p className="text-sm text-slate-500">{f.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.features[f.id]} onChange={(e) => handleChange(f.id, e.target.checked, true)} />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                </label>
              </div>
            ))}
            <div className="flex items-center justify-between p-4 rounded-xl border border-red-500/20 bg-red-500/5">
              <div>
                <p className="font-medium text-red-400">Maintenance Mode</p>
                <p className="text-sm text-red-400/70">Blocks all client-facing app access</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={settings.maintenanceMode} onChange={(e) => handleChange('maintenanceMode', e.target.checked)} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>
          </div>
        </Card>
        </motion.div>

        {/* Announcement Banner */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-white/50 border-slate-200 p-8 backdrop-blur-sm">
          <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-teal-500" />
            Announcement Banner
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500">Message</label>
              <textarea 
                value={settings.announcement?.text || ''}
                onChange={(e) => handleAnnouncementChange('text', e.target.value)}
                rows={3} 
                className="w-full bg-slate-50/50 border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
                placeholder="e.g. System maintenance on Sunday..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500">Banner Type</label>
              <select 
                value={settings.announcement?.type || ''}
                onChange={(e) => handleAnnouncementChange('type', e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-teal-500/50 appearance-none"
              >
                <option value="">None — Hide Banner</option>
                <option value="info">ℹ️ Info (blue)</option>
                <option value="warning">⚠️ Warning (amber)</option>
                <option value="success">✅ Success (green)</option>
              </select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full bg-slate-50 hover:bg-slate-100 text-slate-900">Publish Announcement</Button>
          </div>
        </Card>
        </motion.div>
      </div>

      {/* Activity Logs Sidebar */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="xl:col-span-1"
      >
        <Card className="bg-white/50 border-slate-200 backdrop-blur-sm flex flex-col h-full max-h-[calc(100vh-120px)] sticky top-24">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-500" />
              Activity Logs
            </h3>
            <button onClick={fetchData} className="text-xs text-teal-400 hover:text-teal-300">Refresh</button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto hidden-scrollbar space-y-4">
            {logs.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-10">No activity yet.</div>
            ) : (
              logs.map((log, i) => (
                <div key={log._id || i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-sm flex-shrink-0">
                    {log.type === 'booking' ? '📅' : log.type === 'user' ? '👤' : '🔍'}
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">{log.action}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default Settings;
