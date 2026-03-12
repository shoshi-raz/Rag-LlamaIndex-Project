# DevTask Manager - Known Issues & Bugs

**Document Version:** 1.0  
**Last Updated:** 2026-02-26  
**Maintainer:** Engineering Team  
**Status:** Active Tracking

---

## Critical Issues

### ISSUE-001: JWT Stored in localStorage (Security Risk)
**Severity:** High  
**Status:** Known / Planned Fix  
**Opened:** 2026-01-15  
**Target Fix:** v0.3

**Description:**
JWT access tokens stored in browser localStorage are vulnerable to XSS attacks. Any injected script can read tokens.

**Impact:**
- Session hijacking via XSS
- Token theft
- Impersonation attacks

**Workaround:**
- Implement strict CSP headers
- Sanitize all user input
- Use DOMPurify for HTML rendering

**Planned Solution:**
Migrate to httpOnly cookies with CSRF protection. See `decisions.md` ADR-010.

**⚠️ DO NOT DEPLOY TO PRODUCTION without security review.**

---

## High Priority Issues

### ISSUE-002: No Password Reset Flow
**Severity:** High  
**Status:** Open  
**Opened:** 2026-02-01  
**Target Fix:** v0.3

**Description:**
Users cannot reset forgotten passwords. Only workaround is admin intervention.

**Impact:**
- User lockout
- Support burden
- Poor UX

**Planned Solution:**
Email-based password reset with expiring tokens.

---

### ISSUE-003: Task Filtering Performance
**Severity:** Medium-High  
**Status:** Monitoring  
**Opened:** 2026-02-20

**Description:**
Task list queries slow with >1000 tasks. Missing composite indexes.

**Current Performance:**
- < 100 tasks: ~50ms
- 100-500 tasks: ~200ms
- > 1000 tasks: ~800ms+ (unacceptable)

**Workaround:**
- Pagination implemented (50 tasks/page)
- Filters reduce dataset

**Planned Solution:**
Add composite index on (organization_id, status, created_at).

---

## Medium Priority Issues

### ISSUE-004: No Input Validation on Client
**Severity:** Medium  
**Status:** Partial Fix  
**Opened:** 2026-02-10

**Description:**
Frontend relies on backend validation only. Poor UX for users.

**Examples:**
- No real-time error messages
- Form allows submission of invalid data
- Users see generic "Validation failed" messages

**Workaround:**
Backend validation catches errors, but after round-trip.

**Planned Solution:**
Implement Zod validation on frontend forms. In progress for v0.2.1.

---

### ISSUE-005: Mobile Responsive Issues
**Severity:** Medium  
**Status:** Open  
**Opened:** 2026-02-18

**Description:**
UI breaks on mobile devices (< 768px width).

**Specific Problems:**
- Task form overflows viewport
- Sidebar doesn't collapse
- Tables require horizontal scroll

**Workaround:**
Recommend desktop usage for v0.2.

**Planned Solution:**
Mobile-responsive layout in v0.3.

---

### ISSUE-006: No Test Coverage
**Severity:** Medium  
**Status:** In Progress  
**Opened:** 2026-02-05  
**Target Fix:** v0.3

**Description:**
Zero automated tests. Manual QA only.

**Current Coverage:**
- Backend: 0%
- Frontend: 0%

**Risk:**
- Regressions in releases
- Refactoring dangerous

**Planned Solution:**
- Jest for backend API tests
- Vitest for frontend component tests
- Target: 70% coverage by v0.3

---

## Low Priority Issues

### ISSUE-007: Console Warnings in Dev Mode
**Severity:** Low  
**Status:** Cosmetic  
**Opened:** 2026-02-15

**Description:**
React warnings during development:
- Missing key props in some lists
- Deprecated lifecycle warnings (third-party libs)

**Impact:**
None on production, clutters dev console.

---

### ISSUE-008: Dark Mode Flash on Load
**Severity:** Low  
**Status:** Open  
**Opened:** 2026-02-22

**Description:**
Page briefly shows light mode before switching to dark mode preference.

**Root Cause:**
Theme detection happens after React hydration.

**Planned Solution:**
Inline script in index.html to set theme before React loads.

---

## Fixed Issues

### ISSUE-009: PostgreSQL Connection Leaks ✓
**Severity:** High  
**Status:** Fixed 2026-02-18  
**Resolution:** Added proper connection pool cleanup in `database.js`

### ISSUE-010: Login Form Not Clearing Errors ✓
**Severity:** Medium  
**Status:** Fixed 2026-02-20  
**Resolution:** Added error reset on input change in Login.jsx

### ISSUE-011: Tasks Not Filtering by Org ✓
**Severity:** Critical  
**Status:** Fixed 2026-02-12  
**Resolution:** Added organization_id check to all task queries

---

## Version 0.2 Regression Risks

| Feature | Risk | Mitigation |
|---------|------|------------|
| PostgreSQL Migration | Data loss | Backup strategy |
| New Audit Tables | Disk usage | Monitor growth |
| RBAC Changes | Auth bypass | Security review |

---

## Issue Tracking Template

When adding new issues:

```markdown
### ISSUE-XXX: Title
**Severity:** Critical/High/Medium/Low  
**Status:** Open/In Progress/Monitoring/Fixed  
**Opened:** YYYY-MM-DD  
**Target Fix:** Version or Date

**Description:**
Clear description of the bug.

**Steps to Reproduce:**
1. Step one
2. Step two

**Expected:** What should happen  
**Actual:** What actually happens

**Workaround:** Temporary solution  
**Planned Solution:** Permanent fix plan
```

---

## Escalation Path

**Critical (Security/Outage):**
1. Immediate fix or rollback
2. Notify team lead within 1 hour
3. Post-mortem within 24 hours

**High (Major feature broken):**
1. Fix in current sprint
2. Weekly standup mention
3. Document in retrospective

**Medium/Low:**
1. Add to backlog
2. Prioritize in planning

---

**⚠️ SECURITY NOTICE:**
Never document security vulnerabilities with exploit details in this public document. Use private security tracker for details.

**Related Documents:**
- `constraints.md` - System limitations
- `decisions.md` - Why some issues exist
- `tasks.md` - Fix scheduling
