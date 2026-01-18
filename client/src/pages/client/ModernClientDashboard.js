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
      
      // Handle null response (like previous_code - always ensure we have data structure)
      if (!response || !response.data) {
        console.warn('⚠️ No response data received, using default structure');
        setDashboardData({
          client: {
            name: 'Unknown Client',
            logo: null,
            campaignProgress: { percentage: 0, monthsElapsed: 0, totalMonths: 0, remainingMonths: 0 }
          },
          overview: {
            totalScans: 0,
            completedScans: 0,
            runningScans: 0,
            failedScans: 0,
            totalResults: 0,
            avgResults: 0,
            negativeTrend: [],
            positiveTrend: [],
            sentimentDistribution: []
          },
          recentScans: [],
          keywordRankings: []
        });
        return;
      }
      
      console.log('📊 Dashboard data received:', response.data);
      console.log('📈 Negative trend:', response.data?.overview?.negativeTrend);
      console.log('📈 Positive trend:', response.data?.overview?.positiveTrend);
      console.log('🥧 Sentiment distribution:', response.data?.overview?.sentimentDistribution);
      
      // Use only real data from API - no fake/sample data
      const dashboardData = {
        client: response.data.client || {
          name: 'Unknown Client',
          logo: null,
          campaignProgress: { percentage: 0, monthsElapsed: 0, totalMonths: 0, remainingMonths: 0 }
        },
        overview: response.data.overview || {
          totalScans: 0,
          completedScans: 0,
          runningScans: 0,
          failedScans: 0,
          totalResults: 0,
          avgResults: 0,
          negativeTrend: [],
          positiveTrend: [],
          sentimentDistribution: []
        },
        recentScans: response.data.recentActivity?.scans || [],
        keywordRankings: response.data.keywordRankings || []
      };
      
      // Only use real data - never add fake/sample data
      console.log('📊 Using only real data from API - no sample data');
      setDashboardData(dashboardData);
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
      <div>
        <h1 className="text-3xl font-bold" style={{color: '#fafafa'}}>Your ORM Dashboard</h1>
        <p className="text-gray-300 mt-2">Track your online reputation progress</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 bg-gray-800 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300 mb-1">{stat.name}</p>
                <p className="text-3xl font-bold" style={{color: '#fafafa'}}>{stat.value}</p>
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
                <stat.icon className="h-6 w-6" style={{color: '#9ca3af'}} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Scans Summary */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-2xl p-6 shadow-lg bg-gray-800 border border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold" style={{color: '#fafafa'}}>Recent Scans Summary</h3>
            <button 
              onClick={() => navigate('/scans')}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentScans && recentScans.length > 0 ? (
              recentScans.slice(0, 5).map((scan, index) => (
                <div 
                  key={index} 
                  onClick={() => navigate(`/scans/${scan._id || scan.id}`)}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      scan.status === 'completed' ? 'bg-green-900' :
                      scan.status === 'running' ? 'bg-blue-900' :
                      scan.status === 'failed' ? 'bg-red-900' :
                      'bg-gray-800'
                    }`}>
                      {scan.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      ) : scan.status === 'running' ? (
                        <Clock className="h-5 w-5 text-blue-400" />
                      ) : scan.status === 'failed' ? (
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      ) : (
                        <Target className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium" style={{color: '#fafafa'}}>
                        {scan.searchQuery || scan.region || 'Scan'}
                      </p>
                      <p className="text-sm" style={{color: '#9ca3af'}}>
                        {scan.region} • {scan.resultsCount || 0} results
                      </p>
                      <p className="text-xs" style={{color: '#6b7280'}}>
                        {scan.completedAt 
                          ? new Date(scan.completedAt).toLocaleDateString()
                          : scan.startedAt 
                            ? new Date(scan.startedAt).toLocaleDateString()
                            : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      scan.status === 'completed' 
                        ? 'bg-green-900 text-green-200' 
                        : scan.status === 'running'
                          ? 'bg-blue-900 text-blue-200'
                          : scan.status === 'failed'
                            ? 'bg-red-900 text-red-200'
                            : 'bg-gray-700 text-gray-200'
                    }`}>
                      {scan.status || 'pending'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Target className="h-12 w-12 mx-auto mb-4" style={{color: '#6b7280'}} />
                <p className="text-gray-400 mb-2">No scans yet</p>
                <p className="text-sm text-gray-500">Your scan results will appear here</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl p-6 shadow-lg bg-gray-800 border border-gray-700"
        >
          <h3 className="text-xl font-semibold mb-6" style={{color: '#fafafa'}}>Recent Activity</h3>
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
                  <p className="text-sm font-medium" style={{color: '#fafafa'}}>
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
          className="rounded-2xl p-6 shadow-lg bg-gray-800 border border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold" style={{color: '#fafafa'}}>Negative Links Trend</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-400 rounded-full"></div>
              <span className="text-sm text-gray-300">Last 7 Scans</span>
            </div>
          </div>
          
          <div className="h-64" style={{ backgroundColor: 'transparent' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.negativeTrend || []}>
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
          className="rounded-2xl p-6 shadow-lg bg-gray-800 border border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold" style={{color: '#fafafa'}}>Positive Links Trend</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <span className="text-sm text-gray-300">Last 7 Scans</span>
            </div>
          </div>
          
          <div className="h-64" style={{ backgroundColor: 'transparent' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.positiveTrend || []}>
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
        className="rounded-2xl p-6 shadow-lg bg-gray-800 border border-gray-700"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold" style={{color: '#fafafa'}}>Sentiment Distribution</h3>
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
                data={overview?.sentimentDistribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelStyle={{ fill: '#fafafa', fontSize: 12, fontWeight: 'medium' }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(overview?.sentimentDistribution || []).map((entry, index) => (
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
            {(overview?.sentimentDistribution || []).map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="font-medium" style={{color: '#fafafa'}}>{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold" style={{color: '#fafafa'}}>{item.value}</div>
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
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6" style={{background: '#1f2937'}} >
          <div className="flex items-center justify-between mb-4">
            <FileText className="h-8 w-8" style={{color: '#ffffff'}} />
            <Download className="h-5 w-5" style={{color: '#ffffff'}} />
          </div>
          <h4 className="text-lg font-semibold mb-2" style={{color: '#ffffff'}}>Download Report</h4>
          <p className="text-sm" style={{color: '#e0e7ff'}}>Get your latest ORM report in PDF format</p>
        </div>
        
        <div 
          onClick={() => navigate('/scans')}
          className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 cursor-pointer hover:from-green-600 hover:to-emerald-700 transition-all" style={{background: '#1f2937'}}
        >
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="h-8 w-8" style={{color: '#ffffff'}} />
            <Eye className="h-5 w-5" style={{color: '#ffffff'}} />
          </div>
          <h4 className="text-lg font-semibold mb-2" style={{color: '#ffffff'}}>View All Scans</h4>
          <p className="text-sm" style={{color: '#d1fae5'}}>See all your scan results and analysis</p>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6" style={{background: '#1f2937'}}>
          <div className="flex items-center justify-between mb-4">
            <Calendar className="h-8 w-8" style={{color: '#ffffff'}} />
            <Clock className="h-5 w-5" style={{color: '#ffffff'}} />
          </div>
          <h4 className="text-lg font-semibold mb-2" style={{color: '#ffffff'}}>Schedule Scan</h4>
          <p className="text-sm" style={{color: '#f3e8ff'}}>Set up automated weekly scans</p>
        </div>
      </motion.div>
    </div>
  );
};

export default ModernClientDashboard;


