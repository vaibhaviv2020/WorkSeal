import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";

import {
  createBrowserSession,
  closeBrowserSession,
} from "./browser-executor.js";

const APP_URL = "http://localhost:5174";
const DEMO_EMAIL = "demo@workseal.test";

const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  "data",
  "evidence"
);

export type CriterionResult = "PASS" | "FAIL" | "UNCERTAIN";

export interface VerificationEvidence {
  type: "SCREENSHOT" | "LOG";
  path?: string;
  description: string;
}

export interface CriterionVerificationResult {
  criterionId: string;
  result: CriterionResult;
  reason: string;
  evidence: VerificationEvidence[];
}

async function ensureEvidenceDirectory(): Promise<void> {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
}

async function captureScreenshot(
  page: Page,
  criterionId: string,
  name: string
): Promise<string> {
  await ensureEvidenceDirectory();

  const filename = `${criterionId}-${name}-${Date.now()}.png`;

  const screenshotPath = path.join(
    EVIDENCE_DIR,
    filename
  );

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });

  return screenshotPath;
}

function getDemoPassword(): string {
  const password = process.env.DEMO_PASSWORD;

  if (!password) {
    throw new Error("DEMO_PASSWORD is not defined");
  }

  return password;
}

async function login(page: Page): Promise<{
  success: boolean;
  reason?: string;
}> {
  try {
    await page.goto(APP_URL, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const emailInput = page.locator(
      'input[type="email"]'
    );

    const passwordInput = page.locator(
      'input[type="password"]'
    );

    await emailInput.waitFor({
      state: "visible",
      timeout: 5000,
    });

    await emailInput.fill(DEMO_EMAIL);
    await passwordInput.fill(getDemoPassword());

    await page
      .getByRole("button", {
        name: /^login$/i,
      })
      .click();

    await page
      .getByRole("heading", {
        name: /^dashboard$/i,
      })
      .waitFor({
        state: "visible",
        timeout: 5000,
      });

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      reason:
        error instanceof Error
          ? error.message
          : "Unknown login error",
    };
  }
}

async function verifyLogin(
  page: Page,
  criterionId: string
): Promise<CriterionVerificationResult> {
  const evidence: VerificationEvidence[] = [];

  try {
    const result = await login(page);

    const screenshotPath = await captureScreenshot(
      page,
      criterionId,
      result.success ? "pass" : "fail"
    );

    evidence.push({
      type: "SCREENSHOT",
      path: screenshotPath,
      description: result.success
        ? "Authenticated dashboard after valid login"
        : "Login state after attempted valid login",
    });

    if (!result.success) {
      return {
        criterionId,
        result: "FAIL",
        reason:
          result.reason ??
          "Valid credentials did not authenticate the user",
        evidence,
      };
    }

    return {
      criterionId,
      result: "PASS",
      reason:
        "Valid demo credentials successfully opened the authenticated dashboard",
      evidence,
    };
  } catch (error) {
    return {
      criterionId,
      result: "UNCERTAIN",
      reason:
        error instanceof Error
          ? error.message
          : "Unable to reliably verify login",
      evidence,
    };
  }
}

async function verifyDashboard(
  page: Page,
  criterionId: string
): Promise<CriterionVerificationResult> {
  const evidence: VerificationEvidence[] = [];

  try {
    const loginResult = await login(page);

    if (!loginResult.success) {
      return {
        criterionId,
        result: "FAIL",
        reason: `Dashboard could not be tested because login failed: ${loginResult.reason}`,
        evidence,
      };
    }

    await page
      .getByRole("heading", {
        name: /^open$/i,
      })
      .waitFor({
        state: "visible",
        timeout: 5000,
      });

    await page
      .getByRole("heading", {
        name: /^in progress$/i,
      })
      .waitFor({
        state: "visible",
        timeout: 5000,
      });

    await page
      .getByRole("heading", {
        name: /^resolved$/i,
      })
      .waitFor({
        state: "visible",
        timeout: 5000,
      });

    const screenshotPath = await captureScreenshot(
      page,
      criterionId,
      "pass"
    );

    evidence.push({
      type: "SCREENSHOT",
      path: screenshotPath,
      description:
        "Authenticated dashboard displaying ticket status counts",
    });

    return {
      criterionId,
      result: "PASS",
      reason:
        "Authenticated dashboard loaded and displayed Open, In Progress, and Resolved ticket counts",
      evidence,
    };
  } catch (error) {
    return {
      criterionId,
      result: "FAIL",
      reason:
        error instanceof Error
          ? `Dashboard verification failed: ${error.message}`
          : "Dashboard verification failed",
      evidence,
    };
  }
}

