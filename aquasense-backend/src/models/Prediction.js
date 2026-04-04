const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema(
  {
    readingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reading',
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    qualityClass: {
      type: String,
      // WHO / standard WQI classes
      enum: ['Excellent', 'Good', 'Poor', 'Very Poor', 'Unsafe'],
      required: true,
    },
    wqiScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
      comment: 'Water Quality Index — higher is better',
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      comment: 'Model confidence 0–1',
    },
    modelVersion: {
      type: String,
      default: '1.0.0',
    },
    inputFeatures: {
      ph:          Number,
      turbidity:   Number,
      temperature: Number,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

predictionSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('Prediction', predictionSchema);
