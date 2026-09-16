import { useEffect, useRef, useState } from "react";

/* Top-down business jet on a 2160 × 2400 plate (nose up), laid out to the
   same proportions as the reference render: nose at 6.8% of the plate,
   tail at 98%, wingtips at 9% / 92% across and 69.5% down, engines between
   63% and 76%. The photo plate is rasterised once, like the cabin plates;
   the blueprint stays live so its thirty seats can be animated one by one. */

export const JET_W = 2160;
export const JET_H = 2400;

const C = JET_W / 2;
const FUSE = 95; // half-width of the painted fuselage

/* Wing planform for one side (1 = right, -1 = left), in plate units:
   swept leading edge, a kinked trailing edge, short tip chord and a winglet. */
function wing(side) {
  const x = (dx) => C + dx * side;
  const P = {
    rootLE: [x(FUSE - 6), 894],
    // the leading edge is one continuous straight sweep, root to raked tip —
    // real business-jet wings are taper-straight, not curved
    tipLE: [x(884), 1596],
    // the tip itself is raked (cut on a steep diagonal) rather than a bolted-on
    // winglet trapezoid, which is what was reading as a toy part
    tipTE: [x(902), 1666],
    kinkTE: [x(322), 1494],
    rootTE: [x(FUSE - 6), 1432],
  };
  const pt = ([px, py]) => `${px} ${py}`;
  return {
    P,
    outline: `M ${pt(P.rootLE)} L ${pt(P.tipLE)} L ${pt(P.tipTE)} L ${pt(P.kinkTE)} L ${pt(P.rootTE)} Z`,
    // leading-edge slat: a soft bright strip catching the light along the front
    slat: `M ${pt(P.rootLE)} L ${pt(P.tipLE)} L ${x(866)} ${1616} L ${x(FUSE + 16)} ${940} Z`,
    // one faint seam where the flap meets the aileron — everything else that
    // used to be drawn here (spoiler lines, a bolted-on winglet, a hinge
    // running the whole span) just read as scribbles at this scale
    flapSeam: `M ${x(322)} 1494 L ${x(322)} ${1494 + 62}`,
    fairing: `M ${x(FUSE - 26)} 880 C ${x(FUSE + 36)} 1030, ${x(FUSE + 42)} 1360, ${x(FUSE - 26)} 1490 Z`,
    navLight: [x(896), 1638],
    stab: `M ${x(18)} 1960 L ${x(300)} 2308 L ${x(307)} 2336 L ${x(16)} 2288 Z`,
    pod: x(126),
    // gradient runs across the chord, from leading edge toward the trailing edge
    chord: { x1: x(470), y1: 1224, x2: x(276), y2: 1440 },
    span: { x1: x(FUSE), y1: 1160, x2: x(900), y2: 1620 },
    // soft contact shadow where the wing root disappears under the fuselage
    root: { x1: x(FUSE - 6), y1: 950, x2: x(FUSE + 280), y2: 1200 },
  };
}

function rasterise(svg, width, height) {
  return new Promise((resolve, reject) => {
    const markup = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(URL.createObjectURL(b)) : reject()), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject();
    };
    img.src = url;
  });
}

