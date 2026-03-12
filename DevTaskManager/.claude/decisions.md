# DevTask Manager - Architecture Decision Records

**Document Version:** 1.0  
**Last Updated:** 2026-02-26  
**Author:** Marcus Williams  
**Status:** Active Development

---

## Introduction

This document records architectural decisions made during the development of DevTask Manager. Each entry follows the ADR format: Context, Decision, and Consequences.

**⚠️ WARNING:** Decisions marked with **[SECURITY-CRITICAL]** require security team review before modification.

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

## ADR-004: JWT Authentication (HS256)

**Status:** Accepted  
**Date:** 2026-01-18  
**Scope:** Authentication

### Decision
Implement JWT with **HS256** signing.

### Context
Need stateless authentication. Team debated HS256 vs RS256.

### Alternatives Considered
- **RS256:** Better for microservices (public key verification)
- **Session Cookies:** Requires sticky sessions
- **HS256 (Chosen):** Simpler for monolith, single secret

### Consequences
- Stateless verification
- Single secret to manage
- Plan to migrate RS256 in v0.3 for better security

**⚠️ SECURITY-CRITICAL:** JWT secret must be rotated immediately if compromised.

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

## ADR-010: [CHANGED] LocalStorage JWT Storage

**Status:** Accepted (Security risk acknowledged)  
**Date:** 2026-01-15  
**Planned Change:** v0.3  
**Scope:** Client Storage

### Current Decision
Store JWT in **localStorage**.

### ⚠️ SECURITY WARNING
This decision creates XSS vulnerability. Tokens accessible to JavaScript.

### Alternatives Considered
- **httpOnly Cookies (Recommended):** Not implemented due to CORS complexity
- **Session Storage:** Same XSS risk, session-only
- **Memory Only:** Requires re-login on refresh

### Planned Migration (v0.3)
Move to httpOnly cookies with proper CSRF protection.

### Consequences
- XSS risk requires strict CSP
- Simple implementation
- Migration planned

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

## Rejected Decisions

| Decision | Date | Reason |
|----------|------|--------|
| MongoDB | 2026-01-10 | Relational data fits better |
| GraphQL | 2026-02-18 | REST sufficient |
| Serverless | 2026-01-15 | Cold start issues |

---

## Future Considerations

| Feature | Target Version | Status |
|---------|----------------|--------|
| OAuth 2.0 | 0.3 | Planned |
| Redis Caching | 0.3 | Planned |
| WebSockets | 0.3 | Planned |
| Knex.js/Prisma | 0.3 | Evaluating |
| Microservices | 0.5+ | Future |

---

**⚠️ DOCUMENT CONTROL:**
This document is append-only. Reversals documented as new ADRs.

**Related Documents:**
- `architecture.md` - System design
- `spec.md` - Product requirements
- `constraints.md` - Technical limitations
