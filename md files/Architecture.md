# WorkSeal — Architecture

## 1. System Architecture

**Architecture:** Modular monolith

```text
React/Vite
    ↓ REST/JSON
Node.js + Express + TypeScript
    ├── Project/Milestone/Criteria/Submission
    ├── Verification Orchestrator
    ├── AI Planner (Google Gemini)
    ├── Evidence
    ├── Decision Engine
    ├── Payment (planned)
    └── Audit
        │
        ├── PostgreSQL + Prisma
        ├── Playwright + Chromium
        └── HTTP/API Verifier
```

**Core rule:** LLM plans/reasons → deterministic tools execute/prove → human approves payment.

**Not used:** microservices, Kubernetes, Redis, queues, vector DB, RAG, LangChain/LangGraph, MCP, multi-agent architecture, separate agent server.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript |
| DB | PostgreSQL + Prisma |
| AI planner | Google Gemini |
| Plan executor | Deterministic TypeScript plan executor |
| Browser | Playwright + Chromium |
| API checks | Deterministic HTTP verifier |
| Payment | Razorpay Payment Links (planned) |
| Payment events | Razorpay Webhooks (planned) |
| Deployment | Not yet deployed to production |
| Evidence | Local filesystem (MVP) |

---

## 3. Backend Modules

```text
backend/src/
├── modules/
│   ├── projects/
│   ├── milestones/
│   ├── criteria/
│   ├── submissions/
│   ├── verification/
│   │   ├── verification.routes.ts
│   │   └── decision-engine.ts
│   └── ai/
│       ├── ai.schemas.ts
│       ├── ai-planner.ts
│       └── ai.routes.ts
├── orchestrator/
│   └── verification-runner.ts      # sole AI-planner integration point
├── agent/
│   └── verification-plan-executor.ts
├── tools/
│   └── browser/
│       ├── browser-executor.ts
│       └── browser-verifier.ts
├── lib/
│   └── demo-catalog.ts             # fallback plan catalog
└── server.ts
```

Internal modules communicate by function/service calls, **not HTTP**.

`verification-runner.ts` is the only place in the codebase where an AI-generated plan enters the verification pipeline. It resolves an AI plan or the deterministic fallback plan, hands the validated plan to the deterministic executor, and forwards the result to the decision engine.

---

## 4. Verification Architecture

```text
Acceptance Criterion
        ↓
AI Planner (single Gemini call)
        ↓
Candidate VerificationPlan
        ↓
Schema + Capability + Host Validation (fail-closed)
        ↓
Validated VerificationPlan
        ↓
Deterministic Plan Executor
        ↓
Playwright / API
        ↓
Evidence
        ↓
Deterministic Evaluator
        ↓
PASS / FAIL / UNCERTAIN
        ↓
Decision Engine
        ↓
READY_FOR_APPROVAL / NOT_READY / REVIEW_REQUIRED
```

The planner performs requirement interpretation and plan generation in one structured-output call — there is no separate LLM interpretation stage. See `AI_Architecture.md` for the full AI pipeline specification.

### AI does
- requirement interpretation and verification planning (one Gemini call per criterion)
- bounded tool selection within the declared allowlist
- read-only failure explanation after deterministic evaluation *(planned — not yet implemented)*

### Deterministic code does
- plan validation (fail-closed)
- browser actions, API requests, assertions
- screenshots/traces
- status/JSON/schema checks
- evidence collection and evaluation
- retry policy
- milestone decision

### Human does
- final milestone approval

**The AI cannot:** execute arbitrary server code, modify source code, modify criteria/amount, access Razorpay secrets, approve payment, or release money.

---

## 5. Verification Flow

```text
Criterion
  ↓
Validated verification plan (AI or fallback)
  ↓
Playwright / HTTP
  ↓
Assertions + Evidence
  ↓
Decision Engine
  ↓
PASS / FAIL / UNCERTAIN
```

Browser executor uses **Chromium only**, headless, sequential execution, one continuous session per criterion's plan.

---

## 6. Result Rules

```text
Blocking FAIL
    → NOT_READY

No FAIL + any UNCERTAIN
    → REVIEW_REQUIRED

All criteria PASS
    → READY_FOR_APPROVAL
```

**PASS** — required assertion(s) succeed with sufficient evidence.
**FAIL** — required behavior demonstrably fails, with evidence.
**UNCERTAIN** — insufficient/conflicting evidence, ambiguous requirement, or environment/mechanism failure.

**No evidence = no final PASS.** Deterministic failures cannot be overridden by the LLM.

---

## 7. Evidence Architecture

```text
Milestone → Criterion → Verification Task → Execution → Evidence → Result
```

Evidence types: `SCREENSHOT`, `TRACE`, `API_RESPONSE`, `LOG`.

**MVP:** binary files on the local filesystem; metadata in PostgreSQL. Evidence file paths use system-generated identifiers only — AI-supplied strings are never used to construct paths.

---

## 8. Database

Core tables:

```text
users, projects, milestones, criteria, submissions,
verification_runs, verification_tasks, evidence,
payments, audit_logs
```

Relationships:

```text
User
 └── Projects
      └── Milestones
           ├── Criteria
           ├── Submissions
           ├── Verification Runs
           │     └── Verification Tasks
           │            └── Evidence
           ├── Payments
           └── Audit Logs
```

No AI-specific tables are introduced. The AI planner's validated output is stored in `Criterion.aiInterpretation`.

