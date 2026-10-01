import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import RequireRole from "./RequireRole";
import { EVENT, EVENT_START } from "../config";
import { CRITERIA } from "../../shared/criteria.js";
import useHeroCloud from "./useHeroCloud";
import { leaderboard, logout, psList, selectPs, submitProject } from "./api";

/* Days/hours/minutes/seconds to a target — the same mechanic as the
   marketing site's own "Gates open in" timer (src/components/BoardingPass),
   reused here so the portal always agrees with the public site about how
   much time is left. */
function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(target.getTime() - now, 0);
  return {
    done: left === 0,
    parts: [
      ["Days", Math.floor(left / 86400000)],
      ["Hrs", Math.floor((left % 86400000) / 3600000)],
      ["Min", Math.floor((left % 3600000) / 60000)],
      ["Sec", Math.floor((left % 60000) / 1000)],
    ],
  };
}

function Countdown() {
  const countdown = useCountdown(EVENT_START);
  return (
    <section className="portal-countdown">
      <span className="portal-countdown__label">
        {countdown.done ? "Gates are open" : "Gates open in"}
      </span>
      <div className="portal-countdown__parts">
        {countdown.parts.map(([label, value]) => (
          <div key={label}>
            <strong>{String(value).padStart(2, "0")}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Announcements({ messages }) {
  if (!messages || messages.length === 0) return null;
  return (
    <div className="portal-announce">
      {messages.map((m, i) => (
        <p key={i}>📣 {m}</p>
      ))}
    </div>
  );
}

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
  const locked = data?.selectionStatus === "approved";

  return (
    <section className="portal-card">
      <h3>
        <LightbulbIcon />
        Problem statement
      </h3>
      <p className="portal-card__hint">
        First come, first served — requesting one puts you in the queue, but it's only official once
        admin approves it. You can switch your request freely until then; once approved, it's locked
        in.
      </p>

      {error && <p className="portal-auth__error">{error}</p>}

      {data && data.problemStatements.length === 0 && (
        <p>Problem statements will be revealed soon. Come back here to pick yours once they're live.</p>
      )}

      {data && data.problemStatements.length > 0 && (
        <ul className="portal-psList">
          {data.problemStatements.map((ps) => {
            const isMine = data.selectedPsId === ps.id;
            const disabled = (locked && !isMine) || picking === ps.id;
            let label = picking === ps.id ? "Requesting…" : "Request";
            if (isMine && locked) label = "Approved ✓";
            else if (isMine) label = "Requested — pending";

            return (
              <li key={ps.id} className={isMine ? (locked ? "is-approved" : "is-selected") : undefined}>
                <div className="portal-psList__head">
                  <strong>{ps.title}</strong>
                  {ps.capacity !== null && (
                    <span className="portal-psList__seats">
                      {ps.taken}/{ps.capacity} approved
                    </span>
                  )}
                </div>
                {ps.description && <p>{ps.description}</p>}
                <button
                  type="button"
                  className="portal-auth__submit"
                  disabled={disabled || (isMine && !locked)}
                  onClick={() => onPick(ps.id)}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.allocations.length > 0 && (
        <div className="portal-allocBoard">
          <span className="portal-allocBoard__label">Confirmed allocations, so far</span>
          <ul>
            {data.allocations.map((a) => (
              <li key={a.teamCode}>
                <strong>{a.teamCode}</strong> → {a.psCode ? `${a.psCode} · ` : ""}
                {a.psTitle}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const SubmitIcon = () => (
  <svg className="portal-card__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FeedbackIcon = () => (
  <svg className="portal-card__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.7 8.7 0 0 1-3.5-.73L3 21l1.73-6A8.4 8.4 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function ProjectSubmission({ team }) {
  const [url, setUrl] = useState(team?.submission_url || "");
  const [note, setNote] = useState(team?.submission_note || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    try {
      await submitProject(url.trim(), note.trim());
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-card">
      <h3>
        <SubmitIcon />
        Submission
      </h3>
      <p className="portal-card__hint">
        A repo link, deployed URL, or deck — whatever best shows your work. You can update this any
        time before the deadline; saving again just replaces the last one.
      </p>

      <form className="portal-auth__form" onSubmit={save}>
        <label className="portal-field">
          <span>Link</span>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setSaved(false);
            }}
            placeholder="https://github.com/your-team/project"
            type="url"
            required
          />
        </label>
        <label className="portal-field">
          <span>Note (optional)</span>
          <input
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setSaved(false);
            }}
            placeholder="Anything the judges should know"
          />
        </label>
        {error && <p className="portal-auth__error">{error}</p>}
        <button className="portal-auth__submit" type="submit" disabled={busy}>
          {busy ? "Saving…" : saved ? "Saved ✓" : team?.submission_url ? "Update submission" : "Submit"}
        </button>
        {team?.submitted_at && (
          <p className="portal-submission__saved">Last saved {new Date(team.submitted_at).toLocaleString()}</p>
        )}
      </form>
    </section>
  );
}

function MentorFeedback({ team }) {
  if (!team || team.score === null || team.score === undefined) return null;
  return (
    <section className="portal-card">
      <h3>
        <FeedbackIcon />
        Mentor feedback
      </h3>
      <p className="portal-card__hint">Your Round 2 breakdown, straight from the judging rubric.</p>
      <ul className="portal-criteriaBreakdown">
        {CRITERIA.map((c) => (
          <li key={c.key}>
            <span>{c.label}</span>
            <strong>
              {team.criteria?.[c.key] ?? "—"}/{c.max}
            </strong>
          </li>
        ))}
        <li className="portal-criteriaBreakdown__total">
          <span>Total</span>
          <strong>{team.score}</strong>
        </li>
      </ul>
      {team.feedback && <p className="portal-feedbackNote">“{team.feedback}”</p>}
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

      <Announcements messages={session.announcements} />
      <Countdown />

      {session.team && <Ticket team={session.team} psTitle={selectedPsTitle} />}

      <ProblemStatement data={psData} error={psError} picking={picking} onPick={onPick} />

      <ProjectSubmission team={session.team} />

      <MentorFeedback team={session.team} />

      <Leaderboard ownTeamCode={session.team?.team_code} />
    </div>
  );
}

export default function TeamDashboard() {
  return <RequireRole role="team">{(session) => <TeamHome session={session} />}</RequireRole>;
}
