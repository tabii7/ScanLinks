const express = require('express');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get available regions
router.get('/', adminAuth, async (req, res) => {
  try {
    const regions = [
      { code: 'US', name: 'United States', flag: '🇺🇸' },
      { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
      { code: 'UAE', name: 'United Arab Emirates', flag: '🇦🇪' },
      { code: 'CA', name: 'Canada', flag: '🇨🇦' },
      { code: 'AU', name: 'Australia', flag: '🇦🇺' },
      { code: 'DE', name: 'Germany', flag: '🇩🇪' },
      { code: 'FR', name: 'France', flag: '🇫🇷' },
      { code: 'IT', name: 'Italy', flag: '🇮🇹' },
      { code: 'ES', name: 'Spain', flag: '🇪🇸' },
      { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
    ];

    res.json(regions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;



