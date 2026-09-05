import assert from "node:assert/strict";
import test from "node:test";

import type {
  PlanExecutionResult,
} from "../agent/verification-plan-executor.js";

import type {
  ValidatedVerificationPlan,
} from "../modules/ai/ai.schemas.js";

import {
  DEMO_CRITERION_IDS,
} from "../lib/demo-catalog.js";

import {
  createVerificationRunner,
  type RunCriterionVerificationInput,
} from "./verification-runner.js";

const ALLOWED_ORIGIN = "http://localhost:5174";

const CRITERION_ID =
  "11111111-1111-4111-8111-111111111111";

const OTHER_CRITERION_ID =
  "22222222-2222-4222-8222-222222222222";

const SUBMISSION_ID =
  "33333333-3333-4333-8333-333333333333";

const RUN_ID =
  "44444444-4444-4444-8444-444444444444";

const TASK_ID =
  "55555555-5555-4555-8555-555555555555";

const CRITERION_DESCRIPTION =
  "User can create a support ticket.";

function makeInput(
  overrides: Partial<RunCriterionVerificationInput> = {}
): RunCriterionVerificationInput {
  return {
    criterion: {
      id: CRITERION_ID,
      description: CRITERION_DESCRIPTION,
      aiInterpretation: null,
    },
    submission: {
      id: SUBMISSION_ID,
      appUrl: `${ALLOWED_ORIGIN}/`,
    },
    runId: RUN_ID,
    taskId: TASK_ID,
    ...overrides,
  };
}

function validPlan(
  criterionId = CRITERION_ID,
  url = `${ALLOWED_ORIGIN}/login`
) {
  return {
    version: 1 as const,
    criterionId,
    goal: "Verify the support ticket criterion",
    steps: [
      {
        id: "step-1",
        tool: "BROWSER" as const,
        action: {
          type: "navigate" as const,
          url,
        },
        expectedOutcome: "The application page loads",
      },
    ],
  };
}

function executionResult(
  result: "PASS" | "FAIL" | "UNCERTAIN" = "PASS",
  criterionId = CRITERION_ID
): PlanExecutionResult {
  return {
    criterionId,
    planVersion: 1,

    results: [
      {
        stepId: "step-1",
        status:
          result === "PASS"
            ? "PASS"
            : result === "FAIL"
              ? "FAIL"
              : "TIMEOUT",
        observedAt:
          "2026-09-04T10:00:00.000Z",
        observation:
          result === "PASS"
            ? { ok: true }
            : undefined,
        evidenceIds:
          result === "PASS"
            ? ["evidence-1"]
            : [],
        ...(result !== "PASS"
          ? {
              error: {
                type:
                  result === "FAIL"
                    ? "ASSERTION_FAILURE"
                    : "EXECUTION_ERROR",
                message:
                  result === "FAIL"
                    ? "Deterministic assertion failed"
                    : "Execution mechanism failed",
              },
            }
          : {}),
      },
    ],

    evidence:
      result === "PASS"
        ? [
            {
              id: "evidence-1",
              runId: RUN_ID,
              taskId: TASK_ID,
              criterionId,
              type: "SCREENSHOT",
              path: "/tmp/evidence.png",
              metadata: {
                description:
                  "Application screenshot captured during execution",
              },
            },
          ]
        : [],

    evaluation: {
      criterionId,
      result,
      reason:
        result === "PASS"
          ? "All deterministic assertions passed and required evidence is present"
          : result === "FAIL"
            ? "Deterministic assertion failed"
            : "Execution mechanism failed or timed out",
      evidenceIds:
        result === "PASS"
          ? ["evidence-1"]
          : [],
    },
  };
}
function fallbackResult(
  result: "PASS" | "FAIL" | "UNCERTAIN" = "PASS"
) {
  return {
    criterionId: CRITERION_ID,
    result,
    reason:
      result === "PASS"
        ? "Deterministic fallback verification passed"
        : result === "FAIL"
          ? "Deterministic fallback verification failed"
          : "Deterministic fallback could not verify the criterion",
    evidence:
      result === "PASS"
        ? [
            {
              type: "SCREENSHOT" as const,
              path: "/tmp/fallback.png",
              description:
                "Fallback verification screenshot",
            },
          ]
        : [],
  };
}

