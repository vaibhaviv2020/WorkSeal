import test from "node:test";
import assert from "node:assert/strict";

import {
  type VerificationPlan,
  validateVerificationPlan,
} from "./ai.schemas.js";

const criterionId =
  "1e474e00-11c7-4fbf-8489-fef57a30904a";

const allowedOrigin =
  "http://localhost:5174";

function validPlan(): VerificationPlan {
  return {
    version: 1,
    criterionId,
    goal: "Verify the criterion",
    steps: [
      {
        id: "step-1",
        tool: "BROWSER",
        action: {
          type: "navigate",
          url: allowedOrigin,
        },
        expectedOutcome:
          "Application opens",
      },
    ],
  };
}

test("accepts a valid plan", () => {
  const plan =
    validateVerificationPlan(
      validPlan(),
      criterionId
    );

  assert.equal(
    plan.criterionId,
    criterionId
  );
});

test("rejects missing criterionId", () => {
  const plan = validPlan();

  delete (
    plan as Record<string, unknown>
  ).criterionId;

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects mismatched criterionId", () => {
  const plan = validPlan();

  plan.criterionId =
    "3c03635e-745e-491c-b727-505604d92c97";

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects unknown tool", () => {
  const plan = validPlan();

  plan.steps[0].tool =
    "SHELL" as never;

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects forbidden action", () => {
  const plan = validPlan();

  plan.steps[0] = {
    id: "step-1",
    tool: "BROWSER",
    action: {
      type: "executeJs",
      code: "process.exit()",
    } as never,
    expectedOutcome:
      "Code executes",
  };

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects non-allowlisted host", () => {
  const plan = validPlan();

  (
    plan.steps[0].action as {
      url: string;
    }
  ).url = "https://example.com";

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects GET body", () => {
  const plan = validPlan();

  plan.steps[0] = {
    id: "step-1",
    tool: "API",
    action: {
      type: "request",
      method: "GET",
      url: allowedOrigin,
      body: {
        subject: "x",
        description: "y",
        priority: "LOW",
      },
    },
    expectedOutcome:
      "Request succeeds",
  };

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("accepts POST with TicketCreateBody", () => {
  const plan = validPlan();

  plan.steps[0] = {
    id: "step-1",
    tool: "API",
    action: {
      type: "request",
      method: "POST",
      url: `${allowedOrigin}/api/tickets`,
      body: {
        subject: "Test ticket",
        description: "Test description",
        priority: "HIGH",
      },
    },
    expectedOutcome:
      "Ticket is created",
  };

  const result =
    validateVerificationPlan(
      plan,
      criterionId
    );

  assert.equal(
    result.steps[0].tool,
    "API"
  );
});

test("rejects extra TicketCreateBody field", () => {
  const plan = validPlan();

  plan.steps[0] = {
    id: "step-1",
    tool: "API",
    action: {
      type: "request",
      method: "POST",
      url: `${allowedOrigin}/api/tickets`,
      body: {
        subject: "Test",
        description: "Test",
        priority: "HIGH",
        admin: true,
      } as never,
    },
    expectedOutcome:
      "Ticket is created",
  };

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects invalid ticket priority", () => {
  const plan = validPlan();

  plan.steps[0] = {
    id: "step-1",
    tool: "API",
    action: {
      type: "request",
      method: "POST",
      url: `${allowedOrigin}/api/tickets`,
      body: {
        subject: "Test",
        description: "Test",
        priority: "URGENT",
      } as never,
    },
    expectedOutcome:
      "Ticket is created",
  };

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("accepts scalar expectedValue", () => {
  const plan = validPlan();

  plan.steps[0] = {
    id: "step-1",
    tool: "API",
    action: {
      type: "assertJsonField",
      path: "data.ticket.id",
      expectedValue: "123",
    },
    expectedOutcome:
      "Ticket ID matches",
  };

  assert.doesNotThrow(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects object expectedValue", () => {
  const plan = validPlan();

  plan.steps[0] = {
    id: "step-1",
    tool: "API",
    action: {
      type: "assertJsonField",
      path: "data.ticket",
      expectedValue: {
        id: "123",
      },
    } as never,
    expectedOutcome:
      "Ticket matches",
  };

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects array expectedValue", () => {
  const plan = validPlan();

  plan.steps[0] = {
    id: "step-1",
    tool: "API",
    action: {
      type: "assertJsonField",
      path: "data.items",
      expectedValue: ["x"],
    } as never,
    expectedOutcome:
      "Items match",
  };

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects non-dot-notation JSON path", () => {
  const plan = validPlan();

  plan.steps[0] = {
    id: "step-1",
    tool: "API",
    action: {
      type: "assertJsonField",
      path: "data.items[*]",
      expectedValue: "x",
    },
    expectedOutcome:
      "Field matches",
  };

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects duplicate step IDs", () => {
  const plan = validPlan();

  plan.steps.push({
    id: "step-1",
    tool: "BROWSER",
    action: {
      type: "screenshot",
    },
    expectedOutcome:
      "Evidence captured",
  });

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects more than 20 steps", () => {
  const plan = validPlan();

  plan.steps = Array.from(
    { length: 21 },
    (_, index) => ({
      id: `step-${index + 1}`,
      tool: "BROWSER" as const,
      action: {
        type: "screenshot" as const,
      },
      expectedOutcome:
        "Evidence captured",
    })
  );

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("rejects arbitrary credential placeholders", () => {
  const plan = validPlan();

  plan.steps[0] = {
    id: "step-1",
    tool: "BROWSER",
    action: {
      type: "fill",
      selector: "#password",
      value: "{{DATABASE_PASSWORD}}",
    },
    expectedOutcome:
      "Credential entered",
  };

  assert.throws(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});

test("allows only approved credential placeholders", () => {
  const plan = validPlan();

  plan.steps[0] = {
    id: "step-1",
    tool: "BROWSER",
    action: {
      type: "fill",
      selector: "#password",
      value: "{{DEMO_PASSWORD}}",
    },
    expectedOutcome:
      "Demo password entered",
  };

  assert.doesNotThrow(() =>
    validateVerificationPlan(
      plan,
      criterionId
    )
  );
});