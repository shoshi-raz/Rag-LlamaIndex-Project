# DevTask Manager - Architecture Documentation

**Version:** 0.3.0  
**Last Updated:** 2026-02-27  
**Status:** Active Development

---

## Overview

This directory contains comprehensive architecture documentation for DevTask Manager. Version 0.3 introduces major architectural changes focused on security, scalability, and compliance.

---

## Document Index

### Core Documentation

1. **[decisions.md](./decisions.md)** - Architecture Decision Records (ADRs)
   - All major technical decisions with rationale
   - Includes reversals and disagreements
   - Open questions and unresolved issues
   - **Start here** to understand why things are the way they are

2. **[architecture-changes.md](./architecture-changes.md)** - Version 0.3 Technical Changes
   - Detailed implementation of session-based authentication
   - Redis integration architecture
   - Rate limiting enhancements
   - Database schema changes
   - Performance considerations

3. **[migration-notes.md](./migration-notes.md)** - Migration Guide
   - Step-by-step migration from v0.2 to v0.3
   - Infrastructure setup (Redis)
   - Code deployment procedures
   - Rollback plan
   - Troubleshooting guide

4. **[security-notes.md](./security-notes.md)** - Security Considerations
   - Threat model and risk analysis
   - Authentication and authorization security
   - Input validation and injection prevention
   - Audit logging requirements
   - Incident response procedures

5. **[warnings.md](./warnings.md)** - Critical Warnings & Gotchas
   - **READ THIS FIRST** before making changes
   - Critical security warnings
   - Common mistakes and how to avoid them
   - Pre-deployment checklist

---

## Version 0.3 Highlights

### Major Changes

**1. Authentication System Overhaul**
- ❌ Removed: JWT tokens in localStorage
- ✅ Added: Session-based authentication with Redis
- ✅ Security: httpOnly cookies prevent XSS attacks
- ✅ Feature: Instant session revocation

