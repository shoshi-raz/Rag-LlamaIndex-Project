# DevTask Manager - Architecture Changes (v0.3)

**Document Version:** 1.0  
**Created:** 2026-02-27  
**Author:** Marcus Williams (Principal Architect)  
**Status:** Implemented

---

## Overview

Version 0.3 introduces significant architectural changes to improve security, scalability, and maintainability. This document details the technical implementation of these changes.

**Major Changes:**
1. Session-based authentication with Redis
2. Enhanced rate limiting with Redis backend
3. Database schema enhancements (soft delete, priority indexing)
4. Comprehensive audit logging
5. Security hardening

---

## 1. Authentication Architecture

### 1.1 Previous Architecture (v0.2)

```
┌─────────┐                    ┌──────────┐
│ Client  │ ─── JWT Token ───▶ │  Server  │
│         │ (localStorage)     │          │
│         │◀─── Response ──────│          │
└─────────┘                    └──────────┘
                                     │
                                     ▼
                              ┌──────────┐
                              │PostgreSQL│
                              └──────────┘
```

**Problems:**
- JWT in localStorage vulnerable to XSS
- No instant token revocation
- Large token size (200-500 bytes)

### 1.2 New Architecture (v0.3)

```
┌─────────┐                    ┌──────────┐
│ Client  │ ─── Session ID ──▶ │  Server  │
│         │ (httpOnly cookie)  │          │
│         │◀─── Response ──────│          │
└─────────┘                    └────┬─────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐    ┌──────────┐   ┌──────────┐
              │  Redis   │    │PostgreSQL│   │  Audit   │
              │(Sessions)│    │  (Data)  │   │   Logs   │
              └──────────┘    └──────────┘   └──────────┘
```

**Benefits:**
- httpOnly cookies prevent XSS attacks
- Instant session revocation via Redis
- Smaller cookie size (32 bytes)
- Better security posture


## 2. Session Management Implementation

### 2.1 Session Store Configuration

**Technology Stack:**
- `express-session`: Session middleware
- `connect-redis`: Redis session store adapter
- `redis`: Redis client (v4.6.13)

**Configuration:**
```javascript
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

// Redis client
const redisClient = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0
});

redisClient.connect().catch(console.error);

// Session middleware
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  name: 'devtask.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  }
}));
```

### 2.2 Session Lifecycle

**1. Login (Session Creation):**
```javascript
// Regenerate session ID to prevent fixation
req.session.regenerate((err) => {
  if (err) return next(err);
  
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.organizationId = user.organization_id;
  
  req.session.save((err) => {
    if (err) return next(err);
    res.json({ user, message: 'Login successful' });
  });
});
```

**2. Authentication (Session Validation):**
```javascript
const authenticate = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Fetch fresh user data
  const user = await db.query(
    'SELECT id, email, name, role, organization_id FROM users WHERE id = $1',
    [req.session.userId]
  );
  
  if (user.rows.length === 0) {
    req.session.destroy();
    return res.status(401).json({ error: 'User not found' });
  }
  
  req.user = user.rows[0];
  next();
};
```

**3. Logout (Session Destruction):**
```javascript
req.session.destroy((err) => {
  if (err) {
    return res.status(500).json({ error: 'Logout failed' });
  }
  res.clearCookie('devtask.sid');
  res.json({ message: 'Logout successful' });
});
```

### 2.3 Redis Data Structure

**Session Key Format:**
```
sess:${sessionId}
```

**Session Data (JSON):**
```json
{
  "cookie": {
    "originalMaxAge": 604800000,
    "expires": "2026-03-06T12:00:00.000Z",
    "httpOnly": true,
    "secure": true,
    "sameSite": "strict"
  },
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "admin",
  "organizationId": "660e8400-e29b-41d4-a716-446655440000"
}
```

**TTL:** Automatically set to match cookie maxAge (7 days)


## 3. Rate Limiting Architecture

### 3.1 Previous Implementation (v0.2)

**In-Memory Rate Limiting:**
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
  // Problem: Doesn't work across multiple server instances
});
```

**Issues:**
- State not shared between server instances
- Resets on server restart
- Can't track distributed attacks

### 3.2 New Implementation (v0.3)

**Redis-Backed Rate Limiting:**
```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:global:'
  }),
  message: 'Too many requests, please try again later.'
});

// Auth-specific rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:'
  }),
  message: 'Too many login attempts, please try again later.'
});

