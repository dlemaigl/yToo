const http = require('http');
const request = require('supertest');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const SocketServer = require('../socketServer');
const WebSocketService = require('../../services/websocketService');
const User = require('../../models/User');
const Group = require('../../models/Group');

describe('WebSocket Integration', () => {
  let server;
  let httpServer;
  let socketServer;
  let websocketService;
  let testUser;
  let testGroup;
  let authToken;

  beforeAll(async () => {
    // Create HTTP server
    httpServer = http.createServer(app);
    
    // Initialize WebSocket server
    socketServer = new SocketServer(httpServer);
    websocketService = new WebSocketService(socketServer);
    
    // Make services available to app
    app.set('websocketService', websocketService);
    app.set('socketServer', socketServer);

    // Start server
    await new Promise((resolve) => {
      httpServer.listen(0, resolve);
    });

    // Create test user and group
    testUser = await User.create({
      username: 'websocket_test_user',
      email: 'websocket@test.com',
      password: 'password123'
    });

    testGroup = await Group.create({
      name: 'WebSocket Test Group',
      creatorId: testUser.id
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, type: 'access' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup
    if (testGroup) {
      await testGroup.delete();
    }
    if (testUser) {
      await testUser.delete();
    }
    
    if (socketServer) {
      socketServer.getIO().close();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  describe('WebSocket Health Check', () => {
    test('should return WebSocket health status', async () => {
      const response = await request(app)
        .get('/api/websocket/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'OK',
        websocket: 'available',
        engine: expect.any(String),
        timestamp: expect.any(String)
      });
    });
  });

  describe('WebSocket Connection', () => {
    test('should connect with valid JWT token', (done) => {
      const port = httpServer.address().port;
      const clientSocket = new Client(`http://localhost:${port}`, {
        auth: { token: authToken }
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        clientSocket.close();
        done();
      });

      clientSocket.on('connect_error', (error) => {
        clientSocket.close();
        done(error);
      });
    });

    test('should reject connection without token', (done) => {
      const port = httpServer.address().port;
      const clientSocket = new Client(`http://localhost:${port}`);

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication token required');
        clientSocket.close();
        done();
      });

      clientSocket.on('connect', () => {
        clientSocket.close();
        done(new Error('Should not connect without token'));
      });
    });
  });

  describe('Real-time Events', () => {
    test('should broadcast activity added event', (done) => {
      const port = httpServer.address().port;
      const clientSocket = new Client(`http://localhost:${port}`, {
        auth: { token: authToken }
      });

      const mockActivity = {
        id: 'activity-1',
        title: 'Test Activity',
        description: 'Test Description',
        isChosen: false,
        createdAt: new Date().toISOString()
      };

      clientSocket.on('connect', () => {
        // Listen for the activity added event
        clientSocket.on('group:activity_added', (data) => {
          expect(data).toEqual({
            groupId: testGroup.id,
            activity: {
              id: mockActivity.id,
              title: mockActivity.title,
              description: mockActivity.description,
              isChosen: mockActivity.isChosen,
              createdAt: mockActivity.createdAt
            }
          });
          
          clientSocket.close();
          done();
        });

        // Trigger the event
        websocketService.notifyActivityAdded(testGroup.id, mockActivity);
      });

      clientSocket.on('connect_error', (error) => {
        clientSocket.close();
        done(error);
      });
    });

    test('should broadcast activity chosen event', (done) => {
      const port = httpServer.address().port;
      const clientSocket = new Client(`http://localhost:${port}`, {
        auth: { token: authToken }
      });

      const mockActivity = {
        id: 'activity-2',
        title: 'Chosen Activity',
        description: 'This activity was chosen',
        isChosen: true,
        updatedAt: new Date().toISOString()
      };

      clientSocket.on('connect', () => {
        clientSocket.on('group:activity_chosen', (data) => {
          expect(data).toEqual({
            groupId: testGroup.id,
            activityId: mockActivity.id,
            activity: {
              id: mockActivity.id,
              title: mockActivity.title,
              description: mockActivity.description,
              isChosen: true,
              updatedAt: mockActivity.updatedAt
            }
          });
          
          clientSocket.close();
          done();
        });

        // Trigger the event
        websocketService.notifyActivityChosen(testGroup.id, mockActivity);
      });

      clientSocket.on('connect_error', (error) => {
        clientSocket.close();
        done(error);
      });
    });
  });

  describe('Connection Statistics', () => {
    test('should get connection statistics', async () => {
      const response = await request(app)
        .get('/api/websocket/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        totalConnections: expect.any(Number),
        connectedUsers: expect.any(Array)
      });
    });

    test('should require authentication for stats', async () => {
      await request(app)
        .get('/api/websocket/stats')
        .expect(401);
    });
  });

  describe('Privacy Protection', () => {
    test('should not expose vote counts in activity events', (done) => {
      const port = httpServer.address().port;
      const clientSocket = new Client(`http://localhost:${port}`, {
        auth: { token: authToken }
      });

      const mockActivity = {
        id: 'activity-3',
        title: 'Private Activity',
        description: 'Should not expose vote data',
        isChosen: false,
        createdAt: new Date().toISOString(),
        // These should not be included in the broadcast
        voteCount: 5,
        votes: ['user1', 'user2'],
        creatorId: 'secret-creator'
      };

      clientSocket.on('connect', () => {
        clientSocket.on('group:activity_added', (data) => {
          // Verify sensitive data is not included
          expect(data.activity).not.toHaveProperty('voteCount');
          expect(data.activity).not.toHaveProperty('votes');
          expect(data.activity).not.toHaveProperty('creatorId');
          expect(data.activity).not.toHaveProperty('creator');
          
          // Verify only allowed properties are included
          expect(Object.keys(data.activity)).toEqual([
            'id', 'title', 'description', 'isChosen', 'createdAt'
          ]);
          
          clientSocket.close();
          done();
        });

        websocketService.notifyActivityAdded(testGroup.id, mockActivity);
      });

      clientSocket.on('connect_error', (error) => {
        clientSocket.close();
        done(error);
      });
    });
  });
});