import { useEffect, useState } from "react";

/* Window sits low and compact so the copy block above it has clear space —
   text stacked over the aperture reads as clutter at any contrast. */
const CX = 800;
const CY = 590;
const RX = 140;
const RY = 182;

/* Sidewall, window well and trim. The window is masked out so the sky
   layer behind this element shows through the aperture. */
export function CabinWall({ shadeOpen = true, beltOn = false }) {
  return (
    <svg
      className="cabin__wall"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wallV" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a231b" />
          <stop offset="14%" stopColor="#6b5f4e" />
          <stop offset="30%" stopColor="#cbbca2" />
          <stop offset="48%" stopColor="#eae0c9" />
          <stop offset="66%" stopColor="#c5b9a2" />
          <stop offset="84%" stopColor="#756958" />
          <stop offset="100%" stopColor="#302920" />
        </linearGradient>

        <linearGradient id="barrel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity="0.42" />
          <stop offset="24%" stopColor="#000" stopOpacity="0" />
          <stop offset="76%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.42" />
        </linearGradient>

        <linearGradient id="binG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#191511" />
          <stop offset="70%" stopColor="#4a423a" />
          <stop offset="100%" stopColor="#6d6356" />
        </linearGradient>

        <radialGradient id="wellG" cx="50%" cy="46%" r="60%">
          <stop offset="60%" stopColor="#c0b39c" />
          <stop offset="100%" stopColor="#7d7263" />
        </radialGradient>

        <radialGradient id="spill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#cfe4f7" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#b8d4ec" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#b8d4ec" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="glassRefl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="shadeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9d2c3" />
          <stop offset="100%" stopColor="#b9b09e" />
        </linearGradient>

        <clipPath id="apertureClip">
          <ellipse cx={CX} cy={CY} rx={RX + 2} ry={RY + 2} />
        </clipPath>

        <mask id="apertureMask">
          <rect width="1600" height="1000" fill="#fff" />
          <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="#000" />
        </mask>
      </defs>

      {/* glass reflection sits over the sky, inside the aperture */}
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="url(#glassRefl)" />

      {/* window shade: starts drawn, slides up into the housing */}
      <g clipPath="url(#apertureClip)">
        <g
          className="cabin__shade"
          style={{
            transform: shadeOpen ? `translateY(${-(RY * 2 + 60)}px)` : "none",
          }}
        >
          <rect x={CX - RX - 6} y={CY - RY - 6} width={RX * 2 + 12} height={RY * 2 + 12} fill="url(#shadeG)" />
          {Array.from({ length: 9 }).map((_, i) => (
            <rect
              key={i}
              x={CX - RX - 6}
              y={CY - RY + 18 + i * 38}
              width={RX * 2 + 12}
              height="2"
              fill="#9e9584"
              opacity="0.35"
            />
          ))}
          <rect x={CX - 38} y={CY + RY - 34} width="76" height="16" rx="8" fill="#8b8273" />
        </g>
      </g>

      <g mask="url(#apertureMask)">
        <rect width="1600" height="1000" fill="url(#wallV)" />

        {/* recessed window well */}
        <ellipse cx={CX} cy={CY} rx={RX + 34} ry={RY + 38} fill="url(#wellG)" />
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX + 12}
          ry={RY + 14}
          fill="none"
          stroke="#efe7d8"
          strokeWidth="9"
        />
        <ellipse
          cx={CX}
          cy={CY + 6}
          rx={RX + 26}
          ry={RY + 30}
          fill="none"
          stroke="#000"
          strokeOpacity="0.28"
          strokeWidth="10"
        />

        {/* overhead bin band */}
        <rect width="1600" height="146" fill="url(#binG)" />
        <rect y="146" width="1600" height="5" fill="#a99e8c" opacity="0.75" />
        <rect y="151" width="1600" height="34" fill="#000" opacity="0.3" />

        {/* seatbelt sign above the window, below the nav bar */}
        <g className={`cabin__belt ${beltOn ? "cabin__belt--on" : ""}`}>
          <rect x={CX - 64} y="222" width="128" height="58" rx="10" fill="#1d1a16" stroke="#5a5247" strokeWidth="2" />
          <rect x={CX - 56} y="230" width="112" height="42" rx="6" className="cabin__beltFace" />
          <g className="cabin__beltIcon" fill="none" strokeWidth="3.2" strokeLinecap="round">
            <circle cx={CX - 20} cy="240" r="5" />
            <path d={`M${CX - 30} 264 v-10 a10 10 0 0 1 20 0 v10`} />
            <path d={`M${CX - 34} 256 h28`} />
            <circle cx={CX + 22} cy="240" r="5" />
            <path d={`M${CX + 12} 264 v-10 a10 10 0 0 1 20 0 v10`} />
          </g>
        </g>

        {/* window shade housing */}
        <rect
          x={CX - 208}
          y={CY - RY - 78}
          width="416"
          height="40"
          rx="14"
          fill="#cbc0ac"
        />
        <rect
          x={CX - 44}
          y={CY - RY - 66}
          width="88"
          height="14"
          rx="7"
          fill="#8b8273"
        />

        {/* dado trim line + lower panel */}
        <rect y="742" width="1600" height="4" fill="#efe7d8" opacity="0.5" />
        <rect y="746" width="1600" height="10" fill="#000" opacity="0.3" />
        <rect y="756" width="1600" height="244" fill="#000" opacity="0.16" />

        {/* barrel curvature */}
        <rect width="1600" height="1000" fill="url(#barrel)" />

        {/* daylight spilling in from the window */}
        <ellipse cx={CX} cy={CY} rx="620" ry="560" fill="url(#spill)" />
      </g>
    </svg>
  );
}

