import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Calendar,
  Globe,
  BarChart3,
  Eye,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ClientScansIndex = () => {
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [scansPerPage] = useState(10);
  const [totalScans, setTotalScans] = useState(0);

  const fetchScans = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching client scans...');
      
      const response = await api.get('/scans/client');
      console.log('📊 Client scans response:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        setScans(response.data);
        setTotalScans(response.data.length);
        console.log('📊 Loaded client scans:', response.data.length);
      } else {
        setScans([]);
        setTotalScans(0);
        console.log('⚠️ No scans found for client');
      }
    } catch (error) {
      console.error('❌ Error fetching client scans:', error);
      toast.error('Failed to load scans');
      setScans([]);
      setTotalScans(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'running':
        return 'text-blue-600 bg-blue-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'running':
        return <Clock className="w-4 h-4" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getSentimentStats = (scan) => {
    if (!scan.results || !Array.isArray(scan.results)) {
      return { positive: 0, negative: 0, neutral: 0 };
    }
    
    const positive = scan.results.filter(r => r.sentiment === 'positive').length;
    const negative = scan.results.filter(r => r.sentiment === 'negative').length;
    const neutral = scan.results.filter(r => r.sentiment === 'neutral').length;
    
    return { positive, negative, neutral };
  };

  const sortScans = (scans, sortBy) => {
    return [...scans].sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.completedAt || b.startedAt || 0) - new Date(a.completedAt || a.startedAt || 0);
        case 'oldest':
          return new Date(a.completedAt || a.startedAt || 0) - new Date(b.completedAt || b.startedAt || 0);
        case 'results':
          return (b.resultsCount || 0) - (a.resultsCount || 0);
        case 'status':
          const statusOrder = { completed: 1, running: 2, failed: 3 };
          return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
        default:
          return 0;
      }
    });
  };

  const filterScans = (scans, searchTerm, filterStatus, filterRegion) => {
    return scans.filter(scan => {
      const matchesSearch = !searchTerm || 
        scan.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        scan.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        scan.scanType?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || scan.status === filterStatus;
      const matchesRegion = filterRegion === 'all' || scan.region === filterRegion;
      
      return matchesSearch && matchesStatus && matchesRegion;
    });
  };

  const paginateScans = (scans, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    return scans.slice(startIndex, startIndex + perPage);
  };

  const sortedScans = sortScans(scans, sortBy);
  const filteredScans = filterScans(sortedScans, searchTerm, filterStatus, filterRegion);
  const paginatedScans = paginateScans(filteredScans, currentPage, scansPerPage);
  const totalPages = Math.ceil(filteredScans.length / scansPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScanClick = (scan) => {
    navigate(`/scans/${scan._id || scan.id}`);
  };

  const handleDownloadReport = async (scanId) => {
    try {
      toast.loading('Generating report...', { id: 'download-report' });
      
      const response = await api.get(`/scans/${scanId}/download`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `scan-report-${scanId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Report downloaded successfully', { id: 'download-report' });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download report', { id: 'download-report' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Scans</h1>
              <p className="text-gray-600">View and manage all your scan results</p>
            </div>
            
            <div className="text-sm text-gray-500">
              {filteredScans.length} of {totalScans} scans
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search scans..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="running">Running</option>
                <option value="failed">Failed</option>
              </select>

              {/* Region Filter */}
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Regions</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="results">Most Results</option>
                <option value="status">By Status</option>
              </select>
            </div>
          </motion.div>

          {/* Scans Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginatedScans.map((scan, index) => {
              const sentimentStats = getSentimentStats(scan);
              const scanDate = scan.completedAt || scan.startedAt;
              
              return (
                <motion.div
                  key={scan._id || scan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleScanClick(scan)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all cursor-pointer group"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {scan.clientName || 'Scan'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {scan.scanType || 'Manual Scan'}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(scan.status)}`}>
                      {getStatusIcon(scan.status)}
                      <span className="ml-1 capitalize">{scan.status}</span>
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{scan.resultsCount || 0}</div>
                      <div className="text-xs text-gray-500">Total Results</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{sentimentStats.positive}</div>
                      <div className="text-xs text-gray-500">Positive</div>
                    </div>
                  </div>

                  {/* Sentiment Breakdown */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-gray-600">{sentimentStats.positive}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Minus className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-600">{sentimentStats.neutral}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <TrendingDown className="w-3 h-3 text-red-500" />
                        <span className="text-xs text-gray-600">{sentimentStats.negative}</span>
                      </div>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center space-x-1">
                      <Globe className="w-3 h-3" />
                      <span>{scan.region || 'US'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{scanDate ? new Date(scanDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScanClick(scan);
                      }}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Details</span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadReport(scan._id || scan.id);
                      }}
                      className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredScans.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No scans found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || filterStatus !== 'all' || filterRegion !== 'all'
                  ? 'Try adjusting your filters to see more results.'
                  : 'Your scans will appear here once they are completed.'}
              </p>
              {!searchTerm && filterStatus === 'all' && filterRegion === 'all' && (
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </button>
              )}
            </motion.div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between mt-8"
            >
              <div className="text-sm text-gray-700">
                Showing {((currentPage - 1) * scansPerPage) + 1} to {Math.min(currentPage * scansPerPage, filteredScans.length)} of {filteredScans.length} scans
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-2 text-sm rounded-lg ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
};

export default ClientScansIndex;
