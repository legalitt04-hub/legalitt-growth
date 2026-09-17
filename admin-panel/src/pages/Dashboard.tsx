import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Users, UserCheck, Briefcase, IndianRupee, AlertCircle,
  TrendingUp, TrendingDown, Brain, Activity, RefreshCw,
  CheckCircle2, XCircle, Star, FileText, Wallet, ShieldCheck
} from 'lucide-react';
import api from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  totalClients: number;
  totalAdvocates: number;
  activeAdvocates: number;
  pendingVerifications: number;
  totalBookings: number;
  completedBookings: number;
  totalRevenue: number;
  monthlyRevenue: number;
  todayRevenue: number;
  consultationModes: Array<{ name: string; value: number }>;
  newUsersThisMonth: number;
  userGrowth: number;
  pendingCases: number;
  completedCases: number;
  inProgressCases: number;
  todaysAppointments: number;
  averageRating: number | null;
  ratingCount: number;
  newBookingsThisMonth: number;
  completionRate: string | number;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KPICard = ({
  title, value, subtitle, icon: Icon, color, growth, growthLabel, trend
}: any) => {
  const isPositive = growth >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {growth !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(growth)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      {growthLabel && <p className="text-xs text-gray-400 mt-1">{growthLabel}</p>}
    </motion.div>
  );
};

