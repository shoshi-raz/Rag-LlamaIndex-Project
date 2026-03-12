# DevTask Manager - Critical Warnings & Gotchas

**Document Version:** 1.0  
**Created:** 2026-02-27  
**Author:** Engineering Team  
**Status:** Active

---

## ⚠️ CRITICAL WARNINGS

### 1. DO NOT Change Session Middleware Without Security Review

**Severity:** CRITICAL  
**Impact:** Account hijacking, mass security breach  
**Last Updated:** 2026-02-27

**Why This Matters:**
Session middleware configuration directly impacts authentication security. Incorrect configuration can lead to:
- Session fixation attacks
- Session hijacking
- CSRF vulnerabilities
- XSS token theft

**What You Must Do:**
- Any changes to `express-session` configuration MUST be reviewed by security team
- Changes include: cookie settings, session store, secret rotation, TTL modifications
- Submit security review request at least 5 business days before deployment
- Include threat model and test results in review request

**Examples of Dangerous Changes:**
```javascript
// DANGEROUS - Disables httpOnly
cookie: { httpOnly: false }  // Allows JavaScript access to session token

// DANGEROUS - Disables secure flag in production
cookie: { secure: false }  // Allows session transmission over HTTP

// DANGEROUS - Disables SameSite protection
cookie: { sameSite: 'none' }  // Enables CSRF attacks

// DANGEROUS - Saves uninitialized sessions
saveUninitialized: true  // Creates sessions for anonymous users (DoS risk)
```

**Approval Required From:**
- Security Team Lead
- Principal Architect
- CTO (for production changes)


### 2. Soft Delete MUST NOT Be Bypassed

**Severity:** CRITICAL  
**Impact:** Audit trail loss, compliance violation, data breach  
**Last Updated:** 2026-02-27

**Why This Matters:**
Soft delete is not just a feature—it's a compliance requirement. Bypassing soft delete:
- Violates SOC 2 audit requirements
- Breaks GDPR compliance (no recovery mechanism)
- Destroys audit trail (forensic evidence lost)
- May constitute data breach (deleted data exposed)

**What You Must Do:**
- ALL task deletion operations MUST use soft delete (set `deleted_at = NOW()`)
- NEVER use `DELETE FROM tasks` except in scheduled permanent deletion job
- ALL task queries MUST include `WHERE deleted_at IS NULL`
- Code reviews MUST verify soft delete compliance

**Correct Implementation:**
```javascript
// CORRECT - Soft delete
await db.query(
  'UPDATE tasks SET deleted_at = NOW() WHERE id = $1',
  [taskId]
);

// CORRECT - Query excludes soft-deleted
await db.query(
  'SELECT * FROM tasks WHERE project_id = $1 AND deleted_at IS NULL',
  [projectId]
);
```

**Incorrect Implementation:**
```javascript
// WRONG - Hard delete (NEVER DO THIS)
await db.query('DELETE FROM tasks WHERE id = $1', [taskId]);

// WRONG - Query includes soft-deleted
await db.query('SELECT * FROM tasks WHERE project_id = $1', [projectId]);
```

**Exceptions:**
Only the scheduled permanent deletion job (runs daily) may use hard delete:
```javascript
// ONLY allowed in scheduled job
await db.query(
  `DELETE FROM tasks 
   WHERE deleted_at IS NOT NULL 
   AND deleted_at < NOW() - INTERVAL '90 days'`
);
```

**Code Review Checklist:**
- [ ] All DELETE operations use UPDATE with deleted_at
- [ ] All SELECT queries include deleted_at IS NULL
- [ ] Restore endpoint exists for admins
- [ ] Audit logs record soft deletions
- [ ] Tests verify soft delete behavior

**Consequences of Violation:**
- Immediate code review failure
- Deployment blocked
- Security incident investigation
- Potential compliance violation report


### 3. Redis Compromise = All Sessions Compromised

**Severity:** CRITICAL  
**Impact:** Mass account takeover, data breach  
**Last Updated:** 2026-02-27

**Why This Matters:**
Redis stores ALL active user sessions. If Redis is compromised, attackers gain:
- Access to all active user sessions
- Ability to hijack any user account
- Ability to create fake sessions
- Complete system compromise

**What You Must Do:**
- Redis MUST be on private network (not internet-accessible)
- Redis MUST have AUTH password enabled (min 32 characters)
- Redis MUST use TLS encryption in production
- Redis MUST have firewall rules restricting access to API servers only
- Redis access logs MUST be monitored 24/7