// Apply to routes
app.use('/api/', globalLimiter);
app.use('/api/auth/login', authLimiter);
```

### 3.3 Rate Limit Tiers

| Endpoint Type | Window | Max Requests | Key |
|--------------|--------|--------------|-----|
| Global | 15 min | 100 | IP address |
| Auth (login) | 15 min | 5 | IP address |
| Authenticated API | 1 hour | 1000 | User ID |
| Admin endpoints | 1 hour | 5000 | User ID |

### 3.4 Redis Data Structure

**Rate Limit Key Format:**
```
rl:global:${ipAddress}
rl:auth:${ipAddress}
rl:user:${userId}
```

**Value:** Request count (integer)  
**TTL:** Window duration (15 minutes or 1 hour)


## 4. Database Schema Enhancements

### 4.1 Soft Delete Implementation

**Migration SQL:**
```sql
-- Add deleted_at column to tasks
ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for performance (queries filter by deleted_at)
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;

-- Index for active tasks (most common query)
CREATE INDEX idx_tasks_active ON tasks(project_id, status) WHERE deleted_at IS NULL;
```

**Query Pattern Changes:**

**Before (v0.2):**
```javascript
const tasks = await db.query(
  'SELECT * FROM tasks WHERE project_id = $1',
  [projectId]
);
```

**After (v0.3):**
```javascript
const tasks = await db.query(
  'SELECT * FROM tasks WHERE project_id = $1 AND deleted_at IS NULL',
  [projectId]
);
```

**Soft Delete Operation:**
```javascript
// Instead of DELETE
await db.query(
  'UPDATE tasks SET deleted_at = NOW() WHERE id = $1',
  [taskId]
);
```

**Restore Operation:**
```javascript
await db.query(
  'UPDATE tasks SET deleted_at = NULL WHERE id = $1',
  [taskId]
);
```

**Permanent Deletion (Scheduled Job):**
```javascript
// Run daily via cron
await db.query(
  `DELETE FROM tasks 
   WHERE deleted_at IS NOT NULL 
   AND deleted_at < NOW() - INTERVAL '90 days'`
);
```

### 4.2 Priority Column Enhancement

**Existing Schema:**
```sql
priority VARCHAR(50) NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
```

**New Index for Performance:**
```sql
-- Composite index for common query pattern
CREATE INDEX idx_tasks_status_priority ON tasks(status, priority) 
  WHERE deleted_at IS NULL;

-- Supports queries like:
-- SELECT * FROM tasks WHERE status = 'todo' AND priority = 'urgent'
```

### 4.3 Last Login Tracking

**Already in Schema (v0.2):**
```sql
last_login TIMESTAMP WITH TIME ZONE
```

**Updated in authController:**
```javascript
// After successful login
await db.query(
  'UPDATE users SET last_login = NOW() WHERE id = $1',
  [user.id]
);
```

**Usage:**
- Security audits (identify inactive accounts)
- User analytics
- Compliance reporting


## 5. Audit Logging Enhancements

### 5.1 Expanded Audit Scope

**Previous (v0.2):** Only data mutations (CREATE/UPDATE/DELETE)  
**New (v0.3):** All sensitive operations

**Event Types:**
- `auth.login.success`
- `auth.login.failure`
- `auth.logout`
- `auth.password_change`
- `task.create`
- `task.update`
- `task.delete`
- `task.restore`
- `user.create`
- `user.role_change`
- `user.deactivate`
- `permission.denied`

### 5.2 Enhanced Audit Log Schema

**Migration SQL:**
```sql
-- Add new columns to audit_logs
ALTER TABLE audit_logs ADD COLUMN actor_ip INET;
ALTER TABLE audit_logs ADD COLUMN actor_user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN event_type VARCHAR(100) NOT NULL DEFAULT 'unknown';
ALTER TABLE audit_logs ADD COLUMN metadata JSONB DEFAULT '{}';

-- Indexes for querying
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Partitioning for performance (monthly partitions)
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

### 5.3 Audit Logging Implementation

