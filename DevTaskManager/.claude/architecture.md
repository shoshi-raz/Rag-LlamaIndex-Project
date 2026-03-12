# DevTask Manager - System Architecture

**Document Version:** 1.1  
**Last Updated:** 2026-02-26  
**Author:** Marcus Williams (Principal Architect)  
**Status:** Approved

---

## 1. Architecture Overview

DevTask Manager follows a **three-tier architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   React SPA     │  │  Vite Dev Server │  │ TailwindCSS │ │
│  │   (Port 5173)   │  │                  │  │             │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Express.js API Server                    │  │
│  │                 (Port 3000)                          │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Auth Middleware  │  RBAC Middleware  │ Rate Limiting │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Auth Controller  │  Task Controller  │ User Controller│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ SQL/Pool
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   PostgreSQL    │  │  Connection     │  │   Redis      │ │
│  │   (Port 5432)   │  │     Pool        │  │  (Future)    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Component Details

### 2.1 Frontend (React SPA)

**Technology Stack:**
- React 18 with Concurrent Features
- Vite 5 (build tool)
- React Router v6
- Zustand (state management)
- TailwindCSS (styling)
- Axios (HTTP client)

**Key Features:**
- Dark mode by default
- RTL (Right-to-Left) language support
- Responsive design
- JWT token storage in localStorage

**⚠️ WARNING:** JWT in localStorage is vulnerable to XSS. Migration to httpOnly cookies planned for v0.3.

### 2.2 Backend (Express.js)

**Architecture Pattern:** MVC (Model-View-Controller)

**Directory Structure:**
```
backend/src/
├── app.js              # Application entry point
├── config/
│   └── database.js     # PostgreSQL pool configuration
├── controllers/        # Business logic
│   ├── authController.js
│   ├── taskController.js
│   └── ...
├── middleware/         # Request processors
│   ├── auth.js         # JWT verification
│   └── ...
├── models/             # Data models (v0.2: query builders)
├── routes/             # Route definitions
└── utils/              # Helpers (logger, etc.)
```

**Middleware Pipeline:**
1. `helmet()` - Security headers
2. `cors()` - Cross-origin handling
3. `express.json()` - Body parsing
4. `rateLimit()` - Request throttling
5. Request logging
6. Route handlers
7. Error handling

### 2.3 Database (PostgreSQL)

**Connection Management:**
- `pg` pool with 20 max connections
- Connection timeout: 2 seconds
- Idle timeout: 30 seconds

**Query Patterns:**
```javascript
// Direct query
const result = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);

// Transaction
await db.transaction(async (client) => {
  await client.query('BEGIN');
  // ... operations
  await client.query('COMMIT');
});
```

---

## 3. Data Flow

### 3.1 Authentication Flow

```
┌─────────┐     POST /api/auth/login     ┌──────────┐
│  Client │ ─────────────────────────────▶│  Server  │
│         │ {email, password}             │          │
│         │◀─────────────────────────────│          │
│         │     {token, user}            │          │
└─────────┘                                └──────────┘
     │                                           │
     │ Store JWT in localStorage                │ Verify password
     │                                           │ with bcrypt
     │                                           │
     ▼                                           ▼
┌─────────┐                                ┌──────────┐
│  React  │ ◀───── Authenticated Request ──│   JWT    │
│  State  │ Authorization: Bearer <token&gt;  │ Middleware
└─────────┘                                └──────────┘
```

### 3.2 Task CRUD Flow

```
┌─────────┐      GET /api/tasks        ┌──────────┐
│  React  │────────────────────────────▶│ Express  │
│  Component                           │  Router  │
│         │◀────────────────────────────│          │
│         │    [{id, title, status}]    │          │
└─────────┘                            └────┬─────┘
                                            │
                                            ▼
                                       ┌──────────┐
                                       │  Task    │
                                       │Controller│
                                       └────┬─────┘
                                            │
                                            ▼
                                       ┌──────────┐
                                       │ PostgreSQL│
                                       │  Query   │
                                       └──────────┘
```

---

## 4. Security Architecture

### 4.1 Authentication
- JWT tokens signed with HS256 (RS256 planned for v0.3)
- 24-hour token expiry
- Bcrypt password hashing (12 rounds)

### 4.2 Authorization
- RBAC middleware checks role before controller execution
- Resource ownership verified for developers
- Organization isolation enforced at query level

### 4.3 Input Validation
- Joi schemas for all request bodies
- Parameterized queries prevent SQL injection
- Rate limiting: 100 requests per 15 minutes per IP

