import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  closeBrowserSession,
  createBrowserSession,
  type BrowserSession,
} from "../tools/browser/browser-executor.js";
import {
  getAllowedApplicationOrigins,
  validateVerificationPlan,
  type ApiAction,
  type BrowserAction,
  type ValidatedVerificationPlan,
  type VerificationStep,
} from "../modules/ai/ai.schemas.js";

export interface ExecutionResult {
  stepId: string;
  status: "PASS" | "FAIL" | "ERROR" | "TIMEOUT";
  observedAt: string;
  observation?: unknown;
  evidenceIds: string[];
  error?: { type: string; message: string };
}

export interface CriterionEvaluation {
  criterionId: string;
  result: "PASS" | "FAIL" | "UNCERTAIN";
  reason: string;
  evidenceIds: string[];
}

export interface EvidenceReference {
  id: string;
  runId: string;
  taskId: string;
  criterionId: string;
  type: "SCREENSHOT" | "TRACE" | "API_RESPONSE" | "LOG";
  path: string;
  metadata?: Record<string, unknown>;
}

export interface PlanExecutionResult {
  criterionId: string;
  planVersion: 1;
  results: ExecutionResult[];
  evidence: EvidenceReference[];
  evaluation: CriterionEvaluation;
}

export interface CredentialResolver {
  resolve(name: "DEMO_USERNAME" | "DEMO_PASSWORD"): string;
}

export interface ExecuteVerificationPlanOptions {
  runId: string;
  taskId: string;
  criterionId: string;
  allowedOrigins?: readonly string[];
  evidenceDirectory?: string;
  credentialResolver?: CredentialResolver;
  maxAttempts?: number;
  timeoutMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

const ASSERTION_ACTIONS = new Set([
  "assertText",
  "assertVisible",
  "assertStatus",
  "assertJsonField",
]);

const RETRYABLE_BROWSER_ACTIONS = new Set([
  "navigate",
  "click",
  "fill",
  "select",
  "screenshot",
]);

class AssertionFailure extends Error {
  readonly code = "ASSERTION_FAILURE";
}

class RuntimeHostDrift extends Error {
  readonly code = "HOST_DRIFT";
}

function newId(): string {
  return crypto.randomUUID();
}

function evidencePath(directory: string, type: string): string {
  const extension =
    type === "screenshot"
      ? ".png"
      : type === "trace"
        ? ".zip"
        : ".json";

  return path.join(
    directory,
    `${newId()}-${type.toLowerCase()}${extension}`
  );
}
function defaultCredentialResolver(): CredentialResolver {
  return {
    resolve(name) {
      const value = process.env[name];
      if (!value) throw new Error(`${name} is not configured`);
      return value;
    },
  };
}

function resolveCredential(
  value: string,
  resolver: CredentialResolver
): string {
  if (value === "{{DEMO_USERNAME}}") {
    return resolver.resolve("DEMO_USERNAME");
  }
  if (value === "{{DEMO_PASSWORD}}") {
    return resolver.resolve("DEMO_PASSWORD");
  }
  return value;
}

function resolveBody(
  body: Record<string, unknown>,
  resolver: CredentialResolver
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      typeof value === "string"
        ? resolveCredential(value, resolver)
        : value,
    ])
  );
}

function assertAllowedRuntimeUrl(
  value: string,
  allowedOrigins: readonly string[]
): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new RuntimeHostDrift("Invalid runtime URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new RuntimeHostDrift("Unsupported runtime URL scheme");
  }
  if (parsed.username || parsed.password) {
    throw new RuntimeHostDrift("Runtime URL credentials are not allowed");
  }
  if (!allowedOrigins.includes(parsed.origin)) {
    throw new RuntimeHostDrift(
      `Runtime URL origin is not allowlisted: ${parsed.origin}`
    );
  }
  return parsed;
}

