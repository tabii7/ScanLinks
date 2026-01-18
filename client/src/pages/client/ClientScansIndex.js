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
        return 'text-green-200 bg-green-900';
      case 'running':
        return 'text-blue-200 bg-blue-900';
      case 'failed':
        return 'text-red-200 bg-red-900';
      default:
        return 'text-gray-400 bg-gray-800';
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
    // Ensure we convert ObjectId to string
    const scanId = scan._id?.toString() || scan._id || scan.id?.toString() || scan.id;
    console.log('🔍 [CLIENT SCANS] Navigating to scan:', {
      originalScan: scan,
      _id: scan._id,
      id: scan.id,
      extractedScanId: scanId,
      type: typeof scanId
    });
    navigate(`/scans/${scanId}`);
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
      <div className="flex items-center justify-center w-full h-full absolute top-0 left-0 right-0 bottom-0" style={{ margin: '-24px', minHeight: '100vh' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{color: '#fafafa'}}>My Scans</h1>
            <p className="text-gray-400">View and manage all your scan results</p>
          </div>
          
          <div className="text-sm text-gray-400">
            {filteredScans.length} of {totalScans} scans
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 mb-8"
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
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  style={{color: '#fafafa'}}
                />
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                style={{color: '#fafafa'}}
              >
                <option value="all" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>All Status</option>
                <option value="completed" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Completed</option>
                <option value="running" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Running</option>
                <option value="failed" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Failed</option>
              </select>

              {/* Region Filter */}
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                style={{color: '#fafafa'}}
              >
                <option value="all" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>All Regions</option>
                <option value="US" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>United States</option>
                <option value="UK" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>United Kingdom</option>
                <option value="CA" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Canada</option>
                <option value="AU" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Australia</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                style={{color: '#fafafa'}}
              >
                <option value="latest" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Latest First</option>
                <option value="oldest" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Oldest First</option>
                <option value="results" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Most Results</option>
                <option value="status" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>By Status</option>
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
              className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl hover:border-purple-500 transition-all cursor-pointer group"
            >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-500 bg-opacity-20 rounded-full flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold group-hover:text-purple-400 transition-colors" style={{color: '#fafafa'}}>
                          {scan.clientName || 'Scan'}
                        </h3>
                        <p className="text-sm text-gray-400">
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
                      <div className="text-2xl font-bold" style={{color: '#fafafa'}}>{scan.resultsCount || 0}</div>
                      <div className="text-xs text-gray-400">Total Results</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">{sentimentStats.positive}</div>
                      <div className="text-xs text-gray-400">Positive</div>
                    </div>
                  </div>

                  {/* Sentiment Breakdown */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-gray-400">{sentimentStats.positive}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Minus className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">{sentimentStats.neutral}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <TrendingDown className="w-3 h-3 text-red-500" />
                        <span className="text-xs text-gray-400">{sentimentStats.negative}</span>
                      </div>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
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
                      className="flex items-center space-x-1 text-purple-400 hover:text-purple-300 text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Details</span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadReport(scan._id || scan.id);
                      }}
                      className="flex items-center space-x-1 text-gray-400 hover:text-gray-300 text-sm font-medium"
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
          <h3 className="text-lg font-medium mb-2" style={{color: '#fafafa'}}>No scans found</h3>
          <p className="text-gray-400 mb-4">
            {searchTerm || filterStatus !== 'all' || filterRegion !== 'all'
              ? 'Try adjusting your filters to see more results.'
              : 'Your scans will appear here once they are completed.'}
          </p>
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mt-8"
        >
          <div className="text-sm text-gray-400">
            Showing {((currentPage - 1) * scansPerPage) + 1} to {Math.min(currentPage * scansPerPage, filteredScans.length)} of {filteredScans.length} scans
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center px-3 py-2 text-sm border border-gray-700 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        ? 'bg-purple-600 text-gray-200'
                        : 'text-gray-300 hover:bg-gray-700 bg-gray-800'
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
              className="flex items-center px-3 py-2 text-sm border border-gray-700 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ClientScansIndex;
