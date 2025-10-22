const express = require('express');
const Keyword = require('../models/Keyword');
const { adminAuth, clientAuth } = require('../middleware/auth');

const router = express.Router();

// Get all keywords (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const { clientId, status, region } = req.query;
    const filters = {};
    
    if (clientId) filters.clientId = clientId;
    if (status) filters.status = status;
    if (region) filters.targetRegions = region;
    
    const keywords = await Keyword.find(filters)
      .populate('clientId', 'name')
      .sort({ createdAt: -1 });
    
    res.json(keywords);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all keywords for a client (admin)
router.get('/client/:clientId', adminAuth, async (req, res) => {
  try {
    const keywords = await Keyword.find({ clientId: req.params.clientId })
      .sort({ createdAt: -1 });
    res.json(keywords);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get keywords for current client
router.get('/my-keywords', clientAuth, async (req, res) => {
  try {
    const keywords = await Keyword.find({ clientId: req.user.clientId })
      .sort({ createdAt: -1 });
    res.json(keywords);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single keyword
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const keyword = await Keyword.findById(req.params.id);
    if (!keyword) {
      return res.status(404).json({ message: 'Keyword not found' });
    }
    res.json(keyword);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new keyword
router.post('/', adminAuth, async (req, res) => {
  try {
    const { clientId, keyword, targetRegions, priority, notes } = req.body;

    const keywordData = {
      clientId,
      keyword,
      targetRegions: targetRegions || [],
      priority: priority || 'medium',
      notes,
    };

    const newKeyword = new Keyword(keywordData);
    await newKeyword.save();

    res.status(201).json({ message: 'Keyword created successfully', keyword: newKeyword });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update keyword
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const keyword = await Keyword.findById(req.params.id);
    if (!keyword) {
      return res.status(404).json({ message: 'Keyword not found' });
    }

    const { keyword: keywordText, targetRegions, priority, notes, status } = req.body;

    if (keywordText) keyword.keyword = keywordText;
    if (targetRegions) keyword.targetRegions = targetRegions;
    if (priority) keyword.priority = priority;
    if (notes !== undefined) keyword.notes = notes;
    if (status) keyword.status = status;

    await keyword.save();
    res.json({ message: 'Keyword updated successfully', keyword });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete keyword
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const keyword = await Keyword.findById(req.params.id);
    if (!keyword) {
      return res.status(404).json({ message: 'Keyword not found' });
    }

    await Keyword.findByIdAndDelete(req.params.id);
    res.json({ message: 'Keyword deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk create keywords
router.post('/bulk', adminAuth, async (req, res) => {
  try {
    const { clientId, keywords } = req.body;

    if (!Array.isArray(keywords)) {
      return res.status(400).json({ message: 'Keywords must be an array' });
    }

    const keywordData = keywords.map(kw => ({
      clientId,
      keyword: kw.keyword,
      targetRegions: kw.targetRegions || [],
      priority: kw.priority || 'medium',
      notes: kw.notes,
    }));

    const createdKeywords = await Keyword.insertMany(keywordData);
    res.status(201).json({ 
      message: `${createdKeywords.length} keywords created successfully`, 
      keywords: createdKeywords 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update keyword status
router.patch('/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'inactive', 'paused'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const keyword = await Keyword.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!keyword) {
      return res.status(404).json({ message: 'Keyword not found' });
    }

    res.json({ message: 'Keyword status updated', keyword });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;



