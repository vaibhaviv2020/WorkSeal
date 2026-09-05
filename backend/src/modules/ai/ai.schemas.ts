export type JsonScalar =
  | string
  | number
  | boolean
  | null;

export type TicketCreateBody = {
  subject: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
};

export type BrowserAction =
  | {
      type: "navigate";
      url: string;
    }
  | {
      type: "click";
      selector: string;
    }
  | {
      type: "fill";
      selector: string;
      value: string;
    }
  | {
      type: "select";
      selector: string;
      value: string;
    }
  | {
      type: "assertText";
      selector: string;
      expectedText: string;
    }
  | {
      type: "assertVisible";
      selector: string;
    }
  | {
      type: "screenshot";
      name?: string;
    };

export type ApiAction =
  | {
      type: "request";
      method: "GET" | "POST";
      url: string;
      body: TicketCreateBody | null;
    }
  | {
      type: "assertStatus";
      expectedStatus: number;
    }
  | {
      type: "assertJsonField";
      path: string;
      expectedValue: JsonScalar;
    };

export type VerificationTool = "BROWSER" | "API";

export type VerificationStep = {
  id: string;
  tool: VerificationTool;
  action: BrowserAction | ApiAction;
  expectedOutcome: string;
  evidenceType?:
    | "SCREENSHOT"
    | "TRACE"
    | "API_RESPONSE"
    | "LOG";
};

export type VerificationPlan = {
  version: 1;
  criterionId: string;
  goal: string;
  steps: VerificationStep[];
};

export type ValidatedVerificationPlan = VerificationPlan;

export type VerificationCapabilities = {
  browserActions: readonly string[];
  apiActions: readonly string[];
};

export type PageSelectorMap = Record<
  string,
  Record<string, string>
>;

export interface PlanningContext {
  criterionId: string;
  criterionDescription: string;
  submissionId: string;
  applicationUrl: string;
  capabilities: VerificationCapabilities;
  knownSelectors: PageSelectorMap;
}

export const BROWSER_ACTIONS = [
  "navigate",
  "click",
  "fill",
  "select",
  "assertText",
  "assertVisible",
  "screenshot",
] as const;

export const API_ACTIONS = [
  "request",
  "assertStatus",
  "assertJsonField",
] as const;

export const ALLOWED_TOOLS = [
  "BROWSER",
  "API",
] as const;

export const EVIDENCE_TYPES = [
  "SCREENSHOT",
  "TRACE",
  "API_RESPONSE",
  "LOG",
] as const;

const FORBIDDEN_CAPABILITIES = new Set([
  "SHELL",
  "TERMINAL",
  "COMMAND",
  "EXECUTE_JS",
  "EVAL",
  "EXECUTE_NODE",
  "ARBITRARY_CODE",
  "READ_FILE",
  "WRITE_FILE",
  "DELETE_FILE",
  "READ_ENV",
  "WRITE_ENV",
  "SQL",
  "DATABASE_QUERY",
  "DATABASE_WRITE",
  "CODE_MODIFY",
  "CRITERIA_MODIFY",
  "MILESTONE_MODIFY",
  "PAYMENT_CREATE",
  "PAYMENT_APPROVE",
  "PAYMENT_RELEASE",
  "SECRET_ACCESS",
  "NETWORK_DISCOVERY",
]);

const ALLOWED_CREDENTIAL_PLACEHOLDERS = new Set([
  "{{DEMO_USERNAME}}",
  "{{DEMO_PASSWORD}}",
]);

const MAX_STEPS = 20;
const MAX_DEPTH = 3;
const MAX_BODY_BYTES = 4096;
const MAX_EXPECTED_VALUE_BYTES = 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DOT_PATH_PATTERN =
  /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype ||
    prototype === null;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): boolean {
  const keys = Object.keys(value);

  return (
    keys.length === allowed.length &&
    keys.every((key) => allowed.includes(key))
  );
}