async function verifyCreateTicket(
  page: Page,
  criterionId: string
): Promise<CriterionVerificationResult> {
  const evidence: VerificationEvidence[] = [];

  try {
    const loginResult = await login(page);

    if (!loginResult.success) {
      return {
        criterionId,
        result: "FAIL",
        reason: `Create-ticket test could not start because login failed: ${loginResult.reason}`,
        evidence,
      };
    }

    const subject = `Workseal Verification ${Date.now()}`;
    const description =
      "Automated deterministic verification ticket.";

    const subjectInput = page.locator("#subject");
    const descriptionInput = page.locator("#description");
    const prioritySelect = page.locator("#priority");

    await subjectInput.waitFor({
      state: "visible",
      timeout: 5000,
    });

    await descriptionInput.waitFor({
      state: "visible",
      timeout: 5000,
    });

    await prioritySelect.waitFor({
      state: "visible",
      timeout: 5000,
    });

    await subjectInput.fill(subject);
    await descriptionInput.fill(description);
    await prioritySelect.selectOption("HIGH");

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/tickets") &&
        response.request().method() === "POST"
    );

    await page
      .getByRole("button", {
        name: /^create ticket$/i,
      })
      .click();

    const response = await responsePromise;
    const status = response.status();

    let responseBody: {
      ticket?: {
        id: number;
        subject: string;
      };
      error?: string;
    } = {};

    try {
      responseBody = await response.json();
    } catch {
      responseBody = {};
    }

    if (status === 201 && responseBody.ticket) {
      const screenshotPath = await captureScreenshot(
        page,
        criterionId,
        "pass"
      );

      evidence.push({
        type: "SCREENSHOT",
        path: screenshotPath,
        description:
          "Ticket creation succeeded and the application returned the created ticket",
      });

      return {
        criterionId,
        result: "PASS",
        reason:
          `Create-ticket API returned HTTP 201 and created ticket ${responseBody.ticket.id}`,
        evidence,
      };
    }

    if (status === 500) {
      const screenshotPath = await captureScreenshot(
        page,
        criterionId,
        "fail"
      );

      evidence.push({
        type: "SCREENSHOT",
        path: screenshotPath,
        description:
          "Create-ticket operation failed with the application's HTTP 500 response",
      });

      return {
        criterionId,
        result: "FAIL",
        reason:
          `Create-ticket API returned HTTP 500: ${
            responseBody.error ?? "Internal server error"
          }`,
        evidence,
      };
    }

    const screenshotPath = await captureScreenshot(
      page,
      criterionId,
      "fail"
    );

    evidence.push({
      type: "SCREENSHOT",
      path: screenshotPath,
      description:
        `Create-ticket operation returned unexpected HTTP status ${status}`,
    });

    return {
      criterionId,
      result: "FAIL",
      reason:
        `Create-ticket API returned unexpected HTTP status ${status}`,
      evidence,
    };
  } catch (error) {
    return {
      criterionId,
      result: "FAIL",
      reason:
        error instanceof Error
          ? `Create-ticket verification failed: ${error.message}`
          : "Create-ticket verification failed",
      evidence,
    };
  }
}

async function verifyTicketHistory(
  page: Page,
  criterionId: string
): Promise<CriterionVerificationResult> {
  const evidence: VerificationEvidence[] = [];

  try {
    const loginResult = await login(page);

    if (!loginResult.success) {
      return {
        criterionId,
        result: "FAIL",
        reason: `Ticket history could not be tested because login failed: ${loginResult.reason}`,
        evidence,
      };
    }

    await page
      .getByRole("heading", {
        name: /ticket history/i,
      })
      .waitFor({
        state: "visible",
        timeout: 5000,
      });

    await page
      .getByRole("button", {
        name: "Unable to login",
        exact: true,
      })
      .waitFor({
        state: "visible",
        timeout: 5000,
      });

    const screenshotPath = await captureScreenshot(
      page,
      criterionId,
      "pass"
    );

    evidence.push({
      type: "SCREENSHOT",
      path: screenshotPath,
      description:
        "Ticket history displaying seeded ticket data for the authenticated user",
    });

    return {
      criterionId,
      result: "PASS",
      reason:
        "Authenticated user can access ticket history and seeded ticket data is displayed",
      evidence,
    };
  } catch (error) {
    return {
      criterionId,
      result: "FAIL",
      reason:
        error instanceof Error
          ? `Ticket history verification failed: ${error.message}`
          : "Ticket history verification failed",
      evidence,
    };
  }
}

