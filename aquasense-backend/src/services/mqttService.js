const mqtt = require('mqtt');
const logger = require('../utils/logger');
const { processReading } = require('./readingService');

let client = null;

const TOPIC = process.env.MQTT_TOPIC_SENSORS || 'aquasense/sensors/#';

/**
 * Connect to MQTT broker and subscribe to sensor topics.
 * Expected payload format:
 *   { "deviceId": "sensor-01", "ph": 7.2, "turbidity": 1.5, "temperature": 24.3 }
 *
 * @param {Object} io - Socket.io server instance
 */
const connect = (io) => {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

  const options = {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  };

  client = mqtt.connect(brokerUrl, options);

  client.on('connect', () => {
    logger.info(`MQTT connected to ${brokerUrl}`);
    client.subscribe(TOPIC, { qos: 1 }, (err) => {
      if (err) logger.error(`MQTT subscribe error: ${err.message}`);
      else logger.info(`MQTT subscribed to topic: ${TOPIC}`);
    });
  });

  client.on('message', async (topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());

      if (!data.deviceId || data.ph == null || data.turbidity == null || data.temperature == null) {
        logger.warn(`MQTT: malformed payload on topic ${topic}: ${payload.toString()}`);
        return;
      }

      logger.debug(`MQTT message [${topic}]: pH=${data.ph} turb=${data.turbidity} temp=${data.temperature}`);

      await processReading({ ...data, source: 'mqtt' }, io);
    } catch (err) {
      logger.error(`MQTT message parse error: ${err.message}`);
    }
  });

  client.on('error', (err) => logger.error(`MQTT error: ${err.message}`));
  client.on('offline', ()  => logger.warn('MQTT client offline'));
  client.on('reconnect', ()=> logger.info('MQTT reconnecting...'));
};

const disconnect = () => {
  if (client) {
    client.end();
    logger.info('MQTT disconnected');
  }
};

module.exports = { connect, disconnect };
