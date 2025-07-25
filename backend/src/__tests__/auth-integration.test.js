const request = require('supertest');
const app = require('../app');
const { authenticateToken } = require('../middleware/auth');

// Mock the User model for integration tests
jest.mock('../models/User');
const User = require('../models/User');

describe('Authentication Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('should complete full authentication flow', async () => {
    // Mock user creation
    const mockUser = {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      verifyPassword: jest.fn().mockResolvedValue(true),
      toJSON: () => ({
        id: '1',
        username: 'testuser',
        email: 'test@example.com'
      })
    };

    User.create.mockResolvedValue(mockUser);
    User.findByUsername.mockResolvedValue(mockUser);
    User.findById.mockResolvedValue(mockUser);

    // 1. Register user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.accessToken).toBeDefined();
    expect(registerResponse.body.refreshToken).toBeDefined();

    const { accessToken, refreshToken } = registerResponse.body;

    // 2. Login with same credentials
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'password123'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toBeDefined();

    // 3. Use refresh token to get new tokens
    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toBeDefined();
    expect(refreshResponse.body.refreshToken).toBeDefined();

    // 4. Test middleware with valid token
    const req = {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should handle authentication errors in protected route flow', async () => {
    // Test with invalid token
    const req = {
      headers: {
        authorization: 'Bearer invalid-token'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });
});