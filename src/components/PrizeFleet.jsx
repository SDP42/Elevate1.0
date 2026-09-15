import Jet from "./Jet";
import Clouds from "./Clouds";
import useScrollProgress, { range, easeInOut } from "../hooks/useScrollProgress";
import { TOUCHDOWN, landingT } from "../landing";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/* Ground-plane coordinates, in px, before the plane is tilted away from the
   camera. y runs from the far horizon (0) to the near edge (GROUND_H), where
   the ground meets the bottom of the screen. */
const GROUND_W = 1800;
const GROUND_H = 4200;
const RUNWAY_W = 170;
const RUNWAY_TOP = 1560;
const RUNWAY_LEN = 2440; // threshold sits at the near end of each strip
const THRESHOLD_Y = RUNWAY_TOP + RUNWAY_LEN;

const PRIZES = [
  { key: "second", metal: "silver", rw: "24L", x: -520, size: 0.86, place: "2nd Place", value: 30000 },
  { key: "first", metal: "gold", rw: "24C", x: 0, size: 1, place: "1st Place", value: 50000 },
  { key: "third", metal: "bronze", rw: "24R", x: 520, size: 0.86, place: "3rd Place", value: 20000 },
];

const PLANE_W = 320;
const PLANE_H = PLANE_W * 2.5;

/* Where the aircraft is at landing progress t (0..1), in ground coordinates.
   The approach is a glide with a quadratic flare so vertical speed reaches
   zero at touchdown, then a decelerating rollout along the runway. */
function flightPath(t) {
  if (t <= TOUCHDOWN) {
    const u = t / TOUCHDOWN;
    return {
      y: lerp(GROUND_H + 700, THRESHOLD_Y - 300, u),
      alt: 520 * (1 - u) * (1 - u),
      flare: range(u, 0.7, 1) * (1 - range(u, 0.97, 1)),
      air: 1 - u,
    };
  }
  const u = (t - TOUCHDOWN) / (1 - TOUCHDOWN);
  const ease = 1 - (1 - u) * (1 - u);
  return {
    y: lerp(THRESHOLD_Y - 300, THRESHOLD_Y - 820, ease),
    alt: 0,
    flare: 0,
    air: 0,
  };
}

/* Real asphalt is never a flat colour — it is a patchwork of resurfaced
   slabs, oil staining and tyre rubber. A single fractalNoise pass at low
   contrast, multiplied over the base grey, is what turns a flat SVG rect
   into something that reads as a photographed surface instead of a toy. */
