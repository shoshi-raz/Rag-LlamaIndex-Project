# DevTask Manager - Architecture Decision Records

**Document Version:** 2.0  
**Last Updated:** 2026-02-27  
**Author:** Marcus Williams (Principal Architect)  
**Status:** Active Development - Version 0.3

---

## Introduction

This document records architectural decisions made during the development of DevTask Manager. Each entry follows the ADR format: Context, Decision, and Consequences.

**⚠️ WARNING:** Decisions marked with **[SECURITY-CRITICAL]** require security team review before modification.

**⚠️ CRITICAL:** Do not change session middleware configuration without explicit security team approval. Improper session handling can lead to session fixation, hijacking, or unauthorized access.

---

## ADR-001: Modular Monolith Architecture

**Status:** Accepted  
**Date:** 2026-01-10  
**Scope:** System Architecture

### Context
At project inception, we evaluated microservices vs monolith approaches.

### Decision
Use a **modular monolith** with clear domain boundaries.

### Alternatives Considered
- **Microservices:** Rejected due to operational complexity for a small team
- **Pure Monolith:** Rejected due to risk of spaghetti code
- **Modular Monolith (Chosen):** Balances simplicity with maintainability

### Consequences
- Single deploy unit simplifies CI/CD
- Clear module boundaries via directory structure
- Can extract services later if needed

---

## ADR-002: Node.js + Express Backend

**Status:** Accepted  
**Date:** 2026-01-12  
**Scope:** Backend Stack

### Context
Team needed to select backend technology. Options included Python/Django, Go, Java/Spring.

### Decision
Use **Node.js with Express.js**

### Alternatives Considered
- **Python/FastAPI:** Good async support but less team experience
- **Go:** Excellent performance but learning curve
- **Java/Spring:** Too heavy for MVP
- **Node.js (Chosen):** Team expertise, JSON handling, full-stack JS

### Consequences
- Rapid development
- Single language across stack
- Callback complexity managed via async/await

---

## ADR-003: PostgreSQL Primary Database

**Status:** Accepted (Changed in v0.2)  
**Date:** 2026-01-15 (Modified 2026-02-10)  
**Scope:** Database

### Context (Original v0.1)
Selected SQLite for rapid prototyping.

### Original Decision (v0.1)
Use **SQLite** for simplicity.

### Modified Decision (v0.2)
Migrate to **PostgreSQL** for production readiness.

### Why the Change?
- SQLite file locking issues with concurrent writes
- Need for connection pooling
- Production requires robust ACID compliance
- Better tooling and monitoring

### Migration
Completed 2026-02-10. Schema compatible, minimal code changes needed.

### Consequences
- Connection pooling required
- More complex setup
- Better concurrency support
- Production-ready

---

## ADR-004: [REVERSED] JWT Authentication → Session-Based Authentication

**Status:** REVERSED in v0.3  
**Original Date:** 2026-01-18  
**Reversal Date:** 2026-02-27  
**Scope:** Authentication  
**[SECURITY-CRITICAL]**

### Original Decision (v0.1-0.2)
Implement JWT with **HS256** signing for stateless authentication.

### Why JWT Was Chosen Initially
- Stateless verification
- No server-side session storage
- Horizontal scaling without sticky sessions
- Simple implementation for MVP

### Problems Identified with JWT Approach
1. **XSS Vulnerability:** Storing JWT in localStorage exposes tokens to JavaScript, creating XSS attack vector
2. **Token Revocation:** Cannot invalidate JWT before expiration without maintaining blacklist (defeats stateless purpose)
3. **Token Size:** JWT tokens are large (200-500 bytes), increasing bandwidth on every request
4. **Refresh Token Complexity:** Implementing secure refresh token flow adds significant complexity
5. **Secret Rotation:** Rotating JWT_SECRET invalidates all active sessions immediately

### New Decision (v0.3)
Replace JWT with **session-based authentication using Redis**.

### Implementation Details
- **Session Store:** Redis with `connect-redis` adapter
- **Session ID:** Cryptographically secure random tokens (32 bytes)
- **Cookie Configuration:** httpOnly, secure (HTTPS only), sameSite=strict
- **Session Duration:** 7 days with sliding expiration
- **Redis TTL:** Automatic session cleanup via Redis expiration

