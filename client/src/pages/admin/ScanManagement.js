import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Play,
  Search,
  Filter,
  Eye,
  RefreshCw,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Globe,
  Target,
  Trash2,
  Send,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ScanManagement = () => {
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggerData, setTriggerData] = useState({
    clientId: '',
    region: 'US',
  });

  useEffect(() => {
    fetchScans();
    fetchClients();
  }, []);

  const fetchScans = async () => {
    try {
      const response = await api.get('/scans');
      setScans(response.data);
    } catch (error) {
      toast.error('Failed to load scans');
      console.error('Scans error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (scanId) => {
    navigate(`/admin/scans/${scanId}`);
  };

  const handleDelete = async (scanId) => {
    const confirmed = window.confirm('Delete this scan and all related data (results, child scans, reports)?');
    if (!confirmed) return;
    try {
      await api.delete(`/scans/${scanId}`);
      toast.success('Scan deleted successfully');
      fetchScans();
    } catch (error) {
      toast.error('Failed to delete scan');
    }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Clients error:', error);
    }
  };

  const triggerScan = async (e) => {
    e.preventDefault();
    try {
      await api.post('/scans/trigger', triggerData);
      toast.success('Scan triggered successfully');
      setShowTriggerModal(false);
      setTriggerData({ clientId: '', region: 'US' });
      fetchScans();
    } catch (error) {
      toast.error('Failed to trigger scan');
    }
  };

  const handleSendToClient = async (scan) => {
    if (scan.clientStatus === 'sent') {
      toast.success('Already sent to client');
      return;
    }
    try {
      // Always send parent scan ID (this scan should already be a parent based on the !scan.parentId condition in the UI)
      await api.post('/scans/send-to-client', { scanId: scan._id });
      toast.success('Report sent to client (includes all weeks)');
      fetchScans(); // Refresh after sending
    } catch (error) {
      toast.error('Failed to send to client');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'text-yellow-200', bg: 'bg-yellow-900', icon: Clock },
      running: { color: 'text-blue-200', bg: 'bg-blue-900', icon: RefreshCw },
      completed: { color: 'text-green-200', bg: 'bg-green-900', icon: CheckCircle },
      failed: { color: 'text-red-200', bg: 'bg-red-900', icon: AlertCircle },
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getScanTypeBadge = (type) => {
    const typeConfig = {
      manual: { color: 'text-blue-200', bg: 'bg-blue-900' },
      scheduled: { color: 'text-green-200', bg: 'bg-green-900' },
      automated: { color: 'text-purple-800', bg: 'bg-purple-100' },
    };
    
    const config = typeConfig[type] || typeConfig.manual;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const filteredScans = scans.filter((scan) => {
    const matchesSearch = scan.clientId?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient = filterClient === 'all' || scan.clientId === filterClient;
    const matchesStatus = filterStatus === 'all' || scan.status === filterStatus;
    return matchesSearch && matchesClient && matchesStatus;
  });

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
          <h1 className="text-3xl font-bold" style={{color: '#fafafa'}}>Scan Management</h1>
          <p className="text-gray-400 mt-2">Monitor and manage ORM scanning activities</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-6 shadow-lg border border-gray-700 ar-card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Search Scans</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-600 bg-gray-800  rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Filter by Client</label>
              <select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="px-4 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 "
              >
                <option value="all">All Clients</option>
                {clients.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Filter by Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 "
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

      {/* Scans Table */}
      <div className="rounded-2xl shadow-lg border border-gray-700 overflow-hidden ar-card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                    Week
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                    Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                    Results
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                    Started
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700 bg-gray-900">
                {filteredScans.map((scan) => (
                  <motion.tr
                    key={scan._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-800"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium" style={{color: '#fafafa'}}>
                        {scan.clientId?.name || 'Unknown Client'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm" style={{color: '#f3f4f6'}}>Week {scan.weekNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Globe className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-sm" style={{color: '#f3f4f6'}}>{scan.region}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getScanTypeBadge(scan.scanType)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(scan.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm" style={{color: '#f3f4f6'}}>
                        {scan.resultsCount || 0} results
                      </div>
                      <div className="text-xs text-gray-400">
                        {scan.processedKeywords || 0}/{scan.totalKeywords || 0} keywords
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm" style={{color: '#f3f4f6'}}>
                        {scan.duration ? `${Math.round(scan.duration / 1000)}s` : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {new Date(scan.startedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleView(scan._id)}
                          className="p-2 rounded-full bg-blue-600 hover:bg-blue-700  transition-all duration-150 shadow focus:outline-none"
                          title="View Results"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(scan._id)}
                          className="p-2 rounded-full bg-red-600 hover:bg-red-700  transition-all duration-150 shadow focus:outline-none"
                          title="Delete Scan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {(!scan.parentId) && (
                          <button
                            onClick={() => handleSendToClient(scan)}
                            className={`p-2 rounded-full transition-all duration-150 shadow focus:outline-none ${scan.clientStatus === 'sent' ? 'bg-gray-400 text-gray-100 cursor-default opacity-60' : 'bg-green-600 hover:bg-green-700 text-gray-200'}`}
                            title={scan.clientStatus === 'sent' ? 'Already sent' : 'Send to Client'}
                            disabled={scan.clientStatus === 'sent'}
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

    </div>
  );
};

export default ScanManagement;