function Runway({ designator, lit = 0 }) {
  const lights = Array.from({ length: 22 });
  const u = `rw-${designator}`;
  return (
    <svg
      viewBox={`0 0 ${RUNWAY_W} ${RUNWAY_LEN}`}
      width={RUNWAY_W}
      height={RUNWAY_LEN}
      className="land__runway"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${u}-asph`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#101215" />
          <stop offset="12%" stopColor="#26292d" />
          <stop offset="50%" stopColor="#34383d" />
          <stop offset="88%" stopColor="#24272b" />
          <stop offset="100%" stopColor="#0d0e10" />
        </linearGradient>
        {/* length-wise fade: the far end recedes into haze, the near end
            (touchdown zone) is darkest — worn rubber, not clean paint */}
        <linearGradient id={`${u}-wear`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.35" />
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="82%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id={`${u}-lamp`}>
          <stop offset="0%" stopColor="#fff8e2" stopOpacity="1" />
          <stop offset="30%" stopColor="#ffd27a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
        <filter id={`${u}-grain`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.006" numOctaves="3" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.35 0.35 0.35 0 -0.15" />
        </filter>
      </defs>

      <rect width={RUNWAY_W} height={RUNWAY_LEN} fill={`url(#${u}-asph)`} />
      {/* weathering grain, multiplied so it darkens rather than washes out */}
      <rect width={RUNWAY_W} height={RUNWAY_LEN} filter={`url(#${u}-grain)`} style={{ mixBlendMode: "multiply" }} />
      {/* a handful of resurfacing patches — slightly different tone, hard edges */}
      <rect x="18" y={RUNWAY_LEN * 0.22} width={RUNWAY_W - 46} height="70" fill="#3a3f45" opacity="0.3" />
      <rect x="26" y={RUNWAY_LEN * 0.58} width={RUNWAY_W - 60} height="46" fill="#2a2d31" opacity="0.35" />

      {/* tyre rubber deposits in the touchdown zone — soft, irregular, not a block */}
      <ellipse cx="57" cy={RUNWAY_LEN - 640} rx="16" ry="220" fill="#08090a" opacity="0.4" />
      <ellipse cx="113" cy={RUNWAY_LEN - 640} rx="16" ry="220" fill="#08090a" opacity="0.4" />

      {/* edge lines: worn, slightly broken paint rather than a clean bar */}
      <rect x="9" y="0" width="3" height={RUNWAY_LEN} fill="#d8dce0" opacity="0.42" />
      <rect x={RUNWAY_W - 12} y="0" width="3" height={RUNWAY_LEN} fill="#d8dce0" opacity="0.42" />

      {/* centreline */}
      {Array.from({ length: 16 }).map((_, i) => (
        <rect key={i} x={RUNWAY_W / 2 - 2.5} y={80 + i * 120} width="5" height="60" fill="#d8dce0" opacity="0.5" />
      ))}

      {/* touchdown zone bars */}
      {[0, 1, 2].map((i) => (
        <g key={i} fill="#d8dce0" opacity="0.55">
          <rect x="30" y={RUNWAY_LEN - 560 - i * 150} width="9" height="66" />
          <rect x={RUNWAY_W - 39} y={RUNWAY_LEN - 560 - i * 150} width="9" height="66" />
        </g>
      ))}

      {/* designator, painted white with visible wear rather than solid ink */}
      <text
        x={RUNWAY_W / 2}
        y={RUNWAY_LEN - 250}
        textAnchor="middle"
        fill="#eceff2"
        fillOpacity="0.68"
        fontSize="60"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing="-1"
      >
        {designator}
      </text>

      {/* threshold piano keys */}
      {[20, 42, 64, 94, 116, 138].map((x) => (
        <rect key={x} x={x} y={RUNWAY_LEN - 148} width="11" height="114" fill="#eceff2" opacity="0.6" />
      ))}

      {/* runway edge lights: small fixtures with a soft amber halo — no
          fixture reads larger than roughly a car headlamp at this scale */}
      {lights.map((_, i) => {
        const y = 40 + i * 110;
        const start = ((lights.length - 1 - i) / lights.length) * 0.7;
        const on = 0.3 + 0.7 * range(lit, start, start + 0.3);
        return (
          <g key={i} opacity={on}>
            <circle cx="4" cy={y} r="5" fill={`url(#${u}-lamp)`} />
            <circle cx="4" cy={y} r="1.3" fill="#fff8e2" />
            <circle cx={RUNWAY_W - 4} cy={y} r="5" fill={`url(#${u}-lamp)`} />
            <circle cx={RUNWAY_W - 4} cy={y} r="1.3" fill="#fff8e2" />
          </g>
        );
      })}

      {/* overall wear/fade pass, on top of everything */}
      <rect width={RUNWAY_W} height={RUNWAY_LEN} fill={`url(#${u}-wear)`} pointerEvents="none" />
    </svg>
  );
}

/* Sequenced approach lights ahead of the threshold — the running "rabbit". */
function ApproachLights() {
  return (
    <div className="land__approach" aria-hidden="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <span key={i} style={{ animationDelay: `${(6 - i) * 0.09}s`, top: `${i * 42}px` }} />
      ))}
    </div>
  );
}

