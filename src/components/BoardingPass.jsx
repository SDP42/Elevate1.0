import { useEffect, useState } from "react";
import useInView, { prefersReducedMotion } from "../hooks/useInView";
import { cue } from "../audio/bus";
import { EVENT, EVENT_START, ORGANISER } from "../config";
import { NSDC_QR } from "./nsdcQr";
import { paintSky } from "../intro/skyPainter";

/* The literal cloud from the cabin window, painted again at this section's
   own size — same seed as the intro's hero plate, so it is not a similar
   sky, it is the same one, continued. */
function useHeroCloud() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    let made = "";
    const ratio = window.innerHeight / Math.max(window.innerWidth, 1);
    const width = Math.min(1600, Math.round(window.innerWidth * Math.min(window.devicePixelRatio || 1, 1.5)));
    paintSky({ hero: { mode: "hero", width, height: Math.round(width * ratio * 2), seed: 3 } })
      .then((out) => {
        made = out.hero || "";
        if (cancelled) {
          if (made) URL.revokeObjectURL(made);
        } else {
          setUrl(made);
        }
      })
      .catch(() => {
        /* no WebGL: the section's own gradient underneath still reads as sky */
      });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, []);
  return url;
}

/* Gates open at check-in, 09:00 on 10 October — a day early against the
   11:00 flight-takeoff time quoted on the ticket itself. Lives in this one
   section as a proper D/H/M/S timer, not a chip following the page around. */
function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(target.getTime() - now, 0);
  return {
    done: left === 0,
    parts: [
      ["Days", Math.floor(left / 86400000)],
      ["Hrs", Math.floor((left % 86400000) / 3600000)],
      ["Min", Math.floor((left % 3600000) / 60000)],
      ["Sec", Math.floor((left % 60000) / 1000)],
    ],
  };
}

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
  const countdown = useCountdown(EVENT_START);
  const cloudUrl = useHeroCloud();

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
      {cloudUrl && <img className="pass__cloud" src={cloudUrl} alt="" aria-hidden="true" />}
      {/* the section it lands on (dark) and the one it hands off to (also dark)
          both meet the cloud photo's own colour, not a hard-edged cut */}
      <div className="pass__fadeTop" aria-hidden="true" />
      <div className="pass__fadeBottom" aria-hidden="true" />

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
                  {/* the same dart-plane mark used on the flight-progress bar up top,
                      nose fixed to the right so the route always reads left to right */}
                  <svg viewBox="0 0 24 24">
                    <path d="M22 12 L3 5 L6 12 L3 19 Z" fill="currentColor" />
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

        <div className="pass__countdown">
          <span className="pass__countLabel">
            {countdown.done ? "Gates are open" : "Gates open in"}
          </span>
          <div className="pass__countParts">
            {countdown.parts.map(([label, value]) => (
              <div key={label}>
                <strong>{String(value).padStart(2, "0")}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