function mockPrisma() {
  const updates: unknown[] = [];

  return {
    updates,

    criterion: {
      update: async (args: unknown) => {
        updates.push(args);
        return {};
      },
    },
  } as any;
}

test("valid AI plan is executed by the deterministic executor", async () => {
  const db = mockPrisma();

  let plannerCalls = 0;
  let executorCalls = 0;
  let fallbackCalls = 0;

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () => {
      plannerCalls += 1;
      return validPlan();
    },

    executeVerificationPlan: async (
  plan: unknown,
  options
) => {
  executorCalls += 1;

  const validatedPlan =
    plan as ValidatedVerificationPlan;

  assert.equal(
    validatedPlan.criterionId,
    CRITERION_ID
  );
      assert.equal(
        options.criterionId,
        CRITERION_ID
      );

      assert.equal(
        options.runId,
        RUN_ID
      );

      assert.equal(
        options.taskId,
        TASK_ID
      );

      return executionResult("PASS");
    },

    verifyCriterion: async () => {
      fallbackCalls += 1;
      return fallbackResult();
    },
  });

  const result =
    await runner.runCriterionVerification(
      makeInput()
    );

  assert.equal(result.result, "PASS");
  assert.equal(result.planSource, "AI");
  assert.equal(result.planVersion, 1);

  assert.equal(plannerCalls, 1);
  assert.equal(executorCalls, 1);
  assert.equal(fallbackCalls, 0);

  assert.equal(db.updates.length, 1);
});

test("planner failure uses deterministic fallback and never executes the AI plan", async () => {
  const db = mockPrisma();

  let executorCalls = 0;
  let fallbackCalls = 0;

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () => {
      throw new Error("AI planner unavailable");
    },

    executeVerificationPlan: async () => {
      executorCalls += 1;
      return executionResult();
    },

    verifyCriterion: async (criterionId) => {
      fallbackCalls += 1;

      assert.equal(
        criterionId,
        CRITERION_ID
      );

      return fallbackResult("PASS");
    },
  });

  const result =
    await runner.runCriterionVerification(
      makeInput()
    );

  assert.equal(result.planSource, "FALLBACK");
  assert.equal(result.result, "PASS");

  assert.equal(executorCalls, 0);
  assert.equal(fallbackCalls, 1);
});

test("malformed or unsafe AI plan is rejected and falls back without execution", async () => {
  const db = mockPrisma();

  let executorCalls = 0;
  let fallbackCalls = 0;

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () => {
      return {
        version: 1,
        criterionId: CRITERION_ID,
        goal: "Unsafe plan",
        steps: [
          {
            id: "step-1",
            tool: "BROWSER",
            action: {
              type: "navigate",
              url: "https://evil.example.com",
            },
            expectedOutcome:
              "Navigate to an untrusted host",
          },
        ],
      } as any;
    },

    executeVerificationPlan: async () => {
      executorCalls += 1;
      return executionResult();
    },

    verifyCriterion: async () => {
      fallbackCalls += 1;
      return fallbackResult("UNCERTAIN");
    },
  });

  const result =
    await runner.runCriterionVerification(
      makeInput()
    );

  assert.equal(
    result.planSource,
    "FALLBACK"
  );

  assert.equal(
    result.result,
    "UNCERTAIN"
  );

  assert.equal(executorCalls, 0);
  assert.equal(fallbackCalls, 1);
});