---

## 9. Implemented API

### Projects
```text
POST /api/projects
GET  /api/projects/:id
```

### Milestones
```text
POST /api/projects/:projectId/milestones
GET  /api/milestones/:id
```

### Criteria
```text
POST /api/milestones/:milestoneId/criteria
GET  /api/milestones/:milestoneId/criteria
```

### Submissions
```text
POST /api/milestones/:milestoneId/submissions
```

### Verification
```text
POST /api/milestones/:milestoneId/verifications
```

The verification endpoint runs synchronously and returns the complete result (runId, decision, overallResult, per-criterion results) in the response body. There is no separate polling endpoint in the current implementation.

### Planned (not yet implemented)
```text
POST /api/milestones/:milestoneId/approve    # human approval backend
POST /api/milestones/:milestoneId/payment    # Razorpay payment link creation
POST /api/webhooks/razorpay                  # Razorpay webhook handler
```

---

## 10. Verification Run

```text
POST /api/milestones/:milestoneId/verifications
    ↓
Validate milestone + submission
    ↓
Create verification_run + tasks
    ↓
For each criterion (sequential):
    ↓
    Resolve AI plan or deterministic fallback
    ↓
    Validate plan (fail-closed)
    ↓
    Execute via deterministic executor
    ↓
    Capture evidence
    ↓
    Evaluate criterion
    ↓
Aggregate results
    ↓
Determine milestone decision
    ↓
Update milestone status
    ↓
Return complete result in response
```

Verification runs synchronously in the MVP. The frontend receives the full result in the POST response.

---

## 11. Reverification

MVP: **rerun all criteria.**

```text
FAIL → Developer fixes → New submission version → Reverification → All PASS → READY_FOR_APPROVAL
```

Reverification reuses the previously validated plan stored per criterion. The planner is re-invoked only if the criterion description changed or no validated plan exists yet. Selective affected-criterion reruns are future scope.

---

## 12. Payment (Planned — Not Yet Implemented)

```text
READY_FOR_APPROVAL
        ↓
Human Approval (frontend button — presentation only in current build)
        ↓
Backend validates approval          ← not yet implemented
        ↓
Razorpay Payment Link               ← not yet implemented
        ↓
Test Mode payment
        ↓
payment_link.paid webhook           ← not yet implemented
        ↓
Signature verification
        ↓
Milestone = PAID
```

Razorpay Test Mode integration and webhook signature verification are **planned / not yet implemented**.

The frontend "Approve Milestone" button is currently presentation-only. It updates local UI state but does not call a backend approval endpoint. **Test Mode ≠ real-money payment.**

---

## 13. Security Boundaries

Verification is restricted to the **configured allowlisted demo application**.

Browser:
- Dedicated Playwright/Chromium context per verification run
- No host filesystem access, no server secrets, no internal-service access
- No arbitrary shell/code execution

Credentials:
- Demo credentials only; passwords are never exposed to the LLM
- Executor injects credentials via controlled placeholders at runtime

Agent:
- Submitted web content is untrusted data, never an instruction
- No Razorpay tools, no database tool, no source-code modification

Host/origin allowlisting is enforced both before execution (plan validation) and at runtime on every navigation and HTTP response, including redirects.

This is an MVP safety boundary, not production-grade arbitrary-website sandboxing.

---

## 14. Failure Handling

| Failure | Result / fallback |
|---|---|
| App unreachable | ENVIRONMENT_FAILURE → UNCERTAIN |
| Login failure | FAIL |
| Browser timeout | retry → UNCERTAIN |
| Selector missing | retry → UNCERTAIN |
| API 500 | FAIL |
| API timeout | retry → UNCERTAIN |
| AI planner failure/unavailable/rejected | deterministic fallback plan |
| Invalid AI output | reject plan → fallback |
| Evidence failure | block result |
| Razorpay failure *(planned)* | PAYMENT_PENDING |
| Webhook failure *(planned)* | keep payment pending + retry |

Fallback plan for the controlled demo covers all six criteria. The fallback plan is never presented as AI-generated.

---

## 15. Deployment (Not Yet Confirmed)

The application runs locally for the current demo. Production deployment (containerized backend with Playwright/Chromium, hosted database, public frontend) is planned but not yet confirmed live.

---

## 16. MVP Scope

### Implemented
- React/Vite frontend, Express/TypeScript backend, PostgreSQL/Prisma
- Google Gemini structured-output AI planner (single call per criterion)
- Deterministic plan validator, executor, and evaluator
- Playwright/Chromium browser verification, deterministic HTTP verifier
- Evidence capture, deterministic decision engine
- Reverification (rerun-all, plan reuse)
- Six-criterion controlled demo with completed end-to-end verification

### Planned / not yet implemented
- Human-approval-gated backend endpoint
- Razorpay Test Mode payment + webhook verification
- Read-only AI failure explanation (post-evaluation)
- Production deployment and hardening

### Explicitly out of scope
```text
microservices, Kubernetes, Redis, message queue, RAG, vector DB,
LangChain/LangGraph, MCP, multi-agent system, mobile testing,
repository analysis, automatic code fixing, escrow, marketplace,
autonomous payment, real-money release, enterprise SSO,
production-grade arbitrary-site sandbox
```

---

## Architecture Principle

**Don't ask the buyer to trust the delivery. Show them the proof.**
