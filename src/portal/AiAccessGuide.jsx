import { useEffect, useState } from 'react';
const BASE = '/api/ai';
const models = [
  ['GPT-5.6 Luna - Short Context', 'gpt-5.6-luna', 'max_completion_tokens', '1,050,000'],
  ['DeepSeek V4 Pro', 'deepseek-v4-pro', 'max_tokens', '1,000,000'],
  ['GPT-5 Mini', 'gpt-5-mini', 'max_completion_tokens', '400,000'],
];
function GuideTable({ title, headings, rows }) {
  return <section className="team-ai-section"><h3>{title}</h3><div className="team-ai-table-scroll" tabIndex={0} aria-label={`${title} table`}><table><thead><tr>{headings.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map((row,i) => <tr key={i}>{row.map((cell,j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div></section>;
}
export default function AiAccessGuide() {
  const [access,setAccess]=useState(null),[error,setError]=useState(''),[visible,setVisible]=useState(false);
  useEffect(()=>{let live=true;fetch('/api/ai-access',{credentials:'include'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}).then(d=>{if(live)setAccess(d);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
  const endpoint=typeof window==='undefined'?BASE:window.location.origin+BASE;
  return <div className="team-ai-guide">
    <div className="team-partner-callout"><strong>800,000 tokens per team per day</strong><p>Input and output tokens count together across all three models. All requests pass through the Elevate gateway and are monitored. Daily usage resets at 05:30 AM IST.</p></div>
    <div className="team-partner-code"><span>Your private team API key</span>{error?<p role="alert">{error}</p>:access?<><code>{visible?access.key:'••••••••••••••••'}</code><button type="button" onClick={()=>setVisible(!visible)}>{visible?'Hide':'Show'}</button><button type="button" onClick={()=>navigator.clipboard.writeText(access.key)}>Copy key</button><p>{access.used.toLocaleString()} / {access.dailyLimit.toLocaleString()} tokens used today</p></>:<p>Loading your access…</p>}</div>
    <GuideTable title="Gateway and authentication" headings={['Setting','Information']} rows={[
      ['Base URL',<code>{endpoint}</code>],['Protocol','HTTPS in production; use your deployment URL'],['Authentication',<code>Authorization: Bearer &lt;TEAM_API_KEY&gt;</code>],
      ['Network','Send requests to the Elevate website gateway endpoint.'],
      ['Request format','OpenAI Chat Completions JSON. Include the model field using the model identifiers listed below. Text requests only, maximum 48 KB.'],
      ['Streaming',<code>"stream": false</code>],
    ]}/>
    <GuideTable title="Models and endpoints" headings={['Model','POST endpoint','Output parameter','Context tokens']} rows={models.map(([name,path,param,context]) => [name,<code>{endpoint}<br/>model: {path}</code>,<code>{param}</code>,context])}/>
    <GuideTable title="Usage limits" headings={['Scope','Limit','Details']} rows={[
      ['Your team','800,000 tokens/day','Shared across models and all team members; input + output.'],
      ['Reset','05:30 AM IST daily','00:00 UTC; fixed daily window.'],
      ['Event access','During the authorised event window','A quota reset does not extend the event access window.'],
    ]}/>
    <GuideTable title="HTTP response guidelines" headings={['Code','Meaning','What to do']} rows={[
      ['429','Per-minute token or request limit reached','Wait for the seconds in Retry-After, then retry.'],
      ['403','Token quota is exceeded','Daily token allowance exhausted. Wait until the next 05:30 AM IST reset, within the event window.'],
      ['401','Missing or invalid key','Check your team API key. Do not post the key in support chats.'],
    ]}/>
    <GuideTable title="Usage information" headings={['Field','Meaning']} rows={[
      ['X-Elevate-Request-Id','Request identifier for organiser support.'],
      ['usage.total_tokens','Actual request token usage including input, output and reasoning.'],
      ['Dashboard usage','Daily charged usage. Uncertain provider calls retain their reserved quota.'],
    ]}/>
    <GuideTable title="Credential rules" headings={['Rule','Requirement']} rows={[
      ['Private server use','Keep team API keys on your server/proxy only, in environment variables. Never include them in browser/mobile code, repositories or chat groups.'],
      ['Team allocation','Use only credentials assigned to your team. Do not share keys with other teams or bypass limits.'],
      ['Monitoring and enforcement','The team allowance is 800,000 tokens per day. Usage is monitored through the Elevate platform. Exceeding limits or sharing credentials may result in access being suspended.'],
      ['Exposed key','Contact the organisers immediately so the team API key can be regenerated.'],
    ]}/>
    <section className="team-ai-section"><h3>Sample requests</h3><p>Run these on your server only. Set ELEVATE_TEAM_API_KEY to your private team key. The output limit must be 1–4000; reasoning also counts toward it. Use streaming=false.</p>
      {models.map(([name,path,param]) => <div key={path}><h4>{name}</h4><pre><code>{`curl -X POST "${endpoint}" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer $ELEVATE_TEAM_API_KEY" \\\n  -d '{"model":"${path}","messages":[{"role":"user","content":"Hello"}],"${param}":2000}'`}</code></pre></div>)}
    </section>
  </div>;
}
