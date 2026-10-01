import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import { CRITERIA, MAX_TOTAL } from "../../shared/criteria.js";
import { coreSubmitMark, coreTeams, logout } from "./api";

function MarksRow({ team, onSaved }) {
  const [values, setValues] = useState(() => {
    const initial = {};
    for (const c of CRITERIA) initial[c.key] = team.criteria?.[c.key] ?? "";
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const total = CRITERIA.reduce((sum, c) => {
    const v = Number(values[c.key]);
    return sum + (Number.isNaN(v) ? 0 : v);
  }, 0);

  const complete = CRITERIA.every((c) => values[c.key] !== "" && !Number.isNaN(Number(values[c.key])));

  async function save() {
    if (!complete) return;
    setSaving(true);
    setSaved(false);
    setError("");
    const criteria = {};
    for (const c of CRITERIA) criteria[c.key] = Number(values[c.key]);
    try {
      await coreSubmitMark(team.id, criteria);
      setSaved(true);
      onSaved(team.id, { score: total, criteria });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function setField(key, raw) {
    setValues((prev) => ({ ...prev, [key]: raw }));
    setSaved(false);
  }

  return (
    <tr>
      <td>{team.teamCode}</td>
      <td>{team.seatNo ?? "—"}</td>
      {CRITERIA.map((c) => (
        <td key={c.key}>
          <input
            className="portal-marksInput"
            type="number"
            min={0}
            max={c.max}
            inputMode="decimal"
            value={values[c.key]}
            onChange={(e) => setField(c.key, e.target.value)}
            aria-label={`${c.label} (out of ${c.max})`}
          />
        </td>
      ))}
      <td className="portal-marksTotal">{total}</td>
      <td>
        <button type="button" className="portal-logout" onClick={save} disabled={saving || !complete}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
        {error && <div className="portal-marksError">{error}</div>}
      </td>
    </tr>
  );
}

/* A plain, read-only mirror of the same data — hidden on screen, shown
   only by the print stylesheet. Printing the live table of number inputs
   works in most browsers, but this gives a clean paper backup regardless
   of how a given browser happens to render <input> on paper. */
function PrintBackup({ teams, generatedAt }) {
  return (
    <table className="portal-print-table">
      <caption>
        Elevate 1.0 — Round 2 marks, printed {generatedAt}
      </caption>
      <thead>
        <tr>
          <th>Team</th>
          {CRITERIA.map((c) => (
            <th key={c.key}>
              {c.label} (/{c.max})
            </th>
          ))}
          <th>Total (/{MAX_TOTAL})</th>
        </tr>
      </thead>
      <tbody>
        {teams.map((t) => (
          <tr key={t.id}>
            <td>{t.teamCode}</td>
            {CRITERIA.map((c) => (
              <td key={c.key}>{t.criteria?.[c.key] ?? ""}</td>
            ))}
            <td>{t.score ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CoreHome({ session }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    coreTeams()
      .then((d) => setTeams(d.teams))
      .catch((err) => setError(err.message));
  }, []);

  function onSaved(teamId, { score, criteria }) {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, score, criteria } : t)));
  }

  async function onLogout() {
    await logout();
    navigate("/portal/login", { replace: true });
  }

  return (
    <div className="portal-page">
      <div className="portal-page__head portal-no-print">
        <div>
          <span className="portal-page__eyebrow">Elevate 1.0 · Core Portal</span>
          <h1>{session.displayName}</h1>
        </div>
        <button type="button" className="portal-logout" onClick={onLogout}>
          Log out
        </button>
      </div>

      <section className="portal-card portal-no-print">
        <div className="portal-card__headRow">
          <h3>Round 2 marks entry</h3>
          {teams && (
            <button type="button" className="portal-logout" onClick={() => window.print()}>
              Print backup
            </button>
          )}
        </div>
        <p className="portal-card__hint">
          Round 1 doesn't carry marks, so there's nothing to enter for it — this is Round 2 only.
          Each category is out of {CRITERIA[0].max}, {MAX_TOTAL} total. Saved scores show up on every
          team's leaderboard immediately. Use "Print backup" any time for a paper copy of everything
          entered so far.
        </p>

        {error && <p className="portal-auth__error">{error}</p>}

        {teams && (
          <div className="portal-tableWrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Seat</th>
                  {CRITERIA.map((c) => (
                    <th key={c.key}>
                      {c.label}
                      <br />
                      <span className="portal-table__sub">/{c.max}</span>
                    </th>
                  ))}
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <MarksRow key={t.id} team={t} onSaved={onSaved} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {teams && <PrintBackup teams={teams} generatedAt={new Date().toLocaleString()} />}
    </div>
  );
}

export default function CoreDashboard() {
  return <RequireRole role="core">{(session) => <CoreHome session={session} />}</RequireRole>;
}
