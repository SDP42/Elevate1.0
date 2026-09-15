/* What the finale includes, taken straight from the event schedule. */
const PERKS = [
  {
    title: "Fed through the flight",
    desc: "Lunch, high tea and dinner on day one, midnight snacks, then breakfast and lunch on day two.",
  },
  {
    title: "Mentoring session",
    desc: "Mentors sit with teams after dinner, while there is still a night left to change course.",
  },
  {
    title: "Jamming session",
    desc: "A late-night break with music and midnight snacks, before the push to landing.",
  },
  {
    title: "Certificates & goodies",
    desc: "Winners take home cash, certificates and goodies. Every finalist team gets a participation certificate.",
  },
];

export default function Experience() {
  return (
    <section id="perks" data-label="Perks" className="experience">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="eyebrow">Perks</span>
          <h2 className="section-title">What the ticket gets you.</h2>
        </div>
        <div className="experience__grid" data-reveal="stagger">
          {PERKS.map((f, i) => (
            <div key={f.title} className="experience__item">
              <span className="experience__index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="experience__title">{f.title}</h3>
              <p className="experience__desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
