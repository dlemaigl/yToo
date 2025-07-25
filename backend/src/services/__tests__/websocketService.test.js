const WebSocketService = require('../websocketService');

describe('WebSocketService', () => {
  let websocketService;
  let mockSocketServer;

  const mockActivity = {
    id: 'activity-1',
    title: 'Test Activity',
    description: 'Test Description',
    isChosen: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockUser = {
    id: 'user-1',
    username: 'testuser'
  };

  const mockGroupId = 'group-1';

  beforeEach(() => {
    mockSocketServer = {
      broadcastToGroup: jest.fn(),
      broadcastToGroupExcept: jest.fn(),
      sendToUser: jest.fn(),
      getGroupConnectedUsers: jest.fn().mockResolvedValue([
        { userId: 'user-1', username: 'user1', socketId: 'socket-1' },
        { userId: 'user-2', username: 'user2', socketId: 'socket-2' }
      ]),
      getIO: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([
          { userId: 'user-1', user: { username: 'user1' }, id: 'socket-1', handshake: { time: new Date() } },
          { userId: 'user-2', user: { username: 'user2' }, id: 'socket-2', handshake: { time: new Date() } }
        ])
      })
    };

    websocketService = new WebSocketService(mockSocketServer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Activity Events', () => {
    test('should notify activity added to all group members', async () => {
      await websocketService.notifyActivityAdded(mockGroupId, mockActivity);

      expect(mockSocketServer.broadcastToGroup).toHaveBeenCalledWith(
        mockGroupId,
        'group:activity_added',
        {
          groupId: mockGroupId,
          activity: {
            id: mockActivity.id,
            title: mockActivity.title,
            description: mockActivity.description,
            isChosen: mockActivity.isChosen,
            createdAt: mockActivity.createdAt
          }
        }
      );
    });

    test('should notify activity added excluding specific user', async () => {
      await websocketService.notifyActivityAdded(mockGroupId, mockActivity, 'user-1');

      expect(mockSocketServer.getGroupConnectedUsers).toHaveBeenCalledWith(mockGroupId);
      expect(mockSocketServer.broadcastToGroupExcept).toHaveBeenCalledWith(
        mockGroupId,
        'socket-1',
        'group:activity_added',
        expect.objectContaining({
          groupId: mockGroupId,
          activity: expect.objectContaining({
            id: mockActivity.id,
            title: mockActivity.title
          })
        })
      );
    });

    test('should notify activity chosen', async () => {
      const chosenActivity = { ...mockActivity, isChosen: true };
      
      await websocketService.notifyActivityChosen(mockGroupId, chosenActivity);

      expect(mockSocketServer.broadcastToGroup).toHaveBeenCalledWith(
        mockGroupId,
        'group:activity_chosen',
        {
          groupId: mockGroupId,
          activityId: chosenActivity.id,
          activity: {
            id: chosenActivity.id,
            title: chosenActivity.title,
            description: chosenActivity.description,
            isChosen: true,
            updatedAt: chosenActivity.updatedAt
          }
        }
      );
    });

    test('should notify activity unchosen', async () => {
      const unchosenActivity = { ...mockActivity, isChosen: false };
      
      await websocketService.notifyActivityUnchosen(mockGroupId, unchosenActivity);

      expect(mockSocketServer.broadcastToGroup).toHaveBeenCalledWith(
        mockGroupId,
        'group:activity_unchosen',
        {
          groupId: mockGroupId,
          activityId: unchosenActivity.id,
          activity: {
            id: unchosenActivity.id,
            title: unchosenActivity.title,
            description: unchosenActivity.description,
            isChosen: false,
            updatedAt: unchosenActivity.updatedAt
          }
        }
      );
    });
  });

  describe('Member Events', () => {
    test('should notify member joined to all group members', async () => {
      await websocketService.notifyMemberJoined(mockGroupId, mockUser);

      expect(mockSocketServer.broadcastToGroup).toHaveBeenCalledWith(
        mockGroupId,
        'group:member_joined',
        {
          groupId: mockGroupId,
          member: {
            id: mockUser.id,
            username: mockUser.username,
            joinedAt: expect.any(String)
          }
        }
      );
    });

    test('should notify member joined excluding specific user', async () => {
      await websocketService.notifyMemberJoined(mockGroupId, mockUser, 'user-1');

      expect(mockSocketServer.getGroupConnectedUsers).toHaveBeenCalledWith(mockGroupId);
      expect(mockSocketServer.broadcastToGroupExcept).toHaveBeenCalledWith(
        mockGroupId,
        'socket-1',
        'group:member_joined',
        expect.objectContaining({
          groupId: mockGroupId,
          member: expect.objectContaining({
            id: mockUser.id,
            username: mockUser.username
          })
        })
      );
    });
  });

  describe('Vote Events', () => {
    test('should notify vote status changed without exposing vote details', async () => {
      await websocketService.notifyVoteStatusChanged(mockGroupId, mockActivity.id);

      expect(mockSocketServer.broadcastToGroup).toHaveBeenCalledWith(
        mockGroupId,
        'group:vote_updated',
        {
          groupId: mockGroupId,
          activityId: mockActivity.id,
          timestamp: expect.any(String)
        }
      );
    });
  });

  describe('Connection Events', () => {
    test('should notify user connected', async () => {
      await websocketService.notifyUserConnected(mockGroupId, mockUser);

      expect(mockSocketServer.broadcastToGroup).toHaveBeenCalledWith(
        mockGroupId,
        'group:user_connected',
        {
          groupId: mockGroupId,
          user: {
            id: mockUser.id,
            username: mockUser.username
          },
          timestamp: expect.any(String)
        }
      );
    });

    test('should notify user disconnected', async () => {
      await websocketService.notifyUserDisconnected(mockGroupId, mockUser);

      expect(mockSocketServer.broadcastToGroup).toHaveBeenCalledWith(
        mockGroupId,
        'group:user_disconnected',
        {
          groupId: mockGroupId,
          user: {
            id: mockUser.id,
            username: mockUser.username
          },
          timestamp: expect.any(String)
        }
      );
    });
  });

  describe('Error Handling', () => {
    test('should notify user of error', async () => {
      const error = new Error('Test error');
      
      await websocketService.notifyError('user-1', error);

      expect(mockSocketServer.sendToUser).toHaveBeenCalledWith(
        'user-1',
        'error',
        {
          message: 'Test error',
          timestamp: expect.any(String)
        }
      );
    });
  });

  describe('Statistics', () => {
    test('should get connection stats', async () => {
      const stats = await websocketService.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: 2,
        connectedUsers: [
          {
            userId: 'user-1',
            username: 'user1',
            socketId: 'socket-1',
            connectedAt: expect.any(Date)
          },
          {
            userId: 'user-2',
            username: 'user2',
            socketId: 'socket-2',
            connectedAt: expect.any(Date)
          }
        ]
      });
    });

    test('should get group connection stats', async () => {
      const stats = await websocketService.getGroupConnectionStats(mockGroupId);

      expect(stats).toEqual({
        groupId: mockGroupId,
        connectedCount: 2,
        connectedUsers: [
          { userId: 'user-1', username: 'user1', socketId: 'socket-1' },
          { userId: 'user-2', username: 'user2', socketId: 'socket-2' }
        ]
      });
    });
  });

  describe('Privacy Protection', () => {
    test('should not expose vote counts in activity events', async () => {
      await websocketService.notifyActivityAdded(mockGroupId, mockActivity);

      const broadcastCall = mockSocketServer.broadcastToGroup.mock.calls[0];
      const eventData = broadcastCall[2];

      expect(eventData.activity).not.toHaveProperty('voteCount');
      expect(eventData.activity).not.toHaveProperty('votes');
      expect(eventData.activity).not.toHaveProperty('voters');
    });

    test('should not expose creator information in activity events', async () => {
      await websocketService.notifyActivityAdded(mockGroupId, mockActivity);

      const broadcastCall = mockSocketServer.broadcastToGroup.mock.calls[0];
      const eventData = broadcastCall[2];

      expect(eventData.activity).not.toHaveProperty('creatorId');
      expect(eventData.activity).not.toHaveProperty('creator');
    });

    test('should not expose vote details in vote status change', async () => {
      await websocketService.notifyVoteStatusChanged(mockGroupId, mockActivity.id);

      const broadcastCall = mockSocketServer.broadcastToGroup.mock.calls[0];
      const eventData = broadcastCall[2];

      expect(eventData).not.toHaveProperty('voteCount');
      expect(eventData).not.toHaveProperty('votes');
      expect(eventData).not.toHaveProperty('voters');
      expect(eventData).toHaveProperty('activityId');
      expect(eventData).toHaveProperty('timestamp');
    });
  });
});