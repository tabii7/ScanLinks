import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  BarChart3, 
  AlertCircle, 
  ExternalLink, 
  Edit, 
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Globe,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ScanResultsPage = () => {
  const navigate = useNavigate();
  const { scanId } = useParams();
  const [scan, setScan] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10); // Show 10 results per page
  const [sortBy, setSortBy] = useState('position');
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const hasInitialized = useRef(false);

  const fetchScanDetails = useCallback(async () => {
    // Prevent multiple initializations
    if (hasInitialized.current) {
      return;
    }
    
    try {
      setLoading(true);
      hasInitialized.current = true;
      
      // Check if scanId is available
      if (!scanId) {
        console.error('Scan ID is undefined');
        toast.error('Scan ID not found');
        navigate('/admin/scans');
        return;
      }
      
      // Fetch scan results from database
      console.log('Fetching scan results from database...');
      try {
        console.log('🔍 Fetching scan details for ID:', scanId);
        const scanResponse = await api.get(`/scans/${scanId}`);
        console.log('📊 Scan response:', scanResponse.data);
        const scanData = scanResponse.data;
        
        // Debug: Log client data structure
        console.log('🔍 Client data in scan:', {
          clientId: scanData.clientId,
          clientName: scanData.clientName,
          clientIdName: scanData.clientId?.name,
          clientIdEmail: scanData.clientId?.email,
          fullClientId: scanData.clientId
        });
        
        if (scanData) {
          setScan(scanData);
          
          // Try to fetch scan results
          try {
            console.log('🔍 Fetching scan results for ID:', scanId);
            const resultsResponse = await api.get(`/scans/${scanId}/results`);
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
          // No scan found - show error, NO DEMO DATA
          console.error('❌ Scan not found in database');
          toast.error('Scan not found');
          navigate('/admin/scans');
          return;
        }
      } catch (error) {
        console.error('❌ Error fetching scan details:', error);
        console.error('❌ Error details:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
        toast.error('Failed to load scan details');
        setResults([]);
        setScan({
          id: scanId,
          clientId: 'demo-client',
          clientName: 'Demo Client',
          region: 'US',
          scanType: 'manual',
          status: 'completed',
          resultsCount: 0,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Error fetching scan details:', error);
      toast.error('Failed to load scan results');
    } finally {
      setLoading(false);
    }
  }, [scanId, navigate]);

  useEffect(() => {
    fetchScanDetails();
  }, [fetchScanDetails]);

  const handleDeleteScan = async () => {
    if (!window.confirm('Are you sure you want to delete this scan? This action cannot be undone.')) return;
    
    try {
      console.log('🗑️ Deleting scan:', scanId);
      const response = await api.delete(`/scans/${scanId}`);
      console.log('✅ Delete response:', response.data);
      
      toast.success(`Scan deleted successfully (${response.data.deletedResultsCount} results removed)`);
      navigate('/admin/scans');
    } catch (error) {
      console.error('❌ Error deleting scan:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      if (error.response?.status === 404) {
        toast.error('Scan not found - it may have already been deleted');
      } else {
        toast.error('Failed to delete scan');
      }
    }
  };

  const handleSaveResults = async () => {
    if (results.length === 0) {
      toast.error('No results to save');
      return;
    }

    try {
      setIsSaving(true);
      console.log('💾 Saving results to database...');
      
      // Get client information from the scan
      const clientInfo = scan?.clientId || scan?.client || {};
      
      console.log('🔍 Scan data for save:', {
        scanId,
        scanClientId: scan?.clientId,
        scanClientName: scan?.clientId?.name || scan?.clientName,
        clientInfo
      });
      
      const response = await api.post(`/scans/${scanId}/results`, {
        scanId: scanId,
        results: results,
        clientData: {
          name: scan?.clientId?.name || scan?.clientName || 'Unknown Client',
          clientId: scan?.clientId?._id || scan?.clientId,
          industry: scan?.clientId?.settings?.industry || 'Technology',
          businessType: scan?.clientId?.settings?.businessType || 'Software Development',
          targetAudience: scan?.clientId?.settings?.targetAudience || 'Developers and Tech Companies',
          region: scan?.region || 'US',
          website: scan?.clientId?.settings?.website || 'https://demo-client.com',
          description: scan?.clientId?.settings?.description || 'Leading provider of web development and software solutions'
        }
      });
      
      console.log('✅ Results saved successfully:', response.data);
      toast.success(`Saved ${results.length} results to database`);
      
      // Redirect to the new scan ID if one was returned
      if (response.data && response.data.scanId) {
        const newScanId = response.data.scanId;
        console.log('🔄 Redirecting to new scan ID:', newScanId);
        navigate(`/admin/scans/${newScanId}`);
      }
      
    } catch (error) {
      console.error('❌ Error saving results:', error);
      toast.error('Failed to save results to database');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendToClient = async () => {
    if (results.length === 0) {
      toast.error('No results to send');
      return;
    }

    try {
      setIsSending(true);
      console.log('📤 Sending results to client portal...');
      
      // IMPORTANT: Always send the parent scan ID, not the child scan ID
      // This ensures the entire report (parent + all children) is sent together
      let parentScanId = scanId;
      if (scan?.parentId) {
        // If this is a child scan, use the parent ID instead
        parentScanId = scan.parentId?._id || scan.parentId;
        console.log('🔍 Current scan is a child, sending parent scan instead:', parentScanId);
      }
      
      // Get client information from the scan
      const clientInfo = scan?.clientId || scan?.client || {};
      
      console.log('🔍 Scan data for send:', {
        scanId,
        parentScanId,
        isChild: !!scan?.parentId,
        scanClientId: scan?.clientId,
        scanClientName: scan?.clientId?.name,
        clientInfo
      });
      
      const response = await api.post('/scans/send-to-client', {
        scanId: parentScanId, // Always send parent scan ID
        results: results,
        clientData: {
          name: scan?.clientId?.name || scan?.clientName || 'Unknown Client',
          clientId: scan?.clientId?._id || scan?.clientId,
          industry: scan?.clientId?.settings?.industry || 'Technology',
          businessType: scan?.clientId?.settings?.businessType || 'Software Development',
          targetAudience: scan?.clientId?.settings?.targetAudience || 'Developers and Tech Companies',
          region: scan?.region || 'US',
          website: scan?.clientId?.settings?.website || 'https://demo-client.com',
          description: scan?.clientId?.settings?.description || 'Leading provider of web development and software solutions'
        }
      });
      
      console.log('✅ Results sent to client successfully:', response.data);
      toast.success(`Report sent to client (includes all weeks)`);
      
    } catch (error) {
      console.error('❌ Error sending to client:', error);
      toast.error('Failed to send results to client portal');
    } finally {
      setIsSending(false);
    }
  };

  const handleEditScan = () => {
    // Navigate to edit scan page or open edit modal
    navigate(`/admin/scans/${scanId}/edit`);
  };

  // Use search results if available, otherwise use scan results
  const allResults = results || [];
  
  const sortedResults = [...allResults].sort((a, b) => {
    switch (sortBy) {
      case 'position':
        return (a.position || 0) - (b.position || 0);
      case 'sentiment':
        return (a.sentiment || '').localeCompare(b.sentiment || '');
      case 'confidence':
        return (b.confidence || 0) - (a.confidence || 0);
      case 'title':
        return (a.title || '').localeCompare(b.title || '');
      default:
        return 0;
    }
  });

  // Enable pagination for both scan results and search results
  const shouldPaginate = sortedResults.length > resultsPerPage;
  const totalPages = Math.ceil(sortedResults.length / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const paginatedResults = sortedResults.slice(startIndex, endIndex);

  // Reset to first page when results change
  useEffect(() => {
    setCurrentPage(1);
  }, [results]);

  // Keyboard navigation for pagination
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            handlePageChange(Math.max(currentPage - 1, 1));
            break;
          case 'ArrowRight':
            e.preventDefault();
            handlePageChange(Math.min(currentPage + 1, totalPages));
            break;
          case 'Home':
            e.preventDefault();
            handlePageChange(1);
            break;
          case 'End':
            e.preventDefault();
            handlePageChange(totalPages);
            break;
          default:
            // No action for other keys
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, totalPages]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResultsPerPageChange = (newResultsPerPage) => {
    setResultsPerPage(newResultsPerPage);
    setCurrentPage(1); // Reset to first page when changing results per page
  };

  const handleGoToPage = (page) => {
    const pageNumber = parseInt(page);
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const getSentimentIcon = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'negative':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'neutral':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-900 text-green-200 border-green-200';
      case 'negative':
        return 'bg-red-900 text-red-200 border-red-200';
      case 'neutral':
        return 'bg-yellow-900 text-yellow-200 border-yellow-200';
      default:
        return 'bg-gray-700 text-gray-200 border-gray-200';
    }
  };

  const getSentimentText = (result) => {
    // Check if sentiment was actually analyzed (from metadata)
    const sentimentAnalyzed = result?.metadata?.sentimentAnalyzed !== false;
    const sentiment = result?.sentiment || result?.sentiment;
    
    if (!sentimentAnalyzed || sentiment === null || sentiment === undefined) {
      return 'Sentiments Not Created';
    }
    return sentiment || 'neutral';
  };
  
  const isSentimentAnalyzed = (result) => {
    // Show all results even if sentiment is not analyzed
    // Return true if sentiment exists, but don't hide results if it doesn't
    return result?.metadata?.sentimentAnalyzed === true && 
           result?.sentiment !== null && 
           result?.sentiment !== undefined;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMovementIcon = (movement, currentRank, previousRank) => {
    switch (movement) {
      case 'new':
        return null; // Remove Plus icon for new entries
      case 'improved':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'dropped':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'unchanged':
        return <Minus className="w-4 h-4 text-gray-400" />;
      case 'disappeared':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getMovementColor = (movement) => {
    switch (movement) {
      case 'new':
        return 'bg-blue-900 text-blue-200 border-blue-200';
      case 'improved':
        return 'bg-green-900 text-green-200 border-green-200';
      case 'dropped':
        return 'bg-red-900 text-red-200 border-red-200';
      case 'unchanged':
        return 'bg-gray-700 text-gray-200 border-gray-200';
      case 'disappeared':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-700 text-gray-200 border-gray-200';
    }
  };

  const getMovementText = (movement, currentRank, previousRank) => {
    switch (movement) {
      case 'new':
        return ''; // Remove "New Entry" text
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
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#060b16'}}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading scan results...</p>
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#060b16'}}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2" style={{color: '#fafafa'}}>Scan Not Found</h2>
          <p className="text-gray-400 mb-4">The scan you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/admin/scans')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Scans
          </button>
        </div>
      </div>
    );
  }

  const totalResults = (results || []).length;

  const sentimentStats = {
    positive: (results || []).filter(r => r.sentiment === 'positive').length,
    negative: (results || []).filter(r => r.sentiment === 'negative').length,
    neutral: (results || []).filter(r => r.sentiment === 'neutral').length,
  };

  const movementStats = {
    new: (results || []).filter(r => r.movement === 'new').length,
    improved: (results || []).filter(r => r.movement === 'improved').length,
    dropped: (results || []).filter(r => r.movement === 'dropped').length,
    unchanged: (results || []).filter(r => r.movement === 'unchanged').length,
    disappeared: (results || []).filter(r => r.movement === 'disappeared').length,
  };
  const positivePercentage = totalResults > 0 ? Math.round((sentimentStats.positive / totalResults) * 100) : 0;
  const negativePercentage = totalResults > 0 ? Math.round((sentimentStats.negative / totalResults) * 100) : 0;
  const neutralPercentage = totalResults > 0 ? Math.round((sentimentStats.neutral / totalResults) * 100) : 0;

  return (
    <div className="min-h-screen" style={{backgroundColor: '#060b16'}}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="rounded-xl shadow-lg p-6 mb-6 bg-gray-800 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin/scans')}
                className="flex items-center space-x-2 text-gray-300 hover: transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Scans</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
        <h1 className="text-2xl font-bold mb-2" style={{color: '#fafafa'}}>
          {scan?.clientId?.name || scan?.clientName || 'Unknown Client'}
        </h1>
        {scan?.clientId?.contact?.email && (
          <p className="text-sm text-gray-400">{scan.clientId.contact.email}</p>
        )}
              <p className="text-gray-400">Scan Results</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-gray-300">{scan.region}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-300">
                  {scan.createdAt ? new Date(scan.createdAt).toLocaleDateString() : scan.startedAt ? new Date(scan.startedAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold" style={{color: '#fafafa'}}>{totalResults}</div>
              <div className="text-sm text-gray-300">Total Results</div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl shadow-lg p-6 bg-gray-800 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Positive</p>
                <p className="text-2xl font-bold text-green-400">{sentimentStats.positive}</p>
                <p className="text-xs text-gray-300">{positivePercentage}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl shadow-lg p-6 bg-gray-800 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Negative</p>
                <p className="text-2xl font-bold text-red-400">{sentimentStats.negative}</p>
                <p className="text-xs text-gray-300">{negativePercentage}%</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl shadow-lg p-6 bg-gray-800 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Neutral</p>
                <p className="text-2xl font-bold text-yellow-400">{sentimentStats.neutral}</p>
                <p className="text-xs text-gray-300">{neutralPercentage}%</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl shadow-lg p-6 bg-gray-800 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Avg Confidence</p>
                <p className="text-2xl font-bold text-blue-400">
                  {results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100) : 0}%
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>
        </div>

        {/* Google Search Interface */}
        <div className="rounded-xl shadow-lg p-6 mb-6 bg-gray-800 border border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium" style={{color: '#f3f4f6'}}>Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800"
                style={{color: '#fafafa'}}
              >
                <option value="position" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Position</option>
                <option value="sentiment" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Sentiment</option>
                <option value="confidence" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Confidence</option>
                <option value="title" style={{backgroundColor: '#1f2937', color: '#fafafa'}}>Title</option>
              </select>
            </div>
            
            <div className="text-sm text-gray-300">
              {sortedResults.length} results
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="rounded-xl shadow-lg overflow-hidden bg-gray-800 border border-gray-700">
          <div className="p-6 border-b border-gray-600">
            <h2 className="text-xl font-bold" style={{color: '#fafafa'}}>
              Scan Results ({sortedResults.length} total)
            </h2>
            <p className="text-sm text-gray-300 mt-1">
              {shouldPaginate 
                ? `Showing ${startIndex + 1}-${Math.min(endIndex, sortedResults.length)} of ${sortedResults.length} results`
                : `Showing all ${sortedResults.length} results`
              }
            </p>
            {sortedResults.length > 0 && (
              <div className="mt-2 text-xs text-gray-400">
                Results count: {sortedResults.length} | 
                Scan data count: {scan?.resultsCount || 0}
              </div>
            )}
          </div>

          {/* Pagination Info */}
          {sortedResults.length > 0 && (
            <div className="px-6 py-3 bg-gray-800 border-b border-gray-600">
              <div className="flex items-center justify-between text-sm text-gray-300">
                <div>
                  Scan Results - 
                  Showing {startIndex + 1}-{Math.min(endIndex, sortedResults.length)} of {sortedResults.length} results
                  {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
                </div>
                <div className="text-xs text-gray-400">
                  💡 Use Ctrl+←/→ to navigate pages, Ctrl+Home/End for first/last page
                </div>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-600">
            {paginatedResults.map((result, index) => {
              console.log('🔍 Rendering result:', result.sentiment, result.confidence, result);
              return (
              <motion.div
                key={result._id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                      {result.position || index + 1}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2 line-clamp-2" style={{color: '#f3f4f6'}}>
                          <a
                            href={result.originalUrl || result.originalLink || result.link || result.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors"
                            style={{color: '#fafafa'}}
                            onClick={(e) => {
                              const url = result.originalUrl || result.originalLink || result.link || result.url;
                              if (!url || url === '#') {
                                e.preventDefault();
                                console.log('No valid URL found for result:', result);
                                toast.error('No valid URL found for this result');
                              }
                            }}
                          >
                          {result.metadata?.originalTitle || result.title || 'No title'}
                          </a>
                        </h3>
                        
                        <p className="text-gray-300 mb-3 line-clamp-2">
                          {result.metadata?.originalSnippet || result.snippet || result.description || 'No description available'}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-400">
                          {result.page && <span>Page: {result.page}</span>}
                          <span>Domain: {result.metadata?.originalDomain || result.domain || (result.url || result.link ? new URL(result.url || result.link).hostname : 'N/A')}</span>
                          {result.movement && result.movement !== 'new' && (
                            <div className="flex items-center space-x-1">
                              {getMovementIcon(result.movement, result.position, result.previousRank)}
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getMovementColor(result.movement)}`}>
                                {getMovementText(result.movement, result.position, result.previousRank)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
                          !isSentimentAnalyzed(result)
                            ? 'bg-gray-700 text-gray-400 border-gray-300' 
                            : getSentimentColor(result.sentiment)
                        }`}>
                          {getSentimentText(result)}
                        </span>
                        {isSentimentAnalyzed(result) && result.confidence !== null && result.confidence !== undefined && (
                          <span className={`text-sm font-medium ${getConfidenceColor(result.confidence)}`}>
                            {Math.round(result.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center space-x-4">
                      <a
                        href={result.originalUrl || result.originalLink || result.link || result.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center space-x-1 transition-colors ${
                          (result.originalUrl || result.originalLink || result.link || result.url) 
                            ? 'cursor-pointer' 
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                        style={(result.originalUrl || result.originalLink || result.link || result.url) ? {color: '#fafafa'} : {}}
                        onClick={(e) => {
                          const url = result.originalUrl || result.originalLink || result.link || result.url;
                          console.log('🔗 Frontend URL Debug:', {
                            originalUrl: result.originalUrl,
                            originalLink: result.originalLink,
                            link: result.link,
                            url: result.url,
                            finalUrl: url,
                            fullResult: result
                          });
                          if (!url || url === '#') {
                            e.preventDefault();
                            console.log('No valid URL found for result:', result);
                            toast.error('No valid URL found for this result');
                          } else {
                            console.log('Opening link:', url);
                            toast.success('Opening link in new tab...');
                          }
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>{(result.originalUrl || result.originalLink || result.link || result.url) ? 'Visit Link' : 'No Link Available'}</span>
                      </a>
                      
                      {(result.originalUrl || result.originalLink || result.link || result.url) && (
                        <button
                          onClick={() => {
                            const url = result.originalUrl || result.originalLink || result.link || result.url;
                            navigator.clipboard.writeText(url).then(() => {
                              toast.success('Link copied to clipboard!');
                            }).catch(() => {
                              toast.error('Failed to copy link');
                            });
                          }}
                          className="flex items-center space-x-1 text-gray-400 hover:text-gray-200 transition-colors"
                          title="Copy link to clipboard"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy Link</span>
                        </button>
                      )}
                      
                      {/* Analysis reasoning hidden - only showing sentiment */}
                    </div>
                  </div>
                </div>
              </motion.div>
              );
            })}
          </div>

          {sortedResults.length === 0 && (
            <div className="p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2" style={{color: '#fafafa'}}>
                No scan results available
              </h3>
              <p className="text-gray-400 mb-4">
                No scan results available for this scan.
              </p>
            </div>
          )}

          {/* Pagination Controls - Show for both scan results and search results */}
          {sortedResults.length > 0 && shouldPaginate && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    {/* Show page numbers with smart pagination */}
                    {(() => {
                      const pages = [];
                      const maxVisiblePages = 5;
                      
                      if (totalPages <= maxVisiblePages) {
                        // Show all pages if total is small
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // Smart pagination for many pages
                        if (currentPage <= 3) {
                          // Show first 3 pages, ellipsis, and last page
                          for (let i = 1; i <= 3; i++) pages.push(i);
                          pages.push('...');
                          pages.push(totalPages);
                        } else if (currentPage >= totalPages - 2) {
                          // Show first page, ellipsis, and last 3 pages
                          pages.push(1);
                          pages.push('...');
                          for (let i = totalPages - 2; i <= totalPages; i++) pages.push(i);
                        } else {
                          // Show first page, ellipsis, current-1, current, current+1, ellipsis, last page
                          pages.push(1);
                          pages.push('...');
                          for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                          pages.push('...');
                          pages.push(totalPages);
                        }
                      }
                      
                      return pages.map((page, index) => (
                        page === '...' ? (
                          <span key={`ellipsis-${index}`} className="px-3 py-2 text-sm text-gray-400">
                            ...
                          </span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              currentPage === page
                                ? 'bg-blue-600 text-gray-200'
                                : 'text-gray-300 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      ));
                    })()}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                
                <div className="flex items-center space-x-4 text-sm text-gray-300">
                  <div>
                    Showing {startIndex + 1}-{Math.min(endIndex, sortedResults.length)} of {sortedResults.length} results
                  </div>
                  <div>
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="resultsPerPage" className="text-sm font-medium" style={{color: '#f3f4f6'}}>
                      Show:
                    </label>
                    <select
                      id="resultsPerPage"
                      value={resultsPerPage}
                      onChange={(e) => handleResultsPerPageChange(parseInt(e.target.value))}
                      className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="text-sm text-gray-400">per page</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="goToPage" className="text-sm font-medium" style={{color: '#f3f4f6'}}>
                      Go to:
                    </label>
                    <input
                      id="goToPage"
                      type="number"
                      min="1"
                      max={totalPages}
                      placeholder={currentPage}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleGoToPage(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-400">page</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanResultsPage;
