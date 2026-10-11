import DesktopAnnouncements from "./DesktopAnnouncements";
import PartnerResources, { PartnerCredential } from "./PartnerResources";
import useLivePs from "./useLivePs";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Button, GlassSystemProvider } from "open-glass-ui";
import "open-glass-ui/styles.css";
import SubmissionFiles from "./SubmissionFiles";
import ParticipantMealNotice from "./MealCelebration";
import RequireRole from "./RequireRole";
import { EVENT, SUBMISSION_DEADLINE, SPONSORS, HELP_CONTACTS } from "../config";

import { logout, psList, selectPs, submitProject } from "./api";
import useHeroCloud from "./useHeroCloud";
import TeamLiquidGlass from "./TeamLiquidGlass";

const teamGlassLook = { blur: 1, rim: 1.3, lensing: 1.4, tint: '#020304', opacity: 2 };
function TeamCard({ children, className = '', ...props }) {
  return <TeamLiquidGlass as="section" material="regular" look={teamGlassLook} className={`portal-card ${className}`} {...props}>{children}</TeamLiquidGlass>;
}

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
    <TeamLiquidGlass as="section" material="regular" look={teamGlassLook} className="submission-clock" aria-label="Submission deadline countdown">
      <span className="submission-clock__heading">{countdown.done ? "Submissions closed" : "Submission closes in"}</span>
      <div className="submission-clock__parts">
        {countdown.parts.map(([label, value]) => <FlipNumber key={label} label={label} value={value} />)}
      </div>
    </TeamLiquidGlass>
  );
}

