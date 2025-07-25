const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const User = require('../../models/User');

// Mock the User model
jest.mock('../../models/User');

describe('Authentication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        toJSON: () => ({
          id: '1',
          username: 'testuser',
          email: 'test@example.com'
        })
      };

      User.create.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user).toEqual(mockUser.toJSON());
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(User.create).toHaveBeenCalledWith(userData);
    });

    it('should return 400 for invalid input', async () => {
      const invalidData = {
        username: 'ab', // too short
        email: 'invalid-email',
        password: '123' // too short
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should return 409 for duplicate username', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      User.create.mockRejectedValue(new Error('Username already exists'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Username already exists');
    });

    it('should return 409 for duplicate email', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      User.create.mockRejectedValue(new Error('Email already exists'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        username: 'testuser',
        password: 'password123'
      };

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

      User.findByUsername.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user).toEqual(mockUser.toJSON());
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(User.findByUsername).toHaveBeenCalledWith('testuser');
      expect(mockUser.verifyPassword).toHaveBeenCalledWith('password123');
    });

    it('should return 401 for non-existent user', async () => {
      const loginData = {
        username: 'nonexistent',
        password: 'password123'
      };

      User.findByUsername.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 401 for invalid password', async () => {
      const loginData = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const mockUser = {
        verifyPassword: jest.fn().mockResolvedValue(false)
      };

      User.findByUsername.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 400 for invalid input', async () => {
      const invalidData = {
        username: '', // empty username
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const userId = '1';
      const refreshToken = jwt.sign(
        { userId, type: 'refresh' },
        'test-secret',
        { expiresIn: '7d' }
      );

      const mockUser = {
        id: userId,
        username: 'testuser'
      };

      User.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(User.findById).toHaveBeenCalledWith(userId);
    });

    it('should return 400 when refresh token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Refresh token required');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should return 401 for access token instead of refresh token', async () => {
      const accessToken = jwt.sign(
        { userId: '1', type: 'access' },
        'test-secret',
        { expiresIn: '15m' }
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: accessToken });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token type');
    });

    it('should return 401 when user no longer exists', async () => {
      const refreshToken = jwt.sign(
        { userId: '999', type: 'refresh' },
        'test-secret',
        { expiresIn: '7d' }
      );

      User.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('User not found');
    });
  });
});