# DevTask Manager - Database Schema Documentation

**Document Version:** 1.0  
**Last Updated:** 2026-02-26  
**Author:** Sarah Chen  
**Status:** Active

---

## Overview

**Database:** PostgreSQL 15+  
**Connection Pool:** 20 max connections  
**Migrations:** Manual SQL files

---

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  organizations  │       │     users       │       │    projects     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◀──────┤ organization_id │       │ id (PK)         │
│ name            │       │ id (PK)         │       │ name            │
│ slug            │       │ email           │       │ description     │
│ settings        │       │ password_hash   │       │ organization_id │◀──┐
│ created_at      │       │ name            │       │ created_by      │   │
│ updated_at      │       │ role            │       │ is_active       │   │
└─────────────────┘       │ is_active       │       │ created_at      │   │
                          │ created_at      │       │ updated_at      │   │
                          │ updated_at      │       └─────────────────┘   │
                          └─────────────────┘              │                │
                                    │                    │                │
                                    │                    │                │
                                    ▼                    │                │
                          ┌─────────────────┐            │                │
                          │     tasks       │◀───────────┘                │
                          ├─────────────────┤                             │
                          │ id (PK)         │                             │
                          │ title           │                             │
                          │ description     │                             │
                          │ status          │                             │
                          │ priority        │                             │
                          │ assignee_id     │◀───────────────────────────┘
                          │ project_id      │
                          │ created_by      │
                          │ due_date        │
                          │ story_points    │
                          │ created_at      │
                          │ updated_at      │
                          └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│  audit_logs     │       │     tags        │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │
│ user_id         │       │ name            │
│ organization_id │       │ color           │
│ action          │       │ organization_id │
│ entity_type     │       └─────────────────┘
│ entity_id       │              │
│ previous_state  │              │
│ new_state       │       ┌─────────────────┐
│ created_at      │       │   task_tags     │
└─────────────────┘       ├─────────────────┤
                          │ task_id         │
                          │ tag_id          │
                          └─────────────────┘
