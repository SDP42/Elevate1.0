import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import { coreSubmitMark, coreTeams, logout } from "./api";

function MarksRow({ team, onSaved }) {
  const [value, setValue] = useState(team.score ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (value === "" || Number.isNaN(Number(value))) return;
    setSaving(true);
    setSaved(false);
    try {
      await coreSubmitMark(team.id, Number(value));
      setSaved(true);
      onSaved(team.id, Number(value));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{team.teamCode}</td>
      <td>{team.seatNo ?? "—"}</td>
      <td>
        <input
          className="portal-marksInput"
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
        />
      </td>
      <td>
        <button type="button" className="portal-logout" onClick={save} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </td>
    </tr>
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

  function onSaved(teamId, score) {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, score } : t)));
  }

  async function onLogout() {
    await logout();
    navigate("/portal/login", { replace: true });
  }

  return (
    <div className="portal-page">
      <div className="portal-page__head">
        <div>
          <span className="portal-page__eyebrow">Elevate 1.0 · Core Portal</span>
          <h1>{session.displayName}</h1>
        </div>
        <button type="button" className="portal-logout" onClick={onLogout}>
          Log out
        </button>
      </div>

      <section className="portal-card">
        <h3>Round 2 marks entry</h3>
        <p className="portal-card__hint">
          Round 1 doesn't carry marks, so there's nothing to enter for it — this is Round 2 only.
          Saved scores show up on every team's leaderboard immediately.
        </p>

        {error && <p className="portal-auth__error">{error}</p>}

        {teams && (
          <div className="portal-tableWrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Seat</th>
                  <th>Score</th>
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
    </div>
  );
}

export default function CoreDashboard() {
  return <RequireRole role="core">{(session) => <CoreHome session={session} />}</RequireRole>;
}
