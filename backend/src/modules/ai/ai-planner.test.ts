import assert from "node:assert/strict";
import test from "node:test";

import {
  type VerificationPlan,
} from "./ai.schemas.js";

import {
  buildSafePlanningContext,
  generateVerificationPlan,
} from "./ai-planner.js";

const CRITERION_ID =
  "11111111-1111-4111-8111-111111111111";

const SUBMISSION_ID =
  "22222222-2222-4222-8222-222222222222";

const APPLICATION_URL =
  "http://localhost:5174";

const baseContext = {
  criterionId: CRITERION_ID,
  criterionDescription:
    "A user can create a support ticket.",
  submissionId: SUBMISSION_ID,
  applicationUrl: APPLICATION_URL,
  capabilities: {
    browserActions: [],
    apiActions: [],
  },
  knownSelectors: {},
};

type GeminiStep = {
  id: string;
  tool: "BROWSER" | "API";
  actionType:
    | "navigate"
    | "click"
    | "fill"
    | "select"
    | "assertText"
    | "assertVisible"
    | "screenshot"
    | "request"
    | "assertStatus"
    | "assertJsonField";
  params: Record<string, unknown>;
  expectedOutcome: string;
  evidenceType:
    | "SCREENSHOT"
    | "TRACE"
    | "API_RESPONSE"
    | "LOG";
};

type GeminiPlan = {
  version: 1;
  criterionId: string;
  goal: string;
  steps: GeminiStep[];
};

function validPlan(): VerificationPlan {
  return {
    version: 1,
    criterionId: CRITERION_ID,
    goal: "Verify ticket creation",
    steps: [
      {
        id: "step-1",
        tool: "BROWSER",
        action: {
          type: "navigate",
          url: APPLICATION_URL,
        },
        expectedOutcome:
          "The application opens successfully",
        evidenceType: "SCREENSHOT",
      },
    ],
  };
}

function validGeminiPlan(): GeminiPlan {
  return {
    version: 1,
    criterionId: CRITERION_ID,
    goal: "Verify ticket creation",
    steps: [
      {
        id: "step-1",
        tool: "BROWSER",
        actionType: "navigate",
        params: {
          url: APPLICATION_URL,
        },
        expectedOutcome:
          "The application opens successfully",
        evidenceType: "SCREENSHOT",
      },
    ],
  };
}

function fakeClient(
  outputText: string
) {
  return {
    models: {
      generateContent: async () => ({
        text: outputText,
      }),
    },
  } as any;
}

test(
  "buildSafePlanningContext strips unsafe caller capabilities",
  () => {
    const context =
      buildSafePlanningContext({
        ...baseContext,

        capabilities: {
          browserActions: [
            "navigate",
            "EXECUTE_JS",
            "SHELL",
          ],

          apiActions: [
            "request",
            "SQL",
          ],
        },

        knownSelectors: {
          malicious: {
            selector:
              "javascript:alert(1)",
          },
        },
      });

    assert.deepEqual(
      context.capabilities.browserActions,
      [
        "navigate",
        "click",
        "fill",
        "select",
        "assertText",
        "assertVisible",
        "screenshot",
      ]
    );

    assert.deepEqual(
      context.capabilities.apiActions,
      [
        "request",
        "assertStatus",
        "assertJsonField",
      ]
    );

    assert.deepEqual(
      context.knownSelectors,
      {
        login: {
          email: "#email",
          password: "#password",
          submit: "button[type='submit']",
        },

        ticket: {
          subject: "#subject",
          description: "#description",
          priority: "#priority",
          submit: "button[type='submit']",
        },
      }
    );
  }
);

test(
  "buildSafePlanningContext rejects missing criterionId",
  () => {
    assert.throws(
      () =>
        buildSafePlanningContext({
          ...baseContext,
          criterionId: "",
        }),
      /criterionId is required/
    );
  }
);

test(
  "buildSafePlanningContext rejects missing criterionDescription",
  () => {
    assert.throws(
      () =>
        buildSafePlanningContext({
          ...baseContext,
          criterionDescription: "",
        }),
      /criterionDescription is required/
    );
  }
);

test(
  "buildSafePlanningContext rejects missing submissionId",
  () => {
    assert.throws(
      () =>
        buildSafePlanningContext({
          ...baseContext,
          submissionId: "",
        }),
      /submissionId is required/
    );
  }
);

test(
  "buildSafePlanningContext rejects missing applicationUrl",
  () => {
    assert.throws(
      () =>
        buildSafePlanningContext({
          ...baseContext,
          applicationUrl: "",
        }),
      /applicationUrl is required/
    );
  }
);

test(
  "generateVerificationPlan accepts a valid structured response",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    const geminiPlan =
      validGeminiPlan();

    const plan =
      await generateVerificationPlan(
        baseContext,
        fakeClient(
          JSON.stringify(geminiPlan)
        )
      );

    assert.deepEqual(
      plan,
      validPlan()
    );
  }
);

test(
  "generateVerificationPlan rejects empty Gemini output",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    await assert.rejects(
      () =>
        generateVerificationPlan(
          baseContext,
          fakeClient("")
        ),
      /Gemini returned an empty planner response/
    );
  }
);

test(
  "generateVerificationPlan rejects invalid JSON",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    await assert.rejects(
      () =>
        generateVerificationPlan(
          baseContext,
          fakeClient(
            "not valid json"
          )
        ),
      /Gemini planner returned invalid JSON/
    );
  }
);

test(
  "generateVerificationPlan rejects mismatched criterionId",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    const plan =
      validGeminiPlan();

    plan.criterionId =
      "33333333-3333-4333-8333-333333333333";

    await assert.rejects(
      () =>
        generateVerificationPlan(
          baseContext,
          fakeClient(
            JSON.stringify(plan)
          )
        ),
      /does not match requested criterion/
    );
  }
);

