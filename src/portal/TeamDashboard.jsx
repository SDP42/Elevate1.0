import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Glass, GlassSystemProvider } from "open-glass-ui";
import "open-glass-ui/styles.css";
import SubmissionFiles from "./SubmissionFiles";
import RequireRole from "./RequireRole";
import { EVENT, SUBMISSION_DEADLINE, SPONSORS, HELP_CONTACTS } from "../config";
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

function FlipNumber({ value, label }) {
  const current = String(value).padStart(2, "0");
  const [previous, setPrevious] = useState(current);
  useEffect(() => {
    if (previous === current) return;
    const timer = setTimeout(() => setPrevious(current), 650);
    return () => clearTimeout(timer);
  }, [current, previous]);
  const flipping = previous !== current;
  return (
    <div className="submission-clock__unit">
      <div className="submission-clock__tile" aria-label={`${value} ${label}`}>
        <span className="submission-clock__half submission-clock__half--top" aria-hidden="true"><b>{current}</b></span>
        <span className="submission-clock__half submission-clock__half--bottom" aria-hidden="true"><b>{previous}</b></span>
        {flipping && <span key={`${current}-out`} className="submission-clock__half submission-clock__half--top submission-clock__out" aria-hidden="true"><b>{previous}</b></span>}
        {flipping && <span key={`${current}-in`} className="submission-clock__half submission-clock__half--bottom submission-clock__in" aria-hidden="true"><b>{current}</b></span>}
      </div>
      <span className="submission-clock__unit-label">{label}</span>
    </div>
  );
}

function SubmissionCountdown() {
  const countdown = useCountdown(SUBMISSION_DEADLINE);
  return (
    <section className="submission-clock" aria-label="Submission deadline countdown">
      <span className="submission-clock__heading">{countdown.done ? "Submissions closed" : "Submission closes in"}</span>
      <div className="submission-clock__parts">
        {countdown.parts.map(([label, value]) => <FlipNumber key={label} label={label} value={value} />)}
      </div>
    </section>
  );
}

function Announcements({ messages }) {
  if (!messages || messages.length === 0) return null;
  return (
    <div className="portal-announce">
      {messages.map((m, i) => (
        <p key={i} className={m.pinned ? "is-pinned" : undefined}>
          {m.pinned ? "🚨" : "📣"} {m.message}
        </p>
      ))}
    </div>
  );
}

