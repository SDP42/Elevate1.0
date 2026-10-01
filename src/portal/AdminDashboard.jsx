import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import {
  adminAccounts,
  adminMeals,
  adminSavePs,
  adminSaveTeamMembers,
  adminTeams,
  coreTeams,
  logout,
  psList,
} from "./api";

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

  useEffect(() => {
    Promise.all([adminTeams(), adminAccounts(), coreTeams(), adminMeals()])
      .then(([t, a, m, meal]) => {
        setTeams(t.teams);
        setAccounts(a.accounts);
        setMarksTeams(m.teams);
        setMeals(meal.slots);
      })
      .catch((err) => setError(err.message));
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
        <h3>Teams ({teams?.length ?? "…"})</h3>
        <p className="portal-card__hint">
          This is the whole teams table, straight from the database — the login a team was given,
          their seat, and everyone on their roster.
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

      <PsManager problemStatements={problemStatements} onSaved={loadPs} />

      <section className="portal-card">
        <h3>Staff accounts ({accounts?.length ?? "…"})</h3>
        <p className="portal-card__hint">Core, meal and admin logins. Passwords aren't stored anywhere retrievable — only the sheet from setup has them.</p>
        {accounts && (
          <div className="portal-tableWrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Username</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="portal-table__role">{a.role}</td>
                    <td>{a.username}</td>
                    <td>{a.display_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="portal-card">
        <h3>Round 2 marks</h3>
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
        <h3>Meals served</h3>
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
    </div>
  );
}

export default function AdminDashboard() {
  return <RequireRole role="admin">{(session) => <AdminHome session={session} />}</RequireRole>;
}
