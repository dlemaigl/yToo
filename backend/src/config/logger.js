const fs = require('fs');
const path = require('path');

/**
 * Production logging configuration
 * Provides structured logging with different levels and outputs
 */

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'info');
    this.logDir = path.join(__dirname, '..', '..', 'logs');
    this.isProduction = process.env.NODE_ENV === 'production';
    this.isTest = process.env.NODE_ENV === 'test';
    
    // Ensure log directory exists
    if (this.isProduction) {
      this.ensureLogDirectory();
    }
    
    // Log levels (lower number = higher priority)
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    if (this.isProduction) {
      return JSON.stringify(logEntry);
    } else {
      // Pretty format for development
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    }
  }

  writeToFile(level, formattedMessage) {
    if (!this.isProduction) return;

    const logFile = path.join(this.logDir, `${level}.log`);
    const allLogFile = path.join(this.logDir, 'all.log');
    
    // Write to level-specific file
    fs.appendFileSync(logFile, formattedMessage + '\n');
    
    // Write to combined log file
    fs.appendFileSync(allLogFile, formattedMessage + '\n');
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Only output to console if not in test mode or if it's an error
    if (!this.isTest || level === 'error') {
      if (level === 'error') {
        console.error(formattedMessage);
      } else if (level === 'warn') {
        console.warn(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
    }
    
    // Write to file in production
    this.writeToFile(level, formattedMessage);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  // Log HTTP requests
  logRequest(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    };

    // Only log server errors (5xx) as errors, client errors (4xx) as warnings
    if (res.statusCode >= 500) {
      this.error(`HTTP ${res.statusCode} ${req.method} ${req.url}`, meta);
    } else if (res.statusCode >= 400) {
      this.warn(`HTTP ${res.statusCode} ${req.method} ${req.url}`, meta);
    } else {
      this.info(`HTTP ${res.statusCode} ${req.method} ${req.url}`, meta);
    }
  }

  // Log database operations
  logDatabase(operation, table, duration, error = null) {
    const meta = {
      operation,
      table,
      duration: `${duration}ms`
    };

    if (error) {
      this.error(`Database error: ${operation} on ${table}`, { ...meta, error: error.message });
    } else {
      this.debug(`Database: ${operation} on ${table}`, meta);
    }
  }

  // Log WebSocket events
  logWebSocket(event, userId, groupId, error = null) {
    const meta = {
      event,
      userId,
      groupId
    };

    if (error) {
      this.error(`WebSocket error: ${event}`, { ...meta, error: error.message });
    } else {
      this.debug(`WebSocket: ${event}`, meta);
    }
  }

  // Log security events
  logSecurity(event, details) {
    this.warn(`Security event: ${event}`, details);
  }

  // Log application startup
  logStartup(port, environment) {
    this.info(`Application started`, {
      port,
      environment,
      nodeVersion: process.version,
      pid: process.pid
    });
  }

  // Log application shutdown
  logShutdown(signal) {
    this.info(`Application shutting down`, { signal });
  }
}

// Create singleton instance
const logger = new Logger();

// Express middleware for request logging
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    logger.logRequest(req, res, responseTime);
  });
  
  next();
};

module.exports = {
  logger,
  requestLogger
};