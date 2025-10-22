import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Download,
  FileText,
  BarChart3,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ClientReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterWeek, setFilterWeek] = useState('all');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      // Fetch sent scans instead of reports
      const response = await api.get('/scans/client');
      console.log('📊 Client scans for reports:', response.data);
      setReports(response.data);
    } catch (error) {
      toast.error('Failed to load reports');
      console.error('Reports error:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadScanData = async (scanId) => {
    try {
      // For now, just show a message since we don't have actual download endpoints for scans
      toast.success('Download functionality coming soon!');
    } catch (error) {
      toast.error('Failed to download scan data');
    }
  };



  const filteredReports = reports.filter((scan) => {
    const matchesSearch = scan.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         scan.region?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = filterRegion === 'all' || scan.region === filterRegion;
    const matchesWeek = filterWeek === 'all' || scan.weekNumber?.toString() === filterWeek;
    return matchesSearch && matchesRegion && matchesWeek;
  });

  const regions = [
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'UAE', name: 'UAE', flag: '🇦🇪' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ace-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Scans</h1>
            <p className="text-gray-600">View and download your ORM scan results</p>
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-ace-600 hover:bg-ace-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ace-500">
            <Download className="h-4 w-4 mr-2" />
            Download All
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white shadow-ace rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Reports</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-ace-500 focus:border-ace-500 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Region</label>
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ace-500 focus:border-ace-500 sm:text-sm"
              >
                <option value="all">All Regions</option>
                {regions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.flag} {region.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Week</label>
              <select
                value={filterWeek}
                onChange={(e) => setFilterWeek(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ace-500 focus:border-ace-500 sm:text-sm"
              >
                <option value="all">All Weeks</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((week) => (
                  <option key={week} value={week.toString()}>
                    Week {week}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((scan) => (
            <motion.div
              key={scan._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white shadow-ace rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-ace-100 rounded-lg flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-ace-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        Week {scan.weekNumber}
                      </h3>
                      <p className="text-sm text-gray-500">{scan.region}</p>
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    scan.clientStatus === 'viewed' 
                      ? 'bg-green-100 text-green-800' 
                      : scan.clientStatus === 'sent'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}>
                    {scan.clientStatus === 'not_sent' ? 'New' : 
                     scan.clientStatus === 'sent' ? 'Sent to You' : 
                     scan.clientStatus === 'viewed' ? 'Viewed' : 
                     'Unknown'}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Results</span>
                    <span className="text-sm font-medium text-gray-900">
                      {scan.resultsCount || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Scan Type</span>
                    <span className="text-sm font-medium text-blue-600">
                      {scan.scanType || 'Manual'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className={`text-sm font-medium ${
                      scan.status === 'completed' ? 'text-green-600' : 
                      scan.status === 'running' ? 'text-blue-600' : 
                      'text-red-600'
                    }`}>
                      {scan.status || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Completed</span>
                    <span className="text-sm font-medium text-gray-600">
                      {scan.completedAt ? new Date(scan.completedAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-4">
                  Sent: {scan.sentToClientAt ? new Date(scan.sentToClientAt).toLocaleDateString() : 'Not sent'}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => window.open(`/scans/${scan._id}`, '_blank')}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    View Scan
                  </button>
                  <button
                    onClick={() => downloadScanData(scan._id)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredReports.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No scans found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || filterRegion !== 'all' || filterWeek !== 'all'
                ? 'Try adjusting your filters to see more results.'
                : 'Scans will appear here once they are sent to you by your admin.'}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default ClientReports;