function Announcements({ messages }) {
  if (!messages || messages.length === 0) return null;
  return (
    <TeamLiquidGlass as="section" material="regular" look={teamGlassLook} className="portal-announce">
      {messages.map((m, i) => (
        <p key={i} className={m.pinned ? "is-pinned" : undefined}>
          {m.pinned ? "🚨" : "📣"} {m.message}
        </p>
      ))}
    </TeamLiquidGlass>
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
function HelpRequest({ team, teamName }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [recipient, setRecipient] = useState(HELP_CONTACTS[0]?.phone || "");
  const [opened, setOpened] = useState(false);
  const contact = HELP_CONTACTS.find(c => c.phone === recipient);

  function send(e) {
    e.preventDefault();
    if (!message.trim() || !contact) return;
    const text = `Elevate 1.0 · ${teamName || "Team"} · ${team?.team_code || "Code unassigned"} · Seat ${team?.seat_no ?? "unassigned"}\n${message.trim()}`;
    window.open(`https://wa.me/${contact.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    setOpened(true);
  }

  return (
      <TeamCard className="portal-card--help portal-helpGlass">
        <h3><HelpIcon />Need help?</h3>
        <p className="portal-card__hint">Write your message and open a WhatsApp chat with an organiser.</p>
        {!open ? <Button variant="primary" type="button" className="portal-auth__submit portal-helpButton" onClick={() => setOpen(true)}>Request help</Button> : (
          <form className="portal-auth__form" onSubmit={send}>
            <label className="portal-field"><span>What's going on?</span><textarea value={message} maxLength={2000} onChange={e => { setMessage(e.target.value); setOpened(false); }} placeholder="e.g. WiFi is down at our table" required rows={3} /></label>
            {HELP_CONTACTS.length > 1 && <label className="portal-field"><span>Send to</span><select value={recipient} onChange={e => setRecipient(e.target.value)}>{HELP_CONTACTS.map(c => <option key={c.phone} value={c.phone}>{c.name}</option>)}</select></label>}
            {!contact && <p className="portal-card__hint">WhatsApp contact will be available once the organiser adds their number.</p>}
            {opened && <p className="portal-status">Chat opened. Tap Send in WhatsApp to deliver your message.</p>}
            <div className="portal-scanResult__actions"><Button variant="primary" className="portal-auth__submit" type="submit" disabled={!message.trim() || !contact}>Open WhatsApp chat</Button><button type="button" className="portal-logout" onClick={() => setOpen(false)}>Cancel</button></div>
          </form>
        )}
      </TeamCard>
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

/* The nose-to-tail of a boarding pass, carried through from the marketing
   site's own ticket (src/components/BoardingPass.jsx): QR on the left
   behind a perforated notch, a route down the middle, a dark stub on the
   right — now floating over the same painted cloud sea as that section,
   not just a flat dark page, with the same sponsor strip for every team. */
function Ticket({ team, teamName, rosterLocked }) {
  const [qrUrl, setQrUrl] = useState("");

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
    <div className="ticket-stage ticket-stage--standalone">
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
                <dd>{team.team_code}<span className="ticket__teamName">{teamName}</span></dd>
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
              <div className="ticket__sponsorsHead"><span className="ticket__sponsorsLabel">Flying with</span><span className="ticket__sponsorsCount">Our event partners</span></div>
              <ul className="ticket__sponsorLogos" aria-label="Event sponsors">
                {SPONSORS.map((sponsor) => {
                  const SponsorLink = sponsor.url ? "a" : "span";
                  return (
                    <li key={sponsor.name} className={sponsor.featured ? "ticket__sponsor--featured" : undefined}>
                      <SponsorLink
                        className={`ticket__sponsorTile${sponsor.showName ? " ticket__sponsorTile--lockup" : ""}${sponsor.name === "ARINA AI" ? " ticket__sponsorTile--arina" : ""}`}
                        {...(sponsor.url
                          ? { href: sponsor.url, target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        aria-label={`${sponsor.role}: ${sponsor.name}`}
                      >
                        <span className="ticket__sponsorArtwork"><img className={sponsor.name === "Obliq" ? "ticket__sponsorLogo--obliq" : undefined} src={sponsor.logo} alt={sponsor.showName ? "" : sponsor.name} />
                        {sponsor.showName && (
                          <span className={sponsor.name === "ARINA AI" ? "ticket__sponsorName--arina" : undefined}>
                            {sponsor.name}
                          </span>
                        )}
                      </span><span className="ticket__sponsorRole">{sponsor.role}</span>
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
                    {m.food_preference && <span className={`ticket__foodBadge${m.food_preference === "Jain" ? " ticket__foodBadge--jain" : ""}`}>{m.food_preference}</span>}
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
      🎉 Your problem statement is allocated — you're locked in!
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
  const [preferences,setPreferences]=useState(null);
  const [message,setMessage]=useState('');
  const locked=data?.selectionStatus==='approved';
  const statements=data?.problemStatements || [];
  const choices=preferences ?? (data?.preferences?.length===4 ? data.preferences.map(String) : ['','','','']);
  const complete=choices.length===4 && choices.every(Boolean) && new Set(choices).size===4;
  const selected=statements.find(ps=>ps.id===data?.selectedPsId);
  async function submit(e){e.preventDefault();if(!complete)return;setMessage('');const result=await onPick(choices.map(Number));if(result)setMessage(result.message);}
  return <TeamCard className="portal-problemStatements"><h3><LightbulbIcon />Problem statement preferences</h3>
    <p className="portal-card__hint">Rank four different problem statements. Your first available preference is allocated immediately and locked. If your first three choices are full, your fourth choice is allocated automatically.</p>
    {statements.length>0 && <ul className="ps-domainCards" aria-label="Available problem statements">{statements.map(ps=><li key={ps.id}>
      <div className="ps-domainCards__head"><span className="ps-domainCards__code">{ps.code}</span><span className={`ps-domainCards__availability${ps.full?' is-full':''}`}>{ps.full?'Full':'Available'}</span></div>
      <h4>{ps.title}</h4><p><span className="ps-domainCards__label">Domains</span>{ps.description}</p>
    </li>)}</ul>}
    {error && <p role="alert" className="portal-auth__error">{error}</p>}
    {data?.selectionOpen !== true && !locked ? <p className="portal-status" role="status">{data?.selectionClosed ? 'Problem statement selection closed at 10:00 AM IST.' : data ? 'Problem statement selection is opening shortly.' : 'Loading selection availability…'}</p> : locked ? <p className="portal-status" role="status">Allocated: {selected?`${selected.code} · ${selected.title}`:'Your confirmed problem statement'}</p> : statements.length<4 ? <p>Four problem statements need to be revealed before preferences can be submitted.</p> :
      <form onSubmit={submit} className="ps-preferenceForm"><div className="ps-preferenceGrid">{[0,1,2,3].map(index=><label className="portal-field" key={index}><span>Preference {index+1}</span><select aria-label={`Preference ${index+1}`} required value={choices[index] || ''} disabled={picking!==null} onChange={e=>{
      const value=e.target.value,next=[...choices],previous=next[index];
      const other=next.findIndex((choice,i)=>i!==index && value && choice===value);
      if(other>=0)next[other]=previous;next[index]=value;setPreferences(next);
    }}><option value="">Choose a problem statement</option>{statements.map(ps=><option key={ps.id} value={ps.id}>{ps.code} · {ps.title}{ps.full?' · Full':''}</option>)}</select></label>)}</div>
        <Button variant="primary" className="portal-auth__submit" type="submit" disabled={!complete || picking!==null}>{picking!==null?'Allocating…':'Submit preferences'}</Button>
      </form>}
    {message && <p role="status" className="portal-status">{message}</p>}
  </TeamCard>;
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
  const closed = useCountdown(SUBMISSION_DEADLINE).done;
  const [url, setUrl] = useState(team?.submission_url || "");
  const [additionalLinks, setAdditionalLinks] = useState((team?.submission_links || []).join('\n'));
  const [comments, setComments] = useState(team?.submission_note || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    if (Date.now() >= SUBMISSION_DEADLINE.getTime()) { setError("Submissions are closed."); return; }
    setBusy(true); setError(""); setSaved(false);
    try {
      await submitProject(url.trim(), comments.trim(), additionalLinks.split(/\r?\n/).map(link=>link.trim()).filter(Boolean));
      setSaved(true);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <TeamCard className="portal-submission">
      <h3><SubmitIcon />Submission</h3>
      <p className="portal-card__hint" role="status">{closed ? "Submissions closed. Uploaded documents remain available to view." : "Closes Sunday, 11 October at 8:20 AM IST."}</p>
      <SubmissionFiles editable closed={closed} />
      <form className="portal-auth__form" onSubmit={save}>
        <label className="portal-field"><span>Project link</span><input disabled={closed || busy} type="url" value={url} placeholder="https://github.com/your-team/project" onChange={e => { setUrl(e.target.value); setSaved(false); }} /></label>
        <label className="portal-field"><span>Additional links</span><textarea className="portal-submission__comments" disabled={closed || busy} rows={3} maxLength={40979} value={additionalLinks} placeholder={'https://your-demo.com\nhttps://your-presentation.com'} onChange={e=>{setAdditionalLinks(e.target.value);setSaved(false);}} /><small className="portal-card__hint">One link per line.</small></label>
        <label className="portal-field"><span>Comments</span><textarea disabled={closed || busy} className="portal-submission__comments" value={comments} rows={4} maxLength={10000} placeholder="Anything the judges should know" onChange={e => { setComments(e.target.value); setSaved(false); }} /></label>
        {error && <p role="alert" className="portal-auth__error">{error}</p>}
        {saved && <p role="status" className="portal-submission__saved">Submission saved.</p>}
        <Button variant="primary" type="submit" className="portal-auth__submit" disabled={busy || closed}>{closed ? "Submissions closed" : busy ? "Saving…" : "Save submission"}</Button>
      </form>
    </TeamCard>
  );
}

function MentorFeedback({ team }) {
  if (!team || (!team.mentoring1Feedback && !team.mentoring2Feedback)) return null;
  return (
    <TeamCard>
      <h3>
        <FeedbackIcon />
        Mentor feedback
      </h3>
      <div className="round2-savedFeedback"><span>Mentoring 1 feedback</span><p className="portal-feedbackNote">{team.mentoring1Feedback || "No feedback entered."}</p><span>Mentoring 2 feedback</span><p className="portal-feedbackNote">{team.mentoring2Feedback || "No feedback entered."}</p></div>
    </TeamCard>
  );
}

function TeamHome({ session }) {
  const navigate = useNavigate();
  const cloudUrl = useHeroCloud();
  const [psData, setPsData] = useState(null);
  const psRequestSequence = useRef(0);
  const [psError, setPsError] = useState("");
  const [picking, setPicking] = useState(null);

  function loadPs() {
    const requestId = ++psRequestSequence.current;
    return psList()
      .then(data => { if (requestId === psRequestSequence.current) { setPsData(data); setPsError(""); } return data; })
      .catch((err) => { if (requestId === psRequestSequence.current) setPsError(err.message); });
  }

  useLivePs(loadPs);

  async function onPick(preferences) {
    setPsError("");
    setPicking(true);
    try {
      const result=await selectPs(preferences);
      // Render the committed allocation from the POST response immediately.
      // Older polling responses must not overwrite this confirmation.
      ++psRequestSequence.current;
      if (result.selection?.status === 'approved') setPsData(previous => ({
        ...previous, preferences, selectedPsId:result.selection.ps_id, selectionStatus:'approved',
      }));
      void loadPs();
      return result;
    } catch (err) {
      await loadPs();
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
    <div className="team-portal">
      <div className="team-portal__background" aria-hidden="true">{cloudUrl && <img className="team-portal__cloud" src={cloudUrl} alt="" />}</div>
      <GlassSystemProvider design="liquid" renderer="auto" theme={{appearance:"dark",className:"team-portal__content"}} toasts={false}>
      <div className="portal-page team-portal__page">
      <TeamLiquidGlass material="regular" look={teamGlassLook} className="portal-page__head">
        <div>
          <span className="portal-page__eyebrow">Elevate 1.0 · Team Portal</span>
          <h1>{session.displayName}</h1>
          <PartnerCredential access={session.team?.partnerAccess} />
        </div>
        <Button variant="secondary" type="button" className="portal-logout" onClick={onLogout}>
          Log out
        </Button>
      </TeamLiquidGlass>

      <PartnerResources team={session.team} teamName={session.displayName} />
      <ParticipantMealNotice teamName={session.displayName} />
      <DesktopAnnouncements initialMessages={session.announcements} teamCode={session.team?.team_code} />
      <ShortlistBanner team={session.team} />
      {session.team && <ApprovalBanner data={psData} teamCode={session.team.team_code} />}
      <SubmissionCountdown />

      {session.team && (
        <Ticket
          teamName={session.displayName}
          team={session.team}
          rosterLocked={psData?.selectionStatus === "approved"}
        />
      )}

      <ProblemStatement data={psData} error={psError} picking={picking} onPick={onPick} />

      <ProjectSubmission team={session.team} />

      <MentorFeedback team={session.team} />


      <HelpRequest team={session.team} teamName={session.displayName} />
      </div>
      </GlassSystemProvider>
    </div>
  );
}

export default function TeamDashboard() {
  return <RequireRole role="team">{(session) => <TeamHome session={session} />}</RequireRole>;
}
