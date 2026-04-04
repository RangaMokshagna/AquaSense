const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    ph: {
      type: Number,
      required: true,
      min: 0,
      max: 14,
    },
    turbidity: {
      type: Number,
      required: true,
      min: 0,         // NTU
      comment: 'Measured in NTU (Nephelometric Turbidity Units)',
    },
    temperature: {
      type: Number,
      required: true,
      min: -10,
      max: 100,       // °C
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      enum: ['mqtt', 'http', 'manual', 'simulated'],
      default: 'mqtt',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Compound index for efficient time-range queries per device
readingSchema.index({ deviceId: 1, timestamp: -1 });

// Static: hourly averages for a device over a date range
readingSchema.statics.getHourlyAverages = function (deviceId, from, to) {
  return this.aggregate([
    {
      $match: {
        deviceId,
        timestamp: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: {
          year:  { $year:  '$timestamp' },
          month: { $month: '$timestamp' },
          day:   { $dayOfMonth: '$timestamp' },
          hour:  { $hour: '$timestamp' },
        },
        avgPh:          { $avg: '$ph' },
        avgTurbidity:   { $avg: '$turbidity' },
        avgTemperature: { $avg: '$temperature' },
        count:          { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
  ]);
};

// Static: latest reading per device
readingSchema.statics.getLatestPerDevice = function () {
  return this.aggregate([
    { $sort: { timestamp: -1 } },
    { $group: { _id: '$deviceId', latest: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$latest' } },
  ]);
};

module.exports = mongoose.model('Reading', readingSchema);
