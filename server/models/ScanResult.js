const mongoose = require('mongoose');

const scanResultSchema = new mongoose.Schema({
  scanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scan',
    required: true,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  keywordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Keyword',
    required: true,
  },
  keyword: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  position: {
    type: Number,
    required: true,
    min: 1,
  },
  rank: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
  },
  sentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral', 'unrelated'],
    required: true,
  },
  sentimentScore: {
    type: Number,
    min: -1,
    max: 1,
  },
  movement: {
    type: String,
    enum: ['new', 'improved', 'dropped', 'disappeared', 'unchanged', 'baseline'],
    default: 'new',
  },
  previousRank: {
    type: Number,
  },
  previousSentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral', 'unrelated'],
  },
  rankingChange: {
    type: Number, // +2, -1, 0, etc.
    default: 0,
  },
  rankingDirection: {
    type: String,
    enum: ['up', 'down', 'same', 'new', 'disappeared'],
    default: 'new',
  },
  site: {
    type: String, // Extracted domain name
  },
  region: {
    type: String,
    required: true,
  },
  dateFetched: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    maxlength: 1000,
  },
  isSuppressed: {
    type: Boolean,
    default: false,
  },
  suppressionDate: {
    type: Date,
  },
});

// Index for efficient queries
scanResultSchema.index({ clientId: 1, region: 1, dateFetched: -1 });
scanResultSchema.index({ scanId: 1 });
scanResultSchema.index({ keywordId: 1 });

module.exports = mongoose.model('ScanResult', scanResultSchema);



