# DevTask Manager - Security Notes

**Document Version:** 1.0  
**Created:** 2026-02-27  
**Author:** Security Team & Marcus Williams  
**Classification:** Internal - Security Sensitive  
**Last Security Audit:** 2026-02-27

---

## Overview

This document outlines security considerations, threat models, and security best practices for DevTask Manager v0.3. All engineers must read this document before working on authentication, authorization, or data access code.

**⚠️ CRITICAL:** Report security vulnerabilities to security@yourcompany.com immediately. Do NOT create public GitHub issues for security bugs.

---

## Security Architecture Changes in v0.3

### 1. Authentication System Overhaul

**Previous (v0.2):** JWT tokens in localStorage  
**Current (v0.3):** Session-based authentication with Redis

**Security Improvements:**
- ✅ **XSS Protection:** httpOnly cookies prevent JavaScript access to session tokens
- ✅ **Instant Revocation:** Sessions can be invalidated immediately (logout, security breach)
- ✅ **Reduced Attack Surface:** Smaller session ID (32 bytes) vs JWT (200-500 bytes)
- ✅ **CSRF Protection:** SameSite=Strict cookie attribute prevents cross-site attacks

**New Risks:**
- ⚠️ **Redis Dependency:** Redis compromise exposes all active sessions
- ⚠️ **Session Fixation:** Must regenerate session ID on login
- ⚠️ **Network Exposure:** Redis must be network-isolated

---

## Threat Model

### Assets to Protect

| Asset | Sensitivity | Impact if Compromised |
|-------|-------------|----------------------|
| User passwords | Critical | Account takeover, credential stuffing |
| Session tokens | Critical | Account hijacking, unauthorized access |
| Redis session store | Critical | Mass account compromise |
| Database credentials | Critical | Full data breach |
| Audit logs | High | Evidence tampering, compliance violation |
| User PII | High | Privacy violation, GDPR breach |
| Task data | Medium | Business information disclosure |

### Threat Actors

**1. External Attackers**
- **Motivation:** Data theft, ransomware, reputation damage
- **Capabilities:** Automated scanning, known exploits, social engineering
- **Attack Vectors:** SQL injection, XSS, brute force, credential stuffing

**2. Malicious Insiders**
- **Motivation:** Data exfiltration, sabotage, espionage
- **Capabilities:** Legitimate access, knowledge of systems
- **Attack Vectors:** Privilege escalation, audit log tampering, data export

**3. Compromised Accounts**
- **Motivation:** Varies (attacker-dependent)
- **Capabilities:** User-level access, API usage
- **Attack Vectors:** Phishing, password reuse, session hijacking

---

## Authentication Security

### Password Security

**Requirements:**
- Minimum 8 characters (enforced)
- Bcrypt hashing with 12 rounds (current)
- No password complexity requirements (research shows they reduce security)
- No password expiration (NIST guidelines)

**Implementation:**
```javascript
// CORRECT
const salt = await bcrypt.genSalt(12);
const hash = await bcrypt.hash(password, salt);

// WRONG - Never do this
const hash = crypto.createHash('sha256').update(password).digest('hex');
```

**⚠️ WARNING:** Never log passwords, even in development. Use `[REDACTED]` in logs.

### Session Security

**Session Configuration:**
```javascript
{
  secret: process.env.SESSION_SECRET,  // Min 32 chars
  name: 'devtask.sid',                 // Custom name (security through obscurity)
  resave: false,                       // Don't save unchanged sessions
  saveUninitialized: false,            // Don't create sessions for anonymous users
  cookie: {
    httpOnly: true,                    // Prevent JavaScript access
    secure: true,                      // HTTPS only (production)
    sameSite: 'strict',                // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000   // 7 days
  }
}
```

**Session Lifecycle:**
1. **Creation:** On successful login, generate cryptographically random session ID
2. **Regeneration:** Regenerate session ID on login to prevent fixation
3. **Validation:** Check session exists in Redis on every authenticated request
4. **Expiration:** Redis TTL automatically expires sessions after 7 days
5. **Revocation:** Delete from Redis on logout or security event

**⚠️ CRITICAL:** Always call `req.session.regenerate()` after successful login:
```javascript
// CORRECT
req.session.regenerate((err) => {
  if (err) return next(err);
  req.session.userId = user.id;
  req.session.save();
});

// WRONG - Session fixation vulnerability
req.session.userId = user.id;
```

### Redis Security

**Network Security:**
- Redis MUST be on private network (not internet-accessible)
- Use firewall rules to restrict access to API servers only
- Enable Redis AUTH with strong password (min 32 chars)
- Use TLS for Redis connections in production

