const request = require('supertest');
const express = require('express');
const { securityHeaders, corsOptions, additionalSecurity, securityLogger, validateInput } = require('../middleware/security');
const { sanitizeInput, validateContentType, validateRequestSize } = require('../middleware/validation');
const { applyRateLimit } = require('../middleware/rateLimiting');

describe('Security Middleware Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    
    // Apply security middleware
    app.use(securityHeaders);
    app.use(additionalSecurity);
    app.use(validateInput);
    app.use(validateContentType);
    app.use(validateRequestSize);
    app.use(sanitizeInput);
    app.use(express.json({ limit: '1mb' }));
    
    // Test routes
    app.post('/test', (req, res) => {
      res.json({ body: req.body, success: true });
    });
    
    app.get('/test', (req, res) => {
      res.json({ query: req.query, success: true });
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should sanitize HTML in request body', async () => {
      const maliciousInput = {
        name: '<script>alert("xss")</script>Test',
        description: '<img src=x onerror=alert("xss")>Description'
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput);

      expect(response.status).toBe(200);
      expect(response.body.body.name).not.toContain('<script>');
      expect(response.body.body.name).toContain('&lt;script&gt;');
      expect(response.body.body.description).not.toContain('<img');
      expect(response.body.body.description).not.toContain('onerror');
    });

    it('should reject SQL injection attempts', async () => {
      const sqlInjection = {
        name: "'; DROP TABLE users; --"
      };

      const response = await request(app)
        .post('/test')
        .send(sqlInjection);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input detected');
    });

    it('should reject JavaScript protocol attempts', async () => {
      const jsProtocol = {
        url: 'javascript:alert("xss")'
      };

      const response = await request(app)
        .post('/test')
        .send(jsProtocol);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input detected');
    });

    it('should reject directory traversal attempts', async () => {
      const traversal = {
        path: '../../../etc/passwd'
      };

      const response = await request(app)
        .post('/test')
        .send(traversal);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input detected');
    });

    it('should validate content type for POST requests', async () => {
      const response = await request(app)
        .post('/test')
        .set('Content-Type', 'text/plain')
        .send('name=test');

      expect(response.status).toBe(415);
      expect(response.body.error).toBe('Content-Type must be application/json');
    });

    it('should enforce request size limits', async () => {
      const largePayload = {
        data: 'A'.repeat(2000000) // 2MB payload
      };

      const response = await request(app)
        .post('/test')
        .send(largePayload);

      expect(response.status).toBe(413);
      expect(response.body.error).toBe('Request payload too large');
    });

    it('should sanitize query parameters', async () => {
      const response = await request(app)
        .get('/test')
        .query({ search: '<script>alert("xss")</script>' });

      expect(response.status).toBe(200);
      expect(response.body.query.search).not.toContain('<script>');
      expect(response.body.query.search).toContain('&lt;script&gt;');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/test');

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['permissions-policy']).toContain('camera=()');
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/test');

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });

    it('should include CSP headers', async () => {
      const response = await request(app)
        .get('/test');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('CORS Configuration', () => {
    it('should handle CORS for allowed origins', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should reject CORS for disallowed origins', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://malicious-site.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(500); // CORS error
    });
  });

  describe('Attack Pattern Detection', () => {
    const attackPatterns = [
      { name: 'XSS Script Tag', payload: { input: '<script>alert(1)</script>' } },
      { name: 'XSS Event Handler', payload: { input: '<img onerror=alert(1)>' } },
      { name: 'SQL Injection Union', payload: { input: "' UNION SELECT * FROM users --" } },
      { name: 'SQL Injection Drop', payload: { input: "'; DROP TABLE users; --" } },
      { name: 'JavaScript Protocol', payload: { input: 'javascript:alert(1)' } },
      { name: 'Data URL', payload: { input: 'data:text/html,<script>alert(1)</script>' } },
      { name: 'Directory Traversal', payload: { input: '../../../etc/passwd' } },
      { name: 'Eval Injection', payload: { input: 'eval("alert(1)")' } }
    ];

    attackPatterns.forEach(({ name, payload }) => {
      it(`should detect and block ${name}`, async () => {
        const response = await request(app)
          .post('/test')
          .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid input detected');
      });
    });
  });

  describe('Input Sanitization Edge Cases', () => {
    it('should handle nested objects', async () => {
      const nestedInput = {
        user: {
          profile: {
            bio: '<script>alert("nested")</script>Bio'
          }
        }
      };

      const response = await request(app)
        .post('/test')
        .send(nestedInput);

      expect(response.status).toBe(200);
      expect(response.body.body.user.profile.bio).not.toContain('<script>');
      expect(response.body.body.user.profile.bio).toContain('&lt;script&gt;');
    });

    it('should handle arrays', async () => {
      const arrayInput = {
        tags: ['<script>alert(1)</script>', 'normal tag', '<img onerror=alert(2)>']
      };

      const response = await request(app)
        .post('/test')
        .send(arrayInput);

      expect(response.status).toBe(200);
      expect(response.body.body.tags[0]).not.toContain('<script>');
      expect(response.body.body.tags[0]).toContain('&lt;script&gt;');
      expect(response.body.body.tags[1]).toBe('normal tag');
      expect(response.body.body.tags[2]).not.toContain('<img');
    });

    it('should handle null and undefined values', async () => {
      const nullInput = {
        name: null,
        description: undefined,
        value: 'normal'
      };

      const response = await request(app)
        .post('/test')
        .send(nullInput);

      expect(response.status).toBe(200);
      expect(response.body.body.name).toBeNull();
      expect(response.body.body.description).toBeUndefined();
      expect(response.body.body.value).toBe('normal');
    });

    it('should handle non-string values', async () => {
      const mixedInput = {
        number: 123,
        boolean: true,
        string: '<script>alert(1)</script>',
        object: { nested: '<img onerror=alert(1)>' }
      };

      const response = await request(app)
        .post('/test')
        .send(mixedInput);

      expect(response.status).toBe(200);
      expect(response.body.body.number).toBe(123);
      expect(response.body.body.boolean).toBe(true);
      expect(response.body.body.string).not.toContain('<script>');
      expect(response.body.body.object.nested).not.toContain('<img');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/test')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.body).toEqual({});
    });
  });
});