**Security Configuration:**
```conf
# redis.conf - REQUIRED settings
requirepass YOUR_STRONG_PASSWORD_HERE  # Min 32 chars
bind 127.0.0.1                         # Localhost only
protected-mode yes                     # Reject external connections
rename-command FLUSHDB ""              # Disable dangerous commands
rename-command FLUSHALL ""
rename-command CONFIG "SECRET_NAME"    # Rename admin commands
```

**If Redis Is Compromised:**
1. **IMMEDIATE:** Flush all sessions: `redis-cli FLUSHDB`
2. **IMMEDIATE:** Force all users to re-login
3. **IMMEDIATE:** Rotate Redis password
4. **IMMEDIATE:** Isolate Redis server (firewall block)
5. **Within 1 hour:** Investigate breach source
6. **Within 2 hours:** Review audit logs for suspicious activity
7. **Within 4 hours:** Notify security team and affected users
8. **Within 24 hours:** Complete incident report

**Monitoring Requirements:**
- Alert on unauthorized Redis connections
- Alert on Redis AUTH failures
- Alert on dangerous command usage (FLUSHDB, CONFIG)
- Alert on Redis memory spikes (potential attack)
- Log all Redis commands (for forensics)

**Network Security:**
```bash
# Firewall rules (iptables example)
# Allow only API servers to connect to Redis
iptables -A INPUT -p tcp --dport 6379 -s 10.0.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 6379 -j DROP
```


### 4. NEVER Log Passwords or Session Tokens

**Severity:** CRITICAL  
**Impact:** Credential exposure, account takeover  
**Last Updated:** 2026-02-27

**Why This Matters:**
Logging sensitive data exposes it to:
- Log aggregation systems (Splunk, ELK)
- Log files on disk (readable by admins)
- Error tracking systems (Sentry, Rollbar)
- Backup systems
- Anyone with log access

**What You Must Do:**
- NEVER log passwords (plaintext or hashed)
- NEVER log session tokens or session IDs
- NEVER log JWT tokens (legacy)
- NEVER log API keys or secrets
- NEVER log credit card numbers or SSNs
- ALWAYS redact sensitive fields in logs

**Correct Logging:**
```javascript
// CORRECT - Redact password
logger.info({
  event: 'login_attempt',
  email: user.email,
  password: '[REDACTED]',
  ip: req.ip
});

// CORRECT - Don't log session ID
logger.info({
  event: 'session_created',
  userId: user.id,
  sessionId: '[REDACTED]'
});
```

**Incorrect Logging:**
```javascript
// WRONG - Logs password
logger.info({
  event: 'login_attempt',
  email: user.email,
  password: req.body.password,  // NEVER DO THIS
  ip: req.ip
});

// WRONG - Logs session token
logger.info({
  event: 'request',
  cookie: req.headers.cookie  // Contains session ID
});
```

**Automated Detection:**
Add pre-commit hook to detect sensitive data in logs:
```bash
# .git/hooks/pre-commit
if git diff --cached | grep -i "password.*req.body"; then
  echo "ERROR: Potential password logging detected"
  exit 1
fi
```

**If Sensitive Data Is Logged:**
1. **IMMEDIATE:** Rotate compromised credentials
2. **IMMEDIATE:** Purge logs containing sensitive data
3. **Within 1 hour:** Identify who had log access
4. **Within 4 hours:** Assess if data was accessed
5. **Within 24 hours:** Complete incident report


### 5. Organization Isolation MUST Be Enforced

**Severity:** CRITICAL  
**Impact:** Data breach, unauthorized access to other organizations  
**Last Updated:** 2026-02-27

**Why This Matters:**
Multi-tenant systems MUST isolate data between organizations. Failure to enforce isolation:
- Exposes Organization A's data to Organization B
- Violates customer trust and contracts
- May constitute data breach
- Violates compliance requirements (SOC 2, GDPR)

**What You Must Do:**
- EVERY query that returns user data MUST filter by `organization_id`
- NEVER trust client-provided organization_id
- ALWAYS use `req.user.organization_id` from authenticated session
- JOIN to projects or users table to get organization_id

**Correct Implementation:**
```javascript
// CORRECT - Filters by organization_id from session
const tasks = await db.query(
  `SELECT t.* FROM tasks t
   JOIN projects p ON t.project_id = p.id
   WHERE p.organization_id = $1`,
  [req.user.organization_id]  // From authenticated session
);

// CORRECT - Verify ownership before update
const result = await db.query(
  `UPDATE tasks t SET status = $1
   FROM projects p
   WHERE t.id = $2 
   AND t.project_id = p.id
   AND p.organization_id = $3`,
  [status, taskId, req.user.organization_id]
);
```

