const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const Group = require('../../models/Group');
const User = require('../../models/User');

// Mock the models
jest.mock('../../models/Group');
jest.mock('../../models/User');

describe('Group Management Routes', () => {
  let authToken;
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    
    mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com'
    };

    // Create a valid JWT token for testing
    authToken = jwt.sign(
      { userId: mockUser.id, type: 'access' },
      'test-secret',
      { expiresIn: '15m' }
    );

    // Mock User.findById for auth middleware
    User.findById.mockResolvedValue(mockUser);
  });

  describe('POST /api/groups', () => {
    it('should create a new group successfully', async () => {
      const groupData = {
        name: 'Test Group'
      };

      const mockGroup = {
        id: 'group-123',
        name: 'Test Group',
        creatorId: 'user-123',
        inviteToken: 'invite-token-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        toJSON: () => ({
          id: 'group-123',
          name: 'Test Group',
          creatorId: 'user-123',
          inviteToken: 'invite-token-123',
          createdAt: '2025-07-25T19:41:25.020Z',
          updatedAt: '2025-07-25T19:41:25.020Z'
        })
      };

      Group.create.mockResolvedValue(mockGroup);

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Group created successfully');
      expect(response.body.group).toEqual(mockGroup.toJSON());
      expect(Group.create).toHaveBeenCalledWith({
        name: 'Test Group',
        creatorId: 'user-123'
      });
    });

    it('should return 400 for missing group name', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Group name is required and must be a non-empty string');
      expect(Group.create).not.toHaveBeenCalled();
    });

    it('should return 400 for empty group name', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Group name is required and must be a non-empty string');
      expect(Group.create).not.toHaveBeenCalled();
    });

    it('should return 400 for group name too long', async () => {
      const longName = 'a'.repeat(101);
      
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: longName });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Group name must be 100 characters or less');
      expect(Group.create).not.toHaveBeenCalled();
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/groups')
        .send({ name: 'Test Group' });

      expect(response.status).toBe(401);
      expect(Group.create).not.toHaveBeenCalled();
    });

    it('should trim whitespace from group name', async () => {
      const groupData = {
        name: '  Test Group  '
      };

      const mockGroup = {
        id: 'group-123',
        name: 'Test Group',
        creatorId: 'user-123',
        toJSON: () => ({ id: 'group-123', name: 'Test Group', creatorId: 'user-123' })
      };

      Group.create.mockResolvedValue(mockGroup);

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData);

      expect(response.status).toBe(201);
      expect(Group.create).toHaveBeenCalledWith({
        name: 'Test Group',
        creatorId: 'user-123'
      });
    });
  });

  describe('GET /api/groups', () => {
    it('should return user\'s groups with member counts', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          name: 'Group 1',
          getMemberCount: jest.fn().mockResolvedValue(3),
          toJSON: () => ({ id: 'group-1', name: 'Group 1' })
        },
        {
          id: 'group-2',
          name: 'Group 2',
          getMemberCount: jest.fn().mockResolvedValue(5),
          toJSON: () => ({ id: 'group-2', name: 'Group 2' })
        }
      ];

      Group.findByUserId.mockResolvedValue(mockGroups);

      const response = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.groups).toHaveLength(2);
      expect(response.body.groups[0]).toEqual({
        id: 'group-1',
        name: 'Group 1',
        memberCount: 3
      });
      expect(response.body.groups[1]).toEqual({
        id: 'group-2',
        name: 'Group 2',
        memberCount: 5
      });
      expect(Group.findByUserId).toHaveBeenCalledWith('user-123');
    });

    it('should return empty array when user has no groups', async () => {
      Group.findByUserId.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.groups).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/groups');

      expect(response.status).toBe(401);
      expect(Group.findByUserId).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/groups/:id', () => {
    const validGroupId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return group details with members', async () => {
      const mockGroup = {
        id: validGroupId,
        name: 'Test Group',
        isMember: jest.fn().mockResolvedValue(true),
        getMembers: jest.fn().mockResolvedValue([
          { id: 'user-1', username: 'user1', email: 'user1@example.com', joinedAt: new Date() },
          { id: 'user-2', username: 'user2', email: 'user2@example.com', joinedAt: new Date() }
        ]),
        toJSON: () => ({ id: validGroupId, name: 'Test Group' })
      };

      Group.findById.mockResolvedValue(mockGroup);

      const response = await request(app)
        .get(`/api/groups/${validGroupId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.group.id).toBe(validGroupId);
      expect(response.body.group.members).toHaveLength(2);
      expect(Group.findById).toHaveBeenCalledWith(validGroupId);
      expect(mockGroup.isMember).toHaveBeenCalledWith('user-123');
      expect(mockGroup.getMembers).toHaveBeenCalled();
    });

    it('should return 400 for invalid group ID format', async () => {
      const response = await request(app)
        .get('/api/groups/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid group ID format');
      expect(Group.findById).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent group', async () => {
      Group.findById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/groups/${validGroupId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Group not found');
    });

    it('should return 403 when user is not a member', async () => {
      const mockGroup = {
        isMember: jest.fn().mockResolvedValue(false)
      };

      Group.findById.mockResolvedValue(mockGroup);

      const response = await request(app)
        .get(`/api/groups/${validGroupId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied. You are not a member of this group.');
    });
  });

  describe('POST /api/groups/join/:inviteToken', () => {
    const validInviteToken = '123e4567-e89b-12d3-a456-426614174000';

    it('should join group successfully', async () => {
      const mockGroup = {
        id: 'group-123',
        name: 'Test Group',
        isMember: jest.fn().mockResolvedValue(false),
        addMember: jest.fn().mockResolvedValue({ joined_at: new Date() }),
        toJSON: () => ({ id: 'group-123', name: 'Test Group' })
      };

      Group.findByInviteToken.mockResolvedValue(mockGroup);

      const response = await request(app)
        .post(`/api/groups/join/${validInviteToken}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Successfully joined the group');
      expect(response.body.group).toEqual(mockGroup.toJSON());
      expect(response.body.joinedAt).toBeDefined();
      expect(Group.findByInviteToken).toHaveBeenCalledWith(validInviteToken);
      expect(mockGroup.isMember).toHaveBeenCalledWith('user-123');
      expect(mockGroup.addMember).toHaveBeenCalledWith('user-123');
    });

    it('should return 400 for invalid invite token format', async () => {
      const response = await request(app)
        .post('/api/groups/join/invalid-token')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid invite token format');
      expect(Group.findByInviteToken).not.toHaveBeenCalled();
    });

    it('should return 404 for invalid invite token', async () => {
      Group.findByInviteToken.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/groups/join/${validInviteToken}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invalid or expired invitation link');
    });

    it('should return 400 when user is already a member', async () => {
      const mockGroup = {
        isMember: jest.fn().mockResolvedValue(true)
      };

      Group.findByInviteToken.mockResolvedValue(mockGroup);

      const response = await request(app)
        .post(`/api/groups/join/${validInviteToken}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('You are already a member of this group');
      expect(mockGroup.isMember).toHaveBeenCalledWith('user-123');
    });

    it('should handle database constraint violation', async () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockGroup = {
        isMember: jest.fn().mockResolvedValue(false),
        addMember: jest.fn().mockRejectedValue(new Error('User is already a member of this group'))
      };

      Group.findByInviteToken.mockResolvedValue(mockGroup);

      const response = await request(app)
        .post(`/api/groups/join/${validInviteToken}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User is already a member of this group');
      
      consoleSpy.mockRestore();
    });
  });

  describe('GET /api/groups/:id/members', () => {
    const validGroupId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return group members', async () => {
      const mockMembers = [
        { id: 'user-1', username: 'user1', email: 'user1@example.com', joinedAt: '2025-07-25T19:41:25.105Z' },
        { id: 'user-2', username: 'user2', email: 'user2@example.com', joinedAt: '2025-07-25T19:41:25.105Z' }
      ];

      const mockGroup = {
        isMember: jest.fn().mockResolvedValue(true),
        getMembers: jest.fn().mockResolvedValue(mockMembers)
      };

      Group.findById.mockResolvedValue(mockGroup);

      const response = await request(app)
        .get(`/api/groups/${validGroupId}/members`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.members).toEqual(mockMembers);
      expect(mockGroup.isMember).toHaveBeenCalledWith('user-123');
      expect(mockGroup.getMembers).toHaveBeenCalled();
    });

    it('should return 403 when user is not a member', async () => {
      const mockGroup = {
        isMember: jest.fn().mockResolvedValue(false)
      };

      Group.findById.mockResolvedValue(mockGroup);

      const response = await request(app)
        .get(`/api/groups/${validGroupId}/members`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied. You are not a member of this group.');
    });
  });

  describe('DELETE /api/groups/:id/members/:userId', () => {
    const validGroupId = '123e4567-e89b-12d3-a456-426614174000';
    const validUserId = '123e4567-e89b-12d3-a456-426614174001';

    it('should remove member successfully', async () => {
      const mockGroup = {
        creatorId: 'user-123', // Current user is creator
        isMember: jest.fn().mockResolvedValue(true),
        removeMember: jest.fn().mockResolvedValue(true)
      };

      Group.findById.mockResolvedValue(mockGroup);

      const response = await request(app)
        .delete(`/api/groups/${validGroupId}/members/${validUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Member removed successfully');
      expect(mockGroup.isMember).toHaveBeenCalledWith(validUserId);
      expect(mockGroup.removeMember).toHaveBeenCalledWith(validUserId);
    });

    it('should return 403 when user is not the creator', async () => {
      const mockGroup = {
        creatorId: 'other-user' // Current user is not creator
      };

      Group.findById.mockResolvedValue(mockGroup);

      const response = await request(app)
        .delete(`/api/groups/${validGroupId}/members/${validUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied. Only the group creator can remove members.');
    });

    it('should return 400 when trying to remove creator', async () => {
      const validCreatorId = '123e4567-e89b-12d3-a456-426614174002';
      const mockGroup = {
        creatorId: validCreatorId
      };

      Group.findById.mockResolvedValue(mockGroup);

      // Update the mock user to have the same ID as the creator
      mockUser.id = validCreatorId;

      const response = await request(app)
        .delete(`/api/groups/${validGroupId}/members/${validCreatorId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot remove the group creator');
    });

    it('should return 404 when user is not a member', async () => {
      const mockGroup = {
        creatorId: 'user-123',
        isMember: jest.fn().mockResolvedValue(false)
      };

      Group.findById.mockResolvedValue(mockGroup);

      const response = await request(app)
        .delete(`/api/groups/${validGroupId}/members/${validUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User is not a member of this group');
    });

    it('should return 400 for invalid ID formats', async () => {
      const response = await request(app)
        .delete('/api/groups/invalid-id/members/invalid-user-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid ID format');
      expect(Group.findById).not.toHaveBeenCalled();
    });
  });
});