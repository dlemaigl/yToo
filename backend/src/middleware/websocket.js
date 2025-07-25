// Middleware to attach WebSocket service to requests
const attachWebSocketService = (req, res, next) => {
  req.websocketService = req.app.get('websocketService');
  req.socketServer = req.app.get('socketServer');
  next();
};

module.exports = {
  attachWebSocketService
};