**Incorrect Implementation:**
```javascript
// WRONG - No organization filter (exposes all data)
const tasks = await db.query('SELECT * FROM tasks');

// WRONG - Trusts client-provided organization_id
const tasks = await db.query(
  'SELECT * FROM tasks WHERE organization_id = $1',
  [req.body.organizationId]  // Client can manipulate this
);

// WRONG - No organization check before update
const result = await db.query(
  'UPDATE tasks SET status = $1 WHERE id = $2',
  [status, taskId]  // Can update any organization's tasks
);
```

**Testing Requirements:**
Every endpoint MUST have integration test verifying organization isolation:
```javascript
it('should not return tasks from other organizations', async () => {
  const org1User = await createUser({ organizationId: org1.id });
  const org2User = await createUser({ organizationId: org2.id });
  const org2Task = await createTask({ organizationId: org2.id });
  
  const cookie = await loginAs(org1User);
  const res = await request(app)
    .get('/api/tasks')
    .set('Cookie', cookie);
  
  // Verify org1 user cannot see org2 tasks
  expect(res.body.tasks).not.toContainEqual(
    expect.objectContaining({ id: org2Task.id })
  );
});
```

**Code Review Checklist:**
- [ ] Query includes organization_id filter
- [ ] organization_id comes from req.user (not req.body)
- [ ] JOIN to projects or users for organization_id
- [ ] Integration test verifies isolation
- [ ] No direct access to tasks without organization check


---

## ⚠️ HIGH PRIORITY WARNINGS

### 6. Rate Limiting MUST Use Redis Store in Production

**Severity:** HIGH  
**Impact:** Rate limiting ineffective, DoS vulnerability  
**Last Updated:** 2026-02-27

**Why This Matters:**
In-memory rate limiting doesn't work with multiple server instances:
- Each server has separate counter
- Attacker can bypass by distributing requests across servers
- Rate limit is 100 × N (where N = number of servers)

**What You Must Do:**
- Production MUST use Redis-backed rate limiting
- Development can use in-memory (single instance)
- Verify Redis store in deployment checklist

**Correct Configuration:**
```javascript
// CORRECT - Redis store (production)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:'
  })
});

// ACCEPTABLE - In-memory (development only)
if (process.env.NODE_ENV === 'development') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
    // No store = in-memory
  });
}
```

### 7. Audit Logs Are Append-Only

**Severity:** HIGH  
**Impact:** Evidence tampering, compliance violation  
**Last Updated:** 2026-02-27

**Why This Matters:**
Audit logs are legal evidence. Modifying or deleting audit logs:
- Destroys forensic evidence
- Violates compliance requirements
- May constitute obstruction of justice
- Indicates potential insider threat

**What You Must Do:**
- Audit logs MUST be append-only (INSERT only)
- Database user for application MUST NOT have UPDATE or DELETE permissions on audit_logs
- Only DBA can delete audit logs (with approval)
- Audit log access MUST be logged (audit the auditors)

**Database Permissions:**
```sql
-- Application user (INSERT only)
GRANT INSERT ON audit_logs TO devtask_app;
REVOKE UPDATE, DELETE ON audit_logs FROM devtask_app;

-- DBA user (full access)
GRANT ALL ON audit_logs TO devtask_dba;
```

**If Audit Log Tampering Detected:**
1. **IMMEDIATE:** Assume security breach in progress
2. **IMMEDIATE:** Snapshot database (preserve evidence)
3. **IMMEDIATE:** Isolate affected systems
4. **Within 1 hour:** Notify security team and legal
5. **Within 4 hours:** Begin forensic investigation
6. **Within 24 hours:** Complete incident report

### 8. Session Secret Rotation Invalidates All Sessions

**Severity:** HIGH  
**Impact:** All users logged out simultaneously  
**Last Updated:** 2026-02-27

**Why This Matters:**
Rotating `SESSION_SECRET` invalidates all existing sessions because:
- Session IDs are signed with the secret
- Old signatures become invalid with new secret
- All users must re-login

**What You Must Do:**
- Plan session secret rotation during maintenance window
- Notify users in advance (24 hours notice)
- Rotate quarterly (scheduled) or immediately (if compromised)
- Document rotation in change log

**Rotation Procedure:**
1. Schedule maintenance window (low traffic period)
2. Notify users 24 hours in advance
3. Generate new secret: `openssl rand -base64 32`
4. Update environment variable
5. Restart all API servers simultaneously
6. Monitor for authentication errors
7. Document rotation in audit log

