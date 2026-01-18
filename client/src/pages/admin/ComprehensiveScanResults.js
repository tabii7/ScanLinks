import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  BarChart3, 
  AlertCircle, 
  ExternalLink, 
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Globe,
  CheckCircle,
  Clock,
  Calendar,
  Users,
  Target,
  Activity,
  Search,
  Eye,
  Send
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Countdown Timer Component
const ScheduleCountdown = ({ scan }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    // CRITICAL: Always calculate next scan date from scan's date (7 days from completion/start)
    // This works even if backend hasn't set autoScanEnabled or nextAutoScanDate
    const calculateNextScanDate = () => {
      // Use completedAt if available, otherwise startedAt
      const scanDate = scan.completedAt || scan.startedAt;
      if (!scanDate) return null;

      // 7 days from scan date
      const nextDate = new Date(new Date(scanDate).getTime() + 7 * 24 * 60 * 60 * 1000);
      return nextDate;
    };

    // Check if scan has a date
    const hasDate = scan.completedAt || scan.startedAt;
    
    if (!hasDate) {
      setTimeLeft(null);
      return;
    }

    // Get next scan date from scan.nextAutoScanDate or calculate it (always calculate if not set)
    const nextScanDate = scan.nextAutoScanDate 
      ? new Date(scan.nextAutoScanDate)
      : calculateNextScanDate();

    if (!nextScanDate) {
      setTimeLeft(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const diff = nextScanDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ expired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    // Update immediately
    updateCountdown();
    
    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [scan]);

  // Show "Not scheduled" only if scan has no date at all
  if (!timeLeft) {
    const hasDate = scan.completedAt || scan.startedAt;
    if (!hasDate) {
      return (
        <span className="text-gray-400 text-xs">Not scheduled</span>
      );
    }
    // If scan has a date but timer not ready yet (shouldn't happen, but fallback)
    return (
      <span className="text-green-400 text-xs font-medium flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Calculating...
      </span>
    );
  }

  if (timeLeft.expired) {
    return (
      <span className="text-yellow-400 text-xs font-medium flex items-center gap-1">
        <Clock className="w-3 h-3" />
        ⏰ Due now
      </span>
    );
  }

  const formatTime = () => {
    const parts = [];
    // Always show days if > 0
    if (timeLeft.days > 0) {
      parts.push(`${timeLeft.days} day${timeLeft.days !== 1 ? 's' : ''}`);
    }
    // Show hours if days < 7 or if no days
    if (timeLeft.days < 7 && timeLeft.hours > 0) {
      parts.push(`${timeLeft.hours} hour${timeLeft.hours !== 1 ? 's' : ''}`);
    }
    // Show minutes only if less than a day
    if (timeLeft.days === 0 && timeLeft.minutes > 0) {
      parts.push(`${timeLeft.minutes} minute${timeLeft.minutes !== 1 ? 's' : ''}`);
    }
    // Show seconds only if less than an hour
    if (timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.seconds > 0) {
      parts.push(`${timeLeft.seconds} second${timeLeft.seconds !== 1 ? 's' : ''}`);
    }
    
    // If no parts, show "0 seconds"
    if (parts.length === 0) {
      return '0 seconds';
    }
    
    return parts.join(' ');
  };

  return (
    <span className="text-blue-400 text-xs font-medium flex items-center gap-1">
      <Clock className="w-3 h-3" />
      {formatTime()} left
    </span>
  );
};

const ComprehensiveScanResults = () => {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [scans, setScans] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('position');
  const [filterBy, setFilterBy] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(20);
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterBy, sortBy]);

  const fetchClientData = useCallback(async () => {
    try {
      setLoading(true);
      
      // The clientId param is actually the parent scan ID
      // Fetch the parent scan first
      let parentScan = null;
      try {
        const scanResponse = await api.get(`/scans/${clientId}`);
        parentScan = scanResponse.data;
      } catch (scanError) {
        console.error('Error fetching parent scan:', scanError);
        toast.error('Scan not found');
        navigate('/admin/reports');
        return;
      }

      if (!parentScan) {
        toast.error('Scan not found');
        navigate('/admin/reports');
        return;
      }

      // Get the actual client ID from the parent scan
      const actualClientId = parentScan.clientId?._id || parentScan.clientId;
      
      // Fetch client details
      try {
        const clientResponse = await api.get(`/clients/${actualClientId}`);
        if (clientResponse.data) {
      setClient(clientResponse.data);
        } else {
          // Fallback: create client object from scan data
          setClient({
            _id: actualClientId,
            name: parentScan.clientName || 'Unknown Client',
            contact: { email: '' }
          });
        }
      } catch (clientError) {
        console.error('Error fetching client:', clientError);
        // Fallback: create client object from scan data
        setClient({
          _id: actualClientId,
          name: parentScan.clientName || 'Unknown Client',
          contact: { email: '' }
        });
      }
      
      // CRITICAL: Only fetch the parent scan and its children
      // Fetch all scans for the client, then filter to only this parent and its children
      const allScansResponse = await api.get(`/scans?clientId=${actualClientId}`);
      const allScans = allScansResponse.data || [];
      
      // Filter: parent scan (matches ID) + child scans (parentId matches parent scan ID)
      const parentScanId = parentScan._id;
      const relatedScans = allScans.filter(scan => {
        const scanId = scan._id;
        const scanParentId = scan.parentId;
        
        // Include: parent scan itself OR child scans of this parent
        return scanId === parentScanId || scanParentId === parentScanId;
      });
      
      // Ensure parent scan is included even if it wasn't in the filtered list
      const parentIncluded = relatedScans.find(s => s._id === parentScanId);
      if (!parentIncluded) {
        relatedScans.unshift(parentScan);
      }
      
      // Sort scans by week number
      const sortedScans = relatedScans.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
      setScans(sortedScans);
      
      // Fetch results for all scans
      const allResultsData = [];
      for (const scan of sortedScans) {
        try {
          const resultsResponse = await api.get(`/scans/${scan._id}/results`);
          const scanResults = (resultsResponse.data || []).map(result => ({
            ...result,
            weekNumber: scan.weekNumber,
            scanId: scan._id,
            scanDate: scan.completedAt || scan.startedAt
          }));
          allResultsData.push(...scanResults);
        } catch (error) {
          console.log(`No results found for scan ${scan._id}`);
        }
      }
      
      setAllResults(allResultsData);
      
    } catch (error) {
      console.error('Error fetching client data:', error);
      toast.error('Failed to load client data');
      navigate('/admin/reports');
    } finally {
      setLoading(false);
    }
  }, [clientId, navigate]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  // Calculate comprehensive statistics
  const calculateStats = () => {
    const totalResults = allResults.length;
    const sentimentStats = {
      positive: allResults.filter(r => r.sentiment === 'positive').length,
      negative: allResults.filter(r => r.sentiment === 'negative').length,
      neutral: allResults.filter(r => r.sentiment === 'neutral').length,
    };
    
    const movementStats = {
      new: allResults.filter(r => r.movement === 'new').length,
      improved: allResults.filter(r => r.movement === 'improved').length,
      dropped: allResults.filter(r => r.movement === 'dropped').length,
      unchanged: allResults.filter(r => r.movement === 'unchanged').length,
      disappeared: allResults.filter(r => r.movement === 'disappeared').length,
    };
    
    // Group scans by week number and take only the most recent scan for each week
    const weekGroups = {};
    scans.forEach(scan => {
      if (!weekGroups[scan.weekNumber]) {
        weekGroups[scan.weekNumber] = {
          weekNumber: scan.weekNumber,
          scan: scan
        };
      } else {
        // Keep the most recent scan (by completedAt or createdAt)
        const currentDate = new Date(scan.completedAt || scan.createdAt || scan.startedAt);
        const existingDate = new Date(weekGroups[scan.weekNumber].scan.completedAt || weekGroups[scan.weekNumber].scan.createdAt || weekGroups[scan.weekNumber].scan.startedAt);
        
        if (currentDate > existingDate) {
          weekGroups[scan.weekNumber].scan = scan;
        }
      }
    });
    
    // Calculate stats for each unique week using only the most recent scan
    const weekStats = Object.values(weekGroups).map(weekGroup => ({
      weekNumber: weekGroup.weekNumber,
      scanId: weekGroup.scan._id,
      totalResults: allResults.filter(r => r.weekNumber === weekGroup.weekNumber && r.scanId === weekGroup.scan._id).length,
      positive: allResults.filter(r => r.weekNumber === weekGroup.weekNumber && r.scanId === weekGroup.scan._id && r.sentiment === 'positive').length,
      negative: allResults.filter(r => r.weekNumber === weekGroup.weekNumber && r.scanId === weekGroup.scan._id && r.sentiment === 'negative').length,
      neutral: allResults.filter(r => r.weekNumber === weekGroup.weekNumber && r.scanId === weekGroup.scan._id && r.sentiment === 'neutral').length,
    }));
    
    return { totalResults, sentimentStats, movementStats, weekStats };
  };

  const stats = calculateStats();

  // Build comparison table data (Before vs After)
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
      const parentResults = allResults.filter(r => r.scanId === parentScan._id || r.scanId?.toString() === parentScan._id?.toString());
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
    const parentResults = allResults.filter(r => {
      const scanId = r.scanId?.toString() || r.scanId;
      const parentId = parentScan._id?.toString() || parentScan._id;
      return scanId === parentId;
    });
    
    const latestResults = allResults.filter(r => {
      const scanId = r.scanId?.toString() || r.scanId;
      const latestId = latestScan._id?.toString() || latestScan._id;
      return scanId === latestId;
    });

    // Normalize URLs for comparison (remove protocol, www, trailing slashes)
    const normalizeUrl = (url) => {
      if (!url) return '';
      try {
        let normalized = url.toLowerCase().trim();
        // Remove protocol
        normalized = normalized.replace(/^https?:\/\//, '');
        // Remove www.
        normalized = normalized.replace(/^www\./, '');
        // Remove trailing slash
        normalized = normalized.replace(/\/$/, '');
        return normalized;
      } catch (e) {
        return url.toLowerCase().trim();
      }
    };

    // Create a map for quick lookup using normalized URLs
    const parentMap = new Map();
    parentResults.forEach(r => {
      const url = r.url || r.link || r.originalUrl || '';
      const key = normalizeUrl(url);
      if (key) {
        parentMap.set(key, r);
      }
    });

    const latestMap = new Map();
    latestResults.forEach(r => {
      const url = r.url || r.link || r.originalUrl || '';
      const key = normalizeUrl(url);
      if (key) {
        latestMap.set(key, r);
      }
    });

    // Build comparison rows
    const comparisonData = [];
    
    // Process all unique URLs (from both scans) using normalized URLs
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
        // New entry
        movement = 'new';
        movementText = latestResult.sentiment === 'positive' 
          ? '⬆️ New Positive' 
          : latestResult.sentiment === 'negative' 
            ? '⬆️ New Negative' 
            : '⬆️ New';
      } else if (parentResult && !latestResult) {
        // Disappeared
        movement = 'disappeared';
        movementText = '✗ Disappeared';
      } else if (parentResult && latestResult) {
        const beforeRank = parentResult.position || parentResult.rank || 999;
        const afterRank = latestResult.position || latestResult.rank || 999;
        const rankChange = beforeRank - afterRank;
        
        if (rankChange > 0) {
          // Improved (moved up)
          movement = 'improved';
          const change = Math.abs(rankChange);
          if (afterRank === 1 && latestResult.sentiment === 'positive') {
            movementText = `⬆️ ${change} (positive #1 secured)`;
          } else {
            movementText = `⬆️ ${change}`;
          }
        } else if (rankChange < 0) {
          // Dropped (moved down)
          movement = 'dropped';
          movementText = `⬇️ ${Math.abs(rankChange)}`;
        } else {
          // Unchanged
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

    // Sort by rank after (or before if no after rank), handling string '–' values
    return comparisonData.sort((a, b) => {
      const rankA = a.rankAfter === '–' ? (a.rankBefore === '–' ? 999 : Number(a.rankBefore) || 999) : Number(a.rankAfter) || 999;
      const rankB = b.rankAfter === '–' ? (b.rankBefore === '–' ? 999 : Number(b.rankBefore) || 999) : Number(b.rankAfter) || 999;
      return rankA - rankB;
    });
  };

  // Get all results from all scans (parent + children) - simple list, no comparison
  const getFilteredResults = () => {
    // Just return all results from all scans, sorted
    let filtered = allResults.map(result => ({
      ...result,
      _id: result._id || result.url,
      title: result.title || result.link || result.url,
      link: result.link || result.title || result.url,
      position: result.position || result.rank || 999,
    }));
    
    // Sort results
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'position':
          return (a.position || 999) - (b.position || 999);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        default:
          return 0;
      }
    });
  };

  const filteredResults = getFilteredResults();
  const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const paginatedResults = filteredResults.slice(startIndex, startIndex + resultsPerPage);

  // Helper functions
  const getSentimentIcon = (sentiment) => {
    switch (sentiment) {
      case 'positive': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'negative': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'neutral': return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-900 text-green-200 border-green-200';
      case 'negative': return 'bg-red-900 text-red-200 border-red-200';
      case 'neutral': return 'bg-yellow-900 text-yellow-200 border-yellow-200';
      default: return 'bg-gray-700 text-gray-200 border-gray-200';
    }
  };

  const getMovementIcon = (movement) => {
    switch (movement) {
      case 'new': return <Plus className="w-4 h-4 text-blue-500" />;
      case 'improved': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'dropped': return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'unchanged': return <Minus className="w-4 h-4 text-gray-400" />;
      case 'disappeared': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'baseline': return <Minus className="w-4 h-4 text-purple-500" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getMovementColor = (movement) => {
    switch (movement) {
      // Make 'New Entry' clearly distinct from 'Week' tag (blue)
      case 'new': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'improved': return 'bg-green-900 text-green-200 border-green-200';
      case 'dropped': return 'bg-red-900 text-red-200 border-red-200';
      case 'unchanged': return 'bg-gray-700 text-gray-200 border-gray-200';
      case 'disappeared': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'baseline': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-700 text-gray-200 border-gray-200';
    }
  };

  const getMovementText = (movement, currentRank, previousRank) => {
    switch (movement) {
      case 'new': return 'New Entry';
      case 'improved': return `↑ Improved (was ${previousRank})`;
      case 'dropped': return `↓ Dropped (was ${previousRank})`;
      case 'unchanged': return `→ Same (${previousRank})`;
      case 'disappeared': return `✗ Disappeared (was ${previousRank})`;
      case 'baseline': return 'Baseline';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{backgroundColor: '#060b16'}}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading comprehensive scan results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen" style={{backgroundColor: '#060b16'}}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2" style={{color: '#fafafa'}}>Client Not Found</h2>
            <p className="text-gray-400 mb-4">The client you're looking for doesn't exist.</p>
            <button
              onClick={() => navigate('/admin/reports')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Reports
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{backgroundColor: '#060b16'}}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="rounded-xl shadow-lg p-6 mb-6 bg-gray-800 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin/reports')}
                className="flex items-center space-x-2 text-gray-300 hover: transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Reports</span>
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  const parentScan = scans.find(s => !s.parentId);
                  if (!parentScan) return toast.error('No parent scan found');
                  if (parentScan.clientStatus === 'sent') return toast.success('Already sent to client');
                  api.post('/scans/send-to-client', { scanId: parentScan._id })
                    .then(() => { toast.success('Report sent to client (includes all weeks)'); fetchClientData(); })
                    .catch(() => toast.error('Failed to send to client'));
                }}
                className={`inline-flex items-center px-4 py-2 rounded-md font-semibold transition-all duration-150 shadow focus:outline-none ${(() => {const p = scans.find(s => !s.parentId);return p?.clientStatus === 'sent' ? 'bg-gray-400 cursor-default opacity-60' : 'bg-green-600 hover:bg-green-700';})()}`}
                title="Send to Client"
                disabled={(() => {const p = scans.find(s => !s.parentId);return p?.clientStatus === 'sent';})()}
                style={{marginLeft: '1rem'}}
              >
                <Send className="h-5 w-5 mr-2" />
                {(() => {const p = scans.find(s => !s.parentId);return p?.clientStatus === 'sent' ? 'Sent to Client' : 'Send to Client';})()}
              </button>
              <div className="text-right">
                <div className="text-3xl font-bold" style={{color: '#fafafa'}}>{stats.totalResults}</div>
                <div className="text-sm text-gray-300">Total Results</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h1 className="text-2xl font-bold mb-2" style={{color: '#fafafa'}}>{client.name}</h1>
              {client.contact?.email && (
                <p className="text-sm text-gray-400">{client.contact.email}</p>
              )}
              <p className="text-gray-400">Comprehensive Scan Analysis</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-gray-300">
                  {scans.length} Week{scans.length !== 1 ? 's' : ''} of Data
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-300">
                  {scans.length > 0 ? `Week ${scans[0].weekNumber} - Week ${scans[scans.length - 1].weekNumber}` : 'No Data'}
                </span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold" style={{color: '#fafafa'}}>{scans.length}</div>
              <div className="text-sm text-gray-300">Total Scans</div>
            </div>
          </div>
        </div>

        {/* Scan Parameters Section */}
        <div className="rounded-xl shadow-lg p-6 mb-6 bg-gray-800 border border-gray-700">
          <h2 className="text-xl font-bold mb-4" style={{color: '#fafafa'}}>Scan Parameters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scans.map((scan, index) => {
              const keywords = scan.searchQuery ? scan.searchQuery.split(' ').filter(k => k.trim()) : [];
              return (
                <motion.div
                  key={scan._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="rounded-lg p-4 border border-gray-600 bg-gray-800"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold" style={{color: '#fafafa'}}>
                      {scan.parentId ? 'Child Scan' : 'Parent Scan'} - Week {scan.weekNumber}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      scan.scanType === 'manual' ? 'bg-blue-900 text-blue-200' :
                      scan.scanType === 'auto' ? 'bg-green-900 text-green-200' :
                      'bg-gray-900 text-gray-200'
                    }`}>
                      {scan.scanType || 'manual'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start">
                      <span className="text-gray-400 w-24 flex-shrink-0">Keywords:</span>
                      <div className="flex-1">
                        {keywords.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {keywords.map((kw, i) => (
                              <span key={i} className="px-2 py-1 bg-blue-900 text-blue-200 rounded text-xs">
                                {kw.trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">No keywords</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Search Query:</span>
                      <span className="flex-1 font-mono text-xs break-all" style={{color: '#fafafa'}}>
                        "{scan.searchQuery || 'N/A'}"
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Region:</span>
                      <span className="" style={{color: '#fafafa'}}>{scan.region || 'N/A'}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Week Number:</span>
                      <span className="" style={{color: '#fafafa'}}>{scan.weekNumber || 'N/A'}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Total Keywords:</span>
                      <span className="" style={{color: '#fafafa'}}>{scan.totalKeywords || keywords.length || 0}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Results:</span>
                      <span className="" style={{color: '#fafafa'}}>{scan.resultsCount || 0}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Started:</span>
                      <span className="text-xs" style={{color: '#fafafa'}}>
                        {scan.startedAt ? new Date(scan.startedAt).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Completed:</span>
                      <span className="text-xs" style={{color: '#fafafa'}}>
                        {scan.completedAt ? new Date(scan.completedAt).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Status:</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        scan.status === 'completed' ? 'bg-green-900 text-green-200' :
                        scan.status === 'running' ? 'bg-yellow-900 text-yellow-200' :
                        scan.status === 'failed' ? 'bg-red-900 text-red-200' :
                        'bg-gray-900 text-gray-200'
                      }`}>
                        {scan.status || 'unknown'}
                      </span>
                    </div>
                    
                    {/* Schedule Status */}
                    <div className="flex items-center">
                      <span className="text-gray-400 w-24 flex-shrink-0">Schedule:</span>
                      <div className="flex-1">
                        <ScheduleCountdown scan={scan} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Week Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.weekStats.map((week, index) => (
            <motion.div
              key={week.weekNumber}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="rounded-xl shadow-lg p-4 bg-gray-800 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold" style={{color: '#fafafa'}}>Week {week.weekNumber}</h3>
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total:</span>
                  <span className="font-medium" style={{color: '#fafafa'}}>{week.totalResults}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">Positive:</span>
                  <span className="text-green-400 font-medium">{week.positive}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-400">Negative:</span>
                  <span className="text-red-400 font-medium">{week.negative}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-400">Neutral:</span>
                  <span className="text-yellow-400 font-medium">{week.neutral}</span>
                </div>
              </div>
            </motion.div>
          ))}
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
                <p className="text-2xl font-bold text-green-400">{stats.sentimentStats.positive}</p>
                <p className="text-xs text-gray-300">
                  {stats.totalResults > 0 ? Math.round((stats.sentimentStats.positive / stats.totalResults) * 100) : 0}%
                </p>
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
                <p className="text-2xl font-bold text-red-400">{stats.sentimentStats.negative}</p>
                <p className="text-xs text-gray-300">
                  {stats.totalResults > 0 ? Math.round((stats.sentimentStats.negative / stats.totalResults) * 100) : 0}%
                </p>
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
                <p className="text-2xl font-bold text-yellow-400">{stats.sentimentStats.neutral}</p>
                <p className="text-xs text-gray-300">
                  {stats.totalResults > 0 ? Math.round((stats.sentimentStats.neutral / stats.totalResults) * 100) : 0}%
                </p>
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
                  {allResults.length > 0 ? Math.round(allResults.reduce((sum, r) => sum + (r.confidence || 0.5), 0) / allResults.length * 100) : 0}%
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>
        </div>

        {/* Movement Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl shadow-lg p-6 bg-gray-800 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">New Entries</p>
                <p className="text-2xl font-bold text-blue-400">{stats.movementStats.new}</p>
              </div>
              <Plus className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl shadow-lg p-6 bg-gray-800 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Improved</p>
                <p className="text-2xl font-bold text-green-400">{stats.movementStats.improved}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-xl shadow-lg p-6 bg-gray-800 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Dropped</p>
                <p className="text-2xl font-bold text-red-400">{stats.movementStats.dropped}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="rounded-xl shadow-lg p-6 bg-gray-800 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Unchanged</p>
                <p className="text-2xl font-bold text-gray-400">{stats.movementStats.unchanged}</p>
              </div>
              <Minus className="w-8 h-8 text-gray-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="rounded-xl shadow-lg p-6 bg-gray-800 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Disappeared</p>
                <p className="text-2xl font-bold text-orange-400">{stats.movementStats.disappeared}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-500" />
            </div>
          </motion.div>
        </div>

        {/* Comparison Table */}
        {(() => {
          const comparisonData = buildComparisonData();
          if (comparisonData.length === 0) return null;
          
          return (
            <div className="rounded-xl shadow-lg overflow-hidden mb-6 bg-gray-800 border border-gray-700">
              <div className="p-6 border-b border-gray-600">
                <h2 className="text-xl font-bold" style={{color: '#fafafa'}}>
                  {client?.name || 'Client'} | Link Ranking Movement (Before vs After)
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
                          className="hover:bg-gray-700 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <a
                              href={row.url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                              style={{color: '#fafafa'}}
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
        <div className="rounded-xl shadow-lg p-6 mb-6 bg-gray-800 border border-gray-700">
          <div className="mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full max-w-xs px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800"
                style={{color: '#fafafa'}}
              >
                <option value="position">Week 2 Position</option>
                <option value="title">Link Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="rounded-xl shadow-lg overflow-hidden bg-gray-800 border border-gray-700">
          <div className="p-6 border-b border-gray-600">
            <h2 className="text-xl font-bold" style={{color: '#fafafa'}}>
              {client?.name || 'Client'} | Scan Results ({filteredResults.length} total)
            </h2>
            <p className="text-sm text-gray-300 mt-1">
              Showing {startIndex + 1}-{Math.min(startIndex + resultsPerPage, filteredResults.length)} of {filteredResults.length} results
            </p>
          </div>

          <div className="divide-y divide-gray-600">
            {paginatedResults.map((result, index) => {
              const getSentimentIcon = (sentiment) => {
                switch (sentiment) {
                  case 'positive': return <CheckCircle className="w-6 h-6 text-green-500" />;
                  case 'negative': return <AlertCircle className="w-6 h-6 text-red-500" />;
                  case 'neutral': return <Minus className="w-6 h-6 text-yellow-500" />;
                  default: return <Minus className="w-6 h-6 text-gray-400" />;
                }
              };

              const getSentimentColor = (sentiment) => {
                switch (sentiment) {
                  case 'positive': return 'bg-green-900 text-green-200 border-green-700';
                  case 'negative': return 'bg-red-900 text-red-200 border-red-700';
                  case 'neutral': return 'bg-yellow-900 text-yellow-200 border-yellow-700';
                  default: return 'bg-gray-700 text-gray-400 border-gray-300';
                }
              };

              const getSentimentText = (result) => {
                const sentimentAnalyzed = result?.metadata?.sentimentAnalyzed !== false;
                const sentiment = result?.sentiment;
                if (!sentimentAnalyzed || sentiment === null || sentiment === undefined) {
                  return 'Sentiments Not Created';
                }
                return sentiment || 'neutral';
              };

              const isSentimentAnalyzed = (result) => {
                return result?.metadata?.sentimentAnalyzed !== false && 
                       result?.sentiment !== null && 
                       result?.sentiment !== undefined;
              };

              const sentiment = result.sentiment || result.sentimentAfter || result.sentimentBefore || 'neutral';

              return (
              <motion.div
                  key={result._id || result.url || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                  className="p-6 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                      {getSentimentIcon(sentiment)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2 line-clamp-2">
                            <a
                              href={result.url || result.link || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="transition-colors"
                              style={{color: '#fafafa'}}
                            >
                              {result.link || result.title || result.url}
                            </a>
                          </h3>
                        
                          {result.description && (
                        <p className="text-gray-300 mb-3 line-clamp-2">
                              {result.description}
                        </p>
                          )}
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-400">
                            <span>Position: {result.position || result.rankAfter || result.rankBefore || 'N/A'}</span>
                            {result.weekNumber && <span>Week: {result.weekNumber}</span>}
                            {result.domain && <span>Domain: {result.domain}</span>}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getSentimentColor(sentiment)}`}>
                            {getSentimentText(result)}
                        </span>
                          {isSentimentAnalyzed(result) && result.confidence !== null && result.confidence !== undefined && (
                            <span className="text-sm font-medium text-gray-300">
                              {Math.round(result.confidence * 100)}%
                        </span>
                          )}
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center space-x-4">
                      <a
                          href={result.url || result.link || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                          className="flex items-center space-x-1 transition-colors"
                          style={{color: '#fafafa'}}
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Visit Link</span>
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
              );
            })}
          </div>

          {filteredResults.length === 0 && (
            <div className="p-12 text-center">
              <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium  mb-2">No results found</h3>
              <p className="text-gray-400 mb-4">
                No scan results available for this client.
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-600 bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">
                  Showing {startIndex + 1}-{Math.min(startIndex + resultsPerPage, filteredResults.length)} of {filteredResults.length} results
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm border border-gray-600 rounded-lg bg-gray-800  hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm text-gray-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm border border-gray-600 rounded-lg bg-gray-800  hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveScanResults;