### Tradeoffs Analysis

| Aspect | JWT (Old) | Session + Redis (New) |
|--------|-----------|----------------------|
| **Security** | ❌ XSS vulnerable (localStorage) | ✅ httpOnly cookies prevent XSS |
| **Revocation** | ❌ Requires blacklist | ✅ Delete Redis key instantly |
| **Scalability** | ✅ Stateless, no shared storage | ⚠️ Requires Redis cluster |
| **Bandwidth** | ❌ 200-500 bytes per request | ✅ 32 bytes session ID |
| **Complexity** | ✅ Simple implementation | ⚠️ Redis dependency |
| **Token Rotation** | ❌ Invalidates all sessions | ✅ Per-session control |
| **Debugging** | ❌ Opaque tokens | ✅ Inspect Redis directly |

### Risks Introduced by Redis

**1. Single Point of Failure**
- **Risk:** If Redis goes down, all users are logged out
- **Mitigation:** Redis Sentinel for high availability (3-node cluster)
- **Fallback:** Graceful degradation to read-only mode

**2. Data Loss**
- **Risk:** Redis restart loses all sessions (if not persisted)
- **Mitigation:** Enable Redis persistence (RDB snapshots + AOF)
- **Impact:** Users must re-login after Redis restart

**3. Network Latency**
- **Risk:** Every request requires Redis lookup (1-5ms overhead)
- **Mitigation:** Redis on same network/datacenter, connection pooling
- **Monitoring:** Alert if Redis latency > 10ms

**4. Memory Constraints**
- **Risk:** Redis memory exhaustion with many concurrent sessions
- **Mitigation:** Set maxmemory policy (allkeys-lru), monitor memory usage
- **Capacity Planning:** 1KB per session × 10,000 users = 10MB

**5. Security**
- **Risk:** Unauthorized Redis access exposes all sessions
- **Mitigation:** Redis AUTH password, network isolation, TLS encryption
- **Compliance:** Encrypt session data at rest

### Consequences
- **Positive:**
  - Eliminates XSS token theft vulnerability
  - Instant session revocation for security incidents
  - Smaller cookie size improves performance
  - Better user experience (logout works immediately)
  
- **Negative:**
  - Redis becomes critical infrastructure dependency
  - Increased operational complexity (Redis monitoring, backups)
  - Horizontal scaling requires Redis cluster or Sentinel
  - Development environment requires Redis installation

### Migration Path
1. Deploy Redis infrastructure (v0.3.0)
2. Implement session middleware alongside JWT (v0.3.1)
3. Migrate users gradually with dual-auth support (v0.3.2)
4. Remove JWT code after 30-day migration period (v0.3.3)

### Disagreement Note
**Sarah Chen (Senior Backend Engineer) disagreed with this decision**, arguing that:
- JWT with httpOnly cookies would solve XSS without Redis dependency
- Redis adds operational burden for small teams
- Session-based auth doesn't scale as well for microservices future

**Counter-argument (Accepted):**
- httpOnly JWT cookies still have revocation problem
- Redis is industry-standard, well-understood technology
- If we move to microservices, we can use Redis as shared session store
- Operational burden justified by security improvement

---

## ADR-005: Raw SQL over ORM (v0.2)

**Status:** Accepted (Under Evaluation for Change)  
**Date:** 2026-01-20  
**Modified:** 2026-02-20  
**Scope:** Data Access

### Current Decision
Use **raw SQL with pg driver** for database access.

### Context
Team wanted control over queries without ORM abstraction overhead.

### Implementation
Direct SQL with parameterized queries for security.

### Future Evaluation
**Knex.js evaluation in progress:**
- Started: 2026-02-20
- POC Owner: Sarah Chen
- Expected completion: 2026-03-10

**Rationale for Evaluation:**
- Query builder for complex queries
- Migration management
- Better TypeScript support

---

## ADR-006: React SPA with Vite

**Status:** Accepted  
**Date:** 2026-01-22  
**Scope:** Frontend

