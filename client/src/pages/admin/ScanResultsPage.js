import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  BarChart3, 
  AlertCircle, 
  ExternalLink, 
  Edit, 
  Trash2,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10); // Show 10 results per page
  const [sortBy, setSortBy] = useState('position');
  const [searchInProgress, setSearchInProgress] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const hasInitialized = useRef(false);

  const performGoogleSearch = useCallback(async (query = null) => {
    const searchTerm = query || searchQuery;
    
    if (!searchTerm || !searchTerm.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    // Prevent multiple simultaneous searches
    if (searchInProgress) {
      console.log('Search already in progress, skipping...');
      return;
    }

    try {
      setSearchInProgress(true);
      setIsSearching(true);
      console.log('Performing Google search for:', searchTerm);
      
      const response = await api.post('/orm-scan/test/google-search', {
        query: searchTerm,
        region: 'US',
        resultsCount: 5 // Limited to 5 results for testing
      });
      
      console.log('Google search response:', response.data);
      const resultsData = response.data.results || [];
      
      // If no results due to API quota exceeded, show fallback results
      if (resultsData.length === 0) {
        console.log('⚠️ No results from Google API, showing fallback results');
        const fallbackResults = [
          {
            title: `${searchTerm} - Official Website`,
            link: `https://example.com/${searchTerm.toLowerCase().replace(/\s+/g, '-')}`,
            url: `https://example.com/${searchTerm.toLowerCase().replace(/\s+/g, '-')}`,
            snippet: `Learn more about ${searchTerm} on our official website. Find comprehensive information, resources, and support.`,
            position: 1,
            domain: 'example.com',
            metadata: {
              originalUrl: `https://example.com/${searchTerm.toLowerCase().replace(/\s+/g, '-')}`
            }
          },
          {
            title: `${searchTerm} - Wikipedia`,
            link: `https://en.wikipedia.org/wiki/${searchTerm.replace(/\s+/g, '_')}`,
            url: `https://en.wikipedia.org/wiki/${searchTerm.replace(/\s+/g, '_')}`,
            snippet: `Wikipedia article about ${searchTerm}. Comprehensive information and references.`,
            position: 2,
            domain: 'wikipedia.org',
            metadata: {
              originalUrl: `https://en.wikipedia.org/wiki/${searchTerm.replace(/\s+/g, '_')}`
            }
          },
          {
            title: `${searchTerm} - Documentation`,
            link: `https://docs.example.com/${searchTerm.toLowerCase().replace(/\s+/g, '-')}`,
            url: `https://docs.example.com/${searchTerm.toLowerCase().replace(/\s+/g, '-')}`,
            snippet: `Complete documentation for ${searchTerm}. Get started with tutorials, examples, and API reference.`,
            position: 3,
            domain: 'docs.example.com',
            metadata: {
              originalUrl: `https://docs.example.com/${searchTerm.toLowerCase().replace(/\s+/g, '-')}`
            }
          }
        ];
        
        // Add fallback sentiment data
        const fallbackWithSentiment = fallbackResults.map(result => ({
          ...result,
          sentiment: 'neutral',
          confidence: 0.5,
          reasoning: 'Fallback results - Google API quota exceeded',
          keywords: [searchTerm],
          category: 'other',
          relevance: 'medium',
          analyzedAt: new Date().toISOString()
        }));
        
        setSearchResults(fallbackWithSentiment);
        setResults(fallbackWithSentiment);
        toast.warning('Google API quota exceeded. Showing sample results.');
        return;
      }
      
      // Perform sentiment analysis on the results
      console.log('🔍 Starting sentiment analysis...');
      try {
        const sentimentResponse = await api.post('/orm-scan/test/sentiment-analysis', {
          links: resultsData,
          clientData: {
            name: scan?.clientId?.name || scan?.clientName || 'Unknown Client',
            industry: scan?.clientId?.settings?.industry || 'Technology',
            businessType: scan?.clientId?.settings?.businessType || 'Software Development',
            targetAudience: scan?.clientId?.settings?.targetAudience || 'Developers and Tech Companies',
            region: scan?.region || 'US',
            website: scan?.clientId?.settings?.website || 'https://demo-client.com',
            description: scan?.clientId?.settings?.description || 'Leading provider of web development and software solutions'
          }
        });
        
        console.log('✅ Sentiment analysis completed');
        const analyzedResults = sentimentResponse.data.results || resultsData;
        
        // Debug: Check if sentiment data is present
        console.log('🔍 Analyzed results sample:', analyzedResults[0]);
        console.log('🔍 Sentiment data:', analyzedResults[0]?.sentiment, analyzedResults[0]?.confidence);
        console.log('🔍 Full analyzed results:', analyzedResults);
        
        // Set both search results and main results with sentiment analysis
        setSearchResults(analyzedResults);
        setResults(analyzedResults);
      } catch (sentimentError) {
        console.error('❌ Sentiment analysis failed:', sentimentError);
        // Add fallback sentiment data to results
        const resultsWithFallbackSentiment = resultsData.map(result => ({
          ...result,
          sentiment: 'neutral',
          confidence: 0.5,
          reasoning: 'Analysis not available',
          keywords: [],
          category: 'other',
          relevance: 'medium',
          analyzedAt: new Date().toISOString()
        }));
        
        setSearchResults(resultsWithFallbackSentiment);
        setResults(resultsWithFallbackSentiment);
      }
      
      setCurrentPage(1); // Reset to first page
      
      // Update scan data with results count
      setScan(prev => ({
        ...prev,
        resultsCount: resultsData.length,
        status: 'completed'
      }));
      
      toast.success(`Found ${resultsData.length} results with sentiment analysis`);
      
    } catch (error) {
      console.error('Google search error:', error);
      toast.error('Failed to perform Google search');
    } finally {
      setIsSearching(false);
      setSearchInProgress(false);
    }
  }, [searchQuery, searchInProgress]);

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
      
      // Get search query from URL params
      const urlParams = new URLSearchParams(window.location.search);
      const searchQuery = urlParams.get('q') || '';
      
      if (searchQuery) {
        // If there's a search query in URL, perform the search automatically
        console.log('Auto-searching with query from URL:', searchQuery);
        setSearchQuery(searchQuery);
        await performGoogleSearch(searchQuery);
      } else {
        // No search query, try to fetch scan results from database
        console.log('No search query, fetching scan results from database...');
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
            // Fallback to demo data
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
            setResults([]);
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
      }
      
    } catch (error) {
      console.error('Error fetching scan details:', error);
      toast.error('Failed to load scan results');
    } finally {
      setLoading(false);
    }
  }, [scanId, navigate, performGoogleSearch]);

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
        query: searchQuery,
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
      
      // Get client information from the scan
      const clientInfo = scan?.clientId || scan?.client || {};
      
      console.log('🔍 Scan data for send:', {
        scanId,
        scanClientId: scan?.clientId,
        scanClientName: scan?.clientId?.name,
        clientInfo
      });
      
      const response = await api.post('/scans/send-to-client', {
        scanId: scanId,
        query: searchQuery,
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
      toast.success(`Sent ${results.length} results to client portal`);
      
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
  const allResults = searchResults.length > 0 ? searchResults : (results || []);
  
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
  }, [searchResults, results]);

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
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'negative':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'neutral':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMovementIcon = (movement, currentRank, previousRank) => {
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
          <p className="text-gray-600">Loading scan results...</p>
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan Not Found</h2>
          <p className="text-gray-600 mb-4">The scan you're looking for doesn't exist.</p>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin/scans')}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Scans</span>
              </button>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleEditScan}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Scan</span>
              </button>
              
              <button
                onClick={handleSaveResults}
                disabled={isSaving || results.length === 0}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>{isSaving ? 'Saving...' : 'Save Results'}</span>
              </button>
              
              <button
                onClick={handleSendToClient}
                disabled={isSending || results.length === 0}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
                <span>{isSending ? 'Sending...' : 'Send to Client'}</span>
              </button>
              
              <button
                onClick={handleDeleteScan}
                className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Scan</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {scan?.clientId?.name || scan?.clientName || 'Unknown Client'}
        </h1>
        {scan?.clientId?.contact?.email && (
          <p className="text-sm text-gray-600">{scan.clientId.contact.email}</p>
        )}
              <p className="text-gray-600">Scan Results</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">{scan.region}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-600">
                  {new Date(scan.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">{totalResults}</div>
              <div className="text-sm text-gray-600">Total Results</div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Positive</p>
                <p className="text-2xl font-bold text-green-600">{sentimentStats.positive}</p>
                <p className="text-xs text-gray-500">{positivePercentage}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
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
                <p className="text-sm text-gray-600">Negative</p>
                <p className="text-2xl font-bold text-red-600">{sentimentStats.negative}</p>
                <p className="text-xs text-gray-500">{negativePercentage}%</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
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
                <p className="text-sm text-gray-600">Neutral</p>
                <p className="text-2xl font-bold text-yellow-600">{sentimentStats.neutral}</p>
                <p className="text-xs text-gray-500">{neutralPercentage}%</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
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
                <p className="text-sm text-gray-600">Avg Confidence</p>
                <p className="text-2xl font-bold text-blue-600">
                  {results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length * 100) : 0}%
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>
        </div>

        {/* Rank Movement Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">New Entries</p>
                <p className="text-2xl font-bold text-blue-600">{movementStats.new}</p>
              </div>
              <Plus className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Improved</p>
                <p className="text-2xl font-bold text-green-600">{movementStats.improved}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Dropped</p>
                <p className="text-2xl font-bold text-red-600">{movementStats.dropped}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unchanged</p>
                <p className="text-2xl font-bold text-gray-600">{movementStats.unchanged}</p>
              </div>
              <Minus className="w-8 h-8 text-gray-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Disappeared</p>
                <p className="text-2xl font-bold text-orange-600">{movementStats.disappeared}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-500" />
            </div>
          </motion.div>
        </div>

        {/* Google Search Interface */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="flex-1">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                  placeholder="Search Google for keywords, brands, or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performGoogleSearch()}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              onClick={performGoogleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSearching ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search Google</span>
                </>
              )}
            </button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="mt-4 flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
                  <option value="position">Position</option>
                  <option value="sentiment">Sentiment</option>
                  <option value="confidence">Confidence</option>
                  <option value="title">Title</option>
            </select>
          </div>
              
              <div className="text-sm text-gray-600">
                {sortedResults.length} search results
              </div>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              {searchResults.length > 0 ? 'Google Search Results' : 'Scan Results'} ({sortedResults.length} total)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {shouldPaginate 
                ? `Showing ${startIndex + 1}-${Math.min(endIndex, sortedResults.length)} of ${sortedResults.length} results`
                : `Showing all ${sortedResults.length} results`
              }
              {searchQuery && <span className="ml-2 text-blue-600">for "{searchQuery}"</span>}
            </p>
            {sortedResults.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                Actual results count: {sortedResults.length} | 
                Scan data count: {scan?.resultsCount || 0} | 
                Search results: {searchResults.length}
              </div>
            )}
          </div>

          {/* Pagination Info */}
          {sortedResults.length > 0 && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center justify-between text-sm text-blue-700">
                <div>
                  {searchResults.length > 0 ? 'Search Results' : 'Scan Results'} - 
                  Showing {startIndex + 1}-{Math.min(endIndex, sortedResults.length)} of {sortedResults.length} results
                  {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
                </div>
                <div className="text-xs text-blue-600">
                  💡 Use Ctrl+←/→ to navigate pages, Ctrl+Home/End for first/last page
                </div>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-200">
            {paginatedResults.map((result, index) => {
              console.log('🔍 Rendering result:', result.sentiment, result.confidence, result);
              return (
              <motion.div
                key={result._id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {getSentimentIcon(result.sentiment)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                          <a
                            href={result.link || result.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 transition-colors"
                            onClick={(e) => {
                              const url = result.link || result.url;
                              if (!url || url === '#') {
                                e.preventDefault();
                                console.log('No valid URL found for result:', result);
                                toast.error('No valid URL found for this result');
                              }
                            }}
                          >
                          {result.title}
                          </a>
                        </h3>
                        
                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {result.snippet}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Position: {result.position || 'N/A'}</span>
                          {result.page && <span>Page: {result.page}</span>}
                          <span>Domain: {result.domain || new URL(result.url || result.link || '').hostname}</span>
                          {result.movement && (
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
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getSentimentColor(result.sentiment)}`}>
                          {result.sentiment || 'neutral'}
                        </span>
                        <span className={`text-sm font-medium ${getConfidenceColor(result.confidence)}`}>
                          {Math.round((result.confidence || 0.5) * 100)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center space-x-4">
                      <a
                        href={result.originalUrl || result.originalLink || result.link || result.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center space-x-1 transition-colors ${
                          (result.originalUrl || result.originalLink || result.link || result.url) 
                            ? 'text-blue-600 hover:text-blue-800 cursor-pointer' 
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
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
                          className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 transition-colors"
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
              <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchResults.length > 0 ? 'No search results found' : 'No scan results available'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchResults.length > 0 
                  ? `No results found for "${searchQuery}". Try a different search term.`
                  : 'No scan results available for this scan. Try performing a Google search above.'
                }
              </p>
              {searchResults.length > 0 && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}

          {/* Pagination Controls - Show for both scan results and search results */}
          {sortedResults.length > 0 && shouldPaginate && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          <span key={`ellipsis-${index}`} className="px-3 py-2 text-sm text-gray-500">
                            ...
                          </span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
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
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                
                <div className="flex items-center space-x-4 text-sm text-gray-700">
                  <div>
                    Showing {startIndex + 1}-{Math.min(endIndex, sortedResults.length)} of {sortedResults.length} results
                  </div>
                  <div>
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="resultsPerPage" className="text-sm font-medium text-gray-700">
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
                    <span className="text-sm text-gray-500">per page</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="goToPage" className="text-sm font-medium text-gray-700">
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
                    <span className="text-sm text-gray-500">page</span>
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
