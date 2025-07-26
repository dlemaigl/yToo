const helmet = require('helmet');

// Security headers configuration
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disabled for WebSocket compatibility
  
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: "same-origin" },
  
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: "cross-origin" },
  
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  
  // Expect-CT
  expectCt: {
    maxAge: 86400,
    enforce: true,
  },
  
  // Feature Policy / Permissions Policy
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
    },
  },
  
  // Frame Options
  frameguard: { action: 'deny' },
  
  // Hide Powered-By header
  hidePoweredBy: true,
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // IE No Open
  ieNoOpen: true,
  
  // No Sniff
  noSniff: true,
  
  // Origin Agent Cluster
  originAgentCluster: true,
  
  // Referrer Policy
  referrerPolicy: { policy: "no-referrer" },
  
  // X-XSS-Protection
  xssFilter: true,
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000', // React dev server
      'http://localhost:3001', // Backend dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];
    
    // Add production origins from environment
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }
    
    if (process.env.ALLOWED_ORIGINS) {
      const envOrigins = process.env.ALLOWED_ORIGINS.split(',');
      allowedOrigins.push(...envOrigins);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  credentials: true, // Allow cookies and authorization headers
  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  
  maxAge: 86400, // 24 hours
};

// Additional security middleware
const additionalSecurity = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  
  // Prevent caching of sensitive endpoints
  if (req.path.includes('/api/auth') || req.path.includes('/api/groups')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
};

// Request logging middleware for security monitoring
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log security-relevant information
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    userId: req.user?.id,
  };
  
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i,  // JavaScript protocol
    /data:.*base64/i,  // Base64 data URLs
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.url) || 
    pattern.test(JSON.stringify(req.body)) ||
    pattern.test(JSON.stringify(req.query))
  );
  
  if (isSuspicious) {
    console.warn('Suspicious request detected:', logData);
  }
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseLog = {
      ...logData,
      statusCode: res.statusCode,
      duration,
    };
    
    // Log failed authentication attempts
    if (req.path.includes('/auth') && res.statusCode >= 400) {
      console.warn('Authentication failure:', responseLog);
    }
    
    // Log rate limit violations
    if (res.statusCode === 429) {
      console.warn('Rate limit exceeded:', responseLog);
    }
    
    // Log server errors
    if (res.statusCode >= 500) {
      console.error('Server error:', responseLog);
    }
  });
  
  next();
};

// Input validation for common attack vectors
const validateInput = (req, res, next) => {
  const checkForAttacks = (value) => {
    if (typeof value !== 'string') return false;
    
    const attackPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi, // Script tags
      /javascript:/gi, // JavaScript protocol
      /on\w+\s*=/gi, // Event handlers
      /\beval\s*\(/gi, // eval() calls
      /\bexec\s*\(/gi, // exec() calls
      /\.\.\//g, // Directory traversal
      /\/etc\/passwd/gi, // System file access
      /union.*select/gi, // SQL injection
      /drop\s+table/gi, // SQL injection
      /insert\s+into/gi, // SQL injection
    ];
    
    return attackPatterns.some(pattern => pattern.test(value));
  };
  
  const validateObject = (obj) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && checkForAttacks(value)) {
        return key;
      }
      if (typeof value === 'object' && value !== null) {
        const nestedResult = validateObject(value);
        if (nestedResult) return `${key}.${nestedResult}`;
      }
    }
    return null;
  };
  
  // Check request body
  if (req.body) {
    const attackField = validateObject(req.body);
    if (attackField) {
      console.warn(`Attack pattern detected in ${attackField}:`, req.body);
      return res.status(400).json({ error: 'Invalid input detected' });
    }
  }
  
  // Check query parameters
  if (req.query) {
    const attackField = validateObject(req.query);
    if (attackField) {
      console.warn(`Attack pattern detected in query ${attackField}:`, req.query);
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
  }
  
  next();
};

module.exports = {
  securityHeaders,
  corsOptions,
  additionalSecurity,
  securityLogger,
  validateInput
};