import AiUsageMonitor from './AiUsageMonitor';
import { adminFinalShortlist } from "./api";
import GlassSelect from "./GlassSelect";
import FinalMarksEditor from "./FinalMarksEditor";
import MealAnalysisPopup from "./MealAnalysisPopup";
import { Glass, GlassSystemProvider } from "open-glass-ui";
import "open-glass-ui/styles.css";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import JSZip from "jszip";
import SubmissionFiles from "./SubmissionFiles";
import RequireRole from "./RequireRole";
import SuperAdminOversight from "./SuperAdminOversight";
import {
  adminAccounts,
  adminAnnouncements,
  adminApproveAllFeedback,
  adminApproveFeedback,
  adminAudit,
  adminCreateStaff,
  adminCreateTeam,
  adminExport,
  adminFreezeResults,
  adminMeals,
  adminOverview,
  adminSaveAnnouncement,
  adminSavePs,
  adminSetShortlist,
  adminSettings,
  adminTeams,
  coreTeams,
  logout,
  psList,
} from "./api";

function ExportButton({ type }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="portal-logout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await adminExport(type);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Exporting…" : "Export CSV"}
    </button>
  );
}

/* A single-glance command-center view — meant to be read at a distance
   (or projected) by someone deciding what needs attention right now,
   instead of clicking through every section below to piece it together. */
