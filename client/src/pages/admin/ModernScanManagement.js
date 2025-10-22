import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Eye,
  RefreshCw,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Globe,
  Download,
  Activity,
  Zap,
  Users,
  Edit,
  Trash2,
  Send,
  Clock,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ModernScanManagement = () => {
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [scansPerPage] = useState(10);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggerData, setTriggerData] = useState({
    clientId: '',
    keywords: [],
    region: 'US',
  });
  const [triggering, setTriggering] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    fetchScans();
    fetchClients();
  }, []);

  const fetchScans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/scans');
      console.log('📊 Raw scans response:', response.data);
      
      // Show all scans from database - no filtering
      const savedScans = response.data;
      
      // Debug: Log sample scan data to verify client details
      if (savedScans.length > 0) {
        console.log('📊 Sample scan data:', {
          scanId: savedScans[0]._id,
          clientName: savedScans[0].clientId?.name,
          clientEmail: savedScans[0].clientId?.contact?.email,
          clientIdEmail: savedScans[0].clientId?.email,
          clientNameFallback: savedScans[0].clientName,
          status: savedScans[0].status,
          resultsCount: savedScans[0].resultsCount,
          completedAt: savedScans[0].completedAt,
          fullClientId: savedScans[0].clientId
        });
      }
      
      setScans(savedScans);
      console.log('📊 Loaded saved scans:', savedScans.length);
    } catch (error) {
      toast.error('Failed to load scans');
      console.error('Scans error:', error);
    } finally {
      setLoading(false);
    }
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
        case 'client':
          return (a.clientId?.name || a.clientName || '').localeCompare(b.clientId?.name || b.clientName || '');
        case 'status':
          const statusOrder = { completed: 1, running: 2, failed: 3 };
          return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
        default:
          return 0;
      }
    });
  };

  const filterScans = (scans, searchTerm, filterClient, filterStatus, filterRegion) => {
    return scans.filter(scan => {
      const matchesSearch = !searchTerm || 
        (scan.clientId?.name || scan.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        scan.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        scan.scanType?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesClient = filterClient === 'all' || 
        (scan.clientId?._id || scan.clientId) === filterClient;
      
      const matchesStatus = filterStatus === 'all' || scan.status === filterStatus;
      const matchesRegion = filterRegion === 'all' || scan.region === filterRegion;
      
      return matchesSearch && matchesClient && matchesStatus && matchesRegion;
    });
  };

  const paginateScans = (scans, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    return scans.slice(startIndex, startIndex + perPage);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteScan = async (scanId) => {
    if (!window.confirm('Are you sure you want to delete this scan? This action cannot be undone.')) return;
    
    try {
      console.log('🗑️ Deleting scan:', scanId);
      const response = await api.delete(`/scans/${scanId}`);
      console.log('✅ Delete response:', response.data);
      
      toast.success(`Scan deleted successfully (${response.data.deletedResultsCount} results removed)`);
      await fetchScans(); // Refresh the scan list
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

  const handleEditScan = (scan) => {
    // For now, just show a message. In a real app, you'd open an edit modal or navigate to edit page
    toast('Edit functionality coming soon!');
  };

  const handleSendToClient = async (scan) => {
    if (scan.clientStatus === 'sent' || scan.clientStatus === 'viewed') {
      toast.error('This scan has already been sent to the client');
      return;
    }

    if (scan.status !== 'completed') {
      toast.error('Only completed scans can be sent to clients');
      return;
    }

    if (!scan.resultsCount || scan.resultsCount === 0) {
      toast.error('No results to send to client');
      return;
    }

    try {
      console.log('📤 Sending scan to client:', scan._id);
      
      const response = await api.post('/scans/send-to-client', {
        scanId: scan._id,
        query: scan.query || 'Scan Results',
        results: [], // We don't need to send the actual results, just update the status
        clientData: {
          name: scan.clientId?.name || scan.clientName || 'Unknown Client',
          clientId: scan.clientId?._id || scan.clientId,
          industry: scan.clientId?.settings?.industry || 'Business',
          businessType: scan.clientId?.settings?.businessType || 'Business',
          targetAudience: scan.clientId?.settings?.targetAudience || 'General',
          region: scan.region || 'US',
          website: scan.clientId?.settings?.website || '',
          description: scan.clientId?.settings?.description || 'Business client'
        }
      });

      console.log('✅ Scan sent to client successfully:', response.data);
      toast.success(`Scan sent to ${scan.clientId?.name || scan.clientName} successfully`);
      
      // Refresh the scan list to update the status
      fetchScans();
      
    } catch (error) {
      console.error('❌ Error sending scan to client:', error);
      toast.error('Failed to send scan to client');
    }
  };

  const handleToggleAutoScan = async (scan) => {
    try {
      const scanId = scan.id || scan._id;
      
      if (scan.autoScanEnabled) {
        // Disable auto-scan
        await api.post(`/scans/${scanId}/disable-auto-scan`);
        toast.success('Weekly auto-scan disabled');
      } else {
        // Enable auto-scan
        await api.post(`/scans/${scanId}/enable-auto-scan`, {
          keywords: ['scan'], // Default keywords
          region: scan.region
        });
        toast.success('Weekly auto-scan enabled');
      }
      
      // Refresh the scan list to update the auto-scan status
      fetchScans();
      
    } catch (error) {
      console.error('❌ Error toggling auto-scan:', error);
      toast.error('Failed to toggle auto-scan');
    }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      toast.error('Failed to load clients');
      console.error('Clients error:', error);
    }
  };

  const triggerScan = async () => {
    if (!triggerData.clientId) {
      toast.error('Please select a client');
      return;
    }

    if (!triggerData.keywords || triggerData.keywords.length === 0) {
      toast.error('Please add at least one keyword');
      return;
    }

    setTriggering(true);
    setCurrentStep(1);
    
    try {
      // Step 1: Create real scan in database first
      toast.loading('Step 1: Creating scan record...', { id: 'scan-progress' });
      
      const selectedClient = clients.find(c => c._id === triggerData.clientId);
      const combinedKeywords = triggerData.keywords.join(' ');
      // const enhancedQuery = clientName ? `${clientName} ${combinedKeywords}` : combinedKeywords;
      
      console.log('=== CREATING REAL SCAN IN DATABASE ===');
      console.log('Client:', selectedClient?.name, 'Keywords:', combinedKeywords);
      
      // Create real scan record in database
      const scanResponse = await api.post('/scans', {
        clientId: triggerData.clientId,
        clientName: selectedClient?.name,
        keywords: triggerData.keywords,
        region: triggerData.region,
        scanType: 'manual',
        resultsCount: 0,
        status: 'running',
        clientStatus: 'not_sent' // Client won't see until admin sends
      });

      if (!scanResponse.data.success) {
        throw new Error('Failed to create scan record');
      }

      console.log('✅ Created real scan:', scanResponse.data.scan._id);
      
      // Step 2: Perform Google search
      toast.loading('Step 2: Fetching search results...', { id: 'scan-progress' });
      setCurrentStep(2);
      
      // Combine client name with keywords for more targeted search
      const clientName = selectedClient?.name || '';
      const keywordsString = triggerData.keywords.join(' ');
      const combinedQuery = clientName ? `${clientName} ${keywordsString}` : keywordsString;
      
      const searchResponse = await api.post('/orm-scan/test/google-search', {
        query: combinedQuery, // Combine client name with keywords
        region: triggerData.region,
        resultsCount: 5
      });

      if (!searchResponse.data.success) {
        throw new Error('Search failed');
      }

      const searchResults = searchResponse.data.results || [];
      
      // Step 3: Perform sentiment analysis
      toast.loading('Step 3: Analyzing sentiment...', { id: 'scan-progress' });
      setCurrentStep(3);
      
      const sentimentResponse = await api.post('/orm-scan/test/sentiment-analysis', {
        links: searchResults,
        clientData: {
          name: selectedClient?.name,
          clientId: selectedClient?._id,
          email: selectedClient?.contact?.email || '',
          industry: selectedClient?.settings?.industry || 'Business',
          businessType: selectedClient?.settings?.businessType || 'Business',
          targetAudience: selectedClient?.settings?.targetAudience || 'General',
          region: triggerData.region,
          website: selectedClient?.settings?.website || '',
          description: selectedClient?.settings?.description || 'Business client'
        }
      });

      if (!sentimentResponse.data.success) {
        throw new Error('Sentiment analysis failed');
      }

      // Step 4: Save results to database
      toast.loading('Step 4: Saving results...', { id: 'scan-progress' });
      
      const resultsResponse = await api.post(`/scans/${scanResponse.data.scan._id}/results`, {
        scanId: scanResponse.data.scan._id,
        results: sentimentResponse.data.results,
        clientData: {
          name: selectedClient?.name,
          clientId: selectedClient?._id,
          email: selectedClient?.contact?.email || '',
          industry: selectedClient?.settings?.industry || 'Business',
          businessType: selectedClient?.settings?.businessType || 'Business',
          targetAudience: selectedClient?.settings?.targetAudience || 'General',
          region: triggerData.region,
          website: selectedClient?.settings?.website || '',
          description: selectedClient?.settings?.description || 'Business client'
        }
      });

      if (!resultsResponse.data.success) {
        throw new Error('Failed to save scan results');
      }
      
      // Navigate to the real scan results page
      navigate(`/admin/scans/${scanResponse.data.scan._id}`);
      
      toast.success('Scan completed successfully!', { id: 'scan-progress' });
      await fetchScans();
    } catch (error) {
      console.error('Scan error:', error);
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        toast.error('Scan timed out. The process is taking longer than expected. Please try again with fewer keywords or check your internet connection.', { id: 'scan-progress' });
      } else if (error.response?.status === 500) {
        toast.error('Server error during scan. Please try again.', { id: 'scan-progress' });
      } else {
        toast.error(`Scan failed: ${error.message}`, { id: 'scan-progress' });
      }
    } finally {
      setTriggering(false);
      setCurrentStep(0);
    }
  };

  // Apply filtering, sorting, and pagination
  const sortedScans = sortScans(scans, sortBy);
  const filteredScans = filterScans(sortedScans, searchTerm, filterClient, filterStatus, filterRegion);
  const paginatedScans = paginateScans(filteredScans, currentPage, scansPerPage);
  const totalPages = Math.ceil(filteredScans.length / scansPerPage);

  const statuses = [
    { value: 'all', label: 'All Status' },
    { value: 'completed', label: 'Completed' },
    { value: 'running', label: 'Running' },
    { value: 'failed', label: 'Failed' },
    { value: 'scheduled', label: 'Scheduled' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Scans</h1>
          <p className="text-gray-600 mt-2">View and manage all scans in the database with comprehensive filtering and pagination</p>
        </div>
        <div className="mt-4 lg:mt-0 flex space-x-3">
          <button
            onClick={() => setShowTriggerModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Zap className="h-4 w-4 mr-2" />
            Trigger Scan
          </button>
          <button
            onClick={fetchScans}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Scans</p>
              <p className="text-3xl font-bold text-gray-900">{scans.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-green-600">
                {scans.filter(s => s.status === 'completed').length}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Running</p>
              <p className="text-3xl font-bold text-blue-600">
                {scans.filter(s => s.status === 'running').length}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-3xl font-bold text-red-600">
                {scans.filter(s => s.status === 'failed').length}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search scans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="all">All Clients</option>
            {clients.map((client) => (
              <option key={client._id} value={client._id}>
                {client.name}
              </option>
            ))}
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="all">All Regions</option>
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="latest">Latest First</option>
            <option value="oldest">Oldest First</option>
            <option value="results">Most Results</option>
            <option value="client">By Client</option>
            <option value="status">By Status</option>
          </select>
        </div>
      </div>

      {/* Scans Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Scans</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Week
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Region
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Results
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedScans.map((scan, index) => (
                <motion.tr
                  key={scan._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    #{((currentPage - 1) * scansPerPage) + index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {scan.clientId?.name || scan.clientName || 'Unknown Client'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {scan.clientId?.contact?.email || scan.clientId?.email || 'No email'}
                        </div>
                        <div className="text-xs text-gray-400">
                          ID: {scan.clientId?._id || scan.clientId || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">Week {scan.weekNumber}</div>
                      <div className="text-xs text-gray-500">
                        {scan.completedAt ? new Date(scan.completedAt).toLocaleDateString() : 
                         scan.startedAt ? new Date(scan.startedAt).toLocaleDateString() : 'Unknown'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Globe className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{scan.region}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      scan.scanType === 'automated' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {scan.scanType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      scan.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : scan.status === 'running'
                          ? 'bg-blue-100 text-blue-800'
                          : scan.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {scan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      scan.clientStatus === 'viewed' 
                        ? 'bg-green-100 text-green-800' 
                        : scan.clientStatus === 'sent'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}>
                      {scan.clientStatus === 'not_sent' ? 'Not Sent' : 
                       scan.clientStatus === 'sent' ? 'Sent to Client' : 
                       scan.clientStatus === 'viewed' ? 'Viewed by Client' : 
                       'Unknown'}
                    </span>
                    {scan.sentToClientAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        Sent: {new Date(scan.sentToClientAt).toLocaleDateString()}
                      </div>
                    )}
                    {scan.viewedByClientAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        Viewed: {new Date(scan.viewedByClientAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {scan.resultsCount || 0} results
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => navigate(`/admin/scans/${scan.id || scan._id}`)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Results"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleEditScan(scan)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit Scan"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleSendToClient(scan)}
                        disabled={scan.clientStatus === 'sent' || scan.clientStatus === 'viewed' || scan.status !== 'completed'}
                        className={`${
                          scan.clientStatus === 'sent' || scan.clientStatus === 'viewed' || scan.status !== 'completed'
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-green-600 hover:text-green-900'
                        }`}
                        title={
                          scan.clientStatus === 'sent' || scan.clientStatus === 'viewed' 
                            ? 'Already sent to client'
                            : scan.status !== 'completed'
                            ? 'Only completed scans can be sent'
                            : 'Send to Client'
                        }
                      >
                        <Send className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteScan(scan.id || scan._id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Scan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button className="text-blue-600 hover:text-blue-900">
                        <Download className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleToggleAutoScan(scan)}
                        className={`${
                          scan.autoScanEnabled 
                            ? 'text-orange-600 hover:text-orange-900' 
                            : 'text-purple-600 hover:text-purple-900'
                        }`}
                        title={
                          scan.autoScanEnabled 
                            ? 'Disable Weekly Auto-Scan' 
                            : 'Enable Weekly Auto-Scan'
                        }
                      >
                        {scan.autoScanEnabled ? (
                          <Clock className="h-4 w-4" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {paginatedScans.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Scans Found</h3>
                      <p className="text-gray-500 mb-4">
                        No scans have been created yet. Start by creating your first scan.
                      </p>
                      <p className="text-sm text-gray-400">
                        Use the "Content Leak Scanner" or "Trigger Scan" buttons above to create new scans.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Showing {((currentPage - 1) * scansPerPage) + 1} to {Math.min(currentPage * scansPerPage, filteredScans.length)} of {filteredScans.length} scans
              {filteredScans.length !== scans.length && ` (${scans.length} total in database)`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-1 text-sm rounded-lg ${
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
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trigger Scan Modal */}
      {showTriggerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Start New ORM Scan</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Client *
                </label>
                <select
                  value={triggerData.clientId}
                  onChange={(e) => setTriggerData({ ...triggerData, clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a client...</option>
                  {clients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.name} ({client.company})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords to Scan *
                </label>
                <input
                  type="text"
                  value={triggerData.keywords.join(', ')}
                  onChange={(e) => setTriggerData({ 
                    ...triggerData, 
                    keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="online reputation, brand management, digital marketing"
                />
                <p className="text-xs text-gray-500 mt-1">Separate keywords with commas</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Region
                </label>
                <select
                  value={triggerData.region}
                  onChange={(e) => setTriggerData({ ...triggerData, region: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="US">🇺🇸 United States</option>
                  <option value="UK">🇬🇧 United Kingdom</option>
                  <option value="CA">🇨🇦 Canada</option>
                  <option value="AU">🇦🇺 Australia</option>
                  <option value="DE">🇩🇪 Germany</option>
                  <option value="FR">🇫🇷 France</option>
                  <option value="ES">🇪🇸 Spain</option>
                  <option value="IT">🇮🇹 Italy</option>
                </select>
              </div>
            </div>
            
            {/* Progress Steps */}
            {triggering && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center space-x-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    1
                  </div>
                  <span className={`text-sm ${currentStep >= 1 ? 'text-blue-700' : 'text-gray-500'}`}>
                    Fetching URLs from Google Search
                  </span>
                </div>
                
                <div className="flex items-center space-x-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    2
                  </div>
                  <span className={`text-sm ${currentStep >= 2 ? 'text-blue-700' : 'text-gray-500'}`}>
                    Analyzing sentiment with OpenAI
                  </span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    3
                  </div>
                  <span className={`text-sm ${currentStep >= 3 ? 'text-blue-700' : 'text-gray-500'}`}>
                    Processing results
                  </span>
                </div>
              </div>
            )}
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowTriggerModal(false)}
                disabled={triggering}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={triggerScan}
                disabled={triggering || !triggerData.clientId || triggerData.keywords.length === 0}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {triggering ? (
                  <div className="flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Zap className="h-4 w-4 mr-2" />
                    Start Scan
                  </div>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ModernScanManagement;
