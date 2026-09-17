import { useEffect, useRef, useState } from "react";
import { createEngine } from "../audio/engine";
import { setActiveEngine } from "../audio/bus";

/* Sound defaults on. Browsers still block audio before any user gesture, so
   the engine is built immediately and armed to start on the very first
   interaction anywhere on the page — a click, a key, a touch, or the first
   scroll — rather than making the visitor find and press a button. The
   button stays only as a mute control for people who don't want it. */
export default function SoundToggle() {
  const [wanted, setWanted] = useState(true);
  const [started, setStarted] = useState(false);
  const engineRef = useRef(null);

  if (!engineRef.current) engineRef.current = createEngine();

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || started) return;

    const start = async () => {
      if (!wanted) return;
      await engine.enable();
      setActiveEngine(engine);
      setStarted(true);
    };

    const opts = { passive: true, once: true };
    const events = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, start, opts));
    return () => events.forEach((ev) => window.removeEventListener(ev, start, opts));
  }, [wanted, started]);

  const on = wanted && started;

  const toggle = async () => {
    const engine = engineRef.current;
    if (!engine) return;

    if (on) {
      engine.disable();
      setActiveEngine(null);
      setWanted(false);
      return;
    }

    setWanted(true);
    if (!started) {
      await engine.enable();
      setActiveEngine(engine);
      setStarted(true);
    } else {
      await engine.enable();
      setActiveEngine(engine);
    }
  };

  return (
    <button
      className={`sound ${on ? "sound--on" : ""}`}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Turn cabin sound off" : "Turn cabin sound on"}
    >
      <svg viewBox="0 0 24 24" className="sound__icon" aria-hidden="true">
        <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="currentColor" />
        {on ? (
          <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M16 9 A4 4 0 0 1 16 15" />
            <path d="M18.5 6.5 A7.5 7.5 0 0 1 18.5 17.5" />
          </g>
        ) : (
          <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M16 10 L21 15" />
            <path d="M21 10 L16 15" />
          </g>
        )}
      </svg>
      <span className="sound__bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="sound__label">{on ? "Sound on" : "Sound off"}</span>
    </button>
  );
}
