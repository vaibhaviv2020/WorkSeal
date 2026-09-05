# Workseal — Demo Application Specification
demo-app/
    ├── client/
    └── server/

## Purpose
Build a small, realistic **Customer Support Portal** that acts as the controlled software target Workseal will verify. This is not Workseal itself.

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Styling | CSS |
| API | REST/JSON |

Keep it simple; no unnecessary infrastructure.

## Features
### Login
- Email + password
- Valid credentials → dashboard
- Invalid credentials → error
- Protected pages require authentication

### Dashboard
Show:
- welcome message
- open/in-progress/resolved ticket counts
- create-ticket link
- ticket-history link
- counts must come from DB

### Ticket Management
Users can:
- create a ticket
- view ticket history
- open a ticket
- view ticket details/status

### Logout
- End session
- Return to login
- Block protected pages after logout

## Ticket Model
A ticket is a **customer support request inside the demo application**. It is application data, not a Workseal milestone, acceptance criterion, or verification task.

Fields:
```text
id, subject, description, priority, status, userId, createdAt, updatedAt
```

## Data Model
### User
```text
id, name, email, password, createdAt
```

### Ticket
```text
id, subject, description, priority, status, userId, createdAt, updatedAt
```

Relationship:
```text
User → Tickets
```

Use Prisma migrations and seed data.

## Seed Data
Demo user:
```text
Email: demo@workseal.test
Password: <demo-password>
```

Seed a few tickets:
```text
#101 — Unable to login — OPEN
#102 — Payment issue — RESOLVED
#103 — Account settings — IN_PROGRESS
```

## API
```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/dashboard
GET  /api/tickets
GET  /api/tickets/:id
POST /api/tickets
```

## Controlled Failure Mode
Environment variable:
```text
DEMO_FAILURE_MODE=false
```

Normal:
```text
POST /api/tickets → HTTP 201 → ticket created
```

Failure mode:
```text
DEMO_FAILURE_MODE=true
POST /api/tickets → HTTP 500 → ticket NOT created
```

Only create-ticket deliberately fails. Do not break other features. Do not expose the toggle in the frontend. The failure must occur at the backend/API level.

## Acceptance Criteria
**AC-01 — Login:** A user with valid credentials can log into the application.

**AC-02 — Dashboard:** An authenticated user can access the dashboard and see current ticket counts.

**AC-03 — Create Ticket:** An authenticated user can create a support ticket with valid information.

**AC-04 — Ticket History:** Successfully created tickets appear in the user's ticket history.

**AC-05 — Ticket Details:** An authenticated user can view a ticket's details and current status.

**AC-06 — Logout:** A logged-in user can log out and can no longer access protected pages.

## Test Scenarios
1. Valid login → dashboard.
2. Invalid login → rejected.
3. Dashboard → correct DB-backed counts.
4. Create ticket with failure mode OFF → 201 + ticket created.
5. Create ticket with failure mode ON → 500 + no ticket created.
6. Ticket history → seeded/created tickets visible.
7. Ticket details → correct details/status.
8. Logout → login page + protected route blocked.

## Expected Failure Demo
With `DEMO_FAILURE_MODE=true`:
```text
AC-01 → PASS
AC-02 → PASS
AC-03 → FAIL
AC-04 → PASS / unaffected by deliberate failure
AC-05 → PASS
AC-06 → PASS

5/6 PASS + 1 FAIL → NOT READY
```

With failure mode OFF and the workflow working:
```text
6/6 PASS → READY FOR APPROVAL
```

## Stage 2 Definition of Done
- [ ] Frontend works
- [ ] Backend works
- [ ] PostgreSQL + Prisma work
- [ ] Demo user works
- [ ] Seed tickets exist
- [ ] Login works
- [ ] Dashboard works
- [ ] Create ticket works normally
- [ ] Ticket history works
- [ ] Ticket details/status works
- [ ] Logout works
- [ ] Protected routes work
- [ ] Failure toggle works
- [ ] Failure is isolated to create-ticket
- [ ] All six acceptance criteria manually tested
- [ ] Failure scenario reproducible
- [ ] Normal scenario reproducible
- [ ] Demo reset/seed process works

## Stage 2 Output
A stable Customer Support Portal + demo account + seeded data + six acceptance criteria + one reproducible backend failure mode + documented normal/failure test flow.

**Do not start building Workseal until this gate passes.**

Our implementation order

1. Create demo-app
        ↓
