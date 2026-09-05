# WorkSeal — MVP Build Reference

## Problem Statement

Businesses hiring freelancers/software agencies often have agreed milestone requirements but lack a fast, evidence-backed way to determine whether delivered web software actually satisfies those requirements before approving payment. Buyers may rely on manual testing, demos, screenshots, and subjective judgment, creating risk of paying for incomplete work or unnecessarily rejecting legitimate work.

## Main Product

WorkSeal is an AI-powered acceptance-verification layer for software milestones.

Flow: Agreement → Milestone → Acceptance Criteria → Delivery → AI Planning → Verification → Evidence → PASS/FAIL/UNCERTAIN → Human Approval → Payment *(Razorpay Test Mode — planned)*

**Current implementation status:** AI planning (Google Gemini, single planner call), plan validation, deterministic execution/evidence/evaluation, the decision engine, and the six-criterion controlled demo are implemented and have completed an end-to-end verification run. Razorpay Test Mode payment integration is planned/next integration.

## Main Features

- Project + milestone creation
- Natural-language acceptance criteria
- Web-app URL + demo credentials submission
- AI requirement interpretation (single planner call, no separate interpretation stage)
- AI verification-plan generation
- Browser verification with Playwright
- Limited API/HTTP verification
- Evidence capture
- Criterion-level PASS / FAIL / UNCERTAIN
- Milestone-level READY / NOT READY / REVIEW REQUIRED
- Failure explanation + reproduction steps *(planned — read-only AI capability, not yet implemented)*
- Developer resubmission + re-verification
- Human approval
- Razorpay Test Mode payment workflow *(planned)*
- Payment status/webhook where feasible *(planned)*
- Basic verification/audit history

## Functional Requirements — MVP

- **FR-001:** Create project.
- **FR-002:** Create milestone with name, description, and amount.
- **FR-003:** Add 4–6 natural-language acceptance criteria.
- **FR-004:** Submit web-app URL and demo credentials.
- **FR-005:** Create a verification run.
- **FR-006:** Convert criteria into structured verification tasks.
- **FR-007:** Execute browser checks with Playwright.
- **FR-008:** Execute limited deterministic API/HTTP checks.
- **FR-009:** Capture evidence and associate it with criteria.
- **FR-010:** Produce PASS / FAIL / UNCERTAIN.
- **FR-011:** Produce milestone-level decision.
- **FR-012:** Show failed criterion, evidence, and reason. *(Reproduction steps require the planned AI failure explanation — not yet implemented.)*
- **FR-013:** Support resubmission and re-verification.
- **FR-014:** Require explicit human approval before payment.
- **FR-015:** Integrate Razorpay Test Mode Payment Link if setup permits. *(Planned — not yet confirmed implemented.)*
- **FR-016:** Record/process payment confirmation where feasible. *(Planned.)*
- **FR-017:** Maintain an audit trail.

## AI / Agent Requirements

**AI:**
- requirement interpretation
- verification planning
- bounded tool selection within the declared allowlist
- read-only failure explanation after deterministic evaluation *(planned)*

**Deterministic:**
- browser/API execution
- assertions
- evidence collection
- criterion evaluation
- retry policy
- PASS/FAIL/UNCERTAIN
- milestone decision

**Human:**
- final milestone approval

**Hard rule:** AI never directly releases payment.

## AI Verification Requirements

These requirements govern the implemented AI planning and execution boundary and remain unchanged and unweakened:

