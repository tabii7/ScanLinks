import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  BarChart3,
  FileText,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ModernAdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/admin');
      console.log('📊 Dashboard data received:', response.data);
      console.log('📊 Charts data:', response.data?.charts);
      setDashboardData(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const { overview, recentActivity } = dashboardData || {};

  // Process real data from backend with better error handling
  const scanTrendsData = dashboardData?.charts?.scanTrends?.length > 0 
    ? dashboardData.charts.scanTrends.map(item => ({
        name: new Date(item._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        scans: item.count || 0,
        results: item.totalResults || 0
      }))
    : [
        { name: 'No Data Available', scans: 0, results: 0 }
      ];

  const clientActivityData = dashboardData?.charts?.clientActivity?.length > 0
    ? dashboardData.charts.clientActivity.map(item => ({
        name: item.name || 'Unknown Client',
        scans: item.scans || 0,
        results: item.results || 0
      }))
    : [
        { name: 'No Data Available', scans: 0, results: 0 }
      ];

  // Process sentiment distribution from backend
  const sentimentDistribution = dashboardData?.charts?.sentimentDistribution || [];
  const keywordPerformanceData = sentimentDistribution.length > 0 
    ? sentimentDistribution.map(item => ({
        name: item._id === 'positive' ? 'Positive' : item._id === 'negative' ? 'Negative' : 'Neutral',
        value: item.count || 0,
        color: item._id === 'positive' ? '#10B981' : item._id === 'negative' ? '#EF4444' : '#6B7280'
      }))
    : [
        { name: 'No Data Available', value: 1, color: '#6B7280' }
      ];

  // Process weekly sentiment trends from backend
  const sentimentTrendsData = dashboardData?.charts?.weeklySentimentTrends?.length > 0
    ? dashboardData.charts.weeklySentimentTrends.map(item => {
        const weekLabel = `Week ${item._id.week}`;
        const sentiments = item.sentiments.reduce((acc, sent) => {
          acc[sent.sentiment] = sent.count || 0;
          return acc;
        }, {});
        
        return {
          name: weekLabel,
          positive: sentiments.positive || 0,
          negative: sentiments.negative || 0,
          neutral: sentiments.neutral || 0
        };
      })
    : [
        { name: 'No Data Available', positive: 0, negative: 0, neutral: 0 }
      ];

  // Calculate change percentages based on real data
  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return current > 0 ? '+100%' : '0%';
    const change = ((current - previous) / previous) * 100;
    return change >= 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`;
  };

  const stats = [
    {
      name: 'Total Clients',
      value: overview?.totalClients || 0,
      change: calculateChange(overview?.totalClients || 0, (overview?.totalClients || 0) - 2),
      changeType: (overview?.totalClients || 0) > 0 ? 'positive' : 'neutral',
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Active Keywords',
      value: overview?.activeKeywords || 0,
      change: calculateChange(overview?.activeKeywords || 0, (overview?.activeKeywords || 0) - 1),
      changeType: (overview?.activeKeywords || 0) > 0 ? 'positive' : 'neutral',
      icon: Search,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Total Scans',
      value: overview?.totalScans || 0,
      change: calculateChange(overview?.totalScans || 0, (overview?.totalScans || 0) - 3),
      changeType: (overview?.totalScans || 0) > 0 ? 'positive' : 'neutral',
      icon: BarChart3,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      name: 'Reports Generated',
      value: overview?.totalReports || 0,
      change: calculateChange(overview?.totalReports || 0, (overview?.totalReports || 0) - 1),
      changeType: (overview?.totalReports || 0) > 0 ? 'positive' : 'neutral',
      icon: FileText,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  const quickActions = [
    {
      name: 'Add New Client',
      description: 'Create a new client profile',
      icon: Users,
      color: 'bg-blue-500',
      href: '/admin/clients',
    },
    {
      name: 'Manage Keywords',
      description: 'Add or edit tracking keywords',
      icon: Search,
      color: 'bg-green-500',
      href: '/admin/keywords',
    },
    {
      name: 'View Reports',
      description: 'Access generated reports',
      icon: FileText,
      color: 'bg-purple-500',
      href: '/admin/reports',
    },
    {
      name: 'Trigger Scan',
      description: 'Start manual scanning',
      icon: Activity,
      color: 'bg-orange-500',
      href: '/admin/scan-configuration',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-2">Monitor and manage your ORM campaigns</p>
        </div>
        <div className="mt-4 lg:mt-0 flex items-center space-x-4">
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
          <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.828 7l2.586 2.586a2 2 0 002.828 0L15 7H4.828z" />
            </svg>
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></div>
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">A</span>
            </div>
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-700"
            style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">{stat.name}</p>
                <p className="text-3xl font-bold text-white">{stat.value.toLocaleString()}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-400 ml-1">vs last month</span>
                </div>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 text-white`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Scan Trends Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-6 shadow-lg border border-gray-700"
          style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Scan Trends</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-400">Scans</span>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-400">Results</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scanTrendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#64748B" />
                <YAxis stroke="#64748B" />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B', borderRadius: '8px' }} />
                <Legend />
                <Area type="monotone" dataKey="scans" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="results" stackId="2" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Client Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-6 shadow-lg border border-gray-700"
          style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Client Activity</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-400">Scans</span>
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-sm text-gray-400">Results</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#64748B" />
                <YAxis stroke="#64748B" />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="scans" fill="#3B82F6" />
                <Bar dataKey="results" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Bottom Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Sentiment Analysis Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl p-6 shadow-lg border border-gray-700"
          style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Sentiment Trends</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-400">Positive</span>
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-400">Negative</span>
              <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
              <span className="text-sm text-gray-400">Neutral</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sentimentTrendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#64748B" />
                <YAxis stroke="#64748B" />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="positive" stroke="#10B981" strokeWidth={3} />
                <Line type="monotone" dataKey="negative" stroke="#EF4444" strokeWidth={3} />
                <Line type="monotone" dataKey="neutral" stroke="#64748B" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Keyword Performance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl p-6 shadow-lg border border-gray-700"
          style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Keyword Performance</h3>
            <div className="text-sm text-gray-400">Overall Distribution</div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={keywordPerformanceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {keywordPerformanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B', borderRadius: '8px' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-2xl p-6 shadow-lg border border-gray-700"
          style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Recent Activity</h3>
            <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentActivity?.scans?.slice(0, 5).map((scan, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-700 transition-colors">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    Scan completed for {scan.clientId?.name || 'Unknown Client'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(scan.completedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center text-blue-600">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl p-6 shadow-lg border border-gray-700"
          style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
        >
          <h3 className="text-xl font-semibold text-white mb-6">Quick Actions</h3>
          <div className="space-y-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  if (action.href) {
                    window.location.href = action.href;
                  } else if (action.onClick) {
                    action.onClick();
                  }
                }}
                className="w-full flex items-center space-x-3 p-4 rounded-xl hover:bg-gray-700 transition-colors group"
              >
                <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <action.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">{action.name}</p>
                  <p className="text-xs text-gray-500">{action.description}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-blue-400" />
              </button>
            ))}
          </div>
        </motion.div>
      </div>



    </div>
  );
};

export default ModernAdminDashboard;