2. Set up React + Vite frontend
        ↓
3. Set up Node + Express + TypeScript backend
        ↓
4. Set up PostgreSQL + Prisma
        ↓
5. Create User + Ticket schema
        ↓
6. Seed demo user + tickets
        ↓
7. Build Login
        ↓
8. Build Dashboard
        ↓
9. Build Create Ticket
        ↓
10. Build Ticket History
        ↓
11. Build Ticket Details
        ↓
12. Build Logout
        ↓
13. Add DEMO_FAILURE_MODE
        ↓
14. Test everything
        ↓
15. Freeze acceptance criteria
        ↓
       STAGE 2 DONE
---

# Stage 2 — Current Implementation & Codebase Snapshot

> **Purpose of this section:** This is the implementation handoff for the completed Demo App.  
> The original specification above remains the source of truth for what the demo is supposed to do.  
> This section records what is currently present in the workspace so future Workseal stages/chats can understand the existing demo without reconstructing its structure from memory.

## 1. Current Workspace

The repository/workspace currently contains the controlled demo application under:

```text
WORKSEAL/
└── demo-app/
    ├── client/
    ├── server/
    └── Demo.md
```

The demo is a standalone Customer Support Portal used as Workseal's controlled verification target.

**Important boundary:** `demo-app` is the software being verified. It is **not** the Workseal product itself.

---

# 2. Complete Current File Structure

```text
WORKSEAL/
└── demo-app/
    │
    ├── client/
    │   ├── src/
    │   │   ├── assets/
    │   │   ├── App.css
    │   │   ├── App.tsx
    │   │   ├── index.css
    │   │   └── main.tsx
    │   │
    │   ├── .gitignore
    │   ├── .oxlintrc.json
    │   ├── index.html
    │   ├── package-lock.json
    │   ├── package.json
    │   ├── README.md
    │   ├── tsconfig.app.json
    │   ├── tsconfig.json
    │   ├── tsconfig.node.json
    │   └── vite.config.ts
    │
    ├── server/
    │   ├── prisma/
    │   │   ├── migrations/
    │   │   │   └── <generated Prisma migration files>
    │   │   ├── seed/
    │   │   │   └── seed.ts
    │   │   └── schema.prisma
    │   │
    │   ├── src/
    │   │   ├── lib/
    │   │   │   └── prisma.ts
    │   │   ├── routes/
    │   │   │   ├── auth.ts
    │   │   │   ├── dashboard.ts
    │   │   │   └── tickets.ts
    │   │   ├── types/
    │   │   │   └── express-session.d.ts
    │   │   └── server.ts
    │   │
    │   ├── .env
    │   ├── package-lock.json
    │   ├── package.json
    │   ├── prisma.config.ts
    │   └── tsconfig.json
    │
    └── Demo.md
```

> Do not add new infrastructure or folders merely to make the project look more complex. The demo is intentionally a small application.

---

# 3. Frontend Codebase

## `client/src/App.tsx`

**Role:** Main React application component.

This file currently handles the complete demo UI flow:

```text
Login
  ↓
Dashboard
  ↓
Create Ticket
  ↓
Ticket History
  ↓
Ticket Details Modal
  ↓
Logout
  ↓
Login
```

### Current frontend state/data types

The application uses these data shapes:

```ts
type DashboardData = {
  open: number;
  inProgress: number;
  resolved: number;
};

type TicketFormData = {
  subject: string;
  description: string;
  priority: string;
};

type Ticket = {
  id: number;
  subject: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
};
```

### Authentication state

The component maintains:

```text
email
password
error
loggedIn
userName
```

### Dashboard state

```text
dashboard
```

The dashboard values are loaded from the backend and are therefore DB-backed rather than hard-coded in the UI.

### Ticket state

```text
ticketForm
tickets
selectedTicket
```

### API calls used by the frontend

```text
POST http://localhost:5001/api/auth/login
GET  http://localhost:5001/api/dashboard
GET  http://localhost:5001/api/tickets
GET  http://localhost:5001/api/tickets/:id
POST http://localhost:5001/api/tickets
POST http://localhost:5001/api/auth/logout
```

All authenticated API requests use browser credentials/cookies so the Express session is sent to the backend.

### Important TypeScript detail

Because the project uses TypeScript's `verbatimModuleSyntax`, the event type is imported as a type:

```tsx
import { useState } from "react";
import type { FormEvent } from "react";
```

