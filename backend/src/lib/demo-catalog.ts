import {
  validateVerificationPlan,
  type ValidatedVerificationPlan,
} from "../modules/ai/ai.schemas.js";

export const DEMO_ALLOWED_ORIGIN =
  "http://localhost:5174";

export const DEMO_CRITERION_IDS = {
  LOGIN: "1e474e00-11c7-4fbf-8489-fef57a30904a",
  DASHBOARD: "3c03635e-745e-491c-b727-505604d92c97",
  CREATE_TICKET: "4b72a86f-c932-4de4-8492-c75eee6606ab",
  TICKET_HISTORY: "fd2dc7ae-0fe4-4e07-a488-2bad9c9e7856",
  TICKET_DETAILS: "7bd5abcd-bf83-49dc-8c7b-899244d80960",
  LOGOUT: "66550107-a060-414d-b392-92821957bee3",
} as const;

export type DemoCatalogEntry = {
  criterionId: string;
  description: string;
  plan: ValidatedVerificationPlan;
};

export type StoredDemoCatalogPlan = {
  version: 1;
  plan: ValidatedVerificationPlan;
  validatedAt: string;
  criterionDescriptionSnapshot: string;
};

function makeValidatedPlan(
  criterionId: string,
  goal: string,
  steps: ValidatedVerificationPlan["steps"]
): ValidatedVerificationPlan {
  return validateVerificationPlan(
    {
      version: 1,
      criterionId,
      goal,
      steps,
    },
    criterionId,
    [DEMO_ALLOWED_ORIGIN]
  );
}

