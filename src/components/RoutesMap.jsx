/* Eligibility, told as the passenger list: who can board, in what crew. */

const BRANCHES = [
  "Computer Engineering",
  "Information Technology",
  "AI & Data Science",
  "AI & Machine Learning",
  "Computer Science & Engineering",
  "Electronics & Telecommunication",
  "Electronics",
  "Electrical",
  "Mechanical",
  "Civil",
  "Chemical",
  "Production",
  "Biotechnology",
  "Design",
];

const RULES = [
  { k: "Branch", v: "Any branch", note: "Engineering or not — every discipline is welcome." },
  { k: "Year", v: "Any year", note: "First-years fly alongside final-years." },
  { k: "Crew", v: "2 – 4 members", note: "Cross-branch teams are encouraged." },
];

function DotGlobe() {
  const dots = [];
  const rows = 26;
  const cols = 52;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = c / cols - 0.5;
      const ny = r / rows - 0.5;
      const d = Math.sqrt(nx * nx * 4 + ny * ny * 4);
      if (d < 0.98 && (r * 7 + c * 13) % 3 !== 0) {
        dots.push([c * 11, r * 11]);
      }
    }
  }
  return (
    <svg viewBox="0 0 572 286" className="routes__globe" aria-hidden="true">
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill="currentColor" />
      ))}
    </svg>
  );
}

export default function RoutesMap() {
  return (
    <section id="who" data-label="Who flies" className="routes">
      <DotGlobe />
      <div className="container routes__content">
        <div className="routes__head" data-reveal>
          <span className="eyebrow">Who flies</span>
          <h2 className="section-title">Open to every branch.</h2>
          <p className="routes__copy">
            You do not need to be a computer science student to build something
            worth showing. If you can bring an idea and a crew, there is a seat
            for you.
          </p>
        </div>

        <ul className="routes__rules" data-reveal="stagger">
          {RULES.map((r) => (
            <li key={r.k} className="routes__rule">
              <span className="routes__ruleK">{r.k}</span>
              <strong className="routes__ruleV">{r.v}</strong>
              <span className="routes__ruleNote">{r.note}</span>
            </li>
          ))}
        </ul>

        <div className="routes__manifest" data-reveal>
          <span className="routes__manifestHead">On the passenger list</span>
          <ul className="routes__cities">
            {BRANCHES.map((c) => (
              <li key={c} className="routes__city">
                {c}
              </li>
            ))}
            <li className="routes__city routes__city--more">+ every other branch</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
