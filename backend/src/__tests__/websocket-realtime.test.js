const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Mock models
jest.mock('../models/User');
jest.mock('../models/Group');
jest.mock('../models/Activity');
jest.mock('../models/Vote');

const User = require('../models/User');
const Group = require('../models/Group');
const Activity = require('../models/Activity');
const Vote = require('../models/Vote');

describe('WebSocket Real-time Functionality Tests', () => {
  let io, serverSocket, clientSocket1, clientSocket2;
  let httpServer;

  const mockUser1 = {
    id: 'user-1',
    username: 'testuser1',
    email: 'test1@example.com'
  };

  const mockUser2 = {
    id: 'user-2',
    username: 'testuser2',
    email: 'test2@example.com'
  };

  const mockGroup = {
    id: 'group-1',
    name: 'Test Group',
    members: [mockUser1, mockUser2]
  };

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    
    // Setup WebSocket authentication middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
        socket.userId = decoded.userId;
        next();
      } catch (err) {
        next(new Error('Authentication error'));
      }
    });

    httpServer.listen(() => {
      const port = httpServer.address().port;
      
      // Create client connections
      const token1 = jwt.sign({ userId: 'user-1' }, 'test-secret');
      const token2 = jwt.sign({ userId: 'user-2' }, 'test-secret');
      
      clientSocket1 = new Client(`http://localhost:${port}`, {
        auth: { token: token1 }
      });
      
      clientSocket2 = new Client(`http://localhost:${port}`, {
        auth: { token: token2 }
      });

      io.on('connection', (socket) => {
        serverSocket = socket;
      });

      clientSocket1.on('connect', () => {
        clientSocket2.on('connect', done);
      });
    });
  });

  afterAll(() => {
    io.close();
    clientSocket1.close();
    clientSocket2.close();
    httpServer.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    User.findById.mockImplementation((id) => {
      if (id === 'user-1') return Promise.resolve(mockUser1);
      if (id === 'user-2') return Promise.resolve(mockUser2);
      return Promise.resolve(null);
    });

    Group.findById.mockResolvedValue(mockGroup);
  });

  describe('Real-time Activity Updates', () => {
    it('should broadcast new activity to all group members without revealing creator', (done) => {
      const mockActivity = {
        id: 'activity-1',
        groupId: 'group-1',
        title: 'New Activity',
        description: 'Test activity',
        isChosen: false,
        createdAt: new Date()
        // No creatorId for anonymity
      };

      // Setup WebSocket room joining
      io.on('connection', (socket) => {
        socket.on('join_group', (groupId) => {
          socket.join(`group_${groupId}`);
        });

        socket.on('activity_created', (data) => {
          // Broadcast to all group members except sender
          socket.to(`group_${data.groupId}`).emit('group:activity_added', {
            activity: {
              id: data.activity.id,
              title: data.activity.title,
              description: data.activity.description,
              isChosen: false
              // No creator information
            }
          });
        });
      });

      // Both clients join the group
      clientSocket1.emit('join_group', 'group-1');
      clientSocket2.emit('join_group', 'group-1');

      // Client 2 listens for new activity
      clientSocket2.on('group:activity_added', (data) => {
        expect(data.activity.title).toBe('New Activity');
        expect(data.activity.creatorId).toBeUndefined();
        expect(data.activity.creator).toBeUndefined();
        expect(data.activity.createdBy).toBeUndefined();
        done();
      });

      // Client 1 creates activity
      setTimeout(() => {
        clientSocket1.emit('activity_created', {
          groupId: 'group-1',
          activity: mockActivity
        });
      }, 100);
    });

    it('should broadcast activity chosen status without vote details', (done) => {
      io.on('connection', (socket) => {
        socket.on('join_group', (groupId) => {
          socket.join(`group_${groupId}`);
        });

        socket.on('activity_chosen', (data) => {
          socket.to(`group_${data.groupId}`).emit('group:activity_chosen', {
            activityId: data.activityId,
            isChosen: true
            // No vote counts or voter information
          });
        });
      });

      clientSocket1.emit('join_group', 'group-1');
      clientSocket2.emit('join_group', 'group-1');

      clientSocket2.on('group:activity_chosen', (data) => {
        expect(data.activityId).toBe('activity-1');
        expect(data.isChosen).toBe(true);
        
        // Verify no voting details
        expect(data.voteCount).toBeUndefined();
        expect(data.voters).toBeUndefined();
        expect(data.percentage).toBeUndefined();
        done();
      });

      setTimeout(() => {
        clientSocket1.emit('activity_chosen', {
          groupId: 'group-1',
          activityId: 'activity-1'
        });
      }, 100);
    });

    it('should broadcast activity unchosen status when majority is lost', (done) => {
      io.on('connection', (socket) => {
        socket.on('join_group', (groupId) => {
          socket.join(`group_${groupId}`);
        });

        socket.on('activity_unchosen', (data) => {
          socket.to(`group_${data.groupId}`).emit('group:activity_unchosen', {
            activityId: data.activityId,
            isChosen: false
          });
        });
      });

      clientSocket1.emit('join_group', 'group-1');
      clientSocket2.emit('join_group', 'group-1');

      clientSocket2.on('group:activity_unchosen', (data) => {
        expect(data.activityId).toBe('activity-1');
        expect(data.isChosen).toBe(false);
        done();
      });

      setTimeout(() => {
        clientSocket1.emit('activity_unchosen', {
          groupId: 'group-1',
          activityId: 'activity-1'
        });
      }, 100);
    });
  });

  describe('Real-time Member Updates', () => {
    it('should broadcast new member joins to existing members', (done) => {
      const newMember = {
        id: 'user-3',
        username: 'newuser',
        email: 'new@example.com'
      };

      io.on('connection', (socket) => {
        socket.on('join_group', (groupId) => {
          socket.join(`group_${groupId}`);
        });

        socket.on('member_joined', (data) => {
          socket.to(`group_${data.groupId}`).emit('group:member_joined', {
            member: {
              id: data.member.id,
              username: data.member.username
              // No sensitive information
            }
          });
        });
      });

      clientSocket1.emit('join_group', 'group-1');
      clientSocket2.emit('join_group', 'group-1');

      clientSocket1.on('group:member_joined', (data) => {
        expect(data.member.username).toBe('newuser');
        expect(data.member.email).toBeUndefined();
        expect(data.member.password).toBeUndefined();
        done();
      });

      setTimeout(() => {
        clientSocket2.emit('member_joined', {
          groupId: 'group-1',
          member: newMember
        });
      }, 100);
    });
  });

  describe('WebSocket Authentication and Security', () => {
    it('should reject connections without valid JWT token', (done) => {
      const invalidClient = new Client(`http://localhost:${httpServer.address().port}`, {
        auth: { token: 'invalid-token' }
      });

      invalidClient.on('connect_error', (error) => {
        expect(error.message).toBe('Authentication error');
        invalidClient.close();
        done();
      });
    });

    it('should reject connections without token', (done) => {
      const noTokenClient = new Client(`http://localhost:${httpServer.address().port}`);

      noTokenClient.on('connect_error', (error) => {
        expect(error.message).toBe('Authentication error');
        noTokenClient.close();
        done();
      });
    });

    it('should isolate group rooms - users should only receive updates for their groups', (done) => {
      io.on('connection', (socket) => {
        socket.on('join_group', (groupId) => {
          socket.join(`group_${groupId}`);
        });

        socket.on('test_isolation', (data) => {
          socket.to(`group_${data.groupId}`).emit('isolated_message', data);
        });
      });

      // Client 1 joins group-1
      clientSocket1.emit('join_group', 'group-1');
      
      // Client 2 joins group-2 (different group)
      clientSocket2.emit('join_group', 'group-2');

      let messageReceived = false;

      // Client 2 should not receive messages for group-1
      clientSocket2.on('isolated_message', () => {
        messageReceived = true;
      });

      // Send message to group-1
      setTimeout(() => {
        clientSocket1.emit('test_isolation', {
          groupId: 'group-1',
          message: 'This should not reach client 2'
        });
      }, 100);

      // Verify client 2 didn't receive the message
      setTimeout(() => {
        expect(messageReceived).toBe(false);
        done();
      }, 300);
    });
  });

  describe('Connection Management', () => {
    it('should handle client disconnections gracefully', (done) => {
      io.on('connection', (socket) => {
        socket.on('disconnect', () => {
          // Handle cleanup
        });
      });

      clientSocket1.on('disconnect', () => {
        // Verify server handles disconnection
        done();
      });

      clientSocket1.disconnect();
    });

    it('should handle reconnections and rejoin groups', (done) => {
      const token = jwt.sign({ userId: 'user-1' }, 'test-secret');
      
      io.on('connection', (socket) => {
        socket.on('rejoin_groups', (groups) => {
          groups.forEach(groupId => {
            socket.join(`group_${groupId}`);
          });
          socket.emit('rejoined', { success: true });
        });
      });

      const reconnectClient = new Client(`http://localhost:${httpServer.address().port}`, {
        auth: { token }
      });

      reconnectClient.on('connect', () => {
        reconnectClient.emit('rejoin_groups', ['group-1']);
      });

      reconnectClient.on('rejoined', (data) => {
        expect(data.success).toBe(true);
        reconnectClient.close();
        done();
      });
    });
  });
});