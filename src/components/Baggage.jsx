/* Baggage allowance: what to carry on, what to leave at the gate. Shares the
   safety card's pictogram language so the two read as one briefing set. */

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const CARRY = [
  {
    label: "Laptop & charger",
    art: (
      <>
        <rect x="12" y="16" width="40" height="26" rx="3" {...S} />
        <path d="M6 48 h52" {...S} />
        <path d="M18 42 l-4 6 M46 42 l4 6" {...S} />
      </>
    ),
  },
  {
    label: "Extension board",
    art: (
      <>
        <rect x="10" y="24" width="34" height="16" rx="4" {...S} />
        <path d="M18 30 v4 M26 30 v4 M34 30 v4" {...S} />
        <path d="M44 32 h10 a4 4 0 0 1 4 4 v8" {...S} />
      </>
    ),
  },
  {
    label: "College ID",
    art: (
      <>
        <rect x="12" y="14" width="40" height="34" rx="4" {...S} />
        <circle cx="25" cy="27" r="5" {...S} />
        <path d="M18 40 a7 7 0 0 1 14 0" {...S} />
        <path d="M38 24 h10 M38 32 h10" {...S} />
      </>
    ),
  },
  {
    label: "Water bottle",
    art: (
      <>
        <path d="M26 16 h12 v5 l3 5 v22 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 v-22 l3 -5 z" {...S} />
        <path d="M29 11 h6" {...S} />
      </>
    ),
  },
  {
    label: "Headphones",
    art: (
      <>
        <path d="M16 36 v-4 a16 16 0 0 1 32 0 v4" {...S} />
        <rect x="10" y="34" width="9" height="14" rx="4" {...S} />
        <rect x="45" y="34" width="9" height="14" rx="4" {...S} />
      </>
    ),
  },
  {
    label: "Any hardware you need",
    art: (
      <>
        <rect x="16" y="18" width="32" height="28" rx="3" {...S} />
        <path d="M24 26 h16 M24 34 h10" {...S} />
        <path d="M16 24 h-6 M16 40 h-6 M48 24 h6 M48 40 h6" {...S} />
      </>
    ),
  },
];

const LEAVE = [
  "Work written before the event begins",
  "A project already submitted elsewhere",
  "Scope you cannot demo in 24 hours",
];

export default function Baggage() {
  return (
    <section id="baggage" data-label="Baggage allowance" className="bag">
      <div className="container bag__grid">
        <div className="bag__carry" data-reveal>
          <span className="eyebrow">Baggage allowance</span>
          <h2 className="bag__title">Pack this.</h2>

          <ul className="bag__list">
            {CARRY.map((c) => (
              <li key={c.label} className="bag__item">
                <svg viewBox="0 0 64 60" className="bag__art" aria-hidden="true">
                  {c.art}
                </svg>
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
          <div className="bag__belt" aria-hidden="true">
            <span className="bag__rollers" />
          </div>
        </div>

        <aside className="bag__tag">
          <div className="bag__tagHole" />
          <span className="bag__tagLabel">Restricted</span>
          <h3 className="bag__tagTitle">Leave at the gate</h3>
          <ul className="bag__leave">
            {LEAVE.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <div className="bag__tagCode">EL·100 · 10 OCT</div>
        </aside>
      </div>
    </section>
  );
}
