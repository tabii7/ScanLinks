import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Building2,
  Globe,
  Users,
  Target,
  TrendingUp,
  MapPin,
  Settings,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Save,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const ClientCreationWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    name: '',
    email: '',
    password: '',
    phone: '',
    company: '',
    website: '',
    
    // Step 2: Reputation Profile
    keywords: [],
    reputationGoals: [],
    industry: ''
  });

  const steps = [
    { id: 1, title: 'Basic Information', icon: User, description: 'Name, contact, and company details' },
    { id: 2, title: 'Reputation Profile', icon: Target, description: 'Keywords and reputation goals' },
    { id: 3, title: 'Complete', icon: CheckCircle, description: 'Review and create client' }
  ];

  const totalSteps = steps.length;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (parentField, childField, value) => {
    setFormData(prev => ({
      ...prev,
      [parentField]: {
        ...prev[parentField],
        [childField]: value
      }
    }));
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.email && formData.password && formData.company;
      case 2:
        return formData.keywords.length > 0 && formData.reputationGoals.length > 0;
      case 3:
        return true; // Review step is always valid
      default:
        return false;
    }
  };

  const handleArrayChange = (field, value, action = 'add') => {
    setFormData(prev => ({
      ...prev,
      [field]: action === 'add' 
        ? [...prev[field], value]
        : prev[field].filter(item => item !== value)
    }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Format the data for the backend
      const clientData = {
        name: formData.name,
        password: formData.password, // Include the password from the form
        contact: JSON.stringify({
          email: formData.email,
          phone: formData.phone,
          company: formData.company
        }),
        settings: JSON.stringify({
          industry: formData.industry,
          businessType: 'Business',
          website: formData.website,
          description: `Client profile for ${formData.name}`
        })
      };
      
      const response = await api.post('/clients', clientData);
      toast.success('Client created successfully!');
      navigate('/admin/clients');
    } catch (error) {
      console.error('Client creation error:', error);
      toast.error('Failed to create client. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter full name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter email address"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter password for client login"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter phone number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter company name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Industry
                </label>
                <select
                  value={formData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select industry</option>
                  <option value="Technology">Technology</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Finance">Finance</option>
                  <option value="Education">Education</option>
                  <option value="Retail">Retail</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Legal">Legal</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Enter full address"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Industry
                </label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Technology, Healthcare, Finance"
                />
              </div>
              
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target Keywords
              </label>
              <input
                type="text"
                value={formData.keywords.join(', ')}
                onChange={(e) => handleInputChange('keywords', e.target.value.split(', ').filter(s => s.trim()))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="company name, brand name, product name, services"
              />
              <p className="text-sm text-gray-400 mt-1">Separate keywords with commas</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reputation Goals
              </label>
              <input
                type="text"
                value={formData.reputationGoals.join(', ')}
                onChange={(e) => handleInputChange('reputationGoals', e.target.value.split(', ').filter(s => s.trim()))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Improve online reputation, Remove negative content, Build positive presence"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="rounded-xl p-6 border border-gray-700 bg-gray-800">
              <h3 className="text-lg font-semibold mb-4" style={{color: '#fafafa'}}>Review Client Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2" style={{color: '#f3f4f6'}}>Basic Information</h4>
                  <div className="space-y-2 text-sm">
                    <p style={{color: '#d1d5db'}}><strong style={{color: '#fafafa'}}>Name:</strong> {formData.name || 'Not provided'}</p>
                    <p style={{color: '#d1d5db'}}><strong style={{color: '#fafafa'}}>Email:</strong> {formData.email || 'Not provided'}</p>
                    <p style={{color: '#d1d5db'}}><strong style={{color: '#fafafa'}}>Password:</strong> {formData.password ? '••••••••' : 'Not set'}</p>
                    <p style={{color: '#d1d5db'}}><strong style={{color: '#fafafa'}}>Phone:</strong> {formData.phone || 'Not provided'}</p>
                    <p style={{color: '#d1d5db'}}><strong style={{color: '#fafafa'}}>Company:</strong> {formData.company || 'Not provided'}</p>
                    <p style={{color: '#d1d5db'}}><strong style={{color: '#fafafa'}}>Website:</strong> {formData.website || 'Not provided'}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2" style={{color: '#f3f4f6'}}>Reputation Profile</h4>
                  <div className="space-y-2 text-sm">
                    <p style={{color: '#d1d5db'}}><strong style={{color: '#fafafa'}}>Industry:</strong> {formData.industry || 'Not provided'}</p>
                    <p style={{color: '#d1d5db'}}><strong style={{color: '#fafafa'}}>Keywords:</strong> {formData.keywords.length > 0 ? formData.keywords.join(', ') : 'Not provided'}</p>
                    <p style={{color: '#d1d5db'}}><strong style={{color: '#fafafa'}}>Goals:</strong> {formData.reputationGoals.length > 0 ? formData.reputationGoals.join(', ') : 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="rounded-xl p-6 border border-gray-700 bg-gray-800">
              <h4 className="font-semibold mb-3" style={{color: '#fafafa'}}>What happens next?</h4>
              <ul className="text-sm space-y-2" style={{color: '#e5e7eb'}}>
                <li className="flex items-start">
                  <span className="mr-2" style={{color: '#60a5fa'}}>•</span>
                  <span>Client will be added to your dashboard</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{color: '#60a5fa'}}>•</span>
                  <span>You can start ORM scans immediately</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{color: '#60a5fa'}}>•</span>
                  <span>AI will analyze search results based on their profile</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2" style={{color: '#60a5fa'}}>•</span>
                  <span>Weekly reports will be generated automatically</span>
                </li>
              </ul>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <div className="text-gray-400">Step content coming soon...</div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-transparent rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-200">Create New Client</h1>
            <p className="text-gray-400 mt-2">Complete the wizard to add a new client to your system</p>
          </div>
          <button
            onClick={() => navigate('/admin/clients')}
            className="p-2 text-gray-400 hover:text-gray-400 hover:bg-gray-700 rounded-lg"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-300">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-sm text-gray-400">
              {Math.round((currentStep / totalSteps) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Modern Step Navigation */}
        <div className="flex items-center justify-center">
          <div className="flex items-center space-x-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                {/* Step Circle */}
                <div className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                      currentStep > step.id
                        ? 'bg-green-500 text-gray-200'
                        : currentStep === step.id
                        ? 'bg-blue-600 text-gray-200'
                        : 'bg-gray-300 text-gray-400'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      step.id
                    )}
                  </div>
                  
                  {/* Step Title */}
                  <div className="ml-3">
                    <div className={`text-sm font-medium ${
                      currentStep >= step.id ? 'text-gray-200' : 'text-gray-400'
                    }`}>
                      {step.title}
                    </div>
                    <div className={`text-xs ${
                      currentStep >= step.id ? 'text-gray-400' : 'text-gray-400'
                    }`}>
                      {step.description}
                    </div>
                  </div>
                </div>
                
                {/* Connecting Line */}
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 transition-colors duration-300 ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-transparent rounded-2xl shadow-sm border border-gray-200 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-200 mb-2">
                {steps[currentStep - 1].title}
              </h2>
              <p className="text-gray-400">{steps[currentStep - 1].description}</p>
            </div>

            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-colors ${
              currentStep === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center space-x-3">
            {currentStep < totalSteps ? (
              <button
                onClick={nextStep}
                disabled={!isStepValid()}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isStepValid()
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                    : 'bg-gray-300 text-gray-400 cursor-not-allowed'
                }`}
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !isStepValid()}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isStepValid() && !isSubmitting
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                    : 'bg-gray-300 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Create Client</span>
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

export default ClientCreationWizard;
