/* The cabin window, drawn as four stacked plates on a 2:1 stage (1536×768
   units) that is cover-fitted to the viewport, exactly like the photographic
   layers it replaces:

     back       inner frame ring and the shade housing
     window     the pull-down shade and its handle (animated)
     front      cabin wall with the moulded bezel, cut through at the opening
     front-over the highlight that sits on the bezel before the shade lifts

   Stage coordinates were measured off the reference so the aperture lands
   in the same place at every viewport size. */

import { useEffect, useRef, useState } from "react";

const W = 1536;
const H = 768;

// the moulded bezel and the hole cut through the wall
const BEZEL = { x: 573.9, y: 115.2, w: 398.2, h: 517.7, rx: 128, ry: 132 };
const HOLE = { x: 626.6, y: 177, w: 288.7, h: 404, rx: 76, ry: 104 };
// inner frame ring: its clear opening is where the sky shows
const RING_OUT = { x: 616, y: 166, w: 310, h: 426, rx: 86, ry: 114 };
const RING_IN = { x: 646.5, y: 204.8, w: 250.9, h: 348.4, rx: 80, ry: 102 };

const Rect = ({ r, inflate = 0, ...rest }) => (
  <rect
    x={r.x - inflate}
    y={r.y - inflate}
    width={r.w + inflate * 2}
    height={r.h + inflate * 2}
    rx={r.rx + inflate}
    ry={r.ry + inflate}
    {...rest}
  />
);

/* Filtered vector art is expensive to re-rasterise, and the zoom scales these
   plates past 8×. So each plate is drawn once into a bitmap at mount and the
   <img> is what gets scaled — the SVG stays only as the source (and as the
   fallback for the first frames while the bitmap is being made). */
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
      canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject()), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject();
    };
    img.src = url;
  });
}

