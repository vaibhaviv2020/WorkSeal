import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_CATALOG,
  DEMO_CRITERION_IDS,
  seedValidatedDemoCatalog,
} from "../lib/demo-catalog.js";

import {
  createVerificationRunner,
  type RunCriterionVerificationInput,
} from "./verification-runner.js";

const ALLOWED_ORIGIN = "http://localhost:5174";

function makeInput(
  overrides: Partial<RunCriterionVerificationInput> = {}
): RunCriterionVerificationInput {
  return {
    criterion: {
      id: DEMO_CRITERION_IDS.LOGIN,
      description:
        "User can log in with valid demo credentials.",
      aiInterpretation: null,
    },
    submission: {
      id: "33333333-3333-4333-8333-333333333333",
      appUrl: `${ALLOWED_ORIGIN}/`,
    },
    runId: "44444444-4444-4444-8444-444444444444",
    taskId: "55555555-5555-4555-8555-555555555555",
    ...overrides,
  };
}

function executionResult(
  criterionId: string,
  result: "PASS" | "FAIL" | "UNCERTAIN" = "PASS"
) {
  const status =
    result === "PASS"
      ? ("PASS" as const)
      : result === "FAIL"
        ? ("FAIL" as const)
        : ("TIMEOUT" as const);

  const error =
    result !== "PASS"
      ? {
          type:
            result === "FAIL"
              ? ("ASSERTION_FAILURE" as const)
              : ("EXECUTION_ERROR" as const),
          message:
            result === "FAIL"
              ? "Catalog assertion failed"
              : "Catalog execution timed out",
        }
      : undefined;

  const evidenceType = "SCREENSHOT" as const;

  return {
    criterionId,
    planVersion: 1 as const,
    results: [
      {
        stepId: "catalog-step",
        status,
        observedAt: "2026-09-05T00:00:00.000Z",
        evidenceIds: ["catalog-evidence"],
        ...(error ? { error } : {}),
      },
    ],
    evidence: [
      {
        id: "catalog-evidence",
        runId: "44444444-4444-4444-8444-444444444444",
        taskId: "55555555-5555-4555-8555-555555555555",
        criterionId,
        type: evidenceType,
        path: "/tmp/catalog-evidence.png",
        metadata: {
          description:
            "Catalog assertion evidence captured during deterministic execution.",
        },
      },
    ],
    evaluation: {
      criterionId,
      result,
      reason:
        result === "PASS"
          ? "Catalog plan execution passed."
          : result === "FAIL"
            ? "Catalog plan execution failed."
            : "Catalog plan execution timed out.",
      evidenceIds: ["catalog-evidence"],
    },
  };
}

test("all catalog plans validate and carry the expected criterion IDs", () => {
  assert.equal(DEMO_CATALOG.length, 6);

  for (const item of DEMO_CATALOG) {
    assert.equal(item.plan.version, 1);
    assert.equal(item.plan.criterionId, item.criterionId);
    assert.ok(item.plan.steps.length >= 1);
    assert.ok(item.plan.goal.length > 0);
  }
});

test("all catalog plans use meaningful assertions instead of generic placeholders", () => {
  const expectedAssertions: Record<string, string[]> = {
    [DEMO_CRITERION_IDS.LOGIN]: ["Dashboard"],
    [DEMO_CRITERION_IDS.DASHBOARD]: ["Open", "In Progress", "Resolved"],
    [DEMO_CRITERION_IDS.TICKET_HISTORY]: ["Ticket History"],
    [DEMO_CRITERION_IDS.TICKET_DETAILS]: ["Ticket Details", "OPEN"],
    [DEMO_CRITERION_IDS.LOGOUT]: ['input[type="email"]'],
  };

  for (const item of DEMO_CATALOG) {
    const textChecks = item.plan.steps.flatMap((step) =>
      step.action.type === "assertText"
        ? [step.action.expectedText]
        : []
    );

    const visibleChecks = item.plan.steps.flatMap((step) =>
      step.action.type === "assertVisible"
        ? [step.action.selector]
        : []
    );

    const combined = [...textChecks, ...visibleChecks];
    const expected = expectedAssertions[item.criterionId] ?? [];

    for (const value of expected) {
      assert.ok(
        combined.some((candidate) =>
          candidate.toLowerCase().includes(value.toLowerCase())
        ),
        `${item.criterionId} is missing a meaningful assertion for ${value}`
      );
    }
  }
});

