/* Sphere illusion: surface strips scroll horizontally inside a circular clip
   while a fixed radial shading pass sits on top, so the lighting stays put as
   the surface turns. Realism comes from three things a flat diagram lacks —
   a drifting cloud deck, terrain that varies in hue, and a bright atmospheric
   limb with a dark terminator opposite the light. */

const LAND = [
  "M26 172 L44 150 L66 144 L82 154 L104 140 L126 148 L142 138 L158 152 L150 168 L164 178 L152 192 L134 188 L140 204 L122 214 L108 206 L92 220 L74 212 L58 222 L40 210 L32 194 L38 182 Z",
  "M112 218 L124 230 L132 250 L128 272 L134 292 L124 312 L112 322 L102 306 L100 284 L94 262 L100 242 L104 226 Z",
  "M206 166 L222 144 L246 136 L266 148 L286 140 L308 152 L328 146 L340 164 L328 178 L338 194 L320 204 L300 196 L282 210 L260 202 L240 214 L220 202 L208 184 Z",
  "M156 336 L176 324 L200 330 L216 346 L212 368 L202 392 L190 418 L176 436 L164 424 L158 398 L152 372 L150 352 Z",
  "M272 306 L292 294 L314 300 L330 316 L324 336 L308 348 L292 342 L282 352 L270 340 L276 322 Z",
  "M44 262 L62 252 L80 260 L86 278 L76 294 L58 298 L46 286 L42 272 Z",
  "M344 236 L356 230 L364 240 L356 250 L346 246 Z",
  "M366 262 L376 258 L382 268 L372 274 Z",
  "M232 254 L244 248 L252 258 L244 268 L234 264 Z",
  "M188 452 L200 446 L208 456 L198 464 L189 460 Z",
];

/* Interior tones: arid belts and highlands, so landmasses are not one flat green. */
const INTERIOR = [
  { d: "M54 168 L96 152 L132 160 L142 182 L110 198 L74 200 L56 186 Z", fill: "#a08b4e" },
  { d: "M228 160 L272 148 L312 158 L322 176 L286 192 L244 190 Z", fill: "#8f7c46" },
  { d: "M164 350 L196 340 L206 362 L190 398 L172 386 Z", fill: "#6f7f3e" },
  { d: "M110 240 L126 252 L124 284 L110 296 L104 268 Z", fill: "#7d8a42" },
  { d: "M284 310 L312 306 L320 324 L300 336 L286 328 Z", fill: "#9a8449" },
];

function Surface({ offset }) {
  return (
    <g transform={`translate(${offset} 0)`}>
      {LAND.map((d, i) => (
        <path key={i} d={d} fill={i % 3 === 0 ? "#3f6b3c" : "#4a7a44"} />
      ))}
      {INTERIOR.map((s, i) => (
        <path key={`i${i}`} d={s.d} fill={s.fill} opacity="0.75" />
      ))}
      {/* shallow shelf where land meets sea */}
      {LAND.map((d, i) => (
        <path
          key={`c${i}`}
          d={d}
          fill="none"
          stroke="#6fb3c9"
          strokeOpacity="0.4"
          strokeWidth="3"
        />
      ))}
    </g>
  );
}

const CITIES = [
  [60, 180], [96, 170], [126, 176], [80, 205], [114, 250], [112, 290],
  [240, 170], [270, 160], [300, 175], [320, 190], [260, 195], [180, 350],
  [190, 390], [172, 415], [290, 315], [312, 322], [62, 275], [352, 240],
  [240, 258], [140, 160], [226, 182], [196, 368],
];

function Cities({ offset }) {
  return (
    <g transform={`translate(${offset} 0)`}>
      {CITIES.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="6" fill="#ffc86a" opacity="0.22" />
          <circle cx={x} cy={y} r="1.8" fill="#fff1c7" />
        </g>
      ))}
    </g>
  );
}

const PLANE =
  "M9 0 L-2 -2 L-6 -6 L-8 -6 L-6 -2 L-8 -1 L-8 1 L-6 2 L-8 6 L-6 6 L-2 2 Z";

const ORBITS = [
  { id: "orb1", d: "M78 232 C210 36, 400 42, 526 188", dur: 13, delay: 0 },
  { id: "orb2", d: "M62 330 C190 500, 430 492, 540 306", dur: 17, delay: -4 },
  { id: "orb3", d: "M140 112 C330 236, 356 396, 302 540", dur: 21, delay: -9 },
];

