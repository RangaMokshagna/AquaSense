const mongoose = require('mongoose');

const configSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    label: {
      type: String,
      default: 'Sensor Device',
    },
    location: {
      type: String,
      default: '',
    },
    thresholds: {
      ph: {
        min: { type: Number, default: 6.5 },
        max: { type: Number, default: 8.5 },
      },
      turbidity: {
        max: { type: Number, default: 4.0 },   // NTU — WHO drinking water standard
      },
      temperature: {
        min: { type: Number, default: 10 },
        max: { type: Number, default: 35 },
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Return thresholds or fall back to .env defaults
configSchema.statics.getThresholds = async function (deviceId) {
  const config = await this.findOne({ deviceId });
  if (config) return config.thresholds;

  return {
    ph: {
      min: parseFloat(process.env.DEFAULT_PH_MIN) || 6.5,
      max: parseFloat(process.env.DEFAULT_PH_MAX) || 8.5,
    },
    turbidity: {
      max: parseFloat(process.env.DEFAULT_TURBIDITY_MAX) || 4.0,
    },
    temperature: {
      min: parseFloat(process.env.DEFAULT_TEMP_MIN) || 10,
      max: parseFloat(process.env.DEFAULT_TEMP_MAX) || 35,
    },
  };
};

module.exports = mongoose.model('Config', configSchema);
