import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Plus, Edit2, Trash2, X, Check, RefreshCw,
  User, Lock, Eye, EyeOff, ToggleLeft, ToggleRight, Key,
  ChevronRight, Activity
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface AdminAccount {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  displayRole: string;
  isActive: boolean;
  lastSeen?: string;
  createdAt: string;
  permissions: string[];
}

interface RoleInfo {
  key: string;
  display: string;
  permissions: string[];
}

const ROLE_COLORS: Record<string, string> = {
  super_admin:           'bg-red-100 text-red-700 border-red-200',
  admin:                 'bg-indigo-100 text-indigo-700 border-indigo-200',
  support_executive:     'bg-blue-100 text-blue-700 border-blue-200',
  accounts:              'bg-emerald-100 text-emerald-700 border-emerald-200',
  forensic_expert:       'bg-violet-100 text-violet-700 border-violet-200',
  property_verification: 'bg-amber-100 text-amber-700 border-amber-200',
};

const PERMISSION_LABELS: Record<string, string> = {
  dashboard: '📊 Dashboard', users: '👥 Users', advocates: '⚖️ Advocates',
  cases: '📁 Cases', consultations: '💬 Consultations', ads: '📣 Ads',
  roles: '🔐 Roles', earnings: '💰 Earnings', withdrawals: '🏦 Withdrawals',
  settings: '⚙️ Settings', support: '🎧 Support', reviews: '⭐ Reviews',
  reports: '📈 Reports', audit: '🔍 Audit Logs', notifications: '🔔 Notifications',
};

const EMPTY_FORM = { name: '', email: '', phone: '', role: '', password: '' };

