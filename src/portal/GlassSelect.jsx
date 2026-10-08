import { useEffect, useId, useRef, useState } from 'react';
import { Glass, GlassSystemProvider } from 'open-glass-ui';

export default function GlassSelect({label,value,options,onChange}) {
  const [open,setOpen]=useState(false), id=useId(), root=useRef(null), trigger=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  function choose(option){onChange(option.value);setOpen(false);trigger.current?.focus();}
  return <div className="portal-glassSelect" ref={root} onKeyDown={e=>{
    if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus();}
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
      e.preventDefault();setOpen(true);
      requestAnimationFrame(()=>{const buttons=[...root.current.querySelectorAll('[role=option]')];const current=buttons.indexOf(document.activeElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:e.key==='ArrowDown'?(current+1)%buttons.length:(current<=0?buttons.length:current)-1]?.focus();});
    }
  }}>
    <span id={`${id}-label`}>{label}</span>
    <button ref={trigger} type="button" className="portal-glassSelect__trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} onClick={()=>setOpen(v=>!v)}>{options.find(option=>option.value===value)?.label || 'Choose'}<span aria-hidden="true">⌄</span></button>
    {open && <GlassSystemProvider design="liquid" renderer="auto" theme={{appearance:'dark'}} toasts={false}><Glass material="regular" className="portal-glassSelect__menu" look={{blur:.8,rim:1.4,lensing:1.3}}><div id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>{options.map(option=><button type="button" role="option" aria-selected={value===option.value} key={option.value} onClick={()=>choose(option)}>{option.label}{value===option.value && <span aria-hidden="true">✓</span>}</button>)}</div></Glass></GlassSystemProvider>}
  </div>;
}