function Overview() {
  const [data, setData] = useState(null);

  function load() {
    adminOverview()
      .then(setData)
      .catch(() => {});
  }

  useEffect(load, []);

  if (!data) return null;

  const stats = [
    ["Teams", data.teamCount ?? 0],
    ["Withdrawn", data.withdrawnCount ?? 0],
    ["Checked in", data.checkedInCount ?? 0],
    ["Submitted", data.submittedCount ?? 0],
    ["PS approved", data.psApprovedCount ?? 0],
    ["Meals served", data.mealsServedCount ?? 0],
  ];

  return (
    <section className="portal-card portal-overview">
      <div className="portal-card__headRow">
        <h3>Overview</h3>
        <button type="button" className="portal-logout" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="portal-overview__grid">
        {stats.map(([label, value]) => (
          <div key={label} className={label === "Open incidents" && value > 0 ? "is-alert" : undefined}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FreezeResultsToggle() {
  const [frozen, setFrozen] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminSettings()
      .then((d) => setFrozen(d.resultsFrozen))
      .catch(() => {});
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      await adminFreezeResults(!frozen);
      setFrozen(!frozen);
    } finally {
      setBusy(false);
    }
  }

  if (frozen === null) return null;

  return (
    <section className="portal-card">
      <h3>Final results</h3>
      <p className="portal-card__hint">
        Freeze the leaderboard once the event wraps — every team's dashboard then shows it as "Final
        results" instead of a live board. Unfreeze to go back to live.
      </p>
      <button type="button" className="portal-auth__submit portal-u-inline" onClick={toggle} disabled={busy}>
        {busy ? "…" : frozen ? "Unfreeze (back to live)" : "Freeze results"}
      </button>
      {frozen && <p className="portal-status">Results are currently frozen.</p>}
    </section>
  );
}

function ShortlistToggle({ team, onChanged }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await adminSetShortlist(team.id, !team.shortlisted);
      onChanged(team.id, !team.shortlisted);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className="portal-logout" onClick={toggle} disabled={busy}>
      {team.shortlisted ? "Round 2 ✓" : "Shortlist for R2"}
    </button>
  );
}

function QrModal({ team, onClose }) {
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    if (!team?.qrToken) return;
    QRCode.toDataURL(`ELEVATE1:${team.qrToken}`, { margin: 1, width: 360 }).then(setQrUrl);
  }, [team]);

  function download() {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `${team.username || team.teamCode}.png`;
    a.click();
  }

  return (
    <div className="portal-modalBackdrop" onClick={onClose}>
      <div className="portal-modalCard" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modalHead">
          <h4>{team.teamCode} — QR Boarding Pass</h4>
          <button type="button" className="portal-logout" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="portal-card__hint">
          {team.displayName} {team.seatNo ? `· Seat ${team.seatNo}` : ""} · <code>{team.username}.png</code>
        </p>
        <div className="portal-qrPreview">
          {qrUrl ? <img src={qrUrl} alt={`QR for ${team.teamCode}`} /> : <p>Generating QR…</p>}
        </div>
        <div className="portal-scanResult__actions portal-u-mt">
          <button type="button" className="portal-auth__submit" onClick={download} disabled={!qrUrl}>
            Download PNG
          </button>
          <button type="button" className="portal-logout" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AllQrsModal({ teams, onClose }) {
  const [qrMap, setQrMap] = useState({});
  const [zipBusy, setZipBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function gen() {
      const map = {};
      for (const t of teams) {
        if (t.qrToken) {
          try {
            map[t.id] = await QRCode.toDataURL(`ELEVATE1:${t.qrToken}`, { margin: 1, width: 280 });
          } catch {
            // ignore
          }
        }
      }
      if (!cancelled) setQrMap(map);
    }
    gen();
    return () => {
      cancelled = true;
    };
  }, [teams]);

  async function downloadZip() {
    setZipBusy(true);
    try {
      const zip = new JSZip();
      for (const t of teams) {
        if (t.qrToken) {
          const dataUrl = qrMap[t.id] || (await QRCode.toDataURL(`ELEVATE1:${t.qrToken}`, { margin: 1, width: 400 }));
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
          zip.file(`${t.username || t.teamCode}.png`, base64, { base64: true });
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `elevate-all-teams-qrs.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipBusy(false);
    }
  }

  return (
    <div className="portal-modalBackdrop" onClick={onClose}>
      <div className="portal-modalCard portal-modalCard--wide" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modalHead">
          <h4>All Team QR Passes ({teams.length})</h4>
          <button type="button" className="portal-logout" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="portal-scanResult__actions portal-u-mt portal-no-print">
          <button type="button" className="portal-auth__submit" onClick={downloadZip} disabled={zipBusy}>
            {zipBusy ? "Generating ZIP…" : "Download All (ZIP)"}
          </button>
          <button type="button" className="portal-logout" onClick={() => window.print()}>
            Print Passes / Save PDF
          </button>
          <button type="button" className="portal-logout" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="portal-allQrGrid portal-u-mt">
          {teams.map((t) => (
            <div key={t.id} className="portal-allQrCard">
              <div className="portal-allQrCard__head">
                <strong>{t.teamCode}</strong>
                {t.seatNo ? <span>Seat {t.seatNo}</span> : null}
              </div>
              <div className="portal-allQrCard__name">{t.displayName}</div>
              <div className="portal-table__sub"><code>{t.username}</code></div>
              <div className="portal-allQrCard__qr">
                {qrMap[t.id] ? (
                  <img src={qrMap[t.id]} alt={`QR for ${t.teamCode}`} />
                ) : (
                  <span>Generating…</span>
                )}
              </div>
              <div className="portal-allQrCard__footer portal-no-print">
                {qrMap[t.id] && (
                  <a href={qrMap[t.id]} download={`${t.username || t.teamCode}.png`} className="portal-link-btn">
                    Download PNG
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateTeamModal({ onCreated, onClose }) {
  const [teamCode, setTeamCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [seatNo, setSeatNo] = useState("");
  const [membersText, setMembersText] = useState("");
  const [shortlisted, setShortlisted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdResult, setCreatedResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!teamCode.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await adminCreateTeam({
        teamCode: teamCode.trim(),
        displayName: displayName.trim(),
        seatNo: seatNo ? Number(seatNo) : null,
        members: membersText.split("\n").map((s) => s.trim()).filter(Boolean),
        shortlisted,
      });
      setCreatedResult(res);
      onCreated(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="portal-modalBackdrop" onClick={onClose}>
      <div className="portal-modalCard" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modalHead">
          <h4>Create New Team</h4>
          <button type="button" className="portal-modalClose" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {createdResult ? (
          <div className="portal-status portal-u-mt">
            <p><strong>Team {createdResult.teamCode} created successfully!</strong></p>
            <p>Username: <code>{createdResult.username}</code></p>
            <p>Password: <code>{createdResult.password}</code> (save this now!)</p>
            <p>Status: Round 1 team with active QR code{createdResult.shortlisted ? " (Shortlisted for Round 2)" : ""}</p>
            <div className="portal-scanResult__actions portal-u-mt">
              <button type="button" className="portal-auth__submit" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="portal-auth__form" onSubmit={submit}>
            {error && <p className="portal-auth__error">{error}</p>}
            <div className="portal-formRow">
              <label className="portal-field">
                <span>Team Code *</span>
                <input
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value)}
                  placeholder="e.g. ELEV36"
                  required
                />
              </label>
              <label className="portal-field">
                <span>Seat No</span>
                <input
                  type="number"
                  value={seatNo}
                  onChange={(e) => setSeatNo(e.target.value)}
                  placeholder="e.g. 36"
                />
              </label>
            </div>
            <label className="portal-field">
              <span>Display / Team Name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. CyberKnights"
              />
            </label>
            <label className="portal-field">
              <span>Roster Members (one per line, up to 4)</span>
              <textarea
                rows={3}
                value={membersText}
                onChange={(e) => setMembersText(e.target.value)}
                placeholder={"Alex Smith (Lead)\nJordan Lee"}
              />
            </label>
            <label className="portal-checkboxLabel">
              <input
                type="checkbox"
                checked={shortlisted}
                onChange={(e) => setShortlisted(e.target.checked)}
              />
              <span>Shortlist for Round 2 immediately (default is unchecked — all teams start in Round 1)</span>
            </label>
            <div className="portal-scanResult__actions portal-u-mt">
              <button type="submit" className="portal-auth__submit" disabled={busy}>
                {busy ? "Creating…" : "Create team"}
              </button>
              <button type="button" className="portal-logout" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function CreateStaffModal({ onCreated, onClose }) {
  const [role, setRole] = useState("core");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdResult, setCreatedResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await adminCreateStaff({
        role,
        username: username.trim() || undefined,
        displayName: displayName.trim() || undefined,
      });
      setCreatedResult(res.account);
      onCreated(res.account);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="portal-modalBackdrop" onClick={onClose}>
      <div className="portal-modalCard" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modalHead">
          <h4>Generate Staff Login</h4>
          <button type="button" className="portal-modalClose" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {createdResult ? (
          <div className="portal-status portal-u-mt">
            <p><strong>Staff account created successfully!</strong></p>
            <p>Role: <code>{createdResult.role}</code></p>
            <p>Name: <strong>{createdResult.displayName}</strong></p>
            <p>Username: <code>{createdResult.username}</code></p>
            <p>Password: <code>{createdResult.password}</code> (save this now!)</p>
            <div className="portal-scanResult__actions portal-u-mt">
              <button type="button" className="portal-auth__submit" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="portal-auth__form" onSubmit={submit}>
            {error && <p className="portal-auth__error">{error}</p>}
            <label className="portal-field">
              <span>Account Role *</span>
              <select value={role} onChange={(e) => setRole(e.target.value)} required>
                <option value="core">Core Judge (Mentoring &amp; Scoring)</option>
                <option value="regidesk">Registration Desk (Check-in &amp; Verification)</option>
                <option value="meal">Meal Counter (Food QR Scanner)</option>
                <option value="admin">Administrator (Full Access)</option>
              </select>
            </label>
            <label className="portal-field">
              <span>Username (optional — blank to auto-generate)</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={`e.g. ${role}06`}
              />
            </label>
            <label className="portal-field">
              <span>Display / Staff Name (optional)</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Judge John Doe"
              />
            </label>
            <div className="portal-scanResult__actions portal-u-mt">
              <button type="submit" className="portal-auth__submit" disabled={busy}>
                {busy ? "Generating…" : "Generate Account"}
              </button>
              <button type="button" className="portal-logout" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


function PsManager({ problemStatements, onSaved }) {
  const [form, setForm] = useState({ code: "", title: "" });
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
    setForm({ code: "", title: "" });
  }

  return (
    <section className="portal-card">
      <h3>Problem statements</h3>
      <p className="portal-card__hint">
        Add them here hidden, check them over, then hit Reveal when you're ready for teams to see
        and request them. New PS entries start at capacity 0; configure capacities in the backend before opening allocation.
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
        <button className="portal-auth__submit" type="submit" disabled={busy}>
          Add problem statement (hidden)
        </button>
      </form>
    </section>
  );
}

function AnnouncementsManager({ teams }) {
  const [audience, setAudience] = useState("");
  const [items, setItems] = useState(null);
  const [message, setMessage] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function load() {
    adminAnnouncements()
      .then((d) => {
        setItems(d.announcements);
        setError("");
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError("");
    try {
      await adminSaveAnnouncement({ message, teamId: audience ? Number(audience) : null, active: true, pinned, sortOrder: items?.length ?? 0 });
      setMessage("");
      setPinned(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a) {
    await adminSaveAnnouncement({ id: a.id, message: a.message, teamId: a.teamId ?? null, active: !a.active, pinned: a.pinned, sortOrder: a.sortOrder });
    load();
  }

  async function togglePinned(a) {
    await adminSaveAnnouncement({ id: a.id, message: a.message, teamId: a.teamId ?? null, active: a.active, pinned: !a.pinned, sortOrder: a.sortOrder });
    load();
  }

  return (
    <section className="portal-card">
      <h3>Announcements</h3>
      <p className="portal-card__hint">
        Choose All or one team. Active announcements appear on the selected audience’s dashboard. Pinned announcements appear first.
      </p>

      {error && <p className="portal-auth__error">{error}</p>}

      {items && items.length > 0 && (
        <ul className="portal-announceAdmin">
          {items.map((a) => (
            <li key={a.id} className={a.active ? undefined : "is-inactive"}>
              <span>
                {a.pinned && "🚨 "}
                {a.message}<small className="portal-table__sub"> · {a.teamId ? teams?.find(t => t.id === a.teamId)?.teamCode || "Selected team" : "All"}</small>
              </span>
              <span className="portal-announceAdmin__actions">
                <button type="button" className="portal-logout" onClick={() => togglePinned(a)}>
                  {a.pinned ? "Unpin" : "Pin as urgent"}
                </button>
                <button type="button" className="portal-logout" onClick={() => toggleActive(a)}>
                  {a.active ? "Deactivate" : "Activate"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form className="portal-auth__form portal-u-mt" onSubmit={add}>
        <GlassSelect label="Send to" value={audience} onChange={setAudience} options={[{value:'',label:'All'},...(teams||[]).map(team=>({value:String(team.id),label:`${team.teamCode} · ${team.displayName || team.teamName}`}))]} />
        <div className="portal-manualLookup__row">
          <input aria-label="New announcement" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="New announcement" />
          <button type="submit" className="portal-auth__submit" disabled={busy || !message.trim()}>
            Add
          </button>
        </div>
        <label className="portal-regiRow__check">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin as urgent
        </label>
      </form>
    </section>
  );
}

function AuditLog() {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    adminAudit()
      .then((d) => setEntries(d.entries))
      .catch(() => {});
  }, []);

  return (
    <section className="portal-card">
      <h3>Audit log</h3>
      <p className="portal-card__hint">Who did what, most recent first — for settling disputes on the day.</p>
      {entries && (
        <div className="portal-tableWrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
                  <td>{e.username ? `${e.username} (${e.role})` : "—"}</td>
                  <td>{e.action}</td>
                  <td className="portal-table__note">{e.detail ? JSON.stringify(e.detail) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdminRound2Leaderboard({ teams, final = false }) {
  const scoreField = final ? "finalRoundScore" : "judgingRound1Score";
  const rows = (teams || []).filter(team => team.shortlisted && !team.withdrawn && (!final || team.finalRoundShortlisted)).map(team=>({...team,score:team[scoreField]})).sort((a,b) => (b.score ?? -1) - (a.score ?? -1) || a.teamCode.localeCompare(b.teamCode));
  return <section className="round2-leaderboard" aria-label="Round 2 leaderboard"><h3>{final ? "Final round leaderboard" : "Judging Round 1 leaderboard"}</h3><p className="portal-card__hint">Current saved scores for active shortlisted teams. Equal scores share a rank. Unreleased results are visible here to admins.</p><ol>{rows.map(team => {
    const rank = team.score == null ? null : rows.findIndex(row => row.score === team.score) + 1;
    return <li key={team.id}><span className="round2-rank">{team.score == null ? "—" : rank}</span><div><strong>{team.teamName}</strong><span>{team.teamCode}</span></div><strong>{team.score ?? "—"}</strong></li>;
  })}</ol></section>;
}

function AdminNavIcon({ name }) {
  const paths = {
    home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
    teams: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    staff: "M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7ZM8 12l3 3 5-6",
    marks: "M4 21V10h4v11M10 21V3h4v18M16 21v-7h4v7",
    audit: "M6 3h12v18H6ZM9 7h6M9 11h6M9 15h4",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function AdminHome({ session, superAdmin = false }) {
  const navigate = useNavigate();
  const [panel, setPanel] = useState("overview");
  const [teams, setTeams] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [marksTeams, setMarksTeams] = useState(null);
  const [localScorePreview, setLocalScorePreview] = useState(false);
  const [meals, setMeals] = useState(null);
  const [mealAnalysisSlot, setMealAnalysisSlot] = useState(null);
  const onMealAnalysisUpdate = useCallback(data => {
    const count = data.teams.reduce((sum, team) => sum + team.served, 0);
    setMeals(previous => previous?.map(slot => slot.code === data.slot.code ? { ...slot, served: count } : slot));
  }, []);
  const [problemStatements, setProblemStatements] = useState(null);
  const [viewQrTeam, setViewQrTeam] = useState(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAllQrs, setShowAllQrs] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(null);
  const [error, setError] = useState("");

  function loadPs() {
    psList()
      .then((d) => setProblemStatements(d.problemStatements))
      .catch((err) => setError(err.message));
  }

  function loadAll() {
    Promise.all([adminTeams(), adminAccounts(), coreTeams(), adminMeals()])
      .then(([t, a, m, meal]) => {
        setTeams(t.teams);
        setAccounts(a.accounts);
        setMarksTeams(m.teams);
        setMeals(meal.slots);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (panel !== "marks" && panel !== "teams" && panel !== "overview") return;
    let stopped = false, timer, busy = false;
    async function refresh() {
      if (stopped || busy || document.hidden) return;
      busy = true;
      try {
        const data = await (panel === "marks" ? coreTeams() : panel === "overview" ? psList() : adminTeams());
        if (!stopped) {
          if (panel === "marks") { setMarksTeams(data.teams); setLocalScorePreview(Boolean(data.localScorePreview)); }
          else if (panel === "overview") setProblemStatements(data.problemStatements);
          else setTeams(data.teams);
        }
      }
      catch (err) { if (!stopped) setError(err.message); }
      finally { busy = false; if (!stopped) timer = setTimeout(refresh, 5000); }
    }
    const visible = () => { clearTimeout(timer); if (!document.hidden) refresh(); };
    refresh(); document.addEventListener("visibilitychange", visible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [panel]);

  useEffect(() => {
    loadAll();
    loadPs();
  }, []);

  async function downloadAllZip() {
    if (!teams) return;
    setZipBusy(true);
    try {
      const zip = new JSZip();
      for (const t of teams) {
        if (t.qrToken) {
          const dataUrl = await QRCode.toDataURL(`ELEVATE1:${t.qrToken}`, { margin: 1, width: 400 });
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
          zip.file(`${t.username || t.teamCode}.png`, base64, { base64: true });
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "elevate-all-teams-qrs.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipBusy(false);
    }
  }

  function saveStage(saved) {setMarksTeams(previous=>previous.map(row=>row.id===saved.id?saved:row));}
  async function toggleFinal(team) {
    setFeedbackBusy(team.id);
    try {await adminFinalShortlist(team.id,!team.finalRoundShortlisted);setMarksTeams(previous=>previous.map(row=>row.id===team.id?{...row,finalRoundShortlisted:!team.finalRoundShortlisted}:row));}
    catch(err){setError(err.message);}finally{setFeedbackBusy(null);}
  }

  async function toggleFeedbackApproval(teamId, currentStatus) {
    setFeedbackBusy(teamId);
    try {
      await adminApproveFeedback(teamId, !currentStatus);
      setMarksTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, feedbackApproved: !currentStatus } : t))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setFeedbackBusy(null);
    }
  }

  async function setAllResultsVisibility(approved) {
    const actionName = approved ? "release mentoring feedbacks to participants" : "hide mentoring feedbacks from participants";
    if (!window.confirm(`Are you sure you want to ${actionName}?`)) return;
    setFeedbackBusy("all");
    try {
      await adminApproveAllFeedback(approved);
      setMarksTeams((prev) =>
        prev.map((t) => (t.score !== null ? { ...t, feedbackApproved: approved } : t))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setFeedbackBusy(null);
    }
  }

  function onShortlistChanged(teamId, shortlisted) {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, shortlisted } : t)));
  }

  async function onLogout() {
    await logout();
    navigate("/portal/login", { replace: true });
  }

  return (
    <div className="portal-page portal-adminPage">
      <div className="portal-page__head">
        <div>
          <span className="portal-page__eyebrow">
            Elevate 1.0 · {superAdmin ? "Super Admin · Oversight + Full Access" : "Admin · Full Access"}
          </span>
          <h1>{session.displayName}</h1>
        </div>
        <button type="button" className="portal-logout" onClick={onLogout}>
          Log out
        </button>
      </div>

      {error && <p className="portal-auth__error">{error}</p>}

      {superAdmin && <SuperAdminOversight />}

      {panel === "overview" && <><Overview /><AiUsageMonitor /></>}

      {panel === "teams" && (
      <section className="portal-card">
        <div className="portal-card__headRow">
          <h3>Teams ({teams?.length ?? "…"})</h3>
          <div className="portal-scanResult__actions" style={{ margin: 0, gap: "0.5rem" }}>
            <button
              type="button"
              className="portal-auth__submit"
              style={{ padding: "0.35rem 0.8rem", fontSize: "0.85rem" }}
              onClick={() => setShowAddTeam(true)}
            >
              + Add Team
            </button>
            <button
              type="button"
              className="portal-logout"
              style={{ padding: "0.35rem 0.8rem", fontSize: "0.85rem" }}
              onClick={() => setShowAllQrs(true)}
              disabled={!teams || teams.length === 0}
            >
              View All QRs
            </button>
            <button
              type="button"
              className="portal-logout"
              style={{ padding: "0.35rem 0.8rem", fontSize: "0.85rem" }}
              onClick={downloadAllZip}
              disabled={zipBusy || !teams || teams.length === 0}
            >
              {zipBusy ? "Generating ZIP…" : "Download All QRs (ZIP)"}
            </button>
            <ExportButton type="teams" />
          </div>
        </div>
        <p className="portal-card__hint">
          Team details, individual members, submitted project links, uploaded documents and total meal coupons claimed.
        </p>
        {teams && (
          <div className="portal-tableWrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Name</th>
                  <th>Seat</th>
                  <th>Username</th>
                  {[1, 2, 3, 4].map(position => <th key={position}>Member {position}</th>)}
                  <th>GitHub / project link</th>
                  <th>Additional links</th>
                  <th>Uploaded documents</th>
                  <th>Meals claimed</th>
                  <th>QR Pass</th>
                  <th>Round 2 Shortlist</th>
                  <th>Wi-Fi access</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id} className={t.withdrawn ? "is-alert-row" : undefined}>
                    <td>
                      {t.teamCode}
                      {t.withdrawn && <div className="portal-table__sub">Withdrawn</div>}
                    </td>
                    <td>{t.displayName}</td>
                    <td>{t.seatNo ?? "—"}</td>
                    <td>{t.username}</td>
                    {[0, 1, 2, 3].map(index => <td key={index} className="portal-teamMember">{t.members[index]?.name || "—"}{t.members[index]?.isLead && <span className="portal-table__sub">Team leader</span>}</td>)}
                    <td className="portal-table__note">{t.submissionUrl ? <a className="portal-projectLink" href={t.submissionUrl} target="_blank" rel="noopener noreferrer">{t.submissionUrl}<span aria-hidden="true"> ↗</span></a> : "—"}</td>
                    <td className="portal-table__note">{t.submissionLinks?.length ? <div className="portal-additionalLinks">{t.submissionLinks.map((link,index)=><a key={link} className="portal-projectLink" href={link} target="_blank" rel="noopener noreferrer" title={link}>{index+1}. {link}<span aria-hidden="true"> ↗</span></a>)}</div> : "—"}</td>
                    <td><SubmissionFiles teamId={t.id} compact /></td>
                    <td>{t.mealsClaimed ?? 0}</td>
                    <td>
                      {t.qrToken ? (
                        <button
                          type="button"
                          className="portal-logout"
                          style={{ borderColor: "#f0b35c", color: "#f0b35c", padding: "0.25rem 0.6rem" }}
                          onClick={() => setViewQrTeam(t)}
                        >
                          View QR
                        </button>
                      ) : (
                        <span className="portal-table__sub">Standby</span>
                      )}
                    </td>
                    <td>
                      <ShortlistToggle team={t} onChanged={onShortlistChanged} />
                    </td>
                    <td>{t.partnerAccess ? <div className="partner-access-admin"><strong>{t.partnerAccess.label}</strong><span>{t.partnerAccess.username}</span><span>{t.partnerAccess.password}</span></div> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {panel === "overview" && <>
      <PsManager problemStatements={problemStatements} onSaved={loadPs} />



      <AnnouncementsManager teams={teams} />


      </>}

      {panel === "staff" && (
      <section className="portal-card">
        <div className="portal-card__headRow">
          <h3>Staff accounts ({accounts?.length ?? "…"})</h3>
          <button
            type="button"
            className="portal-auth__submit"
            style={{ width: "auto", padding: "0.45rem 1rem", fontSize: "0.85rem" }}
            onClick={() => setShowAddStaff(true)}
          >
            + Generate Staff Login
          </button>
        </div>
        <p className="portal-card__hint">Staff account details. Passwords are shown once when created; save them securely.</p>
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
      )}

      {panel === "marks" && (
      <section className="portal-card">
        {localScorePreview && <p role="status" style={{padding:'1rem', border:'1px solid #c8a766', borderRadius:16, color:'#eee5d2', background:'rgba(20,18,14,.8)'}}>Local preview · Mentoring 1 scores imported for {marksTeams?.length || 0} teams. Edits save on this computer only. Live scores are unchanged.</p>}
        <div className="portal-card__headRow">
          <h3>Team marks &amp; feedback</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="portal-auth__submit"
              style={{
                width: "auto",
                padding: "0.45rem 1.1rem",
                fontSize: "0.85rem",
                background: "#27c93f",
                borderColor: "#27c93f",
                color: "#000",
                fontWeight: 600,
              }}
              disabled={feedbackBusy === "all"}
              onClick={() => setAllResultsVisibility(true)}
            >
              {feedbackBusy === "all" ? "Releasing…" : "Release feedbacks to participants"}
            </button>
            <button
              type="button"
              className="portal-logout"
              style={{ width: "auto", padding: "0.45rem 0.9rem", fontSize: "0.85rem" }}
              disabled={feedbackBusy === "all"}
              onClick={() => setAllResultsVisibility(false)}
            >
              Hide feedbacks
            </button>
            <ExportButton type="marks" />
          </div>
        </div>
        <p className="portal-card__hint">
          Every team is listed, including teams that have not checked in. Enter Mentoring 1 and Judging Round 1 scores, with two mentoring feedbacks. Final-round scoring appears only for teams shortlisted here. Saving mentoring feedback hides that team's updated feedback until it is released. This section refreshes every five seconds while visible.
        </p>
        <div className="round2-teamGrid">
          {marksTeams?.map(team => <article className="round2-teamCard" key={team.id}>
            <header><h4>{team.teamName}</h4><span>{team.teamCode} · Team ID {team.id}{team.seatNo != null && ` · Seat ${team.seatNo}`}{team.withdrawn && " · Withdrawn"}</span></header>
            <FinalMarksEditor team={team} onSaved={saveStage} />
            <FinalMarksEditor team={team} stage="judging1" onSaved={saveStage} />
            <button type="button" className="portal-logout" aria-pressed={team.finalRoundShortlisted} disabled={feedbackBusy===team.id} onClick={()=>toggleFinal(team)}>{team.finalRoundShortlisted ? 'Shortlisted for final round · Remove' : 'Shortlist for final round'}</button>
            {team.finalRoundShortlisted && <FinalMarksEditor team={team} stage="final" onSaved={saveStage} />}
            <div className="round2-savedFeedback"><span>Mentoring 1 feedback</span><p>{team.mentoring1Feedback || "No feedback entered."}</p><span>Mentoring 2 feedback</span><p>{team.mentoring2Feedback || "No feedback entered."}</p></div>
            <button type="button" className="portal-logout" disabled={feedbackBusy === team.id || team.score == null} onClick={() => toggleFeedbackApproval(team.id, team.feedbackApproved)}>
              {feedbackBusy === team.id ? "Updating…" : team.feedbackApproved ? "Visible to participants · Hide" : "Hidden from participants · Release"}
            </button>
          </article>)}
        </div>
        <AdminRound2Leaderboard teams={marksTeams} /><AdminRound2Leaderboard teams={marksTeams} final />
      </section>
      )}

      {panel === "overview" && (
      <section className="portal-card">
        <div className="portal-card__headRow">
          <h3>Meals served</h3>
          <ExportButton type="meals" />
        </div>
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
                    <td><button type="button" className="meal-analysisOpen" onClick={() => setMealAnalysisSlot(s.code)} aria-label={`View Day ${s.dayNo} ${s.label} meal analysis`}>Day {s.dayNo} — {s.label}<span>View live analysis →</span></button></td>
                    <td><button type="button" className="meal-analysisOpen" onClick={() => setMealAnalysisSlot(s.code)} aria-label={`View ${s.label} served participants`}>{s.served}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {panel === "overview" && <FreezeResultsToggle />}
      {panel === "audit" && <AuditLog />}
      <GlassSystemProvider design="liquid" renderer="auto" theme={{ appearance: "dark" }} toasts={false}>
      <Glass as="nav" material="regular" className="portal-adminNav" aria-label="Admin sections"
        look={{ blur: .55, opacity: .65, tint: "#101827", saturation: 1.35, brightness: .88, rim: 1.6, highlight: 1.4, lensing: 1.7, lightAngle: 315, shadow: 1.3 }}>
        {[["overview", "Overview", "home"], ["teams", "Teams", "teams"], ["staff", "Staff accounts", "staff"], ["marks", "Team marks", "marks"], ["audit", "Audit log", "audit"]].map(([key, label, icon]) => (
          <button key={key} type="button" aria-current={panel === key ? "page" : undefined} onClick={() => { setPanel(key); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <AdminNavIcon name={icon} /><span>{label}</span>
          </button>
        ))}
      </Glass>
      </GlassSystemProvider>

      {mealAnalysisSlot && <MealAnalysisPopup slotCode={mealAnalysisSlot} onClose={() => setMealAnalysisSlot(null)} onUpdate={onMealAnalysisUpdate} />}
      {viewQrTeam && <QrModal team={viewQrTeam} onClose={() => setViewQrTeam(null)} />}
      {showAllQrs && <AllQrsModal teams={teams || []} onClose={() => setShowAllQrs(false)} />}
      {showAddTeam && (
        <CreateTeamModal
          onCreated={() => loadAll()}
          onClose={() => setShowAddTeam(false)}
        />
      )}
      {showAddStaff && (
        <CreateStaffModal
          onCreated={() => loadAll()}
          onClose={() => setShowAddStaff(false)}
        />
      )}
    </div>
  );
}

export default function AdminDashboard() {
  return <RequireRole role="admin">{(session) => <AdminHome session={session} />}</RequireRole>;
}