**Emergency Rotation (Secret Compromised):**
1. **IMMEDIATE:** Generate new secret
2. **IMMEDIATE:** Update all servers
3. **IMMEDIATE:** Restart all servers
4. **Within 1 hour:** Notify users
5. **Within 4 hours:** Investigate how secret was compromised


---

## ⚠️ MEDIUM PRIORITY WARNINGS

### 9. Redis Memory Eviction Can Log Out Users

**Severity:** MEDIUM  
**Impact:** Random user logouts, poor user experience  
**Last Updated:** 2026-02-27

**Why This Matters:**
If Redis runs out of memory, it evicts keys based on eviction policy:
- `allkeys-lru`: Evicts least recently used keys (including sessions)
- Users get randomly logged out
- No warning to user

**What You Must Do:**
- Set Redis `maxmemory` with 20% headroom
- Monitor Redis memory usage (alert at 80%)
- Use `allkeys-lru` eviction policy (least bad option)
- Scale Redis vertically or horizontally before hitting limit

**Capacity Planning:**
```
Sessions: 10,000 concurrent users
Session size: ~1KB per session
Total: 10MB + 20% headroom = 12MB minimum

Recommended: 2GB (allows 2M sessions)
```

**Monitoring:**
```bash
# Check memory usage
redis-cli INFO memory | grep used_memory_human

# Check evicted keys (should be 0)
redis-cli INFO stats | grep evicted_keys
```

### 10. CORS Misconfiguration Breaks Authentication

**Severity:** MEDIUM  
**Impact:** Login fails, cookies not sent  
**Last Updated:** 2026-02-27

**Why This Matters:**
Session-based auth requires `credentials: true` in CORS:
- Without it, browsers don't send cookies
- Authentication fails silently
- Users can't login

**Correct Configuration:**
```javascript
// CORRECT - Allows credentials
app.use(cors({
  origin: process.env.FRONTEND_URL,  // Specific origin
  credentials: true,                 // REQUIRED for cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE']
}));

// Frontend must also set withCredentials
axios.get('/api/tasks', {
  withCredentials: true  // REQUIRED
});
```

**Incorrect Configuration:**
```javascript
// WRONG - Wildcard origin with credentials
app.use(cors({
  origin: '*',           // Can't use wildcard with credentials
  credentials: true
}));

// WRONG - Missing credentials
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: false     // Cookies won't be sent
}));
```

### 11. Soft Delete Increases Storage Costs

**Severity:** MEDIUM  
**Impact:** Higher storage costs, slower queries  
**Last Updated:** 2026-02-27

**Why This Matters:**
Soft-deleted records remain in database:
- Storage costs increase over time
- Indexes grow larger
- Queries slower (must filter deleted_at)

**What You Must Do:**
- Run permanent deletion job daily (deletes records > 90 days old)
- Monitor table size growth
- Consider archiving to S3 before permanent deletion
- Use partial indexes for performance

**Monitoring:**
```sql
-- Check soft-deleted record count
SELECT COUNT(*) FROM tasks WHERE deleted_at IS NOT NULL;

-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('tasks'));
```

**Optimization:**
```sql
-- Partial indexes (only active records)
CREATE INDEX idx_tasks_active_status 
  ON tasks(status) WHERE deleted_at IS NULL;
```


---

## 🔍 GOTCHAS & COMMON MISTAKES

### 12. Session Cookies Don't Work on Different Domains

**Issue:** Frontend on `app.example.com`, API on `api.example.com`  
**Problem:** Cookies don't cross subdomains by default

**Solution:**
```javascript
// Set cookie domain to parent domain
cookie: {
  domain: '.example.com',  // Note the leading dot
  // ... other settings
}
```

### 13. Secure Cookies Don't Work on HTTP

**Issue:** `secure: true` in development (HTTP)  
**Problem:** Browsers reject secure cookies over HTTP

**Solution:**
```javascript
cookie: {
  secure: process.env.NODE_ENV === 'production',  // Only HTTPS in prod
  // ... other settings
}
```

### 14. SameSite=Strict Breaks OAuth Redirects

**Issue:** OAuth providers redirect back to your site  
**Problem:** SameSite=Strict blocks cookies on redirect

**Solution:**
```javascript
// Use 'lax' if you need OAuth
cookie: {
  sameSite: 'lax',  // Allows cookies on top-level navigation
  // ... other settings
}
```

### 15. Redis Restart Logs Out All Users

