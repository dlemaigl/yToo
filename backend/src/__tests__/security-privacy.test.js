const request = require('supertest');
const app = require('../app');
const db = require('../config/database');
const User = require('../models/User');
const Group = require('../models/Group');
const Activity = require('../models/Activity');
const Vote = require('../models/Vote');

describe('Security and Privacy Tests', () => {
  let testUser1, testUser2, testGroup, testActivity;
  let authToken1, authToken2;

  beforeAll(async () => {
    // Clean up any existing test data
    await db.query('DELETE FROM votes WHERE 1=1');
    await db.query('DELETE FROM activities WHERE 1=1');
    await db.query('DELETE FROM group_members WHERE 1=1');
    await db.query('DELETE FROM groups WHERE 1=1');
    await db.query('DELETE FROM users WHERE username LIKE $1', ['sectest%']);
  });

  beforeEach(async () => {
    // Create test users
    testUser1 = await User.create({
      username: 'sectest1',
      email: 'sectest1@example.com',
      password: 'SecurePass123'
    });

    testUser2 = await User.create({
      username: 'sectest2',
      email: 'sectest2@example.com',
      password: 'SecurePass123'
    });

    // Create test group
    testGroup = await Group.create({
      name: 'Security Test Group',
      creatorId: testUser1.id
    });

    // Add second user to group
    await testGroup.addMember(testUser2.id);

    // Create test activity
    testActivity = await Activity.create({
      groupId: testGroup.id,
      title: 'Test Activity',
      description: 'Test activity for security testing'
    });

    // Get auth tokens
    const loginResponse1 = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'sectest1',
        password: 'SecurePass123'
      });
    authToken1 = loginResponse1.body.accessToken;

    const loginResponse2 = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'sectest2',
        password: 'SecurePass123'
      });
    authToken2 = loginResponse2.body.accessToken;
  });

  afterEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM votes WHERE 1=1');
    await db.query('DELETE FROM activities WHERE 1=1');
    await db.query('DELETE FROM group_members WHERE 1=1');
    await db.query('DELETE FROM groups WHERE 1=1');
    await db.query('DELETE FROM users WHERE username LIKE $1', ['sectest%']);
  });

  afterAll(async () => {
    await db.end();
  });

  describe('Input Validation and Sanitization', () => {
    it('should sanitize HTML in group names', async () => {
      const maliciousName = '<script>alert("xss")</script>Test Group';
      
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ name: maliciousName });

      expect(response.status).toBe(201);
      expect(response.body.group.name).not.toContain('<script>');
      expect(response.body.group.name).toContain('&lt;script&gt;');
    });

    it('should sanitize HTML in activity titles', async () => {
      const maliciousTitle = '<img src=x onerror=alert("xss")>Activity';
      
      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ title: maliciousTitle });

      expect(response.status).toBe(201);
      expect(response.body.activity.title).not.toContain('<img');
      expect(response.body.activity.title).not.toContain('onerror');
    });

    it('should reject SQL injection attempts in group names', async () => {
      const sqlInjection = "'; DROP TABLE groups; --";
      
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ name: sqlInjection });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input detected');
    });

    it('should reject JavaScript protocol in descriptions', async () => {
      const jsProtocol = 'javascript:alert("xss")';
      
      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ 
          title: 'Test Activity',
          description: jsProtocol 
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input detected');
    });

    it('should validate UUID formats strictly', async () => {
      const invalidUUIDs = [
        'invalid-uuid',
        '123',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        '12345678-1234-1234-1234-12345678901',
        '../../../etc/passwd'
      ];

      for (const invalidUUID of invalidUUIDs) {
        const response = await request(app)
          .get(`/api/groups/${invalidUUID}`)
          .set('Authorization', `Bearer ${authToken1}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid');
      }
    });

    it('should enforce content-type validation', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken1}`)
        .set('Content-Type', 'text/plain')
        .send('name=Test Group');

      expect(response.status).toBe(415);
      expect(response.body.error).toBe('Content-Type must be application/json');
    });

    it('should enforce request size limits', async () => {
      const largePayload = {
        name: 'A'.repeat(2000000) // 2MB payload
      };

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(largePayload);

      expect(response.status).toBe(413);
      expect(response.body.error).toBe('Request payload too large');
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit authentication attempts', async () => {
      const promises = [];
      
      // Make 15 failed login attempts (limit is 10)
      for (let i = 0; i < 15; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              username: 'nonexistent',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].body.error).toContain('Too many authentication attempts');
    });

    it('should rate limit group creation', async () => {
      const promises = [];
      
      // Attempt to create 15 groups rapidly (limit is 10 per hour)
      for (let i = 0; i < 15; i++) {
        promises.push(
          request(app)
            .post('/api/groups')
            .set('Authorization', `Bearer ${authToken1}`)
            .send({ name: `Test Group ${i}` })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].body.error).toContain('Too many groups created');
    });

    it('should rate limit voting attempts', async () => {
      const promises = [];
      
      // Attempt 35 votes rapidly (limit is 30 per minute)
      for (let i = 0; i < 35; i++) {
        promises.push(
          request(app)
            .post(`/api/activities/${testActivity.id}/vote`)
            .set('Authorization', `Bearer ${authToken1}`)
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].body.error).toContain('Too many voting attempts');
    });
  });

  describe('Privacy Protection - No Sensitive Data Leakage', () => {
    beforeEach(async () => {
      // Cast some votes for testing
      await Vote.castVote(testUser1.id, testActivity.id);
      await Vote.castVote(testUser2.id, testActivity.id);
    });

    it('should not expose vote counts in activity listings', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      
      response.body.activities.forEach(activity => {
        expect(activity.voteCount).toBeUndefined();
        expect(activity.votes).toBeUndefined();
        expect(activity.voters).toBeUndefined();
        expect(activity.votePercentage).toBeUndefined();
        expect(activity.votingStatistics).toBeUndefined();
      });
    });

    it('should not expose activity creators', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      
      response.body.activities.forEach(activity => {
        expect(activity.creatorId).toBeUndefined();
        expect(activity.creator).toBeUndefined();
        expect(activity.createdBy).toBeUndefined();
      });
    });

    it('should not expose individual votes in any endpoint', async () => {
      // Test activity listing
      const activitiesResponse = await request(app)
        .get(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(activitiesResponse.status).toBe(200);
      expect(activitiesResponse.body.activities[0].individualVotes).toBeUndefined();

      // Test group details
      const groupResponse = await request(app)
        .get(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(groupResponse.status).toBe(200);
      expect(groupResponse.body.group.votes).toBeUndefined();
      expect(groupResponse.body.group.votingData).toBeUndefined();
    });

    it('should only expose user\'s own vote status', async () => {
      const response = await request(app)
        .get(`/api/activities/group/${testGroup.id}/vote-status`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.voteStatus).toBeDefined();
      
      response.body.voteStatus.forEach(status => {
        expect(status.activityId).toBeDefined();
        expect(status.hasVoted).toBeDefined();
        // Should not expose other users' votes
        expect(status.otherVotes).toBeUndefined();
        expect(status.totalVotes).toBeUndefined();
        expect(status.voteCount).toBeUndefined();
      });
    });

    it('should not expose user IDs in vote responses', async () => {
      const response = await request(app)
        .post(`/api/activities/${testActivity.id}/vote`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(201);
      expect(response.body.userId).toBeUndefined();
      expect(response.body.voterId).toBeUndefined();
      expect(response.body.vote.userId).toBeUndefined();
    });

    it('should not expose sensitive user information', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/members`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      
      response.body.members.forEach(member => {
        expect(member.passwordHash).toBeUndefined();
        expect(member.password).toBeUndefined();
        expect(member.email).toBeUndefined(); // Email should not be exposed to other members
      });
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['permissions-policy']).toContain('camera=()');
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });

    it('should set no-cache headers for sensitive endpoints', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'sectest1',
          password: 'SecurePass123'
        });

      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['pragma']).toBe('no-cache');
    });
  });

  describe('Authorization and Access Control', () => {
    it('should prevent access to other users\' data', async () => {
      // Create a third user not in the group
      const outsideUser = await User.create({
        username: 'sectest3',
        email: 'sectest3@example.com',
        password: 'SecurePass123'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'sectest3',
          password: 'SecurePass123'
        });
      const outsideToken = loginResponse.body.accessToken;

      // Try to access group data
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${outsideToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Access denied');
    });

    it('should prevent voting on activities in groups user is not member of', async () => {
      // Create a third user not in the group
      const outsideUser = await User.create({
        username: 'sectest4',
        email: 'sectest4@example.com',
        password: 'SecurePass123'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'sectest4',
          password: 'SecurePass123'
        });
      const outsideToken = loginResponse.body.accessToken;

      // Try to vote on activity
      const response = await request(app)
        .post(`/api/activities/${testActivity.id}/vote`)
        .set('Authorization', `Bearer ${outsideToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Access denied');
    });

    it('should require authentication for all protected endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/groups' },
        { method: 'post', path: '/api/groups' },
        { method: 'get', path: `/api/groups/${testGroup.id}` },
        { method: 'post', path: `/api/activities/${testActivity.id}/vote` },
        { method: 'get', path: `/api/activities/group/${testGroup.id}/vote-status` }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose internal errors in production-like responses', async () => {
      // Try to access non-existent group
      const response = await request(app)
        .get('/api/groups/12345678-1234-4234-a234-123456789012')
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Group not found');
      expect(response.body.stack).toBeUndefined();
      expect(response.body.details).toBeUndefined();
    });

    it('should provide generic error messages for authentication failures', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
      // Should not reveal whether username or password was wrong
      expect(response.body.error).not.toContain('username');
      expect(response.body.error).not.toContain('password');
    });
  });
});