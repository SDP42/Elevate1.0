import { useEffect, useState } from "react";
import useInView, { prefersReducedMotion } from "../hooks/useInView";
import { cue } from "../audio/bus";

const FLIGHTS = [
  { time: "09:00", to: "Check-in & Badges", gate: "D1", status: "open" },
  { time: "10:00", to: "Opening Ceremony", gate: "MAIN", status: "boarding" },
  { time: "11:00", to: "Hackathon Starts", gate: "D1", status: "departed" },
  { time: "18:00", to: "Mentoring Round 1", gate: "D1", status: "ontime" },
  { time: "00:00", to: "Jamming Session", gate: "D2", status: "ontime" },
  { time: "02:00", to: "Mentoring Round 2", gate: "D2", status: "ontime" },
  { time: "11:00", to: "Hackathon Ends", gate: "D2", status: "final" },
  { time: "14:00", to: "Final Judging", gate: "MAIN", status: "ontime" },
];

const LABEL = {
  open: "OPEN",
  boarding: "BOARDING",
  departed: "DEPARTED",
  ontime: "ON TIME",
  final: "FINAL CALL",
};

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&:.";
const TICK_MS = 48;

/* One flap character. Before its settle tick it shows a glyph derived from
   the tick and its position rather than Math.random, so a re-render never
   makes a settled-looking cell jump. */
function Flap({ ch, settleAt, tick }) {
  const settled = tick >= settleAt;
  const shown =
    settled || ch === " "
      ? ch
      : CHARSET[Math.floor(tick * 7 + settleAt * 13) % CHARSET.length];
  return (
    <span className={`flap ${settled ? "" : "flap--moving"}`}>
      {shown === " " ? " " : shown}
    </span>
  );
}

function FlapText({ text, row, col, tick }) {
  return (
    <span className="flapText" aria-label={text}>
      {[...text.toUpperCase()].map((ch, i) => (
        <Flap key={i} ch={ch} tick={tick} settleAt={row * 3 + col + i * 0.9 + 4} />
      ))}
    </span>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <span className="dep__clock">
      {pad(now.getHours())}
      <b>:</b>
      {pad(now.getMinutes())}
      <b>:</b>
      {pad(now.getSeconds())}
    </span>
  );
}

/* Split-flap departures. The whole board shares one tick counter, so every
   cell advances in lock-step. Rows settle from the edge the visitor scrolled
   in from: top-down on the way down, bottom-up on the way back up. */
export default function DepartureBoard() {
  const [ref, seen, from] = useInView(0.3);
  const [tick, setTick] = useState(0);
  const LAST = FLIGHTS.length * 3 + 44;

  useEffect(() => {
    // off screen: scramble the board again for the next arrival
    if (!seen) {
      setTick(0);
      return;
    }
    if (prefersReducedMotion()) {
      setTick(LAST);
      return;
    }
    cue("flap", 14);
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      if (t % 9 === 0 && t < LAST) cue("flap", 6);
      setTick(t);
      if (t >= LAST) clearInterval(id);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [seen, LAST]);

  return (
    <section id="departures" data-label="Departures" className="dep">
      <div className="container">
        <div className="dep__head" data-reveal>
          <span className="eyebrow">Departures</span>
          <h2 className="dep__title">Where the 24 hours takes you.</h2>
        </div>

        <div ref={ref} className="dep__board">
          <div className="dep__top">
            <span className="dep__boardName">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 12 L3 5 L6 12 L3 19 Z" fill="currentColor" />
              </svg>
              Grand finale · Departures
            </span>
            <Clock />
          </div>

          <div className="dep__row dep__row--head">
            <span>Time</span>
            <span>Destination</span>
            <span>Gate</span>
            <span>Status</span>
          </div>

          {FLIGHTS.map((f, i) => {
            // arriving from above, the bottom row is nearest and settles first
            const r = from === "top" ? FLIGHTS.length - 1 - i : i;
            return (
            <div key={f.time + f.to} className="dep__row">
              <span className="dep__time">
                <FlapText text={f.time} row={r} col={0} tick={tick} />
              </span>
              <span className="dep__to">
                <FlapText text={f.to} row={r} col={4} tick={tick} />
              </span>
              <span className="dep__gate">
                <FlapText text={f.gate} row={r} col={22} tick={tick} />
              </span>
              <span className={`dep__status dep__status--${f.status}`}>
                <FlapText text={LABEL[f.status]} row={r} col={26} tick={tick} />
              </span>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
