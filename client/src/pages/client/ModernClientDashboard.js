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
          <h1 className="text-3xl font-bold text-gray-900">Your ORM Dashboard</h1>
          <p className="text-gray-600 mt-2">Track your online reputation progress</p>
        </div>
        <div className="mt-4 lg:mt-0 flex space-x-3">
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
            className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <div className="flex items-center mt-2">
                  <span className={`text-sm font-medium ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last week</span>
                </div>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`} />
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
          className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Keyword Rankings</h3>
            <button 
              onClick={() => navigate('/rank-tracking')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
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
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {recentScans?.slice(0, 4).map((scan, index) => (
              <div 
                key={index} 
                onClick={() => navigate(`/scans/${scan._id || scan.id}`)}
                className="flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Scan completed
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(scan.completedAt).toLocaleString()}
                  </p>
                  {scan.clientStatus && (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                      scan.clientStatus === 'viewed' 
                        ? 'bg-green-100 text-green-800' 
                        : scan.clientStatus === 'sent'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
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

      {/* Performance Chart Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Performance Trends</h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Improving</span>
          </div>
        </div>
        
        <div className="h-64 flex items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <p className="text-gray-600">Performance chart will be displayed here</p>
            <p className="text-sm text-gray-500">Track your ranking improvements over time</p>
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


