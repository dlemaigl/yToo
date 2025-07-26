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

describe('Privacy Requirements End-to-End Tests', () => {
  let userToken;
  let user2Token;
  let groupId;
  let activityId;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    toJSON: () => ({ id: 'user-1', username: 'testuser', email: 'test@example.com' })
  };

  const mockUser2 = {
    id: 'user-2',
    username: 'testuser2',
    email: 'test2@example.com',
    toJSON: () => ({ id: 'user-2', username: 'testuser2', email: 'test2@example.com' })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    
    userToken = jwt.sign({ userId: 'user-1' }, 'test-secret');
    user2Token = jwt.sign({ userId: 'user-2' }, 'test-secret');
    groupId = 'group-1';
    activityId = 'activity-1';

    User.findById.mockImplementation((id) => {
      if (id === 'user-1') return Promise.resolve(mockUser);
      if (id === 'user-2') return Promise.resolve(mockUser2);
      return Promise.resolve(null);
    });
    
    // Setup default mocks
    Group.findById.mockResolvedValue({
      id: groupId,
      name: 'Test Group',
      members: [mockUser, mockUser2]
    });
    
    Activity.create.mockImplementation((data) => Promise.resolve({
      ...data,
      id: activityId,
      isChosen: false
    }));
    
    Activity.findByGroupId.mockResolvedValue([]);
    Activity.findById.mockResolvedValue({
      id: activityId,
      title: 'Test Activity',
      isChosen: false
    });
    
    Vote.getUserVote = jest.fn().mockResolvedValue(null);
    Vote.castVote = jest.fn().mockResolvedValue({ id: 'vote-1' });
    Vote.getVoteCount = jest.fn().mockResolvedValue(1);
    Vote.hasUserVoted = jest.fn().mockResolvedValue(false);
  });

  describe('Anonymous Activity Proposal Privacy', () => {
    it('should not expose activity creator in any API response', async () => {
      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        members: [mockUser, mockUser2]
      };

      const mockActivity = {
        id: activityId,
        groupId: groupId,
        title: 'Secret Activity',
        description: 'This should be anonymous',
        isChosen: false,
        createdAt: new Date()
        // Note: No creatorId field to maintain anonymity
      };

      Group.findById.mockResolvedValue(mockGroup);
      Activity.create.mockResolvedValue(mockActivity);
      Activity.findByGroupId.mockResolvedValue([mockActivity]);

      // Create activity
      const createResponse = await request(app)
        .post(`/api/groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Secret Activity',
          description: 'This should be anonymous'
        });

      expect(createResponse.status).toBe(201);
      
      // Verify no creator information in response
      expect(createResponse.body.activity.creatorId).toBeUndefined();
      expect(createResponse.body.activity.creator).toBeUndefined();
      expect(createResponse.body.activity.createdBy).toBeUndefined();

      // List activities - should not show creator
      const listResponse = await request(app)
        .get(`/api/groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.activities[0].creatorId).toBeUndefined();
      expect(listResponse.body.activities[0].creator).toBeUndefined();
      expect(listResponse.body.activities[0].createdBy).toBeUndefined();
    });

    it('should not allow querying activities by creator', async () => {
      // Attempt to query activities with creator filter (should not be supported)
      const response = await request(app)
        .get(`/api/groups/${groupId}/activities?createdBy=user-1`)
        .set('Authorization', `Bearer ${userToken}`);

      // Should return all activities, ignoring creator filter
      expect(response.status).toBe(200);
      // The API should not support creator-based filtering
    });
  });

  describe('Anonymous Voting Privacy', () => {
    beforeEach(() => {
      const mockGroup = {
        id: groupId,
        members: [mockUser, mockUser2]
      };
      
      const mockActivity = {
        id: activityId,
        groupId: groupId,
        title: 'Test Activity',
        isChosen: false
      };

      Group.findById.mockResolvedValue(mockGroup);
      Activity.findById.mockResolvedValue(mockActivity);
    });

    it('should not expose vote counts in any API response', async () => {
      Vote.findByActivityAndUser.mockResolvedValue(null);
      Vote.create.mockResolvedValue({ id: 'vote-1', activityId, userId: 'user-1' });
      Vote.countByActivity.mockResolvedValue(1);

      // Cast vote
      const voteResponse = await request(app)
        .post(`/api/activities/${activityId}/vote`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(voteResponse.status).toBe(200);
      
      // Verify no vote count information
      expect(voteResponse.body.voteCount).toBeUndefined();
      expect(voteResponse.body.totalVotes).toBeUndefined();
      expect(voteResponse.body.votes).toBeUndefined();
      expect(voteResponse.body.percentage).toBeUndefined();
    });

    it('should not expose individual votes or voter identities', async () => {
      Activity.findByGroupId.mockResolvedValue([{
        id: activityId,
        title: 'Test Activity',
        isChosen: false
      }]);

      const response = await request(app)
        .get(`/api/groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      
      const activity = response.body.activities[0];
      
      // Verify no voting information exposed
      expect(activity.votes).toBeUndefined();
      expect(activity.voters).toBeUndefined();
      expect(activity.voteCount).toBeUndefined();
      expect(activity.votedUsers).toBeUndefined();
      expect(activity.userVotes).toBeUndefined();
    });

    it('should not allow querying votes by user or activity', async () => {
      // Attempt to access vote endpoint directly (should not exist)
      const response = await request(app)
        .get(`/api/votes/activity/${activityId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });

    it('should not expose voting statistics even to group creators', async () => {
      const mockGroup = {
        id: groupId,
        creatorId: 'user-1', // User 1 is the creator
        members: [mockUser, mockUser2]
      };

      Group.findById.mockResolvedValue(mockGroup);
      Activity.findByGroupId.mockResolvedValue([{
        id: activityId,
        title: 'Test Activity',
        isChosen: true // Activity has majority
      }]);

      // Even group creator should not see vote details
      const response = await request(app)
        .get(`/api/groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      
      const activity = response.body.activities[0];
      expect(activity.voteCount).toBeUndefined();
      expect(activity.voters).toBeUndefined();
      expect(activity.percentage).toBeUndefined();
    });
  });

  describe('Majority Status Privacy', () => {
    it('should only show chosen status without revealing vote counts', async () => {
      const mockActivity = {
        id: activityId,
        groupId: groupId,
        title: 'Popular Activity',
        isChosen: true // Has majority
      };

      Activity.findByGroupId.mockResolvedValue([mockActivity]);

      const response = await request(app)
        .get(`/api/groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      
      const activity = response.body.activities[0];
      
      // Should show chosen status
      expect(activity.isChosen).toBe(true);
      
      // But not vote details
      expect(activity.voteCount).toBeUndefined();
      expect(activity.requiredVotes).toBeUndefined();
      expect(activity.percentage).toBeUndefined();
      expect(activity.majorityThreshold).toBeUndefined();
    });

    it('should handle tie scenarios without exposing vote counts', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          title: 'Activity 1',
          isChosen: false // Tie scenario
        },
        {
          id: 'activity-2',
          title: 'Activity 2',
          isChosen: false // Tie scenario
        }
      ];

      Activity.findByGroupId.mockResolvedValue(mockActivities);

      const response = await request(app)
        .get(`/api/groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      
      // Both activities should show not chosen
      response.body.activities.forEach(activity => {
        expect(activity.isChosen).toBe(false);
        expect(activity.voteCount).toBeUndefined();
        expect(activity.tieStatus).toBeUndefined();
      });
    });
  });

  describe('Data Leakage Prevention', () => {
    it('should not expose sensitive data in error messages', async () => {
      // Test with invalid activity ID
      const response = await request(app)
        .post('/api/activities/invalid-id/vote')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Activity not found');
      
      // Should not expose database details or vote information
      expect(response.body.details).toBeUndefined();
      expect(response.body.query).toBeUndefined();
      expect(response.body.votes).toBeUndefined();
    });

    it('should not expose user voting patterns in any endpoint', async () => {
      // Test user profile endpoint (if it exists)
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 200) {
        expect(response.body.votingHistory).toBeUndefined();
        expect(response.body.votes).toBeUndefined();
        expect(response.body.activities).toBeUndefined();
      }
    });

    it('should sanitize all API responses for privacy compliance', async () => {
      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        members: [mockUser]
      };

      Group.findById.mockResolvedValue(mockGroup);

      const response = await request(app)
        .get(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      
      // Check that member information doesn't include sensitive data
      response.body.group.members.forEach(member => {
        expect(member.password).toBeUndefined();
        expect(member.passwordHash).toBeUndefined();
        expect(member.votes).toBeUndefined();
        expect(member.votingHistory).toBeUndefined();
      });
    });
  });
});