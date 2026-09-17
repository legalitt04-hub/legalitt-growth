import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { CreditCard, Download, TrendingUp, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import api from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { CountUp } from '../components/ui/count-up';

const Earnings = () => {
  const [data, setData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const [earnRes, revRes] = await Promise.all([
          api.get('/admin/earnings'),
          api.get(`/admin/revenue?period=${period}`)
        ]);
        
        setData(earnRes.data.data);

        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          last6Months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
        }
        
        const revMap: any = {};
        revRes.data.data.forEach((d: any) => {
          revMap[`${d._id.month}/${d._id.year}`] = { revenue: d.revenue, bookings: d.count };
        });

        if (period === 'monthly') {
          const formattedRev = last6Months.map(m => {
            const key = `${m.month}/${m.year}`;
            const existing = revMap[key] || { revenue: 0, bookings: 0 };
            return {
              name: `${m.month}/${m.year}`,
              revenue: existing.revenue,
              bookings: existing.bookings
            };
          });
          setRevenueData(formattedRev);
        } else setRevenueData((revRes.data.data || []).map((item: any) => ({ name: item.label, revenue: item.revenue || 0, bookings: item.count || 0 })));
      } catch (err) {
        console.error('Failed to load earnings', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, [period]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white/60 rounded-2xl border border-slate-200" />
          ))}
        </div>
        <div className="h-[350px] bg-white/60 rounded-2xl border border-slate-200" />
        <div className="h-[300px] bg-white/60 rounded-2xl border border-slate-200" />
      </div>
    );
  }

  const avgBookingValue = data?.avgBookingValue || 0;

  const handleExport = () => {
    if (!data?.topAdvocates) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Advocate Name,Email,Total Earned,Bookings\n"
      + data.topAdvocates.map((a: any) => `${a.user?.name},${a.user?.email},${a.totalEarned},${a.bookingCount}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `earnings_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statsCards = [
    { label: 'Total Platform Revenue', value: data?.totalRevenue || 0, sub: `${data?.totalBookings || 0} bookings`, color: 'from-teal-500 to-emerald-500', type: 'currency' },
    { label: "This Month's Revenue", value: data?.thisMonthRevenue || 0, sub: `${data?.thisMonthBookings || 0} bookings`, color: 'from-blue-500 to-indigo-500', type: 'currency' },
    { label: 'Avg. Booking Value', value: avgBookingValue, sub: 'Per paid booking', color: 'from-purple-500 to-pink-500', type: 'currency' },
    { label: 'Top Advocates', value: data?.topAdvocates?.length || 0, sub: 'Based on paid bookings', color: 'from-amber-500 to-orange-500', type: 'number' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-500" />
            Earnings & Analytics
          </h2>
          <p className="text-slate-500 text-sm mt-1">Platform revenue, payouts, and financial insights.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="h-9 px-3 bg-white border border-slate-200 text-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm">
            <option value="daily">Last 30 days</option><option value="weekly">Last 12 weeks</option><option value="monthly">Last 12 months</option><option value="yearly">Last 5 years</option>
          </select>
          <Button onClick={handleExport} variant="outline" className="bg-white border-slate-200 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-9 text-sm active:scale-95 transition-transform shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="bg-white border-slate-200 text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-9 text-sm active:scale-95 transition-transform shadow-sm">
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {statsCards.map((card, i) => (
          <motion.div 
            key={card.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className="bg-white/50 border-slate-200 p-4 md:p-5 backdrop-blur-sm relative overflow-hidden group h-full hover:border-slate-200 transition-colors">
              <div className={`absolute inset-0 bg-gradient-to-r ${card.color} rounded-xl blur-xl opacity-0 group-hover:opacity-[0.08] transition-opacity`} />
              <h3 className="text-[11px] md:text-xs font-medium text-slate-500 mb-2">{card.label}</h3>
              <p className="text-xl md:text-2xl font-bold text-slate-900">
                <CountUp to={Number(card.value)} type={card.type as any} />
              </p>
              <p className="text-[11px] text-slate-500 mt-2">{card.sub}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <Card className="p-4 md:p-6 bg-white/60 backdrop-blur-xl border-slate-200 rounded-2xl">
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <h3 className="text-base md:text-lg font-bold text-slate-900">Revenue Timeline</h3>
        </div>
        <div className="h-[250px] md:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} width={55} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', padding: '10px 14px' }}
                labelStyle={{ color: '#94A3B8', fontSize: '11px', marginBottom: '4px' }}
                formatter={(value: any) => [new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value) || 0), 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEarnings)" dot={false} activeDot={{ r: 5, fill: '#3B82F6', stroke: '#0F172A', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top Advocates */}
      <Card className="bg-white/50 border-slate-200 backdrop-blur-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-200">
          <h3 className="text-base md:text-lg font-bold text-slate-900">Top Earning Advocates</h3>
          <p className="text-xs text-slate-500 mt-0.5">Ranked by total earnings from paid bookings</p>
        </div>
        
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-800/50">
          {!data?.topAdvocates?.length ? (
            <div className="p-8 text-center text-slate-500 text-sm">No earnings data yet.</div>
          ) : (
            data.topAdvocates.map((adv: any, i: number) => (
              <div key={adv._id || i} className="p-4 flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-200">
                    {adv.user?.avatar ? <img src={adv.user.avatar} className="w-full h-full object-cover" /> : <span className="text-slate-600 text-sm">{adv.user?.name?.charAt(0) || '?'}</span>}
                  </div>
                  {i < 3 && <span className="absolute -top-1 -right-1 text-xs">{['🥇','🥈','🥉'][i]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{adv.user?.name || 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{adv.bookingCount} bookings</p>
                </div>
                <p className="font-bold text-teal-400 text-sm">{formatCurrency(adv.totalEarned)}</p>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="p-4 font-medium">Advocate</th>
                <th className="p-4 font-medium">Specializations</th>
                <th className="p-4 font-medium">Total Earned</th>
                <th className="p-4 font-medium">Bookings</th>
                <th className="p-4 font-medium">Avg / Booking</th>
              </tr>
            </thead>
            <tbody>
              {!data?.topAdvocates?.length ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">No earnings data yet.</td>
                </tr>
              ) : (
                data.topAdvocates.map((adv: any, i: number) => (
                  <tr 
                    key={adv._id || i} 
                    className="border-b border-slate-200/50 hover:bg-slate-50/20 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-200">
                            {adv.user?.avatar ? <img src={adv.user.avatar} className="w-full h-full object-cover" /> : <span className="text-slate-600 text-sm">{adv.user?.name?.charAt(0) || '?'}</span>}
                          </div>
                          {i < 3 && <span className="absolute -top-1 -right-1 text-xs">{['🥇','🥈','🥉'][i]}</span>}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{adv.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500">{adv.user?.email || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {(adv.advocate?.specializations || []).slice(0, 2).join(', ') || '—'}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-teal-400">{formatCurrency(adv.totalEarned)}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-slate-50 text-slate-600 rounded text-xs font-medium">
                        {adv.bookingCount}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-600">
                      {formatCurrency(adv.avgAmount || Math.round(adv.totalEarned / (adv.bookingCount || 1)))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
};

export default Earnings;