const Svg = ({ children }) => {
  const ref = useRef(null);
  const [src, setSrc] = useState("");

  useEffect(() => {
    let made = "";
    let live = true;
    // the plate is shown up to ~1.2857 × 6.5 × its stage size; past ~3200px
    // wide the extra pixels cost memory without reading any sharper
    const stageW = Math.max(window.innerWidth, window.innerHeight * 2);
    const width = Math.min(3200, Math.round(stageW * 1.2857 * Math.min(window.devicePixelRatio || 1, 2)));
    rasterise(ref.current, width, Math.round(width / 2))
      .then((url) => {
        made = url;
        if (live) setSrc(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => {
        /* keep the live SVG */
      });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, []);

  return (
    <>
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        className="jx-stage__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={src ? { display: "none" } : undefined}
      >
        {children}
      </svg>
      {src && <img className="jx-stage__svg" src={src} alt="" draggable="false" />}
    </>
  );
};

export function BackPlate() {
  return (
    <Svg>
      <defs>
        <linearGradient id="jx-ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef2f6" />
          <stop offset="0.55" stopColor="#dde8f1" />
          <stop offset="1" stopColor="#cddcea" />
        </linearGradient>
        <linearGradient id="jx-housing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d3d3d" />
          <stop offset="0.7" stopColor="#6b6b6b" />
          <stop offset="1" stopColor="#8d8d8d" />
        </linearGradient>
        <mask id="jx-ring-mask">
          <rect width={W} height={H} fill="#fff" />
          <Rect r={RING_IN} fill="#000" />
        </mask>
        <clipPath id="jx-ring-clip">
          <Rect r={RING_OUT} />
        </clipPath>
        <filter id="jx-soft4" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <g mask="url(#jx-ring-mask)">
        <Rect r={RING_OUT} fill="url(#jx-ring)" />
        <g clipPath="url(#jx-ring-clip)">
          {/* soft blue fall-off onto the clear opening */}
          <Rect r={RING_IN} inflate={5} fill="none" stroke="#b4c9dc" strokeWidth="10" filter="url(#jx-soft4)" />
          <Rect r={RING_IN} fill="none" stroke="#9fb3c6" strokeWidth="2.5" />
          {/* groove running round the lower half of the frame */}
          <path
            d={`M ${RING_IN.x - 9} ${RING_IN.y + RING_IN.h - RING_IN.ry}
                A ${RING_IN.rx + 9} ${RING_IN.ry + 9} 0 0 0 ${RING_IN.x + RING_IN.rx} ${RING_IN.y + RING_IN.h + 9}
                L ${RING_IN.x + RING_IN.w - RING_IN.rx} ${RING_IN.y + RING_IN.h + 9}
                A ${RING_IN.rx + 9} ${RING_IN.ry + 9} 0 0 0 ${RING_IN.x + RING_IN.w + 9} ${RING_IN.y + RING_IN.h - RING_IN.ry}
`}
            fill="none"
            stroke="#8b9fb2"
            strokeWidth="1.6"
          />
        </g>
      </g>

      {/* shade housing across the top of the opening */}
      <path
        d="M 684 168 L 862 168 L 884 196 Q 870 214 773 214 Q 676 214 662 196 Z"
        fill="url(#jx-housing)"
      />
      <path d="M 666 199 Q 680 213 773 213 Q 866 213 880 199" fill="none" stroke="#c4c4c4" strokeWidth="2" />
    </Svg>
  );
}

export function FrontPlate() {
  return (
    <Svg>
      <defs>
        <mask id="jx-hole">
          <rect width={W} height={H} fill="#fff" />
          <Rect r={HOLE} fill="#000" />
        </mask>
        <clipPath id="jx-bezel-clip">
          <Rect r={BEZEL} />
        </clipPath>
        <linearGradient id="jx-bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dcdcdc" />
          <stop offset="0.5" stopColor="#d4d4d4" />
          <stop offset="1" stopColor="#c2c2c2" />
        </linearGradient>
        <radialGradient id="jx-wall" cx="773" cy="374" r="760" gradientUnits="userSpaceOnUse"
          gradientTransform="translate(773 374) scale(1 0.82) translate(-773 -374)">
          <stop offset="0" stopColor="#6e6157" />
          <stop offset="0.45" stopColor="#40362f" />
          <stop offset="1" stopColor="#221c18" />
        </radialGradient>
        <filter id="jx-glow-near" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="46" />
        </filter>
        <filter id="jx-glow-far" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="120" />
        </filter>
        <filter id="jx-blur16" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id="jx-blur8" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id="jx-blur3" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <g mask="url(#jx-hole)">
        {/* wall, lit by the window */}
        <rect width={W} height={H} fill="url(#jx-wall)" />
        <Rect r={BEZEL} inflate={70} fill="#b3a699" opacity="0.75" filter="url(#jx-glow-far)" />
        <Rect r={BEZEL} inflate={14} fill="#efe6dc" opacity="0.95" filter="url(#jx-glow-near)" />

        {/* contact shadow where the bezel meets the wall */}
        <Rect r={BEZEL} inflate={2} fill="#3a3129" opacity="0.28" filter="url(#jx-blur3)" transform="translate(0 5)" />

        {/* moulded bezel: lighter along the crown of the tube, darker at both edges */}
        <Rect r={BEZEL} fill="url(#jx-bezel)" />
        <g clipPath="url(#jx-bezel-clip)">
          <Rect r={BEZEL} fill="none" stroke="#9c9c9c" strokeWidth="34" opacity="0.55" filter="url(#jx-blur16)" />
          <Rect r={BEZEL} inflate={-10} fill="none" stroke="#f4f4f4" strokeWidth="9" opacity="0.55" filter="url(#jx-blur8)" />
          <Rect r={HOLE} inflate={4} fill="none" stroke="#8e8e8e" strokeWidth="34" opacity="0.6" filter="url(#jx-blur16)" />
          {/* overhang shadow above the opening */}
          <ellipse cx="773" cy="160" rx="150" ry="44" fill="#5b5b5b" opacity="0.55" filter="url(#jx-blur16)" />
          <Rect r={HOLE} inflate={2} fill="none" stroke="#a6a6a6" strokeWidth="3" filter="url(#jx-blur3)" />
          <Rect r={HOLE} inflate={7} fill="none" stroke="#ececec" strokeWidth="3" opacity="0.5" filter="url(#jx-blur3)" />
        </g>
      </g>
    </Svg>
  );
}

export function FrontOverPlate() {
  return (
    <Svg>
      <defs>
        <filter id="jx-over-blur" x="-30%" y="-80%" width="160%" height="260%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <path
        d="M 660 196 Q 773 84 886 196"
        fill="none"
        stroke="#cbcbcb"
        strokeWidth="26"
        strokeLinecap="round"
        filter="url(#jx-over-blur)"
      />
    </Svg>
  );
}

/* Handle strip on the shade's bottom edge (1024×184 units). The dark variant
   fades in as the shade rises into the shadow of the housing. */
export function Knob({ dark = false }) {
  const c = dark
    ? { face: "#8f8f8f", lipHi: "#bdbdbd", lipLo: "#6a6a6a", rim: "#b3b3b3", well0: "#5a5a5a", well1: "#7d7d7d" }
    : { face: "#d2d2d2", lipHi: "#f5f5f5", lipLo: "#9b9b9b", rim: "#efefef", well0: "#767676", well1: "#b4b4b4" };
  const id = dark ? "jx-knob-dark" : "jx-knob-lit";

  return (
    <svg className="jx-knob__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 184" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-well`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.well0} />
          <stop offset="1" stopColor={c.well1} />
        </linearGradient>
        <filter id={`${id}-blur`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect y="12" width="1024" height="172" fill={c.face} />
      <rect y="4" width="1024" height="8" fill={c.lipHi} />
      <rect y="12" width="1024" height="3" fill={c.lipLo} />
      <ellipse cx="512" cy="92" rx="214" ry="62" fill={c.rim} />
      <ellipse cx="512" cy="98" rx="192" ry="47" fill={`url(#${id}-well)`} />
      <ellipse cx="512" cy="84" rx="186" ry="30" fill="#000" opacity="0.25" filter={`url(#${id}-blur)`} />
    </svg>
  );
}