/* Tray table in the near foreground: laptop open, screen throwing cool light
   back onto the surface. The table itself is a CSS trapezoid so it always
   spans the viewport; only the props sit in a fixed-aspect SVG. */
const TYPE_LINES = ["$ npm run elevate", "✓ systems ready"];

export function CabinDesk({ typing = false }) {
  const [chars, setChars] = useState(0);
  const total = TYPE_LINES.join("").length;

  useEffect(() => {
    if (!typing || chars >= total + 6) return;
    const id = setTimeout(() => setChars((c) => c + 1), chars < total ? 55 : 120);
    return () => clearTimeout(id);
  }, [typing, chars, total]);

  const line1 = TYPE_LINES[0].slice(0, Math.min(chars, TYPE_LINES[0].length));
  const line2 = TYPE_LINES[1].slice(0, Math.max(0, chars - TYPE_LINES[0].length));
  const showName = chars >= total + 6;
  const caret = !showName && Math.floor(chars / 3) % 2 === 0 ? "▍" : "";

  return (
    <>
      <div className="cabin__tray" />
      <svg
        className="cabin__props"
        viewBox="0 0 800 240"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lidG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b3730" />
            <stop offset="100%" stopColor="#22201c" />
          </linearGradient>
          <linearGradient id="screenG" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#9fd0ea" />
            <stop offset="55%" stopColor="#5d90b4" />
            <stop offset="100%" stopColor="#33566f" />
          </linearGradient>
          <linearGradient id="deckG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a453c" />
            <stop offset="100%" stopColor="#2a2723" />
          </linearGradient>
          <radialGradient id="screenGlow" cx="50%" cy="0%" r="70%">
            <stop offset="0%" stopColor="#bfe0f2" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#bfe0f2" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* light thrown forward by the screen */}
        <ellipse cx="400" cy="196" rx="250" ry="58" fill="url(#screenGlow)" />

        {/* laptop lid, tilted away so the top edge reads narrower */}
        <path d="M258 10 L546 10 L578 156 L226 156 Z" fill="url(#lidG)" />
        <path d="M272 22 L532 22 L560 148 L244 148 Z" fill="url(#screenG)" />
        {/* screen: types a command, then resolves into the event name */}
        {showName ? (
          <g className="cabin__screenName">
            <text x="402" y="92" textAnchor="middle" fill="#ffffff" fontSize="46" fontWeight="500" fontFamily="Helvetica, Arial, sans-serif" letterSpacing="1">
              Elevate 1.0
            </text>
            <text x="402" y="122" textAnchor="middle" fill="#dff0fb" fillOpacity="0.75" fontSize="18" fontFamily="Helvetica, Arial, sans-serif" letterSpacing="3">
              24-HOUR HACKATHON
            </text>
          </g>
        ) : (
          <g fontFamily="SF Mono, Menlo, Consolas, monospace" fontSize="22" fill="#eaf6ff">
            <text x="292" y="70">
              {line1}
              {line2 ? "" : caret}
            </text>
            <text x="292" y="104" fill="#8ff0a8">
              {line2}
              {line2 ? caret : ""}
            </text>
          </g>
        )}

        {/* keyboard deck */}
        <path d="M226 156 L578 156 L616 216 L188 216 Z" fill="url(#deckG)" />
        <path d="M248 164 L556 164 L580 198 L224 198 Z" fill="#191714" opacity="0.75" />
        <rect x="352" y="202" width="104" height="8" rx="4" fill="#3f3a33" />

        {/* cup */}
        <path d="M632 146 L700 146 L690 206 L642 206 Z" fill="#c9c1b0" />
        <path d="M632 146 L700 146 L696 170 L636 170 Z" fill="#ded7c7" />
        <ellipse cx="666" cy="146" rx="34" ry="10" fill="#efe9db" />
        <ellipse cx="666" cy="147" rx="26" ry="7" fill="#3d2a1c" />
        <path
          d="M700 158 C722 158, 724 186, 700 188"
          fill="none"
          stroke="#c9c1b0"
          strokeWidth="7"
        />

        {/* notebook */}
        <path d="M96 168 L206 160 L222 200 L104 209 Z" fill="#b9ad96" />
        <path d="M96 168 L206 160 L208 168 L99 176 Z" fill="#d6cbb4" />
        <g stroke="#8d8270" strokeWidth="2.5" opacity="0.6">
          <path d="M116 180 L196 174" />
          <path d="M120 190 L200 184" />
        </g>
      </svg>
    </>
  );
}

/* Foreground seat backs. Anchored to the viewport edges rather than to SVG
   coordinates, which a slice-scaled viewBox would crop away on tall screens.
   Nearest plane — scales fastest and leaves frame first. */
export function CabinSeats() {
  return (
    <>
      <div className="cabin__seat cabin__seat--l" />
      <div className="cabin__seat cabin__seat--r" />
    </>
  );
}
