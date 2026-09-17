import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useInView";
import { cue } from "../audio/bus";

/* Page-level chrome: a flight-path progress bar, a "now arriving" section
   indicator, the plane cursor, and the scroll-reveal system. */

/* The small jet that flies through the wordmark itself — the same mark
   used everywhere else on the site (flight bar, boarding-pass route),
   dropped in place of a letter's crossbar so "ELEVATE" always reads as
   mid-flight, not just labelled with one. */
export function WordmarkPlane({ className = "" }) {
  return (
    <svg className={`jx-wm-plane ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 12 L3 5 L6 12 L3 19 Z" fill="currentColor" />
    </svg>
  );
}

/* Flight path across the top of the page: a dashed route with a small plane
   travelling from departure to arrival as the page scrolls. */
export function ScrollFlight() {
  const [p, setP] = useState(0);
  const [back, setBack] = useState(false);

  useEffect(() => {
    let frame = null;
    let lastY = window.scrollY;
    const measure = () => {
      frame = null;
      const y = window.scrollY;
      // ignore sub-pixel jitter so the plane doesn't flicker round
      if (Math.abs(y - lastY) > 2) setBack(y < lastY);
      lastY = y;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(Math.max(y / max, 0), 1) : 0);
    };
    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className={`flightbar ${back ? "flightbar--back" : ""}`} aria-hidden="true">
      <span className="flightbar__code">DEP</span>
      <div className="flightbar__track">
        <div className="flightbar__done" style={{ width: `${p * 100}%` }} />
        <svg
          viewBox="0 0 24 24"
          className="flightbar__plane"
          style={{ left: `${p * 100}%` }}
        >
          <path d="M22 12 L3 5 L6 12 L3 19 Z" fill="currentColor" />
        </svg>
      </div>
      <span className="flightbar__code">ARR</span>
    </div>
  );
}

/* Tracks which labelled section fills the middle of the viewport. */
export function NowArriving() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const sections = [...document.querySelectorAll("[data-label]")];
    if (!sections.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setLabel(e.target.dataset.label);
        });
      },
      // a thin band across the middle of the screen decides the winner
      { rootMargin: "-45% 0px -45% 0px" }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  if (!label) return null;

  return (
    <div className="arriving" aria-live="polite">
      <span className="arriving__dot" />
      <span className="arriving__k">Now arriving</span>
      <span key={label} className="arriving__v">
        {label}
      </span>
    </div>
  );
}

/* Small plane cursor that banks toward the direction of travel. Desktop
   pointers only — it would be meaningless on touch. */
export function PlaneCursor() {
  const elRef = useRef(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine || prefersReducedMotion()) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add("has-plane-cursor");

    let x = -100;
    let y = -100;
    let tx = x;
    let ty = y;
    let angle = 0;
    let frame = null;

    const onMove = (e) => {
      tx = e.clientX;
      ty = e.clientY;
    };

    const onOver = (e) => {
      const interactive = e.target.closest("a, button, input, label, [role='button']");
      elRef.current?.classList.toggle("plane-cursor--hot", Boolean(interactive));
    };

    const loop = () => {
      const dx = tx - x;
      const dy = ty - y;
      x += dx * 0.28;
      y += dy * 0.28;
      if (Math.hypot(dx, dy) > 1.5) {
        const target = (Math.atan2(dy, dx) * 180) / Math.PI;
        // shortest-way rotation so the plane never spins the long way round
        let delta = ((target - angle + 540) % 360) - 180;
        angle += delta * 0.18;
      }
      if (elRef.current) {
        elRef.current.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;
      }
      frame = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    frame = requestAnimationFrame(loop);
    return () => {
      document.documentElement.classList.remove("has-plane-cursor");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div ref={elRef} className="plane-cursor" aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <path
          d="M30 16 L4 6 L9 16 L4 26 Z"
          fill="#f0d79a"
          stroke="#14120f"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* One observer for the whole page. Anything marked data-reveal gets .is-in
   while it is on screen and loses it once fully off screen, so it animates
   in again on the way back. data-from records which edge it left by — above
   the viewport or below — and CSS uses that to bring it back in from the
   same side, so scrolling up mirrors scrolling down. */
export function useRevealAll() {
  useEffect(() => {
    const els = [...document.querySelectorAll("[data-reveal]")];
    if (prefersReducedMotion()) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const el = e.target;
          const enough =
            e.intersectionRatio >= 0.18 ||
            e.intersectionRect.height > window.innerHeight * 0.25;

          if (e.isIntersecting && enough) {
            const entering = !el.classList.contains("is-in");
            el.classList.add("is-in");
            // The FAQ opens behind its small jet. Fire its compact pass-by
            // sound only as that right-to-left reveal starts.
            if (entering && el.classList.contains("faq__reveal")) cue("swoosh");
          } else if (!e.isIntersecting) {
            el.dataset.from = e.boundingClientRect.top < 0 ? "top" : "bottom";
            el.classList.remove("is-in");
          }
        });
      },
      { threshold: [0, 0.05, 0.18, 0.4] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* Hidden fly-over: triggered by tapping the wordmark five times. A gold jet
   crosses the screen diagonally, with the chime and a pass-by whoosh when
   sound is on. */
export function FlyOver() {
  const [run, setRun] = useState(0);

  useEffect(() => {
    const onFly = () => {
      setRun((n) => n + 1);
      cue("chime");
      cue("flyover");
    };
    window.addEventListener("elevate:flyover", onFly);
    return () => window.removeEventListener("elevate:flyover", onFly);
  }, []);

  if (!run) return null;

  return (
    <div key={run} className="flyover" aria-hidden="true">
      <div className="flyover__jet">
        <svg viewBox="0 0 400 1000">
          <path
            d="M200 38 C215 72, 223 126, 225 192 L225 360 L366 640 L346 666 L225 566 L225 760 L304 866 L296 886 L214 846 L210 900 L190 900 L186 846 L104 886 L96 866 L175 760 L175 566 L54 666 L34 640 L175 360 L175 192 C177 126, 185 72, 200 38 Z"
            fill="#e9c46a"
            stroke="#5d4715"
            strokeWidth="6"
            strokeLinejoin="round"
          />
        </svg>
        <span className="flyover__trail" />
      </div>
    </div>
  );
}

/* Quiet tick on hover over links and buttons, throttled so sweeping the
   cursor across the nav does not machine-gun. Silent when sound is off. */
export function useHoverTicks() {
  useEffect(() => {
    let last = 0;
    let lastTarget = null;
    const onOver = (e) => {
      const el = e.target.closest("a, button");
      if (!el || el === lastTarget) return;
      lastTarget = el;
      const now = performance.now();
      if (now - last < 70) return;
      last = now;
      cue("tick");
    };
    const onOut = (e) => {
      if (e.target.closest("a, button") === lastTarget) lastTarget = null;
    };
    window.addEventListener("mouseover", onOver, { passive: true });
    window.addEventListener("mouseout", onOut, { passive: true });
    return () => {
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mouseout", onOut);
    };
  }, []);
}
