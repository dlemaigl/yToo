const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');
const SocketServer = require('../socketServer');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/Group');

const User = require('../../models/User');
const Group = require('../../models/Group');

describe('SocketServer', () => {
  let httpServer;
  let socketServer;
  let clientSocket;
  let serverSocket;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com'
  };

  const mockGroups = [
    { id: 'group-1', name: 'Test Group 1' },
    { id: 'group-2', name: 'Test Group 2' }
  ];

  beforeAll((done) => {
    httpServer = http.createServer();
    socketServer = new SocketServer(httpServer);
    
    httpServer.listen(() => {
      const port = httpServer.address().port;
      
      // Create valid JWT token for testing
      const token = jwt.sign(
        { userId: mockUser.id, type: 'access' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      clientSocket = new Client(`http://localhost:${port}`, {
        auth: { token }
      });

      socketServer.getIO().on('connection', (socket) => {
        serverSocket = socket;
      });

      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    socketServer.getIO().close();
    clientSocket.close();
    httpServer.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    User.findById.mockResolvedValue(mockUser);
    Group.findByUserId.mockResolvedValue(mockGroups);
    Group.isUserMember.mockResolvedValue(true);
  });

  describe('Authentication', () => {
    test('should authenticate user with valid JWT token', (done) => {
      expect(serverSocket.userId).toBe(mockUser.id);
      expect(serverSocket.user).toEqual(mockUser);
      done();
    });

    test('should reject connection without token', (done) => {
      const invalidClient = new Client(`http://localhost:${httpServer.address().port}`);
      
      invalidClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication token required');
        invalidClient.close();
        done();
      });
    });

    test('should reject connection with invalid token', (done) => {
      const invalidClient = new Client(`http://localhost:${httpServer.address().port}`, {
        auth: { token: 'invalid-token' }
      });
      
      invalidClient.on('connect_error', (error) => {
        expect(error.message).toContain('Invalid token');
        invalidClient.close();
        done();
      });
    });
  });

  describe('Group Management', () => {
    test('should join user to their groups on connection', () => {
      expect(Group.findByUserId).toHaveBeenCalledWith(mockUser.id);
      // Check if user was added to group rooms (implementation detail)
    });

    test('should handle join_group event', (done) => {
      clientSocket.emit('join_group', 'group-1');
      
      clientSocket.on('joined_group', (data) => {
        expect(data.groupId).toBe('group-1');
        expect(data.room).toBe('group_group-1');
        done();
      });
    });

    test('should handle leave_group event', (done) => {
      clientSocket.emit('leave_group', 'group-1');
      
      clientSocket.on('left_group', (data) => {
        expect(data.groupId).toBe('group-1');
        expect(data.room).toBe('group_group-1');
        done();
      });
    });

    test('should reject joining group if user is not a member', (done) => {
      Group.isUserMember.mockResolvedValue(false);
      
      clientSocket.emit('join_group', 'unauthorized-group');
      
      clientSocket.on('error', (error) => {
        expect(error.message).toBe('Not authorized to join this group');
        done();
      });
    });
  });

  describe('Broadcasting', () => {
    test('should broadcast to group members', () => {
      const testData = { message: 'test' };
      
      socketServer.broadcastToGroup('group-1', 'test_event', testData);
      
      // This is hard to test without multiple clients
      // In a real scenario, we'd need multiple connected clients to verify broadcasting
    });

    test('should get connected users in group', async () => {
      const users = await socketServer.getGroupConnectedUsers('group-1');
      
      expect(Array.isArray(users)).toBe(true);
      // Users array would contain connected users in the group room
    });
  });

  describe('Error Handling', () => {
    test('should handle socket errors gracefully', (done) => {
      serverSocket.emit('error', new Error('Test error'));
      
      // Error should be logged but not crash the server
      setTimeout(() => {
        expect(serverSocket.connected).toBe(true);
        done();
      }, 100);
    });

    test('should handle user not found during authentication', (done) => {
      User.findById.mockResolvedValue(null);
      
      const token = jwt.sign(
        { userId: 'nonexistent-user', type: 'access' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const invalidUserClient = new Client(`http://localhost:${httpServer.address().port}`, {
        auth: { token }
      });
      
      invalidUserClient.on('connect_error', (error) => {
        expect(error.message).toContain('User not found');
        invalidUserClient.close();
        done();
      });
    });
  });

  describe('Connection Management', () => {
    test('should track user connection status', async () => {
      const isConnected = await socketServer.isUserConnected(mockUser.id);
      expect(isConnected).toBe(true);
    });

    test('should send message to specific user', async () => {
      const testData = { message: 'direct message' };
      
      const sent = await socketServer.sendToUser(mockUser.id, 'direct_message', testData);
      expect(sent).toBe(true);
    });
  });
});