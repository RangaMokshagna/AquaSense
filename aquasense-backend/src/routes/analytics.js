const router = require('express').Router();
const Prediction = require('../models/Prediction');
const Alert = require('../models/Alert');
const { resolveAlerts } = require('../services/alertService');

// ════════════════════════════════════════════════════════
//  PREDICTIONS
// ════════════════════════════════════════════════════════

// GET /api/predictions — paginated, filterable
router.get('/predictions', async (req, res) => {
  try {
    const { deviceId, qualityClass, from, to, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (deviceId)     filter.deviceId = deviceId;
    if (qualityClass) filter.qualityClass = qualityClass;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to)   filter.timestamp.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      Prediction.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('readingId', 'ph turbidity temperature')
        .lean(),
      Prediction.countDocuments(filter),
    ]);

    res.json({ success: true, total, page: parseInt(page), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/predictions/stats — quality class breakdown per device
router.get('/predictions/stats', async (req, res) => {
  try {
    const { deviceId } = req.query;
    const match = deviceId ? { deviceId } : {};

    const stats = await Prediction.aggregate([
      { $match: match },
      { $group: { _id: '$qualityClass', count: { $sum: 1 }, avgWqi: { $avg: '$wqiScore' } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  ALERTS
// ════════════════════════════════════════════════════════

// GET /api/alerts
router.get('/alerts', async (req, res) => {
  try {
    const { deviceId, resolved, severity, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (deviceId) filter.deviceId = deviceId;
    if (severity) filter.severity = severity;
    if (resolved !== undefined) filter.resolved = resolved === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      Alert.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Alert.countDocuments(filter),
    ]);

    res.json({ success: true, total, page: parseInt(page), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/alerts/:id/resolve — resolve a single alert
router.patch('/alerts/:id/resolve', async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/alerts/resolve-all — bulk resolve for a device
router.post('/alerts/resolve-all', async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId required' });
    const result = await resolveAlerts(deviceId);
    res.json({ success: true, resolved: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

// ── POST /api/predictions/batch-manual ─────────────────────────────────────
// Batch predict from manual/dataset input — does NOT save to MongoDB
// Used by the Dataset Predict tab in the dashboard
router.post('/predictions/batch-manual', async (req, res) => {
  try {
    const { readings } = req.body;
    if (!readings || !Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ success: false, message: 'readings array required' });
    }
    if (readings.length > 500) {
      return res.status(400).json({ success: false, message: 'Max 500 rows per batch' });
    }

    const mlService = require('../services/mlService');
    const predictions = await Promise.all(
      readings.map(r => mlService.predict({
        ph:          parseFloat(r.ph),
        turbidity:   parseFloat(r.turbidity),
        temperature: parseFloat(r.temperature),
      }))
    );

    const formatted = predictions.map((p, i) => ({
      row:          i + 1,
      qualityClass: p.qualityClass,
      wqiScore:     p.wqiScore,
      confidence:   p.confidence,
      modelVersion: p.modelVersion,
    }));

    res.json({ success: true, count: formatted.length, predictions: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