function serializedSize(value: unknown): number {
  return Buffer.byteLength(
    JSON.stringify(value),
    "utf8"
  );
}

function nestingDepth(value: unknown): number {
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return 1;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 1;
    }

    return (
      1 +
      Math.max(...value.map(nestingDepth))
    );
  }

  const values = Object.values(value);

  if (values.length === 0) {
    return 1;
  }

  return (
    1 +
    Math.max(...values.map(nestingDepth))
  );
}

function isJsonScalar(
  value: unknown
): value is JsonScalar {
  if (value === null) {
    return true;
  }

  if (typeof value === "string") {
    return true;
  }

  if (typeof value === "boolean") {
    return true;
  }

  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function validateLiteral(
  value: string,
  fieldName: string
): void {
  if (value.includes("{{")) {
    if (!ALLOWED_CREDENTIAL_PLACEHOLDERS.has(value)) {
      throw new Error(
        `${fieldName} contains an unsupported credential placeholder`
      );
    }

    return;
  }

  if (value.includes("}}")) {
    throw new Error(
      `${fieldName} contains an invalid template expression`
    );
  }
}

function validateUrl(
  value: string,
  allowedOrigins: readonly string[]
): void {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    throw new Error("Unsupported URL scheme");
  }

  if (
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      "URL credentials are not allowed"
    );
  }

  const origin = parsed.origin;

  if (!allowedOrigins.includes(origin)) {
    throw new Error(
      `URL origin is not allowlisted: ${origin}`
    );
  }
}

function validateTicketCreateBody(
  body: unknown
): asserts body is TicketCreateBody {
  if (!isPlainObject(body)) {
    throw new Error(
      "POST body must be a TicketCreateBody or null"
    );
  }

  if (
    !exactKeys(body, [
      "subject",
      "description",
      "priority",
    ])
  ) {
    throw new Error(
      "TicketCreateBody contains unknown fields"
    );
  }

  if (
    typeof body.subject !== "string" ||
    body.subject.trim() === ""
  ) {
    throw new Error(
      "TicketCreateBody.subject must be a non-empty string"
    );
  }

  if (
    typeof body.description !== "string" ||
    body.description.trim() === ""
  ) {
    throw new Error(
      "TicketCreateBody.description must be a non-empty string"
    );
  }

  if (
    body.priority !== "LOW" &&
    body.priority !== "MEDIUM" &&
    body.priority !== "HIGH"
  ) {
    throw new Error(
      "TicketCreateBody.priority is invalid"
    );
  }

  validateLiteral(
    body.subject,
    "TicketCreateBody.subject"
  );

  validateLiteral(
    body.description,
    "TicketCreateBody.description"
  );

  if (
    nestingDepth(body) > MAX_DEPTH
  ) {
    throw new Error(
      "request.body exceeds maximum nesting depth"
    );
  }

  if (
    serializedSize(body) > MAX_BODY_BYTES
  ) {
    throw new Error(
      "request.body exceeds maximum serialized size"
    );
  }
}

