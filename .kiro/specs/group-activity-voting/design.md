# Design Document - yToo Group Activity Voting App

## Overview

yToo is a web-based group activity voting application that enables anonymous activity proposals and voting with real-time updates. The system prioritizes privacy by hiding vote counts, individual votes, and activity proposers while providing immediate feedback when activities achieve majority status.

The application follows a client-server architecture with real-time communication capabilities to ensure all group members see updates immediately when activities are chosen or new proposals are added.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    Client[Web Client] --> API[REST API Server]
    Client --> WS[WebSocket Server]
    API --> Auth[Authentication Service]
    API --> DB[(Database)]
    WS --> DB
    API --> Vote[Vote Calculation Service]
    Vote --> DB
```

### Technology Stack

- **Frontend**: React.js with TypeScript for type safety
- **Backend**: Node.js with Express.js for REST API
- **Real-time**: Socket.IO for WebSocket communication
- **Database**: PostgreSQL for data persistence
- **Authentication**: JWT tokens with bcrypt for password hashing
- **Development Environment**: Docker Compose for local development
- **Deployment**: Docker containers for consistent deployment

### System Components

1. **Web Client**: React-based SPA handling user interactions
2. **API Server**: Express.js REST API for CRUD operations
3. **WebSocket Server**: Socket.IO server for real-time updates
4. **Authentication Service**: JWT-based user authentication
5. **Vote Calculation Service**: Background service for majority calculations
6. **Database**: PostgreSQL with proper indexing for performance

## Components and Interfaces

### Frontend Components

#### Core Components
- `App`: Main application wrapper with routing
- `AuthProvider`: Authentication context provider
- `GroupList`: Display user's groups
- `GroupDetail`: Main group interface showing activities
- `ActivityProposal`: Form for creating new activities
- `VotingInterface`: Anonymous voting controls
- `InviteLink`: Shareable group invitation component

#### Real-time Integration
- `SocketProvider`: WebSocket connection management
- `useRealTimeUpdates`: Custom hook for real-time data synchronization

### Backend API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh

#### Groups
- `POST /api/groups` - Create new group
- `GET /api/groups` - Get user's groups
- `GET /api/groups/:id` - Get group details
- `POST /api/groups/:id/join` - Join group via invitation

#### Activities
- `POST /api/groups/:id/activities` - Create activity (anonymous)
- `GET /api/groups/:id/activities` - Get group activities
- `POST /api/activities/:id/vote` - Cast vote (anonymous)

#### WebSocket Events
- `group:activity_added` - New activity proposed
- `group:activity_chosen` - Activity achieved majority
- `group:activity_unchosen` - Activity lost majority
- `group:member_joined` - New member joined

## Data Models

### User Model
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Group Model
```typescript
interface Group {
  id: string;
  name: string;
  creatorId: string;
  inviteToken: string; // UUID for shareable links
  createdAt: Date;
  updatedAt: Date;
}
```

### GroupMember Model
```typescript
interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: Date;
}
```

### Activity Model
```typescript
interface Activity {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  isChosen: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Note: No creatorId to maintain anonymity
}
```

### Vote Model
```typescript
interface Vote {
  id: string;
  activityId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  // Note: Votes are private, only used for calculations
}
```

### Database Schema Considerations

#### Privacy Protection
- Activity table excludes `creatorId` to maintain proposal anonymity
- Vote table is never exposed via API, only used for internal calculations
- Invite tokens use UUIDs to prevent enumeration attacks

#### Performance Optimization
- Indexes on `groupId` for activities and votes
- Composite index on `(activityId, userId)` for vote uniqueness
- Index on `inviteToken` for fast group joins

## Error Handling

### Client-Side Error Handling
- Network error recovery with retry logic
- WebSocket reconnection on connection loss
- Form validation with user-friendly messages
- Loading states during API calls

### Server-Side Error Handling
- Input validation using middleware
- Database transaction rollbacks on failures
- Structured error responses with appropriate HTTP codes
- Logging for debugging without exposing sensitive data

### Privacy-Focused Error Messages
- Generic error messages to avoid information leakage
- No exposure of vote counts or user voting patterns
- Sanitized error logs that don't reveal voting behavior

## Testing Strategy

### Unit Testing
- **Frontend**: Jest + React Testing Library
  - Component rendering and user interactions
  - Custom hooks behavior
  - Utility functions
- **Backend**: Jest + Supertest
  - API endpoint functionality
  - Vote calculation logic
  - Authentication middleware

### Integration Testing
- API integration tests with test database
- WebSocket event flow testing
- End-to-end user workflows

### Privacy Testing
- Verify vote anonymity in all scenarios
- Test that activity creators remain anonymous
- Ensure no vote count leakage in API responses
- Validate majority calculation accuracy

### Real-time Testing
- WebSocket connection handling
- Multi-client synchronization
- Network interruption recovery
- Concurrent voting scenarios

### Security Testing
- Authentication token validation
- Authorization checks for group access
- Input sanitization and validation
- Rate limiting for API endpoints

## Development Environment Setup

### Docker Compose Configuration

The development environment uses Docker Compose to orchestrate the following services:

#### Services Overview
- **PostgreSQL Database**: Primary data storage with persistent volumes
- **Redis**: Session storage and caching for improved performance
- **Backend API**: Node.js application container
- **Frontend Dev Server**: React development server with hot reload
- **Database Admin**: pgAdmin for database management during development

#### Docker Compose Structure
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ytoo_dev
      POSTGRES_USER: ytoo_user
      POSTGRES_PASSWORD: ytoo_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://ytoo_user:ytoo_password@postgres:5432/ytoo_dev
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_jwt_secret_change_in_production
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules
    
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:3001
      REACT_APP_WS_URL: ws://localhost:3001
    volumes:
      - ./frontend:/app
      - /app/node_modules
    
  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@ytoo.local
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_data:
  redis_data:
```

#### Environment Variables
- Development environment variables stored in `.env.development`
- Production environment variables managed separately
- Database credentials and JWT secrets configurable per environment

#### Database Initialization
- SQL scripts in `./database/init/` folder for initial schema creation
- Database migrations handled by the backend application
- Seed data for development testing

## Security Considerations

### Authentication & Authorization
- JWT tokens with reasonable expiration times
- Password hashing using bcrypt with salt rounds
- Group access validation on all operations
- Invite token validation for group joins

### Privacy Protection
- No API endpoints expose vote counts or individual votes
- Activity creation is completely anonymous
- Database queries exclude sensitive voting data
- WebSocket events only broadcast necessary information

### Data Protection
- Input validation and sanitization
- SQL injection prevention using parameterized queries
- XSS protection with proper data encoding
- CORS configuration for production deployment

## Real-time Architecture Details

### WebSocket Connection Management
- Automatic reconnection on connection loss
- Room-based messaging for group-specific updates
- Connection authentication using JWT tokens
- Graceful degradation when WebSocket unavailable

### Event Broadcasting Strategy
- Events only broadcast to group members
- Minimal data in broadcasts to maintain privacy
- Debounced updates to prevent spam
- Event queuing for offline users

### Majority Calculation Service
- Background service monitors vote changes
- Calculates majority status without exposing counts
- Triggers real-time updates when status changes
- Handles edge cases like ties and vote changes