Do not change this to a normal value import unless the TypeScript configuration is intentionally changed.

### Ticket status display

Backend status values are presented in human-readable form:

```text
OPEN         → Open
IN_PROGRESS  → In Progress
RESOLVED     → Resolved
```

### Ticket details behavior

Selecting a ticket subject opens a modal overlay containing:

```text
Ticket Details
Ticket ID
Subject
Description
Priority
Status
Created date
Close / X
Back to Main
```

The details are fetched from the backend using the ticket ID.

---

## `client/src/App.css`

**Role:** Main component-level styling.

The current UI is a polished, lightweight SaaS-style Customer Support Portal.

Current visual structure:

```text
Login
 └── centered card

Dashboard
 ├── top header
 │    ├── WorkSeal Demo branding
 │    ├── Dashboard area
 │    └── Logout
 │
 ├── statistics
 │    ├── Open
 │    ├── In Progress
 │    └── Resolved
 │
 └── main content
      ├── Create a New Ticket
      └── Ticket History

Ticket Details
 └── modal overlay
```

The design intentionally uses:

- white cards
- subtle borders
- soft shadows
- rounded corners
- blue primary actions
- status-specific visual treatment
- responsive two-column desktop layout
- stacked layout on smaller screens

No AI chatbot, analytics dashboard, admin panel, notification system, or other non-spec UI has been added.

---

## `client/src/index.css`

**Role:** Global CSS/base styling.

This file provides application-wide styling and browser/layout defaults used by the React application.

It works together with `App.css`; it is not a second application stylesheet containing separate business logic.

---

## `client/src/main.tsx`

**Role:** React entry point.

This is the Vite/React bootstrap file responsible for mounting the root React application.

It is not responsible for backend communication or ticket/business logic.

---

## `client/src/assets/`

**Role:** Frontend static assets directory.

The directory is part of the Vite frontend structure. Assets should only be added when actually required by the demo UI.

---

# 4. Frontend Configuration Files

## `client/package.json`

Defines the frontend project and its npm scripts/dependencies.

The frontend is based on:

```text
React
Vite
TypeScript
```

The development/build tooling comes from the standard Vite React TypeScript setup plus the project's configured linting/tooling.

---

## `client/package-lock.json`

Locks the exact npm dependency tree used by the frontend.

Do not manually edit this file. It should normally be regenerated by npm when dependencies change.

---

## `client/vite.config.ts`

Vite configuration for the frontend development/build environment.

---

## `client/tsconfig.json`

Root TypeScript configuration for the frontend project.

---

## `client/tsconfig.app.json`

TypeScript configuration used for the application source.

---

## `client/tsconfig.node.json`

TypeScript configuration for Node-side Vite configuration/tooling files.

---

## `client/index.html`

Vite HTML entry document.

React is mounted into this document by `main.tsx`.

---

## `client/.gitignore`

Frontend Git ignore rules.

---

## `client/.oxlintrc.json`

Linting configuration used by the frontend tooling.

---

## `client/README.md`

The README generated/maintained for the frontend project.

It is secondary documentation; the authoritative demo requirements are documented in this file (`Demo.md`).

---

# 5. Backend Codebase

## `server/src/server.ts`

**Role:** Main Express server/bootstrap.

Current responsibilities:

```text
Create Express app
 ↓
Configure CORS
 ↓
Enable JSON request parsing
 ↓
Configure express-session
 ↓
Register API routers
 ↓
Listen on port 5000
```

Current API router mounting:

```text
/api/auth
/api/dashboard
/api/tickets
```

Development server URL:

```text
http://localhost:5001
```

Frontend origin allowed during local development:

```text
http://localhost:5174
```

Session cookies are configured for local development with:

```text
httpOnly
sameSite: "lax"
secure: false
```

The session secret is loaded from the backend environment.

---

## `server/src/lib/prisma.ts`

**Role:** Prisma database client setup.

The backend uses Prisma's PostgreSQL adapter:

```text
Prisma Client
     ↓
PrismaPg adapter
     ↓
PostgreSQL
```

The database connection string is read from:

```text
DATABASE_URL
```

The application deliberately fails to start if `DATABASE_URL` is missing.

---

## `server/src/types/express-session.d.ts`

**Role:** TypeScript session type declaration.

It extends Express Session's `SessionData` with:

```ts
userId: number;
```

This allows route handlers to safely use:

```ts
req.session.userId
```

for the authenticated demo user.

---

# 6. Backend Routes

