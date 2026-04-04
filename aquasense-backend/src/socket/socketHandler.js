const logger = require('../utils/logger');

/**
 * Register Socket.io event handlers.
 * The React dashboard connects here for live sensor updates.
 */
const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    const clientIp = socket.handshake.address;
    logger.info(`Socket connected: ${socket.id} from ${clientIp}`);

    // Client can subscribe to a specific device's room
    socket.on('subscribe_device', (deviceId) => {
      socket.join(`device:${deviceId}`);
      logger.debug(`Socket ${socket.id} subscribed to device: ${deviceId}`);
      socket.emit('subscribed', { deviceId });
    });

    socket.on('unsubscribe_device', (deviceId) => {
      socket.leave(`device:${deviceId}`);
      logger.debug(`Socket ${socket.id} unsubscribed from device: ${deviceId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} — ${reason}`);
    });

    // Ping/pong for connection health checks from the dashboard
    socket.on('ping_check', () => {
      socket.emit('pong_check', { serverTime: new Date().toISOString() });
    });
  });
};

module.exports = { registerSocketHandlers };
