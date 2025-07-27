const Joi = require('joi');
const validator = require('validator');

// Custom sanitization functions
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  // Remove HTML tags and encode special characters
  return validator.escape(str.trim());
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(400).json({ error: 'Invalid input format' });
  }
};

// Validation schemas
const schemas = {
  // User registration validation
  userRegistration: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(30)
      .required()
      .messages({
        'string.alphanum': 'Username must contain only alphanumeric characters',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username must be no more than 30 characters long',
        'any.required': 'Username is required'
      }),
    email: Joi.string()
      .email()
      .max(255)
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.max': 'Email must be no more than 255 characters long',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .min(6)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.max': 'Password must be no more than 128 characters long',
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
        'any.required': 'Password is required'
      })
  }),

  // User login validation
  userLogin: Joi.object({
    username: Joi.string()
      .min(3)
      .max(30)
      .required()
      .messages({
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username must be no more than 30 characters long',
        'any.required': 'Username is required'
      }),
    password: Joi.string()
      .min(1)
      .max(128)
      .required()
      .messages({
        'string.min': 'Password is required',
        'string.max': 'Password must be no more than 128 characters long',
        'any.required': 'Password is required'
      })
  }),

  // Group creation validation
  groupCreation: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9\s\-_.,!?()]+$/)
      .required()
      .messages({
        'string.min': 'Group name cannot be empty',
        'string.max': 'Group name must be no more than 100 characters long',
        'string.pattern.base': 'Group name contains invalid characters',
        'any.required': 'Group name is required'
      })
  }),

  // Activity creation validation
  activityCreation: Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .pattern(/^[a-zA-Z0-9\s\-_.,!?()]+$/)
      .required()
      .messages({
        'string.min': 'Activity title cannot be empty',
        'string.max': 'Activity title must be no more than 200 characters long',
        'string.pattern.base': 'Activity title contains invalid characters',
        'any.required': 'Activity title is required'
      }),
    description: Joi.string()
      .max(1000)
      .pattern(/^[a-zA-Z0-9\s\-_.,!?()]*$/)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Activity description must be no more than 1000 characters long',
        'string.pattern.base': 'Activity description contains invalid characters'
      })
  }),

  // UUID validation for parameters
  uuid: Joi.string()
    .uuid({ version: 'uuidv4' })
    .required()
    .messages({
      'string.uuid': 'Invalid ID format',
      'any.required': 'ID is required'
    }),

  // Refresh token validation
  refreshToken: Joi.object({
    refreshToken: Joi.string()
      .required()
      .messages({
        'any.required': 'Refresh token is required'
      })
  })
};

// Generic validation middleware factory
const validateSchema = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'params' ? req.params : 
                  source === 'query' ? req.query : req.body;
    
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details: errorDetails
      });
    }
    
    // Replace the original data with validated and sanitized data
    if (source === 'params') {
      req.params = value;
    } else if (source === 'query') {
      req.query = value;
    } else {
      req.body = value;
    }
    
    next();
  };
};

// Specific validation middlewares
const validateUserRegistration = validateSchema(schemas.userRegistration);
const validateUserLogin = validateSchema(schemas.userLogin);
const validateGroupCreation = validateSchema(schemas.groupCreation);
const validateActivityCreation = validateSchema(schemas.activityCreation);
const validateUUID = (paramName) => validateSchema(
  Joi.object({ [paramName]: schemas.uuid }), 
  'params'
);
const validateRefreshToken = validateSchema(schemas.refreshToken);

// Content-Type validation middleware
const validateContentType = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentLength = req.get('Content-Length');
    const hasBody = contentLength && parseInt(contentLength) > 0;
    
    // Only validate content type if there's actually a body
    if (hasBody) {
      const contentType = req.get('Content-Type');
      if (!contentType || !contentType.includes('application/json')) {
        return res.status(415).json({
          error: 'Content-Type must be application/json'
        });
      }
    }
  }
  next();
};

// Request size validation middleware
const validateRequestSize = (req, res, next) => {
  const contentLength = req.get('Content-Length');
  if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB limit
    return res.status(413).json({
      error: 'Request payload too large'
    });
  }
  next();
};

module.exports = {
  sanitizeInput,
  sanitizeString,
  sanitizeObject,
  validateUserRegistration,
  validateUserLogin,
  validateGroupCreation,
  validateActivityCreation,
  validateUUID,
  validateRefreshToken,
  validateContentType,
  validateRequestSize,
  schemas
};