## `server/src/routes/auth.ts`

**Role:** Authentication/session endpoints.

Implemented endpoints:

```text
POST /api/auth/login
POST /api/auth/logout
```

### Login

Validates:

```text
email
password
```

Then:

```text
Find user
 ↓
Validate credentials
 ↓
Set req.session.userId
 ↓
Return user information
```

Invalid credentials return an authentication error.

### Logout

The session is destroyed and the session cookie is cleared.

Result:

```text
Session ended
 ↓
Frontend returns to login
 ↓
Protected API requests are rejected
```

---

## `server/src/routes/dashboard.ts`

**Role:** DB-backed dashboard information.

The route first verifies that a session user exists.

It then counts that user's tickets by status:

```text
OPEN
IN_PROGRESS
RESOLVED
```

The returned counts are therefore derived from PostgreSQL through Prisma.

This implements the requirement that dashboard counts come from the database.

---

## `server/src/routes/tickets.ts`

**Role:** Ticket history, ticket details, ticket creation, and controlled failure mode.

Implemented endpoints:

```text
GET  /api/tickets
GET  /api/tickets/:id
POST /api/tickets
```

### Ticket history

Returns tickets belonging to the authenticated demo user.

### Ticket details

Loads a ticket by ID while respecting the authenticated user's ownership.

### Ticket creation

Normal mode:

```text
POST /api/tickets
        ↓
Validate authenticated user/request
        ↓
Prisma creates ticket
        ↓
HTTP 201
```

### Controlled failure

At the beginning of the create-ticket operation:

```text
DEMO_FAILURE_MODE === "true"
        ↓
HTTP 500
        ↓
No Prisma create operation
        ↓
No ticket inserted
```

This keeps the deliberate defect isolated to create-ticket.

---

# 7. Prisma / Database

## `server/prisma/schema.prisma`

Current database model:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  tickets   Ticket[]
}

model Ticket {
  id          Int      @id @default(autoincrement())
  subject     String
  description String
  priority    String
  status      String   @default("OPEN")
  userId      Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id])
  @@index([userId])
}
```

### Relationship

```text
User
 └── Ticket[]
```

A ticket belongs to exactly one demo user through:

```text
Ticket.userId → User.id
```

---

# 8. Prisma Migrations

## `server/prisma/migrations/`

Contains Prisma migration history for the PostgreSQL schema.

The current initialized migration was created during Stage 2 and is used by Prisma to reproduce the database schema.

Do not delete or manually rewrite migration history just to change demo data.

For a schema change:

```text
Modify schema.prisma
        ↓
Create Prisma migration
        ↓
Apply migration
```

---

# 9. Seed Data

## `server/prisma/seed/seed.ts`

**Role:** Deterministic demo database reset/seed.

The seed process recreates the demo user and demo tickets.

Demo user:

```text
Email: demo@workseal.test
Password: value stored in DEMO_USER_PASSWORD
```

Seeded tickets:

```text
#101 — Unable to login     — OPEN
#102 — Payment issue       — RESOLVED
#103 — Account settings    — IN_PROGRESS
```

The seed process removes/recreates the demo data so the application can return to a predictable state.

**Do not store or document the actual demo password in this file/documentation.** The password is supplied through the backend environment variable.

---

# 10. Prisma Configuration

## `server/prisma.config.ts`

Prisma configuration connects:

```text
schema
migrations
seed command
DATABASE_URL
```

The configured seed command is:

```text
tsx prisma/seed/seed.ts
```

---

# 11. Backend Configuration Files

## `server/package.json`

Defines the backend project, scripts, and dependencies.

Main backend stack:

```text
Node.js
Express
TypeScript
Prisma
PostgreSQL
express-session
CORS
dotenv
```

Development server command:

```text
npm run dev
```

Build command:

```text
npm run build
```

---

## `server/package-lock.json`

Locks the backend npm dependency tree.

Do not manually edit it.

---

## `server/tsconfig.json`

TypeScript configuration for the backend.

---

## `server/.env`

Local backend environment configuration.

The current environment contains the following variables:

```text
DATABASE_URL
DEMO_USER_PASSWORD
SESSION_SECRET
DEMO_FAILURE_MODE
```

### Variable purposes

```text
DATABASE_URL
    PostgreSQL connection string.

DEMO_USER_PASSWORD
    Password used for the seeded demo user.

SESSION_SECRET
    Express session signing secret.