**Redis Configuration:**
```conf
# Security
requirepass YOUR_STRONG_PASSWORD_HERE
bind 127.0.0.1                    # Localhost only
protected-mode yes                # Reject external connections
rename-command FLUSHDB ""         # Disable dangerous commands
rename-command FLUSHALL ""
rename-command CONFIG "CONFIG_SECRET_NAME"
```

**Access Control:**
- Use Redis ACLs (Redis 6+) to limit command access
- Separate Redis user for application vs admin
- Monitor Redis logs for unauthorized access attempts

**⚠️ CRITICAL:** If Redis is compromised, assume all sessions are compromised. Immediate response:
1. Flush all sessions: `redis-cli FLUSHDB`
2. Force all users to re-login
3. Rotate Redis password
4. Investigate breach source
5. Review audit logs for suspicious activity

---

## Authorization Security

### Role-Based Access Control (RBAC)

**Roles:**
- `admin`: Full access to organization
- `manager`: Manage projects and tasks, view users
- `developer`: Manage own tasks only

**Authorization Middleware:**
```javascript
// CORRECT - Check role before action
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Usage
router.delete('/tasks/:id', authenticate, authorize('admin', 'manager'), deleteTask);
```

**⚠️ WARNING:** Never trust client-side role checks. Always verify on server:
```javascript
// WRONG - Client can manipulate this
if (user.role === 'admin') {
  // Show delete button
}

// CORRECT - Server enforces authorization
router.delete('/tasks/:id', authenticate, authorize('admin'), deleteTask);
```

### Organization Isolation

**Principle:** Users can only access data within their organization.

**Implementation:**
```javascript
// CORRECT - Always filter by organization_id
const tasks = await db.query(
  `SELECT t.* FROM tasks t
   JOIN projects p ON t.project_id = p.id
   WHERE p.organization_id = $1`,
  [req.user.organization_id]
);

// WRONG - Exposes all organizations' data
const tasks = await db.query('SELECT * FROM tasks');
```

**⚠️ CRITICAL:** Every query that returns user data MUST include organization_id filter. Code review checklist:
- [ ] Query includes organization_id filter
- [ ] JOIN to projects or users table for organization_id
- [ ] No direct access to tasks without organization check
- [ ] Unit tests verify organization isolation

---

## Input Validation & Injection Prevention

### SQL Injection Prevention

**Always use parameterized queries:**
```javascript
// CORRECT
const result = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// WRONG - SQL injection vulnerability
const result = await db.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

**⚠️ CRITICAL:** Never concatenate user input into SQL queries. Use parameterized queries ($1, $2, etc.) for all dynamic values.

### XSS Prevention

**Defense Layers:**
1. **httpOnly Cookies:** Session tokens not accessible to JavaScript
2. **Content Security Policy (CSP):** Restrict script sources
3. **Input Sanitization:** Escape HTML in user-generated content
4. **Output Encoding:** React automatically escapes JSX content

**CSP Header (recommended):**
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind requires inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));
```

### CSRF Prevention

**Protection Mechanisms:**
1. **SameSite Cookies:** `sameSite: 'strict'` prevents cross-site cookie sending
2. **Origin Validation:** Check `Origin` and `Referer` headers
3. **CORS Configuration:** Restrict allowed origins

**CORS Configuration:**
```javascript
// CORRECT
app.use(cors({
  origin: process.env.FRONTEND_URL,  // Specific origin only
  credentials: true,                 // Allow cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

// WRONG - Allows any origin
app.use(cors({
  origin: '*',
  credentials: true
}));
```

---

## Rate Limiting & DoS Prevention

### Rate Limiting Strategy

**Tiered Limits:**
```javascript
// Global limit (all endpoints)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per IP
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ client: redisClient })
});

// Auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                     // 5 login attempts per IP
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later.'
});

// Authenticated users (more lenient)
const authenticatedLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 1000,                  // 1000 requests per user
  keyGenerator: (req) => req.user.id  // Rate limit by user ID
});
```

**⚠️ WARNING:** Rate limiting must use Redis store in production. In-memory store doesn't work with multiple server instances.

### Account Lockout

**Not Implemented Yet (Planned for v0.4):**
- Lock account after 10 failed login attempts
- Lockout duration: 30 minutes
- Email notification to user
- Admin can unlock accounts

**Rationale for Deferral:**
- Rate limiting provides sufficient protection for v0.3
- Account lockout can be weaponized (DoS by locking legitimate users)
- Requires email notification system (not yet implemented)

---

## Audit Logging Security

