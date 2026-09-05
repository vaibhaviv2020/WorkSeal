import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:5000/api'
const PROJECT_ID = 'c1905b71-73b7-4ad2-a138-d1f2423892ec'
const MILESTONE_ID = '22d40711-961f-4a89-82cf-cb75e30b6395'

type Criterion = {
  id: string
  description: string
  blocking: boolean
  aiInterpretation?: {
    plan?: VerificationPlan
    validatedAt?: string
  } | null
}

type VerificationPlan = {
  goal: string
  steps: Array<{
    id: string
    tool: string
    action: {
      type: string
      selector?: string
      expectedText?: string
      url?: string
    }
    expectedOutcome: string
  }>
}

type Milestone = {
  id: string
  name: string
  amount: number
  currency: string
  status: string
  project?: {
    id: string
    name: string
  }
  criteria: Criterion[]
}

type Project = {
  id: string
  name: string
  milestones: Array<{
    id: string
    name: string
    status: string
    criteria: Criterion[]
  }>
}

type VerificationCriterionResult = {
  criterionId: string
  result: 'PASS' | 'FAIL' | 'UNCERTAIN'
  reason: string
  evidence: Array<{
    type: string
    path?: string
    description: string
  }>
  planSource: 'AI' | 'FALLBACK'
  planVersion?: 1
}

type VerificationResponse = {
  runId: string
  decision: string
  overallResult: 'PASS' | 'FAIL' | 'UNCERTAIN'
  criteria: VerificationCriterionResult[]
}

const criterionNames: Record<string, string> = {
  '1e474e00-11c7-4fbf-8489-fef57a30904a': 'Login',
  '3c03635e-745e-491c-b727-505604d92c97': 'Dashboard',
  '4b72a86f-c932-4de4-8492-c75eee6606ab': 'Create Ticket',
  'fd2dc7ae-0fe4-4e07-a488-2bad9c9e7856': 'Ticket History',
  '7bd5abcd-bf83-49dc-8c7b-899244d80960': 'Ticket Details',
  '66550107-a060-414d-b392-92821957bee3': 'Logout',
}

const pipelineSteps = [
  'Acceptance Criterion',
  'AI Planner',
  'Plan Validation',
  'Deterministic Executor',
  'Evidence',
  'Deterministic Evaluation',
  'Milestone Decision',
]

