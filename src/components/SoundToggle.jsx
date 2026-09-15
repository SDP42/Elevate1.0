import { useEffect, useRef, useState } from "react";
import { createEngine } from "../audio/engine";
import { setActiveEngine } from "../audio/bus";
import { range } from "../hooks/useScrollProgress";
import { TOUCHDOWN, landingT, sectionProgress } from "../landing";

/* Sound defaults on. Browsers still block audio before any user gesture, so
   the engine is built immediately and armed to start on the very first
   interaction anywhere on the page — a click, a key, a touch, or the first
   scroll — rather than making the visitor find and press a button. The
   button stays only as a mute control for people who don't want it. */
export default function SoundToggle() {
  const [wanted, setWanted] = useState(true);
  const [started, setStarted] = useState(false);
  const engineRef = useRef(null);
  const touchedRef = useRef(false);

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

  useEffect(() => {
    if (!on) return;
    const engine = engineRef.current;
    if (!engine) return;

    let frame = null;

    const update = () => {
      frame = null;
      const hero = sectionProgress(".hero");
      const land = sectionProgress(".prizes");

      let cabin = 0;
      let wind = 0;
      let eng = 0;
      let rev = 0;
      let pitch = 0;

      if (hero && hero.visible) {
        const a = range(hero.p, 0, 0.44);
        cabin = 1 - range(a, 0.5, 1);
        wind = range(a, 0.5, 1);
      } else if (hero && land && hero.p >= 1 && land.p === 0) {
        // past the cabin but not yet at the runway: open-sky sections
        wind = 0.8;
      }

      if (land && land.visible) {
        const t = landingT(land.p);
        wind = Math.max(wind * (1 - range(t, 0, 0.3)), 0);
        eng = range(t, 0, 0.14) * (1 - range(t, TOUCHDOWN, TOUCHDOWN + 0.08));
        pitch = range(t, 0, TOUCHDOWN);
        rev =
          range(t, TOUCHDOWN + 0.01, TOUCHDOWN + 0.06) *
          (1 - range(t, 0.86, 0.98));

        // fire once when the aircraft cross touchdown moving forward;
        // re-arm only after scrolling well back up the approach
        if (t >= TOUCHDOWN && !touchedRef.current) {
          touchedRef.current = true;
          engine.chirp();
        } else if (t < TOUCHDOWN - 0.12) {
          touchedRef.current = false;
        }
      }

      engine.mix({ cabin, wind, engine: eng, reverse: rev, pitch });
    };

    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [on]);

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
