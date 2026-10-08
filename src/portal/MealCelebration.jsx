import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { JetPhoto } from "../intro/JetArt";
import WelcomePopup from "./WelcomePopup";
import { mealReceipts } from "./api";

const FOOD = ["🍜", "🥗", "🥐", "🍱", "🍎", "🥪", "☕", "🍽️"];

export function MealCelebration({ meal, onDone }) {
  const dialog = useRef(null);
  const done = useRef(onDone);
  const [seconds, setSeconds] = useState(10);
  useEffect(() => { done.current = onDone; }, [onDone]);
  useEffect(() => {
    const node = dialog.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    const until = Date.now() + 10000;
    const clock = setInterval(() => setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000))), 250);
    const timeout = setTimeout(() => done.current(), 10000);
    return () => {
      clearInterval(clock); clearTimeout(timeout);
      node.close(); document.body.style.overflow = oldOverflow;
    };
  }, []);
  return createPortal(
    <dialog ref={dialog} className="meal-celebration" aria-labelledby="meal-celebration-title"
      onCancel={(event) => { event.preventDefault(); done.current(); }}>
      <div className="meal-celebration__food" aria-hidden="true">
        {FOOD.map((emoji, i) => <span key={emoji} style={{ "--i": i }}>{emoji}</span>)}
      </div>
      <div className="meal-celebration__flight" aria-hidden="true"><div className="meal-celebration__jet"><JetPhoto /></div></div>
      {["left", "right"].map(side => <div key={side} className={`meal-celebration__confetti meal-celebration__confetti--${side}`} aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => <i key={i} style={{ "--i": i }} />)}
      </div>)}
      <div className="meal-celebration__message">
        <span className="meal-celebration__eyebrow">Elevate 1.0 · Meal confirmed</span>
        <h2 id="meal-celebration-title">Enjoy your meal!</h2>
        <p>{meal.slotLabel}</p>
        <p className="meal-celebration__names">{meal.names.join(" · ")}</p>
        <span className="meal-celebration__countdown" aria-hidden="true">Returning in {seconds}s</span>
      </div>
    </dialog>, document.body
  );
}

// Establish a baseline on mount so previous meals do not replay. Subsequent
// receipts come only from this team's authenticated database records.
export default function ParticipantMealNotice() {
  const [queue, setQueue] = useState([]);
  const [welcome,setWelcome]=useState([]);
  const [registration,setRegistration]=useState(null);
  useEffect(() => {
    let live = true, cursor = null, busy = false, timer, activeUntil=0, registrationPending=true;
    const seenRegistration=new Set();
    async function refresh() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const response = await mealReceipts(cursor);
        if (!live) return;
        cursor = Math.max(cursor || 0, response.latestId);
        const registration=response.registration;
        if(registration){
          setRegistration(registration);
          const newlyRegistered=registration.members.filter(member=>{
            const key=`elevate_welcome_${registration.teamId}_${member.id}`;
            try {if(sessionStorage.getItem(key))return false;sessionStorage.setItem(key,'1');}catch{/* denied browser storage still uses in-memory dedupe below */}
            if(seenRegistration.has(member.id))return false;seenRegistration.add(member.id);return true;
          });
          if(newlyRegistered.length)setWelcome(previous=>[...previous,...newlyRegistered]);
          registrationPending=registration.members.length<registration.total;
        }
        const groups = new Map();
        for (const entry of response.meals) {
          // One confirmation may insert several members. Group the new rows
          // for the same slot into a single celebration.
          if (!groups.has(entry.slotCode)) groups.set(entry.slotCode, { key: entry.id, slotLabel: entry.slotLabel, names: [] });
          groups.get(entry.slotCode).names.push(entry.name);
        }
        if (groups.size) { activeUntil=Date.now()+30000; setQueue(previous => [...previous, ...groups.values()]); }
      } catch { /* transient polling failures retry on the next refresh */ }
      finally { busy = false; if(live)timer=setTimeout(refresh,registrationPending || Date.now()<activeUntil?3000:10000); }
    }
    const visible=()=>{if(!document.hidden){clearTimeout(timer);refresh();}};
    refresh();
    document.addEventListener("visibilitychange", visible);
    return () => { live = false; clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, []);
  return <>{registration?.members.length>0 && <p role="status" className="portal-status">Registration: {registration.members.length} of {registration.total} participants checked in.</p>}
    {welcome.length ? <WelcomePopup key={welcome[0].id} member={welcome[0]} onClose={()=>setWelcome(previous=>previous.slice(1))} /> : queue.length ? <MealCelebration key={queue[0].key} meal={queue[0]} onDone={() => setQueue(previous => previous.slice(1))} /> : null}</>;
}