export const DEMO_CATALOG: DemoCatalogEntry[] = [
  {
    criterionId: DEMO_CRITERION_IDS.LOGIN,
    description:
      "User can log in with valid demo credentials.",
    plan: makeValidatedPlan(
      DEMO_CRITERION_IDS.LOGIN,
      "Verify the user can log in and reach the dashboard.",
      [
        {
          id: "login-page-load",
          tool: "BROWSER",
          action: {
            type: "navigate",
            url: DEMO_ALLOWED_ORIGIN,
          },
          expectedOutcome:
            "The login page is visible and ready for credentials.",
        },
        {
          id: "login-fill-email",
          tool: "BROWSER",
          action: {
            type: "fill",
            selector: 'input[type="email"]',
            value: "{{DEMO_USERNAME}}",
          },
          expectedOutcome:
            "The email field contains the demo account username.",
        },
        {
          id: "login-fill-password",
          tool: "BROWSER",
          action: {
            type: "fill",
            selector: 'input[type="password"]',
            value: "{{DEMO_PASSWORD}}",
          },
          expectedOutcome:
            "The password field contains the demo account password.",
        },
        {
          id: "login-click",
          tool: "BROWSER",
          action: {
            type: "click",
            selector: 'button:has-text("Login")',
          },
          expectedOutcome:
            "The login button submits the credentials.",
        },
        {
          id: "login-dashboard-heading",
          tool: "BROWSER",
          action: {
            type: "assertText",
            selector: ".dashboard-intro h1",
            expectedText: "Dashboard",
          },
          expectedOutcome:
            "The authenticated dashboard heading is visible after login.",
        },
      ]
    ),
  },
  {
    criterionId: DEMO_CRITERION_IDS.DASHBOARD,
    description:
      "User can view the authenticated dashboard and the three ticket status groups.",
    plan: makeValidatedPlan(
      DEMO_CRITERION_IDS.DASHBOARD,
      "Verify the dashboard shows the canonical ticket statuses.",
      [
        {
          id: "dashboard-navigate",
          tool: "BROWSER",
          action: {
            type: "navigate",
            url: DEMO_ALLOWED_ORIGIN,
          },
          expectedOutcome:
            "The application is opened for an authenticated session.",
        },
        {
          id: "dashboard-fill-email",
          tool: "BROWSER",
          action: {
            type: "fill",
            selector: 'input[type="email"]',
            value: "{{DEMO_USERNAME}}",
          },
          expectedOutcome:
            "The demo email is entered before login.",
        },
        {
          id: "dashboard-fill-password",
          tool: "BROWSER",
          action: {
            type: "fill",
            selector: 'input[type="password"]',
            value: "{{DEMO_PASSWORD}}",
          },
          expectedOutcome:
            "The demo password is entered before login.",
        },
        {
          id: "dashboard-login",
          tool: "BROWSER",
          action: {
            type: "click",
            selector: 'button:has-text("Login")',
          },
          expectedOutcome:
            "The user is authenticated and lands on the dashboard.",
        },
        {
          id: "dashboard-open-heading",
          tool: "BROWSER",
          action: {
            type: "assertText",
            selector: ".stat-card.stat-open h2",
            expectedText: "OPEN",
          },
          expectedOutcome:
            "The Open ticket status heading is visible on the dashboard.",
        },
        {
          id: "dashboard-in-progress-heading",
          tool: "BROWSER",
          action: {
            type: "assertText",
            selector: ".stat-card.stat-progress h2",
            expectedText: "IN PROGRESS",
          },
          expectedOutcome:
            "The In Progress ticket status heading is visible on the dashboard.",
        },
        {
          id: "dashboard-resolved-heading",
          tool: "BROWSER",
          action: {
            type: "assertText",
            selector: ".stat-card.stat-resolved h2",
            expectedText: "RESOLVED",
          },
          expectedOutcome:
            "The Resolved ticket status heading is visible on the dashboard.",
        },
      ]
    ),
  },
  {
    criterionId: DEMO_CRITERION_IDS.CREATE_TICKET,
    description:
      "User can create a support ticket via the UI (fallback-only).",
    plan: makeValidatedPlan(
      DEMO_CRITERION_IDS.CREATE_TICKET,
      "Verify the create ticket flow (catalog placeholder; fallback-only).",
      [
        {
          id: "create-ticket-navigate",
          tool: "BROWSER",
          action: {
            type: "navigate",
            url: DEMO_ALLOWED_ORIGIN,
          },
          expectedOutcome:
            "The application is opened before creating a ticket.",
        },
      ]
    ),
  },
  {
    criterionId: DEMO_CRITERION_IDS.TICKET_HISTORY,
    description:
      "User can access ticket history and see the seeded ticket for the authenticated user.",
    plan: makeValidatedPlan(
      DEMO_CRITERION_IDS.TICKET_HISTORY,
      "Verify the authenticated user can open ticket history and inspect the seeded ticket.",
      [
        {
          id: "history-login-navigate",
          tool: "BROWSER",
          action: {
            type: "navigate",
            url: DEMO_ALLOWED_ORIGIN,
          },
          expectedOutcome:
            "The login page is ready for the demo user.",
        },
        {
          id: "history-email",
          tool: "BROWSER",
          action: {
            type: "fill",
            selector: 'input[type="email"]',
            value: "{{DEMO_USERNAME}}",
          },
          expectedOutcome:
            "The authenticated email is entered before login.",
        },
        {
          id: "history-password",
          tool: "BROWSER",
          action: {
            type: "fill",
            selector: 'input[type="password"]',
            value: "{{DEMO_PASSWORD}}",
          },
          expectedOutcome:
            "The authenticated password is entered before login.",
        },
        {
          id: "history-login-submit",
          tool: "BROWSER",
          action: {
            type: "click",
            selector: 'button:has-text("Login")',
          },
          expectedOutcome:
            "The user logs in and reaches the dashboard.",
        },
        {
          id: "history-heading",
          tool: "BROWSER",
          action: {
            type: "assertText",
            selector:
              'section.panel:has(h2:has-text("Ticket History")) h2',
            expectedText: "Ticket History",
          },
          expectedOutcome:
            "The Ticket History heading is visible.",
        },
        {
          id: "history-any-ticket-visible",
          tool: "BROWSER",
          action: {
            type: "click",
            selector:
              'section.panel:has(h2:has-text("Ticket History")) article.ticket-row:first-of-type button.ticket-subject',
          },
          expectedOutcome:
            "At least one ticket subject button is visible in the authenticated user's history.",
        },
      ]
    ),
  },
  {
    criterionId: DEMO_CRITERION_IDS.TICKET_DETAILS,
    description:
      "User can open the seeded ticket and see its details with an open status.",
    plan: makeValidatedPlan(
      DEMO_CRITERION_IDS.TICKET_DETAILS,
      "Verify the seeded ticket details modal opens and shows the current open status.",
      [
        {
          id: "details-login-page",
          tool: "BROWSER",
          action: {
            type: "navigate",
            url: DEMO_ALLOWED_ORIGIN,
          },
          expectedOutcome:
            "The login page is ready for the demo user.",
        },
        {
          id: "details-email",
          tool: "BROWSER",
          action: {
            type: "fill",
            selector: 'input[type="email"]',
            value: "{{DEMO_USERNAME}}",
          },
          expectedOutcome:
            "The email field is populated for the authenticated user.",
        },
        {
          id: "details-password",
          tool: "BROWSER",
          action: {
            type: "fill",
            selector: 'input[type="password"]',
            value: "{{DEMO_PASSWORD}}",
          },
          expectedOutcome:
            "The password field is populated for the authenticated user.",
        },
        {
          id: "details-login-submit",
          tool: "BROWSER",
          action: {
            type: "click",
            selector: 'button:has-text("Login")',
          },
          expectedOutcome:
            "The user logs in and reaches the dashboard.",
        },
        {
          id: "details-open-ticket",
          tool: "BROWSER",
          action: {
            type: "click",
            selector: 'button:has-text("Unable to login")',
          },
          expectedOutcome:
            "The seeded ticket is opened from the user's history.",
        },
        {
          id: "details-heading",
          tool: "BROWSER",
          action: {
            type: "assertText",
            selector: "h2#ticket-details-title",
            expectedText: "Ticket Details",
          },
          expectedOutcome:
            "The details view is open and shows the Ticket Details heading.",
        },
        {
          id: "details-open-status",
          tool: "BROWSER",
          action: {
            type: "assertText",
            selector:
              'section.ticket-modal .details-list div:has(dt:has-text("Status")) span.badge.badge-open',
            expectedText: "OPEN",
          },
          expectedOutcome:
            "The current ticket status is visible as Open.",
        },
      ]
    ),
  },
  {
    criterionId: DEMO_CRITERION_IDS.LOGOUT,
    description:
      "User can log out and return to the login screen.",
    plan: makeValidatedPlan(
      DEMO_CRITERION_IDS.LOGOUT,
      "Verify the authenticated user can log out and be returned to the login screen.",
      [
        {
          id: "logout-navigate",
          tool: "BROWSER",
          action: {
            type: "navigate",
            url: DEMO_ALLOWED_ORIGIN,
          },
          expectedOutcome:
            "The login page loads before the user signs in.",
        },
        {
          id: "logout-email",
          tool: "BROWSER",
          action: {
            type: "fill",
            selector: 'input[type="email"]',
            value: "{{DEMO_USERNAME}}",
          },
          expectedOutcome:
            "The demo email is entered before login.",
        },
        {
          id: "logout-password",
          tool: "BROWSER",
          action: {
            type: "fill",
            selector: 'input[type="password"]',
            value: "{{DEMO_PASSWORD}}",
          },
          expectedOutcome:
            "The demo password is entered before login.",
        },
        {
          id: "logout-login-submit",
          tool: "BROWSER",
          action: {
            type: "click",
            selector: 'button:has-text("Login")',
          },
          expectedOutcome:
            "The user is authenticated and routed to the dashboard.",
        },
        {
          id: "logout-click",
          tool: "BROWSER",
          action: {
            type: "click",
            selector: 'button:has-text("Logout")',
          },
          expectedOutcome:
            "The authenticated session is ended and the app logs the user out.",
        },
        {
          id: "logout-login-visible",
          tool: "BROWSER",
          action: {
            type: "assertVisible",
            selector: 'input[type="email"]',
          },
          expectedOutcome:
            "The login screen is visible after logout.",
        },
      ]
    ),
  },
];