export default function PrizeFleet() {
  const [ref, p] = useScrollProgress();

  // one progress value drives all three aircraft, so they land together
  const t = landingT(p);
  const f = flightPath(t);

  const deck = 1 - range(t, 0.12, 0.42);
  const settle = range(t, TOUCHDOWN + 0.06, 0.96);
  const puff = range(t, TOUCHDOWN - 0.01, TOUCHDOWN + 0.05) * (1 - range(t, TOUCHDOWN + 0.05, TOUCHDOWN + 0.22));
  const handoff = range(p, 0.9, 1);

  // settles out of a gentle roll as the aircraft stabilises on approach
  const roll = f.air * 7 * Math.sin(t * 16);
  const headOpacity = range(p, 0.01, 0.08);

  return (
    <section id="prizes" data-label="Final approach" ref={ref} className="prizes">
      <div className="land">
        {/* grass is painted flat in screen space: a textured 3D plane wide
            enough to reach the screen edges overruns the GPU tile budget,
            and the browser silently drops parts of it */}
        <div className="land__grass" />

        {/* 3D airfield */}
        <div
          className="land__scene"
          style={{ transform: `scale(${1 + range(t, TOUCHDOWN, 1) * 0.06})` }}
        >
          <div
            className="land__ground"
            style={{ width: GROUND_W, height: GROUND_H, marginLeft: -GROUND_W / 2 }}
          >
            {PRIZES.map((z) => {
              const cx = GROUND_W / 2 + z.x;
              return (
                <div key={`rw-${z.key}`}>
                  <div
                    className="land__rwWrap"
                    style={{ left: cx - RUNWAY_W / 2, top: RUNWAY_TOP }}
                  >
                    <Runway designator={z.rw} lit={settle} />
                  </div>
                  <div className="land__approachWrap" style={{ left: cx, top: THRESHOLD_Y + 30 }}>
                    <ApproachLights />
                  </div>
                </div>
              );
            })}

            {PRIZES.map((z) => {
              const cx = GROUND_W / 2 + z.x;
              const w = PLANE_W * z.size;
              const h = PLANE_H * z.size;
              const left = cx - w / 2;
              const top = f.y - h / 2;

              return (
                <div key={z.key}>
                  {/* shadow cast on the ground, falling away as altitude grows */}
                  <div
                    className="land__shadow"
                    style={{
                      width: w,
                      height: h,
                      left: left + f.alt * 0.55,
                      top: top + f.alt * 0.25,
                      opacity: lerp(0.62, 0.08, f.alt / 520),
                      filter: `brightness(0) blur(${4 + f.alt * 0.045}px)`,
                    }}
                  >
                    <Jet metal={z.metal} id={`${z.key}-shadow`} gear />
                  </div>

                  {/* podium glow once the aircraft has stopped */}
                  <div
                    className={`land__podium land__podium--${z.metal}`}
                    style={{
                      left: cx - 260 * z.size,
                      top: THRESHOLD_Y - 820 - 120 * z.size,
                      width: 520 * z.size,
                      height: 520 * z.size,
                      opacity: settle,
                    }}
                  />

                  {/* tyre smoke at touchdown */}
                  <div
                    className="land__puff"
                    style={{
                      left: cx - 90 * z.size,
                      top: THRESHOLD_Y - 300 + h * 0.06,
                      opacity: puff * 0.85,
                      transform: `translateZ(6px) scale(${0.6 + puff * 1.2})`,
                    }}
                  />

                  {/* the aircraft, lifted off the ground by its altitude */}
                  <div
                    className="land__plane"
                    style={{
                      width: w,
                      height: h,
                      left,
                      top,
                      transform: `translateZ(${f.alt + 6}px) rotateY(${roll}deg) rotateX(${-f.flare * 7}deg)`,
                    }}
                  >
                    <Jet metal={z.metal} id={z.key} gear />
                    <span className="land__lamp" style={{ opacity: 0.35 + f.air * 0.65 }} />
                    <span className="land__nav land__nav--port" />
                    <span className="land__nav land__nav--star" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* haze where the ground meets the sky */}
        <div className="land__haze" />

        {/* the cloud deck the aircraft descend through */}
        <div className="land__deck" style={{ opacity: deck }}>
          <Clouds seed={77} freq="0.009" octaves="4" className="land__deckClouds" />
        </div>

        <div className="land__head" style={{ opacity: headOpacity }}>
          <span className="eyebrow">Prize pool</span>
          <h2 className="land__title">₹1,00,000 on the table</h2>
        </div>

        <div className="land__labels">
          {PRIZES.map((z) => (
            <div
              key={z.key}
              className={`land__label land__label--${z.key}`}
              style={{
                opacity: settle,
                transform: `translateY(${(1 - settle) * 22}px)`,
              }}
            >
              <span className="land__place">
                {z.place} · {z.rw}
              </span>
              <strong className="land__amount">
                ₹{Math.round(z.value * easeInOut(settle)).toLocaleString("en-IN")}
              </strong>
            </div>
          ))}
        </div>

        <div className="land__handoff" style={{ opacity: easeInOut(handoff) }} />
      </div>
    </section>
  );
}
