import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { History, Shield, Clock, FileText } from 'lucide-react';
import api from '../lib/api';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const res = await api.get('/admin/audit-logs');
        if (res.data?.success) {
          setLogs(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load audit logs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAuditLogs();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-amber-500" />
          System Audit & Security Logs
        </h2>
        <p className="text-slate-500 text-sm mt-1">Real-time audit stream tracking admin actions, user role modifications, status changes, and payment events.</p>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">Activity Log Trail</span>
          <span className="text-xs text-slate-500 font-medium">Recent 100 Events</span>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No security audit logs recorded yet. System activities will log here dynamically.</div>
          ) : (
            logs.map(log => (
              <div key={log._id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">{log.action}</span>
                    <span className="text-slate-500">By: <strong className="text-slate-700">{log.user?.name || log.user?.email || 'System'}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-500">
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{log.ipAddress || 'Not recorded'}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(log.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </motion.div>
  );
}
