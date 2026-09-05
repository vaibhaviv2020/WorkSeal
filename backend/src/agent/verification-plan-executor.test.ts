import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import test from "node:test";

import {
  executeVerificationPlan,
  evaluateVerificationPlan,
  type EvidenceReference,
  type ExecutionResult,
} from "./verification-plan-executor.js";

const CRITERION_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const TASK_ID = "33333333-3333-4333-8333-333333333333";

function baseOptions(origin: string, evidenceDirectory: string) {
  return {
    runId: RUN_ID,
    taskId: TASK_ID,
    criterionId: CRITERION_ID,
    allowedOrigins: [origin],
    evidenceDirectory,
    credentialResolver: {
      resolve(name: "DEMO_USERNAME" | "DEMO_PASSWORD") {
        return name === "DEMO_USERNAME" ? "demo-user" : "demo-secret";
      },
    },
  };
}

function browserPlan(origin: string) {
  return {
    version: 1 as const,
    criterionId: CRITERION_ID,
    goal: "Verify the browser session and credentials",
    steps: [
      {
        id: "navigate",
        tool: "BROWSER" as const,
        action: { type: "navigate" as const, url: `${origin}/` },
        expectedOutcome: "Login page is visible",
      },
      {
        id: "username",
        tool: "BROWSER" as const,
        action: {
          type: "fill" as const,
          selector: "#username",
          value: "{{DEMO_USERNAME}}",
        },
        expectedOutcome: "Username is entered",
      },
      {
        id: "password",
        tool: "BROWSER" as const,
        action: {
          type: "fill" as const,
          selector: "#password",
          value: "{{DEMO_PASSWORD}}",
        },
        expectedOutcome: "Password is entered",
      },
      {
        id: "login",
        tool: "BROWSER" as const,
        action: { type: "click" as const, selector: "#login" },
        expectedOutcome: "Authenticated state is shown",
      },
      {
        id: "session",
        tool: "BROWSER" as const,
        action: { type: "navigate" as const, url: `${origin}/session` },
        expectedOutcome: "The same browser session is retained",
      },
      {
        id: "assert-session",
        tool: "BROWSER" as const,
        action: {
          type: "assertText" as const,
          selector: "#session",
          expectedText: "session-ok",
        },
        expectedOutcome: "Continuous session state is present",
        evidenceType: "SCREENSHOT" as const,
      },
    ],
  };
}

async function startServer() {
  let getAttempts = 0;
  let postAttempts = 0;
  let credentialReceived = "";

  const server = http.createServer((req, res) => {
    if (req.url === "/" && req.method === "GET") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html>
        <input id="username" />
        <input id="password" type="password" />
        <button id="login" onclick="login()">Login</button>
        <div id="status"></div>
        <script>
          function login() {
            const u = document.querySelector('#username').value;
            const p = document.querySelector('#password').value;
            if (u === 'demo-user' && p === 'demo-secret') {
              localStorage.setItem('sessionProof', 'ok');
              document.querySelector('#status').textContent = 'authenticated';
            }
          }
        </script>`);
      return;
    }

    if (req.url === "/session" && req.method === "GET") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<div id="session"></div><script>document.querySelector('#session').textContent = localStorage.getItem('sessionProof') === 'ok' ? 'session-ok' : 'session-missing';</script>`);
      return;
    }

    if (req.url === "/api/data" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: { value: "ok" } }));
      return;
    }

    if (req.url === "/api/retry" && req.method === "GET") {
      getAttempts += 1;
      if (getAttempts === 1) {
        req.socket.destroy();
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.url === "/api/post" && req.method === "POST") {
      postAttempts += 1;
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "failure" }));
      return;
    }

    if (req.url === "/api/credentials" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        credentialReceived = body;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    if (req.url === "/redirect" && req.method === "GET") {
      res.writeHead(302, { location: "http://127.0.0.1:1/escape" });
      res.end();
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;

  return {
    server,
    origin,
    getAttempts: () => getAttempts,
    postAttempts: () => postAttempts,
    credentialReceived: () => credentialReceived,
  };
}

async function evidenceDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "workseal-batch3-"));
}

