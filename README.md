# WorkSeal

**AI-planned, deterministically verified software acceptance — proof before payment.**

---

## Problem

Buyers hiring freelancers or agencies agree on milestone requirements up front, but have no fast, evidence-backed way to confirm that delivered software actually meets those requirements before releasing payment. Manual testing, demos, and screenshots leave room for paying for incomplete work — or unfairly rejecting legitimate work.

## Solution

WorkSeal is an AI-powered acceptance-verification layer for software milestones. A buyer defines a milestone with natural-language acceptance criteria, the developer submits the delivered web app, and WorkSeal produces a criterion-by-criterion **PASS / FAIL / UNCERTAIN** result backed by real evidence — before the buyer ever approves payment.

> **Don't ask the buyer to trust the delivery. Show them the proof.**

## How WorkSeal Works

```text
Milestone + Acceptance Criteria
        ↓
Developer Submission (URL + demo credentials)
        ↓
AI Planner → Validated VerificationPlan
        ↓
Deterministic Plan Executor (Playwright / API)
        ↓
Evidence
        ↓
Deterministic Evaluation → PASS / FAIL / UNCERTAIN
        ↓
Decision Engine → READY_FOR_APPROVAL / NOT_READY / REVIEW_REQUIRED
        ↓
Human Approval
        ↓
Payment (Razorpay Test Mode — planned)
```

## AI + Deterministic Verification Architecture

WorkSeal uses AI for **verification planning**, not verification **authority**.

```text
Acceptance Criterion
        ↓
AI Planner (Google Gemini — single structured-output call)
        ↓
Validated VerificationPlan
        ↓
Deterministic Plan Executor
        ↓
Playwright / API
        ↓
Evidence
        ↓
Deterministic Evaluation
        ↓
PASS / FAIL / UNCERTAIN
        ↓
Existing Decision Engine
        ↓
READY_FOR_APPROVAL / NOT_READY / REVIEW_REQUIRED
        ↓
Human Approval
        ↓
Payment (Razorpay Test Mode — planned)
```

The planner is a single AI operation — there is no separate LLM interpretation stage. `verification-runner.ts` is the only integration point between the AI planner and the verification pipeline. The existing deterministic executor is preserved and used as a fallback whenever AI planning fails, is unavailable, or is rejected by validation.

## Why the AI Is Bounded

The planner may request only these actions:

| Tool | Allowed actions |
|---|---|
| BROWSER | `navigate`, `click`, `fill`, `select`, `assertText`, `assertVisible`, `screenshot` |
| API | `request`, `assertStatus`, `assertJsonField` |

A deterministic, fail-closed validator rejects the entire plan if it contains any unknown tool, action, field, host, or parameter.

The AI **cannot**:
- execute shell/terminal commands or arbitrary JavaScript/Node
- access the filesystem, SQL, or a database
- modify source code, criteria, or milestone/payment state
- determine PASS/FAIL/UNCERTAIN
- approve or release payment

Raw credentials and secrets are never supplied to the LLM. Verification plans may reference controlled placeholders (e.g. `{{DEMO_USERNAME}}`), which the deterministic executor resolves at runtime.

## Demo Application

**Customer Support Portal** — a controlled demo app with six acceptance criteria:

1. Login
2. Dashboard
3. Create Ticket
4. Ticket History
5. Ticket Details
6. Logout

The demo app runs separately from the WorkSeal backend and is the verification target, not the WorkSeal product itself.

## Verification Flow

```text
Criterion
  ↓
AI-planned or fallback structured verification task
  ↓
Playwright / HTTP execution
  ↓
Assertions + Evidence
  ↓
Deterministic Decision Engine
  ↓
PASS / FAIL / UNCERTAIN
```

## Failure → Fix → Reverification

A deliberate defect is used to demonstrate the loop: a failing criterion produces `NOT_READY`, the developer fixes the application, resubmits, and WorkSeal reverifies. The MVP reruns all criteria on reverification, reusing each criterion's previously validated plan unless the criterion's description has changed.

## Current Validation

The most recent end-to-end run against the implemented controlled demo returned:

- **Decision:** `READY_FOR_APPROVAL`
- **Overall result:** `PASS`
- **Criteria:** Login ✅ · Dashboard ✅ · Create Ticket ✅ · Ticket History ✅ · Ticket Details ✅ · Logout ✅ (6/6 PASS)
- **Automated tests:** 84/84 passing
- **Build:** passing

This reflects a successful, validated run of the implemented controlled demo — not a guarantee that every future arbitrary application will pass.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma |
| AI Planner | Google Gemini |
| Browser verification | Playwright + Chromium |
| API verification | Deterministic HTTP verifier |

No microservices, queues, Redis, RAG, vector database, LangChain/LangGraph, MCP, or multi-agent architecture are used.

## Project Structure

```text
workseal/
├── README.md
├── md files/
│   ├── Architecture.md
│   ├── AI_Architecture.md
│   ├── Requirements.md
│   └── Workflow.md
├── frontend/                         # WorkSeal React/Vite UI
├── backend/
│   ├── .env.example
│   └── src/
│       ├── modules/
│       │   ├── projects/
│       │   ├── milestones/
│       │   ├── criteria/
│       │   ├── submissions/
│       │   ├── verification/
│       │   │   ├── verification.routes.ts
│       │   │   └── decision-engine.ts
│       │   └── ai/
│       │       ├── ai.schemas.ts
│       │       ├── ai-planner.ts
│       │       └── ai.routes.ts
│       ├── orchestrator/
│       │   └── verification-runner.ts   # AI-planner integration point
│       ├── agent/
│       │   └── verification-plan-executor.ts
│       ├── tools/
│       │   └── browser/
│       └── lib/
│           └── demo-catalog.ts
└── demo-app/                             # Customer Support Portal (verification target)
    ├── client/
    └── server/
        └── .env.example
```

## Setup

### WorkSeal Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, GEMINI_API_KEY, GEMINI_MODEL
npx prisma migrate deploy --schema prisma/schema.prisma
npm run dev
# Backend runs on http://localhost:5000
```

### WorkSeal Frontend

```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

### Demo App (Customer Support Portal)

```bash
# Backend
cd demo-app/server
npm install
cp .env.example .env   # fill in DATABASE_URL, DEMO_USER_PASSWORD, SESSION_SECRET
npx prisma migrate deploy
npx prisma db seed
npm run dev
# Demo backend runs on http://localhost:5001

# Frontend
cd demo-app/client
npm install
npm run dev
# Demo frontend runs on http://localhost:5174
```

## Environment Variables

See `backend/.env.example` for the full list. Key variables:

```text
DATABASE_URL=                          # PostgreSQL connection string
GEMINI_API_KEY=                        # Google Gemini API key
GEMINI_MODEL=                          # e.g. gemini-1.5-flash
PORT=5000                              # Backend port
WORKSEAL_ALLOWED_APPLICATION_ORIGINS=http://localhost:5174
DEMO_USERNAME=demo@workseal.test       # Demo credential placeholder (not sent to LLM)
DEMO_PASSWORD=                         # Demo credential placeholder (not sent to LLM)
```

The backend CORS origin is currently configured in `backend/src/server.ts` for local development (`http://localhost:5173`). Never commit real secrets. The `.env` files are excluded by `.gitignore`.

## Security Model

- Closed, fail-closed action allowlist (BROWSER/API only)
- Host/origin allowlisting enforced before execution and on every navigation/response, including redirects
- Credential isolation — raw credentials never reach the LLM
- Deterministic evidence and evaluation — AI statements are never evidence and cannot decide a result
- Human approval required before any payment step

## Current Scope (Implemented)

- Project/milestone/criteria management
- AI verification planning (Google Gemini, single planner operation)
- Deterministic plan validation, execution, and evaluation
- Evidence capture
- Deterministic decision engine
- Six-criterion controlled demo (Customer Support Portal) with a completed end-to-end verification run
- React/Vite frontend dashboard with verification results and approval UI

## Future Scope (Not Yet Implemented)

- Razorpay Test Mode payment integration and webhook signature verification
- Human-approval-gated backend payment endpoint
- AI-generated failure explanation (read-only, post-evaluation)
- Expanded deployment and production hardening

## Demo

Demo video and screenshots to be added alongside this submission.