function validateBrowserAction(
  action: unknown,
  allowedOrigins: readonly string[]
): asserts action is BrowserAction {
  if (!isPlainObject(action)) {
    throw new Error(
      "Browser action must be an object"
    );
  }

  if (
    typeof action.type !== "string"
  ) {
    throw new Error(
      "Browser action type is required"
    );
  }

  switch (action.type) {
    case "navigate": {
      if (
        !exactKeys(action, [
          "type",
          "url",
        ])
      ) {
        throw new Error(
          "navigate contains unknown fields"
        );
      }

      if (
        typeof action.url !== "string" ||
        action.url.trim() === ""
      ) {
        throw new Error(
          "navigate.url must be a non-empty string"
        );
      }

      validateUrl(
        action.url,
        allowedOrigins
      );

      return;
    }

    case "click": {
      if (
        !exactKeys(action, [
          "type",
          "selector",
        ])
      ) {
        throw new Error(
          "click contains unknown fields"
        );
      }

      if (
        typeof action.selector !== "string" ||
        action.selector.trim() === ""
      ) {
        throw new Error(
          "click.selector must be a non-empty string"
        );
      }

      validateLiteral(
        action.selector,
        "click.selector"
      );

      return;
    }

    case "fill": {
      if (
        !exactKeys(action, [
          "type",
          "selector",
          "value",
        ])
      ) {
        throw new Error(
          "fill contains unknown fields"
        );
      }

      if (
        typeof action.selector !== "string" ||
        action.selector.trim() === ""
      ) {
        throw new Error(
          "fill.selector must be a non-empty string"
        );
      }

      if (
        typeof action.value !== "string"
      ) {
        throw new Error(
          "fill.value must be a string"
        );
      }

      validateLiteral(
        action.selector,
        "fill.selector"
      );

      validateLiteral(
        action.value,
        "fill.value"
      );

      return;
    }

    case "select": {
      if (
        !exactKeys(action, [
          "type",
          "selector",
          "value",
        ])
      ) {
        throw new Error(
          "select contains unknown fields"
        );
      }

      if (
        typeof action.selector !== "string" ||
        action.selector.trim() === ""
      ) {
        throw new Error(
          "select.selector must be a non-empty string"
        );
      }

      if (
        typeof action.value !== "string"
      ) {
        throw new Error(
          "select.value must be a string"
        );
      }

      validateLiteral(
        action.selector,
        "select.selector"
      );

      validateLiteral(
        action.value,
        "select.value"
      );

      return;
    }

    case "assertText": {
      if (
        !exactKeys(action, [
          "type",
          "selector",
          "expectedText",
        ])
      ) {
        throw new Error(
          "assertText contains unknown fields"
        );
      }

      if (
        typeof action.selector !== "string" ||
        action.selector.trim() === ""
      ) {
        throw new Error(
          "assertText.selector must be a non-empty string"
        );
      }

      if (
        typeof action.expectedText !== "string"
      ) {
        throw new Error(
          "assertText.expectedText must be a string"
        );
      }

      validateLiteral(
        action.selector,
        "assertText.selector"
      );

      validateLiteral(
        action.expectedText,
        "assertText.expectedText"
      );

      return;
    }

    case "assertVisible": {
      if (
        !exactKeys(action, [
          "type",
          "selector",
        ])
      ) {
        throw new Error(
          "assertVisible contains unknown fields"
        );
      }

      if (
        typeof action.selector !== "string" ||
        action.selector.trim() === ""
      ) {
        throw new Error(
          "assertVisible.selector must be a non-empty string"
        );
      }

      validateLiteral(
        action.selector,
        "assertVisible.selector"
      );

      return;
    }

    case "screenshot": {
      if (
        !exactKeys(action, [
          "type",
          "name",
        ])
      ) {
        throw new Error(
          "screenshot contains unknown fields"
        );
      }

      if (
        action.name !== undefined &&
        typeof action.name !== "string"
      ) {
        throw new Error(
          "screenshot.name must be a string"
        );
      }

      if (
        typeof action.name === "string"
      ) {
        validateLiteral(
          action.name,
          "screenshot.name"
        );
      }

      return;
    }

    default:
      throw new Error(
        `Unsupported browser action: ${action.type}`
      );
  }
}