- **AI-01 Single Planner:** Use one AI Planner operation to convert an acceptance criterion plus safe submission context into a structured VerificationPlan.
- **AI-02 Structured Plan:** Planner output must conform to the frozen VerificationPlan schema.
- **AI-03 Closed Allowlist:** Tools are BROWSER and API. Browser actions: navigate, click, fill, select, assertText, assertVisible, screenshot. API actions: request, assertStatus, assertJsonField.
- **AI-04 Fail-Closed Validation:** Unknown tools/actions/fields/capabilities/hosts/parameters reject the complete plan before execution.
- **AI-05 Plan Limits:** Plans contain 1–20 steps with unique step IDs.
- **AI-06 URL Security:** Only configured allowlisted application origins may be targeted. Non-allowlisted redirects are rejected. Host/origin validation is enforced both statically against the plan before execution and at runtime on every navigation event and HTTP response, including redirect hops; a runtime mismatch aborts the step.
- **AI-07 Credential Isolation:** Raw passwords, API keys, database credentials, payment secrets, LLM provider keys, session secrets, and environment variables are never supplied to the LLM.
- **AI-08 No Arbitrary Execution:** No shell, terminal, arbitrary JavaScript/Node, filesystem, SQL, database operations, code modification, or payment operations.
- **AI-09 Deterministic Execution:** Only validated plans reach fixed Playwright/API handlers.
- **AI-10 Evidence Integrity:** Evidence must originate from actual deterministic execution.
- **AI-11 Deterministic Criterion Result:** The deterministic evaluator alone produces PASS/FAIL/UNCERTAIN.
- **AI-12 Deterministic Milestone Decision:** The existing decision engine alone produces READY_FOR_APPROVAL, NOT_READY, or REVIEW_REQUIRED.
- **AI-13 Failure Explanation:** AI failure explanation is read-only and runs only after deterministic evaluation. It cannot change results. *(Planned — not yet implemented.)*
- **AI-14 Reverification:** Reverification creates a new run and preserves previous evidence/history. MVP reruns all criteria. Reverification reuses the previously validated plan stored per criterion; the planner is re-invoked only if the criterion description changed or no validated plan exists yet.
- **AI-15 Deterministic Fallback:** AI planning failure/unavailability/rejection must not disable the existing deterministic verifier.
- **AI-16 Independent Executor Gate:** Before LLM-generated plans execute, a hand-written validated VerificationPlan must prove deterministic execution, evidence, and evaluation.
- **AI-17 Known Selectors:** Planning context includes a static, developer-authored known-selector map for the controlled demo application; it is never derived from live scraped content.
- **AI-18 Step Result Classification:** Criterion result aggregation follows step classification — assertion-step failure produces FAIL; mechanism-step failure (selector not found, timeout, navigation error) produces UNCERTAIN, never FAIL.
- **AI-19 Action-Aware Retry:** State-mutating (POST) request steps are not automatically retried on failure or timeout.
- **AI-20 Evidence Path Integrity:** AI-supplied strings are never used to construct evidence file paths; evidence files use system-generated identifiers.
- **AI-21 Session Continuity:** All steps of one validated plan execute within a single continuous browser session.
- **AI-22 Payload Limits:** `assertJsonField.path` is dot-notation only. `request.body` and `expectedValue` are bounded to a maximum nesting depth of 3 levels, a maximum serialized `request.body` size of 4096 bytes, and a maximum serialized `expectedValue` size of 1024 bytes; `expectedValue` is restricted to JSON scalar values (`string | number | boolean | null`), and objects/arrays are rejected. Plans exceeding these limits are rejected, not truncated.

Foundational requirements preserved unchanged: the controlled demo, six criteria, deterministic verifier, evidence, PASS/FAIL/UNCERTAIN, decision engine, human approval, Razorpay Test Mode (planned), modular monolith, and the existing Prisma model.

## Result Rules

- **PASS:** Required behavior is demonstrated by sufficient evidence/assertions.
- **FAIL:** Required behavior demonstrably fails or has a reproducible defect.
- **UNCERTAIN:** Evidence is insufficient/conflicting, requirement is ambiguous, or environment prevents reliable verification.

Any blocking FAIL → NOT READY. No FAIL but any UNCERTAIN → REVIEW REQUIRED. All criteria PASS → READY FOR APPROVAL.

## Evidence

Every final PASS/FAIL must show: what happened, how we know, and which criterion it proves. Evidence can include screenshots, browser traces, API request/response, logs, URLs, and timestamps.

## MVP

One buyer + one controlled web app + one milestone + 4–6 criteria + one complete verification lifecycle.

Includes:
- Non-technical startup/SMB buyer flow
- Controlled Customer Support Portal
- Browser-first verification
- Limited API checks
- AI planning/interpretation
- Real evidence
- PASS/FAIL/UNCERTAIN
- Deliberate failure → fix → reverify
- Human approval
- Razorpay Test Mode payment *(planned, if feasible)*

## Out of Scope

Escrow, marketplace, mobile testing, arbitrary software support, automatic code fixing, autonomous real-money payment release, complex enterprise permissions/SSO, full contract management, large analytics systems, production-scale payment infrastructure.

## Demo

Customer Support Portal:
1. Login
2. Dashboard
3. Create ticket
4. Ticket history
5. Ticket status/details
6. Logout

A deliberate defect (ticket creation returns HTTP 500) was used to demonstrate the fail → fix → reverify loop. The most recent live verification run produced: 6/6 PASS → `READY_FOR_APPROVAL`. Human approval backend and Razorpay Test Mode integration are the next planned steps.

## Product Principle

Don't ask the buyer to trust the delivery. Show them the proof.
