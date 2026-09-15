/* Top-down aircraft lit from the upper-left. Three things carry the 3D read:
   an off-centre specular on the fuselage, a bounce-light rim along the shaded
   edge (real objects pick up light from their surroundings, pure-dark edges
   look like cutouts), and a chordwise gradient across each wing so the
   aerofoil curvature shows rather than reading as flat card. */
export const METALS = {
  gold: {
    rim: "#7a5f1e",
    lit: "#ffe9a8",
    spec: "#fffdf2",
    mid: "#e0bd63",
    shade: "#8f6f22",
    dark: "#4a380f",
    deep: "#2b2008",
    bounce: "#b08a3a",
  },
  silver: {
    rim: "#7f8891",
    lit: "#eaf1f7",
    spec: "#ffffff",
    mid: "#c3ccd5",
    shade: "#79828c",
    dark: "#414850",
    deep: "#252a30",
    bounce: "#6d7a88",
  },
  bronze: {
    rim: "#7d4a28",
    lit: "#f0c49c",
    spec: "#fff1e4",
    mid: "#c8875a",
    shade: "#86512e",
    dark: "#4a2a16",
    deep: "#2b1709",
    bounce: "#8d5733",
  },
};

export default function Jet({ metal = "silver", id, gear = false }) {
  const m = METALS[metal] ?? METALS.silver;
  const u = `jet-${id ?? metal}`;

  return (
    <svg viewBox="0 0 400 1000" className="jet" aria-hidden="true">
      <defs>
        {/* fuselage: specular left of centre, bounce light on the right edge */}
        <linearGradient id={`${u}-fuse`} gradientUnits="userSpaceOnUse" x1="172" y1="0" x2="228" y2="0">
          <stop offset="0%" stopColor={m.rim} />
          <stop offset="8%" stopColor={m.lit} />
          <stop offset="24%" stopColor={m.spec} />
          <stop offset="40%" stopColor={m.mid} />
          <stop offset="62%" stopColor={m.shade} />
          <stop offset="82%" stopColor={m.dark} />
          <stop offset="94%" stopColor={m.deep} />
          <stop offset="100%" stopColor={m.bounce} />
        </linearGradient>

        {/* port wing — spanwise base */}
        <linearGradient id={`${u}-wingL`} gradientUnits="userSpaceOnUse" x1="40" y1="640" x2="180" y2="400">
          <stop offset="0%" stopColor={m.mid} />
          <stop offset="45%" stopColor={m.lit} />
          <stop offset="100%" stopColor={m.spec} />
        </linearGradient>
        {/* chordwise curvature overlay: bright at the leading edge */}
        <linearGradient id={`${u}-chordL`} gradientUnits="userSpaceOnUse" x1="118" y1="452" x2="92" y2="608">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.34" />
        </linearGradient>

        <linearGradient id={`${u}-wingR`} gradientUnits="userSpaceOnUse" x1="220" y1="400" x2="360" y2="640">
          <stop offset="0%" stopColor={m.shade} />
          <stop offset="55%" stopColor={m.dark} />
          <stop offset="100%" stopColor={m.deep} />
        </linearGradient>
        <linearGradient id={`${u}-chordR`} gradientUnits="userSpaceOnUse" x1="282" y1="452" x2="308" y2="608">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="48%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
        </linearGradient>

        {/* nacelles: cylindrical falloff */}
        <linearGradient id={`${u}-nacL`} gradientUnits="userSpaceOnUse" x1="138" y1="0" x2="172" y2="0">
          <stop offset="0%" stopColor={m.dark} />
          <stop offset="16%" stopColor={m.mid} />
          <stop offset="38%" stopColor={m.lit} />
          <stop offset="68%" stopColor={m.mid} />
          <stop offset="92%" stopColor={m.deep} />
          <stop offset="100%" stopColor={m.bounce} />
        </linearGradient>
        <linearGradient id={`${u}-nacR`} gradientUnits="userSpaceOnUse" x1="228" y1="0" x2="262" y2="0">
          <stop offset="0%" stopColor={m.shade} />
          <stop offset="30%" stopColor={m.mid} />
          <stop offset="70%" stopColor={m.dark} />
          <stop offset="94%" stopColor={m.deep} />
          <stop offset="100%" stopColor={m.bounce} />
        </linearGradient>

        <radialGradient id={`${u}-ao`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`${u}-radome`} gradientUnits="userSpaceOnUse" x1="176" y1="0" x2="224" y2="0">
          <stop offset="0%" stopColor={m.shade} />
          <stop offset="35%" stopColor={m.mid} />
          <stop offset="100%" stopColor={m.deep} />
        </linearGradient>
      </defs>

      {/* ---- wings ---- */}
      <g>
        <path d="M176 370 C150 400, 98 502, 44 630 Q35 643, 46 656 C94 628, 150 570, 178 554 Z" fill={`url(#${u}-wingL)`} />
        <path d="M176 370 C150 400, 98 502, 44 630 Q35 643, 46 656 C94 628, 150 570, 178 554 Z" fill={`url(#${u}-chordL)`} />
        <path d="M176 370 C150 400, 98 502, 44 630" fill="none" stroke={m.spec} strokeOpacity="0.6" strokeWidth="2.6" />
      </g>
      <g>
        <path d="M224 370 C250 400, 302 502, 356 630 Q365 643, 354 656 C306 628, 250 570, 222 554 Z" fill={`url(#${u}-wingR)`} />
        <path d="M224 370 C250 400, 302 502, 356 630 Q365 643, 354 656 C306 628, 250 570, 222 554 Z" fill={`url(#${u}-chordR)`} />
        <path d="M356 630 Q365 643, 354 656" fill="none" stroke={m.bounce} strokeOpacity="0.7" strokeWidth="2" />
      </g>

      {/* ---- horizontal stabilisers ---- */}
      <path d="M178 786 C160 800, 122 838, 96 866 Q90 874, 99 882 C128 866, 162 838, 180 828 Z" fill={`url(#${u}-wingL)`} />
      <path d="M222 786 C240 800, 278 838, 304 866 Q310 874, 301 882 C272 866, 238 838, 220 828 Z" fill={`url(#${u}-wingR)`} />

      {/* ---- vertical fin ---- */}
      <path d="M200 740 L209 894 L200 900 L191 894 Z" fill={m.mid} />
      <path d="M200 740 L204 894 L200 900 Z" fill={m.deep} opacity="0.6" />
      <path d="M200 740 L196 894 L200 900 Z" fill={m.lit} opacity="0.35" />

      {/* ---- nacelles with visible fan faces ---- */}
      <g>
        <rect x="138" y="626" width="34" height="132" rx="17" fill={`url(#${u}-nacL)`} />
        <ellipse cx="155" cy="634" rx="15" ry="7" fill={m.spec} opacity="0.85" />
        <ellipse cx="155" cy="636" rx="11.5" ry="5.5" fill="#0b0a08" />
        {[-8, -4, 0, 4, 8].map((dx) => (
          <line key={dx} x1="155" y1="636" x2={155 + dx} y2={636 + (dx === 0 ? 5 : 3)} stroke={m.mid} strokeOpacity="0.5" strokeWidth="0.9" />
        ))}
        <ellipse cx="155" cy="752" rx="13" ry="6" fill={m.deep} />
      </g>
      <g>
        <rect x="228" y="626" width="34" height="132" rx="17" fill={`url(#${u}-nacR)`} />
        <ellipse cx="245" cy="634" rx="15" ry="7" fill={m.mid} opacity="0.75" />
        <ellipse cx="245" cy="636" rx="11.5" ry="5.5" fill="#0b0a08" />
        {[-8, -4, 0, 4, 8].map((dx) => (
          <line key={dx} x1="245" y1="636" x2={245 + dx} y2={636 + (dx === 0 ? 5 : 3)} stroke={m.shade} strokeOpacity="0.5" strokeWidth="0.9" />
        ))}
        <ellipse cx="245" cy="752" rx="13" ry="6" fill={m.deep} />
      </g>

      {/* pylon occlusion */}
      <ellipse cx="172" cy="660" rx="28" ry="36" fill={`url(#${u}-ao)`} />
      <ellipse cx="228" cy="660" rx="28" ry="36" fill={`url(#${u}-ao)`} />

      {/* ---- fuselage ---- */}
      <path
        d="M200 38 C215 72, 223 126, 225 192 L225 700 C225 762, 219 812, 210 854 L190 854 C181 812, 175 762, 175 700 L175 192 C177 126, 185 72, 200 38 Z"
        fill={`url(#${u}-fuse)`}
      />
      <path d="M200 38 C215 72, 223 126, 225 192 L175 192 C177 126, 185 72, 200 38 Z" fill={`url(#${u}-radome)`} opacity="0.45" />

      {/* wing roots casting onto the fuselage */}
      <ellipse cx="182" cy="448" rx="20" ry="74" fill={`url(#${u}-ao)`} />
      <ellipse cx="219" cy="448" rx="20" ry="74" fill={`url(#${u}-ao)`} />

      {/* cockpit glazing */}
      <path d="M200 62 C209 86, 214 112, 216 140 L184 140 C186 112, 191 86, 200 62 Z" fill="#10141a" />
      <path d="M193 70 C190 92, 188 112, 187 134 L196 134 C196 110, 196 88, 197 68 Z" fill="#7fa4c4" opacity="0.45" />

      {/* panel lines */}
      {[236, 470, 612, 722].map((y) => (
        <path key={y} d={`M176 ${y} L224 ${y}`} stroke={m.deep} strokeOpacity="0.18" strokeWidth="1.4" />
      ))}

      {/* cabin windows, brighter on the lit side */}
      {Array.from({ length: 10 }).map((_, i) => {
        const y = 262 + i * 34;
        return (
          <g key={y}>
            <rect x="180" y={y} width="4" height="7.5" rx="2" fill="#161b22" opacity="0.8" />
            <rect x="216" y={y} width="4" height="7.5" rx="2" fill="#161b22" opacity="0.45" />
          </g>
        );
      })}

      {/* spine specular, tightening toward the nose */}
      <rect x="189" y="150" width="4.5" height="600" fill={m.spec} opacity="0.6" />
      <rect x="185" y="150" width="2" height="600" fill={m.spec} opacity="0.25" />
      {/* bounce rim down the shaded edge */}
      <rect x="223" y="196" width="2.4" height="530" fill={m.bounce} opacity="0.55" />

      {/* ---- landing gear ---- */}
      {gear && (
        <g>
          <rect x="196" y="188" width="8" height="26" rx="3" fill={m.deep} />
          <ellipse cx="200" cy="219" rx="8" ry="9" fill="#15161a" />
          <ellipse cx="198" cy="217" rx="4" ry="4.5" fill="#3a3d44" />

          <rect x="168" y="492" width="9" height="30" rx="3" fill={m.deep} />
          <ellipse cx="172" cy="528" rx="10" ry="11" fill="#15161a" />
          <ellipse cx="170" cy="525" rx="5" ry="5" fill="#3a3d44" />

          <rect x="223" y="492" width="9" height="30" rx="3" fill={m.deep} />
          <ellipse cx="228" cy="528" rx="10" ry="11" fill="#15161a" />
          <ellipse cx="226" cy="525" rx="5" ry="5" fill="#32353b" />
        </g>
      )}
    </svg>
  );
}
