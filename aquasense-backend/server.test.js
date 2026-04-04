/**
 * AquaSense Backend — Integration Tests
 * Run: npm test
 *
 * Uses supertest to hit the Express app in-process.
 * MongoDB is mocked via jest.mock so no live DB is needed.
 */

const request = require('supertest');

// ── Mock heavy dependencies before importing server ──────────────────────
jest.mock('./src/config/db', () => jest.fn().mockResolvedValue(undefined));
jest.mock('./src/services/mqttService', () => ({ connect: jest.fn(), disconnect: jest.fn() }));

jest.mock('./src/models/Reading', () => {
  const mockReading = {
    _id:         'reading-001',
    deviceId:    'test-sensor',
    ph:          7.2,
    turbidity:   1.5,
    temperature: 24.0,
    source:      'http',
    timestamp:   new Date(),
    toJSON()     { return this; },
  };

  const Model = jest.fn(() => mockReading);
  Model.create       = jest.fn().mockResolvedValue(mockReading);
  Model.find         = jest.fn().mockReturnValue({
    sort:  jest.fn().mockReturnThis(),
    skip:  jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean:  jest.fn().mockResolvedValue([mockReading]),
  });
  Model.findById     = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockReading) });
  Model.countDocuments = jest.fn().mockResolvedValue(1);
  Model.getLatestPerDevice = jest.fn().mockResolvedValue([mockReading]);
  Model.getHourlyAverages  = jest.fn().mockResolvedValue([]);
  return Model;
});

jest.mock('./src/models/Prediction', () => {
  const mockPrediction = {
    _id:          'pred-001',
    readingId:    'reading-001',
    deviceId:     'test-sensor',
    qualityClass: 'Good',
    wqiScore:     78,
    confidence:   0.92,
    modelVersion: '1.0.0',
    timestamp:    new Date(),
    toJSON()      { return this; },
  };
  const Model = jest.fn(() => mockPrediction);
  Model.create         = jest.fn().mockResolvedValue(mockPrediction);
  Model.find           = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([mockPrediction]),
  });
  Model.countDocuments = jest.fn().mockResolvedValue(1);
  Model.aggregate      = jest.fn().mockResolvedValue([]);
  return Model;
});

jest.mock('./src/models/Alert', () => {
  const Model = jest.fn();
  Model.create         = jest.fn().mockResolvedValue({ toJSON: () => ({}) });
  Model.find           = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]),
  });
  Model.countDocuments = jest.fn().mockResolvedValue(0);
  Model.updateMany     = jest.fn().mockResolvedValue({ modifiedCount: 0 });
  Model.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
  return Model;
});

jest.mock('./src/models/Config', () => {
  const Model = jest.fn();
  Model.find            = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) });
  Model.findOne         = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
  Model.findOneAndUpdate= jest.fn().mockResolvedValue({ deviceId: 'test-sensor', thresholds: {} });
  Model.getThresholds   = jest.fn().mockResolvedValue({
    ph:          { min: 6.5, max: 8.5 },
    turbidity:   { max: 4.0 },
    temperature: { min: 10, max: 35 },
  });
  return Model;
});

jest.mock('./src/services/mlService', () => ({
  predict: jest.fn().mockResolvedValue({
    qualityClass: 'Good',
    wqiScore:     78,
    confidence:   0.92,
    modelVersion: '1.0.0',
  }),
}));

// ── Load app after mocks ──────────────────────────────────────────────────
process.env.NODE_ENV   = 'test';
process.env.PORT       = '5001';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';

// We require the server but capture it before it calls listen
let app;
beforeAll(() => {
  // Require here so mocks are already in place
  const express      = require('express');
  const cors         = require('cors');
  const readingsRouter  = require('./src/routes/readings');
  const analyticsRouter = require('./src/routes/analytics');
  const devicesRouter   = require('./src/routes/devices');

  app = express();
  app.use(express.json());
  app.use(cors());
  app.set('io', { emit: jest.fn(), to: jest.fn().mockReturnValue({ emit: jest.fn() }) });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/readings',  readingsRouter);
  app.use('/api',           analyticsRouter);
  app.use('/api/devices',   devicesRouter);
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Health check', () => {
  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/readings', () => {
  const validPayload = {
    deviceId: 'test-sensor',
    ph: 7.2,
    turbidity: 1.5,
    temperature: 24.0,
  };

  it('accepts a valid reading and returns 201', async () => {
    const res = await request(app).post('/api/readings').send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.reading).toBeDefined();
    expect(res.body.prediction).toBeDefined();
    expect(res.body.prediction.qualityClass).toBe('Good');
    expect(res.body.prediction.wqiScore).toBe(78);
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/api/readings').send({ deviceId: 'test-sensor' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects empty body with 400', async () => {
    const res = await request(app).post('/api/readings').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/readings', () => {
  it('returns paginated readings', async () => {
    const res = await request(app).get('/api/readings');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('supports deviceId filter', async () => {
    const res = await request(app).get('/api/readings?deviceId=test-sensor');
    expect(res.status).toBe(200);
  });

  it('returns latest readings per device', async () => {
    const res = await request(app).get('/api/readings/latest');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('validates averages requires deviceId', async () => {
    const res = await request(app).get('/api/readings/averages?from=2024-01-01&to=2024-01-31');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/predictions', () => {
  it('returns predictions list', async () => {
    const res = await request(app).get('/api/predictions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/alerts', () => {
  it('returns alerts list', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/devices', () => {
  it('returns device list', async () => {
    const res = await request(app).get('/api/devices');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
