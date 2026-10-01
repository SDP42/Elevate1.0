import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import {
  adminAccounts,
  adminAnnouncements,
  adminApprovePs,
  adminAssignments,
  adminAudit,
  adminBulkImport,
  adminExport,
  adminMeals,
  adminPsRequests,
  adminResetPassword,
  adminRevokePs,
  adminSaveAnnouncement,
  adminSaveAssignment,
  adminSavePs,
  adminSaveTeamMembers,
  adminSaveTeamNotes,
  adminSetShortlist,
  adminTeams,
  coreTeams,
  logout,
  psList,
} from "./api";

function ExportButton({ type }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="portal-logout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await adminExport(type);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Exporting…" : "Export CSV"}
    </button>
  );
}

function RosterEditor({ team, onSaved }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(team.members.map((m) => m.name).join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const names = text.split("\n").map((s) => s.trim()).filter(Boolean);
    setBusy(true);
    setError("");
    try {
      await adminSaveTeamMembers(team.id, names);
      onSaved(team.id, names);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="portal-logout" onClick={() => setOpen(true)}>
        Edit roster
      </button>
    );
  }

  return (
    <div className="portal-rosterEditor">
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="One name per line, 2 to 4 names"
      />
      {error && <p className="portal-auth__error">{error}</p>}
      <div className="portal-scanResult__actions">
        <button type="button" className="portal-auth__submit" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="portal-logout" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ShortlistToggle({ team, onChanged }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await adminSetShortlist(team.id, !team.shortlisted);
      onChanged(team.id, !team.shortlisted);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className="portal-logout" onClick={toggle} disabled={busy}>
      {team.shortlisted ? "Shortlisted ✓" : "Shortlist"}
    </button>
  );
}

function DietaryEditor({ team, onSaved }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(team.dietary || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await adminSaveTeamNotes(team.id, value);
      onSaved(team.id, value);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="portal-logout" onClick={() => setOpen(true)}>
        {team.dietary ? "Edit dietary" : "Add dietary"}
      </button>
    );
  }

  return (
    <div className="portal-rosterEditor">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Vegan, 1 member"
        className="portal-feedbackInput"
      />
      <div className="portal-scanResult__actions">
        <button type="button" className="portal-auth__submit" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="portal-logout" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ResetPasswordButton({ account }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function reset() {
    if (!window.confirm(`Generate a new password for ${account.username}? Their old one stops working immediately.`)) return;
    setBusy(true);
    try {
      const data = await adminResetPassword(account.id);
      setResult(data.password);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="portal-logout" onClick={reset} disabled={busy}>
        {busy ? "Resetting…" : "Reset password"}
      </button>
      {result && <div className="portal-newPassword">New password: {result}</div>}
    </div>
  );
}

function PsManager({ problemStatements, onSaved }) {
  const [form, setForm] = useState({ code: "", title: "", description: "", capacity: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addOrUpdate(ps) {
    setBusy(true);
    setError("");
    try {
      await adminSavePs(ps);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitNew(e) {
    e.preventDefault();
    if (!form.code.trim() || !form.title.trim()) return;
    await addOrUpdate({ ...form, revealed: false });
    setForm({ code: "", title: "", description: "", capacity: "" });
  }

  return (
    <section className="portal-card">
      <h3>Problem statements</h3>
      <p className="portal-card__hint">
        Add them here hidden, check them over, then hit Reveal when you're ready for teams to see
        and pick them.
      </p>

      {error && <p className="portal-auth__error">{error}</p>}

      {problemStatements && problemStatements.length > 0 && (
        <div className="portal-tableWrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Capacity</th>
                <th>Taken</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {problemStatements.map((ps) => (
                <tr key={ps.id}>
                  <td>{ps.code}</td>
                  <td>{ps.title}</td>
                  <td>{ps.capacity ?? "Unlimited"}</td>
                  <td>{ps.taken}</td>
                  <td>{ps.revealed ? "Revealed" : "Hidden"}</td>
                  <td>
                    <button
                      type="button"
                      className="portal-logout"
                      disabled={busy}
                      onClick={() =>
                        addOrUpdate({
                          code: ps.code,
                          title: ps.title,
                          description: ps.description,
                          capacity: ps.capacity,
                          revealed: !ps.revealed,
                        })
                      }
                    >
                      {ps.revealed ? "Hide" : "Reveal"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="portal-auth__form portal-psForm" onSubmit={submitNew}>
        <label className="portal-field">
          <span>Code</span>
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. PS1" required />
        </label>
        <label className="portal-field">
          <span>Title</span>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label className="portal-field">
          <span>Description</span>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className="portal-field">
          <span>Capacity (teams, blank = unlimited)</span>
          <input
            type="number"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          />
        </label>
        <button className="portal-auth__submit" type="submit" disabled={busy}>
          Add problem statement (hidden)
        </button>
      </form>
    </section>
  );
}

function PsRequestsManager() {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  function load() {
    adminPsRequests()
      .then((d) => setRequests(d.requests))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function approve(teamId) {
    setBusy(teamId);
    setError("");
    try {
      await adminApprovePs(teamId);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function revoke(teamId) {
    setBusy(teamId);
    try {
      await adminRevokePs(teamId);
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="portal-card">
      <h3>PS requests</h3>
      <p className="portal-card__hint">
        First-come-first-served order within each problem statement. Approving locks that team in and
        shows the allocation to every team; revoking frees it back up.
      </p>
      {error && <p className="portal-auth__error">{error}</p>}
      {requests && requests.length === 0 && <p>No requests yet.</p>}
      {requests && requests.length > 0 && (
        <div className="portal-tableWrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Problem statement</th>
                <th>Requested</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.teamId}>
                  <td>{r.teamCode}</td>
                  <td>
                    {r.psCode} · {r.psTitle}
                    {r.capacity !== null && (
                      <div className="portal-table__sub">
                        {r.taken}/{r.capacity} approved
                      </div>
                    )}
                  </td>
                  <td>{new Date(r.requestedAt).toLocaleString()}</td>
                  <td className="portal-table__role">{r.status}</td>
                  <td>
                    {r.status === "approved" ? (
                      <button type="button" className="portal-logout" onClick={() => revoke(r.teamId)} disabled={busy === r.teamId}>
                        {busy === r.teamId ? "…" : "Revoke"}
                      </button>
                    ) : (
                      <button type="button" className="portal-auth__submit" onClick={() => approve(r.teamId)} disabled={busy === r.teamId}>
                        {busy === r.teamId ? "…" : "Approve"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AnnouncementsManager() {
  const [items, setItems] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function load() {
    adminAnnouncements()
      .then((d) => setItems(d.announcements))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError("");
    try {
      await adminSaveAnnouncement({ message, active: true, sortOrder: items?.length ?? 0 });
      setMessage("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a) {
    await adminSaveAnnouncement({ id: a.id, message: a.message, active: !a.active, sortOrder: a.sortOrder });
    load();
  }

  return (
    <section className="portal-card">
      <h3>Announcements</h3>
      <p className="portal-card__hint">Shown to every logged-in team at the top of their dashboard, while active.</p>

      {error && <p className="portal-auth__error">{error}</p>}

      {items && items.length > 0 && (
        <ul className="portal-announceAdmin">
          {items.map((a) => (
            <li key={a.id} className={a.active ? undefined : "is-inactive"}>
              <span>{a.message}</span>
              <button type="button" className="portal-logout" onClick={() => toggleActive(a)}>
                {a.active ? "Deactivate" : "Activate"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="portal-manualLookup__row portal-u-mt" onSubmit={add}>
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="New announcement" />
        <button type="submit" className="portal-auth__submit" disabled={busy || !message.trim()}>
          Add
        </button>
      </form>
    </section>
  );
}

function AssignmentsManager({ teams }) {
  const [cores, setCores] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(new Set());
  const [busy, setBusy] = useState(false);

  function load() {
    adminAssignments()
      .then((d) => setCores(d.cores))
      .catch(() => {});
  }

  useEffect(load, []);

  function startEdit(core) {
    setEditing(core.id);
    setDraft(new Set(core.teamIds));
  }

  function toggleTeam(id) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(coreAccountId) {
    setBusy(true);
    try {
      await adminSaveAssignment(coreAccountId, [...draft]);
      setEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-card">
      <h3>Core assignments</h3>
      <p className="portal-card__hint">
        Narrow which teams a core account judges. Leave a core with no teams picked and they see
        every team — that's the default.
      </p>

      {cores && (
        <ul className="portal-assignList">
          {cores.map((c) => (
            <li key={c.id}>
              <div className="portal-assignList__head">
                <strong>{c.username}</strong>
                <span>{c.teamIds.length === 0 ? "sees all teams" : `${c.teamIds.length} team(s) assigned`}</span>
                {editing === c.id ? (
                  <button type="button" className="portal-logout" onClick={() => save(c.id)} disabled={busy}>
                    {busy ? "Saving…" : "Save"}
                  </button>
                ) : (
                  <button type="button" className="portal-logout" onClick={() => startEdit(c)}>
                    Edit
                  </button>
                )}
              </div>
              {editing === c.id && teams && (
                <div className="portal-assignList__teams">
                  {teams.map((t) => (
                    <label key={t.id}>
                      <input type="checkbox" checked={draft.has(t.id)} onChange={() => toggleTeam(t.id)} />
                      {t.teamCode}
                    </label>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AuditLog() {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    adminAudit()
      .then((d) => setEntries(d.entries))
      .catch(() => {});
  }, []);

  return (
    <section className="portal-card">
      <h3>Audit log</h3>
      <p className="portal-card__hint">Who did what, most recent first — for settling disputes on the day.</p>
      {entries && (
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
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
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

function BulkImport({ onDone }) {
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  async function run(e) {
    e.preventDefault();
    if (!csvText.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await adminBulkImport(csvText);
      setResults(data.results);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-card">
      <h3>Bulk roster import</h3>
      <p className="portal-card__hint">
        One team per line: <code>team_code,name1,name2,name3,name4</code> (2 to 4 names). Replaces
        each team's roster wholesale — same as editing them one by one, just all at once.
      </p>
      {error && <p className="portal-auth__error">{error}</p>}
      <form className="portal-auth__form" onSubmit={run}>
        <textarea
          rows={5}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"T1,Asha Rao,Vikram Shah,Dev Patel\nT2,..."}
          className="portal-bulkTextarea"
        />
        <button className="portal-auth__submit" type="submit" disabled={busy || !csvText.trim()}>
          {busy ? "Importing…" : "Import"}
        </button>
      </form>
      {results && (
        <ul className="portal-importResults">
          {results.map((r, i) => (
            <li key={i} className={r.ok ? "is-ok" : "is-error"}>
              {r.teamCode}: {r.ok ? "updated" : r.error}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AdminHome({ session }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [marksTeams, setMarksTeams] = useState(null);
  const [meals, setMeals] = useState(null);
  const [problemStatements, setProblemStatements] = useState(null);
  const [error, setError] = useState("");

  function loadPs() {
    psList()
      .then((d) => setProblemStatements(d.problemStatements))
      .catch((err) => setError(err.message));
  }

  function loadAll() {
    Promise.all([adminTeams(), adminAccounts(), coreTeams(), adminMeals()])
      .then(([t, a, m, meal]) => {
        setTeams(t.teams);
        setAccounts(a.accounts);
        setMarksTeams(m.teams);
        setMeals(meal.slots);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadAll();
    loadPs();
  }, []);

  function onRosterSaved(teamId, names) {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, members: names.map((name, i) => ({ id: `${teamId}-${i}`, name, isLead: i === 0 })) }
          : t
      )
    );
  }

  function onShortlistChanged(teamId, shortlisted) {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, shortlisted } : t)));
  }

  function onDietarySaved(teamId, dietary) {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, dietary } : t)));
  }

  async function onLogout() {
    await logout();
    navigate("/portal/login", { replace: true });
  }

  return (
    <div className="portal-page">
      <div className="portal-page__head">
        <div>
          <span className="portal-page__eyebrow">Elevate 1.0 · Admin · Full Access</span>
          <h1>{session.displayName}</h1>
        </div>
        <button type="button" className="portal-logout" onClick={onLogout}>
          Log out
        </button>
      </div>

      {error && <p className="portal-auth__error">{error}</p>}

      <section className="portal-card">
        <div className="portal-card__headRow">
          <h3>Teams ({teams?.length ?? "…"})</h3>
          <ExportButton type="teams" />
        </div>
        <p className="portal-card__hint">
          This is the whole teams table, straight from the database — the login a team was given,
          their seat, roster, shortlist status, dietary notes and submission.
        </p>
        {teams && (
          <div className="portal-tableWrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Seat</th>
                  <th>Username</th>
                  <th>Members</th>
                  <th>Submission</th>
                  <th></th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id}>
                    <td>{t.teamCode}</td>
                    <td>{t.seatNo ?? "—"}</td>
                    <td>{t.username}</td>
                    <td>{t.members.map((m) => m.name).join(", ")}</td>
                    <td className="portal-table__note">
                      {t.submissionUrl ? (
                        <a href={t.submissionUrl} target="_blank" rel="noopener noreferrer">
                          link
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <ShortlistToggle team={t} onChanged={onShortlistChanged} />
                    </td>
                    <td>
                      <DietaryEditor team={t} onSaved={onDietarySaved} />
                      {t.dietary && <div className="portal-table__note">{t.dietary}</div>}
                    </td>
                    <td>
                      <RosterEditor team={t} onSaved={onRosterSaved} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BulkImport onDone={loadAll} />

      <PsManager problemStatements={problemStatements} onSaved={loadPs} />

      <PsRequestsManager />

      <AnnouncementsManager />

      <AssignmentsManager teams={teams} />

      <section className="portal-card">
        <h3>Staff accounts ({accounts?.length ?? "…"})</h3>
        <p className="portal-card__hint">Core, meal and admin logins. Passwords aren't stored anywhere retrievable — reset generates a fresh one.</p>
        {accounts && (
          <div className="portal-tableWrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Username</th>
                  <th>Name</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="portal-table__role">{a.role}</td>
                    <td>{a.username}</td>
                    <td>{a.display_name}</td>
                    <td>
                      <ResetPasswordButton account={a} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="portal-card">
        <div className="portal-card__headRow">
          <h3>Round 2 marks</h3>
          <ExportButton type="marks" />
        </div>
        <p className="portal-card__hint">Same data core enters — mirrored here so admin never needs a separate report.</p>
        {marksTeams && (
          <div className="portal-tableWrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {marksTeams.map((t) => (
                  <tr key={t.id}>
                    <td>{t.teamCode}</td>
                    <td>{t.score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="portal-card">
        <div className="portal-card__headRow">
          <h3>Meals served</h3>
          <ExportButton type="meals" />
        </div>
        <p className="portal-card__hint">Members served so far at each slot, across every team.</p>
        {meals && (
          <div className="portal-tableWrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Served</th>
                </tr>
              </thead>
              <tbody>
                {meals.map((s) => (
                  <tr key={s.code}>
                    <td>
                      Day {s.dayNo} — {s.label}
                    </td>
                    <td>{s.served}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AuditLog />
    </div>
  );
}

export default function AdminDashboard() {
  return <RequireRole role="admin">{(session) => <AdminHome session={session} />}</RequireRole>;
}
