import { createHash,createCipheriv,createDecipheriv,randomBytes,randomUUID } from 'node:crypto';
export const AI_DAILY_LIMIT=800000;
export const AI_MODELS={'gpt-5.6-luna':'max_completion_tokens','deepseek-v4-pro':'max_tokens','gpt-5-mini':'max_completion_tokens'};
const encryptionKey=()=>createHash('sha256').update('elevate-ai-v1:'+process.env.SESSION_SECRET).digest();
export const hashKey=key=>createHash('sha256').update(key).digest('hex');
export function encryptKey(value){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',encryptionKey(),iv);const data=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64');}
export function decryptKey(value){const b=Buffer.from(value,'base64'),c=createDecipheriv('aes-256-gcm',encryptionKey(),b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString('utf8');}
export function validateAiBody(body){
 const param=AI_MODELS[body?.model];if(!param)throw new Error('Choose gpt-5.6-luna, deepseek-v4-pro or gpt-5-mini.');
 if(body.stream)throw new Error('Streaming is not enabled. Use stream: false.');
 if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>100)throw new Error('Provide 1 to 100 text messages.');
 if(body.messages.some(m=>!['system','user','assistant','developer'].includes(m?.role)||typeof m.content!=='string'))throw new Error('Only text messages with system, developer, user or assistant roles are supported.');
 const output=body[param]??2000;if(!Number.isInteger(output)||output<1||output>4000)throw new Error(`${param} must be between 1 and 4000.`);
 const payload={messages:body.messages.map(m=>({role:m.role,content:m.content})),[param]:output};
 const bytes=Buffer.byteLength(JSON.stringify(payload));if(bytes>48000)throw new Error('Request text is too large (48 KB maximum).');
 // UTF-8 byte count plus per-message framing conservatively bounds text tokens.
 return {payload,reserved:bytes+body.messages.length*128+1024+output,model:body.model};
}
export async function reserveAiRequest(sql,access,model,reserved){
 const id=randomUUID();const r=await sql.transaction(tx=>[
 tx`lock table ai_requests in share row exclusive mode`,
 tx`insert into ai_requests(id,team_id,project_id,model,reserved_tokens,charged_tokens)
 select ${id}::uuid,a.team_id,a.project_id,${model},${reserved},${reserved} from ai_team_access a
 where a.team_id=${access.team_id} and a.enabled
 and coalesce((select sum(charged_tokens) from ai_requests where team_id=a.team_id and quota_day=(clock_timestamp() at time zone 'UTC')::date),0)+${reserved} <= a.daily_limit
 and coalesce((select sum(charged_tokens) from ai_requests where project_id=a.project_id and quota_day=(clock_timestamp() at time zone 'UTC')::date),0)+${reserved} <= 5000000
 and (select count(*) from ai_requests where team_id=a.team_id and created_at>clock_timestamp()-interval '1 minute') < 10
 and (select count(*) from ai_requests where project_id=a.project_id and created_at>clock_timestamp()-interval '1 minute') < 300
 and coalesce((select sum(greatest(reserved_tokens,coalesce(actual_tokens,0))) from ai_requests where project_id=a.project_id and created_at>clock_timestamp()-interval '1 minute'),0)+${reserved} <= 50000
 returning id`,
 ]);return r[1][0]?.id||null;
}