### Decision
Use **React 18 SPA** with Vite build tool.

### Alternatives Considered
- **Next.js:** SSR not needed for dashboard app
- **Vue.js:** Team stronger in React
- **Angular:** Too heavy for MVP
- **React + Vite (Chosen):** Fast HMR, simple, ecosystem

### Consequences
- Excellent dev experience
- Fast builds
- Large bundle size (mitigated by code splitting)

---

## ADR-007: Zustand over Redux

**Status:** Accepted  
**Date:** 2026-01-25  
**Scope:** State Management

### Decision
Use **Zustand** for state management.

### Alternatives Considered
- **Redux Toolkit:** Too much boilerplate
- **Context + useReducer:** Performance issues
- **Zustand (Chosen):** Minimal, TypeScript support, no providers

### Consequences
- Minimal boilerplate
- Easy to learn
- Less ecosystem than Redux

---

## ADR-008: OAuth 2.0 Deferred

**Status:** Deferred to v0.3  
**Original Date:** 2026-01-28 (Planned)  
**Deferred Date:** 2026-02-15  
**Scope:** Authentication

### Original Decision (v0.1)
Include OAuth 2.0 in v0.2.

### Changed Decision (v0.2)
Defer OAuth to v0.3.

### Why Deferred?
- Email/password auth sufficient for MVP
- OAuth complexity underestimated
- Team bandwidth constraints
- Security review backlog

### Consequences
- Simpler v0.2 release
- User onboarding via email only
- OAuth added to v0.3 roadmap

---

## ADR-009: TailwindCSS + CSS Modules

**Status:** Accepted  
**Date:** 2026-01-30  
**Scope:** Styling

### Decision
Use **TailwindCSS** for 80% of styles, **CSS Modules** for complex cases.

### Alternatives Considered
- **Styled Components:** Runtime overhead
- **Sass/SCSS:** More build complexity
- **Pure CSS Modules:** No utility system

### Consequences
- Rapid development
- Consistent design system
- Learning curve for team

---

## ADR-010: [SUPERSEDED] LocalStorage JWT Storage

**Status:** SUPERSEDED by ADR-004  
**Date:** 2026-01-15  
**Superseded:** 2026-02-27  
**Scope:** Client Storage

### Original Decision
Store JWT in **localStorage**.

### ⚠️ SECURITY WARNING
This decision created XSS vulnerability. Tokens accessible to JavaScript.

### Superseded By
ADR-004: Session-based authentication with httpOnly cookies eliminates this vulnerability entirely.

---

## ADR-011: No GraphQL

**Status:** Rejected  
**Date:** 2026-02-18  
**Scope:** API Design

### Decision
**Do not implement GraphQL.**

### Context
Considered GraphQL alongside REST for v0.2.

### Why Rejected?
- REST sufficient for current needs
- GraphQL adds complexity
- Team bandwidth
- Caching more complex

### Reconsideration Criteria
May revisit if:
- Mobile app requires different data shapes
- 3+ customers request it

---

## ADR-012: Audit Logging Added

**Status:** Accepted  
**Date:** 2026-02-15  
**Scope:** Compliance

### Decision
Add **audit_logs** table for compliance.

### Context
SOC 2 preparation requires data change tracking.

### Implementation
- Log all CREATE/UPDATE/DELETE
- Store before/after state
- 2-year retention

### Migration
`002_add_audit_logs_and_tags.sql`

---

## ADR-013: Rate Limiting Middleware Enhancement

**Status:** Accepted  
**Date:** 2026-02-27  
**Scope:** Security  
**[SECURITY-CRITICAL]**

### Decision
Implement **tiered rate limiting** with Redis-backed storage.

### Context
Current in-memory rate limiting doesn't work across multiple server instances and lacks granular control.

### Implementation Details
- **Global Rate Limit:** 100 requests per 15 minutes per IP
- **Auth Endpoints:** 5 login attempts per 15 minutes per IP
- **API Endpoints:** 1000 requests per hour per authenticated user
- **Storage:** Redis with `rate-limit-redis` adapter
- **Response Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Alternatives Considered
- **In-Memory (Current):** Doesn't work with multiple instances
- **Database-Backed:** Too slow, adds DB load
- **Redis-Backed (Chosen):** Fast, distributed, proven

