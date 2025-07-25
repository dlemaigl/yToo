const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Import middleware
const { attachWebSocketService } = require('./middleware/websocket');

// Import routes
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const protectedRoutes = require('./routes/protected-example');
const websocketRoutes = require('./routes/websocket');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(attachWebSocketService);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/websocket', websocketRoutes);
app.use('/api', protectedRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

module.exports = app;