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
  Download,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ClientScanResults = () => {
  const navigate = useNavigate();
  const { scanId } = useParams(); // This is the parent scan ID
  const [scan, setScan] = useState(null);
  const [scans, setScans] = useState([]); // All scans (parent + children)
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('position');
  const [filterBy, setFilterBy] = useState('all');
  const fetchingRef = useRef(false);

  const fetchScanDetails = useCallback(async () => {
    if (fetchingRef.current) {
      console.log('⏳ Already fetching, skipping duplicate call');
      return;
    }
    
    fetchingRef.current = true;
    try {
      setLoading(true);
      console.log('🔍 [CLIENT SCAN RESULTS] Fetching scan details:', {
        scanIdFromParams: scanId,
        scanIdType: typeof scanId,
        scanIdLength: scanId?.length
      });
      
      // Ensure scanId is a string
      const scanIdString = scanId?.toString() || scanId;
      console.log('🔍 [CLIENT SCAN RESULTS] Making API call with:', scanIdString);
      
      // Fetch the specific scan (client endpoint)
      try {
        const scanResponse = await api.get(`/scans/client/${scanIdString}`);
        console.log('✅ [CLIENT SCAN RESULTS] Scan response received:', scanResponse.status);
        const scanData = scanResponse.data;
        
        if (!scanData) {
          console.log('❌ [CLIENT SCAN RESULTS] No scan data in response');
          toast.error('Scan not found');
          navigate('/scans');
          return;
        }

        console.log('✅ [CLIENT SCAN RESULTS] Scan data loaded:', scanData._id);
        
        // Determine if this is a parent or child scan
        const isParentScan = !scanData.parentId;
        let parentScan = null;
        let allRelatedScans = [];
        
        if (isParentScan) {
          // This is a parent scan - fetch all its children
          parentScan = scanData;
          
          // Fetch all scans for this client to find children
          const allScansResponse = await api.get('/scans/client');
          const allScans = allScansResponse.data || [];
          
          // Find all children of this parent
          const children = allScans.filter(s => {
            if (!s.parentId) return false;
            const parentIdStr = (parentScan._id || parentScan.id)?.toString();
            const childParentIdStr = (s.parentId?._id || s.parentId)?.toString();
            return parentIdStr && childParentIdStr && parentIdStr === childParentIdStr;
          });
          
          allRelatedScans = [parentScan, ...children].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
        } else {
          // This is a child scan - fetch its parent and siblings
          const parentIdStr = (scanData.parentId?._id || scanData.parentId)?.toString();
          
          // Fetch parent scan
          try {
            const parentResponse = await api.get(`/scans/client/${parentIdStr}`);
            parentScan = parentResponse.data;
          } catch (err) {
            console.error('Could not fetch parent scan:', err);
          }
          
          // Fetch all scans for this client to find siblings
          const allScansResponse = await api.get('/scans/client');
          const allScans = allScansResponse.data || [];
          
          // Find parent and all children
          const foundParent = allScans.find(s => {
            const scanId = (s._id || s.id)?.toString();
            return scanId === parentIdStr;
          }) || parentScan;
          
          const siblings = allScans.filter(s => {
            if (!s.parentId) return false;
            const childParentIdStr = (s.parentId?._id || s.parentId)?.toString();
            return childParentIdStr === parentIdStr;
          });
          
          allRelatedScans = foundParent ? [foundParent, ...siblings].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0)) : [scanData];
        }
        
        setScan(isParentScan ? scanData : (parentScan || scanData));
        setScans(allRelatedScans);
        
        // Fetch results for all related scans
        const allResultsPromises = allRelatedScans.map(s => 
          api.get(`/scans/client/${(s._id || s.id).toString()}/results`)
            .then(res => res.data || [])
            .catch(err => {
              console.error(`Error fetching results for scan ${s._id}:`, err);
              return [];
            })
        );
        
        const allResultsArrays = await Promise.all(allResultsPromises);
        const allResults = allResultsArrays.flat();
        
        // Map results to include scanId for comparison
        const resultsWithScanId = allResults.map((result, resultIndex) => {
          // Find which scan this result belongs to
          let matchingScanId = result.scanId;
          if (!matchingScanId) {
            // Find which array contains this result
            const arrayIndex = allResultsArrays.findIndex(arr => arr.includes(result));
            if (arrayIndex >= 0 && arrayIndex < allRelatedScans.length) {
              matchingScanId = allRelatedScans[arrayIndex]._id || allRelatedScans[arrayIndex].id;
            }
          }
          return {
            ...result,
            scanId: matchingScanId || result.scanId
          };
        });
        
        setResults(resultsWithScanId);
        console.log('📊 Loaded scan results:', resultsWithScanId.length, 'from', allRelatedScans.length, 'scans');
      } catch (scanError) {
        console.error('❌ [CLIENT SCAN RESULTS] Error fetching scan:', scanError);
        console.error('❌ [CLIENT SCAN RESULTS] Error details:', {
          message: scanError.message,
          status: scanError.response?.status,
          data: scanError.response?.data,
          url: scanError.config?.url
        });
        toast.error(scanError.response?.data?.message || 'Scan not found');
        navigate('/scans');
        return;
      }
    } catch (error) {
      console.error('❌ Error fetching scan details:', error);
      toast.error('Failed to load scan details');
      navigate('/scans');
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
        return 'text-green-200 bg-green-800';
      case 'negative':
        return 'text-red-200 bg-red-800';
      case 'neutral':
        return 'text-gray-200 bg-gray-800';
      default:
        return 'text-gray-200 bg-gray-800';
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
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRankingChange = (result) => {
    if (!result.rankingChange && result.rankingChange !== 0) {
      // New result - no previous data
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-800 text-blue-200">
          <span className="w-2 h-2 bg-blue-400 rounded-full mr-1"></span>
          New
        </span>
      );
    }

    if (result.rankingChange === 0) {
      // Same position
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-200">
          <Minus className="w-3 h-3 mr-1" />
          Same
        </span>
      );
    }

    if (result.rankingChange > 0) {
      // Moved up (positive change)
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-800 text-green-200">
          <TrendingUp className="w-3 h-3 mr-1" />
          +{result.rankingChange}
        </span>
      );
    }

    if (result.rankingChange < 0) {
      // Moved down (negative change)
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-800 text-red-200">
          <TrendingDown className="w-3 h-3 mr-1" />
          {result.rankingChange}
        </span>
      );
    }

    return null;
  };

  // Build comparison table data (Before vs After) - same as admin view
  const buildComparisonData = () => {
    if (scans.length === 0) return [];

    // Get parent scan (no parentId) - this is the "before"
    const parentScan = scans.find(s => !s.parentId);
    if (!parentScan) return [];

    // Get latest child scan (most recent) - this is the "after"
    const childScans = scans.filter(s => s.parentId).sort((a, b) => {
      const dateA = new Date(a.completedAt || a.startedAt || 0);
      const dateB = new Date(b.completedAt || b.startedAt || 0);
      return dateB - dateA; // Most recent first
    });
    
    const latestScan = childScans[0];
    if (!latestScan) {
      // No child scans yet, show only parent data
      const parentResults = results.filter(r => {
        const rScanId = (r.scanId?._id || r.scanId)?.toString();
        const parentId = (parentScan._id || parentScan.id)?.toString();
        return rScanId === parentId;
      });
      return parentResults.map(result => ({
        link: result.title || result.url,
        url: result.url || result.link || result.originalUrl,
        sentimentBefore: result.sentiment || '–',
        rankBefore: result.position || result.rank || '–',
        sentimentAfter: '–',
        rankAfter: '–',
        movement: 'Baseline'
      }));
    }

    // Get results for parent (before) and latest scan (after)
    const parentResults = results.filter(r => {
      const rScanId = (r.scanId?._id || r.scanId)?.toString();
      const parentId = (parentScan._id || parentScan.id)?.toString();
      return rScanId === parentId;
    });
    
    const latestResults = results.filter(r => {
      const rScanId = (r.scanId?._id || r.scanId)?.toString();
      const latestId = (latestScan._id || latestScan.id)?.toString();
      return rScanId === latestId;
    });

    // Normalize URLs for comparison (remove protocol, www, trailing slashes)
    const normalizeUrl = (url) => {
      if (!url) return '';
      try {
        let normalized = url.toLowerCase().trim();
        normalized = normalized.replace(/^https?:\/\//, '');
        normalized = normalized.replace(/^www\./, '');
        normalized = normalized.replace(/\/$/, '');
        return normalized;
      } catch (e) {
        return url.toLowerCase().trim();
      }
    };

    // Create maps for quick lookup using normalized URLs
    const parentMap = new Map();
    parentResults.forEach(r => {
      const url = r.url || r.link || r.originalUrl || '';
      const key = normalizeUrl(url);
      if (key) parentMap.set(key, r);
    });

    const latestMap = new Map();
    latestResults.forEach(r => {
      const url = r.url || r.link || r.originalUrl || '';
      const key = normalizeUrl(url);
      if (key) latestMap.set(key, r);
    });

    // Build comparison rows
    const comparisonData = [];
    const allUrls = new Set();
    parentResults.forEach(r => {
      const url = r.url || r.link || r.originalUrl;
      if (url) allUrls.add(normalizeUrl(url));
    });
    latestResults.forEach(r => {
      const url = r.url || r.link || r.originalUrl;
      if (url) allUrls.add(normalizeUrl(url));
    });

    allUrls.forEach(urlKey => {
      const parentResult = parentMap.get(urlKey);
      const latestResult = latestMap.get(urlKey);

      if (!parentResult && !latestResult) return;

      // Determine movement
      let movement = '–';
      let movementText = '–';
      
      if (!parentResult && latestResult) {
        movement = 'new';
        movementText = latestResult.sentiment === 'positive' 
          ? '⬆️ New Positive' 
          : latestResult.sentiment === 'negative' 
            ? '⬆️ New Negative' 
            : '⬆️ New';
      } else if (parentResult && !latestResult) {
        movement = 'disappeared';
        movementText = '✗ Disappeared';
      } else if (parentResult && latestResult) {
        const beforeRank = parentResult.position || parentResult.rank || 999;
        const afterRank = latestResult.position || latestResult.rank || 999;
        const rankChange = beforeRank - afterRank;
        
        if (rankChange > 0) {
          movement = 'improved';
          const change = Math.abs(rankChange);
          if (afterRank === 1 && latestResult.sentiment === 'positive') {
            movementText = `⬆️ ${change} (positive #1 secured)`;
          } else {
            movementText = `⬆️ ${change}`;
          }
        } else if (rankChange < 0) {
          movement = 'dropped';
          movementText = `⬇️ ${Math.abs(rankChange)}`;
        } else {
          movement = 'unchanged';
          movementText = '–';
        }
      }

      comparisonData.push({
        link: latestResult?.title || parentResult?.title || urlKey,
        url: latestResult?.url || latestResult?.link || latestResult?.originalUrl || parentResult?.url || parentResult?.link || parentResult?.originalUrl || urlKey,
        sentimentBefore: parentResult?.sentiment || '–',
        rankBefore: parentResult?.position || parentResult?.rank || '–',
        sentimentAfter: latestResult?.sentiment || '–',
        rankAfter: latestResult?.position || latestResult?.rank || '–',
        movement,
        movementText
      });
    });

    // Sort by rank after (or before if no after rank)
    return comparisonData.sort((a, b) => {
      const rankA = a.rankAfter === '–' ? (a.rankBefore === '–' ? 999 : Number(a.rankBefore) || 999) : Number(a.rankAfter) || 999;
      const rankB = b.rankAfter === '–' ? (b.rankBefore === '–' ? 999 : Number(b.rankBefore) || 999) : Number(b.rankAfter) || 999;
      return rankA - rankB;
    });
  };

  // Filter and sort results
  const getFilteredResults = () => {
    let filtered = results;
    
    // Filter by sentiment only (no week filter for single scan)
    if (filterBy !== 'all') {
      filtered = filtered.filter(r => r.sentiment === filterBy);
    }
    
    return filtered;
  };

  const sortResults = (results, sortBy) => {
    return [...results].sort((a, b) => {
      switch (sortBy) {
        case 'position':
          return (a.rank || a.position || 0) - (b.rank || b.position || 0);
        case 'sentiment':
          const sentimentOrder = { positive: 1, neutral: 2, negative: 3 };
          return (sentimentOrder[a.sentiment] || 4) - (sentimentOrder[b.sentiment] || 4);
        case 'confidence':
          return (b.confidence || 0) - (a.confidence || 0);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'week':
          return (b.weekNumber || 0) - (a.weekNumber || 0);
        default:
          return 0;
      }
    });
  };

  const paginateResults = (results, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    return results.slice(startIndex, startIndex + perPage);
  };

  const filteredResults = getFilteredResults();
  const sortedResults = sortResults(filteredResults, sortBy);
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
      <div className="min-h-screen" style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/scans')}
              className="flex items-center text-gray-300 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Scans
            </button>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {scan?.clientId?.name || scan?.clientName || 'Scan Results'}
                </h1>
                <p className="text-gray-300">
                  Scan Details - Week {scan?.weekNumber || 1}
                </p>
                {scan?.searchQuery && (
                  <p className="text-sm text-blue-400 mt-1">🔍 Search Query: "{scan.searchQuery}"</p>
                )}
                {scan?.region && (
                  <p className="text-sm text-gray-400 mt-1">🌍 Region: {scan.region}</p>
                )}
                {scan?.status && (
                  <p className="text-sm text-gray-400 mt-1">
                    Status: <span className="capitalize">{scan.status}</span>
                    {scan?.completedAt && (
                      <span className="ml-2">• Completed: {new Date(scan.completedAt).toLocaleDateString()}</span>
                    )}
                  </p>
                )}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center space-x-2 border border-blue-500 text-blue-400 bg-transparent px-4 py-2 rounded-full hover:bg-blue-500 hover:text-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Report</span>
                </button>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          {(() => {
            const comparisonData = buildComparisonData();
            if (comparisonData.length === 0) return null;
            
            return (
              <div className="rounded-xl shadow-lg overflow-hidden mb-6 border border-gray-700" style={{background: 'linear-gradient(to bottom, #04041B 66%, #3b1586 100%)'}}>
                <div className="p-6 border-b border-gray-600">
                  <h2 className="text-xl font-bold text-white">
                    {scan?.clientId?.name || scan?.clientName || 'Client'} | Link Ranking Movement (Before vs After)
                  </h2>
                  <p className="text-sm text-gray-300 mt-1">
                    Comparing {scans.find(s => !s.parentId)?.weekNumber ? `Week ${scans.find(s => !s.parentId)?.weekNumber}` : 'Parent'} with Latest Scan
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-600">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Link</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Sentiment Before</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Rank Before</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Sentiment After</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Rank After</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">Movement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-600">
                      {comparisonData.map((row, index) => {
                        const getSentimentColor = (sentiment) => {
                          if (sentiment === '–' || !sentiment) return 'text-gray-400';
                          switch (sentiment.toLowerCase()) {
                            case 'positive': return 'text-green-400';
                            case 'negative': return 'text-red-400';
                            case 'neutral': return 'text-yellow-400';
                            default: return 'text-gray-400';
                          }
                        };

                        const getSentimentText = (sentiment) => {
                          if (sentiment === '–' || !sentiment) return '–';
                          return sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
                        };

                        return (
                          <motion.tr
                            key={index}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.02 }}
                            className="hover:bg-gray-800/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <a
                                href={row.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline"
                              >
                                {row.link || row.url || 'N/A'}
                              </a>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={getSentimentColor(row.sentimentBefore)}>
                                {getSentimentText(row.sentimentBefore)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                              {row.rankBefore}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={getSentimentColor(row.sentimentAfter)}>
                                {getSentimentText(row.sentimentAfter)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                              {row.rankAfter}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={
                                row.movement === 'improved' || row.movement === 'new' 
                                  ? 'text-green-400' 
                                  : row.movement === 'dropped' 
                                  ? 'text-red-400' 
                                  : row.movement === 'disappeared'
                                  ? 'text-orange-400'
                                  : 'text-gray-400'
                              }>
                                {row.movementText || '–'}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Filters */}
          <div className="rounded-lg p-4 border border-gray-700 mb-6" style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Week</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 text-white"
                  disabled
                >
                  <option value="all">All Results</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Sentiment</label>
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 text-white"
                >
                  <option value="all">All Sentiments</option>
                  <option value="positive">Positive</option>
                  <option value="negative">Negative</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 text-white"
                >
                  <option value="position">Position</option>
                  <option value="sentiment">Sentiment</option>
                  <option value="confidence">Confidence</option>
                  <option value="title">Title</option>
                  <option value="week">Week</option>
                </select>
              </div>
            </div>
          </div>

          {/* Scan Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg p-6 shadow-sm border border-gray-700"
              style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
            >
              <div className="flex items-center">
                <div className="p-2 bg-gray-800 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Total Results</p>
                  <p className="text-2xl font-bold text-white">{results.length}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-lg p-6 shadow-sm border border-gray-700"
              style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
            >
              <div className="flex items-center">
                <div className="p-2 bg-gray-800 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Positive</p>
                  <p className="text-2xl font-bold text-green-400">
                    {results.filter(r => r.sentiment === 'positive').length}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-lg p-6 shadow-sm border border-gray-700"
              style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
            >
              <div className="flex items-center">
                <div className="p-2 bg-gray-800 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Negative</p>
                  <p className="text-2xl font-bold text-red-400">
                    {results.filter(r => r.sentiment === 'negative').length}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-lg p-6 shadow-sm border border-gray-700"
              style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
            >
              <div className="flex items-center">
                <div className="p-2 bg-gray-800 rounded-lg">
                  <Clock className="w-6 h-6 text-gray-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Neutral</p>
                  <p className="text-2xl font-bold text-gray-400">
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
            className="rounded-lg shadow-sm border border-gray-700 mb-8"
            style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
          >
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-medium text-white">Ranking Trends</h3>
              <p className="text-sm text-gray-300">Position changes from previous scan</p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {results.filter(r => r.rankingChange > 0).length}
                  </div>
                  <div className="text-sm text-gray-300">Moved Up</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {results.filter(r => r.rankingChange < 0).length}
                  </div>
                  <div className="text-sm text-gray-300">Moved Down</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-400">
                    {results.filter(r => r.rankingChange === 0).length}
                  </div>
                  <div className="text-sm text-gray-300">Same Position</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {results.filter(r => !r.rankingChange && r.rankingChange !== 0).length}
                  </div>
                  <div className="text-sm text-gray-300">New Results</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Results Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-lg shadow-sm border border-gray-700"
            style={{background: 'linear-gradient(to bottom, #04041B 70%, #6C24E5 100%)'}}
          >
            <div className="px-6 py-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Scan Results</h3>
                <div className="flex items-center space-x-4">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border border-gray-600 rounded-lg text-sm bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="position">Sort by Position</option>
                    <option value="sentiment">Sort by Sentiment</option>
                    <option value="confidence">Sort by Confidence</option>
                    <option value="title">Sort by Title</option>
                  </select>
                  
                  <select
                    value={resultsPerPage}
                    onChange={(e) => setResultsPerPage(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-600 rounded-lg text-sm bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <thead style={{backgroundColor: '#04041B'}}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Change
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Sentiment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200" style={{backgroundColor: '#04041B'}}>
                  {paginatedResults.map((result, index) => (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-700"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        #{result.rank || index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRankingChange(result)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white max-w-md truncate">
                              {result.title}
                            </div>
                            <div className="text-sm text-blue-400 max-w-md truncate">
                              {result.url || result.link}
                            </div>
                          </div>
                          {result.weekNumber && (
                            <span className="px-2 py-1 bg-blue-900 text-blue-200 text-xs font-medium rounded-full">
                              Week {result.weekNumber}
                            </span>
                          )}
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
                        <button className="border border-purple-500 text-purple-400 bg-transparent hover:bg-purple-500 hover:text-white px-3 py-1 rounded-full text-xs font-medium transition-colors">
                          View Details
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-300">
                    Showing {((currentPage - 1) * resultsPerPage) + 1} to {Math.min(currentPage * resultsPerPage, sortedResults.length)} of {sortedResults.length} results
                    {selectedWeek !== 'all' && ` (Week ${selectedWeek})`}
                    {filterBy !== 'all' && ` (${filterBy} sentiment)`}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm border border-gray-600 rounded-lg bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm border border-gray-600 rounded-lg bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
