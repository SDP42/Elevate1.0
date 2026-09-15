import { useEffect, useState } from "react";
import { METALS } from "./Jet";
import useInView, { prefersReducedMotion } from "../hooks/useInView";

/* Prize tiers presented as pilot wings — a rank badge reads as an award in a
   way a plain card never does, and it keeps the aviation language running
   through the most important section on the page. */

function Wings({ metal, rank, id }) {
  const m = METALS[metal] ?? METALS.silver;
  const u = `w-${id}`;

  return (
    <svg viewBox="0 0 240 96" className="wings" aria-hidden="true">
      <defs>
        <linearGradient id={`${u}-p`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="96">
          <stop offset="0%" stopColor={m.lit} />
          <stop offset="42%" stopColor={m.mid} />
          <stop offset="72%" stopColor={m.shade} />
          <stop offset="100%" stopColor={m.dark} />
        </linearGradient>
        <linearGradient id={`${u}-s`} gradientUnits="userSpaceOnUse" x1="96" y1="14" x2="144" y2="86">
          <stop offset="0%" stopColor={m.spec} />
          <stop offset="38%" stopColor={m.lit} />
          <stop offset="76%" stopColor={m.mid} />
          <stop offset="100%" stopColor={m.shade} />
        </linearGradient>
      </defs>

      {/* wings — three feather tiers each side */}
      {[0, 1].map((side) => {
        const f = side === 0 ? 1 : -1;
        const ox = side === 0 ? 0 : 240;
        return (
          <g key={side} transform={`translate(${ox} 0) scale(${f} 1)`}>
            <g className="wings__side">
            <path
              d="M104 40 C84 30, 52 24, 14 32 C46 40, 76 46, 102 48 Z"
              fill={`url(#${u}-p)`}
            />
            <path
              d="M104 50 C86 44, 58 42, 26 48 C56 54, 80 58, 102 57 Z"
              fill={`url(#${u}-p)`}
              opacity="0.88"
            />
            <path
              d="M104 60 C88 56, 66 56, 42 61 C66 66, 86 68, 102 66 Z"
              fill={`url(#${u}-p)`}
              opacity="0.72"
            />
            {/* feather separations */}
            <g stroke={m.deep} strokeOpacity="0.4" strokeWidth="1">
              <path d="M96 41 L54 32" />
              <path d="M88 43 L62 36" />
              <path d="M96 51 L60 47" />
              <path d="M96 61 L64 60" />
            </g>
            </g>
          </g>
        );
      })}

      {/* central shield */}
      <path
        d="M120 12 L146 22 L146 52 C146 70, 134 80, 120 86 C106 80, 94 70, 94 52 L94 22 Z"
        fill={`url(#${u}-s)`}
        stroke={m.deep}
        strokeOpacity="0.45"
        strokeWidth="1.2"
      />
      <path
        d="M120 18 L140 26 L140 51 C140 65, 131 74, 120 79 C109 74, 100 65, 100 51 L100 26 Z"
        fill="none"
        stroke={m.deep}
        strokeOpacity="0.3"
        strokeWidth="1"
      />
      <text
        x="120"
        y="58"
        textAnchor="middle"
        fill={m.deep}
        fontSize="30"
        fontWeight="700"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        {rank}
      </text>
    </svg>
  );
}

const TIERS = [
  {
    key: "second",
    metal: "silver",
    rank: "2",
    place: "Runner-up",
    amount: "₹30,000",
    perks: ["Cash prize", "Winner certificates", "Goodies"],
  },
  {
    key: "first",
    metal: "gold",
    rank: "1",
    place: "Champions",
    amount: "₹50,000",
    perks: ["Cash prize", "Winner certificates", "Goodies", "Featured by DJS NSDC"],
    lead: true,
  },
  {
    key: "third",
    metal: "bronze",
    rank: "3",
    place: "Second runner-up",
    amount: "₹20,000",
    perks: ["Cash prize", "Winner certificates", "Goodies"],
  },
];

function useCountUp(target, run, ms = 1800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) {
      setValue(0);
      return;
    }
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min((now - t0) / ms, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(Math.round(target * eased));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, run, ms]);
  return value;
}

export default function PrizeBoard() {
  const [totalRef, seen] = useInView(0.5);
  const total = useCountUp(100000, seen);

  return (
    <section id="prizeboard" data-label="Prize pool" className="board">
      <div className="container">
        <div className="board__head" data-reveal>
          <span className="eyebrow">Prize pool</span>
          <div ref={totalRef} className="board__total" aria-label="₹1,00,000">
            <span className="board__cur">₹</span>
            <span className="board__amt">{total.toLocaleString("en-IN")}</span>
          </div>
          <p className="board__sub">
            Split across three podium places, awarded at the close of the final
            judging round on 11 October.
          </p>
        </div>

        <div className="board__tiers" data-reveal="stagger">
          {TIERS.map((t) => (
            <article
              key={t.key}
              className={`board__tier ${t.lead ? "board__tier--lead" : ""}`}
            >
              <Wings metal={t.metal} rank={t.rank} id={t.key} />
              <span className="board__place">{t.place}</span>
              <strong className="board__amount">{t.amount}</strong>
              <ul className="board__perks">
                {t.perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="board__note">
          <span className="board__noteMark" aria-hidden="true">
            ✦
          </span>
          <p>
            All <strong>30 finalist teams</strong> receive participation
            certificates. Shortlisting happens after the online qualifier.
          </p>
        </div>
      </div>
    </section>
  );
}
