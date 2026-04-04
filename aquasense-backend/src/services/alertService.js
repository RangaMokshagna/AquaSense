const Alert = require('../models/Alert');
const Config = require('../models/Config');
const logger = require('../utils/logger');

/**
 * Evaluate a sensor reading against configured thresholds.
 * Creates Alert documents for any violations and returns them.
 *
 * @param {Object} reading  - Mongoose Reading document
 * @param {Object} io       - Socket.io server instance (optional)
 * @returns {Promise<Alert[]>} newly created alerts
 */
const evaluateReading = async (reading, io = null) => {
  const thresholds = await Config.getThresholds(reading.deviceId);
  const alerts = [];

  const checks = [
    {
      condition: reading.ph < thresholds.ph.min,
      type:      'ph_low',
      severity:  reading.ph < thresholds.ph.min - 1 ? 'critical' : 'warning',
      parameter: 'ph',
      value:     reading.ph,
      threshold: thresholds.ph.min,
      message:   `pH too low: ${reading.ph.toFixed(2)} (min: ${thresholds.ph.min})`,
    },
    {
      condition: reading.ph > thresholds.ph.max,
      type:      'ph_high',
      severity:  reading.ph > thresholds.ph.max + 1 ? 'critical' : 'warning',
      parameter: 'ph',
      value:     reading.ph,
      threshold: thresholds.ph.max,
      message:   `pH too high: ${reading.ph.toFixed(2)} (max: ${thresholds.ph.max})`,
    },
    {
      condition: reading.turbidity > thresholds.turbidity.max,
      type:      'turbidity_high',
      severity:  reading.turbidity > thresholds.turbidity.max * 2.5 ? 'critical' : 'warning',
      parameter: 'turbidity',
      value:     reading.turbidity,
      threshold: thresholds.turbidity.max,
      message:   `Turbidity too high: ${reading.turbidity.toFixed(2)} NTU (max: ${thresholds.turbidity.max})`,
    },
    {
      condition: reading.temperature < thresholds.temperature.min,
      type:      'temp_low',
      severity:  'warning',
      parameter: 'temperature',
      value:     reading.temperature,
      threshold: thresholds.temperature.min,
      message:   `Temperature too low: ${reading.temperature.toFixed(1)}°C (min: ${thresholds.temperature.min}°C)`,
    },
    {
      condition: reading.temperature > thresholds.temperature.max,
      type:      'temp_high',
      severity:  reading.temperature > thresholds.temperature.max + 5 ? 'critical' : 'warning',
      parameter: 'temperature',
      value:     reading.temperature,
      threshold: thresholds.temperature.max,
      message:   `Temperature too high: ${reading.temperature.toFixed(1)}°C (max: ${thresholds.temperature.max}°C)`,
    },
  ];

  for (const check of checks) {
    if (!check.condition) continue;

    const alert = await Alert.create({
      deviceId:  reading.deviceId,
      readingId: reading._id,
      type:      check.type,
      severity:  check.severity,
      parameter: check.parameter,
      value:     check.value,
      threshold: check.threshold,
      message:   check.message,
    });

    alerts.push(alert);
    logger.warn(`ALERT [${check.severity.toUpperCase()}] ${reading.deviceId}: ${check.message}`);

    if (io) {
      io.emit('alert', alert.toJSON());
    }
  }

  return alerts;
};

/**
 * Mark all unresolved alerts for a device as resolved.
 */
const resolveAlerts = async (deviceId, types = []) => {
  const query = { deviceId, resolved: false };
  if (types.length > 0) query.type = { $in: types };

  return Alert.updateMany(query, {
    resolved: true,
    resolvedAt: new Date(),
  });
};

module.exports = { evaluateReading, resolveAlerts };
