// WebSocket service for handling real-time events
class WebSocketService {
  constructor(socketServer) {
    this.socketServer = socketServer;
  }

  // Activity-related events
  async notifyActivityAdded(groupId, activity, excludeUserId = null) {
    const event = 'group:activity_added';
    const data = {
      groupId,
      activity: {
        id: activity.id,
        title: activity.title,
        description: activity.description,
        isChosen: activity.isChosen,
        createdAt: activity.createdAt
        // Note: No creator information to maintain anonymity
      }
    };

    if (excludeUserId) {
      // Find the socket ID of the user to exclude
      const connectedUsers = await this.socketServer.getGroupConnectedUsers(groupId);
      const excludeUser = connectedUsers.find(user => user.userId === excludeUserId);
      
      if (excludeUser) {
        this.socketServer.broadcastToGroupExcept(groupId, excludeUser.socketId, event, data);
      } else {
        this.socketServer.broadcastToGroup(groupId, event, data);
      }
    } else {
      this.socketServer.broadcastToGroup(groupId, event, data);
    }
  }

  async notifyActivityChosen(groupId, activity) {
    const event = 'group:activity_chosen';
    const data = {
      groupId,
      activityId: activity.id,
      activity: {
        id: activity.id,
        title: activity.title,
        description: activity.description,
        isChosen: true,
        updatedAt: activity.updatedAt
      }
    };

    this.socketServer.broadcastToGroup(groupId, event, data);
  }

  async notifyActivityUnchosen(groupId, activity) {
    const event = 'group:activity_unchosen';
    const data = {
      groupId,
      activityId: activity.id,
      activity: {
        id: activity.id,
        title: activity.title,
        description: activity.description,
        isChosen: false,
        updatedAt: activity.updatedAt
      }
    };

    this.socketServer.broadcastToGroup(groupId, event, data);
  }

  // Group membership events
  async notifyMemberJoined(groupId, user, excludeUserId = null) {
    const event = 'group:member_joined';
    const data = {
      groupId,
      member: {
        id: user.id,
        username: user.username,
        joinedAt: new Date().toISOString()
      }
    };

    if (excludeUserId) {
      const connectedUsers = await this.socketServer.getGroupConnectedUsers(groupId);
      const excludeUser = connectedUsers.find(user => user.userId === excludeUserId);
      
      if (excludeUser) {
        this.socketServer.broadcastToGroupExcept(groupId, excludeUser.socketId, event, data);
      } else {
        this.socketServer.broadcastToGroup(groupId, event, data);
      }
    } else {
      this.socketServer.broadcastToGroup(groupId, event, data);
    }
  }

  // Vote-related events (without exposing vote details)
  async notifyVoteStatusChanged(groupId, activityId) {
    // This is called when votes change but we don't expose vote counts
    // We only notify about activity status changes (chosen/unchosen)
    const event = 'group:vote_updated';
    const data = {
      groupId,
      activityId,
      timestamp: new Date().toISOString()
      // Note: No vote counts or user voting information
    };

    this.socketServer.broadcastToGroup(groupId, event, data);
  }

  // Connection status events
  async notifyUserConnected(groupId, user) {
    const event = 'group:user_connected';
    const data = {
      groupId,
      user: {
        id: user.id,
        username: user.username
      },
      timestamp: new Date().toISOString()
    };

    this.socketServer.broadcastToGroup(groupId, event, data);
  }

  async notifyUserDisconnected(groupId, user) {
    const event = 'group:user_disconnected';
    const data = {
      groupId,
      user: {
        id: user.id,
        username: user.username
      },
      timestamp: new Date().toISOString()
    };

    this.socketServer.broadcastToGroup(groupId, event, data);
  }

  // Error handling
  async notifyError(userId, error) {
    const event = 'error';
    const data = {
      message: error.message || 'An error occurred',
      timestamp: new Date().toISOString()
    };

    await this.socketServer.sendToUser(userId, event, data);
  }

  // Health check for WebSocket connections
  async getConnectionStats() {
    const allSockets = await this.socketServer.getIO().fetchSockets();
    
    return {
      totalConnections: allSockets.length,
      connectedUsers: allSockets.map(socket => ({
        userId: socket.userId,
        username: socket.user?.username,
        socketId: socket.id,
        connectedAt: socket.handshake.time
      }))
    };
  }

  // Get connected users for a specific group
  async getGroupConnectionStats(groupId) {
    const connectedUsers = await this.socketServer.getGroupConnectedUsers(groupId);
    
    return {
      groupId,
      connectedCount: connectedUsers.length,
      connectedUsers
    };
  }
}

module.exports = WebSocketService;