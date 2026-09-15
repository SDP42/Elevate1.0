import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../hooks/useInView";

const KEY = "elevate-boarded";

/* Boarding sequence shown once per browser session. It lifts on a timer
   rather than waiting on assets — nothing here is heavy enough to justify
   holding visitors behind a real loader. */
export default function Preloader() {
  const [phase, setPhase] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) ? "done" : "boarding";
    } catch {
      return "boarding";
    }
  });

  useEffect(() => {
    if (phase !== "boarding") return;
    const short = prefersReducedMotion();
    const lift = setTimeout(() => setPhase("lifting"), short ? 300 : 1900);
    const done = setTimeout(() => {
      setPhase("done");
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* private mode: the loader simply shows again next visit */
      }
    }, short ? 500 : 2700);
    return () => {
      clearTimeout(lift);
      clearTimeout(done);
    };
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div className={`boarding ${phase === "lifting" ? "boarding--lift" : ""}`} aria-hidden="true">
      <div className="boarding__inner">
        <span className="boarding__k">Now boarding</span>
        <div className="boarding__name">
          Elevate <em>1.0</em>
        </div>
        <div className="boarding__route">
          <span>IDEA</span>
          <i className="boarding__track">
            <b />
          </i>
          <span>DEMO</span>
        </div>
        <span className="boarding__gate">Gate D1 · 10 & 11 October</span>
      </div>
    </div>
  );
}