const HelpIcon = () => (
  <svg className="portal-card__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 17v.01M12 14c0-2 2-2 2-4a2 2 0 1 0-4 0"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* Participant initiated WhatsApp chat: the organiser gets team/seat context
   in a prefilled message, which the participant sends inside WhatsApp. */
function HelpRequest({ team }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [recipient, setRecipient] = useState(HELP_CONTACTS[0]?.phone || "");
  const [opened, setOpened] = useState(false);
  const contact = HELP_CONTACTS.find(c => c.phone === recipient);

  function send(e) {
    e.preventDefault();
    if (!message.trim() || !contact) return;
    const text = `Elevate 1.0 · ${team?.team_code || "Team"} · Seat ${team?.seat_no ?? "unassigned"}\n${message.trim()}`;
    window.open(`https://wa.me/${contact.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    setOpened(true);
  }

  return (
    <GlassSystemProvider renderer="auto" theme={{ appearance: "dark" }} toasts={false}>
      <Glass material="frosted" className="portal-card portal-card--help portal-helpGlass" look={{ rim: 1.2, blur: .85 }}>
        <h3><HelpIcon />Need help?</h3>
        <p className="portal-card__hint">Write your message and open a WhatsApp chat with an organiser.</p>
        {!open ? <button type="button" className="portal-auth__submit portal-helpButton" onClick={() => setOpen(true)}>Request help</button> : (
          <form className="portal-auth__form" onSubmit={send}>
            <label className="portal-field"><span>What's going on?</span><textarea value={message} maxLength={2000} onChange={e => { setMessage(e.target.value); setOpened(false); }} placeholder="e.g. WiFi is down at our table" required rows={3} /></label>
            {HELP_CONTACTS.length > 1 && <label className="portal-field"><span>Send to</span><select value={recipient} onChange={e => setRecipient(e.target.value)}>{HELP_CONTACTS.map(c => <option key={c.phone} value={c.phone}>{c.name}</option>)}</select></label>}
            {!contact && <p className="portal-card__hint">WhatsApp contact will be available once the organiser adds their number.</p>}
            {opened && <p className="portal-status">Chat opened. Tap Send in WhatsApp to deliver your message.</p>}
            <div className="portal-scanResult__actions"><button className="portal-auth__submit" type="submit" disabled={!message.trim() || !contact}>Open WhatsApp chat</button><button type="button" className="portal-logout" onClick={() => setOpen(false)}>Cancel</button></div>
          </form>
        )}
      </Glass>
    </GlassSystemProvider>
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
   not just a flat dark page, with the same sponsor strip for every team. */
function Ticket({ team, rosterLocked }) {
  const [qrUrl, setQrUrl] = useState("");
  const cloudUrl = useHeroCloud();

  useEffect(() => {
    let cancelled = false;
    if (!team.qr_token) {
      setQrUrl("");
      return;
    }
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
            {team.qr_token && qrUrl ? (
              <>
                <img src={qrUrl} alt={`QR code for ${team.team_code}`} />
                <span className="ticket__qrLabel">Scan at meals &amp; check-in</span>
              </>
            ) : (
              <div className="ticket__qrStandby">
                <span className="ticket__standbyBadge">STANDBY</span>
                <span className="ticket__qrLabel">Awaiting Shortlist</span>
              </div>
            )}
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

            <div className="ticket__sponsors">
              <span className="ticket__sponsorsLabel">Flying with</span>
              <ul className="ticket__sponsorLogos" aria-label="Event sponsors">
                {SPONSORS.map((sponsor) => {
                  const SponsorLink = sponsor.url ? "a" : "span";
                  return (
                    <li key={sponsor.name}>
                      <SponsorLink
                        className={sponsor.showName ? "ticket__sponsorLockup" : undefined}
                        {...(sponsor.url
                          ? { href: sponsor.url, target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        aria-label={`${sponsor.role}: ${sponsor.name}`}
                      >
                        <img src={sponsor.logo} alt={sponsor.name} />
                        {sponsor.showName && (
                          <span className={sponsor.name === "ARINA AI" ? "ticket__sponsorName--arina" : undefined}>
                            {sponsor.name}
                          </span>
                        )}
                      </SponsorLink>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="ticket__passengers">
              <span className="ticket__passengersLabel">
                Passengers
                {rosterLocked && <span className="ticket__rosterLock">Roster locked ✓</span>}
              </span>
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

/* A one-time "you got it!" moment — the allocation board already shows
   this, but a team shouldn't have to keep refreshing to notice their own
   request went from pending to approved. Shown once per team, tracked in
   localStorage so it doesn't reappear on every login. */
function ApprovalBanner({ data, teamCode }) {
  const [show, setShow] = useState(false);
  const key = `elevate_ps_approved_seen_${teamCode}`;

  useEffect(() => {
    if (data?.selectionStatus === "approved") {
      let seen = false;
      try {
        seen = localStorage.getItem(key) === "1";
      } catch {
        /* private browsing etc — just show it, no harm in repeating once */
      }
      if (!seen) {
        setShow(true);
        try {
          localStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
      }
    }
  }, [data?.selectionStatus, key]);

  if (!show) return null;
  return (
    <div className="portal-approvalBanner">
      🎉 Your problem statement request has been approved — you're locked in!
      <button type="button" onClick={() => setShow(false)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

/* Shown for as long as the team stays shortlisted — not a one-time toast
   like the PS approval banner, since "you're shortlisted for Round 2" is
   an ongoing status worth seeing every time they open the dashboard, not
   just once. */
function ShortlistBanner({ team }) {
  if (!team?.shortlisted) return null;
  return <div className="portal-approvalBanner portal-shortlistBanner">🏆 Your team has been shortlisted for Round 2!</div>;
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
  const [comments, setComments] = useState(team?.submission_note || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError(""); setSaved(false);
    try {
      await submitProject(url.trim(), comments.trim());
      setSaved(true);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="portal-card">
      <h3><SubmitIcon />Submission</h3>
      <SubmissionFiles editable />
      <form className="portal-auth__form" onSubmit={save}>
        <label className="portal-field"><span>Project link</span><input type="url" value={url} placeholder="https://github.com/your-team/project" onChange={e => { setUrl(e.target.value); setSaved(false); }} /></label>
        <label className="portal-field"><span>Comments</span><textarea className="portal-submission__comments" value={comments} rows={4} maxLength={10000} placeholder="Anything the judges should know" onChange={e => { setComments(e.target.value); setSaved(false); }} /></label>
        {error && <p role="alert" className="portal-auth__error">{error}</p>}
        {saved && <p role="status" className="portal-submission__saved">Link and comments saved.</p>}
        <button type="submit" className="portal-auth__submit" disabled={busy}>{busy ? "Saving…" : "Save submission"}</button>
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
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    leaderboard()
      .then((d) => {
        setRows(d.leaderboard);
        setFrozen(Boolean(d.frozen));
      })
      .catch((err) => setError(err.message));
  }, []);

  const anyScored = rows?.some((r) => r.score !== null);

  return (
    <section className="portal-card">
      <h3>
        <TrophyIcon />
        {frozen ? "Final results" : "Leaderboard"}
      </h3>
      <p className="portal-card__hint">
        {frozen
          ? "Results are final — the event has wrapped and admin has frozen the board."
          : "Round 1 doesn't carry marks — these are Round 2 mentoring scores, updated live."}
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
                    {r.teamName ? `${r.teamName} (${r.teamCode})` : r.teamCode}
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
      <ShortlistBanner team={session.team} />
      {session.team && <ApprovalBanner data={psData} teamCode={session.team.team_code} />}
      <SubmissionCountdown />

      {session.team && (
        <Ticket
          team={session.team}
          rosterLocked={psData?.selectionStatus === "approved"}
        />
      )}

      <ProblemStatement data={psData} error={psError} picking={picking} onPick={onPick} />

      <ProjectSubmission team={session.team} />

      <MentorFeedback team={session.team} />

      <Leaderboard ownTeamCode={session.team?.team_code} />

      <HelpRequest team={session.team} />
    </div>
  );
}

export default function TeamDashboard() {
  return <RequireRole role="team">{(session) => <TeamHome session={session} />}</RequireRole>;
}