test("all non-fallback catalog plans are reused without planner calls", async () => {
  const nonFallback = DEMO_CATALOG.filter(
    (c) => c.criterionId !== DEMO_CRITERION_IDS.CREATE_TICKET
  );

  for (const item of nonFallback) {
    let plannerCalls = 0;
    let executorCalls = 0;

    const runner = createVerificationRunner({
      getAllowedApplicationOrigins: () => [ALLOWED_ORIGIN],
      generateVerificationPlan: async () => {
        plannerCalls += 1;
        return item.plan;
      },
      executeVerificationPlan: async () => {
        executorCalls += 1;
        return executionResult(item.criterionId, "PASS");
      },
      verifyCriterion: async () => {
        throw new Error("fallback should not be reached");
      },
    });

    const result = await runner.runCriterionVerification(
      makeInput({
        criterion: {
          id: item.criterionId,
          description: item.description,
          aiInterpretation: {
            version: 1,
            plan: item.plan,
            validatedAt: new Date().toISOString(),
            criterionDescriptionSnapshot: item.description,
          },
        },
      })
    );

    assert.equal(result.result, "PASS");
    assert.equal(result.planSource, "AI");
    assert.equal(plannerCalls, 0);
    assert.equal(executorCalls, 1);
  }
});

test("ticket history plan waits for and opens a visible ticket row", () => {
  const ticketHistory = DEMO_CATALOG.find(
    (criterion) =>
      criterion.criterionId ===
      DEMO_CRITERION_IDS.TICKET_HISTORY
  );

  assert.ok(ticketHistory);

  const ticketSubjectCheck = ticketHistory?.plan.steps.some(
    (step) =>
      step.action.type === "click" &&
      step.action.selector ===
        'section.panel:has(h2:has-text("Ticket History")) article.ticket-row:first-of-type button.ticket-subject'
  );

  assert.equal(ticketSubjectCheck, true);
});

test("ticket details plan opens the seeded ticket and checks the details status", () => {
  const ticketDetails = DEMO_CATALOG.find(
    (criterion) =>
      criterion.criterionId ===
      DEMO_CRITERION_IDS.TICKET_DETAILS
  );

  assert.ok(ticketDetails);

  assert.ok(
    ticketDetails?.plan.steps.some(
      (step) =>
        step.action.type === "click" &&
        step.action.selector.includes("Unable to login")
    )
  );

  assert.ok(
    ticketDetails?.plan.steps.some(
      (step) =>
        step.action.type === "assertText" &&
        step.action.expectedText === "Ticket Details"
    )
  );

  assert.ok(
    ticketDetails?.plan.steps.some(
      (step) =>
        step.action.type === "assertText" &&
        step.action.expectedText === "OPEN"
    )
  );
});

test("logout plan verifies the login screen after logout", () => {
  const logout = DEMO_CATALOG.find(
    (criterion) =>
      criterion.criterionId ===
      DEMO_CRITERION_IDS.LOGOUT
  );

  assert.ok(logout);

  assert.ok(
    logout?.plan.steps.some(
      (step) =>
        step.action.type === "assertVisible" &&
        step.action.selector === 'input[type="email"]'
    )
  );
});

test("seedValidatedDemoCatalog clears stale plans and stores validated catalog plans", async () => {
  const updates: Array<{ where: { id: string }; data: { aiInterpretation: unknown } }> = [];

  const db = {
    criterion: {
      findMany: async () =>
        [
          { id: DEMO_CRITERION_IDS.LOGIN },
          { id: DEMO_CRITERION_IDS.DASHBOARD },
          { id: DEMO_CRITERION_IDS.TICKET_HISTORY },
          { id: DEMO_CRITERION_IDS.TICKET_DETAILS },
          { id: DEMO_CRITERION_IDS.LOGOUT },
          { id: DEMO_CRITERION_IDS.CREATE_TICKET },
        ],
      update: async (args: {
        where: { id: string };
        data: { aiInterpretation: unknown };
      }) => {
        updates.push(args);
        return {};
      },
    },
  } as any;

  await seedValidatedDemoCatalog(db);

  assert.equal(
    updates.filter(
      (entry) => entry.data.aiInterpretation === null
    ).length,
    6
  );

  const seeded = updates.filter(
    (entry) => entry.data.aiInterpretation &&
      typeof entry.data.aiInterpretation === "object"
  );
  assert.equal(seeded.length, 6);
  assert.ok(
    seeded.some(
      (entry) =>
        (entry as any).where.id === DEMO_CRITERION_IDS.LOGIN
    )
  );
  assert.ok(
    seeded.some(
      (entry) =>
        (entry as any).where.id === DEMO_CRITERION_IDS.LOGOUT
    )
  );
});

test("seedValidatedDemoCatalog uses DB criterion.description for stored snapshot", async () => {
  const updates: Array<{ where: { id: string }; data: { aiInterpretation: unknown } }> = [];

  const dbDescriptions: Record<string, string> = {
    [DEMO_CRITERION_IDS.LOGIN]: "DB login description",
    [DEMO_CRITERION_IDS.DASHBOARD]: "DB dashboard description",
    [DEMO_CRITERION_IDS.TICKET_HISTORY]: "DB ticket history description",
    [DEMO_CRITERION_IDS.TICKET_DETAILS]: "DB ticket details description",
    [DEMO_CRITERION_IDS.LOGOUT]: "DB logout description",
  };

  const db = {
    criterion: {
      findMany: async () =>
        Object.keys(dbDescriptions).map((id) => ({ id, description: dbDescriptions[id] })),
      update: async (args: {
        where: { id: string };
        data: { aiInterpretation: unknown };
      }) => {
        updates.push(args);
        return {};
      },
    },
  } as any;

  await seedValidatedDemoCatalog(db);

  const seeded = updates.filter(
    (entry) => entry.data.aiInterpretation && typeof entry.data.aiInterpretation === "object"
  );

  for (const entry of seeded) {
    const id = (entry as any).where.id as string;
    const stored = (entry.data.aiInterpretation as any) as { criterionDescriptionSnapshot?: string };
    assert.equal(stored.criterionDescriptionSnapshot, dbDescriptions[id]);
  }
});