export default function Globe({ spin = 42, progress = null, marker = null, stops = [], activeIndex = -1, className = "" }) {
  const R = 200;
  const C = 300;

  // When a progress value is supplied (the timeline scrubbing), the globe is
  // driven by it instead of idling: the surface turns, the cloud deck drifts
  // ahead of it, and the sun tracks round so late-schedule stops fall on the
  // night side.
  const driven = progress !== null;
  const t = driven ? progress : 0;
  const surfaceX = -(t * 400);
  const cloudX = -(t * 620);
  const theta = t * Math.PI * 2 - Math.PI * 0.68;
  // night peaks around the middle of the schedule (the small hours). As it
  // deepens, the sun swings far off the visible face so the terminator
  // actually crosses it and the city lights come up.
  const night = (1 - Math.cos(2 * Math.PI * (t - 0.03))) / 2;
  const reach = 32 + 95 * night;
  const lightX = 50 + reach * Math.cos(theta);
  const lightY = 34 + reach * 0.6 * Math.sin(theta);

  // the terminator gradient is measured against the sphere's 400px box; the
  // night mask spans the whole 600px canvas, so convert between the two
  const nightX = ((100 + 4 * lightX) / 600) * 100;
  const nightY = ((100 + 4 * lightY) / 600) * 100;

  // marker rides the same rotation, so it stays pinned to a surface point
  const mAng = theta + Math.PI * 0.35;
  const mx = C + Math.cos(mAng) * R * 0.62;
  const my = C + Math.sin(mAng) * R * 0.42;

  return (
    <svg viewBox="0 0 600 600" className={`globe ${className}`} aria-hidden="true">
      <defs>
        <clipPath id="globeClip">
          <circle cx={C} cy={C} r={R} />
        </clipPath>

        {/* ocean: lighter toward the lit limb, deep in the basins */}
        <radialGradient id="ocean" cx={`${lightX}%`} cy={`${lightY}%`} r="82%">
          <stop offset="0%" stopColor="#3f8fc4" />
          <stop offset="45%" stopColor="#225f92" />
          <stop offset="100%" stopColor="#0b2e50" />
        </radialGradient>

        {/* terminator: light from upper-left, night falling to lower-right */}
        <radialGradient id="terminator" cx={`${lightX}%`} cy={`${lightY}%`} r="86%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="38%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="64%" stopColor="#00060f" stopOpacity="0.34" />
          <stop offset="86%" stopColor="#00060f" stopOpacity="0.74" />
          <stop offset="100%" stopColor="#000409" stopOpacity="0.94" />
        </radialGradient>

        {/* atmospheric limb */}
        <radialGradient id="limb" cx="50%" cy="50%" r="50%">
          <stop offset="86%" stopColor="#8fd2ff" stopOpacity="0" />
          <stop offset="95%" stopColor="#8fd2ff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#bfe6ff" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="haze" cx="50%" cy="50%" r="50%">
          <stop offset="72%" stopColor="#6fc2f5" stopOpacity="0" />
          <stop offset="92%" stopColor="#6fc2f5" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#6fc2f5" stopOpacity="0" />
        </radialGradient>

        {/* cloud deck */}
        <filter id="cloudNoise" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012"
            numOctaves="5"
            seed="11"
            stitchTiles="stitch"
          />
          <feColorMatrix
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    2.1 0 0 0 -0.86"
          />
        </filter>

        {ORBITS.map((o) => (
          <path key={o.id} id={o.id} d={o.d} fill="none" />
        ))}

        <radialGradient id="nightG" cx={`${nightX}%`} cy={`${nightY}%`} r="62%">
          <stop offset="0%" stopColor="#000" />
          <stop offset="46%" stopColor="#000" />
          <stop offset="78%" stopColor="#fff" />
        </radialGradient>
        <mask id="nightMask">
          <rect width="600" height="600" fill="url(#nightG)" />
        </mask>
      </defs>

      {/* outer haze */}
      <circle cx={C} cy={C} r={R + 40} fill="url(#haze)" />

      {/* ocean */}
      <circle cx={C} cy={C} r={R} fill="url(#ocean)" />

      <g clipPath="url(#globeClip)">
        {/* terrain */}
        <g
          className={driven ? "" : "globe__spin"}
          style={
            driven
              ? { transform: `translateX(${surfaceX}px)` }
              : { animationDuration: `${spin}s` }
          }
        >
          <Surface offset={100} />
          <Surface offset={500} />
        </g>

        {/* polar ice, softened into the surface */}
        <ellipse cx={C} cy={C - 196} rx="158" ry="46" fill="#eef5f9" opacity="0.8" />
        <ellipse cx={C} cy={C - 168} rx="130" ry="26" fill="#eef5f9" opacity="0.32" />
        <ellipse cx={C} cy={C + 198} rx="158" ry="44" fill="#eef5f9" opacity="0.74" />
        <ellipse cx={C} cy={C + 172} rx="126" ry="24" fill="#eef5f9" opacity="0.28" />

        {/* cloud deck drifting faster than the ground beneath it */}
        <g
          className={driven ? "globe__cloudsStatic" : "globe__clouds"}
          style={
            driven
              ? { transform: `translateX(${cloudX}px)` }
              : { animationDuration: `${spin * 0.62}s` }
          }
        >
          <rect x="100" y="80" width="400" height="440" filter="url(#cloudNoise)" />
          <rect x="500" y="80" width="400" height="440" filter="url(#cloudNoise)" />
        </g>
      </g>

      {/* day/night shading — fixed, so the light never turns with the globe */}
      <circle cx={C} cy={C} r={R} fill="url(#terminator)" />

      {/* city lights sit above the shading: they emit light, so the night
          pass must not dim them */}
      <g clipPath="url(#globeClip)">
        <g mask="url(#nightMask)">
          <g
            className={driven ? "" : "globe__spin"}
            style={
              driven
                ? { transform: `translateX(${surfaceX}px)` }
                : { animationDuration: `${spin}s` }
            }
          >
            <Cities offset={100} />
            <Cities offset={500} />
          </g>
        </g>
      </g>

      {/* bright limb */}
      <circle cx={C} cy={C} r={R} fill="url(#limb)" />
      <circle
        cx={C}
        cy={C}
        r={R}
        fill="none"
        stroke="#bfe6ff"
        strokeOpacity="0.4"
        strokeWidth="1.2"
      />

      {/* active timeline stop, pinned to the turning surface */}
      {driven && marker && (
        <g className="globe__marker">
          <circle cx={mx} cy={my} r="16" fill="#f0d79a" opacity="0.16" />
          <circle cx={mx} cy={my} r="8" fill="#f0d79a" opacity="0.34" />
          <circle cx={mx} cy={my} r="4" fill="#fff6df" />
          <line
            x1={mx}
            y1={my}
            x2={mx + 54}
            y2={my - 46}
            stroke="#f0d79a"
            strokeOpacity="0.6"
            strokeWidth="1.2"
          />
          <text
            x={mx + 60}
            y={my - 48}
            fill="#fff6df"
            fontSize="19"
            fontFamily="Helvetica, Arial, sans-serif"
            letterSpacing="1"
          >
            {marker}
          </text>
        </g>
      )}

      {/* flight trail: everything already flown, drawn round the ring */}
      {stops.length > 0 && activeIndex > 0 && (() => {
        const a0 = -Math.PI / 2;
        const a1 = (activeIndex / stops.length) * Math.PI * 2 - Math.PI / 2;
        const rr = R + 16;
        const x0 = C + Math.cos(a0) * rr;
        const y0 = C + Math.sin(a0) * rr;
        const x1 = C + Math.cos(a1) * rr;
        const y1 = C + Math.sin(a1) * rr;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const d = `M ${x0} ${y0} A ${rr} ${rr} 0 ${large} 1 ${x1} ${y1}`;
        return (
          <g className="globe__trail">
            <path d={d} fill="none" stroke="#f0d79a" strokeOpacity="0.25" strokeWidth="7" strokeLinecap="round" />
            <path d={d} fill="none" stroke="#fff1c7" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        );
      })()}

      {/* the full schedule, ringed around the sphere */}
      {stops.length > 0 && (
        <g className="globe__ring">
          {stops.map((st, i) => {
            const ang = (i / stops.length) * Math.PI * 2 - Math.PI / 2;
            const rr = R + 46;
            const x = C + Math.cos(ang) * rr;
            const y = C + Math.sin(ang) * rr;
            const on = i === activeIndex;
            const done = i < activeIndex;
            return (
              <g key={`${st}-${i}`}>
                {on && (
                  <circle
                    className="globe__pulse"
                    cx={C + Math.cos(ang) * (R + 16)}
                    cy={C + Math.sin(ang) * (R + 16)}
                    r="5"
                    fill="none"
                    stroke="#fff1c7"
                    strokeWidth="1.6"
                  />
                )}
                <circle
                  cx={C + Math.cos(ang) * (R + 16)}
                  cy={C + Math.sin(ang) * (R + 16)}
                  r={on ? 5 : 2.6}
                  fill={on ? "#fff6df" : "#f0d79a"}
                  opacity={on ? 1 : done ? 0.7 : 0.34}
                />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={on ? "#fff6df" : "#f0d79a"}
                  fillOpacity={on ? 1 : done ? 0.72 : 0.36}
                  fontSize={on ? 21 : 15}
                  fontWeight={on ? 600 : 400}
                  fontFamily="Helvetica, Arial, sans-serif"
                >
                  {st}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* orbit paths */}
      <g
        fill="none"
        stroke="#e8d9ae"
        strokeOpacity="0.3"
        strokeWidth="1.2"
        strokeDasharray="5 7"
      >
        {ORBITS.map((o) => (
          <path key={`p${o.id}`} d={o.d} />
        ))}
      </g>

      {/* aircraft tracking the orbits */}
      {ORBITS.map((o) => (
        <g key={`a${o.id}`} className="globe__plane">
          <path d={PLANE} fill="#f6efd8" />
          <animateMotion
            dur={`${o.dur}s`}
            begin={`${o.delay}s`}
            repeatCount="indefinite"
            rotate="auto"
          >
            <mpath href={`#${o.id}`} />
          </animateMotion>
        </g>
      ))}
    </svg>
  );
}
