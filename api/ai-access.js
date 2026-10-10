import {requireRole} from './_lib/auth.js';import {sql} from './_lib/db.js';import {decryptKey} from './_lib/ai-gateway.js';
export default requireRole(async(req,res)=>{
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(req.session.role==='team'){
 const [r]=await sql`select a.key_cipher,a.daily_limit,a.enabled,coalesce((select sum(charged_tokens) from ai_requests where team_id=a.team_id and quota_day=(clock_timestamp() at time zone 'UTC')::date),0)::int used from ai_team_access a where team_id=${req.session.teamId}`;
 if(!r||!r.enabled)return res.status(503).json({error:'AI access is not enabled for your team.'});
 return res.status(200).json({key:decryptKey(r.key_cipher),dailyLimit:r.daily_limit,used:r.used,remaining:Math.max(0,r.daily_limit-r.used),endpoint:'/api/ai'});
 }
 const rows=await sql`select t.team_code,ac.display_name team_name,a.project_id,a.daily_limit,a.enabled,count(r.id)::int requests,coalesce(sum(r.charged_tokens),0)::int tokens,count(r.id) filter(where r.status in ('uncertain','reserved'))::int unresolved,count(r.id) filter(where r.http_status>=400)::int errors from ai_team_access a join teams t on t.id=a.team_id join accounts ac on ac.id=t.account_id left join ai_requests r on r.team_id=t.id and r.quota_day=(clock_timestamp() at time zone 'UTC')::date group by t.id,ac.id,a.team_id order by t.team_code`;
 const recent=await sql`select r.id,t.team_code,r.model,r.status,r.http_status,r.actual_tokens,r.charged_tokens,r.latency_ms,r.created_at from ai_requests r join teams t on t.id=r.team_id order by r.created_at desc limit 50`;
 return res.status(200).json({teams:rows,recent,reset:'05:30 AM IST'});
},['team','admin']);