function validateApiAction(
  action: unknown,
  allowedOrigins: readonly string[]
): asserts action is ApiAction {
  if (!isPlainObject(action)) {
    throw new Error(
      "API action must be an object"
    );
  }

  if (
    typeof action.type !== "string"
  ) {
    throw new Error(
      "API action type is required"
    );
  }

  switch (action.type) {
    case "request": {
      if (
        !exactKeys(action, [
          "type",
          "method",
          "url",
          "body",
        ])
      ) {
        throw new Error(
          "request contains unknown fields"
        );
      }

      if (
        action.method !== "GET" &&
        action.method !== "POST"
      ) {
        throw new Error(
          "Only GET and POST are allowed"
        );
      }

      if (
        typeof action.url !== "string" ||
        action.url.trim() === ""
      ) {
        throw new Error(
          "request.url must be a non-empty string"
        );
      }

      validateUrl(
        action.url,
        allowedOrigins
      );

      if (action.method === "GET") {
        if (action.body !== null) {
          throw new Error(
            "GET request body must be null"
          );
        }

        return;
      }

      if (action.body !== null) {
        validateTicketCreateBody(
          action.body
        );
      }

      return;
    }

    case "assertStatus": {
      if (
        !exactKeys(action, [
          "type",
          "expectedStatus",
        ])
      ) {
        throw new Error(
          "assertStatus contains unknown fields"
        );
      }

      if (
        typeof action.expectedStatus !== "number" ||
        !Number.isInteger(action.expectedStatus) ||
        action.expectedStatus < 100 ||
        action.expectedStatus > 599
      ) {
        throw new Error(
          "expectedStatus must be an integer HTTP status"
        );
      }

      return;
    }

    case "assertJsonField": {
      if (
        !exactKeys(action, [
          "type",
          "path",
          "expectedValue",
        ])
      ) {
        throw new Error(
          "assertJsonField contains unknown fields"
        );
      }

      if (
        typeof action.path !== "string" ||
        !DOT_PATH_PATTERN.test(action.path)
      ) {
        throw new Error(
          "assertJsonField.path must use dot notation only"
        );
      }

      if (
        !isJsonScalar(action.expectedValue)
      ) {
        throw new Error(
          "assertJsonField.expectedValue must be a JSON scalar"
        );
      }

      if (
        nestingDepth(action.expectedValue) > MAX_DEPTH
      ) {
        throw new Error(
          "expectedValue exceeds maximum nesting depth"
        );
      }

      if (
        serializedSize(action.expectedValue) >
        MAX_EXPECTED_VALUE_BYTES
      ) {
        throw new Error(
          "expectedValue exceeds maximum serialized size"
        );
      }

      return;
    }

    default:
      throw new Error(
        `Unsupported API action: ${action.type}`
      );
  }
}

