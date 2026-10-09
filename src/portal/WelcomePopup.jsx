import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Glass,GlassSystemProvider} from 'open-glass-ui';

export default function WelcomePopup({teamName,onClose}) {
  const dialog=useRef(null);
  useEffect(()=>{const node=dialog.current,opener=document.activeElement;node.showModal();return()=>{node.close();opener?.focus?.();};},[]);
  return createPortal(<dialog ref={dialog} className="welcome-dialog" aria-labelledby="welcome-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <GlassSystemProvider design="liquid" renderer="auto" theme={{appearance:'dark'}} toasts={false}><Glass material="regular" className="welcome-glass" look={{blur:.8,rim:1.4,lensing:1.4}}>
      <button type="button" className="welcome-close" aria-label="Close welcome" onClick={onClose}>×</button>
      <img src="/elevate-welcome-banner.webp" alt="Elevate 1.0 — A 24-hour hackathon, 10–11 October 2026, DJSCE Mumbai" />
      <div className="welcome-message"><h2 id="welcome-title">Welcome to Elevate 1.0!</h2><p>Welcome, {teamName}!</p></div>
    </Glass></GlassSystemProvider>
  </dialog>,document.body);
}