**Audit Middleware:**
```javascript
const auditLog = async (req, eventType, resourceType, resourceId, action, beforeState, afterState) => {
  try {
    await db.query(
      `INSERT INTO audit_logs 
       (event_type, actor_id, actor_ip, actor_user_agent, resource_type, 
        resource_id, action, before_state, after_state, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        eventType,
        req.user?.id || null,
        req.ip,
        req.get('user-agent'),
        resourceType,
        resourceId,
        action,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState ? JSON.stringify(afterState) : null,
        JSON.stringify({ sessionId: req.sessionID })
      ]
    );
  } catch (error) {
    // Don't fail request if audit logging fails
    logger.error({ error: error.message }, 'Audit log write failed');
  }
};
```

**Usage Example:**
```javascript
// In taskController.js
const deleteTask = async (req, res) => {
  const { id } = req.params;
  
  // Get current state
  const task = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
  const beforeState = task.rows[0];
  
  // Soft delete
  await db.query(
    'UPDATE tasks SET deleted_at = NOW() WHERE id = $1',
    [id]
  );
  
  // Audit log
  await auditLog(
    req,
    'task.delete',
    'task',
    id,
    'DELETE',
    beforeState,
    { deleted_at: new Date() }
  );
  
  res.json({ message: 'Task deleted' });
};
```

### 5.4 Audit Log Retention

**Storage Tiers:**
1. **Hot (PostgreSQL):** 90 days - Fast queries
2. **Warm (S3/Archive):** 2 years - Compliance
3. **Deleted:** After 2 years (unless legal hold)

**Archival Job (Monthly):**
```javascript
// Export logs older than 90 days to S3
const archiveLogs = async () => {
  const logs = await db.query(
    `SELECT * FROM audit_logs 
     WHERE created_at < NOW() - INTERVAL '90 days'`
  );
  
  // Upload to S3
  await s3.upload({
    Bucket: 'devtask-audit-logs',
    Key: `audit-logs-${year}-${month}.json.gz`,
    Body: gzip(JSON.stringify(logs.rows))
  });
  
  // Delete from PostgreSQL
  await db.query(
    `DELETE FROM audit_logs 
     WHERE created_at < NOW() - INTERVAL '90 days'`
  );
};
```


## 6. Infrastructure Changes

### 6.1 New Dependencies

**Backend (package.json):**
```json
{
  "dependencies": {
    "express-session": "^1.18.0",
    "connect-redis": "^7.1.0",
    "redis": "^4.6.13",
    "rate-limit-redis": "^4.2.0"
  }
}
```

**Removed (after JWT migration complete):**
```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.0"  // Remove in v0.3.3
  }
}
```

### 6.2 Redis Infrastructure

**Development:**
- Single Redis instance on localhost
- No persistence required
- No authentication (localhost only)

**Production:**
- Redis Sentinel (3-node cluster) for high availability
- RDB + AOF persistence enabled
- AUTH password required
- TLS encryption enabled
- Network isolation (private subnet)

**Redis Monitoring:**
- Memory usage alerts (> 80%)
- Connection count alerts (> 1000)
- Latency alerts (> 10ms)
- Eviction alerts (any evictions)

### 6.3 Environment Variables

**New Variables:**
```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Session
SESSION_SECRET=your_session_secret_min_32_chars
SESSION_NAME=devtask.sid
SESSION_MAX_AGE=604800000

