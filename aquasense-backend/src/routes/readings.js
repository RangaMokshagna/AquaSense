const router = require('express').Router();
const Reading = require('../models/Reading');
const { processReading } = require('../services/readingService');

const IOT_SOURCES = ['esp32', 'mqtt', 'simulated', 'http'];

// ── GET /api/readings ──────────────────────────────────────────────────────
// Query params: deviceId, from, to, limit, page, iotOnly (default true)
router.get('/', async (req, res) => {
  try {
    const { deviceId, from, to, limit = 100, page = 1, iotOnly } = req.query;
    const filter = {};

    if (deviceId) filter.deviceId = deviceId;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to)   filter.timestamp.$lte = new Date(to);
    }

    // By default exclude manual/dataset readings from the API
    // Pass iotOnly=false explicitly to get all readings (used by History tab)
    if (iotOnly !== 'false') {
      filter.source = { $in: IOT_SOURCES };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      Reading.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Reading.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page:    parseInt(page),
      pages:   Math.ceil(total / parseInt(limit)),
      data,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/readings/latest ───────────────────────────────────────────────
router.get('/latest', async (req, res) => {
  try {
    const data = await Reading.getLatestPerDevice();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/readings/averages ─────────────────────────────────────────────
router.get('/averages', async (req, res) => {
  try {
    const { deviceId, from, to } = req.query;
    if (!deviceId || !from || !to) {
      return res.status(400).json({ success: false, message: 'deviceId, from, and to are required' });
    }
    const data = await Reading.getHourlyAverages(deviceId, from, to);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/readings/:id ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const reading = await Reading.findById(req.params.id).lean();
    if (!reading) return res.status(404).json({ success: false, message: 'Reading not found' });
    res.json({ success: true, data: reading });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/readings ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { deviceId, ph, turbidity, temperature, timestamp, source } = req.body;

    if (!deviceId || ph == null || turbidity == null || temperature == null) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: deviceId, ph, turbidity, temperature',
      });
    }

    const io = req.app.get('io');
    const result = await processReading(
      { deviceId, ph, turbidity, temperature, timestamp, source: source || 'http' },
      io
    );

    res.status(201).json({
      success:    true,
      reading:    result.reading,
      prediction: result.prediction,
      alerts:     result.alerts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
