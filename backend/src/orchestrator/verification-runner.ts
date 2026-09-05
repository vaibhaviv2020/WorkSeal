import prisma from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

import {
  DEMO_CRITERION_IDS,
} from "../lib/demo-catalog.js";

import {
  generateVerificationPlan,
} from "../modules/ai/ai-planner.js";

import {
  getAllowedApplicationOrigins,
  validateVerificationPlan,
  type ValidatedVerificationPlan,
  type VerificationPlan,
} from "../modules/ai/ai.schemas.js";

import {
  executeVerificationPlan,
  type PlanExecutionResult,
} from "../agent/verification-plan-executor.js";

import {
  verifyCriterion,
  type CriterionVerificationResult,
} from "../tools/browser/browser-verifier.js";

type PrismaClient = typeof prisma;

type GenerateVerificationPlan =
  typeof generateVerificationPlan;

type ExecuteVerificationPlan =
  typeof executeVerificationPlan;

type VerifyCriterion =
  typeof verifyCriterion;

export interface StoredVerificationPlan {
  version: 1;
  plan: VerificationPlan;
  validatedAt: string;
  criterionDescriptionSnapshot: string;
}

export interface VerificationRunnerDependencies {
  prisma?: PrismaClient;
  generateVerificationPlan?: GenerateVerificationPlan;
  executeVerificationPlan?: ExecuteVerificationPlan;
  verifyCriterion?: VerifyCriterion;
  getAllowedApplicationOrigins?: typeof getAllowedApplicationOrigins;
}

export interface RunCriterionVerificationInput {
  criterion: {
    id: string;
    description: string;
    aiInterpretation: unknown;
  };
  submission: {
    id: string;
    appUrl: string;
  };
  runId: string;
  taskId: string;
}

export interface RunnerEvidence {
  type:
    | "SCREENSHOT"
    | "TRACE"
    | "API_RESPONSE"
    | "LOG";
  path?: string;
  description: string;
}

export interface RunCriterionVerificationResult {
  criterionId: string;
  result: "PASS" | "FAIL" | "UNCERTAIN";
  reason: string;
  evidence: RunnerEvidence[];
  planSource: "AI" | "FALLBACK";
  planVersion?: 1;
}

function normalizeOrigin(
  appUrl: string
): string {
  const url = new URL(appUrl);

  return url.origin;
}

function assertSubmissionOrigin(
  applicationUrl: string,
  allowedOrigins: readonly string[]
): string {
  const origin =
    normalizeOrigin(applicationUrl);

  if (!allowedOrigins.includes(origin)) {
    throw new Error(
      "Submission application URL is not allowlisted"
    );
  }

  return origin;
}

function assertPlanTargetsSubmissionOrigin(
  plan: ValidatedVerificationPlan,
  submissionOrigin: string
): void {
  for (const step of plan.steps) {
    const action = step.action;

    if (
      action.type === "navigate" ||
      action.type === "request"
    ) {
      const targetOrigin =
        new URL(action.url).origin;

      if (targetOrigin !== submissionOrigin) {
        throw new Error(
          "Verification plan URL does not match the current submission origin"
        );
      }
    }
  }
}

function readStoredPlan(
  stored: unknown,
  criterionId: string,
  criterionDescription: string,
  allowedOrigins: readonly string[],
  submissionOrigin: string
): ValidatedVerificationPlan | null {
  if (
    typeof stored !== "object" ||
    stored === null
  ) {
    return null;
  }

  const candidate =
    stored as Record<string, unknown>;

  if (
    candidate.version !== 1 ||
    typeof candidate.validatedAt !== "string" ||
    typeof candidate.criterionDescriptionSnapshot !== "string" ||
    typeof candidate.plan !== "object" ||
    candidate.plan === null
  ) {
    return null;
  }

  if (
    candidate.criterionDescriptionSnapshot !==
    criterionDescription
  ) {
    return null;
  }

  try {
    const validated =
      validateVerificationPlan(
        candidate.plan,
        criterionId,
        [...allowedOrigins]
      );

    assertPlanTargetsSubmissionOrigin(
      validated,
      submissionOrigin
    );

    return validated;
  } catch {
    return null;
  }
}

function createStoredPlan(
  plan: ValidatedVerificationPlan,
  criterionDescription: string
): StoredVerificationPlan {
  return {
    version: 1,
    plan,
    validatedAt: new Date().toISOString(),
    criterionDescriptionSnapshot:
      criterionDescription,
  };
}

async function generateAndPersistPlan(
  input: RunCriterionVerificationInput,
  submissionOrigin: string,
  allowedOrigins: readonly string[],
  db: PrismaClient,
  generatePlan: GenerateVerificationPlan
): Promise<ValidatedVerificationPlan> {
  const candidate =
    await generatePlan({
      criterionId: input.criterion.id,
      criterionDescription:
        input.criterion.description,
      submissionId: input.submission.id,
      applicationUrl: submissionOrigin,
      capabilities: {
        browserActions: [],
        apiActions: [],
      },
      knownSelectors: {},
    });

  const validated =
    validateVerificationPlan(
      candidate,
      input.criterion.id,
      [...allowedOrigins]
    );

  if (
    validated.criterionId !==
    input.criterion.id
  ) {
    throw new Error(
      "Verification plan criterionId does not match current criterion"
    );
  }

  assertPlanTargetsSubmissionOrigin(
    validated,
    submissionOrigin
  );

  const stored =
    createStoredPlan(
      validated,
      input.criterion.description
    );

  await db.criterion.update({
    where: {
      id: input.criterion.id,
    },
    data: {
  aiInterpretation:
  stored as unknown as Prisma.InputJsonValue,
},
  });

  return validated;
}