test("valid hand-written browser plan executes with deterministic evidence", async () => {
  const app = await startServer();
  const dir = await evidenceDir();
  try {
    const result = await executeVerificationPlan(
      browserPlan(app.origin),
      baseOptions(app.origin, dir)
    );
    console.log(JSON.stringify(result.results, null, 2));
    assert.equal(result.evaluation.result, "PASS");
    assert.equal(result.results.length, 6);
    assert.ok(result.evidence.some((item) => item.type === "SCREENSHOT"));
    assert.equal(result.planVersion, 1);
  } finally {
    await new Promise<void>((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("valid hand-written API plan executes and produces API evidence", async () => {
  const app = await startServer();
  const dir = await evidenceDir();
  try {
    const plan = {
      version: 1 as const,
      criterionId: CRITERION_ID,
      goal: "Verify a safe API response",
      steps: [
        {
          id: "request",
          tool: "API" as const,
          action: { type: "request" as const, method: "GET" as const, url: `${app.origin}/api/data`, body: null },
          expectedOutcome: "API responds",
          evidenceType: "API_RESPONSE" as const,
        },
        {
          id: "status",
          tool: "API" as const,
          action: { type: "assertStatus" as const, expectedStatus: 200 },
          expectedOutcome: "HTTP 200 is observed",
        },
        {
          id: "field",
          tool: "API" as const,
          action: { type: "assertJsonField" as const, path: "data.value", expectedValue: "ok" },
          expectedOutcome: "The expected JSON field is observed",
        },
      ],
    };

    const result = await executeVerificationPlan(plan, baseOptions(app.origin, dir));
    assert.equal(result.evaluation.result, "PASS");
    assert.ok(result.evidence.some((item) => item.type === "API_RESPONSE"));
  } finally {
    await new Promise<void>((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("invalid or unvalidated plan is rejected before execution", async () => {
  const app = await startServer();
  const dir = await evidenceDir();
  try {
    const plan = browserPlan(app.origin) as any;
    plan.steps[0].tool = "SHELL";
    await assert.rejects(() => executeVerificationPlan(plan, baseOptions(app.origin, dir)));
  } finally {
    await new Promise<void>((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("non-allowlisted URL is rejected", async () => {
  const app = await startServer();
  const dir = await evidenceDir();
  try {
    const plan = browserPlan(app.origin) as any;
    plan.steps[0].action.url = "http://example.com/";
    await assert.rejects(() => executeVerificationPlan(plan, baseOptions(app.origin, dir)));
  } finally {
    await new Promise<void>((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("runtime redirect host drift is blocked", async () => {
  const app = await startServer();
  const dir = await evidenceDir();
  try {
    const plan = {
      version: 1 as const,
      criterionId: CRITERION_ID,
      goal: "Detect runtime redirect drift",
      steps: [{
        id: "redirect",
        tool: "BROWSER" as const,
        action: { type: "navigate" as const, url: `${app.origin}/redirect` },
        expectedOutcome: "Redirect stays on the allowlisted origin",
      }],
    };
    const result = await executeVerificationPlan(plan, baseOptions(app.origin, dir));
    assert.equal(result.evaluation.result, "UNCERTAIN");
    assert.equal(result.results[0].status, "ERROR");
  } finally {
    await new Promise<void>((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("credential placeholders resolve only during execution", async () => {
  const app = await startServer();
  const dir = await evidenceDir();
  try {
    const plan = {
      version: 1 as const,
      criterionId: CRITERION_ID,
      goal: "Use executor-only credentials",
      steps: [{
        id: "password",
        tool: "BROWSER" as const,
        action: { type: "navigate" as const, url: app.origin },
        expectedOutcome: "Page opens",
      }, {
        id: "fill-password",
        tool: "BROWSER" as const,
        action: { type: "fill" as const, selector: "#password", value: "{{DEMO_PASSWORD}}" },
        expectedOutcome: "Password is filled",
      }],
    };
    const result = await executeVerificationPlan(plan, baseOptions(app.origin, dir));
    assert.equal(result.evaluation.result, "PASS");
    assert.equal(JSON.stringify(result).includes("demo-secret"), false);
    assert.equal(JSON.stringify(result).includes("{{DEMO_PASSWORD}}"), false);
  } finally {
    await new Promise<void>((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("GET request uses bounded retry", async () => {
  const app = await startServer();
  const dir = await evidenceDir();
  try {
    const plan = {
      version: 1 as const,
      criterionId: CRITERION_ID,
      goal: "Retry an eligible GET",
      steps: [{
        id: "get",
        tool: "API" as const,
        action: { type: "request" as const, method: "GET" as const, url: `${app.origin}/api/retry`, body: null },
        expectedOutcome: "GET succeeds",
      }],
    };
    const result = await executeVerificationPlan(plan, baseOptions(app.origin, dir));
    assert.equal(result.results[0].status, "PASS");
    assert.equal(app.getAttempts(), 2);
  } finally {
    await new Promise<void>((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("POST request is never automatically retried", async () => {
  const app = await startServer();
  const dir = await evidenceDir();
  try {
    const plan = {
      version: 1 as const,
      criterionId: CRITERION_ID,
      goal: "Do not retry a POST",
      steps: [{
        id: "post",
        tool: "API" as const,
        action: { type: "request" as const, method: "POST" as const, url: `${app.origin}/api/post`, body: null },
        expectedOutcome: "POST is sent once",
      }, {
        id: "status",
        tool: "API" as const,
        action: { type: "assertStatus" as const, expectedStatus: 201 },
        expectedOutcome: "Creation succeeds",
      }],
    };
    const result = await executeVerificationPlan(plan, baseOptions(app.origin, dir));
    assert.equal(app.postAttempts(), 1);
    assert.equal(result.evaluation.result, "FAIL");
  } finally {
    await new Promise<void>((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("assertion failure produces FAIL", () => {
  const plan = browserPlan("http://127.0.0.1:1234") as any;
  const results: ExecutionResult[] = [{
    stepId: "assert-session",
    status: "FAIL",
    observedAt: new Date().toISOString(),
    evidenceIds: [],
    error: { type: "ASSERTION_FAILURE", message: "expected x" },
  }];
  const evaluation = evaluateVerificationPlan(CRITERION_ID, plan, results, []);
  assert.equal(evaluation.result, "FAIL");
});

test("mechanism failure produces UNCERTAIN", () => {
  const plan = browserPlan("http://127.0.0.1:1234") as any;
  const results: ExecutionResult[] = [{
    stepId: "navigate",
    status: "TIMEOUT",
    observedAt: new Date().toISOString(),
    evidenceIds: [],
    error: { type: "EXECUTION_ERROR", message: "timeout" },
  }];
  const evaluation = evaluateVerificationPlan(CRITERION_ID, plan, results, []);
  assert.equal(evaluation.result, "UNCERTAIN");
});

test("arbitrary code, shell, file, database, and payment actions cannot execute", async () => {
  const app = await startServer();
  const dir = await evidenceDir();
  try {
    for (const forbidden of ["SHELL", "EXECUTE_JS", "READ_FILE", "SQL", "DATABASE_WRITE", "PAYMENT_RELEASE"]) {
      const plan = browserPlan(app.origin) as any;
      plan.steps[0].tool = forbidden;
      await assert.rejects(() => executeVerificationPlan(plan, baseOptions(app.origin, dir)));
    }
  } finally {
    await new Promise<void>((resolve, reject) => app.server.close((error) => error ? reject(error) : resolve()));
  }
});
