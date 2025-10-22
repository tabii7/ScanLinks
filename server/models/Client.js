const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  logo: {
    type: String, // URL or file path
    default: null,
  },
  contact: {
    email: {
      type: String,
      required: false,
      default: '',
      sparse: true, // This allows multiple null/empty values
    },
    phone: {
      type: String,
    },
    company: {
      type: String,
    },
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  settings: {
    industry: {
      type: String,
      default: '',
    },
    businessType: {
      type: String,
      default: '',
    },
    targetAudience: {
      type: String,
      default: '',
    },
    website: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    autoScan: {
      type: Boolean,
      default: true,
    },
    scanFrequency: {
      type: String,
      enum: ['weekly', 'bi-weekly', 'monthly'],
      default: 'weekly',
    },
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      reports: {
        type: Boolean,
        default: true,
      },
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
clientSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Client', clientSchema);



