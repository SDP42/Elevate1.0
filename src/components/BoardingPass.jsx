import { useEffect, useState } from "react";
import useInView, { prefersReducedMotion } from "../hooks/useInView";
import { cue } from "../audio/bus";

const ROWS = [
  { k: "Flight", v: "EL · 100" },
  { k: "Date", v: "10 OCT" },
  { k: "Boarding", v: "09:00" },
  { k: "Gate", v: "D1" },
];

/* The pass prints out of a slot when it scrolls into view, then takes a
   BOARDED stamp. The stub tears along its perforation on hover. */
export default function BoardingPass() {
  const [ref, seen] = useInView(0.35);
  const [stamped, setStamped] = useState(false);

  useEffect(() => {
    // off screen: re-arm, so the pass prints again on the way back
    if (!seen) {
      setStamped(false);
      return;
    }
    cue("flap", 10);
    const id = setTimeout(
      () => {
        setStamped(true);
        cue("stamp");
      },
      prefersReducedMotion() ? 0 : 1700
    );
    return () => clearTimeout(id);
  }, [seen]);

  return (
    <section id="pass" data-label="Boarding pass" className="pass">
      <div className="container pass__grid">
        <div className="pass__intro" data-reveal>
          <span className="eyebrow">Your seat</span>
          <h2 className="pass__title">One ticket. Twenty-four hours.</h2>
          <p className="pass__copy">
            Registration gets your team a desk, a power strip and a place on
            the manifest. Everything else you bring yourself.
          </p>
        </div>

        <div ref={ref} className={`pass__printer ${seen ? "is-printing" : ""}`}>
          <div className="pass__slot" aria-hidden="true">
            <span className="pass__slotLight" />
          </div>

          <div className="pass__paper">
            <div className="pass__card">
              <div className="pass__main">
                <div className="pass__brand">
                  <span>Elevate Airways</span>
                  <strong>BOARDING PASS</strong>
                </div>

                <div className="pass__route">
                  <div>
                    <span className="pass__code">IDEA</span>
                    <span className="pass__place">First commit</span>
                  </div>
                  <svg viewBox="0 0 60 24" className="pass__plane" aria-hidden="true">
                    <path
                      d="M4 12 H40 L34 4 H39 L50 12 L39 20 H34 L40 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="pass__to">
                    <span className="pass__code">DEMO</span>
                    <span className="pass__place">Final pitch</span>
                  </div>
                </div>

                <dl className="pass__rows">
                  {ROWS.map((r) => (
                    <div key={r.k}>
                      <dt>{r.k}</dt>
                      <dd>{r.v}</dd>
                    </div>
                  ))}
                </dl>

                <div
                  className={`pass__stamp ${stamped ? "is-stamped" : ""}`}
                  aria-hidden="true"
                >
                  <span>Boarded</span>
                  <small>EL · 100</small>
                </div>
              </div>

              <div className="pass__stub">
                <span className="pass__stubLabel">Seat</span>
                <strong className="pass__seat">24H</strong>
                <div className="pass__barcode" aria-hidden="true">
                  {Array.from({ length: 22 }).map((_, i) => (
                    <i key={i} style={{ width: `${(i % 4) + 1}px` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
