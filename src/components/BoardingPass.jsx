import { useEffect, useState } from "react";
import useInView, { prefersReducedMotion } from "../hooks/useInView";
import { cue } from "../audio/bus";
import RegisterButton from "./RegisterButton";
import { EVENT, EVENT_START, registrationOpen } from "../config";

const ROWS = [
  { k: "Flight", v: "EL · 100" },
  { k: "Date", v: "10 OCT" },
  { k: "Boarding", v: "09:00" },
  { k: "Gate", v: "DJSCE" },
];

// the three steps between this page and a seat in the finale
const STEPS = [
  { n: "01", title: "Check in", body: "Register your crew of two to four on Unstop." },
  { n: "02", title: "Clear security", body: "Submit in the online qualifier round." },
  { n: "03", title: "Board", body: "The top thirty teams are called to campus on 10 October." },
];

function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(target.getTime() - now, 0);
  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { done: left === 0, parts: [["Days", d], ["Hrs", h], ["Min", m], ["Sec", s]] };
}

/* After "30 of 30 seats remaining", the pass: it prints out of the slot when
   it scrolls into view and takes a stamp that says what it is — a seat held
   until the qualifier is cleared. Registration lives here, once. */
export default function BoardingPass() {
  const [ref, seen] = useInView(0.35);
  const [stamped, setStamped] = useState(false);
  const countdown = useCountdown(EVENT_START);

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
    <section id="register" data-label="Boarding pass" className="pass">
      <div className="container pass__grid">
        <div className="pass__intro" data-reveal>
          <span className="eyebrow">Claim a seat</span>
          <h2 className="pass__title">Thirty seats. One has your name on it.</h2>
          <p className="pass__copy">
            Every team starts with the same pass. Clear the qualifier and it gets
            you a desk on the {EVENT.dates} flight.
          </p>

          <ol className="pass__steps">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="pass__stepN">{s.n}</span>
                <div>
                  <strong>{s.title}</strong>
                  <span>{s.body}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="pass__cta">
            <RegisterButton className="pass__register">Register your team</RegisterButton>
            <span className="pass__note">
              {registrationOpen()
                ? "Opens Unstop in a new tab. Free to register."
                : "The Unstop link goes live shortly. Free to register."}
            </span>
          </div>
        </div>

        <div className="pass__side">
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

                  <div className="pass__passenger">
                    <span>Passenger</span>
                    <strong>Your team · 2–4 crew</strong>
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
                      <span className="pass__place">Award ceremony</span>
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
                    <span>Seat held</span>
                    <small>Pending qualifier</small>
                  </div>
                </div>

                <div className="pass__stub">
                  <span className="pass__stubLabel">Seat</span>
                  <strong className="pass__seat">?/30</strong>
                  <div className="pass__barcode" aria-hidden="true">
                    {Array.from({ length: 22 }).map((_, i) => (
                      <i key={i} style={{ width: `${(i % 4) + 1}px` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pass__countdown" aria-live="off">
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
      </div>
    </section>
  );
}
