import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  BarChart3, 
  AlertCircle, 
  ExternalLink, 
  TrendingUp,
  TrendingDown,
  Minus,
  Download
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ClientScanResults = () => {
  const navigate = useNavigate();
  const { scanId } = useParams();
  const [scan, setScan] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('position');
  const fetchingRef = useRef(false);

  const fetchScanDetails = useCallback(async () => {
    if (fetchingRef.current) {
      console.log('⏳ Already fetching, skipping duplicate call');
      return;
    }
    
    fetchingRef.current = true;
    try {
      setLoading(true);
      console.log('🔍 Fetching scan details for ID:', scanId);
      
      const scanResponse = await api.get(`/scans/my-scan/${scanId}`);
      console.log('📊 Scan response:', scanResponse.data);
      const scanData = scanResponse.data;
      
      if (scanData) {
        setScan(scanData);
        
        // Try to fetch scan results
        try {
          console.log('🔍 Fetching scan results for ID:', scanId);
          const resultsResponse = await api.get(`/scans/${scanId}/my-results`);
          console.log('📊 Results response:', resultsResponse.data);
          if (resultsResponse.data && resultsResponse.data.length > 0) {
            setResults(resultsResponse.data);
            console.log('📊 Loaded scan results from database:', resultsResponse.data.length);
          } else {
            console.log('⚠️ No results found for this scan');
            setResults([]);
          }
        } catch (resultsError) {
          console.error('❌ Could not fetch scan results:', resultsError);
          setResults([]);
        }
      } else {
        toast.error('Scan not found');
        navigate('/');
      }
    } catch (error) {
      console.error('❌ Error fetching scan details:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      toast.error('Failed to load scan details');
      navigate('/');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [scanId, navigate]);

  useEffect(() => {
    // Reset loading state when component mounts
    setLoading(true);
    fetchingRef.current = false;
    
    fetchScanDetails();
    
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('⏰ Loading timeout reached, stopping loading state');
        setLoading(false);
        fetchingRef.current = false;
      }
    }, 10000); // 10 second timeout
    
    return () => {
      clearTimeout(timeout);
      fetchingRef.current = false;
    };
  }, [scanId]); // Only depend on scanId, not fetchScanDetails

  const getSentimentColor = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'text-green-600 bg-green-50';
      case 'negative':
        return 'text-red-600 bg-red-50';
      case 'neutral':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getSentimentIcon = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return <TrendingUp className="w-4 h-4" />;
      case 'negative':
        return <TrendingDown className="w-4 h-4" />;
      case 'neutral':
        return <Minus className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRankingChange = (result) => {
    if (!result.rankingChange && result.rankingChange !== 0) {
      // New result - no previous data
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
          <span className="w-2 h-2 bg-blue-400 rounded-full mr-1"></span>
          New
        </span>
      );
    }

    if (result.rankingChange === 0) {
      // Same position
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600">
          <Minus className="w-3 h-3 mr-1" />
          Same
        </span>
      );
    }

    if (result.rankingChange > 0) {
      // Moved up (positive change)
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600">
          <TrendingUp className="w-3 h-3 mr-1" />
          +{result.rankingChange}
        </span>
      );
    }

    if (result.rankingChange < 0) {
      // Moved down (negative change)
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
          <TrendingDown className="w-3 h-3 mr-1" />
          {result.rankingChange}
        </span>
      );
    }

    return null;
  };

  const sortResults = (results, sortBy) => {
    return [...results].sort((a, b) => {
      switch (sortBy) {
        case 'position':
          return (a.rank || 0) - (b.rank || 0);
        case 'sentiment':
          const sentimentOrder = { positive: 1, neutral: 2, negative: 3 };
          return (sentimentOrder[a.sentiment] || 4) - (sentimentOrder[b.sentiment] || 4);
        case 'confidence':
          return (b.confidence || 0) - (a.confidence || 0);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        default:
          return 0;
      }
    });
  };

  const paginateResults = (results, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    return results.slice(startIndex, startIndex + perPage);
  };

  const sortedResults = sortResults(results, sortBy);
  const paginatedResults = paginateResults(sortedResults, currentPage, resultsPerPage);
  const totalPages = Math.ceil(sortedResults.length / resultsPerPage);

  const handleDownloadReport = async () => {
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {scan?.clientId?.name || scan?.clientName || 'Scan Results'}
                </h1>
                <p className="text-gray-600">Detailed scan analysis and results</p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Report</span>
                </button>
              </div>
            </div>
          </div>

          {/* Scan Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg p-6 shadow-sm border border-gray-200"
            >
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Results</p>
                  <p className="text-2xl font-bold text-gray-900">{results.length}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-lg p-6 shadow-sm border border-gray-200"
            >
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Positive</p>
                  <p className="text-2xl font-bold text-green-600">
                    {results.filter(r => r.sentiment === 'positive').length}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-lg p-6 shadow-sm border border-gray-200"
            >
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Negative</p>
                  <p className="text-2xl font-bold text-red-600">
                    {results.filter(r => r.sentiment === 'negative').length}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-lg p-6 shadow-sm border border-gray-200"
            >
              <div className="flex items-center">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="w-6 h-6 text-gray-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Neutral</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {results.filter(r => r.sentiment === 'neutral').length}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Ranking Trends Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8"
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Ranking Trends</h3>
              <p className="text-sm text-gray-600">Position changes from previous scan</p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {results.filter(r => r.rankingChange > 0).length}
                  </div>
                  <div className="text-sm text-gray-600">Moved Up</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {results.filter(r => r.rankingChange < 0).length}
                  </div>
                  <div className="text-sm text-gray-600">Moved Down</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {results.filter(r => r.rankingChange === 0).length}
                  </div>
                  <div className="text-sm text-gray-600">Same Position</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {results.filter(r => !r.rankingChange && r.rankingChange !== 0).length}
                  </div>
                  <div className="text-sm text-gray-600">New Results</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Results Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200"
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Scan Results</h3>
                <div className="flex items-center space-x-4">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="position">Sort by Position</option>
                    <option value="sentiment">Sort by Sentiment</option>
                    <option value="confidence">Sort by Confidence</option>
                    <option value="title">Sort by Title</option>
                  </select>
                  
                  <select
                    value={resultsPerPage}
                    onChange={(e) => setResultsPerPage(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Change
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sentiment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedResults.map((result, index) => (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{result.rank || index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRankingChange(result)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 max-w-md truncate">
                          {result.title}
                        </div>
                        <div className="text-sm text-gray-500 max-w-md truncate">
                          {result.url}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(result.sentiment)}`}>
                          {getSentimentIcon(result.sentiment)}
                          <span className="ml-1 capitalize">{result.sentiment}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getConfidenceColor(result.confidence)}`}>
                          {Math.round((result.confidence || 0) * 100)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </a>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * resultsPerPage) + 1} to {Math.min(currentPage * resultsPerPage, sortedResults.length)} of {sortedResults.length} results
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ClientScanResults;
