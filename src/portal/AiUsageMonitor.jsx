import {useEffect,useState} from 'react';
const number=value=>Number(value||0).toLocaleString();
export default function AiUsageMonitor(){
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
 const controller=new AbortController();
 fetch('/api/ai-access',{credentials:'include',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;})
 .then(d=>setRows(d.teams||[])).catch(e=>{if(e.name!=='AbortError')setError(e.message);})
 .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
 return()=>controller.abort();
 },[]);
 return <section className="portal-card team-ai-guide"><h2>AI usage · Sessions 1 + 2</h2>
 <p>Recorded token usage from 10 and 11 October, sorted by combined usage. Backend monitoring has stopped. Failed requests without provider token accounting are counted as errors, not token usage.</p>
 {error&&<p role="alert">{error}</p>}{loading&&<p role="status">Loading usage…</p>}
 <div className="team-ai-table-scroll" tabIndex={0} aria-label="All teams AI usage"><table><thead><tr>{['Team','Session 1 tokens','Session 2 tokens','Total tokens','Errors','GPT-5.6 Luna','DeepSeek V4 Pro','GPT-5 Mini'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead>
 <tbody>{rows.map(r=><tr key={r.team_code}><td>{r.team_code} · {r.team_name}</td><td>{number(r.session1)}</td><td>{number(r.session2)}</td><td><strong>{number(r.tokens)}</strong></td><td>{r.errors}</td>
 <td>{number(r.luna_tokens)} tokens<br/>{r.luna_errors} errors</td><td>{number(r.deepseek_tokens)} tokens<br/>{r.deepseek_errors} errors</td><td>{number(r.mini_tokens)} tokens<br/>{r.mini_errors} errors</td></tr>)}</tbody></table></div></section>;
}
