import {useEffect,useState} from 'react';
import {Button} from 'open-glass-ui';
import TeamLiquidGlass from './TeamLiquidGlass';
export default function DesktopAnnouncements({initialMessages=[],teamCode}){
 const [messages,setMessages]=useState(initialMessages),[permission,setPermission]=useState(()=>typeof Notification==='undefined'?'unsupported':Notification.permission),[error,setError]=useState('');
 useEffect(()=>{
 let live=true,busy=false,initial=true;
 const storageKey='elevate-announcement-seen-'+teamCode;
 let seen=new Set();try{seen=new Set(JSON.parse(localStorage.getItem(storageKey)||'[]'));}catch{}
 const load=async()=>{if(busy)return;busy=true;try{
 const r=await fetch('/api/notifications',{credentials:'include'});if(!r.ok)return;const d=await r.json();if(!live)return;
 setMessages(d.announcements||[]);
 for(const item of d.announcements||[]){const fingerprint=JSON.stringify([item.id,item.message]);
 // First load establishes a baseline; no historical announcement spam.
 if(!initial&&!seen.has(fingerprint)&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
 try{const n=new Notification('Elevate 1.0 · '+teamCode,{body:item.message,tag:'elevate-announcement-'+item.id,icon:'/elevate-icon.svg'});n.onclick=()=>{window.focus();n.close();};}catch{setError('Desktop notifications are unavailable in this browser. Announcements remain visible here.');}
 }
 seen.add(fingerprint);}
 initial=false;try{localStorage.setItem(storageKey,JSON.stringify([...seen].slice(-200)));}catch{}
 }catch{}finally{busy=false;}};
 load();const timer=setInterval(load,15000);return()=>{live=false;clearInterval(timer);};
 },[teamCode]);
 async function enable(){try{setPermission(await Notification.requestPermission());}catch{setError('Unable to enable notifications. Check browser permissions.');}}
 return <TeamLiquidGlass as="section" material="regular" className="portal-announce">
 <div className="participant-notification-controls"><span>{permission==='granted'?'Desktop notifications enabled':permission==='denied'?'Notifications blocked: allow them in browser site settings.':permission==='unsupported'?'Desktop notifications are unavailable in this browser.':'Get organiser announcements on your laptop.'}</span>{permission==='default'&&<Button type="button" variant="secondary" onClick={enable}>Enable desktop notifications</Button>}</div>
 {error&&<p role="status">{error}</p>}
 {messages.map((m,i)=><p key={m.id??i} className={m.pinned?'is-pinned':undefined}>{m.pinned?'🚨':'📣'} {m.message}</p>)}
 </TeamLiquidGlass>;
}
