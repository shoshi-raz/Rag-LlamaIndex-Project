# DevTask Manager - Technical Constraints

**Document Version:** 1.0  
**Last Updated:** 2026-02-26  
**Author:** Engineering Team  
**Status:** Active

---

## 1. Infrastructure Constraints

### 1.1 Database Limits
| Resource | Limit | Notes |
|----------|-------|-------|
| Connection Pool | 20 max | Can be increased to 50 |
| Query Timeout | 30 seconds | Long queries killed |
| Max Row Size | 8 KB (1 MB TOAST) | Large text stored separately |
| Concurrent Users | ~100 | Per instance |

### 1.2 API Constraints
| Resource | Limit | Notes |
|----------|-------|-------|
| Rate Limit | 100 req/15 min | Per IP address |
| Payload Size | 10 MB | JSON body limit |
| JWT Expiry | 24 hours | Refresh planned for v0.3 |
| Response Timeout | 30 seconds | Load balancer threshold |

---

## 2. Technology Constraints

### 2.1 Node.js Limitations
- **Single-threaded event loop:** CPU-intensive operations block
  - Mitigation: Worker threads for reports (planned v0.3)
- **Memory:** Default 1.4 GB heap per process
  - Mitigation: Cluster mode in production

### 2.2 React SPA Constraints
- **SEO:** Limited search engine indexing
  - Mitigation: SSR considered for v0.4
- **Initial Bundle:** ~200 KB gzipped
  - Mitigation: Code splitting implemented

### 2.3 PostgreSQL Constraints
- **Max Columns:** 250 per table (we use ~15)
- **Index Limit:** 64 per table
- **UUID Storage:** 16 bytes per key vs 4 bytes for INT
  - Trade-off accepted for distributed safety

---

## 3. Browser Constraints

### 3.1 Supported Browsers
| Browser | Minimum Version | Notes |
|---------|-----------------|-------|
| Chrome | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari | 14+ | Minor CSS issues |
| Edge | 90+ | Full support |
| IE | Not supported | EOL |

### 3.2 Known Browser Limitations
- **LocalStorage:** 5-10 MB limit
  - JWT tokens only, no large data
- **CORS:** Preflight requests add latency
  - ~50ms per request

---

## 4. Security Constraints

### 4.1 Current Limitations
- **JWT in localStorage:** XSS vulnerability
  - Constraint: Must implement CSP headers
  - Solution planned: httpOnly cookies in v0.3

- **No CSRF Protection:** Not needed for JWT
  - Constraint: Changing to cookies requires CSRF tokens

### 4.2 Rate Limiting
- Current: Express-rate-limit, in-memory store
- Constraint: Restarting server resets counts
- Solution planned: Redis store in v0.3

---

## 5. Scalability Constraints

### 5.1 Current Architecture Limits
| Metric | Limit | Scaling Strategy |
|--------|-------|------------------|
| Organizations | 1,000 | Sharding by region |
| Users per Org | 100 | Horizontal scaling |
| Tasks per Org | 100,000 | Partitioning |
| Concurrent Connections | 100 | Load balancer |

### 5.2 Scaling Bottlenecks
1. **Database CPU:** Single write primary
   - Solution: Read replicas in v0.4
2. **File Storage:** Local filesystem (none yet)
   - Solution: S3/MinIO for attachments
3. **Memory:** Session storage (none, stateless)
   - Solution: Redis for cache in v0.3

---

## 6. Feature Constraints

### 6.1 Not Implemented (By Design)
| Feature | Reason | Planned |
|---------|--------|---------|
| Real-time sync | WebSocket complexity | v0.3 |
| Offline mode | PWA complexity | v0.5 |
| Full-text search | Needs Elasticsearch | v0.4 |
| SAML SSO | Enterprise requirement | v0.5 |

### 6.2 Intentionally Limited
| Feature | Limit | Reason |
|---------|-------|--------|
| File uploads | None yet | Storage complexity |
| Task nesting | No subtasks | UI complexity |
| Custom fields | Predefined only | Schema complexity |
| Automation rules | None | Business logic complexity |

---

## 7. Version 0.2 Specific Constraints

### 7.1 PostgreSQL Migration
- **Constraint:** No rollback to SQLite
- **Impact:** PostgreSQL required for all dev environments
- **Mitigation:** Docker Compose setup provided

### 7.2 Audit Logging
- **Constraint:** No UI for viewing logs
- **Access:** Database queries only
- **Solution:** Admin dashboard planned v0.4

### 7.3 Role System
- **Constraint:** Roles are hierarchical only
- **No:** Custom permissions per user
- **Future:** Role customization v0.4

---

## 8. External Dependencies

### 8.1 Required Services
| Service | Purpose | Fallback |
|---------|---------|----------|
| PostgreSQL | Primary data | None (critical) |
| SMTP (future) | Email | Console logging |

### 8.2 Optional Services (v0.3+)
| Service | Purpose | Fallback |
|---------|---------|----------|
| Redis | Cache/Sessions | In-memory |
| SendGrid | Email | AWS SES |
| S3/MinIO | File storage | Local disk |

---

## 9. Development Constraints

### 9.1 Local Development
- **Ports:** 3000 (backend), 5173 (frontend), 5432 (PostgreSQL)
- **Node.js:** Version 18+ required
- **PostgreSQL:** Version 15+ required

### 9.2 Testing Constraints
- **Test Database:** Separate schema required
- **Seed Data:** Required for meaningful tests
- **CI:** GitHub Actions (planned)

---

## 10. Known Trade-offs

| Decision | Constraint Accepted | Benefit |
|----------|---------------------|---------|
| Raw SQL | Manual query writing | Performance, control |
| JWT in localStorage | XSS risk | Simplicity |
| No ORM | More boilerplate | Flexibility |
| Monolith | Tight coupling | Development speed |
| Tailwind | Learning curve | Consistency |

---

**⚠️ WARNING:** These constraints are current as of v0.2. Review before each release.

**Related Documents:**
- `architecture.md` - System design
- `decisions.md` - Why these constraints exist
- `known-issues.md` - Active problems