export function getDemoCatalogPlans(): DemoCatalogEntry[] {
  return DEMO_CATALOG.map((entry) => ({
    ...entry,
    plan: validateVerificationPlan(
      entry.plan,
      entry.criterionId,
      [DEMO_ALLOWED_ORIGIN]
    ),
  }));
}

export function createStoredPlan(
  plan: ValidatedVerificationPlan,
  criterionDescription: string
): StoredDemoCatalogPlan {
  return {
    version: 1,
    plan,
    validatedAt: new Date().toISOString(),
    criterionDescriptionSnapshot:
      criterionDescription,
  };
}

export async function seedValidatedDemoCatalog(
  db: any
): Promise<void> {
  const catalog = getDemoCatalogPlans();
  const catalogIds = catalog.map(
    ({ criterionId }) => criterionId
  );
  const knownFallbackOnlyId =
    DEMO_CRITERION_IDS.CREATE_TICKET;

  const existingCriteria = await db.criterion.findMany({
    where: { id: { in: [...catalogIds, knownFallbackOnlyId] } },
    select: { id: true, description: true },
  });

  const existingIds = existingCriteria.map(
    (entry: { id: string }) => entry.id
  );

  const descriptionMap: Record<string, string> = {};
  for (const row of existingCriteria) {
    if (typeof row.description === "string") {
      descriptionMap[row.id] = row.description;
    }
  }

  for (const criterionId of Array.from(
    new Set([
      ...catalogIds,
      knownFallbackOnlyId,
    ])
  )) {
    if (!existingIds.includes(criterionId)) {
      continue;
    }

    await db.criterion.update({
      where: { id: criterionId },
      data: {
        aiInterpretation: null,
      },
    });
  }

  for (const item of catalog) {
    const snapshot =
      descriptionMap[item.criterionId] ?? item.description;

    const storedPlan = createStoredPlan(
      item.plan,
      snapshot
    );

    // Only update existing criteria; preserve behavior when a criterion
    // record is missing in the database.
    if (existingIds.includes(item.criterionId)) {
      await db.criterion.update({
        where: { id: item.criterionId },
        data: {
          aiInterpretation: storedPlan,
        },
      });
    }
  }
}