**2. Enhanced Rate Limiting**
- ❌ Removed: In-memory rate limiting (doesn't work with multiple servers)
- ✅ Added: Redis-backed distributed rate limiting
- ✅ Feature: Tiered limits (global, auth, per-user)

**3. Database Enhancements**
- ✅ Added: Soft delete for tasks (90-day retention)
- ✅ Added: Priority indexing for performance
- ✅ Enhanced: Comprehensive audit logging
- ✅ Feature: Last login tracking

**4. Security Hardening**
- ✅ XSS protection via httpOnly cookies
- ✅ CSRF protection via SameSite cookies
- ✅ Brute force protection via rate limiting
- ✅ Audit logging for all sensitive operations

### Breaking Changes

⚠️ **This is a breaking release**

- All clients must migrate from JWT to session-based auth
- Redis is now a required dependency
- CORS configuration must include `credentials: true`
- All task queries must include `deleted_at IS NULL`

---

## Quick Start

### For Developers

1. **Read warnings.md first** - Understand critical constraints
2. **Review decisions.md** - Understand architectural decisions
3. **Follow migration-notes.md** - Deploy v0.3 changes
4. **Consult security-notes.md** - Implement security best practices

### For Architects

1. **decisions.md** - Review ADRs and open questions
2. **architecture-changes.md** - Understand technical implementation
3. **security-notes.md** - Review threat model and security posture

### For DevOps

1. **migration-notes.md** - Infrastructure setup and deployment
2. **warnings.md** - Pre-deployment checklist
3. **architecture-changes.md** - Monitoring and observability requirements

---

## Key Decisions

### ADR-004: JWT → Session-Based Authentication

**Why Changed:**
- JWT in localStorage vulnerable to XSS
- No instant token revocation
- Large token size

**Trade-offs:**
- ✅ Better security (httpOnly cookies)
- ✅ Instant revocation
- ⚠️ Redis dependency
- ⚠️ Operational complexity

**Disagreement:** Sarah Chen argued for JWT with httpOnly cookies instead. Decision accepted due to revocation requirements.

### ADR-013: Redis-Backed Rate Limiting

**Why Added:**
- In-memory rate limiting doesn't work across multiple servers
- Need distributed state for rate limits

**Trade-offs:**
- ✅ Works with horizontal scaling
- ✅ Consistent rate limiting
- ⚠️ Redis dependency (already added for sessions)

### ADR-014: Soft Delete for Tasks

**Why Added:**
- Accidental deletion recovery
- Audit trail preservation
- Compliance requirement

**Trade-offs:**
- ✅ Data recovery capability
- ✅ Better audit trail
- ⚠️ Query complexity (must filter deleted_at)
- ⚠️ Storage overhead

---

## Critical Warnings

### 🚨 DO NOT

1. **Change session middleware without security review**
   - Impact: Account hijacking, mass security breach
   - Approval required from: Security Team, Principal Architect, CTO

2. **Bypass soft delete**
   - Impact: Audit trail loss, compliance violation
   - All DELETE operations must use UPDATE with deleted_at

3. **Log passwords or session tokens**
   - Impact: Credential exposure, account takeover
   - Always redact sensitive data in logs

4. **Skip organization isolation checks**
   - Impact: Data breach, unauthorized access
   - Every query must filter by organization_id

5. **Use in-memory rate limiting in production**
   - Impact: Rate limiting ineffective, DoS vulnerability
   - Must use Redis-backed rate limiting

---

## Open Questions

### 1. Redis High Availability Strategy
- **Question:** Redis Sentinel (3-node) or Redis Cluster?
- **Status:** Deferred to v0.4
- **Decision Needed By:** 2026-04-01

### 2. Session Data Encryption
- **Question:** Should we encrypt session data in Redis?
- **Status:** Under security team review
- **Decision Needed By:** 2026-03-15

### 3. Soft Delete Retention Period
- **Question:** 30, 60, or 90 days before permanent deletion?
- **Current:** 90 days (conservative)
- **Reconsideration:** After 6 months of usage data

---

## Infrastructure Requirements

### Development
- PostgreSQL 15+
- Redis 7.0+ (single instance)
- Node.js 18+

### Production
- PostgreSQL 15+ (with connection pooling)
- Redis Sentinel (3-node cluster for HA)
- Node.js 18+
- Load balancer (Nginx)

---

## Related Resources

### External Documentation
- [Redis Documentation](https://redis.io/docs/)
- [Express Session](https://github.com/expressjs/session)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

### Internal Resources
- GitHub Repository: [Link]
- Slack Channel: #devtask-dev
- Security Team: security@yourcompany.com

---

## Document Maintenance

### Review Schedule
- **Architecture decisions:** Quarterly
- **Security notes:** After any security incident
- **Open questions:** Monthly in architecture meeting
- **Warnings:** As new issues discovered

### Document Owners
- **decisions.md:** Marcus Williams (Principal Architect)
- **security-notes.md:** Security Team
- **migration-notes.md:** DevOps Team
- **architecture-changes.md:** Marcus Williams
- **warnings.md:** Engineering Team (collaborative)

---

## Version History

| Version | Date | Major Changes |
|---------|------|---------------|
| 0.3.0 | 2026-02-27 | Session-based auth, Redis, soft delete, enhanced audit logging |
| 0.2.0 | 2026-02-10 | PostgreSQL migration, audit logging added |
| 0.1.0 | 2026-01-15 | Initial release with JWT auth, SQLite |

---

## Contact

**Questions or Issues:**
- Architecture: Marcus Williams - marcus@yourcompany.com
- Security: security@yourcompany.com
- DevOps: devops@yourcompany.com

**Emergency:**
- On-Call Engineer: [Phone]
- Incident Channel: #security-incidents (Slack)

---

**Last Updated:** 2026-02-27  
**Next Review:** 2026-03-27 (monthly)
