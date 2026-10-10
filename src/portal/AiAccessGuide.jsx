const BASE = 'https://elevate-ai-gateway.azure-api.net';
const models = [
  ['GPT-5.6 Luna - Short Context', 'gpt-5.6-luna', 'max_completion_tokens', '1,050,000'],
  ['DeepSeek V4 Pro', 'deepseek-v4-pro', 'max_tokens', '1,000,000'],
  ['GPT-5 Mini', 'gpt-5-mini', 'max_completion_tokens', '400,000'],
];
function GuideTable({ title, headings, rows }) {
  return <section className="team-ai-section"><h3>{title}</h3><div className="team-ai-table-scroll" tabIndex={0} aria-label={`${title} table`}><table><thead><tr>{headings.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map((row,i) => <tr key={i}>{row.map((cell,j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div></section>;
}
export default function AiAccessGuide() {
  return <div className="team-ai-guide">
    <div className="team-partner-callout"><strong>1,000,000 tokens per team per day</strong><p>Input and output tokens count together across all three models. Access credentials will be issued separately. API access and usage monitoring through the Elevate platform are being configured; this guide does not activate access.</p></div>
    <GuideTable title="Gateway and authentication" headings={['Setting','Information']} rows={[
      ['Base URL',<code>{BASE}</code>],['Protocol','HTTPS, port 443'],['Authentication',<code>Ocp-Apim-Subscription-Key: &lt;PROJECT_KEY&gt;</code>],
      ['Network','Allowlist elevate-ai-gateway.azure-api.net by hostname. No fixed IP; avoid IP allowlisting.'],
      ['Request format','OpenAI Chat Completions JSON. The model field is not required; the endpoint and project key route the request.'],
      ['Streaming',<code>"stream": true</code>],
    ]}/>
    <GuideTable title="Models and endpoints" headings={['Model','POST endpoint','Output parameter','Context tokens']} rows={models.map(([name,path,param,context]) => [name,<code>{BASE}/{path}/chat/completions</code>,<code>{param}</code>,context])}/>
    <GuideTable title="Usage limits" headings={['Scope','Limit','Details']} rows={[
      ['Your team','1,000,000 tokens/day','Shared across models and all team members; input + output.'],
      ['Reset','05:30 AM IST daily','00:00 UTC; fixed daily window.'],
      ['Event access','During the authorised event window','A quota reset does not extend the event access window.'],
    ]}/>
    <GuideTable title="HTTP response guidelines" headings={['Code','Meaning','What to do']} rows={[
      ['429','Per-minute token or request limit reached','Wait for the seconds in Retry-After, then retry.'],
      ['403','Token quota is exceeded','Daily token allowance exhausted. Wait until the next 05:30 AM IST reset, within the event window.'],
      ['401','Missing or invalid key','Check the server/proxy key configuration. Do not post the key in support chats.'],
    ]}/>
    <GuideTable title="Usage information" headings={['Field / header','Meaning']} rows={[
      ['x-apim-tokens-consumed','Tokens consumed by this request.'],['x-apim-remaining-tokens-per-minute','Estimated tokens remaining this minute.'],
      ['x-apim-remaining-quota-tokens','Estimated tokens remaining today.'],['x-elevate-deployment','Project deployment serving the request.'],
      ['usage.total_tokens','Sum this response field for exact usage accounting. Remaining-token headers are estimates.'],
    ]}/>
    <GuideTable title="Credential rules" headings={['Rule','Requirement']} rows={[
      ['Private server use','Keep project keys on your server/proxy only, in environment variables. Never include them in browser/mobile code, repositories or chat groups.'],
      ['Team allocation','Use only credentials assigned to your team. Do not share keys with other teams or bypass limits.'],
      ['Monitoring and enforcement','The team allowance is 1 million tokens per day. Usage will be monitored through the Elevate platform once the proxy is enabled. Exceeding limits or sharing credentials may result in access being suspended.'],
      ['Exposed key','Contact the organisers immediately so the project key can be regenerated.'],
    ]}/>
    <section className="team-ai-section"><h3>Sample requests</h3><p>Run these on your server only. The environment variable below is a placeholder for the key issued later. Direct gateway examples are for server integration; participant proxy details will follow.</p>
      {models.map(([name,path,param]) => <div key={path}><h4>{name}</h4><pre><code>{`curl -X POST "${BASE}/${path}/chat/completions" \\\n  -H "Content-Type: application/json" \\\n  -H "Ocp-Apim-Subscription-Key: $ELEVATE_PROJECT_KEY" \\\n  -d '{"messages":[{"role":"user","content":"Hello"}],"${param}":2000}'`}</code></pre></div>)}
    </section>
  </div>;
}