DEMO_FAILURE_MODE
    Controls the deliberate create-ticket failure.
```

**Secrets must remain backend-only. Never copy actual secret values into this documentation or the frontend.**

Normal demo mode:

```text
DEMO_FAILURE_MODE=false
```

Failure demonstration:

```text
DEMO_FAILURE_MODE=true
```

After the failure demonstration, restore:

```text
DEMO_FAILURE_MODE=false
```

---

# 12. API Contract — Current Demo

```text
POST /api/auth/login
POST /api/auth/logout

GET  /api/dashboard

GET  /api/tickets
GET  /api/tickets/:id
POST /api/tickets
```

Authentication model:

```text
Login
 ↓
Express session cookie
 ↓
Authenticated API requests
 ↓
Logout
 ↓
Session destroyed
```

The demo does not use a large authentication framework or unnecessary role/permission system.

---

# 13. End-to-End Data Flow

## Login

```text
React Login Form
      ↓
POST /api/auth/login
      ↓
Express
      ↓
Prisma
      ↓
PostgreSQL User
      ↓
req.session.userId
      ↓
Dashboard
```

## Dashboard

```text
React Dashboard
      ↓
GET /api/dashboard
      ↓
Authenticated session
      ↓
Prisma counts user's tickets
      ↓
PostgreSQL
      ↓
Open / In Progress / Resolved counts
      ↓
React UI
```

## Create Ticket

```text
React Ticket Form
      ↓
POST /api/tickets
      ↓
Authentication check
      ↓
DEMO_FAILURE_MODE?
   ┌──────┴──────┐
   │             │
 false          true
   │             │
   ↓             ↓
Prisma create   HTTP 500
   ↓             │
HTTP 201         └── No DB insert
```

## Ticket Details

```text
Ticket subject click
      ↓
GET /api/tickets/:id
      ↓
Authenticated ownership check
      ↓
Prisma
      ↓
Ticket details
      ↓
Details modal
```

## Logout

```text
Logout button
      ↓
POST /api/auth/logout
      ↓
Session destroyed
      ↓
Cookie cleared
      ↓
Frontend returns to Login
      ↓
Protected API access rejected
```

---

# 14. Current UI Structure

The completed UI has the following screens/states.

## Login

```text
             WorkSeal Demo

        ┌─────────────────────┐
        │      Welcome        │
        │                     │
        │ Email               │
        │ Password            │
        │                     │
        │      Login          │
        └─────────────────────┘
```

## Dashboard

```text
WorkSeal Demo                  Dashboard        Logout

Welcome message

┌──────────┐ ┌──────────────┐ ┌───────────┐
│   Open   │ │ In Progress  │ │ Resolved  │
│   count  │ │    count     │ │   count   │
└──────────┘ └──────────────┘ └───────────┘

┌────────────────────┐ ┌──────────────────────────┐
│ Create a New Ticket│ │ Ticket History           │
│                    │ │                          │
│ Subject            │ │ Ticket subject           │
│ Description        │ │ Ticket status            │
│ Priority           │ │ Ticket date              │
│                    │ │                          │
│ Create Ticket      │ │                          │
└────────────────────┘ └──────────────────────────┘
```

## Ticket Details

Ticket details open as a modal instead of navigating to an unnecessary separate page.

---

# 15. Current Acceptance-Criteria Mapping

| Acceptance Criterion | Current implementation |
|---|---|
| AC-01 Login | React login → Express session authentication |
| AC-02 Dashboard | Authenticated `/api/dashboard` + Prisma DB counts |
| AC-03 Create Ticket | Authenticated `POST /api/tickets` |
| AC-04 Ticket History | `GET /api/tickets` + ticket history UI |
| AC-05 Ticket Details | `GET /api/tickets/:id` + details modal |
| AC-06 Logout | Session destruction + frontend logout state + protected API checks |

The acceptance criteria remain exactly the six criteria defined in the original specification above.

---

# 16. Current Verification/Test Status

Stage 2 API smoke testing was completed for:

```text
Invalid login
Valid login
Dashboard counts
Ticket list
Ticket details
Ticket creation
Logout
Protected access after logout
```

The controlled failure mode was also tested:

```text
DEMO_FAILURE_MODE=true
        ↓
POST /api/tickets
        ↓
HTTP 500
        ↓