// ─── Activity Timeline ─────────────────────────────────────────────────────────
const ActivityTimeline = ({ items }: { items: any[] }) => (
  <div className="space-y-3">
    {items.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No recent activity</p>}
    {items.map((item, i) => (
      <div key={i} className="flex gap-3 items-start">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs ${item.color || 'bg-teal-500'}`}>
          {item.icon || '•'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-snug">{item.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
        </div>
      </div>
    ))}
  </div>
);

const COLORS = ['#14b8a6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any>({ registrations: [], bookings: [], recentActivity: [] });
  const [systemHealthy, setSystemHealthy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, revenueRes, activityRes, healthRes] = await Promise.allSettled([
        api.get('/admin/stats'),
        api.get('/admin/revenue'),
        api.get('/admin/activity'),
        api.get('/admin/health'),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.data?.success) {
        setStats(statsRes.value.data.data);
      }
      if (revenueRes.status === 'fulfilled' && revenueRes.value.data?.success) {
        setRevenueData(revenueRes.value.data.data || []);
      }
      if (activityRes.status === 'fulfilled' && activityRes.value.data?.success) {
        setActivityData(activityRes.value.data.data || { registrations: [], bookings: [], recentActivity: [] });
      }
      setSystemHealthy(healthRes.status === 'fulfilled' && healthRes.value.data?.data?.database?.status === 'connected');
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const kpis = stats ? [
    { title: 'Total Users', value: stats.totalClients.toLocaleString(), icon: Users, color: 'bg-indigo-500', growth: stats.userGrowth, growthLabel: `+${stats.newUsersThisMonth} this month` },
    { title: 'Total Advocates', value: stats.totalAdvocates.toLocaleString(), icon: UserCheck, color: 'bg-teal-500', subtitle: `${stats.activeAdvocates} active` },
    { title: 'Active Cases', value: (stats.pendingCases + (stats.inProgressCases || 0)).toLocaleString(), icon: Briefcase, color: 'bg-violet-500', subtitle: `${stats.completedBookings} completed · ${stats.totalBookings} total` },
    { title: "Today's Revenue", value: `₹${stats.todayRevenue.toLocaleString()}`, icon: IndianRupee, color: 'bg-emerald-500', subtitle: `₹${(stats.totalRevenue / 1000).toFixed(1)}k total` },
    { title: 'Pending Verification', value: stats.pendingVerifications.toLocaleString(), icon: ShieldCheck, color: 'bg-red-500', subtitle: 'KYC pending' },
    { title: "Today's Consultations", value: stats.todaysAppointments.toLocaleString(), icon: Activity, color: 'bg-cyan-500', subtitle: 'Scheduled today' },
    { title: 'Avg Rating', value: stats.averageRating === null ? 'No ratings' : `${stats.averageRating}/5 ⭐`, icon: Star, color: 'bg-yellow-500', subtitle: `${stats.ratingCount || 0} verified reviews` },
  ] : [];

  // Consultation analytics data
  const consultationData = stats?.consultationModes?.map(item => ({
    name: item.name.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()),
    value: item.value,
  })) || [];

  // Case status data
  const caseData = stats ? [
    { name: 'Completed', value: stats.completedCases, fill: '#14b8a6' },
    { name: 'Pending', value: stats.pendingCases, fill: '#f59e0b' },
    { name: 'In Progress', value: stats.inProgressCases || 0, fill: '#6366f1' },
  ] : [];

  // Recent activity timeline items
  const timelineItems = (activityData.recentActivity || []).map((item: any) => ({
    title: item.title,
    time: new Date(item.createdAt).toLocaleString('en-IN'),
    color: item.type === 'registration' ? 'bg-blue-500' : 'bg-teal-500',
    icon: item.type === 'registration' ? '👤' : '📋',
  }));
  const userGrowthData = (activityData.registrations || []).map((item: any) => ({
    day: `${item._id.day}/${item._id.month}`,
    users: item.count,
  }));

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-[110px] bg-gray-100 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-[300px] bg-gray-100 rounded-2xl lg:col-span-2" />
          <div className="h-[300px] bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Platform overview & real-time analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {systemHealthy ? 'System Healthy' : 'System Check Required'}
          </span>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-full hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh · {lastUpdated.toLocaleTimeString()}
          </button>
        </div>
      </div>

      {/* 8 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <KPICard key={i} {...kpi} />
        ))}
      </div>

      {/* Revenue + Consultation Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900">Revenue Analytics</h3>
              <p className="text-xs text-gray-400 mt-0.5">Monthly revenue trend</p>
            </div>
            <span className="text-sm font-bold text-emerald-600">₹{((stats?.totalRevenue || 0) / 1000).toFixed(1)}k total</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={2.5} fill="url(#revenueGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Consultation Mode Pie */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-1">Consultation Types</h3>
          <p className="text-xs text-gray-400 mb-4">Distribution by mode</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={consultationData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {consultationData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {consultationData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-gray-600">{d.name}</span>
                </div>
                <span className="font-bold text-gray-800">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Growth + Case Stats + Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Growth Bar Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-1">User Growth</h3>
          <p className="text-xs text-gray-400 mb-4">New registrations by month</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={userGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="users" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Case Statistics */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-1">Case Statistics</h3>
          <p className="text-xs text-gray-400 mb-4">Status breakdown</p>
          <div className="space-y-3 mt-2">
            {caseData.map((d, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">{d.name}</span>
                  <span className="font-bold" style={{ color: d.fill }}>{d.value}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (d.value / Math.max(1, stats?.totalBookings || 1)) * 100)}%`, background: d.fill }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-teal-600">{stats?.completionRate || 0}%</p>
              <p className="text-xs text-gray-400">Completion Rate</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-indigo-600">{stats?.averageRating || 0}</p>
              <p className="text-xs text-gray-400">Avg Rating</p>
            </div>
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Recent Activity</h3>
          <ActivityTimeline items={timelineItems} />
        </div>
      </div>

      {/* Platform Health KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Booking Completion', value: `${stats?.completionRate || 0}%`, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: 'New Users (month)', value: stats?.newUsersThisMonth || 0, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: <Users className="w-4 h-4" /> },
          { label: 'New Bookings (month)', value: stats?.newBookingsThisMonth || 0, color: 'text-violet-600', bg: 'bg-violet-50', icon: <Briefcase className="w-4 h-4" /> },
          { label: 'Platform Revenue', value: `₹${((stats?.totalRevenue || 0) / 1000).toFixed(1)}k`, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <Wallet className="w-4 h-4" /> },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className={`inline-flex items-center gap-1.5 ${item.color} ${item.bg} px-2 py-1 rounded-lg text-xs font-semibold mb-2`}>
              {item.icon} Platform Health
            </div>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-gray-500 mt-1">{item.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default Dashboard;
