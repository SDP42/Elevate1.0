import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Glass, GlassSystemProvider } from 'open-glass-ui';
import useStaffSnapshot from './useStaffSnapshot';

export default function MealAnalysisPopup({ slotCode, endpoint = 'admin', onClose, onUpdate }) {
  const dialog = useRef(null), title = useId();
  const searchLabel = useId(), progressLabel = useId();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const snapshot = useStaffSnapshot(endpoint, slotCode, { resource: 'meal-analysis', liveRefresh: true });
  const data = snapshot.data?.requestSlot === slotCode ? snapshot.data : null;
  useEffect(() => {
    const opener = document.activeElement, element = dialog.current;
    element.showModal();
    return () => { element.close(); opener?.focus?.(); };
  }, []);
  useEffect(() => { if (data) onUpdate?.(data); }, [data, onUpdate]);
  const status = team => team.withdrawn ? 'withdrawn' : team.total > 0 && team.served === team.total ? 'complete' : team.served ? 'partial' : 'waiting';
  const teams = (data?.teams || []).filter(team =>
    (filter === 'all' || status(team) === filter) &&
    `${team.teamCode} ${team.teamName} ${team.members.map(m => m.name).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const summary = data?.summary;
  return createPortal(<dialog ref={dialog} className="submission-previewDialog meal-analysisDialog" aria-labelledby={title}
    onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <GlassSystemProvider design="liquid" renderer="auto" theme={{ appearance: 'dark' }} toasts={false}>
      <Glass material="regular" className="submission-previewGlass" look={{ blur: .8, rim: 1.5, lensing: 1.5 }}>
        <header className="submission-previewHeader"><div><span className="submission-previewEyebrow">Live meal analysis</span>
          <h2 id={title}>{data ? `Day ${data.slot.dayNo} · ${data.slot.label}` : 'Meal details'}</h2>
          <p className="meal-analysisSync">Refreshes every 5 seconds while visible{data && ` · Updated ${new Date(data.updatedAt).toLocaleTimeString('en-IN')}`}</p>
        </div><button type="button" className="submission-previewClose" onClick={onClose} aria-label="Close meal analysis">Close ×</button></header>
        <div className="submission-previewBody">
          {snapshot.error && <p role="status" className="portal-auth__error">{snapshot.error}</p>}
          {!data && !snapshot.error && <p role="status">Loading meal scans…</p>}
          {summary && <>
            <div className="meal-analysisStats">{[['Participants served', `${summary.served} / ${summary.total}`], ['Remaining', summary.total - summary.served], ['Complete teams', summary.completeTeams], ['Partially served', summary.partialTeams], ['Waiting teams', summary.waitingTeams]].map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
            <p className="portal-card__hint">Totals cover active teams. Withdrawn teams remain visible in the team history below.</p>
            <div className="meal-analysisBreakdown"><section><h3>Food preferences</h3>{Object.entries(summary.diets).map(([diet, counts]) => <p key={diet}><strong>{diet}</strong><span>{counts.served} served · {counts.total - counts.served} remaining · {counts.total} total</span></p>)}</section>
              <section><h3>Counter activity</h3>{Object.entries(summary.counters).map(([counter, count]) => <p key={counter}><strong>{counter}</strong><span>{count} served</span></p>)}{!Object.keys(summary.counters).length && <p>No scans yet.</p>}</section></div>
            <div className="meal-analysisFilters"><label className="portal-field"><span id={searchLabel}>Search teams or participants</span><input aria-labelledby={searchLabel} type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Team name, ELEV code or participant" /></label><label className="portal-field"><span id={progressLabel}>Progress</span><select aria-labelledby={progressLabel} value={filter} onChange={e => setFilter(e.target.value)}>{[['all', 'All teams'], ['complete', 'Complete'], ['partial', 'Partial'], ['waiting', 'Waiting'], ['withdrawn', 'Withdrawn']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
            <div className="meal-analysisTeams">{teams.map(team => <article key={team.id} className="meal-analysisTeam"><header><div><h3>{team.teamName}</h3><span>{team.teamCode}{team.seatNo != null && ` · Seat ${team.seatNo}`}</span></div><strong className={`meal-analysisStatus is-${status(team)}`}>{team.withdrawn ? 'Withdrawn' : `${team.served} / ${team.total} served`}</strong></header>
              <ul>{team.members.map(member => <li key={member.id}><div><strong>{member.name}</strong><span>{member.isLead ? 'Team leader · ' : ''}{member.foodPreference}</span></div><div className="meal-analysisScan">{member.served ? <><span className="meal-analysisServed">Served ✓</span><time dateTime={member.givenAt}>{new Date(member.givenAt).toLocaleTimeString('en-IN')} · {member.counter || 'Meal counter'}</time></> : <span>Not yet served</span>}</div></li>)}</ul>
            </article>)}{!teams.length && <p>No teams match this filter.</p>}</div>
          </>}
        </div>
      </Glass>
    </GlassSystemProvider>
  </dialog>, document.body);
}
