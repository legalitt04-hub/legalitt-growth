import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { UserCog, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function Admins() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdmins = async () => {
    try {
      const res = await api.get('/admin/admins');
      if (res.data?.success) {
        setAdmins(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load admins', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleRevoke = async (id: string, name: string) => {
    if (!window.confirm(`Revoke admin role from ${name}?`)) return;
    try {
      await api.delete(`/admin/roles/accounts/${id}`);
      fetchAdmins();
    } catch {
      alert('Failed to revoke role');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCog className="w-6 h-6 text-amber-500" />
            Admin Team & Access Management
          </h2>
          <p className="text-slate-500 text-sm mt-1">Manage system administrators, granular permissions, and operational access levels.</p>
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">System Administrators</span>
          <span className="text-xs text-slate-500 font-medium">Total: {admins.length} Members</span>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading admin accounts...</div>
          ) : admins.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No admin accounts found.</div>
          ) : (
            admins.map(adm => (
              <div key={adm._id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                    {adm.name?.charAt(0) || 'A'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{adm.name}</h4>
                    <p className="text-xs text-slate-500">{adm.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 uppercase text-xs font-semibold">
                    {adm.role || 'Admin'}
                  </Badge>
                  <Badge variant="outline" className={adm.isActive !== false ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                    {adm.isActive !== false ? 'Active' : 'Suspended'}
                  </Badge>
                  {isSuperAdmin && adm._id !== user?._id && (
                    <button onClick={() => handleRevoke(adm._id, adm.name)} title="Revoke admin role"
                      className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </motion.div>
  );
}
