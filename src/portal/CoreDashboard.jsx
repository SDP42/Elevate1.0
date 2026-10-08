import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import FinalMarksEditor from "./FinalMarksEditor";
import {
  coreSaveRound1Note,
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
  return <tr><td>{team.teamName}<div className="portal-table__sub">{team.teamCode}{team.psCode && ` · ${team.psCode}`}</div></td><td>{team.seatNo ?? '—'}</td>
    <td><FinalMarksEditor team={team} onSaved={saved => onSaved(team.id, saved)} /><FinalMarksEditor team={team} stage="judging1" onSaved={saved=>onSaved(team.id,saved)} />{team.finalRoundShortlisted && <FinalMarksEditor team={team} stage="final" onSaved={saved=>onSaved(team.id,saved)} />}</td>
    <td className="portal-table__note"><strong>Mentoring 1 feedback</strong><p>{team.mentoring1Feedback || '—'}</p><strong>Mentoring 2 feedback</strong><p>{team.mentoring2Feedback || '—'}</p></td>
    <td className="portal-no-print"><RecuseButton team={team} onRecused={onRecused} /></td></tr>;
}

function PrintBackup({ teams, generatedAt }) {
  return <table className="portal-print-table"><caption>Elevate 1.0 — Final marks, printed {generatedAt}</caption><thead><tr><th>Team</th><th>PS</th><th>Mentoring 1 score</th><th>Judging Round 1 score</th><th>Final round score</th><th>Mentoring 1 feedback</th><th>Mentoring 2 feedback</th></tr></thead><tbody>{teams.map(t=><tr key={t.id}><td>{t.teamCode}</td><td>{t.psCode || ''}</td><td>{t.mentoring1Score ?? ''}</td><td>{t.judgingRound1Score ?? ''}</td><td>{t.finalRoundShortlisted ? t.finalRoundScore ?? '' : ''}</td><td>{t.mentoring1Feedback || ''}</td><td>{t.mentoring2Feedback || ''}</td></tr>)}</tbody></table>;
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

  function onSaved(teamId, saved) {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, ...saved } : t)));
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
          Enter Mentoring 1 and Judging Round 1 scores, with two mentoring feedbacks. Only shortlisted teams have final-round scoring. Feedback stays hidden from participants until an admin releases it. Use "Print backup" for a paper copy of everything
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
                  <th>Scoring rounds</th><th>Mentoring feedback</th>
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