function containsForbiddenCapability(
  value: unknown
): string | null {
  if (typeof value === "string") {
    const normalized =
      value.trim().toUpperCase();

    return FORBIDDEN_CAPABILITIES.has(normalized)
      ? normalized
      : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found =
        containsForbiddenCapability(item);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (isPlainObject(value)) {
    for (const item of Object.values(value)) {
      const found =
        containsForbiddenCapability(item);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

export function getAllowedApplicationOrigins(): string[] {
  const configured =
    process.env.WORKSEAL_ALLOWED_APPLICATION_ORIGINS;

  const origins = (
    configured ??
    "http://localhost:5174"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const normalized: string[] = [];

  for (const origin of origins) {
    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(
        `Invalid configured application origin: ${origin}`
      );
    }

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      throw new Error(
        `Unsupported configured origin scheme: ${origin}`
      );
    }

    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        `Configured application origin must be an origin: ${origin}`
      );
    }

    normalized.push(parsed.origin);
  }

  return [...new Set(normalized)];
}

export function validateVerificationPlan(
  value: unknown,
  requestedCriterionId?: string,
  allowedOrigins = getAllowedApplicationOrigins()
): ValidatedVerificationPlan {
  if (!isPlainObject(value)) {
    throw new Error(
      "VerificationPlan must be an object"
    );
  }

  if (
    !exactKeys(value, [
      "version",
      "criterionId",
      "goal",
      "steps",
    ])
  ) {
    throw new Error(
      "VerificationPlan contains unknown or missing fields"
    );
  }

  if (value.version !== 1) {
    throw new Error(
      "VerificationPlan.version must be 1"
    );
  }

  if (
    typeof value.criterionId !== "string" ||
    !UUID_PATTERN.test(value.criterionId)
  ) {
    throw new Error(
      "VerificationPlan.criterionId must be a valid UUID"
    );
  }

  if (
    requestedCriterionId !== undefined &&
    value.criterionId !== requestedCriterionId
  ) {
    throw new Error(
      "VerificationPlan.criterionId does not match requested criterion"
    );
  }

  if (
    typeof value.goal !== "string" ||
    value.goal.trim() === ""
  ) {
    throw new Error(
      "VerificationPlan.goal must be non-empty"
    );
  }

  if (
    !Array.isArray(value.steps) ||
    value.steps.length < 1 ||
    value.steps.length > MAX_STEPS
  ) {
    throw new Error(
      "VerificationPlan.steps must contain 1–20 steps"
    );
  }

  const stepIds = new Set<string>();

  for (const rawStep of value.steps) {
    if (!isPlainObject(rawStep)) {
      throw new Error(
        "VerificationStep must be an object"
      );
    }

    if (
  !exactKeys(rawStep, [
    "id",
    "tool",
    "action",
    "expectedOutcome",
  ]) &&
  !exactKeys(rawStep, [
    "id",
    "tool",
    "action",
    "expectedOutcome",
    "evidenceType",
  ])
) {
      throw new Error(
        "VerificationStep contains unknown or missing fields"
      );
    }

    if (
      typeof rawStep.id !== "string" ||
      rawStep.id.trim() === ""
    ) {
      throw new Error(
        "VerificationStep.id must be non-empty"
      );
    }

    if (stepIds.has(rawStep.id)) {
      throw new Error(
        `Duplicate step ID: ${rawStep.id}`
      );
    }

    stepIds.add(rawStep.id);

    if (
      typeof rawStep.tool !== "string" ||
      !ALLOWED_TOOLS.includes(
        rawStep.tool as typeof ALLOWED_TOOLS[number]
      )
    ) {
      throw new Error(
        `Unsupported verification tool: ${String(rawStep.tool)}`
      );
    }

    if (
      typeof rawStep.expectedOutcome !== "string" ||
      rawStep.expectedOutcome.trim() === ""
    ) {
      throw new Error(
        "VerificationStep.expectedOutcome must be non-empty"
      );
    }

    if (
      rawStep.evidenceType !== undefined &&
      !EVIDENCE_TYPES.includes(
        rawStep.evidenceType as typeof EVIDENCE_TYPES[number]
      )
    ) {
      throw new Error(
        `Unsupported evidence type: ${String(rawStep.evidenceType)}`
      );
    }

    const forbidden =
      containsForbiddenCapability(rawStep);

    if (forbidden) {
      throw new Error(
        `Forbidden capability detected: ${forbidden}`
      );
    }

    if (rawStep.tool === "BROWSER") {
      validateBrowserAction(
        rawStep.action,
        allowedOrigins
      );

      if (
        !BROWSER_ACTIONS.includes(
          (
            rawStep.action as {
              type: string;
            }
          ).type as typeof BROWSER_ACTIONS[number]
        )
      ) {
        throw new Error(
          "Browser action is not allowlisted"
        );
      }
    } else {
      validateApiAction(
        rawStep.action,
        allowedOrigins
      );

      if (
        !API_ACTIONS.includes(
          (
            rawStep.action as {
              type: string;
            }
          ).type as typeof API_ACTIONS[number]
        )
      ) {
        throw new Error(
          "API action is not allowlisted"
        );
      }
    }
  }

  return value as unknown as ValidatedVerificationPlan;
}

export const VERIFICATION_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: {
      type: "integer",
      const: 1,
    },
    criterionId: {
      type: "string",
    },
    goal: {
      type: "string",
    },
    steps: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              id: {
                type: "string",
              },
              tool: {
                 type: "string",
                const: "BROWSER",
              },
              action: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: {
                        type: "string",
                        const: "navigate",
                      },
                      url: {
                        type: "string",
                      },
                    },
                    required: [
                      "type",
                      "url",
                    ],
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: {
                        type: "string",
                        const: "click",
                      },
                      selector: {
                        type: "string",
                      },
                    },
                    required: [
                      "type",
                      "selector",
                    ],
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: {
                        type: "string",
                        const: "fill",
                      },
                      selector: {
                        type: "string",
                      },
                      value: {
                        type: "string",
                      },
                    },
                    required: [
                      "type",
                      "selector",
                      "value",
                    ],
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: {
                        type: "string",
                        const: "select",
                      },
                      selector: {
                        type: "string",
                      },
                      value: {
                        type: "string",
                      },
                    },
                    required: [
                      "type",
                      "selector",
                      "value",
                    ],
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: {
                        type: "string",
                        const: "assertText",
                      },
                      selector: {
                        type: "string",
                      },
                      expectedText: {
                        type: "string",
                      },
                    },
                    required: [
                      "type",
                      "selector",
                      "expectedText",
                    ],
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: {
                        type: "string",
                        const: "assertVisible",
                      },
                      selector: {
                        type: "string",
                      },
                    },
                    required: [
                      "type",
                      "selector",
                    ],
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: {
                        type: "string",
                        const: "screenshot",
                      },
                      name: {
  type: "string",
},
                    },
                    required: [
                      "type",
                      "name",
                    ],
                  },
                ],
              },
              expectedOutcome: {
                type: "string",
              },
              evidenceType: {
                anyOf: [
                  {
                    type: "string",
                    enum: [
                      "SCREENSHOT",
                      "TRACE",
                      "API_RESPONSE",
                      "LOG",
                    ],
                  },
                  {
                    type: "null",
                  },
                ],
              },
            },
            required: [
              "id",
              "tool",
              "action",
              "expectedOutcome",
              "evidenceType",
            ],
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              id: {
                type: "string",
              },
              tool: {
                type: "string",
                const: "API",
              },
              action: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: {
                        type: "string",
                        const: "request",
                      },
                      method: {
                        type: "string",
                        enum: [
                          "GET",
                          "POST",
                        ],
                      },
                      url: {
                        type: "string",
                      },
                      body: {
                        anyOf: [
                          {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              subject: {
                                type: "string",
                              },
                              description: {
                                type: "string",
                              },
                              priority: {
                                type: "string",
                                enum: [
                                  "LOW",
                                  "MEDIUM",
                                  "HIGH",
                                ],
                              },
                            },
                            required: [
                              "subject",
                              "description",
                              "priority",
                            ],
                          },
                          {
                            type: "null",
                          },
                        ],
                      },
                    },
                    required: [
                      "type",
                      "method",
                      "url",
                      "body",
                    ],
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: {
                        type: "string",
                        const: "assertStatus",
                      },
                      expectedStatus: {
                        type: "integer",
                      },
                    },
                    required: [
                      "type",
                      "expectedStatus",
                    ],
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: {
                        type: "string",
                        const: "assertJsonField",
                      },
                      path: {
                        type: "string",
                      },
                      expectedValue: {
                        anyOf: [
                          {
                            type: "string",
                          },
                          {
                            type: "number",
                          },
                          {
                            type: "boolean",
                          },
                          {
                            type: "null",
                          },
                        ],
                      },
                    },
                    required: [
                      "type",
                      "path",
                      "expectedValue",
                    ],
                  },
                ],
              },
              expectedOutcome: {
                type: "string",
              },
              evidenceType: {
  type: "string",
  enum: [
    "SCREENSHOT",
    "TRACE",
    "API_RESPONSE",
    "LOG",
  ],
},
            },
            required: [
              "id",
              "tool",
              "action",
              "expectedOutcome",
              "evidenceType",
            ],
          },
        ],
      },
    },
  },
  required: [
    "version",
    "criterionId",
    "goal",
    "steps",
  ],
} as const;