import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import { CRITERIA, MAX_TOTAL } from "../../shared/criteria.js";
import {
  coreSaveRound1Note,
  coreSubmitMark,
  coreTeams,
  coreToggleRecuse,
  logout,
} from "./api";

function RecuseButton({ team, onRecused }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="portal-logout"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`Recuse yourself from ${team.teamCode}? You'll stop seeing them — admin can reassign.`)) return;
        setBusy(true);
        try {
          await coreToggleRecuse(team.id);
          onRecused(team.id);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "…" : "Recuse (conflict of interest)"}
    </button>
  );
}

function MarksRow({ team, onSaved, onRecused }) {
  const [values, setValues] = useState(() => {
    const initial = {};
    for (const c of CRITERIA) initial[c.key] = team.criteria?.[c.key] ?? "";
    return initial;
  });
  const [feedback, setFeedback] = useState(team.feedback || "");
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
      await coreSubmitMark(team.id, criteria, feedback);
      setSaved(true);
      onSaved(team.id, { score: total, criteria, feedback });
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
      <td>
        {team.teamCode}
        {team.psCode && (
          <div className="portal-table__sub" title={team.psDescription || undefined}>
            {team.psCode}
            {team.psDescription && " · " + team.psDescription.slice(0, 40) + (team.psDescription.length > 40 ? "…" : "")}
          </div>
        )}
        {team.slotTime && <div className="portal-table__sub">Slot: {team.slotTime}</div>}
      </td>
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
        <input
          className="portal-feedbackInput"
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value);
            setSaved(false);
          }}
          placeholder="Feedback for the team"
          aria-label={`Feedback for ${team.teamCode}`}
        />
      </td>
      <td>
        <button type="button" className="portal-logout" onClick={save} disabled={saving || !complete}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
        {error && <div className="portal-marksError">{error}</div>}
      </td>
      <td className="portal-no-print">
        <RecuseButton team={team} onRecused={onRecused} />
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
      <caption>Elevate 1.0 — Round 2 marks, printed {generatedAt}</caption>
      <thead>
        <tr>
          <th>Team</th>
          <th>PS</th>
          {CRITERIA.map((c) => (
            <th key={c.key}>
              {c.label} (/{c.max})
            </th>
          ))}
          <th>Total (/{MAX_TOTAL})</th>
          <th>Feedback</th>
        </tr>
      </thead>
      <tbody>
        {teams.map((t) => (
          <tr key={t.id}>
            <td>{t.teamCode}</td>
            <td>{t.psCode || ""}</td>
            {CRITERIA.map((c) => (
              <td key={c.key}>{t.criteria?.[c.key] ?? ""}</td>
            ))}
            <td>{t.score ?? ""}</td>
            <td>{t.feedback || ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Round1Notes({ teams, onSaved }) {
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(null);

  async function save(teamId) {
    const note = draft[teamId];
    if (!note || !note.trim()) return;
    setBusy(teamId);
    try {
      await coreSaveRound1Note(teamId, note.trim());
      onSaved(teamId, note.trim());
      setDraft((prev) => ({ ...prev, [teamId]: "" }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="portal-card portal-no-print">
      <h3>Round 1 notes</h3>
      <p className="portal-card__hint">
        Round 1 doesn't carry marks, but a quick shortlisting note here is visible to every core and
        admin account. Each save adds a new note — the latest one shows in the marks table above.
      </p>
      <div className="portal-tableWrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Latest note</th>
              <th>Add a note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id}>
                <td>{t.teamCode}</td>
                <td className="portal-table__note">{t.round1Note || "—"}</td>
                <td>
                  <input
                    className="portal-feedbackInput"
                    value={draft[t.id] || ""}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    placeholder="New note"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="portal-logout"
                    onClick={() => save(t.id)}
                    disabled={busy === t.id || !draft[t.id]?.trim()}
                  >
                    {busy === t.id ? "Saving…" : "Add"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CoreHome({ session }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState("");

  const loadTeams = useCallback(() => {
    coreTeams()
      .then((d) => setTeams(d.teams))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadTeams();
    const timer = setInterval(loadTeams, 12000);
    return () => clearInterval(timer);
  }, [loadTeams]);

  function onSaved(teamId, { score, criteria, feedback }) {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, score, criteria, feedback } : t)));
  }

  function onRound1Saved(teamId, note) {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, round1Note: note } : t)));
  }

  function onRecused(teamId) {
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
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
          Each category is out of {CRITERIA[0].max}, {MAX_TOTAL} total. Saved scores and feedback show
          up for the team immediately. Use "Print backup" any time for a paper copy of everything
          entered so far. You're seeing {teams?.length ?? "…"} team{teams?.length === 1 ? "" : "s"} —
          every team, unless an admin has assigned you a specific subset.
        </p>

        {error && <p className="portal-auth__error">{error}</p>}

        {teams && teams.filter((t) => t.shortlisted).length === 0 && (
          <p className="portal-card__hint portal-u-mt">
            No teams have been shortlisted for Round 2 yet. Once administrators shortlist teams, their scoring sheets will appear here.
          </p>
        )}

        {teams && teams.filter((t) => t.shortlisted).length > 0 && (
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
                  <th>Feedback</th>
                  <th></th>
                  <th className="portal-no-print"></th>
                </tr>
              </thead>
              <tbody>
                {teams
                  .filter((t) => t.shortlisted)
                  .map((t) => (
                    <MarksRow key={t.id} team={t} onSaved={onSaved} onRecused={onRecused} />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {teams && <Round1Notes teams={teams} onSaved={onRound1Saved} />}

      {teams && (
        <PrintBackup
          teams={teams.filter((t) => t.shortlisted)}
          generatedAt={new Date().toLocaleString()}
        />
      )}
    </div>
  );
}

export default function CoreDashboard() {
  return <RequireRole role="core">{(session) => <CoreHome session={session} />}</RequireRole>;
}
