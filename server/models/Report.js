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
    enum: ['weekly', 'weekly_comparison', 'monthly', 'custom'],
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
  // 🎯 NEW: Support for multiple weeks in one report
  weeks: [{
    weekNumber: {
      type: Number,
      required: true,
    },
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scan',
      required: true,
    },
    completedAt: {
      type: Date,
      required: true,
    },
    resultsCount: {
      type: Number,
      default: 0,
    },
    summary: {
      type: Object,
      default: {}
    }
  }],
  
  // 🎯 NEW: Weekly comparison data
  comparisonData: {
    previousWeek: {
      weekNumber: Number,
      scanId: mongoose.Schema.Types.ObjectId,
      resultsCount: Number,
      summary: Object
    },
    currentWeek: {
      weekNumber: Number,
      scanId: mongoose.Schema.Types.ObjectId,
      resultsCount: Number,
      summary: Object
    },
    changes: {
      newResults: Number,
      disappearedResults: Number,
      commonResults: Number,
      totalChange: Number
    },
    movement: {
      improved: Number,
      dropped: Number,
      unchanged: Number,
      new: Number,
      disappeared: Number
    },
    sentimentChanges: [{
      url: String,
      previousSentiment: String,
      currentSentiment: String,
      sentimentChange: Boolean
    }],
    rankingChanges: [{
      url: String,
      previousRank: Number,
      currentRank: Number,
      rankChange: Number,
      movement: String
    }]
  },
  
  // Dynamic fields for each week's data
  // week2Summary, week3Summary, etc. will be added dynamically
  // week2Charts, week3Charts, etc. will be added dynamically
});

// Index for efficient queries
reportSchema.index({ clientId: 1, weekNumber: -1 });
reportSchema.index({ scanId: 1 });
reportSchema.index({ generatedAt: -1 });

module.exports = mongoose.model('Report', reportSchema);



