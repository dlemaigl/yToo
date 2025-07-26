const rateLimit = require('express-rate-limit');
const redis = require('redis');

// Redis client for distributed rate limiting (optional)
let redisClient = null;
if (process.env.REDIS_URL) {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL
    });
    redisClient.connect();
  } catch (error) {
    console.warn('Redis connection failed, using in-memory rate limiting:', error.message);
  }
}

// Custom rate limit store using Redis (if available)
const createRedisStore = () => {
  if (!redisClient) return undefined;
  
  return {
    incr: async (key) => {
      try {
        const current = await redisClient.incr(key);
        if (current === 1) {
          await redisClient.expire(key, 900); // 15 minutes
        }
        return { totalHits: current, resetTime: new Date(Date.now() + 900000) };
      } catch (error) {
        console.error('Redis rate limit error:', error);
        return { totalHits: 1, resetTime: new Date(Date.now() + 900000) };
      }
    },
    decrement: async (key) => {
      try {
        await redisClient.decr(key);
      } catch (error) {
        console.error('Redis decrement error:', error);
      }
    },
    resetKey: async (key) => {
      try {
        await redisClient.del(key);
      } catch (error) {
        console.error('Redis reset error:', error);
      }
    }
  };
};

// Rate limiting configurations
const rateLimitConfigs = {
  // General API rate limit
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    }
  }),

  // Authentication endpoints (stricter)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 auth requests per windowMs
    message: {
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    skipSuccessfulRequests: true, // Don't count successful requests
    keyGenerator: (req) => `auth:${req.ip}`
  }),

  // Group creation (moderate)
  groupCreation: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each user to 10 group creations per hour
    message: {
      error: 'Too many groups created, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    keyGenerator: (req) => `group_create:${req.user?.id || req.ip}`
  }),

  // Activity creation (moderate)
  activityCreation: rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20, // Limit each user to 20 activity creations per 10 minutes
    message: {
      error: 'Too many activities created, please try again later.',
      retryAfter: '10 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    keyGenerator: (req) => `activity_create:${req.user?.id || req.ip}`
  }),

  // Voting (strict to prevent spam)
  voting: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each user to 30 votes per minute
    message: {
      error: 'Too many voting attempts, please try again later.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    keyGenerator: (req) => `vote:${req.user?.id || req.ip}`
  }),

  // Group joining (moderate)
  groupJoining: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each user to 10 group joins per 5 minutes
    message: {
      error: 'Too many group join attempts, please try again later.',
      retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    keyGenerator: (req) => `group_join:${req.user?.id || req.ip}`
  }),

  // Password reset (very strict)
  passwordReset: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset attempts per hour
    message: {
      error: 'Too many password reset attempts, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    keyGenerator: (req) => `password_reset:${req.ip}`
  })
};

// Middleware to apply different rate limits based on endpoint
const applyRateLimit = (type) => {
  return (req, res, next) => {
    const limiter = rateLimitConfigs[type] || rateLimitConfigs.general;
    limiter(req, res, next);
  };
};

// Custom rate limiting for concurrent operations
const concurrentOperationLimit = (maxConcurrent = 5) => {
  const activeOperations = new Map();
  
  return (req, res, next) => {
    const key = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    const current = activeOperations.get(key) || 0;
    
    if (current >= maxConcurrent) {
      return res.status(429).json({
        error: 'Too many concurrent operations, please wait for current operations to complete.'
      });
    }
    
    // Increment counter
    activeOperations.set(key, current + 1);
    
    // Decrement counter when request completes
    const cleanup = () => {
      const newCount = (activeOperations.get(key) || 1) - 1;
      if (newCount <= 0) {
        activeOperations.delete(key);
      } else {
        activeOperations.set(key, newCount);
      }
    };
    
    res.on('finish', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
    
    next();
  };
};

// Cleanup function for graceful shutdown
const cleanup = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
};

module.exports = {
  applyRateLimit,
  concurrentOperationLimit,
  rateLimitConfigs,
  cleanup
};