### What to Log

**Authentication Events:**
- Login success/failure (with IP, user agent, timestamp)
- Logout
- Password change
- Session expiration
- Account lockout

**Authorization Events:**
- Permission denied (403 errors)
- Role changes
- Access to sensitive resources

**Data Operations:**
- Task creation/update/deletion
- User creation/deactivation
- Project creation/deletion
- Organization settings changes

**Administrative Actions:**
- User role modifications
- System configuration changes
- Audit log access (yes, we audit who views audit logs)

### What NOT to Log

**⚠️ NEVER log:**
- Passwords (plaintext or hashed)
- Session tokens
- Credit card numbers
- Social security numbers
- API keys or secrets

**Redaction Example:**
```javascript
// CORRECT
logger.info({
  event: 'login_attempt',
  email: user.email,
  password: '[REDACTED]',
  ip: req.ip
});

// WRONG
logger.info({
  event: 'login_attempt',
  email: user.email,
  password: req.body.password,  // NEVER DO THIS
  ip: req.ip
});
```

### Audit Log Protection

**Security Measures:**
- Audit logs stored in separate database/table
- Append-only (no UPDATE or DELETE)
- Separate database user with INSERT-only permissions
- Encrypted at rest
- Backed up daily to immutable storage
- Access logged (audit the auditors)

**⚠️ CRITICAL:** Audit log tampering is a serious security incident. If detected:
1. Assume breach in progress
2. Preserve evidence (snapshot database)
3. Investigate immediately
4. Report to security team and legal

---

## Soft Delete Security

### Implementation

**Soft Delete Pattern:**
```javascript
// CORRECT - Soft delete
await db.query(
  'UPDATE tasks SET deleted_at = NOW() WHERE id = $1',
  [taskId]
);

// CORRECT - Query excludes soft-deleted
const tasks = await db.query(
  'SELECT * FROM tasks WHERE deleted_at IS NULL AND project_id = $1',
  [projectId]
);

// WRONG - Hard delete (bypasses audit trail)
await db.query('DELETE FROM tasks WHERE id = $1', [taskId]);
```

**⚠️ CRITICAL WARNING:** Soft delete must not be bypassed. All task queries MUST include `deleted_at IS NULL` check. Bypassing soft delete:
- Violates audit requirements
- Exposes deleted data to users
- Breaks compliance (GDPR right to deletion)
- May constitute data breach

### Permanent Deletion

**Scheduled Job (runs daily):**
```javascript
// Delete tasks soft-deleted > 90 days ago
await db.query(
  `DELETE FROM tasks 
   WHERE deleted_at IS NOT NULL 
   AND deleted_at < NOW() - INTERVAL '90 days'`
);
```

**Manual Permanent Deletion:**
- Requires admin role
- Requires security team approval
- Logged in audit_logs
- Irreversible (warn user)

---

## Data Privacy & Compliance

### GDPR Compliance

**User Rights:**
1. **Right to Access:** Users can export their data (planned v0.4)
2. **Right to Rectification:** Users can update their profile
3. **Right to Erasure:** Users can request account deletion
4. **Right to Portability:** Data export in JSON format (planned v0.4)

**Data Retention:**
- Active user data: Indefinite
- Soft-deleted tasks: 90 days
- Audit logs: 2 years
- Deleted accounts: 30 days (then permanent deletion)

**⚠️ LEGAL:** Consult legal team before changing retention policies.

### PII Handling

**PII in System:**
- User email (required for login)
- User name (optional)
- IP addresses (audit logs)
- User agent strings (audit logs)

