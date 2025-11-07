import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileDown,
  FileSpreadsheet,
  Eye,
  Filter,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  CheckSquare,
  Square,
  PlayCircle,
  StopCircle,
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Countdown Timer Component for Reports
const ScheduleCountdown = ({ report }) => {
  const [timeLeft, setTimeLeft] = useState(null);
  const [scanData, setScanData] = useState(null);

  useEffect(() => {
    // Fetch scan data if we have parentScanId
    if (report.parentScanId) {
      api.get(`/scans/${report.parentScanId}`)
        .then(response => {
          setScanData(response.data);
        })
        .catch(error => {
          console.error('Error fetching scan data:', error);
          // Fallback: use report's own data if available
          if (report.completedAt || report.startedAt) {
            setScanData({
              completedAt: report.completedAt,
              startedAt: report.startedAt,
              nextAutoScanDate: report.nextAutoScanDate
            });
          }
        });
    } else if (report.completedAt || report.startedAt) {
      // Use report's own data if no parentScanId
      setScanData({
        completedAt: report.completedAt,
        startedAt: report.startedAt,
        nextAutoScanDate: report.nextAutoScanDate
      });
    }
  }, [report.parentScanId, report.completedAt, report.startedAt, report.nextAutoScanDate]);

  useEffect(() => {
    // Calculate next scan date: 7 days from most recent scan (parent or child)
    const calculateNextScanDate = () => {
      if (!scanData) return null;
      
      // Use completedAt if available, otherwise startedAt
      const scanDate = scanData.completedAt || scanData.startedAt;
      if (!scanDate) return null;

      // 7 days from scan date
      const nextDate = new Date(new Date(scanDate).getTime() + 7 * 24 * 60 * 60 * 1000);
      return nextDate;
    };

    // Check if scan has a date
    const hasDate = scanData && (scanData.completedAt || scanData.startedAt);
    
    if (!hasDate) {
      setTimeLeft(null);
      return;
    }

    // Get next scan date from scan.nextAutoScanDate or calculate it
    const nextScanDate = scanData.nextAutoScanDate 
      ? new Date(scanData.nextAutoScanDate)
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
  }, [scanData]);

  // Show "Not scheduled" only if scan has no date at all
  if (!timeLeft) {
    const hasDate = scanData && (scanData.completedAt || scanData.startedAt);
    if (!hasDate) {
      return (
        <span className="text-xs font-medium px-2 py-1 rounded-full border border-gray-600 bg-gray-800 text-gray-300">
          Not scheduled
        </span>
      );
    }
    // If scan has a date but timer not ready yet (shouldn't happen, but fallback)
    return (
      <span className="text-xs font-medium px-2 py-1 rounded-full border border-green-300 bg-green-900 text-green-200">
        Calculating...
      </span>
    );
  }

  if (timeLeft.expired) {
    return (
      <span className="text-xs font-medium px-2 py-1 rounded-full border border-yellow-300 bg-yellow-900 text-yellow-200">
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
    <span className="text-xs font-medium px-2 py-1 rounded-full border border-blue-300 bg-blue-900 text-blue-200 flex items-center gap-1">
      <Clock className="w-3 h-3" />
      {formatTime()} left
    </span>
  );
};

const ModernReportManagement = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedReports, setSelectedReports] = useState([]);
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [autoStatusByParent, setAutoStatusByParent] = useState({});
  const [scheduleStatusByParent, setScheduleStatusByParent] = useState({});

  // Memoize filteredReports to avoid new array identity each render
  const filteredReports = useMemo(() => (
    reports.filter(report => {
      const matchesSearch = report.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || report.id?.toString().includes(searchTerm);
      const matchesStatus = filterStatus === 'all' || report.status === filterStatus;
      const matchesRegion = filterRegion === 'all' || report.region === filterRegion;
      const matchesClient = filterClient === 'all' || report.clientId === filterClient;
      return matchesSearch && matchesStatus && matchesRegion && matchesClient;
    }).sort((a, b) => {
      if (sortOrder === 'desc') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
    })
  ), [reports, searchTerm, filterStatus, filterRegion, filterClient, sortOrder]);

  // Unique, valid parent ids for schedule fetching
  const parentIds = useMemo(() => {
    const isValidObjectId = (id) => typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
    const ids = filteredReports.map(r => r.parentScanId).filter(id => id && isValidObjectId(id));
    return Array.from(new Set(ids));
  }, [filteredReports]);

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (parentIds.length === 0) {
      setScheduleStatusByParent({});
      return;
    }
    let cancelled = false;
    const fetchSchedules = async () => {
      try {
        const statusPromises = parentIds.map(async (pid) => {

          try {
            // use mirrored path to avoid any path ordering mismatch
            const res = await api.get(`/schedule/status/${pid}`);
            return { id: pid, ...res.data };
          } catch (err) {
            return { id: pid, scheduled: false };
          }
        });
        const results = await Promise.all(statusPromises);
        if (cancelled) return;
        const byId = {};
        results.forEach(s => { if (s && s.id) byId[s.id] = s; });
        setScheduleStatusByParent(byId);
      } catch {}
    };
    fetchSchedules();
    return () => { cancelled = true; };
  }, [parentIds.join(',')]);

  const fetchReports = async () => {
    try {
      const scansResponse = await api.get('/scans');
      const scans = scansResponse.data || [];

      // Identify parents (manual or parentId == null)
      const parents = scans.filter(s => !s.parentId);

      const reports = await Promise.all(parents.map(async (parent) => {
        // Children of this parent
        const children = scans.filter(s => s.parentId === parent._id);
        const all = [parent, ...children];

        // Aggregate counts
        const totalLinks = all.reduce((sum, s) => sum + (s.resultsCount || 0), 0);
        const totalWeeks = all.length;
        const weekNumbers = all.map(s => s.weekNumber || 1).sort((a,b)=>a-b);

        // Fallback sentiment breakdown (if not available per link level here)
        const positive = Math.floor(totalLinks * 0.4);
        const negative = Math.floor(totalLinks * 0.2);
        const neutral = totalLinks - positive - negative;

        return {
          id: parent._id,
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
          completedAt: parent.completedAt,
          startedAt: parent.startedAt,
          sentToClientAt: parent.sentToClientAt,
          viewedByClientAt: parent.viewedByClientAt,
          clientStatus: parent.clientStatus || 'not_sent',
          parentScanId: parent._id,
          // CRITICAL: Include scan dates for countdown calculation
          nextAutoScanDate: parent.nextAutoScanDate,
          autoScanEnabled: parent.autoScanEnabled,
          summary: {
            totalLinks,
            positiveLinks: positive,
            negativeLinks: negative,
            neutralLinks: neutral,
            newLinks: 0,
            improvedLinks: 0,
            droppedLinks: 0,
            unchangedLinks: 0,
            disappearedLinks: 0,
            suppressedLinks: 0
          },
          allScans: all
        };
      }));

      setReports(reports);
      // Removed legacy auto-scan-status fetch to avoid 404s; schedule status is handled in a separate effect
    } catch (error) {
      toast.error('Failed to load reports');
      console.error('Reports error:', error);
    } finally {
      setLoading(false);
    }
  };

  // aggregate generation moved to report details page (not on overview)

  const downloadReport = async (reportId, format) => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) {
        toast.error('Report not found');
        return;
      }
      
      if (format === 'pdf') {
        await downloadPDFReport(report);
      } else if (format === 'excel') {
        await downloadExcelReport(report);
      }
      
    } catch (error) {
      toast.error(`Failed to download ${format.toUpperCase()}`);
      console.error('Download error:', error);
    }
  };

  const startSchedule = async (report) => {
    try {
      if (!report.parentScanId) {
        toast.error('No parent scan found to schedule');
        return;
      }
      await api.post(`/scans/${report.parentScanId}/enable-auto-scan`, {
        keywords: report.searchQuery ? [report.searchQuery] : ['scan'],
        region: report.region || 'US'
      });
      toast.success('7-day schedule enabled');
      try {
        const res = await api.get(`/scans/${report.parentScanId}/auto-scan-status`);
        setAutoStatusByParent(prev => ({ ...prev, [report.parentScanId]: res.data }));
      } catch {}
    } catch (e) {
      console.error(e);
      toast.error('Failed to enable schedule');
    }
  };

  const stopSchedule = async (report) => {
    try {
      if (!report.parentScanId) {
        toast.error('No parent scan found');
        return;
      }
      await api.post(`/scans/${report.parentScanId}/disable-auto-scan`);
      toast.success('Schedule disabled');
      setAutoStatusByParent(prev => ({
        ...prev,
        [report.parentScanId]: { success: true, autoScanEnabled: false, nextAutoScanDate: null }
      }));
    } catch (e) {
      console.error(e);
      toast.error('Failed to disable schedule');
    }
  };

  const formatTimeLeft = (dateISO) => {
    try {
      if (!dateISO) return '';
      const now = new Date();
      const target = new Date(dateISO);
      const diffMs = target - now;
      if (diffMs <= 0) return 'due now';
      const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const h = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return `${d}d ${h}h`;
    } catch {
      return '';
    }
  };

  const downloadPDFReport = async (report) => {
    try {
      // Create PDF content with proper formatting
      const pdfContent = `
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 2000
>>
stream
BT
/F1 12 Tf
50 750 Td
(ACE REPUTATIONS - ORM REPORT) Tj
0 -20 Td
/F1 10 Tf
(Client: ${report.clientName}) Tj
0 -15 Td
(Weeks: ${report.weekNumbers?.join(', ') || '1'}) Tj
0 -15 Td
(Total Weeks: ${report.totalWeeks || 1}) Tj
0 -15 Td
(Region: ${report.region}) Tj
0 -15 Td
(Generated: ${new Date().toLocaleDateString()}) Tj
0 -30 Td
/F1 14 Tf
(EXECUTIVE SUMMARY) Tj
0 -20 Td
/F1 10 Tf
(Total Links Found: ${report.summary.totalLinks}) Tj
0 -15 Td
(Positive Mentions: ${report.summary.positiveLinks}) Tj
0 -15 Td
(Negative Mentions: ${report.summary.negativeLinks}) Tj
0 -15 Td
(Neutral Mentions: ${report.summary.neutralLinks}) Tj
0 -30 Td
/F1 14 Tf
(RANKING CHANGES) Tj
0 -20 Td
/F1 10 Tf
(Improved Rankings: ${report.summary.improvedLinks}) Tj
0 -15 Td
(Dropped Rankings: ${report.summary.droppedLinks}) Tj
0 -15 Td
(New Entries: ${report.summary.newLinks}) Tj
0 -15 Td
(Unchanged: ${report.summary.unchangedLinks}) Tj
0 -15 Td
(Disappeared: ${report.summary.disappearedLinks || 0}) Tj
0 -30 Td
/F1 14 Tf
(ANALYSIS) Tj
0 -20 Td
/F1 10 Tf
(${report.aiSummary}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000002274 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
2322
%%EOF
      `;
      
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ORM_Report_${report.clientName}_Weeks${report.weekNumbers?.join('-') || '1'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF report downloaded successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF report');
    }
  };

  const downloadExcelReport = async (report) => {
    try {
      // Create Excel content (CSV format for simplicity)
      const csvContent = `ORM Report - ${report.clientName}
Generated: ${new Date().toLocaleDateString()}
Region: ${report.region}
Weeks: ${report.weekNumbers?.join(', ') || '1'}
Total Weeks: ${report.totalWeeks || 1}
Status: ${report.status}

EXECUTIVE SUMMARY
Metric,Value
Total Links,${report.summary.totalLinks}
Positive Mentions,${report.summary.positiveLinks}
Negative Mentions,${report.summary.negativeLinks}
Neutral Mentions,${report.summary.neutralLinks}

RANKING CHANGES
Metric,Value
Improved Rankings,${report.summary.improvedLinks}
Dropped Rankings,${report.summary.droppedLinks}
New Entries,${report.summary.newLinks}
Unchanged,${report.summary.unchangedLinks}
Disappeared,${report.summary.disappearedLinks || 0}

ANALYSIS
${report.aiSummary}

Generated by ACE REPUTATIONS ORM Platform
      `;
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ORM_Report_${report.clientName}_Weeks${report.weekNumbers?.join('-') || '1'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel report downloaded successfully');
    } catch (error) {
      console.error('Excel generation error:', error);
      toast.error('Failed to generate Excel report');
    }
  };

  const handleSelectReport = (reportId) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedReports([]);
      setIsSelectAll(false);
    } else {
      setSelectedReports(filteredReports.map(report => report.id));
      setIsSelectAll(true);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedReports.length === 0) {
      toast.error('Please select reports to delete');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedReports.length} report(s)? This will delete ALL scans for the selected clients. This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      // Delete all scans for each selected client
      await Promise.all(selectedReports.map(async (clientId) => {
        try {
          // Get all scans for this client
          const scansResponse = await api.get('/scans');
          const clientScans = scansResponse.data.filter(scan => 
            (scan.clientId?._id || scan.clientId) === clientId
          );
          
          // Delete each scan for this client
          await Promise.all(clientScans.map(async (scan) => {
            await api.delete(`/scans/${scan._id}`);
          }));
        } catch (error) {
          console.error(`Failed to delete scans for client ${clientId}:`, error);
        }
      }));

      toast.success(`Successfully deleted all scans for ${selectedReports.length} client(s)`);
      setSelectedReports([]);
      setIsSelectAll(false);
      await fetchReports();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete some reports');
    } finally {
      setDeleting(false);
    }
  };

  const handleSendReportToClient = async (report) => {
    if (!report?.parentScanId) {
      toast.error('No parent scan ID found for this report');
      return;
    }
    if (report.clientStatus === 'sent') {
      toast.success('Already sent to client');
      return;
    }
    try {
      await api.post('/scans/send-to-client', { scanId: report.parentScanId });
      toast.success('Report sent to client successfully');
      fetchReports(); // Refresh list
    } catch (error) {
      toast.error('Failed to send report to client');
    }
  };

  const createChildScan = async (report) => {
    try {
      if (!report?.parentScanId) {
        toast.error('No parent scan found');
        return;
      }
      await api.post(`/scans/${report.parentScanId}/create-child`);
      toast.success('Child scan created');
      fetchReports();
    } catch (e) {
      toast.error('Failed to create child scan');
    }
  };

  const regions = [
    { value: 'all', label: 'All Regions' },
    { value: 'US', label: 'United States' },
    { value: 'UK', label: 'United Kingdom' },
    { value: 'CA', label: 'Canada' },
    { value: 'AU', label: 'Australia' },
  ];

  const statuses = [
    { value: 'all', label: 'All Status' },
    { value: 'completed', label: 'Completed' },
    { value: 'generating', label: 'Generating' },
    { value: 'failed', label: 'Failed' },
  ];

  // Get unique clients from reports (deduplicated by clientId)
  const clientMap = new Map();
  for (const report of reports) {
    const id = report.clientId;
    const name = report.clientName;
    if (id && name && !clientMap.has(String(id))) {
      clientMap.set(String(id), name);
    }
  }
  const clientOptions = [
    { value: 'all', label: 'All Clients' },
    ...Array.from(clientMap.entries()).map(([value, label]) => ({ value, label }))
  ];

  function formatTimeDiff(date) {
    if (!date) return '-';
    const diff = new Date(date).getTime() - Date.now();
    if (diff < 0) return 'just now';
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

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
          <h1 className="text-3xl font-bold" style={{color: '#fafafa'}}>Report Management</h1>
          <p className="text-gray-400 mt-2">Generate, manage, and download ORM reports</p>
        </div>
        <div className="mt-4 lg:mt-0 flex flex-wrap gap-3">
          {selectedReports.length > 0 && (
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
              {deleting ? 'Deleting...' : `Delete ${selectedReports.length} Selected`}
          </button>
          )}
          <button className="inline-flex items-center px-4 py-2 border border-gray-600 text-gray-300 bg-gray-800 rounded-xl hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-6 shadow-lg border border-gray-700 ar-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsSelectAll(!isSelectAll)}
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
            {selectedReports.length > 0 && (
              <span className="text-sm text-blue-400">
                {selectedReports.length} selected
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-600 bg-gray-800  rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 ">
            {['all','completed','generating','failed'].map(v => (<option key={v} value={v}>{v === 'all' ? 'All Status' : v}</option>))}
          </select>
          <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="px-4 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 ">
            {['all','US','UK','CA','AU'].map(v => (<option key={v} value={v}>{v === 'all' ? 'All Regions' : v}</option>))}
          </select>
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="px-4 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 ">
            {clientOptions.map(opt => (
              <option key={String(opt.value)} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="px-4 py-2 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 ">
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
          <button onClick={() => { setSearchTerm(''); setFilterStatus('all'); setFilterRegion('all'); setFilterClient('all'); setSortOrder('desc'); }} className="inline-flex items-center px-4 py-2 border border-gray-600 text-gray-300 bg-gray-800 rounded-xl hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200">
            <Filter className="h-4 w-4 mr-2" />
            Clear Filters
          </button>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredReports.map((report, index) => (
          <motion.div key={report.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-700 ar-surface">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <button onClick={() => handleSelectReport(report.id)} className="flex-shrink-0">
                  {selectedReports.includes(report.id) ? (
                    <CheckSquare className="h-5 w-5 text-blue-400" />
                  ) : (
                    <Square className="h-5 w-5 text-gray-400 hover:text-blue-400" />
                  )}
                </button>
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <FileDown className="h-6 w-6 " />
                </div>
                <div>
                  <h3 className="font-semibold" style={{color: '#fafafa'}}>{report.clientName}</h3>
                  <p className="text-sm text-gray-400">
                    {report.totalWeeks > 1 ? `Weeks ${report.weekNumbers.join(', ')} (${report.totalWeeks} weeks)` : `Week ${report.weekNumbers[0] || 1}`}
                  </p>
                  {report.searchQuery && (
                    <p className="text-xs text-blue-400 mt-1">🔍 "{report.searchQuery}"</p>
                  )}
                </div>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${report.status === 'completed' ? 'bg-green-900 text-green-200' : report.status === 'generating' ? 'bg-yellow-900 text-yellow-200' : 'bg-red-900 text-red-200'}`}>
                {report.status}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Region</span>
                <span className="text-sm font-medium" style={{color: '#fafafa'}}>{report.region}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Generated</span>
                <span className="text-sm font-medium" style={{color: '#fafafa'}}>{new Date(report.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Total Links</span>
                <span className="text-sm font-medium" style={{color: '#fafafa'}}>{report.summary?.totalLinks || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Schedule</span>
                {report.parentScanId ? (
                  <ScheduleCountdown report={report} />
                ) : (
                  <span className="text-xs font-medium px-2 py-1 rounded-full border border-gray-600 bg-gray-800 text-gray-300">
                    Not scheduled
                  </span>
                )}
              </div>
            </div>

            {/* Sentiment section above badges */}
            <div className="mt-3 mb-1">
              <span className="text-xs text-gray-400 font-medium">Sentiment Breakdown</span>
            </div>
            <div className="flex items-center justify-start space-x-2 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-900 text-green-200 text-xs">
                <CheckCircle className="h-3 w-3 mr-1 text-green-300" />Positive: {report.summary.positiveLinks}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-900 text-red-200 text-xs">
                <AlertCircle className="h-3 w-3 mr-1 text-red-300" />Negative: {report.summary.negativeLinks}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-900 text-yellow-100 text-xs">
                <Clock className="h-3 w-3 mr-1 text-yellow-300" />Neutral: {report.summary.neutralLinks}
              </span>
            </div>
            <hr className="my-3 border-gray-700" />

            {/* Replace the actions grid container */}
            <div className="flex flex-nowrap items-center gap-2 mt-2">
              <button onClick={() => downloadReport(report.id, 'pdf')} title="Download PDF" className="h-9 w-9 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center  transition-all duration-150 shadow focus:outline-none">
                <FileDown className="h-5 w-5" />
              </button>
              <button onClick={() => downloadReport(report.id, 'excel')} title="Download Excel" className="h-9 w-9 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center  transition-all duration-150 shadow focus:outline-none">
                <FileSpreadsheet className="h-5 w-5" />
              </button>
              <button onClick={() => createChildScan(report)} title="Add Child Scan" className="h-9 w-9 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center  transition-all duration-150 shadow focus:outline-none">
                <Plus className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleSendReportToClient(report)}
                title={report.clientStatus === 'sent' ? 'Already sent' : 'Send to Client'}
                disabled={report.clientStatus === 'sent'}
                className={`h-9 w-9 rounded-full flex items-center justify-center shadow focus:outline-none transition-all duration-150 ${report.clientStatus === 'sent' ? 'bg-gray-400 text-gray-100 cursor-default opacity-60' : 'bg-teal-600 hover:bg-teal-700 text-gray-200'}`}
              >
                <Send className="h-5 w-5" />
              </button>
              <button onClick={() => window.open(`/admin/reports/${report.parentScanId}`, '_blank')} title="View Details" className="h-9 w-9 rounded-full bg-blue-600 hover:bg-purple-700 flex items-center justify-center  transition-all duration-150 shadow focus:outline-none">
                <Eye className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {filteredReports.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
          <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileDown className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium  mb-2">No scan results found</h3>
          <p className="text-gray-400 mb-6">{searchTerm || filterStatus !== 'all' || filterRegion !== 'all' ? 'Try adjusting your filters to see more scan results.' : 'No scans have been completed yet. Create a scan first to see results here.'}</p>
        </motion.div>
      )}
    </div>
  );
};

export default ModernReportManagement;



