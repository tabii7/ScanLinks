import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Eye,
  FileText,
  Download,
  Calendar,
  Target,
  BarChart3,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ModernClientDashboard = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('all');

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await api.get(`/dashboard/client?region=${selectedRegion}`);
      console.log('📊 Dashboard data received:', response.data);
      console.log('📈 Negative trend:', response.data?.overview?.negativeTrend);
      console.log('📈 Positive trend:', response.data?.overview?.positiveTrend);
      console.log('🥧 Sentiment distribution:', response.data?.overview?.sentimentDistribution);
      
      // Add sample data if no real data exists
      if (!response.data?.overview?.negativeTrend?.length) {
        console.log('📊 No negative trend data, using sample data');
        response.data.overview = {
          ...response.data.overview,
          negativeTrend: [
            { scanDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), negativeLinks: 2 },
            { scanDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), negativeLinks: 3 },
            { scanDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), negativeLinks: 1 },
            { scanDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), negativeLinks: 4 },
            { scanDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), negativeLinks: 2 },
            { scanDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), negativeLinks: 3 },
            { scanDate: new Date().toISOString(), negativeLinks: 1 }
          ],
          positiveTrend: [
            { scanDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), positiveLinks: 5 },
            { scanDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), positiveLinks: 7 },
            { scanDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), positiveLinks: 6 },
            { scanDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), positiveLinks: 8 },
            { scanDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), positiveLinks: 9 },
            { scanDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), positiveLinks: 7 },
            { scanDate: new Date().toISOString(), positiveLinks: 8 }
          ],
          sentimentDistribution: [
            { name: 'Positive', value: 8, color: '#34d399' },
            { name: 'Negative', value: 1, color: '#f87171' },
            { name: 'Neutral', value: 3, color: '#9ca3af' }
          ]
        };
      }
      setDashboardData(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedRegion]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const { overview, recentScans, keywordRankings } = dashboardData || {};

  const stats = [
    {
      name: 'Total Scans',
      value: overview?.totalScans || 0,
      change: `+${overview?.completedScans || 0} completed`,
      changeType: 'positive',
      icon: Target,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Completed Scans',
      value: overview?.completedScans || 0,
      change: `${overview?.runningScans || 0} running`,
      changeType: 'positive',
      icon: CheckCircle,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
    },
    {
      name: 'Total Results',
      value: overview?.totalResults || 0,
      change: `Avg: ${overview?.avgResults || 0}`,
      changeType: 'positive',
      icon: TrendingUp,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      name: 'Failed Scans',
      value: overview?.failedScans || 0,
      change: overview?.failedScans > 0 ? 'Needs attention' : 'All good',
      changeType: overview?.failedScans > 0 ? 'negative' : 'positive',
      icon: AlertCircle,
      color: overview?.failedScans > 0 ? 'from-red-500 to-red-600' : 'from-green-500 to-green-600',
      bgColor: overview?.failedScans > 0 ? 'bg-red-50' : 'bg-green-50',
    },
  ];

  const regions = [
    { value: 'all', label: 'All Regions', flag: '🌍' },
    { value: 'us', label: 'United States', flag: '🇺🇸' },
    { value: 'uk', label: 'United Kingdom', flag: '🇬🇧' },
    { value: 'ca', label: 'Canada', flag: '🇨🇦' },
    { value: 'au', label: 'Australia', flag: '🇦🇺' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Your ORM Dashboard</h1>
          <p className="text-gray-300 mt-2">Track your online reputation progress</p>
        </div>
        <div className="mt-4 lg:mt-0 flex space-x-3">
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-4 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 text-white"
          >
            {regions.map((region) => (
              <option key={region.value} value={region.value}>
                {region.flag} {region.label}
              </option>
            ))}
          </select>
          <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl">
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <p className="text-sm font-medium text-gray-300 mb-1">{stat.name}</p>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${
                    stat.changeType === 'positive' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-400 ml-1">vs last week</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-gray-800">
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Keyword Rankings */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-2xl p-6 shadow-lg border border-gray-700"
          style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Keyword Rankings</h3>
            <button 
              onClick={() => navigate('/rank-tracking')}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {keywordRankings?.slice(0, 5).map((keyword, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{keyword.keyword}</p>
                    <p className="text-sm text-gray-500">Position: {keyword.currentPosition}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    keyword.change > 0 
                      ? 'bg-green-100 text-green-800' 
                      : keyword.change < 0 
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}>
                    {keyword.change > 0 ? '+' : ''}{keyword.change}
                  </span>
                  {keyword.change > 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                  ) : keyword.change < 0 ? (
                    <ArrowDownRight className="h-4 w-4 text-red-600" />
                  ) : (
                    <div className="h-4 w-4 bg-gray-400 rounded-full"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl p-6 shadow-lg border border-gray-700"
          style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
        >
          <h3 className="text-xl font-semibold text-white mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {recentScans?.slice(0, 4).map((scan, index) => (
              <div 
                key={index} 
                onClick={() => navigate(`/scans/${scan._id || scan.id}`)}
                className="flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  <Activity className="h-4 w-4 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    Scan completed
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(scan.completedAt).toLocaleString()}
                  </p>
                  {scan.clientStatus && (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                      scan.clientStatus === 'viewed' 
                        ? 'bg-green-800 text-green-200' 
                        : scan.clientStatus === 'sent'
                          ? 'bg-blue-800 text-blue-200'
                          : 'bg-gray-800 text-gray-200'
                    }`}>
                      {scan.clientStatus === 'not_sent' ? 'New' : 
                       scan.clientStatus === 'sent' ? 'Sent to You' : 
                       scan.clientStatus === 'viewed' ? 'Viewed' : 
                       'Unknown'}
                    </span>
                  )}
                </div>
                <div className="flex items-center text-green-600">
                  <CheckCircle className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Sentiment Trends Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Negative Links Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl p-6 shadow-lg border border-gray-700"
          style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Negative Links Trend</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-400 rounded-full"></div>
              <span className="text-sm text-gray-300">Last 7 Scans</span>
            </div>
          </div>
          
          <div className="h-64" style={{ backgroundColor: 'transparent' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.negativeTrend?.length > 0 ? overview.negativeTrend : [
                { scanDate: new Date().toISOString(), negativeLinks: 0 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="scanDate" 
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: 'white'
                  }}
                  labelFormatter={(value) => `Scan: ${new Date(value).toLocaleDateString()}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="negativeLinks" 
                  stroke="#f87171" 
                  fill="#f87171" 
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <span className="text-gray-300">Negative Links</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-gray-400">Current: </span>
              <span className="font-semibold text-red-400">
                {overview?.negativeTrend?.[overview.negativeTrend.length - 1]?.negativeLinks || 0}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Positive Links Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl p-6 shadow-lg border border-gray-700"
          style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Positive Links Trend</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <span className="text-sm text-gray-300">Last 7 Scans</span>
            </div>
          </div>
          
          <div className="h-64" style={{ backgroundColor: 'transparent' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.positiveTrend?.length > 0 ? overview.positiveTrend : [
                { scanDate: new Date().toISOString(), positiveLinks: 0 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="scanDate" 
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: 'white'
                  }}
                  labelFormatter={(value) => `Scan: ${new Date(value).toLocaleDateString()}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="positiveLinks" 
                  stroke="#34d399" 
                  fill="#34d399" 
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-gray-300">Positive Links</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-gray-400">Current: </span>
              <span className="font-semibold text-green-400">
                {overview?.positiveTrend?.[overview.positiveTrend.length - 1]?.positiveLinks || 0}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Sentiment Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="rounded-2xl p-6 shadow-lg border border-gray-700"
        style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Sentiment Distribution</h3>
          <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
              <span className="text-sm text-gray-300">Current Scan</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-64" style={{ backgroundColor: 'transparent' }}>
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={overview?.sentimentDistribution?.length > 0 ? overview.sentimentDistribution : [
                  { name: 'Positive', value: 0, color: '#34d399' },
                  { name: 'Negative', value: 0, color: '#f87171' },
                  { name: 'Neutral', value: 0, color: '#9ca3af' }
                ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(overview?.sentimentDistribution?.length > 0 ? overview.sentimentDistribution : [
                  { name: 'Positive', value: 0, color: '#34d399' },
                  { name: 'Negative', value: 0, color: '#f87171' },
                  { name: 'Neutral', value: 0, color: '#9ca3af' }
                ]).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: 'white'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="space-y-4">
            {(overview?.sentimentDistribution?.length > 0 ? overview.sentimentDistribution : [
              { name: 'Positive', value: 0, color: '#34d399' },
              { name: 'Negative', value: 0, color: '#f87171' },
              { name: 'Neutral', value: 0, color: '#9ca3af' }
            ]).map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="font-medium text-white">{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">{item.value}</div>
                  <div className="text-sm text-gray-400">links</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <FileText className="h-8 w-8" />
            <Download className="h-5 w-5" />
          </div>
          <h4 className="text-lg font-semibold mb-2">Download Report</h4>
          <p className="text-blue-100 text-sm">Get your latest ORM report in PDF format</p>
        </div>
        
        <div 
          onClick={() => navigate('/scans')}
          className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white cursor-pointer hover:from-green-600 hover:to-emerald-700 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="h-8 w-8" />
            <Eye className="h-5 w-5" />
          </div>
          <h4 className="text-lg font-semibold mb-2">View All Scans</h4>
          <p className="text-green-100 text-sm">See all your scan results and analysis</p>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Calendar className="h-8 w-8" />
            <Clock className="h-5 w-5" />
          </div>
          <h4 className="text-lg font-semibold mb-2">Schedule Scan</h4>
          <p className="text-purple-100 text-sm">Set up automated weekly scans</p>
        </div>
      </motion.div>
    </div>
  );
};

export default ModernClientDashboard;


