import { useEffect, useRef, useState } from 'react';
import { Button } from 'open-glass-ui';
import TeamLiquidGlass from './TeamLiquidGlass';

export default function ObliqOpportunity({ team }) {
  const [active, setActive] = useState(null), [acknowledged, setAcknowledged] = useState(false);
  const [voucher, setVoucher] = useState(null), [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef(null);
  useEffect(() => { if (active && !dialog.current?.open) dialog.current?.showModal(); }, [active]);
  function reset() { setActive(null); setAcknowledged(false); setVoucher(null); setCopied(false); setError(''); }
  function close() { if (busy) return; dialog.current?.close(); reset(); }
  async function copyCode() {
    try { await navigator.clipboard.writeText(voucher.code); setCopied(true); setError(''); }
    catch { setError('Unable to copy automatically. Select the code and copy it manually.'); }
  }
  async function proceed() {
    if (!acknowledged || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/obliq-access', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acknowledged: true, resource: active }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to open the application.');
      if (active === 'xyz') { setVoucher(data); setAcknowledged(false); setBusy(false); }
      else window.location.assign(data.url);
    } catch (e) { setError(e.message); setBusy(false); }
  }
  if (!team?.obliqOpportunity) return null;
  const xyz = active === 'xyz';
  return <>
    <div className="team-winner-benefits" aria-label="Winning team benefits">
    <Button variant="secondary" type="button" className="team-partner-pill team-obliq-capsule" onClick={() => setActive('obliq')} aria-haspopup="dialog">
      <span className="team-partner-pill__logo"><img src="/obliq-logo.avif" alt="Obliq" /></span>
      <span className="team-obliq-capsule__text">Founding Engineering 3</span>
    </Button>
    <Button variant="secondary" type="button" className="team-partner-pill team-obliq-capsule" onClick={() => setActive('xyz')} aria-haspopup="dialog">
      <span className="team-partner-pill__logo"><img src="/xyz-logo-purple.png" alt=".xyz" /></span>
      <span className="team-obliq-capsule__text">Free domain for one year</span>
    </Button>
    </div>
    {active && <dialog ref={dialog} className="team-partner-dialog team-obliq-dialog" aria-labelledby="obliq-title" onCancel={event => { event.preventDefault(); close(); }} onClose={reset} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <TeamLiquidGlass material="regular" className="team-partner-dialog__panel">
        <header><div><span className="team-partner-dialog__brand"><img src={xyz ? '/xyz-logo-purple.png' : '/obliq-logo.avif'} alt={xyz ? '.xyz' : 'Obliq'} /></span><h2 id="obliq-title">{xyz ? 'Your .xyz domain · Free for one year' : 'Founding Engineering 3'}</h2></div><button type="button" className="team-partner-dialog__close" aria-label="Close benefit details" disabled={busy} onClick={close}>×</button></header>
        {voucher ? <>
          <p>Your domain voucher is ready. Copy the code below to claim a free .xyz domain for one year.</p>
          <div className="team-partner-code team-xyz-voucher"><div><span>Domain access code</span><code>{voucher.code}</code></div><Button variant="secondary" type="button" onClick={copyCode}>{copied ? 'Copied ✓' : 'Copy code'}</Button></div>
          {copied && <p className="team-xyz-claim" role="status">Code copied. <a href={voucher.guideUrl} target="_blank" rel="noopener noreferrer">How to claim · Google Drive guide</a></p>}
          {error && <p role="alert">{error}</p>}
          <Button variant="secondary" type="button" className="team-partner-done" onClick={close}>Done</Button>
        </> : <>
        {xyz ? <p>This voucher gives your winning team access to a free .xyz domain for one year. Keep the code and instructions within your team.</p> : <>
        <p>This application opportunity is exclusively for the three winning teams. Keep the form and its details within your team.</p>
        </>}
        <label className="team-obliq-acknowledgement">
          <input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} />
          <span>{xyz ? 'I acknowledge that I will not share the voucher code or its instructions with anyone other than my teammates. I understand that sharing may result in loss of eligibility to receive prize money and partner benefits.' : 'I acknowledge that I will not share the application link or its details with anyone other than my teammates. I understand that sharing may result in loss of eligibility to receive prize money and to apply to Obliq or companies partnered with Obliq.'}</span>
        </label>
        {error && <p role="alert">{error}</p>}
        <Button variant="primary" type="button" className="team-partner-done" disabled={!acknowledged || busy} onClick={proceed}>{busy ? 'Please wait…' : xyz ? 'Acknowledge & reveal code' : 'Acknowledge & continue'}</Button>
        </>}
      </TeamLiquidGlass>
    </dialog>}
  </>;
}
