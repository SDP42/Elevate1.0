import {requireRole} from './_lib/auth.js';
import {sql} from './_lib/db.js';
// Historical usage only. No credentials are returned or tracked.
export default requireRole(async(req,res)=>{
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const teams=await sql`select t.team_code,ac.display_name team_name,
 coalesce(sum(r.actual_tokens) filter(where r.quota_day='2026-10-10'::date),0)::bigint session1,
 coalesce(sum(r.actual_tokens) filter(where r.quota_day='2026-10-11'::date),0)::bigint session2,
 coalesce(sum(r.actual_tokens),0)::bigint tokens,
 count(r.id) filter(where r.http_status>=400 or r.status in ('upstream_error','uncertain'))::int errors,
 coalesce(sum(r.actual_tokens) filter(where r.model='gpt-5.6-luna'),0)::bigint luna_tokens,
 coalesce(sum(r.actual_tokens) filter(where r.model='deepseek-v4-pro'),0)::bigint deepseek_tokens,
 coalesce(sum(r.actual_tokens) filter(where r.model='gpt-5-mini'),0)::bigint mini_tokens,
 count(r.id) filter(where r.model='gpt-5.6-luna' and (r.http_status>=400 or r.status in ('upstream_error','uncertain')))::int luna_errors,
 count(r.id) filter(where r.model='deepseek-v4-pro' and (r.http_status>=400 or r.status in ('upstream_error','uncertain')))::int deepseek_errors,
 count(r.id) filter(where r.model='gpt-5-mini' and (r.http_status>=400 or r.status in ('upstream_error','uncertain')))::int mini_errors
 from teams t join accounts ac on ac.id=t.account_id
 left join ai_requests r on r.team_id=t.id and r.quota_day in ('2026-10-10'::date,'2026-10-11'::date)
 where not t.withdrawn group by t.id,ac.id order by tokens desc,t.team_code`;
 return res.status(200).json({teams,monitoring:false});
},['team','admin']);