function JetShape({ shadow = false }) {
  const L = wing(-1);
  const R = wing(1);
  const fill = (id) => (shadow ? "#3a2c22" : `url(#${id})`);

  return (
    <g>
      {!shadow && (
        <defs>
          {[
            ["L", L],
            ["R", R],
          ].map(([k, w]) => (
            <g key={k}>
              <linearGradient id={`jj-chord-${k}`} gradientUnits="userSpaceOnUse" {...w.chord}>
                <stop offset="0" stopColor="#e9e4dc" />
                <stop offset="0.18" stopColor="#d9c7b2" />
                <stop offset="0.62" stopColor="#c9b098" />
                <stop offset="1" stopColor="#a88f78" />
              </linearGradient>
              <linearGradient id={`jj-span-${k}`} gradientUnits="userSpaceOnUse" {...w.span}>
                <stop offset="0" stopColor="#6f86a3" stopOpacity="0.28" />
                <stop offset="0.55" stopColor="#9fb3c8" stopOpacity="0.1" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0.08" />
              </linearGradient>
              <linearGradient id={`jj-root-${k}`} gradientUnits="userSpaceOnUse" {...w.root}>
                <stop offset="0" stopColor="#2a2119" stopOpacity="0.34" />
                <stop offset="1" stopColor="#2a2119" stopOpacity="0" />
              </linearGradient>
            </g>
          ))}
        </defs>
      )}

      {/* wings: painted skin, sky reflection, bright slat, control surfaces */}
      {[
        ["L", L],
        ["R", R],
      ].map(([k, w]) => (
        <g key={k}>
          <path d={w.outline} fill={shadow ? "#3a2c22" : `url(#jj-chord-${k})`} />
          {!shadow && (
            <>
              <path d={w.outline} fill={`url(#jj-span-${k})`} />
              {/* soft ambient occlusion where the wing root disappears under the fuselage */}
              <path d={w.outline} fill={`url(#jj-root-${k})`} />
              <path d={w.slat} fill="#f2f4f6" opacity="0.55" />
              <path d={w.flapSeam} stroke="#7d6452" strokeWidth="2" opacity="0.22" />
              <circle cx={w.navLight[0]} cy={w.navLight[1]} r="5" fill={k === "L" ? "#e0453a" : "#3fbf6e"} opacity="0.6" />
            </>
          )}
          <path d={w.fairing} fill={fill("jj-fuse")} />
        </g>
      ))}

      {/* tailplane */}
      {[L, R].map((w, i) => (
        <path key={`s${i}`} d={w.stab} fill={fill("jj-wing-rear")} />
      ))}

      {/* engines on pylons beside the rear fuselage */}
      {[L, R].map((w, i) => (
        <g key={`e${i}`}>
          <rect x={Math.min(w.pod, C)} y="1600" width={Math.abs(w.pod - C)} height="64" fill={fill("jj-pylon")} />
          <rect x={w.pod - 60} y="1502" width="120" height="326" rx="50" fill={fill("jj-pod")} />
          {!shadow && (
            <>
              <ellipse cx={w.pod} cy="1518" rx="42" ry="14" fill="none" stroke="#e8e2d8" strokeWidth="3" opacity="0.55" />
              <ellipse cx={w.pod} cy="1518" rx="34" ry="10" fill="#201914" opacity="0.85" />
            </>
          )}
        </g>
      ))}

      {/* fuselage */}
      <path
        d={`M ${C - FUSE} 480 C ${C - FUSE} 330, ${C - 40} 200, ${C} 163 C ${C + 40} 200, ${C + FUSE} 330, ${C + FUSE} 480
            L ${C + FUSE} 1850 C ${C + FUSE} 2020, ${C + 40} 2300, ${C + 22} 2352 L ${C - 22} 2352 C ${C - 40} 2300, ${C - FUSE} 2020, ${C - FUSE} 1850 Z`}
        fill={fill("jj-fuse")}
      />
      {/* fin seen edge-on from above */}
      <rect x={C - 13} y="1900" width="26" height="480" rx="10" fill={fill("jj-fin")} />
    </g>
  );
}

