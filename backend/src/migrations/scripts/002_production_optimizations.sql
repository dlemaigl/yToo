-- Production optimizations and additional indexes
-- This migration adds production-specific optimizations

-- Add additional indexes for production performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_created_at ON votes(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_group_members_joined_at ON group_members(joined_at DESC);

-- Add partial indexes for active/chosen activities
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_chosen ON activities(group_id) WHERE is_chosen = true;

-- Add composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_group_created ON activities(group_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_activity_created ON votes(activity_id, created_at DESC);

-- Create statistics for query optimization
ANALYZE users;
ANALYZE groups;
ANALYZE group_members;
ANALYZE activities;
ANALYZE votes;

-- Set up connection pooling parameters (if using pgbouncer)
-- These are commented out as they would typically be set at the database level
-- ALTER SYSTEM SET max_connections = 200;
-- ALTER SYSTEM SET shared_buffers = '256MB';
-- ALTER SYSTEM SET effective_cache_size = '1GB';
-- ALTER SYSTEM SET work_mem = '4MB';
-- ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Add constraints for data integrity in production
ALTER TABLE users ADD CONSTRAINT check_username_length CHECK (LENGTH(username) >= 3);
ALTER TABLE users ADD CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
ALTER TABLE groups ADD CONSTRAINT check_group_name_length CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 100);
ALTER TABLE activities ADD CONSTRAINT check_activity_title_length CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 200);