### Consequences
- Prevents brute force attacks
- Protects against DoS
- Requires Redis (already added for sessions)
- May impact legitimate users during traffic spikes

### Configuration
```javascript
{
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ client: redisClient })
}
```

---

## ADR-014: Database Schema Enhancements for v0.3

**Status:** Accepted  
**Date:** 2026-02-27  
**Scope:** Database Schema

### Decision
Add priority column to tasks, last_login to users, and soft delete mechanism.

### Changes

**1. Task Priority Column**
- **Rationale:** Priority already in schema but not properly indexed
- **Action:** Add composite index on (status, priority) for efficient filtering
- **Migration:** `003_schema_enhancements.sql`

**2. User Last Login Tracking**
- **Rationale:** Security audit requirement, detect inactive accounts
- **Action:** Already exists in schema, ensure it's updated on login
- **Usage:** Identify accounts inactive > 90 days for security review

**3. Soft Delete for Tasks**
- **Rationale:** Accidental deletion recovery, audit trail preservation
- **Implementation:** Add `deleted_at` timestamp column (NULL = active)
- **Query Pattern:** Add `WHERE deleted_at IS NULL` to all task queries
- **Restoration:** Set `deleted_at = NULL` to restore
- **Permanent Deletion:** Scheduled job deletes tasks where `deleted_at < NOW() - INTERVAL '90 days'`

### ⚠️ CRITICAL WARNING
**Soft delete must not be bypassed.** All task queries MUST include `deleted_at IS NULL` check. Bypassing soft delete:
- Violates audit requirements
- Exposes deleted data to users
- Breaks compliance (GDPR right to deletion)

### Code Review Checklist
- [ ] All SELECT queries include `deleted_at IS NULL`
- [ ] DELETE operations set `deleted_at = NOW()` instead of actual deletion
- [ ] Restore endpoint exists for admins
- [ ] Permanent deletion job scheduled
- [ ] Audit logs record soft deletions

### Consequences
- **Positive:** Data recovery, better audit trail, compliance
- **Negative:** Query complexity, storage overhead, index maintenance

---

## ADR-015: Comprehensive Audit Logging for Sensitive Operations

**Status:** Accepted  
**Date:** 2026-02-27  
**Scope:** Security & Compliance  
**[SECURITY-CRITICAL]**

### Decision
Expand audit logging beyond data mutations to include all sensitive operations.

### Scope of Audit Logging

**Authentication Events:**
- Login success/failure (with IP, user agent)
- Logout
- Password change
- Account lockout
- Session expiration

**Authorization Events:**
- Permission denied (403 errors)
- Role changes
- Access to sensitive resources

**Data Operations:**
- Task creation/update/deletion (already implemented)
- User creation/deactivation
- Project creation/deletion
- Organization settings changes

**Administrative Actions:**
- User role modifications
- System configuration changes
- Audit log access (yes, we audit who views audit logs)

### Audit Log Schema
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    actor_id UUID REFERENCES users(id),
    actor_ip INET,
    resource_type VARCHAR(50),
    resource_id UUID,
    action VARCHAR(50) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Retention Policy
- **Hot Storage:** 90 days in PostgreSQL
- **Cold Storage:** 2 years in S3/archive
- **Permanent Deletion:** After 2 years (unless legal hold)

