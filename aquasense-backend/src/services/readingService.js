const Reading    = require('../models/Reading');
const Prediction = require('../models/Prediction');
const mlService  = require('./mlService');
const alertService = require('./alertService');
const logger     = require('../utils/logger');

// Sources that come from real IoT sensors or simulator
const IOT_SOURCES = ['esp32', 'mqtt', 'simulated', 'http'];

const processReading = async (data, io = null) => {
  // 1. Persist reading — preserve exact source from payload
  const reading = await Reading.create({
    deviceId:    data.deviceId,
    ph:          data.ph,
    turbidity:   data.turbidity,
    temperature: data.temperature,
    source:      data.source || 'http',
    timestamp:   data.timestamp ? new Date(data.timestamp) : new Date(),
  });

  // 2. ML prediction
  const predictionData = await mlService.predict({
    ph:          reading.ph,
    turbidity:   reading.turbidity,
    temperature: reading.temperature,
  });

  // 3. Save prediction
  const prediction = await Prediction.create({
    readingId:    reading._id,
    deviceId:     reading.deviceId,
    qualityClass: predictionData.qualityClass,
    wqiScore:     predictionData.wqiScore,
    confidence:   predictionData.confidence,
    modelVersion: predictionData.modelVersion,
    inputFeatures: {
      ph:          reading.ph,
      turbidity:   reading.turbidity,
      temperature: reading.temperature,
    },
    timestamp: reading.timestamp,
  });

  // 4. Alert evaluation
  const alerts = await alertService.evaluateReading(reading, io);

  // 5. Real-time broadcast via Socket.io
  //    ONLY broadcast IoT/simulator readings — manual input must NOT
  //    appear in the Live Dashboard WebSocket feed
  const isIoTSource = IOT_SOURCES.includes(reading.source);
  if (io && isIoTSource) {
    const payload = {
      reading:    reading.toJSON(),
      prediction: prediction.toJSON(),
      alerts,
    };
    io.emit('sensor_update', payload);
    io.to(`device:${reading.deviceId}`).emit('device_update', payload);
  }

  logger.info(
    `Reading [${reading.source}] — device: ${reading.deviceId} | ` +
    `pH: ${reading.ph} | turbidity: ${reading.turbidity} NTU | ` +
    `temp: ${reading.temperature}°C | quality: ${prediction.qualityClass} (WQI ${prediction.wqiScore})`
  );

  return { reading, prediction, alerts };
};

module.exports = { processReading };
