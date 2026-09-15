const PERKS = [
  {
    title: "Mentors on the floor",
    desc: "Fifteen mentors rotating through the night across all three tracks.",
  },
  {
    title: "Fed for 24 hours",
    desc: "Dinner, midnight chai, and breakfast — nobody debugs on an empty stomach.",
  },
  {
    title: "Hardware bench",
    desc: "Boards, sensors, and cables available to borrow through the event.",
  },
  {
    title: "Demo day audience",
    desc: "Final pitches run in front of judges, faculty, and visiting recruiters.",
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