### Performance Considerations
- Async logging (don't block requests)
- Batch inserts every 5 seconds
- Separate database connection pool for audit writes
- Partitioned table by month for query performance

### Consequences
- SOC 2 compliance requirement met
- Security incident investigation capability
- Storage costs increase (~500MB per month estimated)
- Slight performance overhead (< 5ms per request)

---

## Version 0.3 Changes Summary

**Release Date:** 2026-02-27  
**Major Version:** Breaking changes to authentication system

### Breaking Changes
1. **JWT Removed:** All clients must migrate to session-based auth
2. **Authorization Header:** No longer used, cookies required
3. **CORS Configuration:** `credentials: true` now mandatory

### New Features
1. Session-based authentication with Redis
2. Enhanced rate limiting with Redis backend
3. Soft delete for tasks
4. Comprehensive audit logging
5. Last login tracking

### Infrastructure Requirements
- **Redis 7.0+** required (critical dependency)
- **PostgreSQL 15+** (no change)
- **Node.js 18+** (no change)

### Migration Guide
See `migration-notes.md` for detailed migration instructions.

---

## Open Questions & Unresolved Issues

### 1. Redis High Availability Strategy
**Question:** Should we use Redis Sentinel (3-node) or Redis Cluster?

**Context:**
- Sentinel: Simpler, automatic failover, good for < 100k sessions
- Cluster: More complex, horizontal scaling, needed for > 100k sessions

**Current Status:** Deferred to v0.4. Using single Redis instance for v0.3.

**Decision Needed By:** 2026-04-01 (before production deployment)

**Stakeholders:** DevOps team, Marcus Williams (architect)

---

### 2. Session Data Encryption
**Question:** Should we encrypt session data in Redis?

**Arguments For:**
- Defense in depth (if Redis is compromised)
- Compliance requirement for some industries
- Best practice for sensitive data

**Arguments Against:**
- Performance overhead (encryption/decryption on every request)
- Redis should be network-isolated anyway
- Session IDs are already cryptographically random

**Current Status:** Not implemented in v0.3. Under security team review.

**Decision Needed By:** 2026-03-15

---

### 3. Soft Delete Permanent Cleanup Schedule
**Question:** Should permanent deletion be 30, 60, or 90 days after soft delete?

**Considerations:**
- GDPR: Shorter is better (30 days)
- User Recovery: Longer is better (90 days)
- Storage Costs: Shorter is cheaper

**Current Implementation:** 90 days (conservative approach)

**Reconsideration:** After 6 months of usage data

---

### 4. Rate Limiting for Authenticated vs Anonymous Users
**Question:** Should authenticated users have higher rate limits?

**Current:** Same limits for all users (100 req/15min)

**Proposal:** 
- Anonymous: 100 req/15min
- Authenticated: 1000 req/hour
- Premium tier: 5000 req/hour

**Blocker:** No premium tier exists yet. Deferred to v0.4.

---

### 5. Audit Log Querying Performance
**Question:** Do we need Elasticsearch for audit log search?

**Context:**
- Current: PostgreSQL with indexes
- Concern: Slow full-text search on large audit logs
- Alternative: Elasticsearch for search, PostgreSQL for storage

**Current Status:** Monitor PostgreSQL performance. Revisit if query time > 2 seconds.

**Threshold:** If audit_logs table > 10 million rows, evaluate Elasticsearch.

---

## Rejected Decisions

| Decision | Date | Reason |
|----------|------|--------|
| MongoDB | 2026-01-10 | Relational data fits better |
| GraphQL | 2026-02-18 | REST sufficient |
| Serverless | 2026-01-15 | Cold start issues |
| JWT with httpOnly cookies | 2026-02-27 | Doesn't solve revocation problem |
| Memcached for sessions | 2026-02-27 | Redis has better features (TTL, persistence) |

---

## Future Considerations

| Feature | Target Version | Status |
|---------|----------------|--------|
| OAuth 2.0 | 0.4 | Planned |
| WebSockets | 0.4 | Planned |
| Knex.js/Prisma | 0.4 | Evaluating |
| Redis Sentinel | 0.4 | Planned |
| Elasticsearch | 0.5 | Conditional |
| Microservices | 0.6+ | Future |

---

**⚠️ DOCUMENT CONTROL:**
This document is append-only. Reversals documented as new ADRs with clear reasoning.

**Related Documents:**
- `architecture-changes.md` - Detailed v0.3 architecture changes
- `migration-notes.md` - Migration guide for v0.3
- `security-notes.md` - Security considerations
- `warnings.md` - Critical warnings and gotchas

**Review Schedule:**
- Architecture decisions reviewed quarterly
- Security-critical decisions reviewed after any security incident
- Open questions reviewed monthly in architecture meeting
