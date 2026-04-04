const logger = require('../utils/logger');

/**
 * Simple API key authentication middleware.
 * Skip in development if API_KEY is not set.
 */
const apiKeyAuth = (req, res, next) => {
  if (process.env.NODE_ENV === 'development' && !process.env.API_KEY) {
    return next();
  }

  const key = req.headers['x-api-key'] || req.query.apiKey;

  if (!key || key !== process.env.API_KEY) {
    logger.warn(`Unauthorized request from ${req.ip} — invalid API key`);
    return res.status(401).json({ success: false, message: 'Unauthorized: invalid API key' });
  }

  next();
};

module.exports = { apiKeyAuth };
