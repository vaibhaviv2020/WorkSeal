# WorkSeal — Project Lifecycle

**Product:** WorkSeal
**Core problem:** Proving whether delivered software satisfies agreed milestone requirements before payment
**Primary user:** Buyer/client
**Target:** Web applications
**Verification:** AI planning (Google Gemini) + deterministic Playwright/API execution
**Evidence:** Screenshots / traces / API results / logs
**Results:** PASS / FAIL / UNCERTAIN
**Failure loop:** Fix → resubmit → reverify
**Payment:** Human approval → Razorpay Test Mode *(planned — not yet implemented)*
**Agent:** Bounded — cannot modify code or release payment
**Demo:** Customer Support Portal (six criteria)
**Architecture:** Modular monolith

> **Don't ask the buyer to trust the delivery. Show them the proof.**

---

## Non-negotiables

1. Build the approved WorkSeal MVP only.
2. AI plans/reasons; deterministic tools execute and prove.
3. Every final PASS/FAIL must have evidence.
4. UNCERTAIN must remain a valid outcome.
5. Human approval is required before payment.
6. AI never releases payment.
7. Razorpay Test Mode is never presented as real-money settlement.
8. The controlled demo application is the primary verification target.
9. No microservices, queues, RAG, vector DBs, multi-agent systems, or other non-MVP infrastructure.

---

## Completed ✅

**Product & specification**
- Product definition, MVP scope, and frozen specification
- Controlled demo application: Customer Support Portal (Login, Dashboard, Create Ticket, Ticket History, Ticket Details, Logout)
- Deliberate defect used to demonstrate the fail → fix → reverify loop

**Verification core**
- Database schema (users, projects, milestones, criteria, submissions, verification runs/tasks, evidence, payments, audit logs)
- Backend CRUD for projects, milestones, criteria, submissions
- Deterministic browser (Playwright/Chromium) and API verification
- Evidence capture (screenshots, traces, API responses, logs)
- Deterministic decision engine (NOT_READY / REVIEW_REQUIRED / READY_FOR_APPROVAL)

**AI verification**
- AI Planner — single Google Gemini structured-output call (requirement interpretation and plan generation combined; no separate interpretation stage)
- Plan validation (schema, allowlist, host, payload limits — fail-closed)
- Plan persistence (`Criterion.aiInterpretation`)
- Controlled plan execution, proven first with a hand-written validated plan
- Verification integration: AI planner connected end-to-end via `verification-runner.ts`, with the deterministic fallback preserved
- Reverification (rerun-all, plan reuse unless criterion text changes)

**Frontend**
- React/Vite dashboard with project/milestone summary, verification results, criterion details, pipeline visualization, and approval UI
- Polished SaaS-style UI with status badges, responsive layout, and evidence display

**Validation milestone**
- End-to-end six-criterion live verification run: **decision `READY_FOR_APPROVAL`, overall `PASS`, 6/6 criteria PASS, 84/84 automated tests passing, build passing**

---

## Current Submission Work 🔄

- Repository security audit and documentation cleanup
- `.env.example` files created for backend and demo-app server
- `.gitignore` updated to cover evidence files and debug artifacts
- GitHub publication preparation
- Demo video and screenshots
- Buildathon submission materials (pitch, demo script)

---

## Future / Conditional 🔜

- **Human-approval backend endpoint** — the frontend "Approve Milestone" button is currently presentation-only; a real `POST /api/milestones/:id/approve` endpoint is not yet implemented
- **Razorpay Test Mode payment integration** — payment link creation, webhook handler, and signature verification are not yet implemented
- **Read-only AI failure explanation** — summary, likely cause, and reproduction guidance over FAIL/UNCERTAIN results, to be implemented after the AI verification path is stable
- **Expanded deployment** — public hosting, containerized Playwright runtime, production hardening
- **Selective reverification** — rerun only affected criteria rather than all criteria
- **Basic audit log expansion**

---

## Security Checklist

- `GEMINI_API_KEY`, `DATABASE_URL`, and other secrets must be kept in `.env` files that are excluded by `.gitignore` — never committed
- `.env.example` files are provided for both the backend and demo-app server
- Browser execution uses a dedicated Playwright/Chromium context with no filesystem or server-secret access
- The AI planner cannot modify source code, change milestone amount/criteria, approve payment, or access payment secrets
- Human approval is required before any payment step; webhook signatures will be verified once payment is implemented
- Raw credentials are never sent to the LLM; only controlled placeholders are used

---

## Definition of Done

WorkSeal's core loop is complete when this journey runs reliably end-to-end:

```text
BUYER CREATES MILESTONE
        ↓
ACCEPTANCE CRITERIA
        ↓
DEVELOPER SUBMITS WEB APP
        ↓
AI CREATES VERIFICATION PLAN
        ↓
DETERMINISTIC EXECUTION
        ↓
EVIDENCE CAPTURED
        ↓
DETERMINISTIC EVALUATION → PASS / FAIL / UNCERTAIN
        ↓
DECISION ENGINE → READY_FOR_APPROVAL / NOT_READY / REVIEW_REQUIRED
        ↓
HUMAN APPROVES
        ↓
PAYMENT (Razorpay Test Mode — planned)
```

This loop has been demonstrated end-to-end against the controlled demo through `READY_FOR_APPROVAL`. The human approval backend endpoint and Razorpay integration remain as the next implementation steps.

---

## If Time Runs Short Before Submission

Cut in this order: advanced analytics → visual regression → advanced performance checks → extra API verification → advanced uncertainty UX → nonessential integrations.

Protect at all costs: acceptance criteria → AI planning → real verification → evidence → PASS/FAIL → failure → fix → reverification → human approval.