export default function RoleManagement() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminAccount | null>(null);
  const [newPw, setNewPw] = useState('');
  const [resetting, setResetting] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AdminAccount | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, roleRes] = await Promise.allSettled([
        api.get('/admin/roles/accounts', { params: { role: roleFilter || undefined } }),
        api.get('/admin/roles/permissions'),
      ]);
      if (accRes.status === 'fulfilled') setAccounts(accRes.value.data?.data || []);
      if (roleRes.status === 'fulfilled') setRoles(roleRes.value.data?.data?.roles || []);
    } catch { }
    finally { setLoading(false); }
  }, [roleFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [formError, setFormError] = useState('');

  const handleCreate = async () => {
    setFormError('');
    if (!form.name || !form.email || !form.password || !form.role) {
      setFormError('Name, email, password, and role selection are required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/roles/accounts', form);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setFormError('');
      fetchData();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Failed to create admin account.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (acc: AdminAccount) => {
    try {
      await api.patch(`/admin/roles/accounts/${acc._id}`, { isActive: !acc.isActive });
      fetchData();
    } catch { alert('Failed to update status.'); }
  };

  const handleResetPassword = async () => {
    if (!newPw || newPw.length < 8) return alert('Min 8 characters required.');
    setResetting(true);
    try {
      await api.post(`/admin/roles/accounts/${resetTarget!._id}/reset-password`, { password: newPw });
      setResetTarget(null);
      setNewPw('');
      alert('Password reset successfully!');
    } catch (e: any) { alert(e?.response?.data?.message || 'Failed.'); }
    finally { setResetting(false); }
  };

  const handleRemoveRole = async (acc: AdminAccount) => {
    if (!window.confirm(`Are you sure you want to remove ${acc.name} from the admin team and revoke their role?`)) return;
    try {
      await api.delete(`/admin/roles/accounts/${acc._id}`);
      fetchData();
    } catch {
      setFormError('Failed to revoke role.');
    }
  };

  const filteredAccounts = roleFilter
    ? accounts.filter(a => a.role === roleFilter)
    : accounts;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role-Based Access Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage admin accounts, roles and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><RefreshCw className="w-4 h-4" /></button>
          {isSuperAdmin && (
            <button onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700">
              <Plus className="w-4 h-4" /> Add Admin Account
            </button>
          )}
        </div>
      </div>

      {/* Role Permission Matrix */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Permission Matrix</h3>
          <p className="text-xs text-gray-400 mt-0.5">Default permissions per role</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Permission</th>
                {roles.map(r => (
                  <th key={r.key} className="px-3 py-3 text-center font-semibold text-gray-500 whitespace-nowrap">{r.display}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.keys(PERMISSION_LABELS).map(perm => (
                <tr key={perm} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium text-gray-700">{PERMISSION_LABELS[perm]}</td>
                  {roles.map(r => (
                    <td key={r.key} className="px-3 py-2.5 text-center">
                      {r.permissions.includes(perm)
                        ? <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                        : <X className="w-4 h-4 text-gray-200 mx-auto" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-bold text-gray-900">Admin Accounts ({filteredAccounts.length})</h3>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none">
            <option value="">All Roles</option>
            {roles.map(r => <option key={r.key} value={r.key}>{r.display}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Loading...</div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No admin accounts found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredAccounts.map(acc => (
              <div key={acc._id} className="p-4 hover:bg-gray-50/50 flex items-center gap-4 transition-colors">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {acc.name[0]?.toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{acc.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLORS[acc.role] || 'bg-gray-100 text-gray-600'}`}>
                      {acc.displayRole}
                    </span>
                    {!acc.isActive && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">Disabled</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{acc.email} {acc.phone ? `· ${acc.phone}` : ''}</p>
                </div>
                {/* Permissions count */}
                <div className="hidden md:flex items-center gap-1 text-xs text-gray-400">
                  <Key className="w-3 h-3" /> {acc.permissions.length} perms
                </div>
                {/* Last seen */}
                <div className="hidden lg:block text-xs text-gray-400 w-28 text-right">
                  {acc.lastSeen ? new Date(acc.lastSeen).toLocaleDateString() : 'Never'}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedAccount(acc)} title="View permissions"
                    className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {isSuperAdmin && acc._id !== user?._id && (
                    <>
                      <button onClick={() => handleToggleStatus(acc)} title={acc.isActive ? 'Disable' : 'Enable'}
                        className={`p-1.5 rounded-lg transition-colors ${acc.isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                        {acc.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { setResetTarget(acc); setNewPw(''); }} title="Reset password"
                        className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleRemoveRole(acc)} title="Revoke admin role & remove from team"
                        className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permissions Detail Modal */}
      <AnimatePresence>
        {selectedAccount && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Permissions — {selectedAccount.name}</h3>
                <button onClick={() => setSelectedAccount(null)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold border mb-4 inline-block ${ROLE_COLORS[selectedAccount.role]}`}>{selectedAccount.displayRole}</span>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {Object.keys(PERMISSION_LABELS).map(perm => (
                  <div key={perm} className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium ${selectedAccount.permissions.includes(perm) ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-400'}`}>
                    {selectedAccount.permissions.includes(perm) ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {PERMISSION_LABELS[perm]}
                  </div>
                ))}
              </div>
              <button onClick={() => setSelectedAccount(null)} className="mt-5 w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Account Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Create Admin Account</h2>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="p-5 space-y-4">
                {/* Anti Chrome Autofill Dummy Inputs */}
                <input type="text" name="prevent_autofill_email" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
                <input type="password" name="prevent_autofill_pass" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center justify-between">
                    <span>{formError}</span>
                    <button onClick={() => setFormError('')}><X className="w-4 h-4 text-red-500" /></button>
                  </div>
                )}
                {[
                  { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'e.g. Rahul Sharma', name: 'new_admin_fullname' },
                  { label: 'Email *', key: 'email', type: 'email', placeholder: 'e.g. rahul@legalitt.com', name: 'new_admin_user_email' },
                  { label: 'Phone', key: 'phone', type: 'tel', placeholder: 'e.g. 9876543210', name: 'new_admin_user_phone' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                    <input type={f.type} name={f.name} value={form[f.key] || ''} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                      autoComplete="new-password"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder={f.placeholder} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Role *</label>
                  <select value={form.role || ''} onChange={e => setForm((p: any) => ({ ...p, role: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
                    <option value="" disabled>Select Role...</option>
                    {(roles.length > 0 ? roles : [
                      { key: 'support_executive', display: 'Support Executive' },
                      { key: 'admin', display: 'Admin' },
                      { key: 'accounts', display: 'Accounts' },
                      { key: 'forensic_expert', display: 'Forensic Expert' },
                      { key: 'property_verification', display: 'Property Verification' },
                      { key: 'super_admin', display: 'Super Admin' },
                    ]).map(r => <option key={r.key} value={r.key}>{r.display}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Password *</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} name="new_admin_password_sec" autoComplete="new-password" value={form.password || ''} onChange={e => setForm((p: any) => ({ ...p, password: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Min 8 characters" />
                    <button onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50">Cancel</button>
                  <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50">
                    {saving ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resetTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
                <button onClick={() => setResetTarget(null)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Resetting password for <strong>{resetTarget.name}</strong></p>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none" placeholder="New password (min 8 chars)" />
                <button onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setResetTarget(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl">Cancel</button>
                <button onClick={handleResetPassword} disabled={resetting} className="flex-1 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 disabled:opacity-50">
                  {resetting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
