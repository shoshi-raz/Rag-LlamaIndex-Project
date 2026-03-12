# DevTask Manager - Version 0.3 Migration Guide

**Document Version:** 1.0  
**Created:** 2026-02-27  
**Author:** Marcus Williams (Principal Architect)  
**Target Audience:** DevOps, Backend Engineers

---

## Overview

Version 0.3 introduces **breaking changes** to the authentication system. This document provides step-by-step migration instructions from JWT-based authentication (v0.2) to session-based authentication with Redis (v0.3).

**⚠️ CRITICAL:** This is a breaking change. All clients must be updated simultaneously with the backend deployment.

---

## Migration Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **Phase 1: Infrastructure** | Week 1 | Deploy Redis, test connectivity |
| **Phase 2: Code Deployment** | Week 2 | Deploy v0.3 backend with dual-auth support |
| **Phase 3: Client Migration** | Week 2-3 | Update frontend to use session cookies |
| **Phase 4: JWT Removal** | Week 4 | Remove JWT code, monitor for issues |
| **Phase 5: Validation** | Week 5 | Security audit, performance testing |

**Total Duration:** 5 weeks  
**Rollback Window:** 48 hours after Phase 2

---

## Pre-Migration Checklist

### Infrastructure Requirements

- [ ] **Redis 7.0+** installed and accessible
- [ ] Redis password configured (AUTH enabled)
- [ ] Redis persistence enabled (RDB + AOF)
- [ ] Redis memory limit set (recommend 2GB minimum)
- [ ] Redis monitoring configured (memory, connections, latency)
- [ ] Network connectivity tested between API servers and Redis
- [ ] Firewall rules configured (Redis port 6379)
- [ ] SSL/TLS configured for Redis connections (production only)

### Backup Requirements

- [ ] Full database backup completed
- [ ] Current JWT_SECRET documented and stored securely
- [ ] Redis backup strategy configured
- [ ] Rollback plan documented and tested

### Team Readiness

- [ ] DevOps team trained on Redis operations
- [ ] On-call engineer assigned for migration window
- [ ] Communication plan for user notifications
- [ ] Incident response plan prepared

---

## Phase 1: Redis Infrastructure Setup

### Step 1.1: Install Redis

**Development (Local):**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows (WSL)
sudo apt-get install redis-server
redis-server --daemonize yes
```

**Production (Docker):**
```yaml
# docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7.2-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis-data:
```

### Step 1.2: Configure Redis

**redis.conf (Production Settings):**
```conf
# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# Security
requirepass YOUR_STRONG_PASSWORD_HERE
bind 127.0.0.1
protected-mode yes

# Performance
tcp-backlog 511
timeout 300
tcp-keepalive 300
```

### Step 1.3: Test Redis Connection

```bash
# Test connection
redis-cli -h localhost -p 6379 -a YOUR_PASSWORD ping
# Expected output: PONG

# Test write/read
redis-cli -h localhost -p 6379 -a YOUR_PASSWORD
> SET test "migration-test"
> GET test
> DEL test
> EXIT
```

### Step 1.4: Configure Monitoring

**Recommended Metrics:**
- Memory usage (alert if > 80%)
- Connected clients (alert if > 1000)
- Commands per second
- Evicted keys
- Keyspace hits/misses ratio

**Monitoring Tools:**
- Redis CLI: `redis-cli --stat`
- Prometheus + Redis Exporter
- CloudWatch (AWS)
- Datadog

---

## Phase 2: Backend Code Deployment

### Step 2.1: Install Dependencies

```bash
cd backend
npm install express-session connect-redis redis@4.6.13 rate-limit-redis
```

**Package Versions:**
- `express-session`: ^1.18.0
- `connect-redis`: ^7.1.0
- `redis`: ^4.6.13
- `rate-limit-redis`: ^4.2.0

### Step 2.2: Update Environment Variables

**Add to `.env`:**
```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here
REDIS_DB=0

# Session Configuration
SESSION_SECRET=your_session_secret_here_min_32_chars
SESSION_NAME=devtask.sid
SESSION_MAX_AGE=604800000  # 7 days in milliseconds

# Cookie Configuration (Production)
COOKIE_SECURE=true  # Set to false in development
COOKIE_DOMAIN=.yourdomain.com

