const router = require('express').Router();
const Config = require('../models/Config');

// GET /api/devices — list all registered device configs
router.get('/', async (req, res) => {
  try {
    const data = await Config.find().sort({ deviceId: 1 }).lean();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/devices/:deviceId
router.get('/:deviceId', async (req, res) => {
  try {
    const config = await Config.findOne({ deviceId: req.params.deviceId }).lean();
    if (!config) return res.status(404).json({ success: false, message: 'Device not found' });
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/devices — register a new device
router.post('/', async (req, res) => {
  try {
    const { deviceId, label, location, thresholds } = req.body;
    if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId is required' });

    const config = await Config.findOneAndUpdate(
      { deviceId },
      { deviceId, label, location, thresholds },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json({ success: true, data: config });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Device already registered' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/devices/:deviceId/thresholds — update alert thresholds
router.patch('/:deviceId/thresholds', async (req, res) => {
  try {
    const config = await Config.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      { $set: { thresholds: req.body } },
      { new: true, runValidators: true }
    );
    if (!config) return res.status(404).json({ success: false, message: 'Device not found' });
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
