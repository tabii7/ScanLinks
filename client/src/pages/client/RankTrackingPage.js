import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  Globe,
  BarChart3,
  Minus,
  Plus,
  AlertCircle,
  RefreshCw,
  Download
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const RankTrackingPage = () => {
  const [rankData, setRankData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [timeRange, setTimeRange] = useState('4weeks');

  const fetchRankData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/dashboard/rank-tracking?keyword=${selectedKeyword}&region=${selectedRegion}&timeRange=${timeRange}`);
      setRankData(response.data);
    } catch (error) {
      console.error('Error fetching rank data:', error);
      toast.error('Failed to load rank tracking data');
    } finally {
      setLoading(false);
    }
  }, [selectedKeyword, selectedRegion, timeRange]);

  useEffect(() => {
    fetchRankData();
  }, [fetchRankData]);

  const getMovementIcon = (movement) => {
    switch (movement) {
      case 'new':
        return <Plus className="w-4 h-4 text-blue-500" />;
      case 'improved':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'dropped':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'unchanged':
        return <Minus className="w-4 h-4 text-gray-500" />;
      case 'disappeared':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getMovementColor = (movement) => {
    switch (movement) {
      case 'new':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'improved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'dropped':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'unchanged':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'disappeared':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getMovementText = (movement, currentRank, previousRank) => {
    switch (movement) {
      case 'new':
        return 'New Entry';
      case 'improved':
        return `↑ Improved (was ${previousRank})`;
      case 'dropped':
        return `↓ Dropped (was ${previousRank})`;
      case 'unchanged':
        return `→ Same (${previousRank})`;
      case 'disappeared':
        return `✗ Disappeared (was ${previousRank})`;
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rank tracking data...</p>
        </div>
      </div>
    );
  }

  const { keywords, rankHistory, summary } = rankData || {};

  // Calculate trends and analytics
  const getTrends = () => {
    if (!rankHistory || rankHistory.length === 0) return null;

    const keywordTrends = {};
    
    rankHistory.forEach(item => {
      if (!keywordTrends[item.keyword]) {
        keywordTrends[item.keyword] = {
          keyword: item.keyword,
          positions: [],
          movements: [],
          avgPosition: 0,
          trend: 'stable'
        };
      }
      
      keywordTrends[item.keyword].positions.push(item.currentRank);
      keywordTrends[item.keyword].movements.push(item.movement);
    });

    // Calculate average position and trend for each keyword
    Object.values(keywordTrends).forEach(trend => {
      trend.avgPosition = Math.round(trend.positions.reduce((sum, pos) => sum + pos, 0) / trend.positions.length);
      
      // Determine trend based on recent movements
      const recentMovements = trend.movements.slice(-3);
      const improvedCount = recentMovements.filter(m => m === 'improved').length;
      const droppedCount = recentMovements.filter(m => m === 'dropped').length;
      
      if (improvedCount > droppedCount) trend.trend = 'improving';
      else if (droppedCount > improvedCount) trend.trend = 'declining';
      else trend.trend = 'stable';
    });

    return Object.values(keywordTrends);
  };

  const trends = getTrends();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rank Tracking</h1>
              <p className="text-gray-600">Monitor your keyword rankings and track improvements over time</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchRankData}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              <button className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Keyword</label>
              <select
                value={selectedKeyword}
                onChange={(e) => setSelectedKeyword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Keywords</option>
                {keywords?.map((keyword, index) => (
                  <option key={index} value={keyword.keyword}>
                    {keyword.keyword}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Regions</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
                <option value="UAE">UAE</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="1week">Last Week</option>
                <option value="2weeks">Last 2 Weeks</option>
                <option value="4weeks">Last 4 Weeks</option>
                <option value="3months">Last 3 Months</option>
                <option value="6months">Last 6 Months</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchRankData}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Keywords</p>
                <p className="text-2xl font-bold text-blue-600">{summary?.totalKeywords || 0}</p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Improved</p>
                <p className="text-2xl font-bold text-green-600">{summary?.improved || 0}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Dropped</p>
                <p className="text-2xl font-bold text-red-600">{summary?.dropped || 0}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Position</p>
                <p className="text-2xl font-bold text-purple-600">{summary?.avgPosition || 0}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </motion.div>
        </div>

        {/* Keyword Trends Analytics */}
        {trends && trends.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Keyword Trends & Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trends.map((trend, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-50 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{trend.keyword}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      trend.trend === 'improving' ? 'bg-green-100 text-green-800' :
                      trend.trend === 'declining' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {trend.trend === 'improving' ? '↗ Improving' :
                       trend.trend === 'declining' ? '↘ Declining' :
                       '→ Stable'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Avg Position: <span className="font-medium">{trend.avgPosition}</span></p>
                    <p>Total Scans: <span className="font-medium">{trend.positions.length}</span></p>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">Recent Movements:</p>
                      <div className="flex space-x-1 mt-1">
                        {trend.movements.slice(-5).map((movement, i) => (
                          <span
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              movement === 'improved' ? 'bg-green-500' :
                              movement === 'dropped' ? 'bg-red-500' :
                              movement === 'new' ? 'bg-blue-500' :
                              'bg-gray-400'
                            }`}
                            title={movement}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Rank History Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Rank History</h2>
            <p className="text-gray-600">Track how your keywords are performing over time</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keyword</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previous Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Movement</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rankHistory?.map((item, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Target className="w-4 h-4 text-blue-500 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{item.keyword}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{item.currentRank || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">{item.previousRank || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getMovementIcon(item.movement)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getMovementColor(item.movement)}`}>
                          {getMovementText(item.movement, item.currentRank, item.previousRank)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 text-gray-400 mr-1" />
                        <span className="text-sm text-gray-500">{item.region}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-400 mr-1" />
                        <span className="text-sm text-gray-500">
                          {new Date(item.lastUpdated).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {(!rankHistory || rankHistory.length === 0) && (
            <div className="p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No rank data available</h3>
              <p className="text-gray-600">Start tracking your keywords to see rank movements here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RankTrackingPage;
