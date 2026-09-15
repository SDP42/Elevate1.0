import useInView from "../hooks/useInView";

/* Cockpit gauge cluster. Real instrument anatomy — bezel with screws, matte
   face, graduated ticks, a needle on a hub, and a curved glass highlight —
   carrying event numbers instead of flight data. Needles sweep up from zero
   when the panel comes into view. */

function Bezel() {
  return (
    <>
      <circle cx="100" cy="100" r="98" fill="#0e0f11" />
      <circle cx="100" cy="100" r="92" fill="url(#bezelG)" />
      <circle cx="100" cy="100" r="80" fill="#121417" />
      <circle cx="100" cy="100" r="80" fill="url(#faceG)" />
      {[45, 135, 225, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <circle
            key={a}
            cx={100 + Math.cos(r) * 86}
            cy={100 + Math.sin(r) * 86}
            r="3.4"
            fill="#2b2f34"
            stroke="#4a5058"
            strokeWidth="0.8"
          />
        );
      })}
    </>
  );
}

function Ticks({ count = 36, from = -220, to = 40 }) {
  const items = [];
  for (let i = 0; i <= count; i++) {
    const a = ((from + ((to - from) * i) / count) * Math.PI) / 180;
    const major = i % 3 === 0;
    const r1 = major ? 60 : 66;
    items.push(
      <line
        key={i}
        x1={100 + Math.cos(a) * r1}
        y1={100 + Math.sin(a) * r1}
        x2={100 + Math.cos(a) * 74}
        y2={100 + Math.sin(a) * 74}
        stroke="#cfd6dd"
        strokeOpacity={major ? 0.9 : 0.45}
        strokeWidth={major ? 2.4 : 1.2}
        strokeLinecap="round"
      />
    );
  }
  return <g>{items}</g>;
}

function Glass() {
  return (
    <>
      <path
        d="M34 66 A80 80 0 0 1 152 44 A80 80 0 0 0 34 66 Z"
        fill="#ffffff"
        opacity="0.07"
      />
      <circle cx="100" cy="100" r="80" fill="url(#glassG)" />
    </>
  );
}

function Gauge({ label, value, unit, fraction, seen, accent = "#f0d79a" }) {
  const from = -220;
  const to = 40;
  const angle = from + (to - from) * (seen ? fraction : 0);

  return (
    <div className="gauge">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="bezelG" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#5a616a" />
            <stop offset="38%" stopColor="#2b3037" />
            <stop offset="100%" stopColor="#15181c" />
          </linearGradient>
          <radialGradient id="faceG" cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#22262b" />
            <stop offset="100%" stopColor="#0c0e10" />
          </radialGradient>
          <linearGradient id="glassG" x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="42%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <Bezel />
        <Ticks />

        {/* arc showing the travelled range */}
        <path
          d={describeArc(100, 100, 52, from, angle)}
          fill="none"
          stroke={accent}
          strokeOpacity="0.55"
          strokeWidth="3"
          strokeLinecap="round"
          className="gauge__arc"
        />

        <text
          x="100"
          y="132"
          textAnchor="middle"
          fill="#eef3f8"
          fontSize="26"
          fontWeight="600"
          fontFamily="Helvetica, Arial, sans-serif"
        >
          {value}
        </text>
        <text
          x="100"
          y="150"
          textAnchor="middle"
          fill="#8d959e"
          fontSize="11"
          letterSpacing="2"
          fontFamily="Helvetica, Arial, sans-serif"
        >
          {unit}
        </text>

        {/* needle */}
        <g
          className="gauge__needle"
          style={{ transform: `rotate(${angle + 90}deg)` }}
        >
          <path d="M100 100 L96 96 L100 34 L104 96 Z" fill={accent} />
          <path d="M100 100 L100 34" stroke="#fff6df" strokeOpacity="0.5" strokeWidth="1" />
        </g>
        <circle cx="100" cy="100" r="9" fill="#2b3037" stroke="#5a616a" strokeWidth="1.4" />
        <circle cx="100" cy="100" r="3.2" fill={accent} />

        <Glass />
      </svg>
      <span className="gauge__label">{label}</span>
    </div>
  );
}

function polar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(cx, cy, r, start, end) {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = Math.abs(end - start) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

const GAUGES = [
  { label: "Duration", value: "24", unit: "HOURS", fraction: 1 },
  { label: "Prize pool", value: "1.0", unit: "LAKH ₹", fraction: 0.82 },
  { label: "Finalists", value: "30", unit: "TEAMS", fraction: 0.6 },
  { label: "Team size", value: "2–4", unit: "MEMBERS", fraction: 0.35 },
];

const ANNUNCIATORS = ["BATT", "HYD", "FUEL", "NAV", "ENG", "SYSTEMS GO"];

export default function InstrumentPanel() {
  const [ref, seen] = useInView(0.35);

  return (
    <section id="panel" data-label="Flight deck" className="panel" ref={ref}>
      <div className="container">
        <div className="panel__head" data-reveal>
          <span className="eyebrow">Flight deck</span>
          <h2 className="section-title">Elevate 1.0, by the numbers.</h2>
        </div>

        <div className="panel__cluster">
          {GAUGES.map((g) => (
            <Gauge key={g.label} {...g} seen={seen} />
          ))}
        </div>

        {/* warning panel: lamps flicker through a self-test, then settle */}
        <div className={`panel__annun ${seen ? "is-on" : ""}`} aria-hidden="true">
          {ANNUNCIATORS.map((a, i) => (
            <span
              key={a}
              className={`panel__lamp ${a === "SYSTEMS GO" ? "panel__lamp--go" : ""}`}
              style={{ animationDelay: `${0.15 + i * 0.12}s` }}
            >
              {a}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
