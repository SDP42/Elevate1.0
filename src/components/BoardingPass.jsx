import { useEffect, useState } from "react";
import useInView, { prefersReducedMotion } from "../hooks/useInView";
import { cue } from "../audio/bus";
import { EVENT, ORGANISER } from "../config";
import { NSDC_QR } from "./nsdcQr";

const ROWS = [
  { k: "Passenger", v: "Your team" },
  { k: "Seat", v: "?/30" },
  { k: "Terminal", v: "DJSCE" },
  { k: "Gate", v: EVENT.city },
  { k: "Boarding", v: "10 Oct" },
];

/* The boarding pass on its own: a white ticket with the DJS NSDC QR on the
   left, the route across the middle and a dark stub on the right that tears
   away along its perforation once the pass is on screen. */
export default function BoardingPass() {
  const [ref, seen] = useInView(0.45);
  const [torn, setTorn] = useState(false);

  useEffect(() => {
    // off screen: re-attach the stub so it tears again on the way back
    if (!seen) {
      setTorn(false);
      return;
    }
    const id = setTimeout(
      () => {
        setTorn(true);
        cue("stamp");
      },
      prefersReducedMotion() ? 0 : 900
    );
    return () => clearTimeout(id);
  }, [seen]);

  return (
    <section id="register" data-label="Boarding pass" className="pass bp-section">
      <div className="pass__sky" aria-hidden="true">
        <span className="lab__cloud lab__cloud--a" />
        <span className="lab__cloud lab__cloud--b" />
      </div>

      <div className="container bp-wrap">
        <div ref={ref} className={`bp ${seen ? "is-in" : ""} ${torn ? "is-torn" : ""}`}>
          <div className="bp__ticket">
            <a
              className="bp__qr"
              href={ORGANISER.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${ORGANISER.handle} on Instagram`}
            >
              <svg viewBox={NSDC_QR.viewBox} shapeRendering="crispEdges" aria-hidden="true">
                <path d={NSDC_QR.d} fill="none" stroke="#0b1b3a" strokeWidth="1" />
              </svg>
              <span className="bp__qrLabel">Scan · {ORGANISER.handle}</span>
            </a>

            <div className="bp__perf" aria-hidden="true" />

            <div className="bp__main">
              <div className="bp__route">
                <div className="bp__place">
                  <span className="bp__city">
                    Your idea,
                    <br />
                    anywhere
                  </span>
                  <strong className="bp__code">IDEA</strong>
                  <span className="bp__when">
                    Sat, 10 October
                    <br />
                    Hackathon starts
                  </span>
                </div>

                <div className="bp__path" aria-hidden="true">
                  <span />
                  <svg viewBox="0 0 24 24">
                    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill="currentColor" transform="rotate(90 12 12)" />
                  </svg>
                  <span />
                </div>

                <div className="bp__place bp__place--to">
                  <span className="bp__city">
                    DJSCE,
                    <br />
                    {EVENT.city}
                  </span>
                  <strong className="bp__code">DEMO</strong>
                  <span className="bp__when">
                    Sun, 11 October
                    <br />
                    Hackathon ends
                  </span>
                </div>
              </div>

              <dl className="bp__rows">
                {ROWS.map((r) => (
                  <div key={r.k}>
                    <dt>{r.k}</dt>
                    <dd>{r.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="bp__stub">
            <span className="bp__stubTitle">Boarding Pass</span>
            <span className="bp__stubBrand">
              ELEVATE <em>1.0</em>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
