export type VerificationResult = "PASS" | "FAIL" | "UNCERTAIN";

export type MilestoneDecision =
  | "READY_FOR_APPROVAL"
  | "NOT_READY"
  | "REVIEW_REQUIRED";

export interface CriterionDecisionInput {
  result: VerificationResult;
  blocking: boolean;
}

export function determineMilestoneDecision(
  criteria: CriterionDecisionInput[]
): MilestoneDecision {
  const hasBlockingFailure = criteria.some(
    (criterion) =>
      criterion.blocking && criterion.result === "FAIL"
  );

  if (hasBlockingFailure) {
    return "NOT_READY";
  }

  const hasUncertain = criteria.some(
    (criterion) => criterion.result === "UNCERTAIN"
  );

  if (hasUncertain) {
    return "REVIEW_REQUIRED";
  }

  const allPassed = criteria.every(
    (criterion) => criterion.result === "PASS"
  );

  if (allPassed) {
    return "READY_FOR_APPROVAL";
  }

  return "REVIEW_REQUIRED";
}