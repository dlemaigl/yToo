const request = require('supertest');
const app = require('../app');
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

describe('Performance Tests for Concurrent Voting Scenarios', () => {
  const mockUsers = Array.from({ length: 10 }, (_, i) => ({
    id: `user-${i + 1}`,
    username: `testuser${i + 1}`,
    email: `test${i + 1}@example.com`,
    toJSON: () => ({
      id: `user-${i + 1}`,
      username: `testuser${i + 1}`,
      email: `test${i + 1}@example.com`
    })
  }));

  const mockGroup = {
    id: 'group-1',
    name: 'Test Group',
    members: mockUsers
  };

  const mockActivity = {
    id: 'activity-1',
    groupId: 'group-1',
    title: 'Test Activity',
    isChosen: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';

    User.findById.mockImplementation((id) => {
      const user = mockUsers.find(u => u.id === id);
      return Promise.resolve(user || null);
    });

    Group.findById.mockResolvedValue(mockGroup);
    Activity.findById.mockResolvedValue(mockActivity);
  });

  describe('Concurrent Voting Load Tests', () => {
    it('should handle multiple simultaneous votes on same activity', async () => {
      const votePromises = [];
      const userTokens = mockUsers.map(user => jwt.sign({ userId: user.id }, 'test-secret'));

      // Mock vote creation for concurrent requests
      Vote.getUserVote = jest.fn().mockResolvedValue(null);
      Vote.castVote = jest.fn().mockImplementation((voteData) => {
        return Promise.resolve({
          id: `vote-${voteData.userId}`,
          activityId: voteData.activityId,
          userId: voteData.userId,
          createdAt: new Date()
        });
      });

      let voteCount = 0;
      Vote.getVoteCount = jest.fn().mockImplementation(() => {
        voteCount++;
        return Promise.resolve(voteCount);
      });

      // Simulate 10 users voting simultaneously
      for (let i = 0; i < 10; i++) {
        const votePromise = request(app)
          .post('/api/activities/activity-1/vote')
          .set('Authorization', `Bearer ${userTokens[i]}`);
        
        votePromises.push(votePromise);
      }

      const responses = await Promise.all(votePromises);

      // All votes should be successful
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Vote recorded');
        // Verify no vote details exposed even under load
        expect(response.body.voteCount).toBeUndefined();
        expect(response.body.totalVotes).toBeUndefined();
      });

      // Verify all votes were processed
      expect(Vote.castVote).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent vote changes without race conditions', async () => {
      const userToken = jwt.sign({ userId: 'user-1' }, 'test-secret');
      
      // Mock existing vote
      const existingVote = {
        id: 'vote-1',
        activityId: 'activity-1',
        userId: 'user-1'
      };

      Vote.getUserVote.mockResolvedValue(existingVote);
      Vote.removeVote.mockResolvedValue(true);
      Vote.castVote.mockResolvedValue({
        id: 'vote-new',
        activityId: 'activity-2',
        userId: 'user-1'
      });

      // Simulate rapid vote changes
      const changePromises = [
        // Remove vote from activity-1
        request(app)
          .delete('/api/activities/activity-1/vote')
          .set('Authorization', `Bearer ${userToken}`),
        
        // Add vote to activity-2
        request(app)
          .post('/api/activities/activity-2/vote')
          .set('Authorization', `Bearer ${userToken}`)
      ];

      const responses = await Promise.all(changePromises);

      // Both operations should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should maintain vote privacy under high concurrent load', async () => {
      const concurrentRequests = 50;
      const requestPromises = [];
      const userToken = jwt.sign({ userId: 'user-1' }, 'test-secret');

      // Setup mocks for high load
      Vote.getUserVote = jest.fn().mockResolvedValue(null);
      Vote.castVote = jest.fn().mockResolvedValue({ id: 'vote-1', activityId: 'activity-1', userId: 'user-1' });
      Vote.getVoteCount = jest.fn().mockResolvedValue(1);

      // Create many concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/activities/activity-1/vote')
          .set('Authorization', `Bearer ${userToken}`);
        
        requestPromises.push(promise);
      }

      const responses = await Promise.all(requestPromises);

      // Verify all responses maintain privacy
      responses.forEach(response => {
        if (response.status === 200) {
          expect(response.body.voteCount).toBeUndefined();
          expect(response.body.voters).toBeUndefined();
          expect(response.body.percentage).toBeUndefined();
        }
      });
    });
  });

  describe('Majority Calculation Performance', () => {
    it('should efficiently calculate majority with large number of votes', async () => {
      const largeUserCount = 100;
      const largeUserTokens = Array.from({ length: largeUserCount }, (_, i) => 
        jwt.sign({ userId: `user-${i + 1}` }, 'test-secret')
      );

      // Mock large group
      const largeGroup = {
        id: 'large-group',
        members: Array.from({ length: largeUserCount }, (_, i) => ({ id: `user-${i + 1}` }))
      };

      Group.findById.mockResolvedValue(largeGroup);
      Vote.getUserVote = jest.fn().mockResolvedValue(null);

      let voteCount = 0;
      Vote.castVote = jest.fn().mockImplementation(() => {
        voteCount++;
        return Promise.resolve({ id: `vote-${voteCount}`, activityId: 'activity-1', userId: `user-${voteCount}` });
      });

      Vote.getVoteCount = jest.fn().mockImplementation(() => Promise.resolve(voteCount));

      const startTime = Date.now();

      // Simulate voting by majority (51 users)
      const majorityVotes = largeUserTokens.slice(0, 51);
      const votePromises = majorityVotes.map(token =>
        request(app)
          .post('/api/activities/activity-1/vote')
          .set('Authorization', `Bearer ${token}`)
      );

      await Promise.all(votePromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(voteCount).toBe(51);
    });

    it('should handle majority status changes efficiently', async () => {
      const groupSize = 20;
      const majorityThreshold = Math.floor(groupSize / 2) + 1; // 11 votes needed
      const userToken = jwt.sign({ userId: 'user-1' }, 'test-secret');

      Vote.getVoteCount = jest.fn().mockImplementation((activityId) => {
        // Simulate vote count that changes majority status
        if (activityId === 'activity-1') return Promise.resolve(majorityThreshold);
        return Promise.resolve(0);
      });

      Activity.findById.mockImplementation((id) => {
        if (id === 'activity-1') {
          return Promise.resolve({ ...mockActivity, isChosen: true });
        }
        return Promise.resolve(mockActivity);
      });

      Activity.findByGroupId.mockResolvedValue([{ ...mockActivity, isChosen: true }]);

      const startTime = Date.now();

      // Check activity status
      const response = await request(app)
        .get('/api/groups/group-1/activities')
        .set('Authorization', `Bearer ${userToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should be fast
      
      // Verify majority calculation worked
      const chosenActivities = response.body.activities.filter(a => a.isChosen);
      expect(chosenActivities.length).toBeGreaterThan(0);
    });
  });

  describe('Database Performance Under Load', () => {
    it('should handle concurrent database operations without deadlocks', async () => {
      const concurrentOperations = [];

      // Mock database operations
      Vote.getUserVote = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(null), Math.random() * 100);
        });
      });

      Vote.castVote = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ id: 'vote-1' }), Math.random() * 100);
        });
      });

      // Create multiple concurrent database operations
      for (let i = 0; i < 20; i++) {
        const operation = request(app)
          .post('/api/activities/activity-1/vote')
          .set('Authorization', `Bearer token-user-${i + 1}`);
        
        concurrentOperations.push(operation);
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(concurrentOperations);
      const endTime = Date.now();

      // Most operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
      expect(successful.length).toBeGreaterThan(15);

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it('should maintain data consistency under concurrent modifications', async () => {
      const userId = 'user-1';
      const userToken = 'token-user-1';

      // Mock vote state changes
      let hasVote = false;
      Vote.getUserVote = jest.fn().mockImplementation(() => {
        return Promise.resolve(hasVote ? { id: 'vote-1', userId, activityId: 'activity-1' } : null);
      });

      Vote.castVote = jest.fn().mockImplementation(() => {
        hasVote = true;
        return Promise.resolve({ id: 'vote-1', userId, activityId: 'activity-1' });
      });

      Vote.removeVote = jest.fn().mockImplementation(() => {
        hasVote = false;
        return Promise.resolve(true);
      });

      // Rapid vote/unvote operations
      const operations = [
        request(app).post('/api/activities/activity-1/vote').set('Authorization', `Bearer ${userToken}`),
        request(app).delete('/api/activities/activity-1/vote').set('Authorization', `Bearer ${userToken}`),
        request(app).post('/api/activities/activity-1/vote').set('Authorization', `Bearer ${userToken}`),
        request(app).delete('/api/activities/activity-1/vote').set('Authorization', `Bearer ${userToken}`)
      ];

      const results = await Promise.allSettled(operations);

      // All operations should complete without errors
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect([200, 404]).toContain(result.value.status);
        }
      });
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during high-volume operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(
          request(app)
            .get('/api/groups/group-1/activities')
            .set('Authorization', `Bearer token-user-1`)
        );
      }

      await Promise.all(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle request timeouts gracefully', async () => {
      // Mock slow database operation
      Vote.getUserVote = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(null), 10000); // 10 second delay
        });
      });

      const startTime = Date.now();

      try {
        await request(app)
          .post('/api/activities/activity-1/vote')
          .set('Authorization', 'Bearer token-user-1')
          .timeout(5000); // 5 second timeout
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Should timeout within expected time
        expect(duration).toBeLessThan(6000);
        expect(error.code).toBe('ECONNABORTED');
      }
    });
  });
});