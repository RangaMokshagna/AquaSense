// MongoDB init script — runs once when the container is first created
// Creates default device config and indexes

db = db.getSiblingDB('aquasense');

// Default device configuration
db.configs.insertOne({
  deviceId:  'sensor-01',
  label:     'Main Water Tank',
  location:  'Site A',
  thresholds: {
    ph:          { min: 6.5, max: 8.5 },
    turbidity:   { max: 4.0 },
    temperature: { min: 10, max: 35 },
  },
  active:    true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Ensure indexes
db.readings.createIndex({ deviceId: 1, timestamp: -1 });
db.readings.createIndex({ timestamp: -1 });
db.predictions.createIndex({ deviceId: 1, timestamp: -1 });
db.alerts.createIndex({ deviceId: 1, resolved: 1, timestamp: -1 });

print('AquaSense DB initialized ✓');
