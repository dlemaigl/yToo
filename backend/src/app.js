const express = require('express');
const cors = require('cors');

// Import logging and monitoring
const { requestLogger } = require('./config/logger');
const { monitoring, errorMonitoringMiddleware, requestMetricsMiddleware } = require('./config/monitoring');

// Import security middleware
const { securityHeaders, corsOptions, additionalSecurity, securityLogger, validateInput } = require('./middleware/security');
const { sanitizeInput, validateContentType, validateRequestSize } = require('./middleware/validation');
const { applyRateLimit } = require('./middleware/rateLimiting');

// Import other middleware
const { attachWebSocketService } = require('./middleware/websocket');

// Import routes
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const activitiesRoutes = require('./routes/activities');
const protectedRoutes = require('./routes/protected-example');
const websocketRoutes = require('./routes/websocket');

const app = express();

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// Monitoring and logging middleware (applied early)
app.use(requestLogger);
app.use(requestMetricsMiddleware);

// Security middleware (applied in order)
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(additionalSecurity);
app.use(securityLogger);
app.use(validateInput);
app.use(validateContentType);
app.use(validateRequestSize);
app.use(sanitizeInput);

// General rate limiting
app.use(applyRateLimit('general'));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// WebSocket service attachment
app.use(attachWebSocketService);

// Routes with specific rate limiting
app.use('/api/auth', applyRateLimit('auth'), authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/websocket', websocketRoutes);
app.use('/api', protectedRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await monitoring.getSystemHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint (production only)
app.get('/metrics', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  // Basic metrics in Prometheus format
  const metrics = [];
  const recentMetrics = monitoring.getRecentMetrics('http_request_count', 1000);
  
  // Add basic metrics
  metrics.push(`# HELP http_requests_total Total HTTP requests`);
  metrics.push(`# TYPE http_requests_total counter`);
  
  const requestCounts = {};
  recentMetrics.forEach(metric => {
    const key = `${metric.tags.method}_${metric.tags.statusCode}`;
    requestCounts[key] = (requestCounts[key] || 0) + metric.value;
  });
  
  Object.entries(requestCounts).forEach(([key, count]) => {
    const [method, statusCode] = key.split('_');
    metrics.push(`http_requests_total{method="${method}",status="${statusCode}"} ${count}`);
  });
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics.join('\n'));
});

// Error handling middleware (must be last)
app.use(errorMonitoringMiddleware);

module.exports = app;