test("Create Ticket is fallback-only and other catalog criteria still reuse valid stored plans", async () => {
  const db = mockPrisma();
  const createTicketDescription =
    "User can create a support ticket.";

  for (const storedValue of [
    null,
    {
      version: 1,
      plan: validPlan(
        DEMO_CRITERION_IDS.CREATE_TICKET,
        `${ALLOWED_ORIGIN}/login`
      ),
      validatedAt:
        "2026-09-04T10:00:00.000Z",
      criterionDescriptionSnapshot:
        "stale description",
    },
    {
      version: 1,
      plan: validPlan(
        DEMO_CRITERION_IDS.CREATE_TICKET,
        `${ALLOWED_ORIGIN}/login`
      ),
      validatedAt:
        "2026-09-04T10:00:00.000Z",
      criterionDescriptionSnapshot:
        createTicketDescription,
    },
  ]) {
    let plannerCalls = 0;
    let executorCalls = 0;
    let fallbackCalls = 0;

    const runner = createVerificationRunner({
      prisma: db,

      getAllowedApplicationOrigins: () => [
        ALLOWED_ORIGIN,
      ],

      generateVerificationPlan: async () => {
        plannerCalls += 1;
        return validPlan(
          DEMO_CRITERION_IDS.CREATE_TICKET,
          `${ALLOWED_ORIGIN}/login`
        );
      },

      executeVerificationPlan: async () => {
        executorCalls += 1;
        return executionResult(
          "PASS",
          DEMO_CRITERION_IDS.CREATE_TICKET
        );
      },

      verifyCriterion: async (criterionId) => {
        fallbackCalls += 1;

        assert.equal(
          criterionId,
          DEMO_CRITERION_IDS.CREATE_TICKET
        );

        return fallbackResult("PASS");
      },
    });

    const result =
      await runner.runCriterionVerification(
        makeInput({
          criterion: {
            id: DEMO_CRITERION_IDS.CREATE_TICKET,
            description:
              createTicketDescription,
            aiInterpretation:
              storedValue,
          },
        })
      );

    assert.equal(
      result.planSource,
      "FALLBACK"
    );
    assert.equal(
      result.result,
      "PASS"
    );
    assert.equal(plannerCalls, 0);
    assert.equal(executorCalls, 0);
    assert.equal(fallbackCalls, 1);
  }

  const storedPlan = {
    version: 1,
    plan: validPlan(),
    validatedAt:
      "2026-09-04T10:00:00.000Z",
    criterionDescriptionSnapshot:
      CRITERION_DESCRIPTION,
  };

  let plannerCalls = 0;
  let executorCalls = 0;
  let fallbackCalls = 0;

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () => {
      plannerCalls += 1;
      return validPlan();
    },

    executeVerificationPlan: async (
      plan
    ) => {
      executorCalls += 1;

      const validatedPlan =
        plan as ValidatedVerificationPlan;

      assert.equal(
        validatedPlan.criterionId,
        CRITERION_ID
      );

      return executionResult("PASS");
    },

    verifyCriterion: async () => {
      fallbackCalls += 1;
      return fallbackResult();
    },
  });

  const result =
    await runner.runCriterionVerification(
      makeInput({
        criterion: {
          id: CRITERION_ID,
          description:
            CRITERION_DESCRIPTION,
          aiInterpretation:
            storedPlan,
        },
      })
    );

  assert.equal(result.planSource, "AI");
  assert.equal(result.result, "PASS");

  assert.equal(plannerCalls, 0);
  assert.equal(executorCalls, 1);
  assert.equal(fallbackCalls, 0);
});

test("changed criterion description invalidates stored plan and causes a fresh planner call", async () => {
  const db = mockPrisma();

  const oldDescription =
    "User can create a support ticket.";

  const newDescription =
    "User can create a support ticket and see it in history.";

  const storedPlan = {
    version: 1,
    plan: validPlan(),
    validatedAt:
      "2026-09-04T10:00:00.000Z",
    criterionDescriptionSnapshot:
      oldDescription,
  };

  let plannerCalls = 0;
  let executorCalls = 0;

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async (
      context
    ) => {
      plannerCalls += 1;

      assert.equal(
        context.criterionDescription,
        newDescription
      );

      return validPlan();
    },

    executeVerificationPlan: async () => {
      executorCalls += 1;
      return executionResult("PASS");
    },

    verifyCriterion: async () =>
      fallbackResult(),
  });

  const result =
    await runner.runCriterionVerification(
      makeInput({
        criterion: {
          id: CRITERION_ID,
          description: newDescription,
          aiInterpretation:
            storedPlan,
        },
      })
    );

  assert.equal(result.result, "PASS");
  assert.equal(result.planSource, "AI");

  assert.equal(plannerCalls, 1);
  assert.equal(executorCalls, 1);
});