function convertExecutionResult(
  result: PlanExecutionResult
): RunCriterionVerificationResult {
  return {
    criterionId: result.criterionId,
    result: result.evaluation.result,
    reason: result.evaluation.reason,
    evidence: result.evidence.map(
  (item) => ({
    type: item.type,
    path: item.path,
    description:
      typeof item.metadata?.description === "string"
        ? item.metadata.description
        : `${item.type} generated during deterministic execution`,
  })
),
    planSource: "AI",
    planVersion: result.planVersion,
  };
}

function fallbackResult(
  result: CriterionVerificationResult
): RunCriterionVerificationResult {
  return {
    criterionId: result.criterionId,
    result: result.result,
    reason: result.reason,
    evidence: result.evidence.map(
      (item) => ({
        type: item.type,
        path: item.path,
        description: item.description,
      })
    ),
    planSource: "FALLBACK",
  };
}

export function createVerificationRunner(
  dependencies: VerificationRunnerDependencies = {}
) {
  const db =
    dependencies.prisma ?? prisma;

  const generatePlan =
    dependencies.generateVerificationPlan ??
    generateVerificationPlan;

  const executePlan =
    dependencies.executeVerificationPlan ??
    executeVerificationPlan;

  const deterministicVerifier =
    dependencies.verifyCriterion ??
    verifyCriterion;

  const getAllowedOrigins =
    dependencies.getAllowedApplicationOrigins ??
    getAllowedApplicationOrigins;

  async function runCriterionVerification(
    input: RunCriterionVerificationInput
  ): Promise<RunCriterionVerificationResult> {
    const allowedOrigins =
      getAllowedOrigins();

    let submissionOrigin: string;

    try {
      submissionOrigin =
        assertSubmissionOrigin(
          input.submission.appUrl,
          allowedOrigins
        );
    } catch {
      /*
       * Do not fall back when the current submission itself
       * violates the application-origin security boundary.
       */
      throw new Error(
        "Current submission application URL is not allowlisted"
      );
    }

    if (
      input.criterion.id ===
      DEMO_CRITERION_IDS.CREATE_TICKET
    ) {
      return fallbackResult(
        await deterministicVerifier(
          input.criterion.id
        )
      );
    }

    let plan:
      | ValidatedVerificationPlan
      | null = null;

    /*
     * 1. Try to reuse a stored validated plan.
     *
     * Reuse is allowed only when:
     * - wrapper is valid
     * - criterion description is unchanged
     * - plan validates again
     * - plan targets the current submission origin
     */
    plan = readStoredPlan(
      input.criterion.aiInterpretation,
      input.criterion.id,
      input.criterion.description,
      allowedOrigins,
      submissionOrigin
    );

    /*
     * 2. Missing, stale, or invalid stored plan:
     *    generate exactly once.
     */
    if (!plan) {
      try {
        plan =
          await generateAndPersistPlan(
            input,
            submissionOrigin,
            allowedOrigins,
            db,
            generatePlan
          );
      } catch (error) {
        /*
         * Planner failure never reaches the executor.
         * The existing deterministic verifier remains
         * the fallback.
         */
        console.error(
          "AI verification planning failed; using deterministic fallback:",
          error
        );

        return fallbackResult(
          await deterministicVerifier(
            input.criterion.id
          )
        );
      }
    }

    /*
     * 3. Final validation immediately before execution.
     *
     * This is deliberately separate from the validation
     * performed when the plan was generated or loaded.
     */
        let finalPlan: ValidatedVerificationPlan;

    /*
     * Final validation immediately before execution.
     *
     * Validation failures may use the deterministic fallback.
     * Nothing has been executed at this point.
     */
    try {
      finalPlan = validateVerificationPlan(
        plan,
        input.criterion.id,
        [...allowedOrigins]
      );

      if (
        finalPlan.criterionId !==
        input.criterion.id
      ) {
        throw new Error(
          "Verification plan criterionId does not match current criterion"
        );
      }

      assertPlanTargetsSubmissionOrigin(
        finalPlan,
        submissionOrigin
      );
    } catch (error) {
      console.error(
        "AI verification plan rejected; using deterministic fallback:",
        error
      );

      return fallbackResult(
        await deterministicVerifier(
          input.criterion.id
        )
      );
    }

    /*
     * Execution is deliberately outside the validation
     * fallback boundary.
     *
     * Runtime execution failures, including live redirect/
     * host drift, must propagate to the existing execution
     * error handling rather than silently falling back.
     */
    const execution =
      await executePlan(
        finalPlan,
        {
          runId: input.runId,
          taskId: input.taskId,
          criterionId: input.criterion.id,
          allowedOrigins,
        }
      );

    return convertExecutionResult(
      execution
    );
  }
    return {
    runCriterionVerification,
  };
}

const verificationRunner =
  createVerificationRunner();

export const runCriterionVerification =
  verificationRunner.runCriterionVerification;