**Issue:** Redis restart without persistence  
**Problem:** All sessions lost

**Solution:**
```conf
# Enable Redis persistence
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
```

### 16. Forgot to Regenerate Session on Login

**Issue:** Session fixation vulnerability  
**Problem:** Attacker can set session ID before login

**Solution:**
```javascript
// ALWAYS regenerate session on login
req.session.regenerate((err) => {
  if (err) return next(err);
  req.session.userId = user.id;
  req.session.save();
});
```

### 17. Querying Tasks Without deleted_at Filter

**Issue:** Forgot `WHERE deleted_at IS NULL`  
**Problem:** Returns soft-deleted tasks to users

**Solution:**
```javascript
// Create helper function
const getActiveTasks = (projectId) => {
  return db.query(
    'SELECT * FROM tasks WHERE project_id = $1 AND deleted_at IS NULL',
    [projectId]
  );
};
```

### 18. Rate Limiting by User ID Before Authentication

**Issue:** Rate limit middleware before auth middleware  
**Problem:** `req.user` doesn't exist yet

**Solution:**
```javascript
// WRONG order
app.use(userRateLimiter);  // Needs req.user
app.use(authenticate);      // Sets req.user

// CORRECT order
app.use(authenticate);      // Sets req.user first
app.use(userRateLimiter);  // Can access req.user
```

### 19. Audit Log Write Failures Block Requests

**Issue:** Synchronous audit logging  
**Problem:** If audit log write fails, request fails

**Solution:**
```javascript
// Use async/fire-and-forget
const auditLog = (...args) => {
  setImmediate(async () => {
    try {
      await writeAuditLog(...args);
    } catch (error) {
      logger.error('Audit log failed', error);
      // Don't throw - don't block request
    }
  });
};
```

### 20. Testing with Hardcoded Session IDs

**Issue:** Tests use fake session IDs  
**Problem:** Tests pass but real sessions fail

**Solution:**
```javascript
// Create real session in tests
const loginAndGetCookie = async (user) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: 'password' });
  
  return res.headers['set-cookie'][0];  // Real session cookie
};
```

---

## 📋 Pre-Deployment Checklist

Before deploying v0.3 to production, verify:

**Infrastructure:**
- [ ] Redis installed and running
- [ ] Redis AUTH password configured
- [ ] Redis persistence enabled (RDB + AOF)
- [ ] Redis firewall rules configured
- [ ] Redis monitoring configured

**Configuration:**
- [ ] SESSION_SECRET set (min 32 chars)
- [ ] REDIS_PASSWORD set
- [ ] COOKIE_SECURE=true (production)
- [ ] COOKIE_DOMAIN set correctly
- [ ] CORS origin set to frontend URL

**Database:**
- [ ] Migration 003 applied (soft delete, indexes)
- [ ] Audit log enhancements applied
- [ ] Database backups configured
- [ ] Soft delete indexes created

**Code:**
- [ ] All queries include deleted_at IS NULL
- [ ] Session regeneration on login
- [ ] Rate limiting uses Redis store
- [ ] Audit logging implemented
- [ ] Organization isolation enforced

**Testing:**
- [ ] Integration tests pass
- [ ] Security tests pass
- [ ] Load tests pass (< 200ms p95)
- [ ] Organization isolation tests pass

**Monitoring:**
- [ ] Redis metrics configured
- [ ] Session metrics configured
- [ ] Audit log metrics configured
- [ ] Alerts configured (critical and warning)

**Documentation:**
- [ ] Migration guide reviewed
- [ ] Security notes reviewed
- [ ] Warnings document reviewed
- [ ] Runbook updated

**Team:**
- [ ] On-call engineer assigned
- [ ] Security team notified
- [ ] Rollback plan documented
- [ ] User communication prepared

---

## 📞 Emergency Contacts

**Security Incidents:**
- Security Team: security@yourcompany.com
- On-Call: [Phone Number]
- Incident Channel: #security-incidents (Slack)

**Infrastructure Issues:**
- DevOps Team: devops@yourcompany.com
- On-Call: [Phone Number]
- Incident Channel: #infrastructure (Slack)

**Escalation:**
- CTO: [Email]
- VP Engineering: [Email]

---

## Related Documents

- `decisions.md` - Architecture Decision Records
- `migration-notes.md` - Migration guide
- `security-notes.md` - Security considerations
- `architecture-changes.md` - Technical changes

---

**Document Status:** Living document - update as new warnings discovered  
**Last Updated:** 2026-02-27  
**Next Review:** Monthly or after incidents