test("invalid stored plan is discarded and regenerated once", async () => {
  const db = mockPrisma();

  const invalidStoredPlan = {
    version: 1,
    plan: {
      version: 1,
      criterionId: CRITERION_ID,
      goal: "Invalid stored plan",
      steps: [
        {
          id: "step-1",
          tool: "BROWSER",
          action: {
            type: "navigate",
            url: "https://evil.example.com",
          },
          expectedOutcome:
            "Unsafe navigation",
        },
      ],
    },
    validatedAt:
      "2026-09-04T10:00:00.000Z",
    criterionDescriptionSnapshot:
      CRITERION_DESCRIPTION,
  };

  let plannerCalls = 0;
  let executorCalls = 0;

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () => {
      plannerCalls += 1;
      return validPlan();
    },

    executeVerificationPlan: async () => {
      executorCalls += 1;
      return executionResult("PASS");
    },

    verifyCriterion: async () =>
      fallbackResult(),
  });

  const result =
    await runner.runCriterionVerification(
      makeInput({
        criterion: {
          id: CRITERION_ID,
          description:
            CRITERION_DESCRIPTION,
          aiInterpretation:
            invalidStoredPlan,
        },
      })
    );

  assert.equal(result.result, "PASS");
  assert.equal(result.planSource, "AI");

  assert.equal(plannerCalls, 1);
  assert.equal(executorCalls, 1);
});

test("criterion ID mismatch is rejected and falls back without execution", async () => {
  const db = mockPrisma();

  let executorCalls = 0;
  let fallbackCalls = 0;

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () => {
      return validPlan(
        OTHER_CRITERION_ID
      );
    },

    executeVerificationPlan: async () => {
      executorCalls += 1;
      return executionResult();
    },

    verifyCriterion: async () => {
      fallbackCalls += 1;
      return fallbackResult("UNCERTAIN");
    },
  });

  const result =
    await runner.runCriterionVerification(
      makeInput()
    );

  assert.equal(
    result.planSource,
    "FALLBACK"
  );

  assert.equal(
    result.result,
    "UNCERTAIN"
  );

  assert.equal(executorCalls, 0);
  assert.equal(fallbackCalls, 1);
});

test("plan URL mismatch with current submission origin is rejected and falls back", async () => {
  const db = mockPrisma();

  let executorCalls = 0;
  let fallbackCalls = 0;

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () => {
      return validPlan(
        CRITERION_ID,
        "http://localhost:5173/login"
      );
    },

    executeVerificationPlan: async () => {
      executorCalls += 1;
      return executionResult();
    },

    verifyCriterion: async () => {
      fallbackCalls += 1;
      return fallbackResult("UNCERTAIN");
    },
  });

  const result =
    await runner.runCriterionVerification(
      makeInput()
    );

  assert.equal(
    result.planSource,
    "FALLBACK"
  );

  assert.equal(
    result.result,
    "UNCERTAIN"
  );

  assert.equal(executorCalls, 0);
  assert.equal(fallbackCalls, 1);
});

test("current submission outside the allowlisted origin is a hard security rejection", async () => {
  const db = mockPrisma();

  let plannerCalls = 0;
  let executorCalls = 0;
  let fallbackCalls = 0;

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () => {
      plannerCalls += 1;
      return validPlan();
    },

    executeVerificationPlan: async () => {
      executorCalls += 1;
      return executionResult();
    },

    verifyCriterion: async () => {
      fallbackCalls += 1;
      return fallbackResult();
    },
  });

  await assert.rejects(
    () =>
      runner.runCriterionVerification(
        makeInput({
          submission: {
            id: SUBMISSION_ID,
            appUrl:
              "http://evil.example.com/",
          },
        })
      ),
    /Current submission application URL is not allowlisted/
  );

  assert.equal(plannerCalls, 0);
  assert.equal(executorCalls, 0);
  assert.equal(fallbackCalls, 0);
});

