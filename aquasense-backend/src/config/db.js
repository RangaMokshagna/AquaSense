const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aquasense';

  const options = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  let retries = 5;

  while (retries > 0) {
    try {
      await mongoose.connect(uri, options);
      logger.info(`MongoDB connected: ${mongoose.connection.host}`);

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected — attempting reconnect...');
      });

      mongoose.connection.on('error', (err) => {
        logger.error(`MongoDB error: ${err.message}`);
      });

      return;
    } catch (err) {
      retries -= 1;
      logger.error(`MongoDB connection failed (${retries} retries left): ${err.message}`);
      if (retries === 0) {
        logger.error('MongoDB connection exhausted. Exiting.');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
};

module.exports = connectDB;
