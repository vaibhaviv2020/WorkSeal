import { useState } from "react";
import type { FormEvent } from "react";

import "./App.css";

type DashboardData = {
  open: number;
  inProgress: number;
  resolved: number;
};

type TicketFormData = {
  subject: string;
  description: string;
  priority: string;
};

type Ticket = {
  id: number;
  subject: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
};

function formatStatus(status: string) {
  if (status === "OPEN") {
    return "Open";
  }

  if (status === "IN_PROGRESS") {
    return "In Progress";
  }

  if (status === "RESOLVED") {
    return "Resolved";
  }

  return status;
}

function formatPriority(priority: string) {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function formatDate(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  const [ticketForm, setTicketForm] = useState<TicketFormData>({
    subject: "",
    description: "",
    priority: "MEDIUM",
  });

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  async function loadDashboard() {
    try {
      const response = await fetch(
        "http://localhost:5001/api/dashboard",
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to load dashboard.");
        return;
      }

      setDashboard(data);
    } catch {
      setError("Unable to connect to the server.");
    }
  }

  async function loadTickets() {
    try {
      const response = await fetch(
        "http://localhost:5001/api/tickets",
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to load tickets.");
        return;
      }

      setTickets(data.tickets);
    } catch {
      setError("Unable to connect to the server.");
    }
  }

  async function loadTicketDetails(ticketId: number) {
    try {
      setError("");

      const response = await fetch(
        `http://localhost:5001/api/tickets/${ticketId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to load ticket details.");
        return;
      }

      setSelectedTicket(data.ticket);
    } catch {
      setError("Unable to connect to the server.");
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    try {
      const response = await fetch(
  "http://localhost:5001/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed.");
        return;
      }

      setUserName(data.user.name);
      setLoggedIn(true);

      await loadDashboard();
      await loadTickets();
    } catch {
      setError("Unable to connect to the server.");
    }
  }

  async function handleLogout() {
    try {
      setError("");

      const response = await fetch(
        "http://localhost:5001/api/auth/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to logout.");
        return;
      }

      setLoggedIn(false);
      setUserName("");
      setDashboard(null);
      setTickets([]);
      setSelectedTicket(null);
      setEmail("");
      setPassword("");
    } catch {
      setError("Unable to connect to the server.");
    }
  }

  async function handleCreateTicket(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    try {
      const response = await fetch(
        "http://localhost:5001/api/tickets",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(ticketForm),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to create ticket.");
        return;
      }

      setTicketForm({
        subject: "",
        description: "",
        priority: "MEDIUM",
      });

      setTickets((currentTickets) => [
        data.ticket,
        ...currentTickets,
      ]);

      await loadDashboard();
    } catch {
      setError("Unable to connect to the server.");
    }
  }

  if (loggedIn) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              W
            </div>
            <span>WorkSeal Demo</span>
          </div>

          <div className="nav-indicator">Dashboard</div>

          <button
            className="button button-ghost danger"
            type="button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </header>

        <section className="dashboard-page">
          <div className="dashboard-intro">
            <h1>Dashboard</h1>
            <p>Welcome back, {userName}.</p>
          </div>

          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}

          {dashboard && (
            <div className="stats-grid">
              <article className="stat-card stat-open">
                <div>
                  <h2>Open</h2>
                  <strong>{dashboard.open}</strong>
                  <p>Active tickets</p>
                </div>
                <span className="stat-icon" aria-hidden="true">
                  ID
                </span>
              </article>

              <article className="stat-card stat-progress">
                <div>
                  <h2>In Progress</h2>
                  <strong>{dashboard.inProgress}</strong>
                  <p>Being handled</p>
                </div>
                <span className="stat-icon" aria-hidden="true">
                  ...
                </span>
              </article>

              <article className="stat-card stat-resolved">
                <div>
                  <h2>Resolved</h2>
                  <strong>{dashboard.resolved}</strong>
                  <p>Completed tickets</p>
                </div>
                <span className="stat-icon" aria-hidden="true">
                  OK
                </span>
              </article>
            </div>
          )}

          <div className="content-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Create a New Ticket</h2>
                <p>Tell us what you need help with.</p>
              </div>

              <form className="ticket-form" onSubmit={handleCreateTicket}>
                <div className="field">
                  <label htmlFor="subject">Subject</label>

                  <input
                    id="subject"
                    type="text"
                    value={ticketForm.subject}
                    onChange={(event) =>
                      setTicketForm({
                        ...ticketForm,
                        subject: event.target.value,
                      })
                    }
                    placeholder="Enter subject"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="description">
                    Description
                  </label>

                  <textarea
                    id="description"
                    value={ticketForm.description}
                    onChange={(event) =>
                      setTicketForm({
                        ...ticketForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="Describe your issue in detail..."
                    required
                  />
                </div>

                <div className="field field-short">
                  <label htmlFor="priority">Priority</label>

                  <select
                    id="priority"
                    value={ticketForm.priority}
                    onChange={(event) =>
                      setTicketForm({
                        ...ticketForm,
                        priority: event.target.value,
                      })
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>

                <button className="button button-primary" type="submit">
                  Create Ticket
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>Ticket History</h2>
                <p>Your recent support requests</p>
              </div>

              {tickets.length === 0 ? (
                <p className="empty-state">No tickets found.</p>
              ) : (
                <div className="ticket-list">
                  {tickets.map((ticket) => (
                    <article className="ticket-row" key={ticket.id}>
                      <div className="ticket-main">
                        <button
                          className="ticket-subject"
                          type="button"
                          onClick={() =>
                            loadTicketDetails(ticket.id)
                          }
                        >
                          {ticket.subject}
                        </button>

                        <p>{ticket.description}</p>

                        <div className="ticket-meta">
                          <span>
                            Priority: {formatPriority(ticket.priority)}
                          </span>
                          <span>
                            Created: {formatDate(ticket.createdAt)}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`badge badge-${ticket.status.toLowerCase().replace("_", "-")}`}
                      >
                        {formatStatus(ticket.status)}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          {selectedTicket && (
            <div className="modal-overlay" role="presentation">
              <section
                className="ticket-modal"
                aria-modal="true"
                role="dialog"
                aria-labelledby="ticket-details-title"
              >
                <div className="modal-header">
                  <h2 id="ticket-details-title">Ticket Details</h2>

                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Close ticket details"
                    onClick={() => setSelectedTicket(null)}
                  >
                    X
                  </button>
                </div>

                <dl className="details-list">
                  <div>
                    <dt>ID</dt>
                    <dd>{selectedTicket.id}</dd>
                  </div>

                  <div>
                    <dt>Subject</dt>
                    <dd>{selectedTicket.subject}</dd>
                  </div>

                  <div>
                    <dt>Description</dt>
                    <dd>{selectedTicket.description}</dd>
                  </div>

                  <div>
                    <dt>Priority</dt>
                    <dd>
                      <span className="badge badge-priority">
                        {selectedTicket.priority}
                      </span>
                    </dd>
                  </div>

                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span
                        className={`badge badge-${selectedTicket.status.toLowerCase().replace("_", "-")}`}
                      >
                        {formatStatus(selectedTicket.status)}
                      </span>
                    </dd>
                  </div>

                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(selectedTicket.createdAt)}</dd>
                  </div>
                </dl>

                <div className="modal-footer">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setSelectedTicket(null)}
                  >
                    Back to Main
                  </button>
                </div>
              </section>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark large" aria-hidden="true">
            W
          </div>
          <h1>WorkSeal Demo</h1>
          <p>Customer Support Portal</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <p className="alert" role="alert">{error}</p>
          )}

          <button className="button button-primary" type="submit">
            Login
          </button>
        </form>
      </section>
    </main>
  );
}

export default App;