# Legacy JWT (keep for dual-auth period)
JWT_SECRET=your_existing_jwt_secret
```

**⚠️ SECURITY:** Generate strong secrets:
```bash
# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate REDIS_PASSWORD
openssl rand -base64 32
```

### Step 2.3: Update Database Schema

**Run Migration:**
```bash
psql -U devtask_user -d devtask_db -f database/migrations/003_schema_enhancements.sql
```

**Verify Migration:**
```sql
-- Check soft delete column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'deleted_at';

-- Check last_login column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'last_login';

-- Check audit_logs enhancements
SELECT COUNT(*) FROM audit_logs;
```

### Step 2.4: Deploy Backend Code

**Deployment Steps:**
1. Stop current API server
2. Pull v0.3 code from repository
3. Run `npm install`
4. Run database migrations
5. Start API server
6. Verify health check: `curl http://localhost:3000/health`
7. Test Redis connection in logs

**Rollback Procedure:**
```bash
# If issues occur within 48 hours
git checkout v0.2.0
npm install
systemctl restart devtask-api
# Users will need to re-login (JWT still works)
```

---

## Phase 3: Frontend Migration

### Step 3.1: Update API Client

**Before (JWT in localStorage):**
```javascript
// Old code - DO NOT USE
const token = localStorage.getItem('token');
axios.get('/api/tasks', {
  headers: { Authorization: `Bearer ${token}` }
});
```

**After (Session cookies):**
```javascript
// New code - v0.3
axios.get('/api/tasks', {
  withCredentials: true  // Send cookies
});
```

### Step 3.2: Update Authentication Context

**Changes Required:**
1. Remove `localStorage.setItem('token')` calls
2. Remove `Authorization` header logic
3. Add `withCredentials: true` to all axios requests
4. Update login/logout flows

**Example:**
```javascript
// frontend/src/context/AuthContext.jsx
const login = async (email, password) => {
  const response = await axios.post('/api/auth/login', 
    { email, password },
    { withCredentials: true }  // NEW: Enable cookies
  );
  
  // OLD: localStorage.setItem('token', response.data.token);
  // NEW: Cookie is set automatically by server
  
  setUser(response.data.user);
};

const logout = async () => {
  await axios.post('/api/auth/logout', {}, 
    { withCredentials: true }
  );
  
  // OLD: localStorage.removeItem('token');
  // NEW: Cookie is cleared by server
  
  setUser(null);
};
```

### Step 3.3: Update Axios Configuration

**Create axios instance:**
```javascript
// frontend/src/api/client.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,  // Always send cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

export default apiClient;
```

### Step 3.4: Update CORS Configuration

**Vite proxy (development):**
```javascript
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        credentials: 'include'  // NEW: Forward cookies
      }
    }
  }
}
```

### Step 3.5: Deploy Frontend

```bash
cd frontend
npm run build
# Deploy dist/ folder to hosting
```

**Verify:**
1. Open browser DevTools → Application → Cookies
2. Login to application
3. Verify `devtask.sid` cookie exists
4. Check cookie attributes: `HttpOnly`, `Secure`, `SameSite=Strict`

---

## Phase 4: JWT Removal

**⚠️ WARNING:** Only proceed after 30 days of stable v0.3 operation.

### Step 4.1: Verify No JWT Usage

```bash
# Search codebase for JWT references
grep -r "jwt" backend/src/
grep -r "Bearer" backend/src/
grep -r "localStorage" frontend/src/
```

### Step 4.2: Remove JWT Code

**Files to modify:**
- `backend/src/middleware/auth.js` - Remove JWT verification
- `backend/src/controllers/authController.js` - Remove JWT generation
- `backend/package.json` - Remove `jsonwebtoken` dependency

### Step 4.3: Remove Environment Variables

**Delete from `.env`:**
```bash
# JWT_SECRET=...  # No longer needed
```

---

## Phase 5: Post-Migration Validation

### Security Testing

**Test Cases:**
1. **Session Creation:** Login creates session in Redis
2. **Session Validation:** Authenticated requests work
3. **Session Expiration:** Sessions expire after 7 days
4. **Session Revocation:** Logout deletes session from Redis
5. **Cookie Security:** Cookies have HttpOnly, Secure, SameSite attributes
6. **CSRF Protection:** Cross-site requests blocked
7. **Rate Limiting:** Rate limits enforced per IP and user