### 4.4 CORS Policy
```javascript
{
  origin: process.env.FRONTEND_URL,
  credentials: true
}
```

---

## 5. Deployment Architecture

### 5.1 Development Environment
```
┌─────────────────────────────────────────┐
│         Developer Machine              │
│  ┌─────────────┐    ┌──────────────┐  │
│  │  React Dev  │◀───│   Vite HMR   │  │
│  │  Server:5173│     │              │  │
│  └─────────────┘    └──────────────┘  │
│         │                              │
│         │ Proxy /api                   │
│         ▼                              │
│  ┌─────────────┐    ┌──────────────┐  │
│  │  Express    │───▶│  PostgreSQL  │  │
│  │  Server:3000│     │  Port:5432   │  │
│  └─────────────┘    └──────────────┘  │
└─────────────────────────────────────────┘
```

### 5.2 Production Architecture (Target v0.4)
```
┌─────────────────────────────────────────────────────────┐
│                      Load Balancer (Nginx)              │
└─────────────────────────┬───────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  API Server  │  │  API Server  │  │  API Server  │
│  Instance 1  │  │  Instance 2  │  │  Instance N  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ PostgreSQL   │  │   Redis      │  │  File Store  │
│  Primary     │  │  (Cache)     │  │   (S3/MinIO) │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 6. API Design

### 6.1 REST Conventions
- GET: Read resources
- POST: Create resources
- PATCH: Partial updates (preferred over PUT)
- DELETE: Remove resources

### 6.2 Response Format
```javascript
// Success
{
  "tasks": [...],
  "count": 42
}

// Error
{
  "error": "Task not found"
}
```

### 6.3 Status Codes
- 200: OK
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 429: Too Many Requests
- 500: Server Error

---

## 7. State Management

### 7.1 Frontend State
| Type | Store | Persistence |
|------|-------|-------------|
| Auth | AuthContext | localStorage (token only) |
| UI | Zustand | None |
| Server | React Query | Cache (5 min) |

### 7.2 Backend State
- Stateless: No session storage
- JWT contains: userId, role, organizationId
- Fresh user data fetched from DB per request

---

## 8. Logging & Monitoring

### 8.1 Request Logging
```javascript
{
  "level": "info",
  "method": "POST",
  "url": "/api/tasks",
  "status": 201,
  "duration": "45ms",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "service": "devtask-api",
  "environment": "development"
}
```

### 8.2 Error Logging
- Full stack traces in development
- Sanitized messages in production
- Winston logger with console/file transports

---

## 9. Version 0.2 Architectural Changes

### 9.1 Database: SQLite → PostgreSQL
**Date:** 2026-02-10  
**Drivers:** Better concurrency, ACID compliance, production readiness

**Migration Impact:**
- Connection pooling added
- SQL dialect changes minimal (both support standard SQL)
- Migration scripts created

### 9.2 Removed: GraphQL Endpoint
**Original:** Planned for v0.1  
**Decision:** Removed in v0.2 (see `decisions.md` ADR-012)  
**Reason:** REST sufficient for current needs

### 9.3 Added: Audit Logging
**Date:** 2026-02-15  
**Table:** `audit_logs`  
**Scope:** All data mutations tracked

---

## 10. Future Architecture Plans

### 10.1 Version 0.3 (2026-04-01)
- WebSocket server for real-time updates
- Redis for session caching
- Email service integration

### 10.2 Version 0.4 (2026-06-01)
- Horizontal scaling with load balancer
- Read replicas for PostgreSQL
- CDN for static assets

### 10.3 Version 0.5 (2026-08-01)
- Microservices evaluation (Git sync service)
- Message queue (RabbitMQ/BullMQ)
- Kubernetes deployment manifests

---

## 11. Technology Trade-offs

| Decision | Chosen | Alternative | Trade-off |
|----------|--------|-------------|-----------|
| ORM | Raw SQL (Knex planned) | Sequelize/Prisma | Simplicity vs features |
| Auth | JWT | Session cookies | Stateless vs security |
| Deployment | Manual | Docker/K8s | Speed vs reproducibility |
| Frontend | SPA | SSR/Next.js | Interactivity vs SEO |

---

## Appendix: Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=devtask_db
DB_USER=devtask_user
DB_PASSWORD=devtask_pass

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=24h

# Server
PORT=3000
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:5173
```

---

**⚠️ WARNING:** This architecture document reflects the current state. Future versions may change significantly. Always check `decisions.md` for the latest ADRs.

**Related Documents:**
- `spec.md` - Product requirements
- `decisions.md` - Architecture decisions
- `db-schema.md` - Database design
- `constraints.md` - Technical limitations
