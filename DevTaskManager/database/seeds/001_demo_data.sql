-- Seed data for development
-- Run this after schema.sql and migrations

-- Create demo organization
INSERT INTO organizations (id, name, slug) VALUES 
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Acme Development', 'acme-dev');

-- Create demo users (password: 'password' for all)
-- Hash: $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G
INSERT INTO users (id, email, password_hash, name, role, organization_id, is_active) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'admin@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', 'Admin User', 'admin', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'manager@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', 'Manager User', 'manager', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'dev@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', 'Developer User', 'developer', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'dev2@test.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', 'Jane Developer', 'developer', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true);

-- Create demo projects
INSERT INTO projects (id, name, description, organization_id, created_by, is_active) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'Website Redesign', 'Complete overhaul of company website', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'Mobile App', 'iOS and Android mobile application', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'API Development', 'REST API for third-party integrations', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', true);

-- Create demo tasks
INSERT INTO tasks (id, title, description, status, priority, assignee_id, project_id, created_by, due_date, story_points) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30', 'Setup project repository', 'Initialize Git repo and setup CI/CD', 'done', 'high', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', '2026-02-20', 3),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'Design homepage mockups', 'Create Figma mockups for new homepage', 'in_progress', 'high', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', '2026-03-01', 8),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', 'Implement authentication', 'JWT-based auth system', 'in_progress', 'urgent', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', '2026-02-28', 13),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Setup React Native project', 'Initialize mobile app codebase', 'todo', 'medium', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', '2026-03-15', 5),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a34', 'Database schema design', 'Design PostgreSQL schema', 'done', 'high', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', '2026-02-15', 8),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a35', 'Research competitors', 'Analyze competitor features', 'backlog', 'low', NULL, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', NULL, 3);

-- Create tags
INSERT INTO tags (id, name, color, organization_id) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a40', 'bug', '#ef4444', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'feature', '#22c55e', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'docs', '#3b82f6', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 'refactor', '#f59e0b', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
