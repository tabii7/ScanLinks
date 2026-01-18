import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Users,
  Play
} from 'lucide-react';
import api from '../../services/api';

const ScanConfiguration = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    // Step 1: Client Selection & Keywords
    selectedClient: '',
    selectedClientId: '',
    scanWithKeywords: true, // New option: scan with or without keywords
    customKeywords: '',
    
    // Step 2: Basic Settings
    scanRegion: 'US',
    apiCallLimit: 100, // Default to 100 results (up to 10 pages)
    timeFrame: 'past_week',
    contentType: 'all'
  });

  const steps = [
    { id: 1, title: 'Client & Keywords', icon: Users, description: 'Select client and add keywords' },
    { id: 2, title: 'Country & Settings', icon: Settings, description: 'Select country and basic settings' },
    { id: 3, title: 'Start Scan', icon: Play, description: 'Review and start scan' }
  ];

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const startScan = async () => {
    setLoading(true);
    try {
      let keywords = [];
      
      if (formData.scanWithKeywords) {
        // Scan with keywords: extract from textarea
        keywords = formData.customKeywords.split('\n').filter(k => k.trim());
        
        // Save keywords to database only if keywords are provided
        if (keywords.length > 0) {
          await api.post('/keywords/bulk-create', {
            clientId: formData.selectedClientId,
            keywords: keywords.map(keyword => ({
              keyword: keyword.trim(),
              targetRegions: [formData.scanRegion],
              priority: 'medium',
              status: 'active'
            }))
          });
        }
      } else {
        // Scan without keywords: use client name as the search term
        keywords = [formData.selectedClient];
      }
      
      // Start the scan with enhanced parameters
      const response = await api.post('/orm-scan/trigger', {
        clientId: formData.selectedClientId,
        keywords: keywords,
        region: formData.scanRegion,
        options: {
          clientName: formData.selectedClient,
          resultsCount: formData.apiCallLimit,
          timeFrame: formData.timeFrame,
          contentType: formData.contentType
        }
      });
      
      console.log('Keywords saved and scan started successfully:', response.data);
      
      // Redirect to scan results page
      if (response.data.scanId) {
        navigate(`/admin/scans/${response.data.scanId}`);
      } else {
        // Fallback to scans list
        navigate('/admin/scans');
      }
    } catch (error) {
      console.error('Error starting scan:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to start scan. Please check your API configuration.';
      alert(`Error starting scan: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2" style={{color: '#f3f4f6'}}>Select Client</h3>
        <select
          value={formData.selectedClientId}
          onChange={(e) => {
            const selectedClient = clients.find(c => c._id === e.target.value);
            handleInputChange('selectedClient', selectedClient?.name || '');
            handleInputChange('selectedClientId', e.target.value);
          }}
          className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg  focus:border-blue-500 focus:outline-none"
        >
          <option value="">Select a client</option>
          {clients.map(client => (
            <option key={client._id} value={client._id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3" style={{color: '#f3f4f6'}}>Scan Type</h3>
        <div className="flex gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="scanType"
              value="withKeywords"
              checked={formData.scanWithKeywords}
              onChange={() => handleInputChange('scanWithKeywords', true)}
              className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 focus:ring-blue-500"
            />
            <span className="ml-2" style={{color: '#f3f4f6'}}>With Keywords</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="scanType"
              value="withoutKeywords"
              checked={!formData.scanWithKeywords}
              onChange={() => handleInputChange('scanWithKeywords', false)}
              className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 focus:ring-blue-500"
            />
            <span className="ml-2" style={{color: '#f3f4f6'}}>Without Keywords</span>
          </label>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          {formData.scanWithKeywords 
            ? 'Search using specific keywords (one per line)' 
            : `Search using client name: "${formData.selectedClient || 'Client name'}"`}
        </p>
      </div>

      {formData.scanWithKeywords && (
        <div>
          <h3 className="text-lg font-semibold mb-2" style={{color: '#f3f4f6'}}>Keywords</h3>
          <textarea
            value={formData.customKeywords}
            onChange={(e) => handleInputChange('customKeywords', e.target.value)}
            placeholder="Enter keywords to search for (one per line)"
            rows={4}
            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg  focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Country Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-2" style={{color: '#f3f4f6'}}>Select Country</h3>
        <select
          value={formData.scanRegion}
          onChange={(e) => handleInputChange('scanRegion', e.target.value)}
          className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg  focus:border-blue-500 focus:outline-none"
        >
          <option value="US">United States</option>
          <option value="UK">United Kingdom</option>
          <option value="CA">Canada</option>
          <option value="AU">Australia</option>
          <option value="DE">Germany</option>
          <option value="FR">France</option>
          <option value="IT">Italy</option>
          <option value="ES">Spain</option>
          <option value="NL">Netherlands</option>
          <option value="UAE">United Arab Emirates</option>
        </select>
      </div>

      {/* Time Frame Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-2" style={{color: '#f3f4f6'}}>Time Frame</h3>
        <select
          value={formData.timeFrame}
          onChange={(e) => handleInputChange('timeFrame', e.target.value)}
          className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg  focus:border-blue-500 focus:outline-none"
        >
          <option value="past_week">Past Week</option>
          <option value="past_month">Past Month</option>
          <option value="past_3_months">Past 3 Months</option>
          <option value="past_year">Past Year</option>
          <option value="all_time">All Time</option>
        </select>
        <p className="text-sm text-gray-400 mt-1">
          Select the time period for search results
        </p>
      </div>

      {/* Content Type Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-2" style={{color: '#f3f4f6'}}>Content Type</h3>
        <select
          value={formData.contentType}
          onChange={(e) => handleInputChange('contentType', e.target.value)}
          className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg  focus:border-blue-500 focus:outline-none"
        >
          <option value="all">All Content</option>
          <option value="news">News Articles</option>
          <option value="blogs">Blog Posts</option>
          <option value="social">Social Media</option>
          <option value="forums">Forum Discussions</option>
          <option value="reviews">Reviews & Ratings</option>
          <option value="press">Press Releases</option>
        </select>
        <p className="text-sm text-gray-400 mt-1">
          Filter results by content type
        </p>
      </div>

      {/* API Call Limit */}
      <div>
        <h3 className="text-lg font-semibold mb-3" style={{color: '#f3f4f6'}}>Number of Results</h3>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="1"
            max="100"
            value={formData.apiCallLimit}
            onChange={(e) => handleInputChange('apiCallLimit', parseInt(e.target.value))}
            className="flex-1 slider"
          />
          <span className="font-semibold min-w-[60px]" style={{color: '#f3f4f6'}}>{formData.apiCallLimit}</span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Number of search results to analyze (1-100, default: 100). Each keyword can fetch up to 100 results using pagination.
        </p>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-600">
        <h3 className="text-xl font-semibold mb-4" style={{color: '#fafafa'}}>Scan Summary</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-lg font-medium text-blue-400 mb-2">Client & Scan Type</h4>
            <p className="text-gray-300">Client: {clients.find(c => c._id === formData.selectedClientId)?.name || 'Not selected'}</p>
            <p className="text-gray-300">Scan Type: {formData.scanWithKeywords ? 'With Keywords' : 'Without Keywords'}</p>
            {formData.scanWithKeywords ? (
              <p className="text-gray-300">Keywords: {formData.customKeywords || 'None entered'}</p>
            ) : (
              <p className="text-gray-300">Search Term: {formData.selectedClient || 'Client name'}</p>
            )}
          </div>
          
          <div>
            <h4 className="text-lg font-medium text-blue-400 mb-2">Scan Settings</h4>
            <p className="text-gray-300">Country: {formData.scanRegion}</p>
            <p className="text-gray-300">Time Frame: {formData.timeFrame.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
            <p className="text-gray-300">Content Type: {formData.contentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
            <p className="text-gray-300">Number of Results: {formData.apiCallLimit}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-yellow-900 border border-yellow-600 p-4 rounded-lg">
        <p className="text-yellow-200 text-sm">
          <strong>Ready to start scan?</strong> This will search for the specified keywords in the selected country. 
          The scan may take a few minutes to complete.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-6" style={{backgroundColor: '#060b16'}}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{color: '#fafafa'}}>Scan Configuration</h1>
          <p className="text-gray-400">Configure and start a comprehensive ORM scan</p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                    isCompleted 
                      ? 'bg-green-500 border-green-500 text-gray-200' 
                      : isActive 
                        ? 'bg-blue-500 border-blue-500 text-gray-200' 
                        : 'border-gray-600 text-slate-400'
                  }`}>
                    {isCompleted ? <CheckCircle size={20} /> : <Icon size={20} />}
                  </div>
                  <div className="ml-3">
                    <p className={`font-semibold ${isActive ? 'text-gray-200' : 'text-gray-400'}`}>
                      {step.title}
                    </p>
                    <p className="text-sm text-gray-400">{step.description}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${
                      isCompleted ? 'bg-green-500' : 'bg-slate-300'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="rounded-lg p-8 shadow-lg border border-gray-700" style={{backgroundColor: '#1f2937'}}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-colors ${
              currentStep === 1
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <ArrowLeft size={20} className="mr-2" />
            Previous
          </button>

          {currentStep < 3 ? (
            <button
              onClick={nextStep}
              className="flex items-center px-6 py-3 bg-blue-600  rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Next
              <ArrowRight size={20} className="ml-2" />
            </button>
          ) : (
            <button
              onClick={startScan}
              disabled={loading}
              className={`flex items-center px-6 py-3 rounded-lg font-semibold transition-colors ${
                loading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Starting Scan...
                </>
              ) : (
                <>
                  <Play size={20} className="mr-2" />
                  Start Scan
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Custom CSS for sliders */}
      <style>{`
        .slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 3px;
          background: #374151;
          outline: none;
        }
        
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #8b5cf6;
          cursor: pointer;
          border: 2px solid #1f2937;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #8b5cf6;
          cursor: pointer;
          border: 2px solid #1f2937;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        }
      `}</style>
    </div>
  );
};

export default ScanConfiguration;