test(
  "generateVerificationPlan rejects forbidden tools",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    const plan =
      validGeminiPlan();

    (
      plan.steps[0] as any
    ).tool = "SHELL";

    await assert.rejects(
      () =>
        generateVerificationPlan(
          baseContext,
          fakeClient(
            JSON.stringify(plan)
          )
        ),
      /unsupported verification tool/i
    );
  }
);

test(
  "generateVerificationPlan rejects non-allowlisted URLs",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    const plan =
      validGeminiPlan();

    plan.steps[0].params = {
      url:
        "https://evil.example.com",
    };

    await assert.rejects(
      () =>
        generateVerificationPlan(
          baseContext,
          fakeClient(
            JSON.stringify(plan)
          )
        ),
      /URL origin is not allowlisted/
    );
  }
);

test(
  "generateVerificationPlan rejects object expectedValue",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    const plan =
      validGeminiPlan();

    plan.steps[0] = {
      id: "step-1",
      tool: "API",
      actionType:
        "assertJsonField",

      params: {
        path: "status",
        expectedValue: {
          nested: true,
        },
      },

      expectedOutcome:
        "The status matches",

      evidenceType:
        "API_RESPONSE",
    };

    await assert.rejects(
      () =>
        generateVerificationPlan(
          baseContext,
          fakeClient(
            JSON.stringify(plan)
          )
        ),
      /expectedValue must be a JSON scalar/
    );
  }
);

test(
  "generateVerificationPlan rejects array expectedValue",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    const plan =
      validGeminiPlan();

    plan.steps[0] = {
      id: "step-1",
      tool: "API",
      actionType:
        "assertJsonField",

      params: {
        path: "status",
        expectedValue: [
          "OPEN",
        ],
      },

      expectedOutcome:
        "The status matches",

      evidenceType:
        "API_RESPONSE",
    };

    await assert.rejects(
      () =>
        generateVerificationPlan(
          baseContext,
          fakeClient(
            JSON.stringify(plan)
          )
        ),
      /expectedValue must be a JSON scalar/
    );
  }
);

test(
  "generateVerificationPlan rejects unauthorized credential placeholder",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    const plan =
      validGeminiPlan();

    plan.steps[0] = {
      id: "step-1",
      tool: "BROWSER",
      actionType: "fill",

      params: {
        selector: "#password",
        value: "{{REAL_PASSWORD}}",
      },

      expectedOutcome:
        "Password is entered",

      evidenceType:
        "SCREENSHOT",
    };

    await assert.rejects(
      () =>
        generateVerificationPlan(
          baseContext,
          fakeClient(
            JSON.stringify(plan)
          )
        ),
      /unsupported credential placeholder/i
    );
  }
);

test(
  "generateVerificationPlan accepts approved credential placeholders",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    const plan =
      validGeminiPlan();

    plan.steps[0] = {
      id: "step-1",
      tool: "BROWSER",
      actionType: "fill",

      params: {
        selector: "#password",
        value: "{{DEMO_PASSWORD}}",
      },

      expectedOutcome:
        "Demo password is entered",

      evidenceType:
        "SCREENSHOT",
    };

    const result =
      await generateVerificationPlan(
        baseContext,
        fakeClient(
          JSON.stringify(plan)
        )
      );

    assert.equal(
      result.steps[0].action.type,
      "fill"
    );

    assert.equal(
      (
        result.steps[0].action as any
      ).value,
      "{{DEMO_PASSWORD}}"
    );
  }
);

test(
  "generateVerificationPlan uses only safe planning context",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    let capturedInput = "";

    const client = {
      models: {
        generateContent:
          async (request: any) => {
            capturedInput =
              JSON.stringify(
                request
              );

            return {
              text: JSON.stringify(
                validGeminiPlan()
              ),
            };
          },
      },
    } as any;

    await generateVerificationPlan(
      baseContext,
      client
    );

    assert.ok(
      capturedInput.includes(
        "criterionId"
      )
    );

    assert.ok(
      capturedInput.includes(
        "criterionDescription"
      )
    );

    assert.ok(
      capturedInput.includes(
        "applicationUrl"
      )
    );

    assert.ok(
      !capturedInput.includes(
        "GEMINI_API_KEY"
      )
    );

    assert.ok(
      !capturedInput.includes(
        "OPENAI_API_KEY"
      )
    );

    assert.ok(
      !capturedInput.includes(
        "DATABASE_URL"
      )
    );

    assert.ok(
      !capturedInput.includes(
        "credentialsRef"
      )
    );
  }
);

test(
  "generateVerificationPlan binds the model to the known deterministic selectors",
  async () => {
    process.env.GEMINI_MODEL =
      "test-model";

    let capturedInput = "";

    const client = {
      models: {
        generateContent:
          async (request: any) => {
            capturedInput =
              JSON.stringify(
                request
              );

            return {
              text: JSON.stringify(
                validGeminiPlan()
              ),
            };
          },
      },
    } as any;

    await generateVerificationPlan(
      baseContext,
      client
    );

    assert.ok(
      capturedInput.includes(
        "#email"
      )
    );

    assert.ok(
      capturedInput.includes(
        "#subject"
      )
    );

    assert.ok(
      capturedInput.includes(
        "button[type='submit']"
      )
    );

    assert.ok(
      !capturedInput.includes(
        "#username"
      )
    );

    assert.ok(
      !capturedInput.includes(
        "#login-submit"
      )
    );

    assert.ok(
      !capturedInput.includes(
        "/login"
      )
    );
  }
);