const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Group = require('../models/Group');

class SocketServer {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // JWT authentication middleware for Socket.IO
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.type !== 'access') {
          return next(new Error('Invalid token type'));
        }

        // Check if user exists
        const user = await User.findById(decoded.userId);
        if (!user) {
          return next(new Error('User not found'));
        }

        // Attach user to socket
        socket.userId = user.id;
        socket.user = user;
        
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        
        if (error.name === 'JsonWebTokenError') {
          return next(new Error('Invalid token'));
        }
        
        if (error.name === 'TokenExpiredError') {
          return next(new Error('Token expired'));
        }
        
        next(new Error('Authentication failed'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.user.username} connected (${socket.id})`);

      // Join user to their groups
      this.joinUserGroups(socket);

      // Handle group joining
      socket.on('join_group', async (groupId) => {
        await this.handleJoinGroup(socket, groupId);
      });

      // Handle leaving group
      socket.on('leave_group', (groupId) => {
        this.handleLeaveGroup(socket, groupId);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`User ${socket.user.username} disconnected (${socket.id}): ${reason}`);
      });

      // Handle connection errors
      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.user.username}:`, error);
      });
    });
  }

  async joinUserGroups(socket) {
    try {
      // Get all groups the user is a member of
      const userGroups = await Group.findByUserId(socket.userId);
      
      for (const group of userGroups) {
        const roomName = `group_${group.id}`;
        socket.join(roomName);
        console.log(`User ${socket.user.username} joined room ${roomName}`);
      }
    } catch (error) {
      console.error('Error joining user groups:', error);
      socket.emit('error', { message: 'Failed to join groups' });
    }
  }

  async handleJoinGroup(socket, groupId) {
    try {
      // Verify user is a member of the group
      const isMember = await Group.isUserMember(groupId, socket.userId);
      
      if (!isMember) {
        socket.emit('error', { message: 'Not authorized to join this group' });
        return;
      }

      const roomName = `group_${groupId}`;
      socket.join(roomName);
      
      console.log(`User ${socket.user.username} joined room ${roomName}`);
      socket.emit('joined_group', { groupId, room: roomName });
      
    } catch (error) {
      console.error('Error joining group:', error);
      socket.emit('error', { message: 'Failed to join group' });
    }
  }

  handleLeaveGroup(socket, groupId) {
    const roomName = `group_${groupId}`;
    socket.leave(roomName);
    console.log(`User ${socket.user.username} left room ${roomName}`);
    socket.emit('left_group', { groupId, room: roomName });
  }

  // Broadcast events to group members
  broadcastToGroup(groupId, event, data) {
    const roomName = `group_${groupId}`;
    this.io.to(roomName).emit(event, data);
    console.log(`Broadcasting ${event} to room ${roomName}:`, data);
  }

  // Broadcast to group members except sender
  broadcastToGroupExcept(groupId, senderSocketId, event, data) {
    const roomName = `group_${groupId}`;
    this.io.to(roomName).except(senderSocketId).emit(event, data);
    console.log(`Broadcasting ${event} to room ${roomName} (except ${senderSocketId}):`, data);
  }

  // Get connected users in a group
  async getGroupConnectedUsers(groupId) {
    const roomName = `group_${groupId}`;
    const sockets = await this.io.in(roomName).fetchSockets();
    return sockets.map(socket => ({
      userId: socket.userId,
      username: socket.user.username,
      socketId: socket.id
    }));
  }

  // Check if user is connected
  async isUserConnected(userId) {
    const sockets = await this.io.fetchSockets();
    return sockets.some(socket => socket.userId === userId);
  }

  // Send message to specific user
  async sendToUser(userId, event, data) {
    const sockets = await this.io.fetchSockets();
    const userSockets = sockets.filter(socket => socket.userId === userId);
    
    userSockets.forEach(socket => {
      socket.emit(event, data);
    });
    
    return userSockets.length > 0;
  }

  // Get server instance for external use
  getIO() {
    return this.io;
  }
}

module.exports = SocketServer;