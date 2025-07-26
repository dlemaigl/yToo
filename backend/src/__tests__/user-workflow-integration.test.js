const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');

// Mock all models
jest.mock('../models/User');
jest.mock('../models/Group');
jest.mock('../models/Activity');
jest.mock('../models/Vote');

const User = require('../models/User');
const Group = require('../models/Group');
const Activity = require('../models/Activity');
const Vote = require('../models/Vote');

describe('Complete User Workflow Integration Tests', () => {
  let userToken;
  let groupId;
  let activityId;
  
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    verifyPassword: jest.fn().mockResolvedValue(true),
    toJSON: () => ({
      id: 'user-1',
      username: 'testuser',
      email: 'test@example.com'
    })
  };

  const mockUser2 = {
    id: 'user-2',
    username: 'testuser2',
    email: 'test2@example.com',
    verifyPassword: jest.fn().mockResolvedValue(true),
    toJSON: () => ({
      id: 'user-2',
      username: 'testuser2',
      email: 'test2@example.com'
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    
    // Setup default mocks
    User.create.mockResolvedValue(mockUser);
    User.findByUsername.mockResolvedValue(mockUser);
    User.findById.mockResolvedValue(mockUser);
    
    // Mock Group methods
    Group.create.mockImplementation((data) => Promise.resolve({
      ...data,
      id: 'group-1',
      inviteToken: 'invite-token-123',
      toJSON: () => ({
        ...data,
        id: 'group-1',
        inviteToken: 'invite-token-123'
      })
    }));
    
    Group.findById.mockResolvedValue({
      id: 'group-1',
      name: 'Test Group',
      members: [mockUser]
    });
    
    Group.findByUserId.mockResolvedValue([]);
    
    // Mock Activity methods
    Activity.create.mockImplementation((data) => Promise.resolve({
      ...data,
      id: 'activity-1',
      isChosen: false
    }));
    
    Activity.findByGroupId.mockResolvedValue([]);
    Activity.findById.mockResolvedValue({
      id: 'activity-1',
      title: 'Test Activity',
      isChosen: false
    });
    
    // Mock Vote methods
    Vote.getUserVote = jest.fn().mockResolvedValue(null);
    Vote.castVote = jest.fn().mockResolvedValue({ id: 'vote-1' });
    Vote.removeVote = jest.fn().mockResolvedValue(true);
    Vote.getVoteCount = jest.fn().mockResolvedValue(1);
    Vote.hasUserVoted = jest.fn().mockResolvedValue(false);
  });

  describe('Complete Group Activity Voting Workflow', () => {
    it('should complete full workflow: register -> create group -> invite -> propose activity -> vote -> majority decision', async () => {
      // Step 1: User registration
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.accessToken).toBeDefined();
      userToken = registerResponse.body.accessToken;

      // Step 2: Create a group
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        creatorId: 'user-1',
        inviteToken: 'invite-token-123',
        createdAt: new Date(),
        members: [mockUser]
      };

      Group.create.mockResolvedValue(mockGroup);
      Group.findById.mockResolvedValue(mockGroup);
      Group.findByInviteToken.mockResolvedValue(mockGroup);

      const createGroupResponse = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Test Group' });

      expect(createGroupResponse.status).toBe(201);
      expect(createGroupResponse.body.group.name).toBe('Test Group');
      expect(createGroupResponse.body.group.inviteToken).toBeDefined();
      groupId = createGroupResponse.body.group.id;

      // Step 3: Second user joins via invite
      User.findByUsername.mockResolvedValueOnce(mockUser2);
      User.findById.mockResolvedValueOnce(mockUser2);

      const user2RegisterResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser2',
          email: 'test2@example.com',
          password: 'password123'
        });

      const user2Token = user2RegisterResponse.body.accessToken;

      const joinGroupResponse = await request(app)
        .post(`/api/groups/${groupId}/join`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ inviteToken: 'invite-token-123' });

      expect(joinGroupResponse.status).toBe(200);

      // Step 4: Propose an activity (anonymously)
      const mockActivity = {
        id: 'activity-1',
        groupId: 'group-1',
        title: 'Go to the movies',
        description: 'Watch the latest blockbuster',
        isChosen: false,
        createdAt: new Date()
      };

      Activity.create.mockResolvedValue(mockActivity);
      Activity.findByGroupId.mockResolvedValue([mockActivity]);

      const proposeActivityResponse = await request(app)
        .post(`/api/groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Go to the movies',
          description: 'Watch the latest blockbuster'
        });

      expect(proposeActivityResponse.status).toBe(201);
      expect(proposeActivityResponse.body.activity.title).toBe('Go to the movies');
      // Verify anonymity - no creator information
      expect(proposeActivityResponse.body.activity.creatorId).toBeUndefined();
      activityId = proposeActivityResponse.body.activity.id;

      // Step 5: Vote on the activity
      const mockVote = {
        id: 'vote-1',
        activityId: 'activity-1',
        userId: 'user-1',
        createdAt: new Date()
      };

      Vote.create.mockResolvedValue(mockVote);
      Vote.findByActivityAndUser.mockResolvedValue(null);
      Vote.countByActivity.mockResolvedValue(1);

      const voteResponse = await request(app)
        .post(`/api/activities/${activityId}/vote`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(voteResponse.status).toBe(200);
      expect(voteResponse.body.message).toBe('Vote recorded');
      // Verify vote privacy - no vote details exposed
      expect(voteResponse.body.voteCount).toBeUndefined();
      expect(voteResponse.body.voters).toBeUndefined();

      // Step 6: Second user votes to achieve majority
      Vote.findByActivityAndUser.mockResolvedValueOnce(null);
      Vote.countByActivity.mockResolvedValue(2);
      Activity.findById.mockResolvedValue({ ...mockActivity, isChosen: true });

      const vote2Response = await request(app)
        .post(`/api/activities/${activityId}/vote`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(vote2Response.status).toBe(200);

      // Step 7: Verify activity list shows chosen status without vote details
      Activity.findByGroupId.mockResolvedValue([{ ...mockActivity, isChosen: true }]);

      const activitiesResponse = await request(app)
        .get(`/api/groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(activitiesResponse.status).toBe(200);
      expect(activitiesResponse.body.activities[0].isChosen).toBe(true);
      // Verify privacy - no vote counts or voter information
      expect(activitiesResponse.body.activities[0].voteCount).toBeUndefined();
      expect(activitiesResponse.body.activities[0].voters).toBeUndefined();
    });

    it('should handle vote changes and majority recalculation', async () => {
      // Setup: User with token and group with activity
      const token = jwt.sign({ userId: 'user-1' }, 'test-secret');
      User.findById.mockResolvedValue(mockUser);
      
      const mockActivity = {
        id: 'activity-1',
        groupId: 'group-1',
        title: 'Test Activity',
        isChosen: true
      };

      Activity.findById.mockResolvedValue(mockActivity);
      
      // User changes vote (removes vote)
      const existingVote = { id: 'vote-1', activityId: 'activity-1', userId: 'user-1' };
      Vote.getUserVote.mockResolvedValue(existingVote);
      Vote.removeVote.mockResolvedValue(true);
      Vote.getVoteCount.mockResolvedValue(0);

      const changeVoteResponse = await request(app)
        .delete(`/api/activities/activity-1/vote`)
        .set('Authorization', `Bearer ${token}`);

      expect(changeVoteResponse.status).toBe(200);
      expect(Vote.removeVote).toHaveBeenCalledWith({ activityId: 'activity-1', userId: 'user-1' });
    });
  });

  describe('Group Management Workflow', () => {
    it('should handle complete group lifecycle', async () => {
      const token = jwt.sign({ userId: 'user-1' }, 'test-secret');
      User.findById.mockResolvedValue(mockUser);

      // Create group
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        creatorId: 'user-1',
        inviteToken: 'invite-123',
        toJSON: () => ({
          id: 'group-1',
          name: 'Test Group',
          creatorId: 'user-1',
          inviteToken: 'invite-123'
        })
      };

      Group.create.mockResolvedValue(mockGroup);

      const createResponse = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Group' });

      expect(createResponse.status).toBe(201);

      // List user's groups
      Group.findByUserId.mockResolvedValue([mockGroup]);

      const listResponse = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${token}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.groups).toHaveLength(1);

      // Get group details
      Group.findById.mockResolvedValue({
        ...mockGroup,
        members: [mockUser]
      });

      const detailResponse = await request(app)
        .get('/api/groups/group-1')
        .set('Authorization', `Bearer ${token}`);

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.group.members).toHaveLength(1);
    });
  });
});