test("stored valid demo catalog plans are reused without planner calls", async () => {
  const catalogPlan = DEMO_CATALOG.find(
    (item) => item.criterionId === DEMO_CRITERION_IDS.LOGIN
  )!;

  let plannerCalls = 0;
  let executorCalls = 0;

  const runner = createVerificationRunner({
    getAllowedApplicationOrigins: () => [ALLOWED_ORIGIN],
    generateVerificationPlan: async () => {
      plannerCalls += 1;
      return catalogPlan.plan;
    },
    executeVerificationPlan: async () => {
      executorCalls += 1;
      return executionResult(DEMO_CRITERION_IDS.LOGIN, "PASS");
    },
    verifyCriterion: async () => {
      throw new Error("fallback should not be reached");
    },
  });

  const result = await runner.runCriterionVerification(
    makeInput({
      criterion: {
        id: DEMO_CRITERION_IDS.LOGIN,
        description:
          "User can log in with valid demo credentials.",
        aiInterpretation: {
          version: 1,
          plan: catalogPlan.plan,
          validatedAt: "2026-09-05T00:00:00.000Z",
          criterionDescriptionSnapshot:
            "User can log in with valid demo credentials.",
        },
      },
    })
  );

  assert.equal(result.result, "PASS");
  assert.equal(result.planSource, "AI");
  assert.equal(plannerCalls, 0);
  assert.equal(executorCalls, 1);
});

test("stale demo catalog description mismatch regenerates the stored plan according to runner semantics", async () => {
  const catalogPlan = DEMO_CATALOG.find(
    (item) => item.criterionId === DEMO_CRITERION_IDS.LOGIN
  )!;

  let plannerCalls = 0;
  let executorCalls = 0;

  const runner = createVerificationRunner({
    getAllowedApplicationOrigins: () => [ALLOWED_ORIGIN],
    generateVerificationPlan: async (context) => {
      plannerCalls += 1;
      assert.equal(
        context.criterionDescription,
        "User can log in with a different credential flow."
      );
      return catalogPlan.plan;
    },
    executeVerificationPlan: async () => {
      executorCalls += 1;
      return executionResult(DEMO_CRITERION_IDS.LOGIN, "PASS");
    },
    verifyCriterion: async () => {
      throw new Error("fallback should not be reached");
    },
  });

  const result = await runner.runCriterionVerification(
    makeInput({
      criterion: {
        id: DEMO_CRITERION_IDS.LOGIN,
        description:
          "User can log in with a different credential flow.",
        aiInterpretation: {
          version: 1,
          plan: catalogPlan.plan,
          validatedAt: "2026-09-05T00:00:00.000Z",
          criterionDescriptionSnapshot:
            "User can log in with valid demo credentials.",
        },
      },
    })
  );

  assert.equal(result.result, "PASS");
  assert.equal(result.planSource, "AI");
  assert.equal(plannerCalls, 1);
  assert.equal(executorCalls, 1);
});

test("Create Ticket remains deterministic fallback when no valid catalog plan is stored", async () => {
  let plannerCalls = 0;
  let fallbackCalls = 0;

  const runner = createVerificationRunner({
    getAllowedApplicationOrigins: () => [ALLOWED_ORIGIN],
    generateVerificationPlan: async () => {
      plannerCalls += 1;
      throw new Error("AI planner unavailable");
    },
    executeVerificationPlan: async () => {
      throw new Error("Plan executor should not run on fallback-only criterion");
    },
    verifyCriterion: async (criterionId) => {
      fallbackCalls += 1;
      assert.equal(criterionId, DEMO_CRITERION_IDS.CREATE_TICKET);
      return {
        criterionId,
        result: "PASS",
        reason: "Deterministic fallback verification passed.",
        evidence: [
          {
            type: "SCREENSHOT",
            path: "/tmp/create-ticket-fallback.png",
            description: "Fallback verification screenshot",
          },
        ],
      };
    },
  });

  const result = await runner.runCriterionVerification(
    makeInput({
      criterion: {
        id: DEMO_CRITERION_IDS.CREATE_TICKET,
        description: "User can create a support ticket.",
        aiInterpretation: null,
      },
    })
  );

  assert.equal(result.result, "PASS");
  assert.equal(result.planSource, "FALLBACK");
  assert.equal(plannerCalls, 0);
  assert.equal(fallbackCalls, 1);
});