function installRuntimeOriginGuard(
  session: BrowserSession,
  allowedOrigins: readonly string[]
): void {
  void session.context.route("**/*", async (route) => {
    try {
      assertAllowedRuntimeUrl(route.request().url(), allowedOrigins);
      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });
}

function isRetryable(step: VerificationStep): boolean {
  if (step.tool === "BROWSER") {
    return RETRYABLE_BROWSER_ACTIONS.has(step.action.type);
  }
  return (
    step.tool === "API" &&
    step.action.type === "request" &&
    step.action.method === "GET"
  );
}

function failureStatus(error: unknown): ExecutionResult["status"] {
  if (error instanceof AssertionFailure) return "FAIL";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("timeout") || message.includes("timed out")
    ? "TIMEOUT"
    : "ERROR";
}

async function createEvidence(
  directory: string,
  type: EvidenceReference["type"],
  content: string | Buffer,
  base: Omit<EvidenceReference, "id" | "type" | "path">,
  metadata?: Record<string, unknown>
): Promise<EvidenceReference> {
  await fs.mkdir(directory, { recursive: true });
  const filePath = evidencePath(directory, type);
  await fs.writeFile(filePath, content);
  return {
    id: newId(),
    ...base,
    type,
    path: filePath,
    ...(metadata ? { metadata } : {}),
  };
}

async function executeBrowserStep(
  session: BrowserSession,
  step: VerificationStep,
  allowedOrigins: readonly string[],
  credentials: CredentialResolver,
  evidenceDirectory: string,
  base: Omit<EvidenceReference, "id" | "type" | "path">,
  evidence: EvidenceReference[],
  timeoutMs: number
): Promise<{ observation: unknown; evidenceIds: string[] }> {
  const action = step.action as BrowserAction;
  const evidenceIds: string[] = [];
  const page = session.page;

  switch (action.type) {
    case "navigate":
      assertAllowedRuntimeUrl(action.url, allowedOrigins);
      await page.goto(action.url, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      assertAllowedRuntimeUrl(page.url(), allowedOrigins);
      break;

    case "click":
      await page.locator(action.selector).click({ timeout: timeoutMs });
      assertAllowedRuntimeUrl(page.url(), allowedOrigins);
      break;

    case "fill":
      await page.locator(action.selector).fill(
        resolveCredential(action.value, credentials),
        { timeout: timeoutMs }
      );
      assertAllowedRuntimeUrl(page.url(), allowedOrigins);
      break;

    case "select":
      await page.locator(action.selector).selectOption(action.value, {
        timeout: timeoutMs,
      });
      assertAllowedRuntimeUrl(page.url(), allowedOrigins);
      break;

    case "assertText": {
  const actual = await page.locator(action.selector).innerText({
    timeout: timeoutMs,
  });

  if (actual !== action.expectedText) {
    throw new AssertionFailure(
      `Text assertion failed: expected ${JSON.stringify(action.expectedText)}, received ${JSON.stringify(actual)}`
    );
  }

  if (step.evidenceType === "SCREENSHOT") {
    await fs.mkdir(evidenceDirectory, { recursive: true });
    const filePath = evidencePath(evidenceDirectory, "screenshot");

    await page.screenshot({
      path: filePath,
      fullPage: true,
    });

    const item: EvidenceReference = {
      id: newId(),
      ...base,
      type: "SCREENSHOT",
      path: filePath,
    };

    evidence.push(item);
    evidenceIds.push(item.id);
  }

  return {
    observation: { selector: action.selector, text: actual },
    evidenceIds,
  };
}

    case "assertVisible": {
  const visible = await page.locator(action.selector).isVisible();

  if (!visible) {
    throw new AssertionFailure(
      `Visibility assertion failed for selector ${action.selector}`
    );
  }

  if (step.evidenceType === "SCREENSHOT") {
    await fs.mkdir(evidenceDirectory, { recursive: true });
    const filePath = evidencePath(evidenceDirectory, "screenshot");

    await page.screenshot({
      path: filePath,
      fullPage: true,
    });

    const item: EvidenceReference = {
      id: newId(),
      ...base,
      type: "SCREENSHOT",
      path: filePath,
    };

    evidence.push(item);
    evidenceIds.push(item.id);
  }

  return {
    observation: { selector: action.selector, visible: true },
    evidenceIds,
  };
}

    case "screenshot": {
      await fs.mkdir(evidenceDirectory, { recursive: true });
      const filePath = evidencePath(evidenceDirectory, "screenshot");
      await page.screenshot({ path: filePath, fullPage: true });
      const item: EvidenceReference = {
        id: newId(),
        ...base,
        type: "SCREENSHOT",
        path: filePath,
        metadata: { displayName: action.name ?? null },
      };
      evidence.push(item);
      evidenceIds.push(item.id);
      break;
    }
  }

  if (step.evidenceType === "SCREENSHOT" && evidenceIds.length === 0) {
    await fs.mkdir(evidenceDirectory, { recursive: true });
    const filePath = evidencePath(evidenceDirectory, "screenshot");
    await page.screenshot({ path: filePath, fullPage: true });
    const item: EvidenceReference = {
      id: newId(),
      ...base,
      type: "SCREENSHOT",
      path: filePath,
    };
    evidence.push(item);
    evidenceIds.push(item.id);
  }

  return {
    observation: { url: page.url() },
    evidenceIds,
  };
}

interface ApiObservation {
  url: string;
  status: number;
  body: unknown;
}

async function requestApi(
  action: Extract<ApiAction, { type: "request" }>,
  allowedOrigins: readonly string[],
  credentials: CredentialResolver,
  timeoutMs: number
): Promise<ApiObservation> {
  let currentUrl = action.url;
  let redirects = 0;

  while (true) {
    assertAllowedRuntimeUrl(currentUrl, allowedOrigins);

    const requestBody =
      action.body === null
        ? undefined
        : JSON.stringify(resolveBody(action.body, credentials));

    const response = await fetch(currentUrl, {
      method: action.method,
      body: requestBody,
      redirect: "manual",
      headers: requestBody
        ? { "content-type": "application/json" }
        : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const responseUrl = response.url || currentUrl;
    assertAllowedRuntimeUrl(responseUrl, allowedOrigins);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return { url: responseUrl, status: response.status, body: null };
      }
      if (redirects >= MAX_REDIRECTS) {
        throw new Error("Maximum redirect count exceeded");
      }
      const nextUrl = new URL(location, currentUrl).toString();
      assertAllowedRuntimeUrl(nextUrl, allowedOrigins);
      currentUrl = nextUrl;
      redirects += 1;
      continue;
    }

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    return { url: responseUrl, status: response.status, body };
  }
}

async function executeApiStep(
  step: VerificationStep,
  allowedOrigins: readonly string[],
  credentials: CredentialResolver,
  evidenceDirectory: string,
  base: Omit<EvidenceReference, "id" | "type" | "path">,
  evidence: EvidenceReference[],
  lastApi: { value?: ApiObservation },
  timeoutMs: number
): Promise<{ observation: unknown; evidenceIds: string[] }> {
  const action = step.action as ApiAction;
  const evidenceIds: string[] = [];

  switch (action.type) {
    case "request": {
      const observation = await requestApi(
        action,
        allowedOrigins,
        credentials,
        timeoutMs
      );
      lastApi.value = observation;
      const item = await createEvidence(
        evidenceDirectory,
        "API_RESPONSE",
        JSON.stringify(observation, null, 2),
        base,
        { url: observation.url, status: observation.status }
      );
      evidence.push(item);
      evidenceIds.push(item.id);
      return { observation, evidenceIds };
    }

    case "assertStatus": {
      const observation = lastApi.value;
      if (!observation) {
        throw new AssertionFailure(
          "assertStatus has no preceding API request"
        );
      }
      if (observation.status !== action.expectedStatus) {
        throw new AssertionFailure(
          `Status assertion failed: expected ${action.expectedStatus}, received ${observation.status}`
        );
      }
      return { observation: { status: observation.status }, evidenceIds };
    }

    case "assertJsonField": {
      const observation = lastApi.value;
      if (!observation) {
        throw new AssertionFailure(
          "assertJsonField has no preceding API request"
        );
      }

      let current: unknown = observation.body;
      for (const part of action.path.split(".")) {
        if (
          typeof current !== "object" ||
          current === null ||
          !(part in current)
        ) {
          throw new AssertionFailure(
            `JSON field assertion failed: ${action.path} is missing`
          );
        }
        current = (current as Record<string, unknown>)[part];
      }

      if (current !== action.expectedValue) {
        throw new AssertionFailure(
          `JSON field assertion failed: expected ${JSON.stringify(action.expectedValue)}, received ${JSON.stringify(current)}`
        );
      }

      return {
        observation: { path: action.path, value: current },
        evidenceIds,
      };
    }
  }
}

export function evaluateVerificationPlan(
  criterionId: string,
  plan: ValidatedVerificationPlan,
  results: ExecutionResult[],
  evidence: EvidenceReference[]
): CriterionEvaluation {
  const evidenceIds = evidence.map((item) => item.id);

  for (const result of results) {
    const step = plan.steps.find((item) => item.id === result.stepId);
    if (!step) {
      return {
        criterionId,
        result: "UNCERTAIN",
        reason: "Execution result references an unknown step",
        evidenceIds,
      };
    }

    if (
      ASSERTION_ACTIONS.has(step.action.type) &&
      result.status === "FAIL"
    ) {
      return {
        criterionId,
        result: "FAIL",
        reason:
          result.error?.message ?? "Deterministic assertion failed",
        evidenceIds,
      };
    }
  }

  if (
    results.some(
      (result) =>
        result.status === "ERROR" || result.status === "TIMEOUT"
    )
  ) {
    return {
      criterionId,
      result: "UNCERTAIN",
      reason: "Execution mechanism failed or timed out",
      evidenceIds,
    };
  }

  if (results.length !== plan.steps.length) {
    return {
      criterionId,
      result: "UNCERTAIN",
      reason: "Plan execution did not complete all steps",
      evidenceIds,
    };
  }

  for (const step of plan.steps) {
    if (!step.evidenceType) continue;
    const result = results.find((item) => item.stepId === step.id);
    if (!result) {
      return {
        criterionId,
        result: "UNCERTAIN",
        reason: `Required evidence is missing for step ${step.id}`,
        evidenceIds,
      };
    }
    const found = result.evidenceIds.some((id) =>
      evidence.some(
        (item) => item.id === id && item.type === step.evidenceType
      )
    );
    if (!found) {
      return {
        criterionId,
        result: "UNCERTAIN",
        reason: `Required ${step.evidenceType} evidence is missing for step ${step.id}`,
        evidenceIds,
      };
    }
  }

  return {
    criterionId,
    result: "PASS",
    reason:
      "All deterministic assertions passed and required evidence is present",
    evidenceIds,
  };
}

export async function executeVerificationPlan(
  candidatePlan: unknown,
  options: ExecuteVerificationPlanOptions
): Promise<PlanExecutionResult> {
  const allowedOrigins =
    options.allowedOrigins ?? getAllowedApplicationOrigins();

  // Defense-in-depth: the executor validates at its own boundary and never
  // trusts a TypeScript cast as proof that a plan was validated.
  const plan = validateVerificationPlan(
    candidatePlan,
    options.criterionId,
    [...allowedOrigins]
  );

  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 2
  ) {
    throw new Error("maxAttempts must be 1 or 2");
  }

  const evidenceDirectory =
    options.evidenceDirectory ??
    path.resolve(process.cwd(), "data", "evidence");
  const credentials =
    options.credentialResolver ?? defaultCredentialResolver();

  const results: ExecutionResult[] = [];
  const evidence: EvidenceReference[] = [];
  const lastApi: { value?: ApiObservation } = {};
  let session: BrowserSession | undefined;
  let runtimeGuardInstalled = false;
  let tracingStarted = false;

  try {
    for (const step of plan.steps) {
      const attempts = isRetryable(step) ? maxAttempts : 1;
      let finalResult: ExecutionResult | undefined;

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const observedAt = new Date().toISOString();
        try {
          let execution: { observation: unknown; evidenceIds: string[] };

          if (step.tool === "BROWSER") {
            session ??= await createBrowserSession();
            if (!runtimeGuardInstalled) {
              installRuntimeOriginGuard(session, allowedOrigins);
              runtimeGuardInstalled = true;
            }
            if (
              !tracingStarted &&
              plan.steps.some((item) => item.evidenceType === "TRACE")
            ) {
              await session.context.tracing.start({
                screenshots: true,
                snapshots: true,
              });
              tracingStarted = true;
            }
            execution = await executeBrowserStep(
              session,
              step,
              allowedOrigins,
              credentials,
              evidenceDirectory,
              {
                runId: options.runId,
                taskId: options.taskId,
                criterionId: options.criterionId,
              },
              evidence,
              timeoutMs
            );
          } else {
            execution = await executeApiStep(
              step,
              allowedOrigins,
              credentials,
              evidenceDirectory,
              {
                runId: options.runId,
                taskId: options.taskId,
                criterionId: options.criterionId,
              },
              evidence,
              lastApi,
              timeoutMs
            );
          }

          finalResult = {
            stepId: step.id,
            status: "PASS",
            observedAt,
            observation: execution.observation,
            evidenceIds: execution.evidenceIds,
          };
          break;
        } catch (error) {
          const status = failureStatus(error);
          finalResult = {
            stepId: step.id,
            status,
            observedAt,
            evidenceIds: [],
            error: {
              type:
                error instanceof AssertionFailure
                  ? error.code
                  : error instanceof RuntimeHostDrift
                    ? error.code
                    : "EXECUTION_ERROR",
              message:
                error instanceof Error
                  ? error.message
                  : "Unknown execution error",
            },
          };

          if (status === "FAIL" || attempt === attempts) break;
        }
      }

      if (!finalResult) {
        throw new Error(`No execution result for step ${step.id}`);
      }

      results.push(finalResult);

      if (
        finalResult.status === "FAIL" ||
        finalResult.status === "ERROR" ||
        finalResult.status === "TIMEOUT"
      ) {
        break;
      }
    }

    if (session && tracingStarted) {
      const tracePath = evidencePath(evidenceDirectory, "trace");
      await fs.mkdir(evidenceDirectory, { recursive: true });
      await session.context.tracing.stop({ path: tracePath });
      tracingStarted = false;
      const item: EvidenceReference = {
        id: newId(),
        runId: options.runId,
        taskId: options.taskId,
        criterionId: options.criterionId,
        type: "TRACE",
        path: tracePath,
      };
      evidence.push(item);
      for (const step of plan.steps) {
        if (step.evidenceType !== "TRACE") continue;
        const result = results.find((item) => item.stepId === step.id);
        if (result) result.evidenceIds.push(item.id);
      }
    }

    if (plan.steps.some((step) => step.evidenceType === "LOG")) {
      const logPath = evidencePath(evidenceDirectory, "log");
      await fs.mkdir(evidenceDirectory, { recursive: true });
      await fs.writeFile(logPath, JSON.stringify(results, null, 2));
      const item: EvidenceReference = {
        id: newId(),
        runId: options.runId,
        taskId: options.taskId,
        criterionId: options.criterionId,
        type: "LOG",
        path: logPath,
      };
      evidence.push(item);
      for (const step of plan.steps) {
        if (step.evidenceType !== "LOG") continue;
        const result = results.find((entry) => entry.stepId === step.id);
        if (result) result.evidenceIds.push(item.id);
      }
    }

    return {
      criterionId: options.criterionId,
      planVersion: plan.version,
      results,
      evidence,
      evaluation: evaluateVerificationPlan(
        options.criterionId,
        plan,
        results,
        evidence
      ),
    };
  } finally {
    if (session) await closeBrowserSession(session);
  }
}
