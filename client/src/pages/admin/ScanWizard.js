import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  User, 
  Settings, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight,
  Play,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ScanWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  
  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Client Selection
    selectedClient: '',
    selectedClientId: '',
    
    // Step 2: Creator Details
    creatorName: '',
    
    // Step 3: Content Settings
    contentType: 'all',
    keywordMode: 'suggested', // 'suggested' or 'custom'
    customKeywords: '',
    timeframe: 'months',
    timeframeValue: 7,
    apiCallLimit: 250
  });

  const steps = [
    { id: 1, title: 'Client Selection', icon: User },
    { id: 2, title: 'Creator Details', icon: User },
    { id: 3, title: 'Content Settings', icon: Settings },
    { id: 4, title: 'Review & Start', icon: CheckCircle }
  ];

  // Fetch clients on component mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await api.get('/clients');
        setClients(response.data);
      } catch (error) {
        console.error('Error fetching clients:', error);
        toast.error('Failed to load clients');
      }
    };
    
    fetchClients();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generateSuggestedKeywords = (creatorName) => {
    if (!creatorName) return [];
    const name = creatorName.toLowerCase().trim();
    return [
      name,
      `${name} content`,
      `${name} official`,
      `${name} videos`,
      `${name} leaks`
    ];
  };

  const startScan = async () => {
    setLoading(true);
    
    try {
      // Generate keywords based on mode
      let keywords = [];
      if (formData.keywordMode === 'suggested') {
        keywords = generateSuggestedKeywords(formData.creatorName);
      } else {
        keywords = formData.customKeywords.split(',').map(k => k.trim()).filter(k => k);
      }

      if (keywords.length === 0) {
        toast.error('Please provide keywords for the scan');
        return;
      }

      toast.loading('Starting scan...', { id: 'scan-start' });
      
      // Use the selected client
      if (!formData.selectedClientId || !formData.selectedClient) {
        throw new Error('Please select a client first.');
      }
      
      const selectedClient = formData.selectedClient;
      if (!selectedClient) {
        throw new Error('Selected client not found.');
      }
      
      // Create scan record
      const scanResponse = await api.post('/scans', {
        clientId: selectedClient._id,
        clientName: selectedClient.name,
        keywords: keywords,
        region: 'US',
        scanType: 'creator_scan',
        resultsCount: 0,
        status: 'running'
      });

      if (!scanResponse.data.success) {
        throw new Error('Failed to create scan record');
      }

      // Start the actual scan process
      // Combine client name with keywords for more targeted search
      const clientName = selectedClient?.name || '';
      const keywordsString = keywords.join(' ');
      const combinedQuery = clientName ? `${clientName} ${keywordsString}` : keywordsString;
      
      const searchResponse = await api.post('/orm-scan/test/google-search', {
        query: combinedQuery, // Combine client name with keywords
        region: 'US',
        resultsCount: Math.min(formData.apiCallLimit, 5) // Limit results to 5
      });

      if (!searchResponse.data.success) {
        throw new Error('Search failed');
      }

      const searchResults = searchResponse.data.results || [];
      
      // Perform sentiment analysis
      const sentimentResponse = await api.post('/orm-scan/test/sentiment-analysis', {
        links: searchResults,
        clientData: {
          name: selectedClient.name,
          clientId: selectedClient._id,
          email: selectedClient.contact?.email || '',
          industry: selectedClient.settings?.industry || 'Content Creator',
          company: selectedClient.name,
          website: selectedClient.settings?.website || '',
          reputationGoals: ['Monitor content leaks', 'Track unauthorized use'],
          currentChallenges: ['Content piracy', 'Unauthorized distribution'],
          targetAudience: selectedClient.settings?.targetAudience || 'Content consumers',
          negativeKeywords: ['leak', 'pirated', 'unauthorized']
        }
      });

      if (!sentimentResponse.data.success) {
        throw new Error('Sentiment analysis failed');
      }

      // Store results
      const resultsResponse = await api.post(`/scans/${scanResponse.data.scan._id}/results`, {
        scanId: scanResponse.data.scan._id,
        results: sentimentResponse.data.results,
        clientData: {
          name: selectedClient.name,
          clientId: selectedClient._id,
          email: selectedClient.contact?.email || '',
          industry: selectedClient.settings?.industry || 'Content Creator',
          businessType: selectedClient.settings?.businessType || 'Content Creator',
          targetAudience: selectedClient.settings?.targetAudience || 'Content consumers',
          region: 'US',
          website: selectedClient.settings?.website || '',
          description: selectedClient.settings?.description || 'Content creator'
        },
        summary: {
          totalLinksFound: searchResults.length,
          linksAnalyzed: sentimentResponse.data.results.length,
          positiveLinks: sentimentResponse.data.results.filter(r => r.sentiment === 'positive').length,
          negativeLinks: sentimentResponse.data.results.filter(r => r.sentiment === 'negative').length,
          neutralLinks: sentimentResponse.data.results.filter(r => r.sentiment === 'neutral').length,
          averageConfidence: sentimentResponse.data.results.reduce((sum, r) => sum + r.confidence, 0) / sentimentResponse.data.results.length
        }
      });

      if (!resultsResponse.data.success) {
        throw new Error('Failed to store scan results');
      }

      toast.success('Scan completed successfully!', { id: 'scan-start' });
      navigate(`/admin/scans/${scanResponse.data.scan._id}`);
      
    } catch (error) {
      console.error('Scan error:', error);
      toast.error(`Scan failed: ${error.message}`, { id: 'scan-start' });
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Select Client</h2>
        <p className="text-gray-400">Choose which client this scan is for.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Client
          </label>
          <select
            value={formData.selectedClientId}
            onChange={(e) => {
              const selectedClient = clients.find(c => c._id === e.target.value);
              handleInputChange('selectedClientId', e.target.value);
              handleInputChange('selectedClient', selectedClient || null);
            }}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Select a client...</option>
            {clients.map((client) => (
              <option key={client._id} value={client._id}>
                {client.name} ({client.contact?.email || 'No email'})
              </option>
            ))}
          </select>
        </div>
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Creator Information</h2>
        <p className="text-gray-400">Enter the name of the creator whose content you want to scan for leaks.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Creator Name
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={formData.creatorName}
              onChange={(e) => handleInputChange('creatorName', e.target.value)}
              placeholder="Enter creator name"
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Content Settings</h2>
        <p className="text-gray-400">Configure the scan settings to find leaked content.</p>
      </div>

      <div className="space-y-6">
        {/* Content Type */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Content Type</h3>
          <div className="space-y-2">
            {[
              { value: 'all', label: 'All Content' },
              { value: 'videos', label: 'Videos' },
              { value: 'images', label: 'Images' },
              { value: 'text', label: 'Text' }
            ].map((option) => (
              <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="contentType"
                  value={option.value}
                  checked={formData.contentType === option.value}
                  onChange={(e) => handleInputChange('contentType', e.target.value)}
                  className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 focus:ring-purple-500"
                />
                <span className="text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Keywords</h3>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="keywordMode"
                value="suggested"
                checked={formData.keywordMode === 'suggested'}
                onChange={(e) => handleInputChange('keywordMode', e.target.value)}
                className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 focus:ring-purple-500"
              />
              <span className="text-gray-300">Use suggested keywords based on creator name</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="keywordMode"
                value="custom"
                checked={formData.keywordMode === 'custom'}
                onChange={(e) => handleInputChange('keywordMode', e.target.value)}
                className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 focus:ring-purple-500"
              />
              <span className="text-gray-300">Use custom keywords</span>
            </label>
            
            {formData.keywordMode === 'custom' && (
              <div className="mt-3">
                <textarea
                  value={formData.customKeywords}
                  onChange={(e) => handleInputChange('customKeywords', e.target.value)}
                  placeholder="Enter keywords separated by commas"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                />
              </div>
            )}
          </div>
        </div>

        {/* Timeframe */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Timeframe</h3>
          <div className="space-y-2">
            {[
              { value: 'today', label: 'Today only' },
              { value: 'days', label: 'Last X days' },
              { value: 'weeks', label: 'Last X weeks' },
              { value: 'months', label: 'Last X months' }
            ].map((option) => (
              <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="timeframe"
                  value={option.value}
                  checked={formData.timeframe === option.value}
                  onChange={(e) => handleInputChange('timeframe', e.target.value)}
                  className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 focus:ring-purple-500"
                />
                <span className="text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
          
          {formData.timeframe !== 'today' && (
            <div className="mt-4">
              <div className="flex items-center space-x-4">
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={formData.timeframeValue}
                  onChange={(e) => handleInputChange('timeframeValue', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <span className="text-white font-medium min-w-[80px]">
                  {formData.timeframeValue} {formData.timeframe}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* API Call Limit */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">API Call Limit</h3>
          <p className="text-gray-400 text-sm mb-3">Limit the number of API calls to control costs and scan time.</p>
          <div className="flex items-center space-x-4">
            <span className="text-gray-400 text-sm">50</span>
            <input
              type="range"
              min="50"
              max="500"
              step="50"
              value={formData.apiCallLimit}
              onChange={(e) => handleInputChange('apiCallLimit', parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <span className="text-gray-400 text-sm">500</span>
            <span className="text-white font-medium min-w-[80px]">
              {formData.apiCallLimit} calls
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStep4 = () => {
    const suggestedKeywords = generateSuggestedKeywords(formData.creatorName);
    const displayKeywords = formData.keywordMode === 'suggested' ? suggestedKeywords : formData.customKeywords.split(',').map(k => k.trim()).filter(k => k);

    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Review & Start Scan</h2>
          <p className="text-gray-400">Review your scan settings before starting.</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400 text-sm">Creator:</span>
              <p className="text-white font-medium">{formData.creatorName || 'Not specified'}</p>
            </div>
            <div>
              <span className="text-gray-400 text-sm">Content Type:</span>
              <p className="text-white font-medium capitalize">{formData.contentType}</p>
            </div>
            <div>
              <span className="text-gray-400 text-sm">Keywords:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {displayKeywords.map((keyword, index) => (
                  <span key={index} className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-gray-400 text-sm">Timeframe:</span>
              <p className="text-white font-medium">
                {formData.timeframe === 'today' ? 'Today only' : `Last ${formData.timeframeValue} ${formData.timeframe}`}
              </p>
            </div>
            <div>
              <span className="text-gray-400 text-sm">API Call Limit:</span>
              <p className="text-white font-medium">{formData.apiCallLimit} calls</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Content Leak Scanner</h1>
          <p className="text-gray-400">Scan for unauthorized content distribution</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300
                    ${isActive ? 'bg-purple-600 border-purple-600 text-white' : 
                      isCompleted ? 'bg-green-600 border-green-600 text-white' : 
                      'bg-gray-800 border-gray-600 text-gray-400'}
                  `}>
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-white' : isCompleted ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-0.5 mx-4 ${
                      isCompleted ? 'bg-green-600' : 'bg-gray-600'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-gray-800 rounded-lg p-8 min-h-[400px]">
          <AnimatePresence mode="wait">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-300 ${
              currentStep === 1 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex space-x-4">
            {currentStep < 3 ? (
              <button
                onClick={nextStep}
                className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-300"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={startScan}
                disabled={loading || !formData.creatorName}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-300 ${
                  loading || !formData.creatorName
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {loading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Starting Scan...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Start Scan</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanWizard;
