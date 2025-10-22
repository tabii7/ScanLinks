const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  scanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scan',
    required: true,
  },
  weekNumber: {
    type: Number,
    required: true,
  },
  region: {
    type: String,
    required: true,
  },
  reportType: {
    type: String,
    enum: ['weekly', 'monthly', 'custom'],
    default: 'weekly',
  },
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed'],
    default: 'generating',
  },
  summary: {
    totalLinks: {
      type: Number,
      default: 0,
    },
    positiveLinks: {
      type: Number,
      default: 0,
    },
    negativeLinks: {
      type: Number,
      default: 0,
    },
    neutralLinks: {
      type: Number,
      default: 0,
    },
    newLinks: {
      type: Number,
      default: 0,
    },
    improvedLinks: {
      type: Number,
      default: 0,
    },
    droppedLinks: {
      type: Number,
      default: 0,
    },
    suppressedLinks: {
      type: Number,
      default: 0,
    },
  },
  aiSummary: {
    type: String,
    maxlength: 2000,
  },
  charts: {
    sentimentDistribution: {
      type: Object,
    },
    rankingTrends: {
      type: Object,
    },
    movementAnalysis: {
      type: Object,
    },
  },
  files: {
    pdf: {
      path: String,
      url: String,
      size: Number,
    },
    excel: {
      path: String,
      url: String,
      size: Number,
    },
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    },
  },
});

// Index for efficient queries
reportSchema.index({ clientId: 1, weekNumber: -1 });
reportSchema.index({ scanId: 1 });
reportSchema.index({ generatedAt: -1 });

module.exports = mongoose.model('Report', reportSchema);



