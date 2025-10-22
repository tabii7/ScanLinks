import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle,
  Globe,
  Download,
  Calendar,
  BarChart3,
  Eye,
  Shield,
  Target,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ClientDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('US');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/client');
      setDashboardData(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegionalData = async (region) => {
    try {
      const response = await api.get(`/dashboard/client/regional/${region}`);
      return response.data;
    } catch (error) {
      toast.error('Failed to load regional data');
      return null;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ace-600"></div>
        </div>
      </Layout>
    );
  }

  const { client, overview, recentActivity, campaignStats } = dashboardData || {};

  const regions = [
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'UAE', name: 'UAE', flag: '🇦🇪' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  ];

  const campaignMetrics = [
    {
      name: 'Links Removed',
      value: campaignStats?.linksRemoved || 0,
      icon: Minus,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      change: '+2 this week',
    },
    {
      name: 'De-Indexed',
      value: campaignStats?.deIndexed || 0,
      icon: Shield,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      change: '+1 this week',
    },
    {
      name: 'Suppressed',
      value: campaignStats?.suppressed || 0,
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      change: '+3 this week',
    },
    {
      name: 'New Positive Links',
      value: campaignStats?.newPositiveLinks || 0,
      icon: Plus,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      change: '+5 this week',
    },
  ];

  const sentimentMetrics = [
    {
      name: 'Positive Links',
      value: campaignStats?.totalPositiveLinks || 0,
      percentage: Math.round(((campaignStats?.totalPositiveLinks || 0) / (overview?.totalKeywords || 1)) * 100),
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Negative Links',
      value: campaignStats?.totalNegativeLinks || 0,
      percentage: Math.round(((campaignStats?.totalNegativeLinks || 0) / (overview?.totalKeywords || 1)) * 100),
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header with Client Info */}
        <div className="bg-white shadow-ace rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {client?.logo ? (
                <img
                  src={client.logo}
                  alt={client.name}
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="h-16 w-16 bg-ace-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl font-bold text-ace-600">
                    {client?.name?.charAt(0) || 'C'}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{client?.name}</h1>
                <p className="text-gray-600">{client?.subscription?.plan} Plan</p>
                <p className="text-sm text-gray-500">
                  Month {client?.campaignProgress?.monthsElapsed || 0} of {client?.campaignProgress?.totalMonths || 0}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Campaign Progress</div>
              <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-ace-600 h-2 rounded-full"
                  style={{ width: `${client?.campaignProgress?.percentage || 0}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {client?.campaignProgress?.percentage || 0}% Complete
              </div>
            </div>
          </div>
        </div>

        {/* Region Selector */}
        <div className="bg-white shadow-ace rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Select Region</h3>
            <Globe className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex flex-wrap gap-2">
            {regions.map((region) => (
              <button
                key={region.code}
                onClick={() => setSelectedRegion(region.code)}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRegion === region.code
                    ? 'bg-ace-100 text-ace-900 border border-ace-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="mr-2">{region.flag}</span>
                {region.name}
              </button>
            ))}
          </div>
        </div>

        {/* Campaign Metrics */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {campaignMetrics.map((metric, index) => (
            <motion.div
              key={metric.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white overflow-hidden shadow-ace rounded-lg"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`p-3 rounded-md ${metric.bgColor}`}>
                      <metric.icon className={`h-6 w-6 ${metric.color}`} />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {metric.name}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {metric.value}
                      </dd>
                      <dd className="text-xs text-green-600">
                        {metric.change}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Sentiment Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white shadow-ace rounded-lg p-6"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sentiment Analysis</h3>
            <div className="space-y-4">
              {sentimentMetrics.map((metric, index) => (
                <div key={metric.name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-md ${metric.bgColor} mr-3`}>
                      {metric.name === 'Positive Links' ? (
                        <CheckCircle className={`h-5 w-5 ${metric.color}`} />
                      ) : (
                        <AlertCircle className={`h-5 w-5 ${metric.color}`} />
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{metric.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{metric.value}</div>
                    <div className="text-xs text-gray-500">{metric.percentage}%</div>
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
            className="bg-white shadow-ace rounded-lg p-6"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {recentActivity?.scans?.slice(0, 5).map((scan, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      Scan completed for {scan.region}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(scan.completedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Weekly Reports */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white shadow-ace rounded-lg p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Weekly Reports</h3>
            <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-ace-600 hover:bg-ace-700">
              <Download className="h-4 w-4 mr-2" />
              Download All
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentActivity?.reports?.slice(0, 6).map((report, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    Week {report.weekNumber}
                  </span>
                  <span className="text-xs text-gray-500">{report.region}</span>
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  {new Date(report.generatedAt).toLocaleDateString()}
                </div>
                <div className="flex space-x-2">
                  <button className="flex-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200">
                    <Eye className="h-3 w-3 inline mr-1" />
                    View
                  </button>
                  <button className="flex-1 text-xs bg-ace-100 text-ace-700 px-2 py-1 rounded hover:bg-ace-200">
                    <Download className="h-3 w-3 inline mr-1" />
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default ClientDashboard;



