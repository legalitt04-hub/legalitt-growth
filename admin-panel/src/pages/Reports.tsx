import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/card';
import { BarChart3, Download, FileSpreadsheet, FileText, Calendar, Filter } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../lib/api';

export default function Reports() {
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const reportDetailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await api.get(`/admin/revenue?period=${period}`);
        if (res.data?.success && Array.isArray(res.data.data)) {
          const formatted = res.data.data.map((item: any) => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = months[(item._id?.month || 1) - 1];
            return {
              name: item.label || `${monthName} ${item._id?.year || ''}`,
              year: item._id?.year,
              cases: item.count || 0,
              revenue: Math.round((item.revenue || 0) / 1000)
            };
          });
          setReportData(formatted);
        }
      } catch (err) {
        console.error('Failed to load reports data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [period]);

  const exportCsv = () => {
    const rows = [['Period', 'Paid bookings', 'Revenue'], ...reportData.map(row => [row.name, row.cases, row.revenue * 1000])];
    const blob = new Blob([rows.map(row => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `legalitt-report-${period}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-500" />
            Reports & Analytics
          </h2>
          <p className="text-slate-500 text-sm mt-1">Generate and export detailed platform insights.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export CSV
          </button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <Card className="p-4 bg-white border-slate-200 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Date Range</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select value={period} onChange={e => setPeriod(e.target.value)} className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700"><option value="daily">Last 30 days</option><option value="weekly">Last 12 weeks</option><option value="monthly">Last 12 months</option><option value="yearly">Last 5 years</option></select>
          </div>
        </div>
        <div className="flex-1 min-w-[200px]"><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Report Type</label><div className="h-10 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700"><Filter className="w-4 h-4 mr-2"/>Paid booking revenue</div></div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 bg-white border-slate-200 h-[400px] flex flex-col">
          <h3 className="font-bold text-slate-900 mb-6">Cases vs Revenue (YTD)</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="cases" name="Cases Handled" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="revenue" name="Revenue (k)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card ref={reportDetailRef} className="p-5 bg-white border-slate-200 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900">Generated Report Details</h3>
            <button onClick={() => reportDetailRef.current?.requestFullscreen?.()} className="text-teal-600 text-sm font-medium hover:underline">View Full Screen</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <th className="p-3">Month</th>
                  <th className="p-3">Cases Handled</th>
                  <th className="p-3 text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.length === 0 ? (
                  <tr><td colSpan={3} className="p-6 text-center text-slate-400">No report data recorded</td></tr>
                ) : (
                  reportData.map((row) => (
                    <tr key={row.name} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-medium text-slate-900">{row.name}</td>
                      <td className="p-3 text-slate-600">{row.cases}</td>
                      <td className="p-3 text-right text-slate-600 font-medium font-mono">₹{(row.revenue * 1000).toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
