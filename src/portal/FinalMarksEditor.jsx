import { useId, useState } from 'react';
import { coreSubmitMark } from './api';

export default function FinalMarksEditor({ team, onSaved, stage = "mentoring1" }) {
  const id = useId();
  const label = {mentoring1:'Mentoring 1 score',judging1:'Judging Round 1 score',final:'Final round score'}[stage];
  const scoreField = {mentoring1:'mentoring1Score',judging1:'judgingRound1Score',final:'finalRoundScore'}[stage];
  const savedScore = team[scoreField] ?? (stage === 'mentoring1' ? team.score : null);
  const criteria = team.mentoring1Criteria ?? team.localMentoringCriteria;
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState('');
  const [feedback1, setFeedback1] = useState('');
  const [feedback2, setFeedback2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function edit() {
    setScore(savedScore ?? 0); setFeedback1(team.mentoring1Feedback || '');
    setFeedback2(team.mentoring2Feedback || ''); setError(''); setEditing(true);
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const result = await coreSubmitMark(team.id, Number(score), feedback1.trim(), feedback2.trim(), stage);
      onSaved({...team, [scoreField]:result.score, ...(stage === 'mentoring1' ? {score:result.score,mentoring1Feedback:feedback1.trim(),mentoring2Feedback:feedback2.trim(),feedbackApproved:false}: {})});
      setEditing(false);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="round2-scoreEditor">
    {stage === 'mentoring1' && criteria && <dl style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:12, margin:'0 0 16px'}}>
      {Object.entries(criteria).map(([criterion, value]) => <div key={criterion}><dt style={{fontSize:12, opacity:.8}}>{criterion}</dt><dd style={{margin:0}}>{value} / 5</dd></div>)}
    </dl>}
    {!editing ? <><strong>{label}: {savedScore ?? 'Unscored'}</strong><button type="button" className="portal-logout" onClick={edit}>{stage === "mentoring1" ? "Edit mentoring score & feedback" : `Edit ${label.toLowerCase()}`}</button></> :
      <form onSubmit={save}>
        <label className="portal-field" htmlFor={`${id}-score`}><span>{label}</span><input id={`${id}-score`} type="number" min="0" max="100" step="0.01" required value={score} onChange={e=>setScore(e.target.value)} /></label>
        {stage === "mentoring1" && <><label className="portal-field" htmlFor={`${id}-m1`}><span>Mentoring 1 feedback</span><textarea aria-label="Mentoring 1 feedback" id={`${id}-m1`} rows={4} maxLength={10000} value={feedback1} onChange={e=>setFeedback1(e.target.value)} /></label>
        <label className="portal-field" htmlFor={`${id}-m2`}><span>Mentoring 2 feedback</span><textarea aria-label="Mentoring 2 feedback" id={`${id}-m2`} rows={4} maxLength={10000} value={feedback2} onChange={e=>setFeedback2(e.target.value)} /></label></>}
        {error && <p role="alert" className="portal-auth__error">{error}</p>}
        <div className="round2-editorActions"><button type="submit" className="portal-auth__submit" disabled={busy}>{busy?'Saving…':stage === 'mentoring1' ? 'Save mentoring score & feedback' : 'Save score'}</button><button type="button" className="portal-logout" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button></div>
      </form>}
  </div>;
}
