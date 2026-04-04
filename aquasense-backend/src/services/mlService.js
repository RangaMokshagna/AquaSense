const axios = require('axios');
const logger = require('../utils/logger');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Request a water quality prediction from the Python ML service.
 * Falls back to a rule-based score if the service is unreachable.
 *
 * @param {{ ph: number, turbidity: number, temperature: number }} features
 * @returns {Promise<{ qualityClass: string, wqiScore: number, confidence: number, modelVersion: string }>}
 */
const predict = async ({ ph, turbidity, temperature }) => {
  try {
    const { data } = await axios.post(
      `${ML_URL}/predict`,
      { ph, turbidity, temperature },
      { timeout: 5000 }
    );

    return {
      qualityClass:  data.quality_class,
      wqiScore:      data.wqi_score,
      confidence:    data.confidence,
      modelVersion:  data.model_version || '1.0.0',
    };
  } catch (err) {
    logger.warn(`ML service unavailable (${err.message}). Using fallback scorer.`);
    return fallbackScore({ ph, turbidity, temperature });
  }
};

/**
 * Simple rule-based fallback when ML service is down.
 * Uses WHO drinking-water guideline thresholds.
 */
const fallbackScore = ({ ph, turbidity, temperature }) => {
  let score = 100;

  // pH penalty (optimal 6.5–8.5)
  if (ph < 6.5 || ph > 8.5) score -= 20;
  if (ph < 6.0 || ph > 9.0) score -= 20;

  // Turbidity penalty (WHO: <1 NTU ideal, <4 NTU acceptable)
  if (turbidity > 1)  score -= 10;
  if (turbidity > 4)  score -= 20;
  if (turbidity > 10) score -= 20;

  // Temperature penalty
  if (temperature < 10 || temperature > 35) score -= 10;
  if (temperature < 5  || temperature > 40) score -= 15;

  score = Math.max(0, score);

  let qualityClass;
  if (score >= 90)      qualityClass = 'Excellent';
  else if (score >= 70) qualityClass = 'Good';
  else if (score >= 50) qualityClass = 'Poor';
  else if (score >= 25) qualityClass = 'Very Poor';
  else                  qualityClass = 'Unsafe';

  return { qualityClass, wqiScore: score, confidence: null, modelVersion: 'fallback' };
};

module.exports = { predict };
