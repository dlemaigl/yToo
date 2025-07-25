const { User, Group, Activity, Vote } = require('../index');
const db = require('../../config/database');

// Mock database for testing
jest.mock('../../config/database');

describe('Database Models', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Model', () => {
    test('should create a new user', async () => {
      const mockUserData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date()
      };

      db.query.mockResolvedValue({ rows: [mockUserData] });

      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      expect(user).toBeInstanceOf(User);
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(db.query).toHaveBeenCalled();
    });

    test('should find user by ID', async () => {
      const mockUserData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        created_at: new Date(),
        updated_at: new Date()
      };

      db.query.mockResolvedValue({ rows: [mockUserData] });

      const user = await User.findById('123e4567-e89b-12d3-a456-426614174000');

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        ['123e4567-e89b-12d3-a456-426614174000']
      );
    });

    test('should return null when user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const user = await User.findById('nonexistent-id');

      expect(user).toBeNull();
    });

    test('should convert to JSON without password hash', () => {
      const userData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        created_at: new Date(),
        updated_at: new Date()
      };

      const user = new User(userData);
      const json = user.toJSON();

      expect(json).not.toHaveProperty('passwordHash');
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('username');
      expect(json).toHaveProperty('email');
    });
  });

  describe('Group Model', () => {
    test('should create a new group with creator as member', async () => {
      const mockGroupData = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Group',
        creator_id: '123e4567-e89b-12d3-a456-426614174000',
        invite_token: '123e4567-e89b-12d3-a456-426614174002',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [mockGroupData] }) // INSERT group
          .mockResolvedValueOnce({ rows: [] }) // INSERT member
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn()
      };

      db.getClient.mockResolvedValue(mockClient);

      const group = await Group.create({
        name: 'Test Group',
        creatorId: '123e4567-e89b-12d3-a456-426614174000'
      });

      expect(group).toBeInstanceOf(Group);
      expect(group.name).toBe('Test Group');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should find group by invite token', async () => {
      const mockGroupData = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Group',
        creator_id: '123e4567-e89b-12d3-a456-426614174000',
        invite_token: '123e4567-e89b-12d3-a456-426614174002',
        created_at: new Date(),
        updated_at: new Date()
      };

      db.query.mockResolvedValue({ rows: [mockGroupData] });

      const group = await Group.findByInviteToken('123e4567-e89b-12d3-a456-426614174002');

      expect(group).toBeInstanceOf(Group);
      expect(group.inviteToken).toBe('123e4567-e89b-12d3-a456-426614174002');
    });
  });

  describe('Activity Model', () => {
    test('should create anonymous activity', async () => {
      const mockActivityData = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        group_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Activity',
        description: 'Test Description',
        is_chosen: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      db.query.mockResolvedValue({ rows: [mockActivityData] });

      const activity = await Activity.create({
        groupId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Activity',
        description: 'Test Description'
      });

      expect(activity).toBeInstanceOf(Activity);
      expect(activity.title).toBe('Test Activity');
      expect(activity.groupId).toBe('123e4567-e89b-12d3-a456-426614174001');
    });

    test('should not expose vote counts in JSON', () => {
      const activityData = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        group_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Activity',
        description: 'Test Description',
        is_chosen: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      const activity = new Activity(activityData);
      const json = activity.toJSON();

      expect(json).not.toHaveProperty('voteCount');
      expect(json).not.toHaveProperty('creatorId');
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('title');
      expect(json).toHaveProperty('isChosen');
    });
  });

  describe('Vote Model', () => {
    test('should cast vote', async () => {
      const mockVoteData = {
        id: '123e4567-e89b-12d3-a456-426614174004',
        activity_id: '123e4567-e89b-12d3-a456-426614174003',
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        created_at: new Date(),
        updated_at: new Date()
      };

      db.query.mockResolvedValue({ rows: [mockVoteData] });

      const vote = await Vote.castVote({
        activityId: '123e4567-e89b-12d3-a456-426614174003',
        userId: '123e4567-e89b-12d3-a456-426614174000'
      });

      expect(vote).toBeInstanceOf(Vote);
      expect(vote.activityId).toBe('123e4567-e89b-12d3-a456-426614174003');
    });

    test('should not expose user ID in JSON', () => {
      const voteData = {
        id: '123e4567-e89b-12d3-a456-426614174004',
        activity_id: '123e4567-e89b-12d3-a456-426614174003',
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        created_at: new Date(),
        updated_at: new Date()
      };

      const vote = new Vote(voteData);
      const json = vote.toJSON();

      expect(json).not.toHaveProperty('userId');
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('activityId');
    });
  });
});