import {requireRole} from './_lib/auth.js';import {sql} from './_lib/db.js';
export default requireRole(async(req,res)=>{
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const rows=await sql`select id,message,pinned from announcements where active=true and (team_id is null or team_id=${req.session.teamId}) order by pinned desc,sort_order,id`;
 return res.status(200).json({announcements:rows});
},['team']);