**Protection Measures:**
- Encrypted at rest (database encryption)
- Encrypted in transit (TLS)
- Access logged (audit_logs)
- Minimal collection (only what's necessary)

---

## Secrets Management

### Environment Variables

**Secrets to Protect:**
- `JWT_SECRET` (legacy, remove in v0.3.3)
- `SESSION_SECRET` (critical)
- `REDIS_PASSWORD` (critical)
- `DB_PASSWORD` (critical)

**Best Practices:**
- Never commit secrets to Git
- Use `.env` file (add to `.gitignore`)
- Use secrets manager in production (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets quarterly
- Use different secrets per environment (dev, staging, prod)

**Secret Rotation Procedure:**
1. Generate new secret
2. Update secrets manager
3. Deploy new secret to all servers
4. Verify all servers using new secret
5. Remove old secret after 24 hours

**⚠️ CRITICAL:** If secret is compromised:
1. Rotate immediately (within 1 hour)
2. Invalidate all sessions (if SESSION_SECRET compromised)
3. Investigate how secret was exposed
4. Review audit logs for unauthorized access
5. Report to security team

---

## Security Monitoring & Incident Response

### Monitoring Alerts

**Critical Alerts (Page On-Call):**
- Redis down
- Database connection failure
- Authentication failure rate > 10%
- 500 error rate > 5%
- Unauthorized access attempts (403 errors spike)

**Warning Alerts (Email):**
- Redis memory > 80%
- Rate limit triggered > 100 times/hour
- Failed login attempts > 50/hour
- Audit log write failures

### Incident Response Plan

**Severity Levels:**
- **P0 (Critical):** Active breach, data exfiltration, system down
- **P1 (High):** Vulnerability discovered, potential breach
- **P2 (Medium):** Security misconfiguration, non-critical vulnerability
- **P3 (Low):** Security improvement opportunity

**Response Procedure:**
1. **Detect:** Monitoring alert or user report
2. **Assess:** Determine severity and impact
3. **Contain:** Isolate affected systems, revoke compromised credentials
4. **Investigate:** Review audit logs, identify root cause
5. **Remediate:** Fix vulnerability, patch systems
6. **Recover:** Restore normal operations
7. **Post-Mortem:** Document incident, improve defenses

**Contacts:**
- **Security Team:** security@yourcompany.com
- **On-Call Engineer:** [Phone]
- **Legal:** legal@yourcompany.com (for data breaches)

---

## Security Testing

### Pre-Deployment Checklist

- [ ] All dependencies updated (no known vulnerabilities)
- [ ] SQL injection tests passed
- [ ] XSS tests passed
- [ ] CSRF tests passed
- [ ] Authentication tests passed
- [ ] Authorization tests passed
- [ ] Rate limiting tests passed
- [ ] Session security tests passed
- [ ] Audit logging tests passed
- [ ] Secrets not in code
- [ ] Security headers configured (helmet)
- [ ] HTTPS enforced (production)

### Penetration Testing

**Schedule:** Quarterly (every 3 months)

**Scope:**
- Authentication bypass attempts
- Authorization escalation attempts
- SQL injection testing
- XSS testing
- CSRF testing
- Session hijacking attempts
- Rate limiting bypass attempts

**Tools:**
- OWASP ZAP
- Burp Suite
- SQLMap
- Nikto

---

## Security Best Practices for Developers

### Code Review Security Checklist

**For Every Pull Request:**
- [ ] No secrets in code
- [ ] Parameterized SQL queries
- [ ] Authorization checks present
- [ ] Organization isolation enforced
- [ ] Input validation implemented
- [ ] Error messages don't leak sensitive info
- [ ] Audit logging for sensitive operations
- [ ] Rate limiting on new endpoints
- [ ] Tests include security test cases

### Secure Coding Guidelines

**DO:**
- Use parameterized queries
- Validate all user input
- Check authorization on every endpoint
- Log security events
- Use httpOnly cookies
- Enable HTTPS in production
- Keep dependencies updated
- Follow principle of least privilege

**DON'T:**
- Log passwords or tokens
- Trust client-side validation
- Concatenate SQL queries
- Store secrets in code
- Use weak cryptography
- Expose stack traces in production
- Grant excessive permissions
- Ignore security warnings

---

## Open Security Questions

### 1. Should we implement 2FA?

**Arguments For:**
- Significantly reduces account takeover risk
- Industry best practice
- Customer requests

**Arguments Against:**
- Implementation complexity
- User friction
- Support burden

**Status:** Deferred to v0.4. Evaluate after OAuth 2.0 implementation.

### 2. Should we encrypt session data in Redis?

**Arguments For:**
- Defense in depth
- Compliance requirement for some industries

**Arguments Against:**
- Performance overhead
- Redis should be network-isolated anyway

**Status:** Under security team review. Decision needed by 2026-03-15.

### 3. Should we implement IP-based session binding?

**Concept:** Bind session to IP address, reject if IP changes.

**Arguments For:**
- Prevents session hijacking

**Arguments Against:**
- Breaks for mobile users (IP changes frequently)
- Breaks for users behind NAT

**Status:** Rejected. Too many false positives.

---

## Related Documents

- `decisions.md` - ADR-004 (JWT → Session decision)
- `migration-notes.md` - Migration guide
- `architecture-changes.md` - Technical changes
- `warnings.md` - Critical warnings

---

**Document Classification:** Internal - Security Sensitive  
**Distribution:** Engineering team only  
**Review Schedule:** Quarterly or after security incidents  
**Last Updated:** 2026-02-27  
**Next Review:** 2026-05-27
