import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Mail,
  Phone,
  Globe,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Zap,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  RefreshCw,
  Settings,
  UserPlus,
  Building,
  MapPin,
  Star,
  CheckSquare,
  Square,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ModernClientManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedClients, setSelectedClients] = useState([]);
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    console.log('🔄 Component mounted, fetching clients...');
    fetchClients();
  }, []);

  // Refresh when navigating to this page
  useEffect(() => {
    if (location.pathname === '/admin/clients') {
      console.log('🔄 Navigated to client management page, refreshing clients...');
      fetchClients();
    }
  }, [location.pathname]);

  // Refresh clients when component becomes visible or window gains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page became visible, refreshing clients...');
        fetchClients();
      }
    };

    const handleFocus = () => {
      console.log('🔄 Window gained focus, refreshing clients...');
      fetchClients();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching clients...');
      const response = await api.get('/clients');
      console.log('📊 Clients response:', response.data);
      console.log('📊 Number of clients:', response.data.length);
      setClients(response.data);
    } catch (error) {
      console.error('❌ Error fetching clients:', error);
      toast.error('Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClient = async () => {
    try {
      // Format the data for the backend (convert nested objects to JSON strings)
      const clientData = {
        name: selectedClient.name,
        subscription: JSON.stringify(selectedClient.subscription || {}),
        contact: JSON.stringify(selectedClient.contact || {}),
        settings: JSON.stringify(selectedClient.settings || {})
      };
      
      console.log('💾 Updating client with data:', clientData);
      
      const response = await api.put(`/clients/${selectedClient._id}`, clientData);
      setClients(clients.map(c => c._id === selectedClient._id ? response.data : c));
      setShowEditModal(false);
      setSelectedClient(null);
      toast.success('Client updated successfully');
    } catch (error) {
      console.error('❌ Error updating client:', error);
      toast.error('Failed to update client');
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await api.delete(`/clients/${clientId}`);
        setClients(clients.filter(c => c._id !== clientId));
        toast.success('Client deleted successfully');
      } catch (error) {
        console.error('Error deleting client:', error);
        toast.error('Failed to delete client');
      }
    }
  };

  const handleSelectClient = (clientId) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedClients([]);
      setIsSelectAll(false);
    } else {
      setSelectedClients(filteredClients.map(client => client._id));
      setIsSelectAll(true);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedClients.length === 0) {
      toast.error('Please select clients to delete');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedClients.length} client(s)? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      // Delete each selected client
      await Promise.all(selectedClients.map(async (clientId) => {
        try {
          await api.delete(`/clients/${clientId}`);
        } catch (error) {
          console.error(`Failed to delete client ${clientId}:`, error);
        }
      }));

      toast.success(`Successfully deleted ${selectedClients.length} client(s)`);
      setSelectedClients([]);
      setIsSelectAll(false);
      await fetchClients();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete some clients');
    } finally {
      setDeleting(false);
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.company.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    return matchesSearch && client.subscription?.status === filterStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{color: '#fafafa'}}>Client Management</h1>
          <p className="text-gray-400 mt-2">Manage your clients and their ORM campaigns</p>
        </div>
        <div className="flex flex-wrap gap-3 mt-4 sm:mt-0">
          {selectedClients.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-red-600 to-red-700  rounded-xl hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {deleting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {deleting ? 'Deleting...' : `Delete ${selectedClients.length} Selected`}
            </button>
          )}
          <button
            onClick={() => navigate('/admin/clients/create')}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600  rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Client
          </button>
          <button
            onClick={fetchClients}
            className="inline-flex items-center px-4 py-2 border border-gray-600 text-gray-300 bg-gray-800 rounded-xl hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl shadow-sm border border-gray-700 p-6" style={{backgroundColor: '#04041B'}}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-2 px-3 py-2 border border-gray-600 rounded-xl hover:bg-gray-700 transition-colors"
            >
              {isSelectAll ? (
                <CheckSquare className="h-4 w-4 text-blue-400" />
              ) : (
                <Square className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm text-gray-300">
                {isSelectAll ? 'Deselect All' : 'Select All'}
              </span>
            </button>
            {selectedClients.length > 0 && (
              <span className="text-sm text-blue-400">
                {selectedClients.length} selected
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800  placeholder-gray-400"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 "
              >
                <option value="all">All Clients</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="trial">Trial</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl shadow-sm border border-gray-700 p-6" style={{backgroundColor: '#04041B'}}>
          <div className="flex items-center">
            <div className="p-3 bg-blue-900 rounded-xl">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Total Clients</p>
              <p className="text-2xl font-bold" style={{color: '#fafafa'}}>{clients.length}</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-2xl shadow-sm border border-gray-700 p-6" style={{backgroundColor: '#04041B'}}>
          <div className="flex items-center">
            <div className="p-3 bg-green-900 rounded-xl">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Active</p>
              <p className="text-2xl font-bold" style={{color: '#fafafa'}}>
                {clients.filter(c => c.subscription?.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        
        
        <div className="rounded-2xl shadow-sm border border-gray-700 p-6" style={{backgroundColor: '#04041B'}}>
          <div className="flex items-center">
            <div className="p-3 bg-red-900 rounded-xl">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Inactive</p>
              <p className="text-2xl font-bold" style={{color: '#fafafa'}}>
                {clients.filter(c => c.subscription?.status === 'inactive').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clients List */}
      <div className="rounded-2xl shadow-sm border border-gray-700 overflow-hidden" style={{backgroundColor: '#04041B'}}>
        <div className="px-6 py-4 border-b border-gray-700" style={{backgroundColor: '#04041B'}}>
          <h3 className="text-lg font-semibold" style={{color: '#fafafa'}}>Clients ({filteredClients.length})</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{backgroundColor: '#04041B'}}>
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center justify-center"
                  >
                    {isSelectAll ? (
                      <CheckSquare className="h-4 w-4 text-blue-400" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{color: '#f3f4f6'}}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200" style={{backgroundColor: '#04041B'}}>
              {filteredClients.map((client) => (
                <motion.tr
                  key={client._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="hover:bg-gray-700 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleSelectClient(client._id)}
                      className="flex items-center justify-center"
                    >
                      {selectedClients.includes(client._id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-400" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400 hover:text-blue-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                          <span className="font-semibold text-sm" style={{color: '#ffffff'}}>
                            {client.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium" style={{color: '#fafafa'}}>{client.name}</div>
                        <div className="text-sm text-blue-400">{client.contact?.email || 'No email'}</div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm" style={{color: '#fafafa'}}>{client.contact?.email || 'No email'}</span>
                    </div>
                    {client.contact?.phone && (
                      <div className="flex items-center space-x-2 mt-1">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-400">{client.contact.phone}</span>
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm" style={{color: '#fafafa'}}>{client.contact?.company || 'No company'}</div>
                    <div className="text-sm text-gray-400">{client.settings?.industry || 'No industry'}</div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      client.subscription?.status === 'active' 
                        ? 'bg-green-900 text-green-200' 
                        : client.subscription?.status === 'trial'
                          ? 'bg-yellow-900 text-yellow-200'
                          : 'bg-red-900 text-red-200'
                    }`}>
                      {client.subscription?.status || 'inactive'}
                    </span>
                  </td>
                  
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{color: '#fafafa'}}>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedClient(client);
                          setShowEditModal(true);
                        }}
                        className="bg-purple-600 hover:bg-purple-700  px-3 py-1 rounded text-xs font-medium transition-colors"
                        title="Edit client"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClient(client._id)}
                        className="bg-red-600 hover:bg-red-700  px-3 py-1 rounded text-xs font-medium transition-colors"
                        title="Delete client"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Client Modal */}
      {showEditModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-transparent rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Edit Client</h3>
            
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="text-md font-semibold text-gray-200 mb-3">Basic Information</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={selectedClient.name || ''}
                      onChange={(e) => setSelectedClient({ ...selectedClient, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800  placeholder-gray-400"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h4 className="text-md font-semibold  mb-3">Contact Information</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={selectedClient.contact?.email || ''}
                      onChange={(e) => setSelectedClient({ 
                        ...selectedClient, 
                        contact: { ...selectedClient.contact, email: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800  placeholder-gray-400"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={selectedClient.contact?.phone || ''}
                      onChange={(e) => setSelectedClient({ 
                        ...selectedClient, 
                        contact: { ...selectedClient.contact, phone: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800  placeholder-gray-400"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company
                    </label>
                    <input
                      type="text"
                      value={selectedClient.contact?.company || ''}
                      onChange={(e) => setSelectedClient({ 
                        ...selectedClient, 
                        contact: { ...selectedClient.contact, company: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800  placeholder-gray-400"
                    />
                  </div>
                </div>
              </div>

              {/* Settings Information */}
              <div>
                <h4 className="text-md font-semibold  mb-3">Settings</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Industry
                    </label>
                    <input
                      type="text"
                      value={selectedClient.settings?.industry || ''}
                      onChange={(e) => setSelectedClient({ 
                        ...selectedClient, 
                        settings: { ...selectedClient.settings, industry: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800  placeholder-gray-400"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Target Audience
                    </label>
                    <input
                      type="text"
                      value={selectedClient.settings?.targetAudience || ''}
                      onChange={(e) => setSelectedClient({ 
                        ...selectedClient, 
                        settings: { ...selectedClient.settings, targetAudience: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800  placeholder-gray-400"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={selectedClient.settings?.website || ''}
                      onChange={(e) => setSelectedClient({ 
                        ...selectedClient, 
                        settings: { ...selectedClient.settings, website: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800  placeholder-gray-400"
                    />
                  </div>
                </div>
              </div>

              {/* Status Information */}
              <div>
                <h4 className="text-md font-semibold text-gray-200 mb-3">Status</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={selectedClient.subscription?.status || 'active'}
                      onChange={(e) => setSelectedClient({ 
                        ...selectedClient, 
                        subscription: { ...selectedClient.subscription, status: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800  placeholder-gray-400"
                    >
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditClient}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600  rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ModernClientManagement;
