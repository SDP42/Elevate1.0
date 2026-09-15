/* In-flight safety card, hackathon edition. Airline safety-card visual
   language — numbered panels, flat pictograms, one accent colour — applied
   to the rules people actually need at 3am. */

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const CARDS = [
  {
    n: "01",
    title: "Hydrate",
    note: "Water is on every floor. Use it.",
    art: (
      <>
        <path d="M26 16 h12 v6 l4 6 v26 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4 v-26 l4 -6 z" {...S} />
        <path d="M22 40 h20" {...S} />
        <path d="M29 10 h6" {...S} />
      </>
    ),
  },
  {
    n: "02",
    title: "Commit often",
    note: "Small commits survive bad decisions.",
    art: (
      <>
        <circle cx="18" cy="46" r="5" {...S} />
        <circle cx="32" cy="30" r="5" {...S} />
        <circle cx="46" cy="14" r="5" {...S} />
        <path d="M21 42 L29 34" {...S} />
        <path d="M35 26 L43 18" {...S} />
        <path d="M32 35 v11" {...S} />
      </>
    ),
  },
  {
    n: "03",
    title: "Back it up",
    note: "Push to remote before you sleep.",
    art: (
      <>
        <path d="M20 40 a9 9 0 0 1 2 -17 a12 12 0 0 1 22 4 a8 8 0 0 1 -2 13 z" {...S} />
        <path d="M32 32 v18" {...S} />
        <path d="M26 44 l6 6 l6 -6" {...S} />
      </>
    ),
  },
  {
    n: "04",
    title: "Rest counts",
    note: "Sleep is optional. It is not advisable.",
    art: (
      <>
        <path d="M14 48 h36" {...S} />
        <circle cx="26" cy="38" r="6" {...S} />
        <path d="M20 48 a10 10 0 0 1 20 0" {...S} />
        <path d="M40 14 h8 l-8 10 h8" {...S} />
      </>
    ),
  },
  {
    n: "05",
    title: "Ask a mentor",
    note: "Two rounds scheduled. Use both.",
    art: (
      <>
        <circle cx="22" cy="22" r="6" {...S} />
        <path d="M12 46 a10 10 0 0 1 20 0" {...S} />
        <circle cx="44" cy="26" r="5" {...S} />
        <path d="M36 46 a8 8 0 0 1 16 0" {...S} />
      </>
    ),
  },
  {
    n: "06",
    title: "Ship on time",
    note: "Submissions close 11:00 on day two.",
    art: (
      <>
        <circle cx="32" cy="32" r="18" {...S} />
        <path d="M32 20 v13 l9 6" {...S} />
      </>
    ),
  },
];

export default function SafetyCard() {
  return (
    <section id="safety" data-label="Safety briefing" className="safety">
      <div className="container">
        <div className="safety__head" data-reveal>
          <span className="eyebrow">Cabin briefing</span>
          <h2 className="safety__title">In-flight safety card</h2>
          <p className="safety__sub">
            Please review before departure. Located in the seat pocket in front
            of you.
          </p>
        </div>

        <div className="safety__grid" data-reveal="stagger">
          {CARDS.map((c) => (
            <article key={c.n} className="safety__card">
              <span className="safety__n">{c.n}</span>
              <svg viewBox="0 0 64 60" className="safety__art" aria-hidden="true">
                {c.art}
              </svg>
              <h3 className="safety__cardTitle">{c.title}</h3>
              <p className="safety__note">{c.note}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