# Cookie
COOKIE_SECURE=true
COOKIE_DOMAIN=.yourdomain.com
```

**Deprecated (remove in v0.3.3):**
```bash
# JWT_SECRET=...  # No longer needed
# JWT_EXPIRES_IN=...  # No longer needed
```


## 7. Performance Considerations

### 7.1 Session Lookup Performance

**Overhead per Request:**
- Redis lookup: 1-5ms (same datacenter)
- Database user fetch: 5-10ms (with connection pool)
- Total overhead: ~10ms per authenticated request

**Optimization Strategies:**
1. **Connection Pooling:** Reuse Redis connections
2. **Network Proximity:** Redis on same network as API servers
3. **Caching:** Consider caching user data in session (trade-off: stale data)

### 7.2 Rate Limiting Performance

**Redis Operations per Request:**
- INCR: O(1) - Increment counter
- EXPIRE: O(1) - Set TTL
- Total: ~1-2ms overhead

**Optimization:**
- Use pipelining for multiple Redis commands
- Set TTL on first request only (not every request)

### 7.3 Audit Logging Performance

**Async Logging:**
```javascript
// Don't block request waiting for audit log write
const auditLog = async (...args) => {
  // Fire and forget (with error handling)
  setImmediate(async () => {
    try {
      await writeAuditLog(...args);
    } catch (error) {
      logger.error('Audit log failed', error);
    }
  });
};
```

**Batch Inserts (Future Optimization):**
- Buffer audit logs in memory
- Batch insert every 5 seconds
- Reduces database load by 80%

### 7.4 Database Query Performance

**Soft Delete Impact:**
- Every query must include `deleted_at IS NULL`
- Partial index created for performance
- Minimal overhead (~1ms)

**Index Strategy:**
```sql
-- Partial indexes for active records only
CREATE INDEX idx_tasks_active_status 
  ON tasks(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_tasks_active_assignee 
  ON tasks(assignee_id) WHERE deleted_at IS NULL;
```


## 8. Security Improvements

### 8.1 XSS Protection

**Before (v0.2):**
- JWT in localStorage accessible to JavaScript
- Any XSS vulnerability exposes all user tokens

**After (v0.3):**
- Session ID in httpOnly cookie (not accessible to JavaScript)
- XSS attacks cannot steal session tokens

### 8.2 CSRF Protection

**Mechanisms:**
1. **SameSite Cookies:** `sameSite: 'strict'` prevents cross-site cookie sending
2. **Origin Validation:** Server checks `Origin` header
3. **CORS Configuration:** Restricts allowed origins

**Implementation:**
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE']
}));
```

### 8.3 Session Security

**Session Fixation Prevention:**
```javascript
// Regenerate session ID on login
req.session.regenerate((err) => {
  // New session ID prevents fixation attacks
});
```

**Session Hijacking Mitigation:**
- Short session lifetime (7 days)
- Secure cookie transmission (HTTPS only)
- Session revocation on logout

### 8.4 Rate Limiting Security

**Brute Force Protection:**
- 5 login attempts per 15 minutes per IP
- Account lockout (planned v0.4)

**DoS Protection:**
- 100 requests per 15 minutes per IP (global)
- 1000 requests per hour per authenticated user


## 9. Deployment Architecture

### 9.1 Development Environment

```
┌─────────────────────────────────────────┐
│         Developer Machine              │
│  ┌─────────────┐    ┌──────────────┐  │
│  │  React Dev  │◀───│   Vite HMR   │  │
│  │  Server:5173│     │              │  │
│  └──────┬──────┘    └──────────────┘  │
│         │ Proxy /api                   │
│         ▼                              │
│  ┌─────────────┐    ┌──────────────┐  │
│  │  Express    │───▶│  PostgreSQL  │  │
│  │  Server:3000│     │  Port:5432   │  │
│  └──────┬──────┘    └──────────────┘  │
│         │                              │
│         ▼                              │
│  ┌─────────────┐                      │
│  │   Redis     │                      │
│  │  Port:6379  │                      │
│  └─────────────┘                      │
└─────────────────────────────────────────┘
```

### 9.2 Production Architecture (v0.3)

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │     (Nginx)     │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ API Server 1 │    │ API Server 2 │    │ API Server N │
│  (Express)   │    │  (Express)   │    │  (Express)   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                    │
       └───────────────────┼────────────────────┘
                           │
       ┌───────────────────┼────────────────────┐
       ▼                   ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ PostgreSQL   │    │    Redis     │    │  Audit Logs  │
│   Primary    │    │   Sentinel   │    │  (Separate)  │
│              │    │  (3 nodes)   │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

### 9.3 High Availability

**Redis Sentinel Configuration:**
```conf
# sentinel.conf
sentinel monitor devtask-redis 10.0.1.10 6379 2
sentinel down-after-milliseconds devtask-redis 5000
sentinel parallel-syncs devtask-redis 1
sentinel failover-timeout devtask-redis 10000
```

**Automatic Failover:**
1. Sentinel detects Redis master failure
2. Promotes replica to master
3. Updates API servers with new master address
4. Minimal downtime (~5 seconds)


## 10. Migration Strategy

### 10.1 Dual-Auth Period (Week 2-3)

**Support Both JWT and Sessions:**
```javascript
const authenticate = async (req, res, next) => {
  // Try session first
  if (req.session.userId) {
    req.user = await getUserById(req.session.userId);
    return next();
  }
  
  // Fallback to JWT (legacy)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await getUserById(decoded.userId);
      return next();
    } catch (error) {
      // JWT invalid, continue to 401
    }
  }
  
  return res.status(401).json({ error: 'Authentication required' });
};
```

### 10.2 Gradual Migration

**Week 1:** Deploy Redis infrastructure  
**Week 2:** Deploy dual-auth backend  
**Week 3:** Update frontend to use sessions  
**Week 4:** Remove JWT code  
**Week 5:** Validation and monitoring

### 10.3 Rollback Plan

**If issues occur:**
1. Revert to v0.2 code
2. Users re-login with JWT
3. Fix issues
4. Retry migration

**Rollback window:** 48 hours after deployment


## 11. Testing Strategy

### 11.1 Unit Tests

**Session Management:**
- Session creation on login
- Session validation on authenticated requests
- Session destruction on logout
- Session regeneration prevents fixation

**Rate Limiting:**
- Rate limit enforced per IP
- Rate limit enforced per user
- Rate limit resets after window
- Different limits for different endpoints

**Soft Delete:**
- Soft delete sets deleted_at
- Queries exclude soft-deleted records
- Restore clears deleted_at
- Permanent deletion after 90 days

### 11.2 Integration Tests

**Authentication Flow:**
```javascript
describe('Session Authentication', () => {
  it('should create session on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('devtask.sid');
  });
  
  it('should authenticate with session cookie', async () => {
    const cookie = await loginAndGetCookie();
    
    const res = await request(app)
      .get('/api/tasks')
      .set('Cookie', cookie);
    
    expect(res.status).toBe(200);
  });
  
  it('should destroy session on logout', async () => {
    const cookie = await loginAndGetCookie();
    
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);
    
    const res = await request(app)
      .get('/api/tasks')
      .set('Cookie', cookie);
    
    expect(res.status).toBe(401);
  });
});
```

### 11.3 Security Tests

**XSS Protection:**
- Verify httpOnly cookie attribute
- Attempt JavaScript access to cookie (should fail)

**CSRF Protection:**
- Cross-origin requests blocked
- SameSite cookie prevents CSRF

**Rate Limiting:**
- Exceed rate limit triggers 429 error
- Rate limit resets after window

### 11.4 Performance Tests

**Load Testing:**
```bash
# 10,000 requests, 100 concurrent
ab -n 10000 -c 100 -C "devtask.sid=test_session" \
   http://localhost:3000/api/tasks
```

**Expected Results:**
- Average response time: < 200ms
- p95 response time: < 300ms
- p99 response time: < 500ms
- Error rate: < 0.1%


## 12. Monitoring & Observability

### 12.1 Metrics to Track

**Redis Metrics:**
- `redis.connected_clients` - Number of connected clients
- `redis.used_memory` - Memory usage in bytes
- `redis.keyspace_hits` - Cache hit rate
- `redis.keyspace_misses` - Cache miss rate
- `redis.evicted_keys` - Number of evicted keys
- `redis.commands_per_sec` - Throughput

**Session Metrics:**
- `sessions.created` - Sessions created per minute
- `sessions.destroyed` - Sessions destroyed per minute
- `sessions.active` - Current active sessions
- `sessions.expired` - Sessions expired per minute

**Rate Limiting Metrics:**
- `ratelimit.blocked` - Requests blocked per minute
- `ratelimit.allowed` - Requests allowed per minute
- `ratelimit.by_endpoint` - Breakdown by endpoint

**Audit Log Metrics:**
- `audit.writes_per_sec` - Audit log write rate
- `audit.write_failures` - Failed audit log writes
- `audit.storage_size` - Audit log storage size

### 12.2 Alerts

**Critical (Page On-Call):**
- Redis down for > 1 minute
- Session creation failure rate > 5%
- API error rate > 10%
- Database connection pool exhausted

**Warning (Email):**
- Redis memory > 80%
- Redis latency > 10ms
- Rate limit triggered > 100 times/hour
- Audit log write failures > 10/minute

### 12.3 Dashboards

**Redis Dashboard:**
- Memory usage over time
- Connected clients over time
- Commands per second
- Hit/miss ratio
- Eviction rate

**Authentication Dashboard:**
- Login success/failure rate
- Active sessions over time
- Session duration distribution
- Authentication errors by type

**Security Dashboard:**
- Rate limit blocks by IP
- Failed login attempts by IP
- Permission denied events
- Audit log event types


## 13. Future Enhancements

### 13.1 Planned for v0.4

**Redis Cluster:**
- Horizontal scaling for > 100k sessions
- Automatic sharding
- Better fault tolerance

**Session Encryption:**
- Encrypt session data in Redis
- Defense in depth
- Compliance requirement for some industries

**Account Lockout:**
- Lock account after 10 failed login attempts
- Email notification
- Admin unlock capability

### 13.2 Under Consideration

**Session Binding:**
- Bind session to IP address (rejected due to mobile users)
- Bind session to user agent (under evaluation)

**Multi-Factor Authentication:**
- TOTP (Time-based One-Time Password)
- SMS verification
- Backup codes

**OAuth 2.0 Integration:**
- Google Sign-In
- GitHub Sign-In
- SAML SSO for enterprise

---

## Related Documents

- `decisions.md` - Architecture Decision Records
- `migration-notes.md` - Migration guide
- `security-notes.md` - Security considerations
- `warnings.md` - Critical warnings

---

**Document Status:** Living document  
**Last Updated:** 2026-02-27  
**Next Review:** After v0.3 deployment (2026-03-15)