export function JetPhoto() {
  const ref = useRef(null);
  const [src, setSrc] = useState("");

  useEffect(() => {
    let live = true;
    let made = "";
    const width = Math.min(2160, Math.round(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)));
    rasterise(ref.current, width, Math.round((width * JET_H) / JET_W))
      .then((u) => {
        made = u;
        if (live) setSrc(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => {});
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, []);

  const windows = [];
  for (let i = 0; i < 8; i++) {
    const y = 560 + i * 102;
    windows.push(<ellipse key={`l${i}`} cx={C - FUSE + 16} cy={y} rx="11" ry="17" fill="#1f1a18" />);
    windows.push(<ellipse key={`r${i}`} cx={C + FUSE - 16} cy={y} rx="11" ry="17" fill="#1f1a18" />);
  }

  return (
    <>
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        className="jx-jet-art"
        viewBox={`0 0 ${JET_W} ${JET_H}`}
        aria-hidden="true"
        style={src ? { display: "none" } : undefined}
      >
        <defs>
          <linearGradient id="jj-fuse" x1={C - FUSE} x2={C + FUSE} y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#7a5c49" />
            <stop offset="0.22" stopColor="#c69f82" />
            <stop offset="0.48" stopColor="#f7dfc7" />
            <stop offset="0.56" stopColor="#fbe7d3" />
            <stop offset="0.78" stopColor="#cfa98b" />
            <stop offset="1" stopColor="#6f5343" />
          </linearGradient>
          <linearGradient id="jj-pod" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#7d5f4b" />
            <stop offset="0.45" stopColor="#f2d4b8" />
            <stop offset="1" stopColor="#8b6c57" />
          </linearGradient>
          <linearGradient id="jj-pylon" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#b99479" />
            <stop offset="1" stopColor="#8a6b56" />
          </linearGradient>
          <linearGradient id="jj-fin" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#8a6b56" />
            <stop offset="0.5" stopColor="#e9c9ad" />
            <stop offset="1" stopColor="#7a5c49" />
          </linearGradient>
          {/* leading half catches the sky, trailing half is the bare metal */}
          <linearGradient id="jj-wing-front" x1="0" x2="0" y1="900" y2="1680" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#6f87a6" />
            <stop offset="0.35" stopColor="#8e8a8c" />
            <stop offset="1" stopColor="#a3968d" />
          </linearGradient>
          <linearGradient id="jj-wing-rear" x1="0" x2="0" y1="1200" y2="1700" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#d7b194" />
            <stop offset="1" stopColor="#c09a7d" />
          </linearGradient>
          <linearGradient id="jj-glass" x1="0" x2="0" y1="330" y2="410" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4b5d77" />
            <stop offset="1" stopColor="#15161b" />
          </linearGradient>
          <filter id="jj-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
        </defs>

        <g filter="url(#jj-shadow)" opacity="0.32" transform="translate(46 70)">
          <JetShape shadow />
        </g>
        <JetShape />

        {/* windshield */}
        <path d={`M ${C - 78} 410 Q ${C} 352 ${C + 78} 410 L ${C + 66} 366 Q ${C} 316 ${C - 66} 366 Z`} fill="url(#jj-glass)" />
        <path d={`M ${C - 4} 322 L ${C + 4} 322 L ${C + 4} 402 L ${C - 4} 402 Z`} fill="#d9b89c" />
        {windows}
        {/* spine highlight */}
        <rect x={C - 6} y="470" width="12" height="1400" rx="6" fill="#fff3e6" opacity="0.35" />
      </svg>
      {src && <img className="jx-jet-art" src={src} alt="" draggable="false" />}
    </>
  );
}

/* Cabin plan: a wider outline than the painted fuselage (as the reference
   blueprint is) with fifteen rows of single seats either side of the aisle. */
export const SEAT_ROWS = 15;
const BP = { l: C - 148, r: C + 148, top: 500, bottom: 2080 };

export function JetBlueprint() {
  const seats = [];
  for (let row = 0; row < SEAT_ROWS; row++) {
    const y = 600 + row * 94;
    [BP.l + 20, BP.r - 20 - 104].forEach((x, side) => {
      const n = row * 2 + side + 1;
      seats.push(
        <g key={n} className="jx-seat" data-seat={n}>
          <rect x={x} y={y} width="104" height="82" rx="16" className="jx-seat__base" />
          <rect x={x + 10} y={y + 58} width="84" height="18" rx="8" className="jx-seat__back" />
          <rect x={x} y={y + 8} width="10" height="56" rx="5" className="jx-seat__arm" />
          <rect x={x + 94} y={y + 8} width="10" height="56" rx="5" className="jx-seat__arm" />
        </g>
      );
    });
  }

  return (
    <svg className="jx-jet-art jx-jet-print" viewBox={`0 0 ${JET_W} ${JET_H}`} aria-hidden="true">
      <path
        className="jx-print__hull"
        d={`M ${BP.l} ${BP.top} C ${BP.l} 360, ${C - 70} 250, ${C} 215 C ${C + 70} 250, ${BP.r} 360, ${BP.r} ${BP.top}
            L ${BP.r} ${BP.bottom - 50} Q ${BP.r} ${BP.bottom} ${BP.r - 50} ${BP.bottom} L ${BP.l + 50} ${BP.bottom} Q ${BP.l} ${BP.bottom} ${BP.l} ${BP.bottom - 50} Z`}
      />
      {/* flight deck bulkhead and cockpit seats */}
      <path className="jx-print__line" d={`M ${BP.l} 540 L ${BP.r} 540`} />
      <rect className="jx-print__line" x={C - 90} y="400" width="62" height="56" rx="12" />
      <rect className="jx-print__line" x={C + 28} y="400" width="62" height="56" rx="12" />
      {/* aisle */}
      <path className="jx-print__aisle" d={`M ${C} 560 L ${C} 2000`} />
      {seats}
      {/* galley and lavatory at the rear */}
      <path className="jx-print__line" d={`M ${BP.l} 2016 L ${BP.r} 2016`} />
      <rect className="jx-print__line" x={BP.l + 20} y="2030" width="110" height="36" rx="8" />
      <rect className="jx-print__line" x={BP.r - 130} y="2030" width="110" height="36" rx="8" />
    </svg>
  );
}
