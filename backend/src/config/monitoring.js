const { logger } = require('./logger');
const db = require('./database');

/**
 * Production monitoring and metrics collection
 */

class MonitoringService {
  constructor() {
    this.metrics = new Map();
    this.isProduction = process.env.NODE_ENV === 'production';
    this.isTest = process.env.NODE_ENV === 'test';
    
    // Start periodic monitoring if in production
    if (this.isProduction && !this.isTest) {
      this.startPeriodicMonitoring();
    }
  }

  // Record a metric value
  recordMetric(name, value, unit = '', tags = {}) {
    const metric = {
      name,
      value,
      unit,
      tags,
      timestamp: new Date()
    };

    // Store in memory for immediate access
    this.metrics.set(`${name}_${Date.now()}`, metric);

    // Log the metric
    logger.debug(`Metric recorded: ${name}`, metric);

    // Store in database for persistence (async, don't wait)
    if (this.isProduction && !this.isTest) {
      this.storeMetricInDatabase(metric).catch(error => {
        logger.debug('Failed to store metric in database', { error: error.message, metric });
      });
    }
  }

  // Store metric in database
  async storeMetricInDatabase(metric) {
    try {
      // Check if we're in test environment or if the table exists
      if (process.env.NODE_ENV === 'test') {
        return; // Skip database storage in tests
      }
      
      await db.query(`
        INSERT INTO system_metrics (metric_name, metric_value, metric_unit, tags, recorded_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        metric.name,
        metric.value,
        metric.unit,
        JSON.stringify(metric.tags),
        metric.timestamp
      ]);
    } catch (error) {
      // Don't throw, just log - monitoring shouldn't break the app
      logger.debug('Database metric storage failed', { error: error.message });
    }
  }

  // Get system health metrics
  async getSystemHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      environment: process.env.NODE_ENV,
      version: process.version
    };

    try {
      // Test database connection
      const dbStart = Date.now();
      await db.query('SELECT 1');
      health.database = {
        status: 'connected',
        responseTime: Date.now() - dbStart
      };
    } catch (error) {
      health.database = {
        status: 'error',
        error: error.message
      };
      health.status = 'unhealthy';
    }

    try {
      // Get database statistics
      const stats = await this.getDatabaseStats();
      health.database.stats = stats;
    } catch (error) {
      logger.warn('Failed to get database stats', { error: error.message });
    }

    // Record health check metric
    this.recordMetric('health_check', health.status === 'healthy' ? 1 : 0, 'boolean');

    return health;
  }

  // Get database statistics
  async getDatabaseStats() {
    try {
      const queries = [
        { name: 'user_count', query: 'SELECT COUNT(*) as count FROM users' },
        { name: 'group_count', query: 'SELECT COUNT(*) as count FROM groups' },
        { name: 'activity_count', query: 'SELECT COUNT(*) as count FROM activities' },
        { name: 'vote_count', query: 'SELECT COUNT(*) as count FROM votes' },
        { name: 'active_groups', query: 'SELECT COUNT(DISTINCT group_id) as count FROM activities WHERE created_at > NOW() - INTERVAL \'24 hours\'' }
      ];

      const stats = {};
      for (const { name, query } of queries) {
        const result = await db.query(query);
        stats[name] = parseInt(result.rows[0].count);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get database stats', { error: error.message });
      return {};
    }
  }

  // Monitor application performance
  startPeriodicMonitoring() {
    // Monitor every 5 minutes
    setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        logger.error('Periodic monitoring failed', { error: error.message });
      }
    }, 5 * 60 * 1000);

    logger.info('Periodic monitoring started');
  }

  // Collect system metrics
  async collectSystemMetrics() {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();

    // Memory metrics
    this.recordMetric('memory_used', memory.heapUsed, 'bytes');
    this.recordMetric('memory_total', memory.heapTotal, 'bytes');
    this.recordMetric('memory_external', memory.external, 'bytes');

    // CPU metrics
    this.recordMetric('cpu_user', cpu.user, 'microseconds');
    this.recordMetric('cpu_system', cpu.system, 'microseconds');

    // Uptime
    this.recordMetric('uptime', process.uptime(), 'seconds');

    // Database connection pool stats (if available)
    try {
      const poolStats = await db.getPoolStats();
      if (poolStats) {
        this.recordMetric('db_pool_total', poolStats.totalCount, 'connections');
        this.recordMetric('db_pool_idle', poolStats.idleCount, 'connections');
        this.recordMetric('db_pool_waiting', poolStats.waitingCount, 'connections');
      }
    } catch (error) {
      // Pool stats might not be available
    }

    logger.debug('System metrics collected');
  }

  // Log an error with context
  logError(error, context = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      ...context
    };

    logger.error('Application error', errorData);

    // Store in database for analysis
    if (this.isProduction && !this.isTest) {
      this.storeErrorInDatabase(error, context).catch(dbError => {
        logger.debug('Failed to store error in database', { error: dbError.message });
      });
    }
  }

  // Store error in database
  async storeErrorInDatabase(error, context) {
    try {
      // Check if we're in test environment or if the table exists
      if (process.env.NODE_ENV === 'test') {
        return; // Skip database storage in tests
      }
      
      await db.query(`
        INSERT INTO error_logs (error_type, error_message, stack_trace, user_id, request_id, endpoint, method, status_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        error.constructor.name,
        error.message,
        error.stack,
        context.userId || null,
        context.requestId || null,
        context.endpoint || null,
        context.method || null,
        context.statusCode || null
      ]);
    } catch (dbError) {
      // Don't throw, just log
      logger.debug('Database error storage failed', { error: dbError.message });
    }
  }

