import {useEffect,useState} from 'react';
import TeamLiquidGlass from './TeamLiquidGlass';
export default function ParticipantLeaderboards({teamCode}){
 const [tokens,setTokens]=useState(null),[scores,setScores]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;let loading=false;let lastTokens=0;
 const load=async()=>{if(loading||document.hidden)return;loading=true;try{
 const refreshTokens=Date.now()-lastTokens>=22*60*1000;
 const paths=refreshTokens?['/leaderboard','/ai-access?resource=leaderboard']:['/leaderboard'];
 const responses=await Promise.all(paths.map(p=>fetch('/api'+p,{credentials:'include'})));
 const data=await Promise.all(responses.map(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load leaderboard');return d;}));
 if(live){setScores(data[0]);if(refreshTokens){setTokens(data[1]);lastTokens=Date.now();}setError('');}
 }catch(e){if(live)setError(e.message);}finally{loading=false;}};
 load();const timer=setInterval(load,30000);document.addEventListener('visibilitychange',load);
 return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',load);};
 },[]);
 const published=scores?.leaderboard?.filter(r=>r.score!=null)||[];
 const rows=tokens?.teams||[],maximum=Math.max(1,...rows.map(r=>r.tokens));
 return <>
 <TeamLiquidGlass as="section" material="regular" className="portal-card participant-score-board"><h3>{scores?.frozen?'Final leaderboard':'Main leaderboard'}</h3>{published.length?<ol>{published.map(r=><li key={r.teamCode}><span>#{r.rank}</span><strong>{r.teamName}</strong><span>{r.teamCode}</span><b>{r.score}</b></li>)}</ol>:<p className="portal-card__hint">{scores?'Scores will appear when released by the organisers.':'Loading leaderboard…'}</p>}</TeamLiquidGlass>
 <TeamLiquidGlass as="section" material="regular" className="portal-card participant-token-board">
 <div className="participant-token-board__head"><div><h3>AI token leaderboard</h3><p>Top 10 teams · Actual tokens consumed across the event</p></div><span className="participant-token-board__badge">22-minute refresh</span></div>
 <p className="portal-card__hint">Input, output and reasoning tokens combined. Usage is not a judging score. Updates every 22 minutes.</p>
 {error&&<p role="alert">{error}</p>}
 {!tokens&&!error&&<p role="status">Loading token usage…</p>}
 {tokens&&!rows.length&&<p>No completed AI requests yet.</p>}
 <ol className="participant-token-chart" aria-label="Top ten teams by actual token usage">{rows.map((r,i)=><li key={r.team_code} className={r.team_code===teamCode?'is-current-team':''}>
 <span className="participant-token-chart__rank">{i+1}</span><div className="participant-token-chart__entry"><div className="participant-token-chart__label"><div><strong>{r.team_name}</strong><span>{r.team_code}{r.team_code===teamCode?' · Your team':''}</span></div><b>{r.tokens.toLocaleString()}<small> tokens</small></b></div><div className="participant-token-chart__track" aria-hidden="true"><div style={{width:`${100*r.tokens/maximum}%`}} /></div></div>
 </li>)}</ol>
 {tokens&&<p className="participant-token-chart__updated">Updated {new Date(tokens.updatedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})} IST</p>}
 </TeamLiquidGlass>
 </>;
}
