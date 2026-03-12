# DevTask Manager - Product Specification

**Document Version:** 1.2  
**Last Updated:** 2026-02-26  
**Author:** Product Team  
**Status:** Active Development

---

## 1. Executive Summary

DevTask Manager is a web-based task management system designed for software development teams. It provides core project management capabilities including task tracking, role-based access control, and team collaboration features.

**Current Version:** 0.2.0  
**Target Users:** Development teams (5-100 members)

---

## 2. Core Features

### 2.1 Authentication & Authorization
- **User Registration:** Email/password with organization creation
- **Login:** JWT-based authentication with 24-hour expiry
- **Roles:** Three-tier system (admin, manager, developer)
- **Permissions:** Role-based access control (RBAC) for all resources

**Version 0.2 Change:** OAuth 2.0 integration planned but deferred to v0.3 due to complexity. See `decisions.md` ADR-008.

### 2.2 Task Management
- Create, read, update, delete tasks
- Task attributes: title, description, status, priority, assignee, due date
- Status workflow: backlog → todo → in_progress → in_review → done
- Priority levels: low, medium, high, urgent
- Filtering by status, priority, assignee
- Search by title/description

### 2.3 Project Organization
- Projects contain tasks
- Organization-scoped data isolation
- Organization admin can manage all projects

### 2.4 User Management
**Admins can:**
- Create users
- Assign roles
- Deactivate users

**Managers can:**
- View all users in organization
- Assign tasks to any user

**Developers can:**
- View own profile
- Update assigned tasks

---

## 3. User Roles & Permissions

| Action | Admin | Manager | Developer |
|--------|-------|---------|-----------|
| Create Organization | ✓ | ✗ | ✗ |
| Manage Users | ✓ | View only | ✗ |
| Create Projects | ✓ | ✓ | ✗ |
| Delete Projects | ✓ | ✓ | ✗ |
| Create Tasks | ✓ | ✓ | ✓ |
| Edit Any Task | ✓ | ✓ | Own only |
| Delete Tasks | ✓ | ✓ | ✗ |
| View All Tasks | ✓ | ✓ | Assigned/Created only |
| Manage Settings | ✓ | ✗ | ✗ |

---

## 4. Technical Requirements

### 4.1 Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.x
- **Database:** PostgreSQL 15+ (v0.1 used SQLite, changed in v0.2)
- **Authentication:** JWT (RS256 planned for v0.3, currently HS256)
- **API Style:** REST with JSON

### 4.2 Frontend
- **Framework:** React 18+
- **Build Tool:** Vite 5+
- **Styling:** TailwindCSS
- **State Management:** Zustand + React Context
- **Routing:** React Router v6

### 4.3 Security Requirements
- Password hashing: bcrypt with 12+ rounds
- JWT tokens with expiration
- Rate limiting on auth endpoints
- Input validation with Joi
- SQL injection prevention via parameterized queries
- CORS configuration

---

## 5. Database Schema Overview

**Core Tables:**
- `organizations` - Tenant isolation
- `users` - User accounts with roles
- `projects` - Project containers
- `tasks` - Task entities

**Version 0.2 Additions:**
- `audit_logs` - Compliance tracking (added 2026-02-15)
- `tags` - Task categorization
- `task_comments` - Collaboration feature

See `db-schema.md` for complete schema documentation.

---

## 6. API Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me (protected)
```

### Tasks
```
GET    /api/tasks (protected)
GET    /api/tasks/:id (protected)
POST   /api/tasks (protected)
PATCH  /api/tasks/:id (protected)
DELETE /api/tasks/:id (admin/manager only)
```

### Users
```
GET  /api/users (admin/manager only)
POST /api/users (admin/manager only)
```

---

## 7. Non-Functional Requirements

### 7.1 Performance
- API response time < 200ms (p95)
- Page load time < 2 seconds
- Support 100+ concurrent users per instance

### 7.2 Scalability
- Horizontal scaling ready (stateless API)
- Database connection pooling
- Read replica support planned for v0.3

### 7.3 Compliance
- Audit logging for all data mutations
- GDPR data retention policies
- SOC 2 preparation (v0.4)

---

## 8. Version 0.2 Changes from v0.1

### 8.1 Database Migration: SQLite → PostgreSQL
**Date:** 2026-02-10  
**Rationale:** SQLite insufficient for multi-user concurrent access. PostgreSQL provides better concurrency, full ACID compliance, and enterprise features.

**Impact:**
- Connection pooling required
- Migration scripts needed
- Environment configuration updated

### 8.2 Added: Audit Logging
**Date:** 2026-02-15  
**Migration:** `002_add_audit_logs_and_tags.sql`

Tracks all CREATE/UPDATE/DELETE operations for compliance.

### 8.3 Removed: Local Storage Auth Tokens
**Original:** Storing JWT in localStorage  
**Changed:** httpOnly cookie (deferred to v0.3, currently using localStorage with XSS warnings)

**⚠️ SECURITY NOTE:** Current localStorage approach has XSS risks. Migration to httpOnly cookies planned for v0.3.

---

## 9. Future Roadmap

### Version 0.3 (Target: 2026-04-01)
- OAuth 2.0 (Google, GitHub)
- Real-time updates (WebSockets)
- Email notifications
- File attachments
- Advanced filtering

### Version 0.4 (Target: 2026-06-01)
- Sprint management
- Burndown charts
- Git integration (webhooks)
- Slack integration
- API rate limiting tiers

### Version 0.5 (Target: 2026-08-01)
- SAML SSO
- Audit log UI
- Data export (CSV, JSON)
- Advanced analytics
- Mobile responsiveness improvements

---

## 10. Open Questions

1. **Should we support self-hosted deployments?** Some enterprise customers have asked for on-premise options. Decision needed by v0.4.

2. **Multi-tenancy approach:** Currently using organization_id scoping. Consider schema-per-tenant for v0.5 if we have 1000+ organizations.

3. **GraphQL vs REST expansion:** Team divided on whether to add GraphQL for v0.4 mobile app. See `decisions.md` ADR-012 for rejection in v0.2, may revisit.

---

## Appendix: Glossary

- **JWT:** JSON Web Token
- **RBAC:** Role-Based Access Control
- **ORM:** Object-Relational Mapping
- **SSO:** Single Sign-On
- **SAML:** Security Assertion Markup Language

---

**Related Documents:**
- `architecture.md` - System architecture
- `db-schema.md` - Database design
- `ui-rules.md` - Frontend guidelines
- `decisions.md` - Architecture Decision Records
