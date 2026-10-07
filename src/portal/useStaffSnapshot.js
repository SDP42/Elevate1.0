import { useEffect, useState } from "react";
import { staffSnapshot } from "./api";

export function notifyStaffWrite() { window.dispatchEvent(new Event("elevate:staff-write")); }

// One shared snapshot drives search, totals and history in each staff screen.
// Active: 5s; unchanged idle: 30s; hidden: no requests; failures back off to 60s.
export default function useStaffSnapshot(endpoint, slotCode) {
  const [state,setState]=useState({data:null,error:""});
  useEffect(()=>{
    let live=true,busy=false,timer,revision=null,activeUntil=0,failures=0;
    const schedule=delay=>{clearTimeout(timer);if(live)timer=setTimeout(refresh,delay);};
    async function refresh(){
      if(!live||busy)return;
      if(document.hidden){schedule(30000);return;}
      busy=true;
      try{
        const response=await staffSnapshot(endpoint,slotCode,revision);
        if(!live)return;
        failures=0;
        if(response.unchanged)setState(previous=>previous.error?{...previous,error:""}:previous);
        if(!response.unchanged){
          if(revision!==null)activeUntil=Date.now()+45000;
          revision=response.revision;
          setState({data:{...response,requestSlot:slotCode},error:""});
        }
      }catch{if(live){failures++;setState(previous=>({...previous,error:"Sync interrupted. Retrying automatically…"}));}}
      finally{
        busy=false;
        schedule(failures?Math.min(60000,5000*2**failures):Date.now()<activeUntil?5000:30000);
      }
    }
    const changed=()=>{activeUntil=Date.now()+45000;schedule(500);};
    const visible=()=>{if(!document.hidden)schedule(500);else clearTimeout(timer);};
    refresh();
    window.addEventListener("elevate:staff-write",changed);
    document.addEventListener("visibilitychange",visible);
    return()=>{live=false;clearTimeout(timer);window.removeEventListener("elevate:staff-write",changed);document.removeEventListener("visibilitychange",visible);};
  },[endpoint,slotCode]);
  return state;
}
