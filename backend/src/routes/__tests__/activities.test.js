const request = require('supertest');
const app = require('../../app');
const db = require('../../config/database');
const User = require('../../models/User');
const Group = require('../../models/Group');
const Activity = require('../../models/Activity');

describe('Activity Routes', () => {
  let testUser1, testUser2, testGroup, authToken1, authToken2;

  beforeAll(async () => {
    // Clean up any existing test data
    await db.query('DELETE FROM activities WHERE 1=1');
    await db.query('DELETE FROM group_members WHERE 1=1');
    await db.query('DELETE FROM groups WHERE 1=1');
    await db.query('DELETE FROM users WHERE username LIKE $1', ['testuser%']);
  });

  beforeEach(async () => {
    // Create test users
    testUser1 = await User.create({
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'password123'
    });

    testUser2 = await User.create({
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'password123'
    });

    // Create test group
    testGroup = await Group.create({
      name: 'Test Group',
      creatorId: testUser1.id
    });

    // Add second user to group
    await testGroup.addMember(testUser2.id);

    // Get auth tokens
    const loginResponse1 = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser1',
        password: 'password123'
      });
    authToken1 = loginResponse1.body.accessToken;

    const loginResponse2 = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser2',
        password: 'password123'
      });
    authToken2 = loginResponse2.body.accessToken;
  });

  afterEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM activities WHERE 1=1');
    await db.query('DELETE FROM group_members WHERE 1=1');
    await db.query('DELETE FROM groups WHERE 1=1');
    await db.query('DELETE FROM users WHERE username LIKE $1', ['testuser%']);
  });

  afterAll(async () => {
    await db.end();
  });

  describe('POST /:id/activities', () => {
    it('should create an activity successfully for group member', async () => {
      const activityData = {
        title: 'Test Activity',
        description: 'This is a test activity'
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Activity created successfully');
      expect(response.body.activity).toMatchObject({
        title: 'Test Activity',
        description: 'This is a test activity',
        groupId: testGroup.id,
        isChosen: false
      });
      expect(response.body.activity.id).toBeDefined();
      expect(response.body.activity.createdAt).toBeDefined();
      
      // Verify activity was created in database
      const activity = await Activity.findById(response.body.activity.id);
      expect(activity).toBeTruthy();
      expect(activity.title).toBe('Test Activity');
    });

    it('should create an activity without description', async () => {
      const activityData = {
        title: 'Activity Without Description'
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send(activityData);

      expect(response.status).toBe(201);
      expect(response.body.activity.title).toBe('Activity Without Description');
      expect(response.body.activity.description).toBeNull();
    });

    it('should ensure activity creation is anonymous (no creator tracking)', async () => {
      const activityData = {
        title: 'Anonymous Activity',
        description: 'This should be anonymous'
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(201);
      
      // Verify no creator information is stored or returned
      expect(response.body.activity.creatorId).toBeUndefined();
      expect(response.body.activity.creator).toBeUndefined();
      
      // Check database directly to ensure no creator info is stored
      const activity = await Activity.findById(response.body.activity.id);
      expect(activity.creatorId).toBeUndefined();
    });

    it('should initialize activity with zero votes and not chosen status', async () => {
      const activityData = {
        title: 'New Activity'
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(201);
      expect(response.body.activity.isChosen).toBe(false);
      
      // Verify vote count is zero
      const activity = await Activity.findById(response.body.activity.id);
      const voteCount = await activity.getVoteCount();
      expect(voteCount).toBe(0);
    });

    it('should reject activity creation with missing title', async () => {
      const activityData = {
        description: 'Activity without title'
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Activity title is required and must be a non-empty string');
    });

    it('should reject activity creation with empty title', async () => {
      const activityData = {
        title: '   ',
        description: 'Activity with empty title'
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Activity title is required and must be a non-empty string');
    });

    it('should reject activity creation with non-string title', async () => {
      const activityData = {
        title: 123,
        description: 'Activity with numeric title'
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Activity title is required and must be a non-empty string');
    });

    it('should reject activity creation with title too long', async () => {
      const activityData = {
        title: 'A'.repeat(201), // 201 characters
        description: 'Activity with long title'
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Activity title must be 200 characters or less');
    });

    it('should reject activity creation with non-string description', async () => {
      const activityData = {
        title: 'Valid Title',
        description: 123
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Activity description must be a string');
    });

    it('should reject activity creation with description too long', async () => {
      const activityData = {
        title: 'Valid Title',
        description: 'A'.repeat(1001) // 1001 characters
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Activity description must be 1000 characters or less');
    });

    it('should reject activity creation for non-existent group', async () => {
      const fakeGroupId = '12345678-1234-4234-a234-123456789012';
      const activityData = {
        title: 'Test Activity'
      };

      const response = await request(app)
        .post(`/api/groups/${fakeGroupId}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Group not found');
    });

    it('should reject activity creation for invalid group ID format', async () => {
      const invalidGroupId = 'invalid-id';
      const activityData = {
        title: 'Test Activity'
      };

      const response = await request(app)
        .post(`/api/groups/${invalidGroupId}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid group ID format');
    });

    it('should reject activity creation for non-member', async () => {
      // Create a user who is not a member of the group
      const nonMemberUser = await User.create({
        username: `nonmember_${Date.now()}`,
        email: `nonmember_${Date.now()}@example.com`,
        password: 'password123'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: nonMemberUser.username,
          password: 'password123'
        });
      const nonMemberToken = loginResponse.body.accessToken;

      const activityData = {
        title: 'Unauthorized Activity'
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .send(activityData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied. You are not a member of this group.');
    });

    it('should reject activity creation without authentication', async () => {
      const activityData = {
        title: 'Unauthenticated Activity'
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .send(activityData);

      expect(response.status).toBe(401);
    });

    it('should trim whitespace from title and description', async () => {
      const activityData = {
        title: '  Test Activity  ',
        description: '  This has whitespace  '
      };

      const response = await request(app)
        .post(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(activityData);

      expect(response.status).toBe(201);
      expect(response.body.activity.title).toBe('Test Activity');
      expect(response.body.activity.description).toBe('This has whitespace');
    });
  });

  describe('GET /:id/activities', () => {
    let testActivity1, testActivity2;

    beforeEach(async () => {
      // Create test activities
      testActivity1 = await Activity.create({
        groupId: testGroup.id,
        title: 'First Activity',
        description: 'First test activity'
      });

      testActivity2 = await Activity.create({
        groupId: testGroup.id,
        title: 'Second Activity',
        description: 'Second test activity'
      });
    });

    it('should return activities for group member', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.activities).toHaveLength(2);
      
      // Check that activities are returned in descending order by creation time
      const activities = response.body.activities;
      expect(activities[0].title).toBe('Second Activity');
      expect(activities[1].title).toBe('First Activity');
      
      // Verify no sensitive information is exposed
      activities.forEach(activity => {
        expect(activity.creatorId).toBeUndefined();
        expect(activity.creator).toBeUndefined();
        expect(activity.voteCount).toBeUndefined();
        expect(activity.votes).toBeUndefined();
      });
    });

    it('should return empty array for group with no activities', async () => {
      // Create a new group with no activities
      const emptyGroup = await Group.create({
        name: 'Empty Group',
        creatorId: testUser1.id
      });

      const response = await request(app)
        .get(`/api/groups/${emptyGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.activities).toHaveLength(0);
    });

    it('should reject request for non-existent group', async () => {
      const fakeGroupId = '12345678-1234-4234-a234-123456789012';

      const response = await request(app)
        .get(`/api/groups/${fakeGroupId}/activities`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Group not found');
    });

    it('should reject request with invalid group ID format', async () => {
      const invalidGroupId = 'invalid-id';

      const response = await request(app)
        .get(`/api/groups/${invalidGroupId}/activities`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid group ID format');
    });

    it('should reject request from non-member', async () => {
      // Create a user who is not a member of the group
      const nonMemberUser = await User.create({
        username: `nonmember2_${Date.now()}`,
        email: `nonmember2_${Date.now()}@example.com`,
        password: 'password123'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: nonMemberUser.username,
          password: 'password123'
        });
      const nonMemberToken = loginResponse.body.accessToken;

      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied. You are not a member of this group.');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/activities`);

      expect(response.status).toBe(401);
    });

    it('should include all required activity fields', async () => {
      const response = await request(app)
        .get(`/api/groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`);

      expect(response.status).toBe(200);
      
      const activity = response.body.activities[0];
      expect(activity).toHaveProperty('id');
      expect(activity).toHaveProperty('groupId');
      expect(activity).toHaveProperty('title');
      expect(activity).toHaveProperty('description');
      expect(activity).toHaveProperty('isChosen');
      expect(activity).toHaveProperty('createdAt');
      expect(activity).toHaveProperty('updatedAt');
    });
  });
});