async function verifyTicketDetails(
  page: Page,
  criterionId: string
): Promise<CriterionVerificationResult> {
  const evidence: VerificationEvidence[] = [];

  try {
    const loginResult = await login(page);

    if (!loginResult.success) {
      return {
        criterionId,
        result: "FAIL",
        reason: `Ticket details could not be tested because login failed: ${loginResult.reason}`,
        evidence,
      };
    }

    const ticketButton = page.getByRole("button", {
      name: "Unable to login",
      exact: true,
    });

    await ticketButton.waitFor({
      state: "visible",
      timeout: 5000,
    });

    await ticketButton.click();

    await page
      .getByRole("heading", {
        name: /ticket details/i,
      })
      .waitFor({
        state: "visible",
        timeout: 5000,
      });

    const statusVisible = await page
      .getByText(/open/i)
      .last()
      .isVisible()
      .catch(() => false);

    const screenshotPath = await captureScreenshot(
      page,
      criterionId,
      statusVisible ? "pass" : "fail"
    );

    evidence.push({
      type: "SCREENSHOT",
      path: screenshotPath,
      description:
        "Ticket details modal showing ticket information and current status",
    });

    if (!statusVisible) {
      return {
        criterionId,
        result: "FAIL",
        reason:
          "Ticket details opened, but the current ticket status could not be verified",
        evidence,
      };
    }

    return {
      criterionId,
      result: "PASS",
      reason:
        "Authenticated user opened a ticket and viewed its details and current status",
      evidence,
    };
  } catch (error) {
    return {
      criterionId,
      result: "FAIL",
      reason:
        error instanceof Error
          ? `Ticket details verification failed: ${error.message}`
          : "Ticket details verification failed",
      evidence,
    };
  }
}

async function verifyLogout(
  page: Page,
  criterionId: string
): Promise<CriterionVerificationResult> {
  const evidence: VerificationEvidence[] = [];

  try {
    const loginResult = await login(page);

    if (!loginResult.success) {
      return {
        criterionId,
        result: "FAIL",
        reason: `Logout could not be tested because login failed: ${loginResult.reason}`,
        evidence,
      };
    }

    await page
      .getByRole("button", {
        name: /logout/i,
      })
      .click();

    await page
      .locator('input[type="email"]')
      .waitFor({
        state: "visible",
        timeout: 5000,
      });

    const screenshotPath = await captureScreenshot(
      page,
      criterionId,
      "pass"
    );

    evidence.push({
      type: "SCREENSHOT",
      path: screenshotPath,
      description:
        "Login screen displayed after successful logout",
    });

    return {
      criterionId,
      result: "PASS",
      reason:
        "User successfully logged out and was returned to the login screen",
      evidence,
    };
  } catch (error) {
    return {
      criterionId,
      result: "FAIL",
      reason:
        error instanceof Error
          ? `Logout verification failed: ${error.message}`
          : "Logout verification failed",
      evidence,
    };
  }
}

export async function verifyCriterion(
  criterionId: string
): Promise<CriterionVerificationResult> {
  const session = await createBrowserSession();

  try {
    switch (criterionId) {
      case "1e474e00-11c7-4fbf-8489-fef57a30904a":
        return await verifyLogin(
          session.page,
          criterionId
        );

      case "3c03635e-745e-491c-b727-505604d92c97":
        return await verifyDashboard(
          session.page,
          criterionId
        );

      case "4b72a86f-c932-4de4-8492-c75eee6606ab":
        return await verifyCreateTicket(
          session.page,
          criterionId
        );

      case "fd2dc7ae-0fe4-4e07-a488-2bad9c9e7856":
        return await verifyTicketHistory(
          session.page,
          criterionId
        );

      case "7bd5abcd-bf83-49dc-8c7b-899244d80960":
        return await verifyTicketDetails(
          session.page,
          criterionId
        );

      case "66550107-a060-414d-b392-92821957bee3":
        return await verifyLogout(
          session.page,
          criterionId
        );

      default:
        return {
          criterionId,
          result: "UNCERTAIN",
          reason:
            "No deterministic verifier exists for this criterion",
          evidence: [],
        };
    }
  } finally {
    await closeBrowserSession(session);
  }
}

export async function verifyAllCriteria(
  criterionIds: string[]
): Promise<CriterionVerificationResult[]> {
  const results: CriterionVerificationResult[] = [];

  for (const criterionId of criterionIds) {
    const result = await verifyCriterion(
      criterionId
    );

    results.push(result);
  }

  return results;
}