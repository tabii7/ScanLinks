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
      const allScans = response.data || [];
      console.log('📊 Total scans received:', allScans.length);
      
      // Helper function to safely compare parentId
      const isParentChild = (parent, child) => {
        if (!child.parentId) return false;
        const parentId = parent._id || parent.id;
        const childParentId = child.parentId?._id || child.parentId;
        return parentId?.toString() === childParentId?.toString();
      };
      
      // Group scans by parent (exactly like admin ModernReportManagement.js)
      // Identify parent scans (parentId == null or parentId is undefined) that have been sent
      const allParents = allScans.filter(s => !s.parentId);
      const parents = allParents.filter(s => s.clientStatus === 'sent' || s.clientStatus === 'viewed');
      
      console.log('📊 Total parent scans found:', allParents.length);
      console.log('📊 Parent scans that are sent/viewed:', parents.length);
      console.log('📊 Parent scan IDs:', parents.map(p => ({ id: p._id, weekNumber: p.weekNumber, parentId: p.parentId, clientStatus: p.clientStatus })));
      console.log('📊 All scans with parentId:', allScans.filter(s => s.parentId).map(s => ({ id: s._id, weekNumber: s.weekNumber, parentId: s.parentId, clientStatus: s.clientStatus })));
      
      // Group each parent with its children (match admin logic exactly)
      const groupedReports = parents.map(parent => {
        // Find all children of this parent (same as admin: s.parentId === parent._id)
        // But handle both string and ObjectId comparisons
        const children = allScans.filter(s => {
          if (!s.parentId) return false;
          
          // Try direct comparison first (works if both are strings or both are ObjectIds)
          if (s.parentId === parent._id || s.parentId === parent.id) {
            return true;
          }
          
          // Try string comparison (handle ObjectId references)
          const parentIdStr = (parent._id || parent.id)?.toString();
          const childParentIdStr = (s.parentId?._id || s.parentId)?.toString();
          
          return parentIdStr && childParentIdStr && parentIdStr === childParentIdStr;
        });
        
        console.log(`📊 Parent ${parent._id} (Week ${parent.weekNumber}) has ${children.length} children:`, children.map(c => ({ id: c._id, weekNumber: c.weekNumber, parentId: c.parentId })));
        
        // Include parent and all children, sorted by week (same as admin)
        const allScansForReport = [parent, ...children].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
        
        // Aggregate data
        const totalLinks = allScansForReport.reduce((sum, s) => sum + (s.resultsCount || 0), 0);
        const totalWeeks = allScansForReport.length;
        const weekNumbers = allScansForReport.map(s => s.weekNumber || 1).sort((a, b) => a - b);
        
        // Calculate sentiment breakdown from results
        const allResults = allScansForReport.flatMap(s => s.results || []);
        const positiveLinks = allResults.filter(r => r.sentiment === 'positive').length;
        const negativeLinks = allResults.filter(r => r.sentiment === 'negative').length;
        const neutralLinks = allResults.filter(r => r.sentiment === 'neutral').length;
        
        console.log(`📊 Report for ${parent.clientName}: ${totalWeeks} weeks, ${totalLinks} links`);
        console.log(`   - Parent: Week ${parent.weekNumber}, Status: ${parent.status}`);
        console.log(`   - Children: ${children.length} child scans`);
        
        return {
          id: parent._id,
          parentScanId: parent._id,
          clientName: parent.clientName || (parent.clientId?.name) || 'Unknown Client',
          clientId: parent.clientId?._id || parent.clientId,
          region: parent.region || 'US',
          weekNumbers,
          totalWeeks,
          searchQuery: parent.searchQuery || 'No search query',
          status: parent.status || 'completed',
          scanType: parent.scanType || 'manual',
          resultsCount: totalLinks,
          createdAt: parent.startedAt || parent.createdAt,
          completedAt: parent.completedAt || children[children.length - 1]?.completedAt,
          sentToClientAt: parent.sentToClientAt,
          viewedByClientAt: parent.viewedByClientAt,
          clientStatus: parent.clientStatus || 'not_sent',
          summary: {
            totalLinks,
            positiveLinks,
            negativeLinks,
            neutralLinks,
            newLinks: allResults.filter(r => r.movement === 'new').length,
            improvedLinks: allResults.filter(r => r.movement === 'improved').length,
            droppedLinks: allResults.filter(r => r.movement === 'dropped').length,
          },
          allScans: allScansForReport // Store all scans for this report
        };
      });
      
      console.log('📊 Final grouped reports:', groupedReports.map(r => ({ 
        clientName: r.clientName, 
        totalWeeks: r.totalWeeks, 
        weekNumbers: r.weekNumbers,
        resultsCount: r.resultsCount
      })));
      setReports(groupedReports);
    } catch (error) {
      toast.error('Failed to load reports');
      console.error('Reports error:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadScanData = async (scanId, format = 'pdf') => {
    try {
      toast.loading(`Generating ${format.toUpperCase()} report...`, { id: 'download-report' });
      
      const endpoint = format === 'pdf' 
        ? `/reports/scan/${scanId}/download/pdf`
        : `/reports/scan/${scanId}/download/excel`;
      
      const response = await api.get(endpoint, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      const filename = `ORM_Report_${Date.now()}.${extension}`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`${format.toUpperCase()} report downloaded successfully`, { id: 'download-report' });
    } catch (error) {
      console.error('Download error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to download report';
      toast.error(errorMessage, { id: 'download-report' });
    }
  };



  const filteredReports = reports.filter((report) => {
    const matchesSearch = report.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.region?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = filterRegion === 'all' || report.region === filterRegion;
    // Check if any week in the report matches the filter
    const matchesWeek = filterWeek === 'all' || report.weekNumbers?.some(wn => wn.toString() === filterWeek);
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
            <h1 className="text-2xl font-bold" style={{color: '#fafafa'}}>My Reports</h1>
            <p className="text-gray-300">
              View and download reports sent to you by admin 
              {reports.length > 0 && (
                <span className="ml-2 text-blue-400">
                  ({filteredReports.length} of {reports.length} reports sent)
                </span>
              )}
            </p>
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-blue-500 text-sm font-medium rounded-full text-blue-400 bg-transparent hover:bg-blue-500 hover: focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <Download className="h-4 w-4 mr-2" />
            Download All
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-lg p-4 border border-gray-700" >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Search Reports</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search sent reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md leading-5 bg-gray-800  placeholder-gray-400 focus:outline-none focus:placeholder-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Filter by Region</label>
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-800  focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
              <label className="block text-sm font-medium text-gray-300 mb-1">Filter by Week</label>
              <select
                value={filterWeek}
                onChange={(e) => setFilterWeek(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-800  focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="all">All Weeks</option>
                {/* Get unique week numbers from all reports */}
                {Array.from(new Set(reports.flatMap(r => r.weekNumbers || []))).sort((a, b) => a - b).map((week) => (
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
          {filteredReports.map((report) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg overflow-hidden hover:shadow-lg transition-shadow border border-gray-700"
              style={{background: 'linear-gradient(to bottom, #030f30, #060b16)'}}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-gray-800 rounded-lg flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium" style={{color: '#fafafa'}}>
                        {report.totalWeeks > 1 ? `Weeks ${report.weekNumbers.join(', ')}` : `Week ${report.weekNumbers[0] || 1}`}
                      </h3>
                      <p className="text-sm text-gray-300">
                        {report.totalWeeks > 1 ? `${report.totalWeeks} weeks` : report.region}
                      </p>
                      {report.searchQuery && (
                        <p className="text-xs text-blue-400 mt-1">🔍 "{report.searchQuery}"</p>
                      )}
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    report.clientStatus === 'viewed' 
                      ? 'bg-green-800 text-green-200' 
                      : report.clientStatus === 'sent'
                        ? 'bg-blue-800 text-blue-200'
                        : 'bg-gray-800 text-gray-200'
                  }`}>
                    {report.clientStatus === 'not_sent' ? 'New' : 
                     report.clientStatus === 'sent' ? 'Sent to You' : 
                     report.clientStatus === 'viewed' ? 'Viewed' : 
                     'Unknown'}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">Region</span>
                    <span className="text-sm font-medium" style={{color: '#fafafa'}}>{report.region}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">Total Results</span>
                    <span className="text-sm font-medium" style={{color: '#fafafa'}}>
                      {report.resultsCount || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">Total Weeks</span>
                    <span className="text-sm font-medium text-blue-400">
                      {report.totalWeeks || 1}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">Scan Type</span>
                    <span className="text-sm font-medium text-blue-400">
                      {report.scanType || 'Manual'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">Status</span>
                    <span className={`text-sm font-medium ${
                      report.status === 'completed' ? 'text-green-400' : 
                      report.status === 'running' ? 'text-blue-400' : 
                      'text-red-400'
                    }`}>
                      {report.status || 'Unknown'}
                    </span>
                  </div>
                  {report.summary && (
                    <>
                      <div className="border-t border-gray-600 pt-2 mt-2">
                        <span className="text-xs text-gray-400 font-medium">Sentiment Breakdown</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-400">Positive: {report.summary.positiveLinks || 0}</span>
                        <span className="text-red-400">Negative: {report.summary.negativeLinks || 0}</span>
                        <span className="text-yellow-400">Neutral: {report.summary.neutralLinks || 0}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">Completed</span>
                    <span className="text-sm font-medium text-gray-400">
                      {report.completedAt ? new Date(report.completedAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-400 mb-4">
                  Sent: {report.sentToClientAt ? new Date(report.sentToClientAt).toLocaleDateString() : 'Not sent'}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => window.open(`/scans/${report.parentScanId}`, '_blank')}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-blue-500 text-sm font-medium rounded-full text-blue-400 bg-transparent hover:bg-blue-500 hover: focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    View Report
                  </button>
                  <button
                    onClick={() => downloadScanData(report.parentScanId, 'pdf')}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-green-500 text-sm font-medium rounded-full text-green-400 bg-transparent hover:bg-green-500 hover: focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    title="Download PDF Report"
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
            <h3 className="mt-2 text-sm font-medium" style={{color: '#fafafa'}}>No reports found</h3>
            <p className="mt-1 text-sm text-gray-300">
              {searchTerm || filterRegion !== 'all' || filterWeek !== 'all'
                ? 'Try adjusting your filters to see more results.'
                : 'Reports will appear here once they are sent to you by your admin.'}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default ClientReports;


