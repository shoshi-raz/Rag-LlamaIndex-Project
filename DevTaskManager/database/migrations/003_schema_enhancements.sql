-- DevTask Manager Database Migration
-- Version: 0.3.0
-- Date: 2026-02-27
-- Description: Schema enhancements for v0.3 - soft delete, priority indexing, audit log improvements

-- ============================================================================
-- 1. Add soft delete column to tasks
-- ============================================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for soft-deleted tasks (for cleanup job)
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at 
  ON tasks(deleted_at) 
  WHERE deleted_at IS NOT NULL;

-- Composite index for active tasks (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_tasks_active_status_priority 
  ON tasks(project_id, status, priority) 
  WHERE deleted_at IS NULL;

-- Index for active tasks by assignee
CREATE INDEX IF NOT EXISTS idx_tasks_active_assignee 
  ON tasks(assignee_id) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. Enhance audit_logs table
-- ============================================================================

-- Add new columns for comprehensive audit logging
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_ip INET;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS event_type VARCHAR(100) NOT NULL DEFAULT 'unknown';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Indexes for audit log querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================================
-- 3. Verify last_login column exists (should already exist from v0.2)
-- ============================================================================

-- This column should already exist, but verify
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_login'
    ) THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- ============================================================================
-- 4. Add composite index for priority filtering
-- ============================================================================

-- Index for filtering by status and priority (common query pattern)
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority 
  ON tasks(status, priority) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 5. Add function for permanent task deletion (cleanup job)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_soft_deleted_tasks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete tasks that were soft-deleted more than 90 days ago
    DELETE FROM tasks 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Verification queries
-- ============================================================================

-- Verify soft delete column
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name = 'deleted_at';

-- Verify audit log enhancements
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
AND column_name IN ('actor_ip', 'actor_user_agent', 'event_type', 'metadata');

-- Verify indexes created
SELECT 
    indexname, 
    indexdef
FROM pg_indexes 
WHERE tablename IN ('tasks', 'audit_logs')
AND indexname LIKE '%_active_%' OR indexname LIKE '%audit_logs%';

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Log migration completion
INSERT INTO migrations (version, description, applied_at)
VALUES ('003', 'Schema enhancements: soft delete, priority indexing, audit improvements', NOW())
ON CONFLICT (version) DO NOTHING;
