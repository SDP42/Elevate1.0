import { useEffect, useRef, useState } from 'react';
import { Button } from 'open-glass-ui';
import TeamLiquidGlass from './TeamLiquidGlass';

const resources = [
  { id: 'voroa', name: 'Voroa', logo: '/voroa-logo.svg' },
  { id: 'n8n', name: 'n8n', logo: '/n8n-logo.svg' },
  { id: 'shipready', name: 'ShipReady', logo: '/shipready-logo.png' },
];
const Link = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children} <span aria-hidden="true">↗</span></a>;

export function PartnerCredential({ access }) {
  const [visible, setVisible] = useState(false);
  if (!access) return null;
  return <div className="team-wifi-access" aria-label="Wi-Fi access">
    <span className="team-wifi-access__label">Wi-Fi access</span>
    <span>Username <strong>{access.username}</strong></span>
    <span>Password <strong>{visible ? access.password : '••••••••'}</strong></span>
    <button type="button" aria-label={visible ? 'Hide Wi-Fi password' : 'Show Wi-Fi password'} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button>
  </div>;
}

export default function PartnerResources({ team, teamName }) {
  const [active, setActive] = useState(null);
  const dialog = useRef(null);
  useEffect(() => {
    if (active && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [active]);
  function close() { dialog.current?.close(); setActive(null); }
  return <>
    <div className="team-partner-pills" aria-label="Partner resources">
      {resources.map(resource => <Button key={resource.id} variant="secondary" type="button" className="team-partner-pill" onClick={() => setActive(resource)} aria-haspopup="dialog" aria-label={`Open ${resource.name} instructions`}>
        <span className="team-partner-pill__logo"><img src={resource.logo} alt="" /></span>
      </Button>)}
    </div>
    {active && <dialog ref={dialog} className="team-partner-dialog" aria-labelledby="partner-dialog-title" onCancel={close} onClose={() => setActive(null)} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <TeamLiquidGlass material="regular" className="team-partner-dialog__panel">
        <header><div><span className="team-partner-dialog__brand"><img src={active.logo} alt="" /></span><h2 id="partner-dialog-title">{active.name} access</h2></div><button type="button" className="team-partner-dialog__close" aria-label="Close partner instructions" onClick={close}>×</button></header>
        {active.id === 'voroa' && <>
          <ol><li>Go to <Link href="https://app.getvoroa.com">Voroa</Link>.</li><li>Choose <strong>Sign in with a code</strong> and enter the email ID you shared with the organisers.</li><li>Enter the six-digit code from your email. No password is needed.</li></ol>
          <p>Team leaders: check your standard Voroa welcome email. The “connect your repo” step is correct—connect GitHub, then deploy with a push.</p>
          <div className="team-partner-callout"><strong>Resources for the whole team</strong><p>2 vCPU / 4 GB is shared across all your services, not available separately per service. Plan heavier video or vision work accordingly.</p><p>CPU only; no GPU. Model API calls such as OpenAI and Gemini work normally from the platform.</p></div>
        </>}
        {active.id === 'n8n' && <>
          <p>Redeem this voucher once per participant.</p><div className="team-partner-code"><span>Voucher code</span><code>2026-COMMUNITY-HACKATHON-INDIA-0A215575</code></div>
          <p><Link href="https://n8n.notion.site/voucher-code">Voucher redemption instructions</Link>. The voucher expires one week after the event.</p>
          <ul className="team-partner-links"><li><Link href="https://docs.n8n.io/">Documentation</Link></li><li><Link href="https://community.n8n.io/tags/c/tutorials/28/course-beginner">Beginner course</Link></li><li><Link href="https://community.n8n.io/c/tutorials/28">Tutorials</Link></li><li><Link href="https://n8n.io/workflows/">Template library</Link></li><li><Link href="https://discord.com/invite/n8n">Discord community</Link></li><li><Link href="https://community.n8n.io/tags/c/tutorials/english/29/course-advanced">Advanced course</Link></li></ul>
        </>}
        {active.id === 'shipready' && <>
          <p>Team leaders: <Link href="https://useshipready.dev/hackathons/join/3">join Elevate on ShipReady</Link>.</p>
          <div className="team-partner-code"><span>Joining code</span><code>4E75B6BT</code></div>
          <p>Enter the joining code, your team name, your team logo and the names of all members.</p>
          <div className="team-partner-callout"><strong>{teamName}</strong><span className="team-partner-team-code">{team?.team_code}</span><ul>{team?.members?.map(member => <li key={member.id}>{member.name}{member.is_lead ? ' · Team leader' : ''}</li>)}</ul><p>Upload your own team logo on ShipReady.</p></div>
        </>}
        <Button variant="secondary" type="button" className="team-partner-done" onClick={close}>Done</Button>
      </TeamLiquidGlass>
    </dialog>}
  </>;
}
