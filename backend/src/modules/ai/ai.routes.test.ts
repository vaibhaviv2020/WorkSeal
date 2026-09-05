import assert from "node:assert/strict";
import test from "node:test";

import {
  createAIRouter,
} from "./ai.routes.js";

const CRITERION_ID =
  "11111111-1111-4111-8111-111111111111";

const MILESTONE_ID =
  "22222222-2222-4222-8222-222222222222";

const SUBMISSION_ID =
  "33333333-3333-4333-8333-333333333333";

const APPLICATION_URL =
  "http://localhost:5174";

function validPlan() {
  return {
    version: 1 as const,
    criterionId: CRITERION_ID,
    goal: "Verify the criterion",
    steps: [
      {
        id: "step-1",
        tool: "BROWSER" as const,
        action: {
          type: "navigate" as const,
          url: APPLICATION_URL,
        },
        expectedOutcome:
          "The application opens",
        evidenceType:
          "SCREENSHOT" as const,
      },
    ],
  };
}

function createResponseRecorder() {
  let statusCode = 200;
  let body: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },

    json(value: unknown) {
      body = value;
      return response;
    },
  };

  return {
    response,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

function createRequest(
  criterionId?: string
) {
  return {
    params:
      criterionId === undefined
        ? {}
        : { criterionId },
  };
}

async function invokeRoute(
  router: any,
  req: any,
  res: any
) {
  const layer =
    router.stack.find(
      (item: any) =>
        item.route?.path ===
        "/criteria/:criterionId/plan"
    );

  assert.ok(
    layer,
    "AI planning route was not registered"
  );

  const handler =
    layer.route.stack[0].handle;

  await handler(req, res);
}
async function invokeGetPlanRoute(
  router: any,
  req: any,
  res: any
) {
  const layer = router.stack.find(
    (item: any) =>
      item.route?.path ===
        "/criteria/:criterionId/plan" &&
      item.route.methods?.get
  );

  assert.ok(
    layer,
    "AI plan GET route was not registered"
  );

  const handler =
    layer.route.stack[0].handle;

  await handler(req, res);
}
function fakePrisma({
  criterion,
  milestone,
  updateCriterion,
}: {
  criterion?: any;
  milestone?: any;
  updateCriterion?: (args: any) => Promise<any>;
} = {}) {
  return {
    criterion: {
      findUnique: async () =>
        criterion ?? null,

      update:
        updateCriterion ??
        (async () => null),
    },

    milestone: {
      findUnique: async () =>
        milestone ?? null,
    },
  } as any;
}

test("POST planning route returns a validated plan", async () => {
  process.env.WORKSEAL_ALLOWED_APPLICATION_ORIGINS =
    APPLICATION_URL;

  const plan = validPlan();

  const router =
    createAIRouter({
      prisma: fakePrisma({
        criterion: {
          id: CRITERION_ID,
          milestoneId: MILESTONE_ID,
          description:
            "A user can create a support ticket.",
        },
        milestone: {
          id: MILESTONE_ID,
          submissions: [
            {
              id: SUBMISSION_ID,
              version: 1,
              appUrl:
                `${APPLICATION_URL}/`,
            },
          ],
        },
      }),
      generateVerificationPlan:
        async (context) => {
          assert.equal(
            context.criterionId,
            CRITERION_ID
          );

          assert.equal(
            context.criterionDescription,
            "A user can create a support ticket."
          );

          assert.equal(
            context.submissionId,
            SUBMISSION_ID
          );

          assert.equal(
            context.applicationUrl,
            APPLICATION_URL
          );

          return plan;
        },
    });

  const {
    response,
    getStatus,
    getBody,
  } =
    createResponseRecorder();

  await invokeRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(
    getStatus(),
    200
  );

  assert.deepEqual(
    getBody(),
    { plan }
  );
});
test("planning route persists the validated plan in criterion aiInterpretation", async () => {
  process.env.WORKSEAL_ALLOWED_APPLICATION_ORIGINS =
    APPLICATION_URL;

  const plan = validPlan();

  let updateArgs: any;

  const router = createAIRouter({
    prisma: fakePrisma({
      criterion: {
        id: CRITERION_ID,
        milestoneId: MILESTONE_ID,
        description:
          "A user can create a support ticket.",
      },

      milestone: {
        id: MILESTONE_ID,
        submissions: [
          {
            id: SUBMISSION_ID,
            version: 1,
            appUrl: `${APPLICATION_URL}/`,
          },
        ],
      },

      updateCriterion: async (args) => {
        updateArgs = args;
        return {
          id: CRITERION_ID,
          aiInterpretation: plan,
        };
      },
    }),

    generateVerificationPlan: async () => plan,
  });

  const {
    response,
    getStatus,
    getBody,
  } = createResponseRecorder();

  await invokeRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(getStatus(), 200);

  assert.deepEqual(
    getBody(),
    { plan }
  );

  assert.deepEqual(
    updateArgs,
    {
      where: {
        id: CRITERION_ID,
      },
      data: {
        aiInterpretation: plan,
      },
    }
  );
});

test("GET plan retrieves and re-validates the stored plan", async () => {
  const plan = validPlan();

  const router = createAIRouter({
    prisma: fakePrisma({
      criterion: {
        id: CRITERION_ID,
        milestoneId: MILESTONE_ID,
        description:
          "A user can create a support ticket.",
        aiInterpretation: plan,
      },
    }),
  });

  const {
    response,
    getStatus,
    getBody,
  } = createResponseRecorder();

  await invokeGetPlanRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(getStatus(), 200);
  assert.deepEqual(getBody(), { plan });
});

test("GET plan rejects a corrupted stored plan", async () => {
  const corruptedPlan = validPlan();

  corruptedPlan.steps[0].tool =
    "SHELL" as never;

  const router = createAIRouter({
    prisma: fakePrisma({
      criterion: {
        id: CRITERION_ID,
        milestoneId: MILESTONE_ID,
        description:
          "A user can create a support ticket.",
        aiInterpretation: corruptedPlan,
      },
    }),
  });

  const {
    response,
    getStatus,
    getBody,
  } = createResponseRecorder();

  await invokeGetPlanRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(getStatus(), 400);
  assert.equal(
  (getBody() as any).error,
  "Unsupported verification tool: SHELL"
);
});

test("GET plan rejects a stored plan belonging to another criterion", async () => {
  const storedPlan = validPlan();

  storedPlan.criterionId =
    "44444444-4444-4444-8444-444444444444";

  const router = createAIRouter({
    prisma: fakePrisma({
      criterion: {
        id: CRITERION_ID,
        milestoneId: MILESTONE_ID,
        description:
          "A user can create a support ticket.",
        aiInterpretation: storedPlan,
      },
    }),
  });

  const {
    response,
    getStatus,
    getBody,
  } = createResponseRecorder();

  await invokeGetPlanRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(getStatus(), 400);
  assert.equal(
  (getBody() as any).error,
  "VerificationPlan.criterionId does not match requested criterion"
);
});
test("GET plan returns 404 when no stored plan exists", async () => {
  const router = createAIRouter({
    prisma: fakePrisma({
      criterion: {
        id: CRITERION_ID,
        milestoneId: MILESTONE_ID,
        description:
          "A user can create a support ticket.",
        aiInterpretation: null,
      },
    }),
  });

  const {
    response,
    getStatus,
    getBody,
  } = createResponseRecorder();

  await invokeGetPlanRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(getStatus(), 404);
  assert.equal(
    (getBody() as any).error,
    "No validated plan exists for this criterion"
  );
});



test("planning route rejects missing criterionId", async () => {
  const router =
    createAIRouter({
      prisma: fakePrisma(),
    });

  const {
    response,
    getStatus,
    getBody,
  } =
    createResponseRecorder();

  await invokeRoute(
    router,
    createRequest(),
    response
  );

  assert.equal(
    getStatus(),
    400
  );

  assert.deepEqual(
    getBody(),
    {
      error:
        "criterionId is required",
    }
  );
});

test("planning route returns 404 for unknown criterion", async () => {
  const router =
    createAIRouter({
      prisma: fakePrisma({
        criterion: undefined,
      }),
    });

  const {
    response,
    getStatus,
    getBody,
  } =
    createResponseRecorder();

  await invokeRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(
    getStatus(),
    404
  );

  assert.deepEqual(
    getBody(),
    {
      error:
        "Criterion not found",
    }
  );
});

test("planning route returns 404 when milestone is missing", async () => {
  const router =
    createAIRouter({
      prisma: fakePrisma({
        criterion: {
          id: CRITERION_ID,
          milestoneId: MILESTONE_ID,
          description:
            "A user can create a support ticket.",
        },
        milestone: undefined,
      }),
    });

  const {
    response,
    getStatus,
    getBody,
  } =
    createResponseRecorder();

  await invokeRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(
    getStatus(),
    404
  );

  assert.deepEqual(
    getBody(),
    {
      error:
        "Milestone not found",
    }
  );
});

test("planning route returns 400 when no submission exists", async () => {
  const router =
    createAIRouter({
      prisma: fakePrisma({
        criterion: {
          id: CRITERION_ID,
          milestoneId: MILESTONE_ID,
          description:
            "A user can create a support ticket.",
        },
        milestone: {
          id: MILESTONE_ID,
          submissions: [],
        },
      }),
    });

  const {
    response,
    getStatus,
    getBody,
  } =
    createResponseRecorder();

  await invokeRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(
    getStatus(),
    400
  );

  assert.deepEqual(
    getBody(),
    {
      error:
        "No submission exists for this milestone",
    }
  );
});

test("planning route rejects non-allowlisted submission URL", async () => {
  process.env.WORKSEAL_ALLOWED_APPLICATION_ORIGINS =
    APPLICATION_URL;

  const router =
    createAIRouter({
      prisma: fakePrisma({
        criterion: {
          id: CRITERION_ID,
          milestoneId: MILESTONE_ID,
          description:
            "A user can create a support ticket.",
        },
        milestone: {
          id: MILESTONE_ID,
          submissions: [
            {
              id: SUBMISSION_ID,
              version: 1,
              appUrl:
                "https://evil.example.com/",
            },
          ],
        },
      }),
      generateVerificationPlan:
        async () => {
          throw new Error(
            "Planner should not be called"
          );
        },
    });

  const {
    response,
    getStatus,
    getBody,
  } =
    createResponseRecorder();

  await invokeRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(
    getStatus(),
    400
  );

  assert.deepEqual(
    getBody(),
    {
      error:
        "Submission application URL is not allowlisted",
    }
  );
});

test("planning route passes only the normalized application origin to planner", async () => {
  process.env.WORKSEAL_ALLOWED_APPLICATION_ORIGINS =
    APPLICATION_URL;

  let receivedUrl = "";

  const router =
    createAIRouter({
      prisma: fakePrisma({
        criterion: {
          id: CRITERION_ID,
          milestoneId: MILESTONE_ID,
          description:
            "A user can create a support ticket.",
        },
        milestone: {
          id: MILESTONE_ID,
          submissions: [
            {
              id: SUBMISSION_ID,
              version: 1,
              appUrl:
                `${APPLICATION_URL}/some/path?x=1`,
            },
          ],
        },
      }),
      generateVerificationPlan:
        async (context) => {
          receivedUrl =
            context.applicationUrl;

          return validPlan();
        },
    });

  const {
    response,
  } =
    createResponseRecorder();

  await invokeRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(
    receivedUrl,
    APPLICATION_URL
  );
});

test("planning route converts planner errors into HTTP 400", async () => {
  process.env.WORKSEAL_ALLOWED_APPLICATION_ORIGINS =
    APPLICATION_URL;

  const router =
    createAIRouter({
      prisma: fakePrisma({
        criterion: {
          id: CRITERION_ID,
          milestoneId: MILESTONE_ID,
          description:
            "A user can create a support ticket.",
        },
        milestone: {
          id: MILESTONE_ID,
          submissions: [
            {
              id: SUBMISSION_ID,
              version: 1,
              appUrl:
                APPLICATION_URL,
            },
          ],
        },
      }),
      generateVerificationPlan:
        async () => {
          throw new Error(
            "Planner rejected output"
          );
        },
    });

  const {
    response,
    getStatus,
    getBody,
  } =
    createResponseRecorder();

  await invokeRoute(
    router,
    createRequest(CRITERION_ID),
    response
  );

  assert.equal(
    getStatus(),
    400
  );

  assert.deepEqual(
    getBody(),
    {
      error:
        "Planner rejected output",
    }
  );
});