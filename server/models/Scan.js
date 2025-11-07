const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  clientName: {
    type: String,
    required: false,
  },
  weekNumber: {
    type: Number,
    required: true,
  },
  region: {
    type: String,
    required: true,
    enum: ['US', 'UK', 'UAE', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL'],
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  },
  clientStatus: {
    type: String,
    enum: ['not_sent', 'sent', 'viewed'],
    default: 'not_sent',
  },
  scanType: {
    type: String,
    enum: ['manual', 'scheduled', 'automated', 'creator_scan', 'auto'],
    default: 'automated',
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
  sentToClientAt: {
    type: Date,
  },
  viewedByClientAt: {
    type: Date,
  },
  autoScanEnabled: {
    type: Boolean,
    default: false,
  },
  nextAutoScanDate: {
    type: Date,
  },
  // Self-relation: Parent-Child relationship
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scan',
    default: null, // null = parent scan, ObjectId = child scan
  },
  // Store the actual search query used
  searchQuery: {
    type: String,
    required: true,
  },
  // CRITICAL: Store exact Google query and dateRestrict for child scan inheritance
  exactGoogleQuery: {
    type: String,
    required: false,
  },
  exactDateRestrict: {
    type: String,
    required: false,
  },
  timeFrame: {
    type: String,
    required: false,
  },
  contentType: {
    type: String,
    required: false,
  },
  totalKeywords: {
    type: Number,
    default: 0,
  },
  processedKeywords: {
    type: Number,
    default: 0,
  },
  resultsCount: {
    type: Number,
    default: 0,
  },
  errors: [{
    keyword: String,
    error: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  metadata: {
    userAgent: String,
    ipAddress: String,
    version: String,
  },
});

// Safety: hard-block non-manual scans when DISABLE_AUTO_SCANS=true
scanSchema.pre('save', function(next) {
  try {
    if (process.env.DISABLE_AUTO_SCANS === 'true' && this.scanType && this.scanType !== 'manual') {
      return next(new Error('Auto scans are disabled by configuration'));
    }
    return next();
  } catch (e) {
    return next(e);
  }
});

// Calculate duration
scanSchema.virtual('duration').get(function() {
  if (this.completedAt && this.startedAt) {
    return this.completedAt - this.startedAt;
  }
  return null;
});

module.exports = mongoose.model('Scan', scanSchema);



