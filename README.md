# yToo - Group Activity Voting App

A web application that enables groups to propose and vote on activities anonymously, with real-time updates when activities achieve majority status.

## Features

- Anonymous activity proposals
- Private voting system (no vote counts visible)
- Real-time updates when activities are chosen
- Group management with shareable invitation links
- User authentication and authorization

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

### Quick Start

1. Clone the repository and navigate to the project directory

2. Copy environment variables:
   ```bash
   cp .env.example .env.development
   ```

3. Start the development environment:
   ```bash
   npm run dev
   ```

This will start all services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- pgAdmin: http://localhost:5050

### Available Scripts

- `npm run dev` - Start all services with Docker Compose
- `npm run dev:detached` - Start services in background
- `npm run stop` - Stop all services
- `npm run clean` - Stop services and remove volumes
- `npm run logs` - View logs from all services
- `npm run logs:backend` - View backend logs only
- `npm run logs:frontend` - View frontend logs only
- `npm run db:reset` - Reset database (removes all data)

### Database Access

- **pgAdmin**: http://localhost:5050
  - Email: admin@ytoo.local
  - Password: admin
- **Direct PostgreSQL connection**:
  - Host: localhost
  - Port: 5432
  - Database: ytoo_dev
  - Username: ytoo_user
  - Password: ytoo_password

### Project Structure

```
ytoo/
├── backend/                 # Node.js API server
│   ├── src/                # Source code
│   ├── Dockerfile          # Backend container config
│   └── package.json        # Backend dependencies
├── frontend/               # React application
│   ├── src/                # Source code
│   ├── public/             # Static assets
│   ├── Dockerfile          # Frontend container config
│   └── package.json        # Frontend dependencies
├── database/               # Database configuration
│   └── init/               # Database initialization scripts
├── docker-compose.yml      # Development environment
├── .env.development        # Development environment variables
└── package.json            # Root project scripts
```

## Technology Stack

- **Frontend**: React.js with TypeScript
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Real-time**: Socket.IO
- **Authentication**: JWT tokens
- **Development**: Docker Compose

## Development Workflow

1. Make changes to frontend or backend code
2. Changes are automatically reflected due to volume mounts
3. Database schema changes should be added to `database/init/` scripts
4. Use pgAdmin to inspect database state during development

## Testing

- Backend tests: `npm run test:backend`
- Frontend tests: `npm run test:frontend`

## Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret key for JWT token signing
- `REACT_APP_API_URL`: Backend API URL for frontend
- `REACT_APP_WS_URL`: WebSocket URL for real-time features