No ticket inserted
```

Normal mode was restored afterward:

```text
DEMO_FAILURE_MODE=false
```

The database was then reset and reseeded to the clean demo state.

Reset:

```text
npx prisma migrate reset
```

Seed:

```text
npx prisma db seed
```

Expected clean seed output:

```text
Demo seed completed successfully.
Demo user: demo@workseal.test
Seeded tickets: 101, 102, 103
```

---

# 17. Current Database State

The demo database should be treated as a deterministic disposable test database.

Clean state:

```text
User:
    demo@workseal.test

Tickets:
    #101  Unable to login       OPEN
    #102  Payment issue         RESOLVED
    #103  Account settings      IN_PROGRESS
```

If temporary test tickets are created during testing, restore the clean state with:

```text
npx prisma migrate reset
npx prisma db seed
```

Do not use temporary test records as part of the permanent seeded demo state.

---

# 18. Reproduction / Startup Workflow

## Backend

From:

```text
demo-app/server
```

Install dependencies if required:

```text
npm install
```

Start development server:

```text
npm run dev
```

Expected:

```text
Server running on http://localhost:5001
```

## Frontend

From:

```text
demo-app/client
```

Install dependencies if required:

```text
npm install
```

Start Vite:

```text
npm run dev
```

Expected local frontend:

```text
http://localhost:5174
```

## Database

For a clean reproducible demo state:

```text
npx prisma migrate reset
npx prisma db seed
```

Use the demo credentials defined by the backend environment.

---

# 19. Build / Quality Checks

Frontend validation completed during Stage 2:

```text
npm run build
npm run lint
```

Both completed successfully at the time of the final UI implementation.

Backend API smoke tests also completed successfully for the normal authentication/ticket flow and controlled failure scenario.

---

# 20. What Is Intentionally NOT in `demo-app`

The following are **not part of the demo application** and must not be added merely because future Workseal stages need them:

```text
Workseal verification engine
AI interpreter
AI planner
Agent
Playwright verification executor
Evidence engine
Decision engine
Milestone management
Acceptance-criteria management
Submission management
Razorpay integration
Payment approval
Audit system
RAG
Vector database
Redis
Message queues
Microservices
Kubernetes
Automatic code fixing
Complex roles/permissions
Admin analytics
Chatbot
Notifications
Mobile testing
Marketplace
Escrow
Autonomous payment release
```

These belong to the actual Workseal product/workflow, not the controlled Customer Support Portal.

---

# 21. Demo vs Workseal Boundary

This distinction must remain explicit in all future work.

```text
                 WORKSEAL PRODUCT
                       │
                       │ verifies
                       ▼
              ┌───────────────────┐
              │    demo-app       │
              │                   │
              │ Customer Support  │
              │ Portal            │
              │                   │
              │ Login             │
              │ Dashboard         │
              │ Tickets           │
              │ Logout            │
              └───────────────────┘
```

A ticket such as:

```text
#101 — Unable to login
```

is **application data inside the demo**.

It is NOT:

```text
a Workseal milestone
a Workseal acceptance criterion
a verification task
a payment
```

Workseal will later use this controlled application as the target against which its own verification workflow is demonstrated.

---

# 22. Stage 2 Freeze Checkpoint

The demo is now treated as the completed controlled target for the next Workseal stages.

Current checkpoint:

```text
Customer Support Portal
        ↓
React/Vite frontend
        ↓
Express/TypeScript backend
        ↓
PostgreSQL
        ↓
Prisma
        ↓
Session authentication
        ↓
Ticket CRUD flow required by demo
        ↓
DB-backed dashboard
        ↓
Controlled create-ticket failure
        ↓
Deterministic reset/seed
```

The next major work should therefore be on the **Workseal product**, not on expanding the demo application, unless a genuine demo defect blocks verification.

---

# 23. Rules for Future Chats / Future Stages

When continuing this project, use this document as the demo application's handoff reference.

Before modifying `demo-app`:

1. Check the original specification at the beginning of this file.
2. Check this implementation/codebase snapshot.
3. Do not change acceptance criteria casually.
4. Do not turn demo tickets into Workseal milestones.
5. Do not add unnecessary demo features.
6. Keep `DEMO_FAILURE_MODE` backend-only.
7. Keep the demo deterministic and resettable.
8. Preserve the existing API contract unless a real blocker requires a documented change.
9. Keep secrets out of source/documentation.
10. If a future Workseal feature needs to interact with the demo, prefer integrating Workseal **around** the existing demo rather than expanding the demo itself.

**This document is the handoff record for the current Stage 2 demo workspace.**
