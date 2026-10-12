import { useEffect, useRef, useState } from 'react';
import { Button } from 'open-glass-ui';
import TeamLiquidGlass from './TeamLiquidGlass';

export default function ObliqOpportunity({ team }) {
  const [open, setOpen] = useState(false), [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef(null);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); }, [open]);
  function close() { if (busy) return; dialog.current?.close(); setOpen(false); setAcknowledged(false); setError(''); }
  async function proceed() {
    if (!acknowledged || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/obliq-access', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledged: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to open the application.');
      window.location.assign(data.url);
    } catch (e) { setError(e.message); setBusy(false); }
  }
  if (!team?.obliqOpportunity) return null;
  return <>
    <Button variant="secondary" type="button" className="team-partner-pill team-obliq-capsule" onClick={() => setOpen(true)} aria-haspopup="dialog">
      <span className="team-partner-pill__logo"><img src="/obliq-logo.avif" alt="Obliq" /></span>
      <span className="team-obliq-capsule__text">Founding Engineering 3</span>
    </Button>
    {open && <dialog ref={dialog} className="team-partner-dialog team-obliq-dialog" aria-labelledby="obliq-title" onCancel={event => { event.preventDefault(); close(); }} onClose={() => { setOpen(false); setAcknowledged(false); setError(''); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <TeamLiquidGlass material="regular" className="team-partner-dialog__panel">
        <header><div><span className="team-partner-dialog__brand"><img src="/obliq-logo.avif" alt="Obliq" /></span><h2 id="obliq-title">Founding Engineering 3</h2></div><button type="button" className="team-partner-dialog__close" aria-label="Close acknowledgement" disabled={busy} onClick={close}>×</button></header>
        <p>This application opportunity is exclusively for the three winning teams. Keep the form and its details within your team.</p>
        <label className="team-obliq-acknowledgement">
          <input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} />
          <span>I acknowledge that I will not share the application link or its details with anyone other than my teammates. I understand that sharing may result in loss of eligibility to receive prize money and to apply to Obliq or companies partnered with Obliq.</span>
        </label>
        {error && <p role="alert">{error}</p>}
        <Button variant="primary" type="button" className="team-partner-done" disabled={!acknowledged || busy} onClick={proceed}>{busy ? 'Opening application…' : 'Acknowledge & continue'}</Button>
      </TeamLiquidGlass>
    </dialog>}
  </>;
}
