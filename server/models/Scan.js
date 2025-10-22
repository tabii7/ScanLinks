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
    enum: ['manual', 'scheduled', 'automated', 'creator_scan'],
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
  parentScanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scan',
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

// Calculate duration
scanSchema.virtual('duration').get(function() {
  if (this.completedAt && this.startedAt) {
    return this.completedAt - this.startedAt;
  }
  return null;
});

module.exports = mongoose.model('Scan', scanSchema);



