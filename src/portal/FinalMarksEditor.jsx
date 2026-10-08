import { useId, useState } from 'react';
import { coreSubmitMark } from './api';

export default function FinalMarksEditor({ team, onSaved }) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState('');
  const [feedback1, setFeedback1] = useState('');
  const [feedback2, setFeedback2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function edit() {
    setScore(team.score ?? 0); setFeedback1(team.mentoring1Feedback || '');
    setFeedback2(team.mentoring2Feedback || ''); setError(''); setEditing(true);
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const result = await coreSubmitMark(team.id, Number(score), feedback1.trim(), feedback2.trim());
      onSaved({...team, score:result.score, mentoring1Feedback:feedback1.trim(), mentoring2Feedback:feedback2.trim(), feedbackApproved:false});
      setEditing(false);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="round2-scoreEditor">
    {!editing ? <><strong>Final score: {team.score ?? 'Unscored'}</strong><button type="button" className="portal-logout" onClick={edit}>Edit score &amp; feedback</button></> :
      <form onSubmit={save}>
        <label className="portal-field" htmlFor={`${id}-score`}><span>Final score</span><input id={`${id}-score`} type="number" min="0" max="100" step="0.01" required value={score} onChange={e=>setScore(e.target.value)} /></label>
        <label className="portal-field" htmlFor={`${id}-m1`}><span>Mentoring 1 feedback</span><textarea aria-label="Mentoring 1 feedback" id={`${id}-m1`} rows={4} maxLength={10000} value={feedback1} onChange={e=>setFeedback1(e.target.value)} /></label>
        <label className="portal-field" htmlFor={`${id}-m2`}><span>Mentoring 2 feedback</span><textarea aria-label="Mentoring 2 feedback" id={`${id}-m2`} rows={4} maxLength={10000} value={feedback2} onChange={e=>setFeedback2(e.target.value)} /></label>
        {error && <p role="alert" className="portal-auth__error">{error}</p>}
        <div className="round2-editorActions"><button type="submit" className="portal-auth__submit" disabled={busy}>{busy?'Saving…':'Save score & feedback'}</button><button type="button" className="portal-logout" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button></div>
      </form>}
  </div>;
}
