const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['ph_high', 'ph_low', 'turbidity_high', 'temp_high', 'temp_low', 'quality_poor', 'quality_unsafe'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['warning', 'critical'],
      required: true,
    },
    parameter: {
      type: String,
      enum: ['ph', 'turbidity', 'temperature', 'qualityClass'],
      required: true,
    },
    value: {
      type: Number,
    },
    threshold: {
      type: Number,
    },
    message: {
      type: String,
      required: true,
    },
    readingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reading',
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

alertSchema.index({ deviceId: 1, resolved: 1, timestamp: -1 });

module.exports = mongoose.model('Alert', alertSchema);