**Security Checklist:**
- [ ] XSS attack test (session cookie not accessible via JavaScript)
- [ ] CSRF attack test (cross-origin requests blocked)
- [ ] Session fixation test (session ID regenerated on login)
- [ ] Session hijacking test (stolen session ID doesn't work from different IP)
- [ ] Brute force test (rate limiting blocks repeated login attempts)

### Performance Testing

**Metrics to Monitor:**
- API response time (should be < 200ms p95)
- Redis latency (should be < 5ms)
- Session lookup time (should be < 2ms)
- Memory usage (Redis should be < 80% capacity)

**Load Test:**
```bash
# Using Apache Bench
ab -n 10000 -c 100 -C "devtask.sid=test_session_id" \
   http://localhost:3000/api/tasks

# Expected: < 200ms average response time
```

### Monitoring Setup

**Alerts to Configure:**
1. Redis down (critical)
2. Redis memory > 80% (warning)
3. Redis latency > 10ms (warning)
4. Session creation failures (critical)
5. API error rate > 1% (warning)

---

## Troubleshooting

### Issue: "Session not found" errors

**Symptoms:** Users logged out randomly

**Possible Causes:**
1. Redis restarted without persistence
2. Redis memory full (evicting sessions)
3. Session TTL too short

**Solutions:**
```bash
# Check Redis memory
redis-cli INFO memory

# Check evicted keys
redis-cli INFO stats | grep evicted

# Increase memory limit
redis-cli CONFIG SET maxmemory 4gb
```

### Issue: CORS errors in browser

**Symptoms:** "Access-Control-Allow-Credentials" error

**Solution:**
```javascript
// backend/src/app.js
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true  // MUST be true
}));
```

### Issue: Cookies not set in browser

**Symptoms:** Login succeeds but no cookie appears

**Possible Causes:**
1. `COOKIE_SECURE=true` but using HTTP (not HTTPS)
2. Domain mismatch
3. SameSite policy blocking

**Solutions:**
```bash
# Development: Disable secure flag
COOKIE_SECURE=false

# Production: Use HTTPS
# Ensure frontend and backend on same domain
```

### Issue: High Redis latency

**Symptoms:** Slow API responses

**Solutions:**
1. Check Redis on same network as API servers
2. Enable connection pooling
3. Monitor Redis slow log: `redis-cli SLOWLOG GET 10`
4. Consider Redis Cluster for horizontal scaling

---

## Rollback Plan

### When to Rollback

Rollback if any of these occur within 48 hours:
- Session creation failure rate > 5%
- Redis unavailable for > 5 minutes
- API error rate > 10%
- User complaints > 50

### Rollback Procedure

**Step 1: Revert Backend**
```bash
cd backend
git checkout v0.2.0
npm install
systemctl restart devtask-api
```

**Step 2: Revert Frontend**
```bash
cd frontend
git checkout v0.2.0
npm install
npm run build
# Deploy dist/
```

**Step 3: Notify Users**
- All users must re-login (sessions lost)
- JWT authentication restored
- Apologize for inconvenience

**Step 4: Post-Mortem**
- Document what went wrong
- Fix issues before retry
- Schedule new migration date

---

## Success Criteria

Migration is successful when:
- [ ] Zero authentication errors for 7 consecutive days
- [ ] Redis uptime > 99.9%
- [ ] API response time < 200ms p95
- [ ] No user complaints about login issues
- [ ] Security audit passed
- [ ] All monitoring alerts configured
- [ ] Documentation updated
- [ ] Team trained on new system

---

## Support Contacts

**During Migration:**
- **On-Call Engineer:** [Your Name] - [Phone]
- **Redis Expert:** [Name] - [Email]
- **Security Team:** security@yourcompany.com
- **Incident Channel:** #devtask-migration (Slack)

**Post-Migration:**
- **Bug Reports:** GitHub Issues
- **Security Issues:** security@yourcompany.com (PGP key available)

---

## Related Documents

- `decisions.md` - ADR-004 (JWT → Session decision)
- `security-notes.md` - Security considerations
- `architecture-changes.md` - Technical architecture changes
- `warnings.md` - Critical warnings

---

**Document Status:** Living document - update after each migration phase  
**Last Updated:** 2026-02-27  
**Next Review:** After Phase 5 completion
