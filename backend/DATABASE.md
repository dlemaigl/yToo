# Database Documentation

## Overview

The yToo application uses PostgreSQL as its primary database with a focus on privacy and anonymity for voting activities.

## Schema Design

### Core Tables

#### users
- Stores user authentication and profile information
- Uses UUID primary keys for security
- Passwords are hashed using bcrypt with 12 salt rounds

#### groups
- Represents voting groups created by users
- Each group has a unique invite token (UUID) for sharing
- Creator is automatically added as the first member

#### group_members
- Junction table linking users to groups
- Enforces unique constraint to prevent duplicate memberships
- Tracks when users joined groups

#### activities
- Stores activity proposals within groups
- **Intentionally excludes creator_id for anonymity**
- Tracks chosen status for majority voting results

#### votes
- **Private table - never exposed via API**
- Records user votes for activities
- Enforces one vote per user per activity
- Used only for internal majority calculations

### Privacy Features

1. **Anonymous Activity Creation**: Activities table has no creator_id field
2. **Hidden Vote Counts**: Vote information is never exposed to clients
3. **Private Voting**: Individual votes are never revealed
4. **Majority-Only Results**: Only shows if activity is chosen (>50% votes)

## Database Connection

### Configuration
The database connection is configured in `src/config/database.js` with:
- Connection pooling (max 20 connections)
- Automatic reconnection handling
- Query logging for development
- Graceful error handling

### Environment Variables
```bash
DATABASE_URL=postgresql://ytoo_user:ytoo_password@localhost:5432/ytoo_dev
# OR individual components:
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ytoo_dev
POSTGRES_USER=ytoo_user
POSTGRES_PASSWORD=ytoo_password
```

## Models

### User Model (`src/models/User.js`)
- **create(userData)**: Create new user with hashed password
- **findById(id)**: Find user by UUID
- **findByUsername(username)**: Find user by username
- **findByEmail(email)**: Find user by email
- **verifyPassword(password)**: Verify password against hash
- **toJSON()**: Serialize user (excludes password hash)

### Group Model (`src/models/Group.js`)
- **create({name, creatorId})**: Create group and add creator as member
- **findById(id)**: Find group by UUID
- **findByInviteToken(token)**: Find group by invite token
- **findByUserId(userId)**: Get all groups for a user
- **getMembers()**: Get all group members
- **getMemberCount()**: Get total member count
- **isMember(userId)**: Check if user is group member
- **addMember(userId)**: Add user to group

### Activity Model (`src/models/Activity.js`)
- **create({groupId, title, description})**: Create anonymous activity
- **findById(id)**: Find activity by UUID
- **findByGroupId(groupId)**: Get all activities for group
- **getVoteCount()**: Internal method for vote counting
- **checkMajority()**: Internal method for majority calculation
- **updateChosenStatus(isChosen)**: Update chosen status
- **toJSON()**: Serialize activity (excludes vote data)

### Vote Model (`src/models/Vote.js`)
- **castVote({activityId, userId})**: Cast or update vote
- **removeVote({activityId, userId})**: Remove user's vote
- **hasUserVoted({activityId, userId})**: Check if user voted
- **getUserVote({activityId, userId})**: Get user's vote
- **getVoteCount(activityId)**: Internal vote counting
- **calculateGroupMajorities(groupId)**: Calculate all activity majorities
- **toJSON()**: Serialize vote (excludes user ID)

## Migrations

### Migration System
Located in `src/migrations/`:
- **migrate.js**: Migration runner with CLI interface
- **scripts/**: SQL migration files

### Running Migrations
```bash
# Run all pending migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback
```

### Migration Files
- `001_initial_schema.sql`: Creates all core tables, indexes, and triggers

## Indexes

Performance indexes are created for:
- `groups.creator_id` - Fast group lookups by creator
- `groups.invite_token` - Fast group joins via invite links
- `group_members.group_id` - Fast member lookups
- `group_members.user_id` - Fast user group lookups
- `activities.group_id` - Fast activity lookups by group
- `votes.activity_id` - Fast vote counting
- `votes.user_id` - Fast user vote lookups
- `votes(activity_id, user_id)` - Composite index for vote uniqueness

## Triggers

Automatic `updated_at` triggers on:
- users
- groups  
- activities
- votes

## Testing

### Unit Tests
Run model tests: `npm test`

### Integration Tests
Run database integration test: `node src/test-db.js`

### Test Coverage
- User creation and authentication
- Group creation and membership
- Anonymous activity creation
- Anonymous voting
- Majority calculation
- Privacy protection (JSON serialization)

## Security Considerations

1. **Password Security**: bcrypt with 12 salt rounds
2. **UUID Primary Keys**: Prevent enumeration attacks
3. **Anonymous Activities**: No creator tracking
4. **Private Votes**: Never exposed via API
5. **Input Validation**: Parameterized queries prevent SQL injection
6. **Connection Security**: SSL support for production

## Performance Considerations

1. **Connection Pooling**: Max 20 concurrent connections
2. **Strategic Indexes**: Optimized for common query patterns
3. **Query Logging**: Monitor performance in development
4. **Efficient Majority Calculation**: Single query for all activities

## Privacy Compliance

The database design ensures:
- Activity creators remain anonymous
- Individual votes are never revealed
- Only majority results are exposed
- Vote counts and statistics are hidden
- User voting patterns cannot be tracked