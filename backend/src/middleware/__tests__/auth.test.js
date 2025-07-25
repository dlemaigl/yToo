const jwt = require('jsonwebtoken');
const { authenticateToken, optionalAuth } = require('../auth');
const User = require('../../models/User');

// Mock the User model
jest.mock('../../models/User');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token successfully', async () => {
      const userId = '1';
      const token = jwt.sign(
        { userId, type: 'access' },
        'test-secret',
        { expiresIn: '15m' }
      );

      const mockUser = {
        id: userId,
        username: 'testuser'
      };

      req.headers.authorization = `Bearer ${token}`;
      User.findById.mockResolvedValue(mockUser);

      await authenticateToken(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(User.findById).toHaveBeenCalledWith(userId);
    });

    it('should return 401 when no token provided', async () => {
      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: '1', type: 'access' },
        'test-secret',
        { expiresIn: '-1s' } // Already expired
      );

      req.headers.authorization = `Bearer ${expiredToken}`;

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token expired' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for refresh token instead of access token', async () => {
      const refreshToken = jwt.sign(
        { userId: '1', type: 'refresh' },
        'test-secret',
        { expiresIn: '7d' }
      );

      req.headers.authorization = `Bearer ${refreshToken}`;

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token type' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when user no longer exists', async () => {
      const token = jwt.sign(
        { userId: '999', type: 'access' },
        'test-secret',
        { expiresIn: '15m' }
      );

      req.headers.authorization = `Bearer ${token}`;
      User.findById.mockResolvedValue(null);

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const token = jwt.sign(
        { userId: '1', type: 'access' },
        'test-secret',
        { expiresIn: '15m' }
      );

      req.headers.authorization = `Bearer ${token}`;
      User.findById.mockRejectedValue(new Error('Database error'));

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should authenticate valid token successfully', async () => {
      const userId = '1';
      const token = jwt.sign(
        { userId, type: 'access' },
        'test-secret',
        { expiresIn: '15m' }
      );

      const mockUser = {
        id: userId,
        username: 'testuser'
      };

      req.headers.authorization = `Bearer ${token}`;
      User.findById.mockResolvedValue(mockUser);

      await optionalAuth(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should set user to null when no token provided', async () => {
      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should set user to null for invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should set user to null for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: '1', type: 'access' },
        'test-secret',
        { expiresIn: '-1s' }
      );

      req.headers.authorization = `Bearer ${expiredToken}`;

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should set user to null for refresh token', async () => {
      const refreshToken = jwt.sign(
        { userId: '1', type: 'refresh' },
        'test-secret',
        { expiresIn: '7d' }
      );

      req.headers.authorization = `Bearer ${refreshToken}`;

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should set user to null when user no longer exists', async () => {
      const token = jwt.sign(
        { userId: '999', type: 'access' },
        'test-secret',
        { expiresIn: '15m' }
      );

      req.headers.authorization = `Bearer ${token}`;
      User.findById.mockResolvedValue(null);

      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});