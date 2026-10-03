import { useEffect, useState } from "react";
import { superAuditFull, superLoginActivity, superPersonaActivity } from "./api";

const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

const EVENT_LABEL = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.login_failed": "Failed attempt",
};

function LoginActivity() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  function load() {
    superLoginActivity()
      .then(setData)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  return (
    <section className="portal-card">
      <div className="portal-card__headRow">
        <h3>Login activity</h3>
        <button type="button" className="portal-logout" onClick={load}>
          Refresh
        </button>
      </div>
      <p className="portal-card__hint">
        Who has signed in, how often, and when they were last seen — every account, every persona.
        Failed attempts are counted against the username that was tried.
      </p>
      {error && <p className="portal-auth__error">{error}</p>}

      {data && (
        <>
          <div className="portal-tableWrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Last login</th>
                  <th>Logins</th>
                  <th>Failed attempts</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <tr key={a.username} className={a.failedAttempts > 0 ? "is-alert-row" : undefined}>
                    <td>
                      {a.username}
                      <div className="portal-table__sub">{a.displayName}</div>
                    </td>
                    <td className="portal-table__role">{a.role}</td>
                    <td>{fmt(a.lastLogin)}</td>
                    <td>{a.logins}</td>
                    <td>{a.failedAttempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="portal-subhead">Recent sign-ins and sign-outs</h4>
          <div className="portal-tableWrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.id} className={e.action === "auth.login_failed" ? "is-alert-row" : undefined}>
                    <td>{fmt(e.at)}</td>
                    <td>{e.username || "—"}</td>
                    <td className="portal-table__role">{e.role || "—"}</td>
                    <td>{EVENT_LABEL[e.action] || e.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function PersonaActivity() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    superPersonaActivity()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section className="portal-card">
      <h3>Persona activity</h3>
      <p className="portal-card__hint">
        What each staff account has actually done — actions logged, plus the records they created:
        marks entered per core account, meals served per counter, members checked in per desk.
      </p>
      {error && <p className="portal-auth__error">{error}</p>}

      {data && (
        <>
          <div className="portal-tableWrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Actions</th>
                  <th>Last action</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <tr key={a.username}>
                    <td>{a.username}</td>
                    <td className="portal-table__role">{a.role}</td>
                    <td>{a.actions}</td>
                    <td>{fmt(a.lastAction)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="portal-personaGrid">
            <div>
              <h4 className="portal-subhead">Core — marks &amp; notes</h4>
              <ul className="portal-tally">
                {data.core.map((c) => (
                  <li key={c.username}>
                    <span>{c.username}</span>
                    <strong>
                      {c.marksEntered} marks · {c.round1Notes} notes
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="portal-subhead">Meal — members served</h4>
              <ul className="portal-tally">
                {data.meal.map((m) => (
                  <li key={m.username}>
                    <span>{m.username}</span>
                    <strong>{m.served}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="portal-subhead">Registration desk — members checked</h4>
              <ul className="portal-tally">
                {data.regidesk.map((r) => (
                  <li key={r.username}>
                    <span>{r.username}</span>
                    <strong>{r.membersChecked}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

const ROLE_FILTERS = ["", "team", "core", "meal", "regidesk", "admin", "superadmin"];

function FullAudit() {
  const [role, setRole] = useState("");
  const [action, setAction] = useState("");
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    superAuditFull(role, action.trim())
      .then((d) => setEntries(d.entries))
      .catch((err) => setError(err.message));
  }, [role, action]);

  return (
    <section className="portal-card">
      <h3>Full audit trail</h3>
      <p className="portal-card__hint">
        Every logged action across all personas, newest first. Filter by who did it, or by the start
        of the action name (e.g. <code>mark</code>, <code>meal</code>, <code>ps</code>,{" "}
        <code>auth</code>).
      </p>

      <div className="portal-filterRow">
        <label className="portal-field">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_FILTERS.map((r) => (
              <option key={r} value={r}>
                {r || "All roles"}
              </option>
            ))}
          </select>
        </label>
        <label className="portal-field">
          <span>Action starts with</span>
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. mark" />
        </label>
      </div>

      {error && <p className="portal-auth__error">{error}</p>}
      {entries && entries.length === 0 && <p>No matching entries.</p>}
      {entries && entries.length > 0 && (
        <div className="portal-tableWrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{fmt(e.createdAt)}</td>
                  <td>{e.username ? `${e.username} (${e.role})` : "—"}</td>
                  <td>{e.action}</td>
                  <td className="portal-table__note">{e.detail ? JSON.stringify(e.detail) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function SuperAdminOversight() {
  return (
    <>
      <LoginActivity />
      <PersonaActivity />
      <FullAudit />
    </>
  );
}