  // Log audit event
  async logAuditEvent(userId, action, resourceType, resourceId, details = {}, req = null) {
    const auditData = {
      userId,
      action,
      resourceType,
      resourceId,
      details: JSON.stringify(details),
      ipAddress: req?.ip || null,
      userAgent: req?.get('User-Agent') || null
    };

    logger.info(`Audit: ${action} on ${resourceType}`, auditData);

    if (this.isProduction && process.env.NODE_ENV !== 'test') {
      try {
        await db.query(`
          INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          userId,
          action,
          resourceType,
          resourceId,
          JSON.stringify(details),
          auditData.ipAddress,
          auditData.userAgent
        ]);
      } catch (error) {
        logger.debug('Failed to store audit log', { error: error.message });
      }
    }
  }

  // Get recent metrics
  getRecentMetrics(metricName, limit = 100) {
    const recentMetrics = Array.from(this.metrics.values())
      .filter(metric => metric.name === metricName)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    return recentMetrics;
  }

  // Clean up old metrics from memory
  cleanupMetrics() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [key, metric] of this.metrics.entries()) {
      if (metric.timestamp < oneHourAgo) {
        this.metrics.delete(key);
      }
    }
  }
}

// Create singleton instance
const monitoring = new MonitoringService();

// Express middleware for error monitoring
const errorMonitoringMiddleware = (error, req, res, next) => {
  const context = {
    userId: req.user?.id,
    requestId: req.id,
    endpoint: req.path,
    method: req.method,
    statusCode: res.statusCode
  };

  monitoring.logError(error, context);
  next(error);
};

// Express middleware for request metrics
const requestMetricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Record request metrics
    monitoring.recordMetric('http_request_duration', duration, 'ms', {
      method: req.method,
      endpoint: req.path,
      statusCode: res.statusCode
    });
    
    monitoring.recordMetric('http_request_count', 1, 'count', {
      method: req.method,
      statusCode: res.statusCode
    });
  });
  
  next();
};

module.exports = {
  monitoring,
  errorMonitoringMiddleware,
  requestMetricsMiddleware
};