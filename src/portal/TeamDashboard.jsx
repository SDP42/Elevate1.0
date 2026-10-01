import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import RequireRole from "./RequireRole";
import { EVENT } from "../config";
import useHeroCloud from "./useHeroCloud";
import { leaderboard, logout, psList, selectPs } from "./api";

const LightbulbIcon = () => (
  <svg className="portal-card__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.4 10.9c.5.4.9 1 .9 1.6V16h5v-.5c0-.6.3-1.2.9-1.6A6 6 0 0 0 12 3Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TrophyIcon = () => (
  <svg className="portal-card__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM7 5H4v1a4 4 0 0 0 4 4M17 5h3v1a4 4 0 0 1-4 4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* The nose-to-tail of a boarding pass, carried through from the marketing
   site's own ticket (src/components/BoardingPass.jsx): QR on the left
   behind a perforated notch, a route down the middle, a dark stub on the
   right — now floating over the same painted cloud sea as that section,
   not just a flat dark page, and carrying the team's chosen problem
   statement once they have one. */
function Ticket({ team, psTitle }) {
  const [qrUrl, setQrUrl] = useState("");
  const cloudUrl = useHeroCloud();

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(`ELEVATE1:${team.qr_token}`, { margin: 1, width: 320 }).then((url) => {
      if (!cancelled) setQrUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [team.qr_token]);

  return (
    <div className="ticket-stage">
      {cloudUrl && <img className="ticket-stage__cloud" src={cloudUrl} alt="" aria-hidden="true" />}
      <div className="ticket">
        <div className="ticket__body">
          <div className="ticket__qr">
            {qrUrl && <img src={qrUrl} alt={`QR code for ${team.team_code}`} />}
            <span className="ticket__qrLabel">Scan at meals &amp; check-in</span>
          </div>

          <div className="ticket__perf" aria-hidden="true" />

          <div className="ticket__main">
            <div className="ticket__route">
              <div className="ticket__place">
                <span className="ticket__city">
                  {team.team_code},
                  <br />
                  your idea
                </span>
                <strong className="ticket__code">IDEA</strong>
                <span className="ticket__when">Sat, 10 October</span>
              </div>

              <div className="ticket__path" aria-hidden="true">
                <span />
                <svg viewBox="0 0 24 24">
                  <path d="M22 12 L3 5 L6 12 L3 19 Z" fill="currentColor" />
                </svg>
                <span />
              </div>

              <div className="ticket__place ticket__place--to">
                <span className="ticket__city">
                  DJSCE,
                  <br />
                  {EVENT.city}
                </span>
                <strong className="ticket__code">DEMO</strong>
                <span className="ticket__when">Sun, 11 October</span>
              </div>
            </div>

            <dl className="ticket__rows">
              <div>
                <dt>Team</dt>
                <dd>{team.team_code}</dd>
              </div>
              <div>
                <dt>Seat</dt>
                <dd>{team.seat_no ?? "—"}</dd>
              </div>
              <div>
                <dt>Terminal</dt>
                <dd>DJSCE</dd>
              </div>
              <div>
                <dt>Gate</dt>
                <dd>{EVENT.city}</dd>
              </div>
              <div>
                <dt>Boarding</dt>
                <dd>10 Oct</dd>
              </div>
            </dl>

            {psTitle && (
              <div className="ticket__ps">
                <span>Flying with</span>
                <strong>{psTitle}</strong>
              </div>
            )}

            <div className="ticket__passengers">
              <span className="ticket__passengersLabel">Passengers</span>
              <ul>
                {team.members.map((m) => (
                  <li key={m.id}>
                    {m.name}
                    {m.is_lead && <em>Lead</em>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="ticket__stub">
          <span className="ticket__stubTitle">Boarding Pass</span>
          <span className="ticket__stubBrand">
            ELEVATE <em>1.0</em>
          </span>
        </div>
      </div>
    </div>
  );
}

function ProblemStatement({ data, error, picking, onPick }) {
  return (
    <section className="portal-card">
      <h3>
        <LightbulbIcon />
        Problem statement
      </h3>

      {error && <p className="portal-auth__error">{error}</p>}

      {data && data.problemStatements.length === 0 && (
        <p>Problem statements will be revealed soon. Come back here to pick yours once they're live.</p>
      )}

      {data && data.problemStatements.length > 0 && (
        <ul className="portal-psList">
          {data.problemStatements.map((ps) => {
            const isMine = data.selectedPsId === ps.id;
            const disabled = (ps.full && !isMine) || picking === ps.id;
            return (
              <li key={ps.id} className={isMine ? "is-selected" : undefined}>
                <div className="portal-psList__head">
                  <strong>{ps.title}</strong>
                  {ps.capacity !== null && (
                    <span className="portal-psList__seats">
                      {ps.taken}/{ps.capacity} teams
                    </span>
                  )}
                </div>
                {ps.description && <p>{ps.description}</p>}
                <button
                  type="button"
                  className="portal-auth__submit"
                  disabled={disabled}
                  onClick={() => onPick(ps.id)}
                >
                  {isMine ? "Selected ✓" : ps.full ? "Full" : picking === ps.id ? "Selecting…" : "Select"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Leaderboard({ ownTeamCode }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    leaderboard()
      .then((d) => setRows(d.leaderboard))
      .catch((err) => setError(err.message));
  }, []);

  const anyScored = rows?.some((r) => r.score !== null);

  return (
    <section className="portal-card">
      <h3>
        <TrophyIcon />
        Leaderboard
      </h3>
      <p className="portal-card__hint">
        Round 1 doesn't carry marks — these are Round 2 mentoring scores, updated live.
      </p>
      {error && <p className="portal-auth__error">{error}</p>}
      {rows && !anyScored && <p>No Round 2 scores entered yet — check back after your mentoring session.</p>}
      {rows && anyScored && (
        <ul className="portal-leaderboard">
          {rows.map((r) => {
            const isOwn = r.teamCode === ownTeamCode;
            const rankClass = r.rank === 1 ? " is-rank-1" : r.rank === 2 ? " is-rank-2" : r.rank === 3 ? " is-rank-3" : "";
            return (
              <li key={r.teamCode} className={`${isOwn ? "is-own" : ""}${rankClass}`}>
                <span className="portal-leaderboard__rank">{r.rank ?? "—"}</span>
                <span className="portal-leaderboard__team">
                  <span className="portal-leaderboard__code">
                    {r.teamCode}
                    {isOwn && <span className="portal-leaderboard__you">You</span>}
                  </span>
                </span>
                <span className={`portal-leaderboard__score${r.score === null ? " is-pending" : ""}`}>
                  {r.score === null ? "Pending" : r.score}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TeamHome({ session }) {
  const navigate = useNavigate();
  const [psData, setPsData] = useState(null);
  const [psError, setPsError] = useState("");
  const [picking, setPicking] = useState(null);

  function loadPs() {
    psList()
      .then(setPsData)
      .catch((err) => setPsError(err.message));
  }

  useEffect(loadPs, []);

  async function onPick(psId) {
    setPsError("");
    setPicking(psId);
    try {
      await selectPs(psId);
      loadPs();
    } catch (err) {
      setPsError(err.message);
    } finally {
      setPicking(null);
    }
  }

  async function onLogout() {
    await logout();
    navigate("/portal/login", { replace: true });
  }

  const selectedPsTitle = psData?.problemStatements.find((p) => p.id === psData.selectedPsId)?.title;

  return (
    <div className="portal-page">
      <div className="portal-page__head">
        <div>
          <span className="portal-page__eyebrow">Elevate 1.0 · Team Portal</span>
          <h1>{session.displayName}</h1>
        </div>
        <button type="button" className="portal-logout" onClick={onLogout}>
          Log out
        </button>
      </div>

      {session.team && <Ticket team={session.team} psTitle={selectedPsTitle} />}

      <ProblemStatement data={psData} error={psError} picking={picking} onPick={onPick} />

      <Leaderboard ownTeamCode={session.team?.team_code} />
    </div>
  );
}

export default function TeamDashboard() {
  return <RequireRole role="team">{(session) => <TeamHome session={session} />}</RequireRole>;
}