```

---

## Table Specifications

### organizations
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto | Tenant identifier |
| name | VARCHAR(255) | NOT NULL | Company name |
| slug | VARCHAR(100) | UNIQUE | URL-friendly name |
| settings | JSONB | DEFAULT {} | Config storage |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | Auto-updated |

### users
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto | |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login identifier |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hashed |
| name | VARCHAR(255) | NOT NULL | Display name |
| role | VARCHAR(50) | NOT NULL | admin/manager/developer |
| organization_id | UUID | FK | Tenant isolation |
| is_active | BOOLEAN | DEFAULT true | Soft delete |
| last_login | TIMESTAMP | | Last successful login |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | Auto-updated |

**Indexes:**
- `idx_users_organization` on (organization_id)
- `idx_users_email` on (email)

### projects
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto | |
| name | VARCHAR(255) | NOT NULL | Project name |
| description | TEXT | | Markdown supported |
| organization_id | UUID | FK, NOT NULL | Tenant isolation |
| created_by | UUID | FK | Owner reference |
| is_active | BOOLEAN | DEFAULT true | Soft delete |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | Auto-updated |

**Indexes:**
- `idx_projects_organization` on (organization_id)

### tasks
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto | |
| title | VARCHAR(255) | NOT NULL | Brief description |
| description | TEXT | | Full details |
| status | VARCHAR(50) | NOT NULL | See status workflow |
| priority | VARCHAR(50) | NOT NULL | low/medium/high/urgent |
| assignee_id | UUID | FK, nullable | Who works on it |
| project_id | UUID | FK, NOT NULL | Which project |
| created_by | UUID | FK, NOT NULL | Who created it |
| due_date | DATE | | Deadline |
| story_points | INTEGER | | Estimation (0-100) |
| tags | UUID[] | DEFAULT {} | Array of tag IDs |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | Auto-updated |

**Status Workflow:**
`backlog` → `todo` → `in_progress` → `in_review` → `done`

**Indexes:**
- `idx_tasks_project` on (project_id)
- `idx_tasks_assignee` on (assignee_id)
- `idx_tasks_status` on (status)
- `idx_tasks_created_by` on (created_by)
- `idx_tasks_due_date` on (due_date) WHERE due_date IS NOT NULL
- `idx_tasks_tags` GIN on (tags)

### audit_logs (v0.2 Addition)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto | |
| user_id | UUID | FK, NOT NULL | Who performed action |
| organization_id | UUID | FK, NOT NULL | Tenant |
| action | VARCHAR(50) | NOT NULL | CREATE/UPDATE/DELETE |
| entity_type | VARCHAR(50) | NOT NULL | task/project/user |
| entity_id | UUID | NOT NULL | Target record |
| previous_state | JSONB | | Before image |
| new_state | JSONB | | After image |
| ip_address | INET | | Client IP |
| user_agent | TEXT | | Browser info |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**Indexes:**
- `idx_audit_logs_organization` on (organization_id)
- `idx_audit_logs_entity` on (entity_type, entity_id)
- `idx_audit_logs_created_at` on (created_at)

### tags (v0.2 Addition)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, auto | |
| name | VARCHAR(50) | NOT NULL | Tag name |
| color | VARCHAR(7) | DEFAULT '#0ea5e9' | Hex color |
| organization_id | UUID | FK, NOT NULL | Tenant scope |
| created_at | TIMESTAMP | DEFAULT NOW() | |

**Unique:** (name, organization_id)

### task_tags (v0.2 Junction Table)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| task_id | UUID | FK | |
| tag_id | UUID | FK | |

**PK:** (task_id, tag_id)

---

## Triggers

### update_updated_at_column()
Auto-updates `updated_at` timestamp on row modification.

Applied to:
- organizations
- users
- projects
- tasks
- task_comments

---

## Migrations

### 001_create_migrations_table.sql
Sets up migration tracking.

### 002_add_audit_logs_and_tags.sql
**Date:** 2026-02-15  
**Author:** Sarah Chen

**Changes:**
1. Created `audit_logs` table
2. Created `tags` table
3. Created `task_tags` junction table
4. Created `task_comments` table
5. Added `tags` column to `tasks` (UUID array)
6. Added GIN index on tasks.tags

**Rationale:**
- Compliance requirements (audit logging)
- Task categorization (tags)
- Collaboration (comments)

---

## Seed Data

**File:** `database/seeds/001_demo_data.sql`

Contains:
- 1 demo organization (Acme Development)
- 4 demo users (admin, manager, 2 developers)
- 3 demo projects
- 6 demo tasks with various statuses

**Demo Credentials:**
- admin@test.com / password
- manager@test.com / password
- dev@test.com / password

---

## Query Patterns

### Get Tasks with Relations
```sql
SELECT t.*, 
       creator.name as created_by_name,
       assignee.name as assignee_name,
       p.name as project_name
FROM tasks t
JOIN users creator ON t.created_by = creator.id
LEFT JOIN users assignee ON t.assignee_id = assignee.id
JOIN projects p ON t.project_id = p.id
WHERE p.organization_id = $1
  AND (t.assignee_id = $2 OR t.created_by = $2)
ORDER BY t.created_at DESC;
```

### Get Organization Users
```sql
SELECT id, email, name, role, is_active, created_at, last_login
FROM users
WHERE organization_id = $1
  AND is_active = true
ORDER BY created_at DESC;
```

---

## Performance Notes

- All foreign keys indexed
- GIN index for array queries (tasks.tags)
- Partial index on due_date (only non-null)
- Connection pool size: 20 (adjust based on load)

**⚠️ WARNING:** Audit logs table grows rapidly. Implement archiving strategy by v0.4.

---

## Inconsistencies with architecture.md

**Issue:** architecture.md mentions "Knex.js evaluation in progress" but this schema uses raw SQL.  
**Resolution:** Query builder evaluation ongoing; schema remains raw SQL compatible.

---

**Related Documents:**
- `spec.md` - Product requirements
- `architecture.md` - System design
- `decisions.md` - ADR-003 (PostgreSQL migration)