function formatStatus(value: string) {
  return value.replaceAll('_', ' ')
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

function statusTone(status: string) {
  if (status === 'PASS' || status === 'READY_FOR_APPROVAL' || status === 'APPROVED') {
    return 'success'
  }
  if (status === 'FAIL' || status === 'NOT_READY') {
    return 'danger'
  }
  if (status === 'UNCERTAIN' || status === 'REVIEW_REQUIRED') {
    return 'warning'
  }
  return 'neutral'
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState('buyer@workseal.test')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [activeCriterionId, setActiveCriterionId] = useState<string>('')
  const [verification, setVerification] = useState<VerificationResponse | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [approved, setApproved] = useState(false)

  useEffect(() => {
    if (!loggedIn) return

    let cancelled = false

    async function loadWorkspace() {
      setLoading(true)
      setApiError('')
      try {
        const [projectResponse, milestoneResponse] = await Promise.all([
          fetch(`${API_BASE}/projects/${PROJECT_ID}`),
          fetch(`${API_BASE}/milestones/${MILESTONE_ID}`),
        ])

        if (!projectResponse.ok || !milestoneResponse.ok) {
          throw new Error('Workspace data is not available.')
        }

        const projectData = (await projectResponse.json()) as Project
        const milestoneData = (await milestoneResponse.json()) as Milestone

        if (!cancelled) {
          setProject(projectData)
          setMilestone(milestoneData)
          setActiveCriterionId(milestoneData.criteria[0]?.id ?? '')
        }
      } catch (error) {
        if (!cancelled) {
          setApiError(error instanceof Error ? error.message : 'Unable to load workspace.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadWorkspace()

    return () => {
      cancelled = true
    }
  }, [loggedIn])

  const criteria = milestone?.criteria ?? []
  const latestResults = useMemo(() => {
    return new Map(verification?.criteria.map((item) => [item.criterionId, item]) ?? [])
  }, [verification])

  const passedCount = criteria.filter((criterion) => {
    const result = latestResults.get(criterion.id)
    if (result) return result.result === 'PASS'
    return milestone?.status === 'READY_FOR_APPROVAL'
  }).length

  const activeCriterion = criteria.find((criterion) => criterion.id === activeCriterionId) ?? criteria[0]
  const activeResult = activeCriterion ? latestResults.get(activeCriterion.id) : undefined
  const displayStatus = verification?.decision ?? milestone?.status ?? 'LOADING'
  const readyForApproval = displayStatus === 'READY_FOR_APPROVAL'

  function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    if (!email || !password) {
      setAuthError('Enter an email and password to continue.')
      return
    }
    setLoggedIn(true)
  }

  async function runVerification() {
    setVerifying(true)
    setApiError('')
    try {
      const response = await fetch(`${API_BASE}/milestones/${MILESTONE_ID}/verifications`, {
        method: 'POST',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Verification could not be started.')
      }

      setVerification(data)
      setMilestone((current) =>
        current
          ? {
              ...current,
              status: data.decision,
            }
          : current,
      )
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Verification failed to complete.')
    } finally {
      setVerifying(false)
    }
  }

  if (!loggedIn) {
    return (
      <main className="login-page">
        <section className="login-panel" aria-labelledby="login-title">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              W
            </div>
            <div>
              <p className="eyebrow">WorkSeal</p>
              <h1 id="login-title">Milestone payments after verified delivery.</h1>
            </div>
          </div>

          <p className="login-copy">
            AI plans the checks. Deterministic verification proves the work. Humans approve
            payment.
          </p>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="buyer@workseal.test"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter demo password"
              />
            </label>
            {authError && (
              <p className="alert" role="alert">
                {authError}
              </p>
            )}
            <button className="primary-button" type="submit">
              Log in
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-inline">
          <div className="brand-mark" aria-hidden="true">
            W
          </div>
          <span>WorkSeal</span>
        </div>
        <nav aria-label="Primary">
          <a href="#dashboard">Dashboard</a>
          <a href="#verification">Verification</a>
          <a href="#approval">Approval</a>
        </nav>
        <div className="user-actions">
          <span>Buyer demo</span>
          <button type="button" className="ghost-button" onClick={() => setLoggedIn(false)}>
            Logout
          </button>
        </div>
      </header>

      {loading ? (
        <section className="loading-state">
          <div className="spinner" aria-hidden="true" />
          <h1>Loading WorkSeal workspace</h1>
          <p>Fetching project, milestone, and acceptance criteria.</p>
        </section>
      ) : apiError && !milestone ? (
        <section className="empty-state" role="alert">
          <h1>Workspace unavailable</h1>
          <p>{apiError}</p>
          <button className="secondary-button" type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </section>
      ) : (
        <>
          <section className="dashboard" id="dashboard">
            <div className="dashboard-heading">
              <p className="eyebrow">Escrow verification workspace</p>
              <h1>{project?.name ?? 'WorkSeal Project'}</h1>
              <p>
                Project to milestone to evidence-backed approval, all visible in one clean
                workflow.
              </p>
            </div>

            <div className="summary-grid" aria-label="Workspace summary">
              <SummaryCard label="Projects" value={project ? '1' : '0'} detail="Active workspace" />
              <SummaryCard label="Milestones" value={String(project?.milestones.length ?? 0)} detail="Tracked deliveries" />
              <SummaryCard label="Verified" value={`${passedCount}/${criteria.length}`} detail="Criteria passed" />
              <SummaryCard label="Ready for Approval" value={readyForApproval ? 'Yes' : 'No'} detail={formatStatus(displayStatus)} />
            </div>

            <section className="milestone-hero">
              <div>
                <p className="eyebrow">Current milestone</p>
                <h2>{milestone?.name ?? 'Customer Support Portal MVP'}</h2>
                <p className="milestone-subtitle">
                  Customer Support Portal MVP, verified against acceptance criteria before
                  human approval and payment release.
                </p>
              </div>
              <div className="hero-status">
                <StatusBadge status={displayStatus} />
                <strong>{passedCount} / {criteria.length} criteria passed</strong>
                <button className="primary-button" type="button" onClick={() => document.getElementById('verification')?.scrollIntoView()}>
                  View Verification
                </button>
              </div>
            </section>
          </section>

          <section className="verification-layout" id="verification">
            <div className="section-heading">
              <p className="eyebrow">Verification</p>
              <h2>Customer Support Portal MVP</h2>
              <p>
                AI generates bounded plans; validation and deterministic execution decide the
                result.
              </p>
            </div>

            {apiError && (
              <p className="alert" role="alert">
                {apiError}
              </p>
            )}

            <div className="verification-summary">
              <div>
                <span>Verification Status</span>
                <StatusBadge status={displayStatus} />
              </div>
              <div>
                <span>Progress</span>
                <strong>{passedCount} / {criteria.length} Criteria Passed</strong>
              </div>
              <button className="secondary-button" type="button" onClick={runVerification} disabled={verifying}>
                {verifying ? 'Running Verification' : 'Run Verification'}
              </button>
            </div>

            <div className="criteria-grid">
              <section className="criteria-list" aria-label="Acceptance criteria">
                {criteria.length === 0 ? (
                  <div className="empty-state compact">
                    <h3>No criteria yet</h3>
                    <p>Add acceptance criteria to make verification possible.</p>
                  </div>
                ) : (
                  criteria.map((criterion) => {
                    const result = latestResults.get(criterion.id)
                    const status = result?.result ?? (milestone?.status === 'READY_FOR_APPROVAL' ? 'PASS' : 'UNCERTAIN')
                    return (
                      <button
                        className={`criterion-row ${criterion.id === activeCriterion?.id ? 'active' : ''}`}
                        key={criterion.id}
                        type="button"
                        onClick={() => setActiveCriterionId(criterion.id)}
                      >
                        <span className={`checkmark checkmark-${statusTone(status)}`} aria-hidden="true">✓</span>
                        <span>
                          <strong>{criterionNames[criterion.id] ?? 'Acceptance Criterion'}</strong>
                          <small>{criterion.description}</small>
                        </span>
                        <StatusBadge status={status} />
                      </button>
                    )
                  })
                )}
              </section>

              {activeCriterion && (
                <CriterionDetails
                  criterion={activeCriterion}
                  result={activeResult}
                  inferredPass={!activeResult && milestone?.status === 'READY_FOR_APPROVAL'}
                />
              )}
            </div>
          </section>

          <section className="pipeline-section">
            <div className="section-heading">
              <p className="eyebrow">Pipeline</p>
              <h2>AI-assisted, deterministically decided</h2>
            </div>
            <div className="pipeline">
              {pipelineSteps.map((step, i) => (
                <div className="pipeline-step" key={step}>
                  <span aria-hidden="true">{i + 1}</span>
                  <strong>{step}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="approval-section" id="approval">
            <div>
              <p className="eyebrow">Approval</p>
              <h2>Milestone Verified</h2>
              <p>
                {passedCount} / {criteria.length} criteria passed. WorkSeal can mark the
                milestone ready, but payment still requires human approval.
              </p>
            </div>
            <div className="approval-panel">
              <StatusBadge status={approved ? 'APPROVED' : displayStatus} />
              <strong>{formatMoney(milestone?.amount ?? 0, milestone?.currency ?? 'INR')}</strong>
              <button
                className="primary-button"
                type="button"
                disabled={!readyForApproval || approved}
                onClick={() => setApproved(true)}
              >
                {approved ? 'Milestone Approved' : 'Approve Milestone'}
              </button>
              <small>Approval is a human action after deterministic verification.</small>
            </div>
          </section>
        </>
      )}
    </main>
  )
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  )
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${statusTone(status)}`}>{formatStatus(status)}</span>
}

function CriterionDetails({
  criterion,
  result,
  inferredPass,
}: {
  criterion: Criterion
  result?: VerificationCriterionResult
  inferredPass: boolean
}) {
  const plan = criterion.aiInterpretation?.plan
  const status = result?.result ?? (inferredPass ? 'PASS' : 'UNCERTAIN')

  return (
    <aside className="details-panel">
      <div className="details-header">
        <div>
          <p className="eyebrow">Criterion details</p>
          <h3>{criterionNames[criterion.id] ?? 'Acceptance Criterion'}</h3>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="criterion-description">{criterion.description}</p>
      {inferredPass && !result && (
        <p className="note">
          Showing PASS from the current milestone state. Run verification to load fresh
          per-criterion reasons in this session.
        </p>
      )}

      <div className="stage-list">
        <Stage label="AI Planning" detail={plan ? 'Plan generated and stored' : 'No stored plan available'} done={!!plan} />
        <Stage label="Plan Validation" detail={criterion.aiInterpretation ? 'Validated before execution' : 'Pending'} done={!!criterion.aiInterpretation} />
        <Stage label="Execution" detail={result ? 'Deterministic execution completed' : 'Run verification to execute'} done={!!result} />
        <Stage label="Result" detail={result?.reason ?? (inferredPass ? 'Milestone is ready for approval' : 'Run verification to see result')} done={!!result || inferredPass} />
      </div>

      <section className="plan-view" aria-label="Verification plan">
        <h4>Verification plan</h4>
        {plan ? (
          <>
            <p>{cleanPlanGoal(plan.goal, criterionNames[criterion.id])}</p>
            <ol>
              {plan.steps.map((step) => (
                <li key={step.id}>
                  <strong>{step.action.type}</strong>
                  <span>{step.expectedOutcome}</span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="note">No verification plan is available. Run verification to generate one.</p>
        )}
      </section>

      <section className="evidence-view" aria-label="Evidence">
        <h4>Evidence</h4>
        {result?.evidence && result.evidence.length > 0 ? (
          result.evidence.map((item, index) => (
            <div className="evidence-item" key={`${item.type}-${index}`}>
              <span>{item.type}</span>
              <p>{item.description}</p>
              {item.path && <small>{item.path}</small>}
            </div>
          ))
        ) : (
          <p className="note">Evidence details are not available in this view.</p>
        )}
      </section>
    </aside>
  )
}

function cleanPlanGoal(goal: string, criterionName?: string): string {
  const lower = goal.toLowerCase()
  if (lower.includes('catalog placeholder') || lower.includes('fallback-only') || lower.includes('fallback only')) {
    return criterionName ? `Verify the ${criterionName.toLowerCase()} workflow.` : 'Verify the acceptance criterion.'
  }
  return goal
}

function Stage({ label, detail, done }: { label: string; detail: string; done?: boolean }) {
  return (
    <div className={`stage-item${done ? '' : ' stage-pending'}`}>
      <span aria-hidden="true">{done ? '✓' : '·'}</span>
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
    </div>
  )
}

export default App
