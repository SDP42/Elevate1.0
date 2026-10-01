import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import { logout, volunteerLookup } from "./api";

/* Lighter than admin — a floor-walking volunteer needs to look up a team's
   seat, roster and problem statement, and nothing else: no marks, no
   passwords, no settings. A plain filterable table, since this is meant
   to be used standing up, between things. */
function VolunteerHome({ session }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    volunteerLookup()
      .then((d) => setTeams(d.teams))
      .catch((err) => setError(err.message));
  }, []);

  async function onLogout() {
    await logout();
    navigate("/portal/login", { replace: true });
  }

  const needle = filter.trim().toLowerCase();
  const filtered = teams
    ? teams.filter(
        (t) =>
          !needle ||
          t.teamCode.toLowerCase().includes(needle) ||
          t.members.toLowerCase().includes(needle) ||
          (t.psCode || "").toLowerCase().includes(needle)
      )
    : null;

  return (
    <div className="portal-page">
      <div className="portal-page__head">
        <div>
          <span className="portal-page__eyebrow">Elevate 1.0 · Volunteer Lookup</span>
          <h1>{session.displayName}</h1>
        </div>
        <button type="button" className="portal-logout" onClick={onLogout}>
          Log out
        </button>
      </div>

      <section className="portal-card">
        <h3>Find a team</h3>
        <p className="portal-card__hint">
          Seat, roster and problem statement for every team — look someone up instead of guessing
          where to send them.
        </p>

        {error && <p className="portal-auth__error">{error}</p>}

        <label className="portal-field portal-u-mt">
          <span>Search</span>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Team code, name, or PS code" />
        </label>

        {filtered && (
          <div className="portal-tableWrap portal-u-mt">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Seat</th>
                  <th>Members</th>
                  <th>Problem statement</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td>{t.teamCode}</td>
                    <td>{t.seatNo ?? "—"}</td>
                    <td>{t.members || "—"}</td>
                    <td>{t.psCode ? `${t.psCode} · ${t.psTitle}` : "—"}</td>
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

export default function VolunteerDashboard() {
  return <RequireRole role="volunteer">{(session) => <VolunteerHome session={session} />}</RequireRole>;
}
