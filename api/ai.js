import {sql} from './_lib/db.js';
import {secureHandler} from './_lib/http.js';
import {hashKey,decryptKey,validateAiBody,reserveAiRequest} from './_lib/ai-gateway.js';
export const config={maxDuration:60};
export default secureHandler(async(req,res)=>{
 if(req.method!=='POST')return res.status(405).json({error:'Use POST with your team Bearer token.'});
 const token=req.headers.authorization?.match(/^Bearer (elev_[A-Za-z0-9_-]+)$/)?.[1];
 if(!token)return res.status(401).json({error:'Provide Authorization: Bearer <TEAM_API_KEY>.'});
 const [access]=await sql`select a.*,p.key_cipher project_key from ai_team_access a join ai_projects p on p.id=a.project_id join teams t on t.id=a.team_id where a.key_hash=${hashKey(token)} and a.enabled and not t.withdrawn`;
 if(!access)return res.status(401).json({error:'Invalid or disabled team key.'});
 const end=Date.parse(process.env.AI_ACCESS_ENDS_AT||'2026-10-11T04:30:00.000Z');
 if(Date.now()<Date.parse('2026-10-10T00:00:00+05:30')||Date.now()>=end)return res.status(403).json({error:'AI access is outside the event window.'});
 let validated;try{validated=validateAiBody(req.body);}catch(e){return res.status(400).json({error:e.message});}
 const id=await reserveAiRequest(sql,access,validated.model,validated.reserved);
 if(!id){res.setHeader('Retry-After','60');return res.status(429).json({error:'Team daily allowance or request/token rate limit reached. Reduce request size or retry later. Daily reset: 05:30 AM IST.'});}
 const start=Date.now();
 try{
 const upstream=await fetch(`https://elevate-ai-gateway.azure-api.net/${validated.model}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json','Ocp-Apim-Subscription-Key':decryptKey(access.project_key)},body:JSON.stringify(validated.payload),signal:AbortSignal.timeout(45000)});
 const data=await upstream.json();const total=Number(data.usage?.total_tokens);
 const actual=upstream.ok&&Number.isSafeInteger(total)&&total>=0?total:null;
 // Retain the reservation on ambiguous failures or missing accounting.
 await sql`update ai_requests set status=${upstream.ok?'completed':'upstream_error'},http_status=${upstream.status},actual_tokens=${actual},charged_tokens=coalesce(${actual},charged_tokens),latency_ms=${Date.now()-start} where id=${id}::uuid`;
 res.setHeader('X-Elevate-Request-Id',id);
 if(upstream.headers.get('retry-after'))res.setHeader('Retry-After',upstream.headers.get('retry-after'));
 if(!upstream.ok)return res.status(upstream.status).json({error:'AI provider request failed. Retry later or contact an organiser.',requestId:id});
 return res.status(200).json(data);
 }catch{
 await sql`update ai_requests set status='uncertain',http_status=502,latency_ms=${Date.now()-start} where id=${id}::uuid`;
 return res.status(502).json({error:'Provider timed out or was unavailable. Quota remains reserved for this request to prevent overspending.',requestId:id});
 }
});