test("executor assertion failure remains FAIL", async () => {
  const db = mockPrisma();

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () =>
      validPlan(),

    executeVerificationPlan: async () =>
      executionResult("FAIL"),

    verifyCriterion: async () =>
      fallbackResult(),
  });

  const result =
    await runner.runCriterionVerification(
      makeInput()
    );

  assert.equal(result.planSource, "AI");
  assert.equal(result.result, "FAIL");
});

test("executor mechanism failure remains UNCERTAIN", async () => {
  const db = mockPrisma();

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () =>
      validPlan(),

    executeVerificationPlan: async () =>
      executionResult("UNCERTAIN"),

    verifyCriterion: async () =>
      fallbackResult(),
  });

  const result =
    await runner.runCriterionVerification(
      makeInput()
    );

  assert.equal(result.planSource, "AI");
  assert.equal(result.result, "UNCERTAIN");
});

test("missing evidence cannot become PASS", async () => {
  const db = mockPrisma();

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () =>
      validPlan(),

    executeVerificationPlan: async () => ({
      criterionId: CRITERION_ID,
      planVersion: 1 as const,
      evaluation: {
        criterionId: CRITERION_ID,
        result: "UNCERTAIN" as const,
        reason:
          "Required evidence is missing for step step-1",
        evidenceIds: [],
      },results: [
  {
    stepId: "step-1",
    status: "PASS",
    observedAt:
      "2026-09-04T10:00:00.000Z",
    evidenceIds: [],
  },
],
      evidence: [],
    }),

    verifyCriterion: async () =>
      fallbackResult(),
  });

  const result =
    await runner.runCriterionVerification(
      makeInput()
    );

  assert.notEqual(
    result.result,
    "PASS"
  );

  assert.equal(
    result.result,
    "UNCERTAIN"
  );
});

test("executor runtime failure propagates and does not silently fall back", async () => {
  const db = mockPrisma();

  let fallbackCalls = 0;

  const runner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () =>
      validPlan(),

    executeVerificationPlan: async () => {
      throw new Error(
        "Runtime host drift detected"
      );
    },

    verifyCriterion: async () => {
      fallbackCalls += 1;
      return fallbackResult();
    },
  });

  await assert.rejects(
    () =>
      runner.runCriterionVerification(
        makeInput()
      ),
    /Runtime host drift detected/
  );

  assert.equal(
    fallbackCalls,
    0
  );
});

test("AI and fallback both preserve deterministic criterion results", async () => {
  const db = mockPrisma();

  const aiRunner = createVerificationRunner({
    prisma: db,

    getAllowedApplicationOrigins: () => [
      ALLOWED_ORIGIN,
    ],

    generateVerificationPlan: async () =>
      validPlan(),

    executeVerificationPlan: async () =>
      executionResult("FAIL"),

    verifyCriterion: async () =>
      fallbackResult("FAIL"),
  });

  const fallbackRunner =
    createVerificationRunner({
      prisma: mockPrisma(),

      getAllowedApplicationOrigins: () => [
        ALLOWED_ORIGIN,
      ],

      generateVerificationPlan:
        async () => {
          throw new Error(
            "Planner unavailable"
          );
        },

      executeVerificationPlan:
        async () =>
          executionResult("PASS"),

      verifyCriterion: async () =>
        fallbackResult("FAIL"),
    });

  const aiResult =
    await aiRunner.runCriterionVerification(
      makeInput()
    );

  const fallbackResultValue =
    await fallbackRunner.runCriterionVerification(
      makeInput()
    );

  assert.equal(
    aiResult.result,
    "FAIL"
  );

  assert.equal(
    fallbackResultValue.result,
    "FAIL"
  );

  assert.equal(
    aiResult.planSource,
    "AI"
  );

  assert.equal(
    fallbackResultValue.planSource,
    "FALLBACK"
  );
});