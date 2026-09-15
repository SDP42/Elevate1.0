const STATS = [
  { value: "24", label: "Hours on the clock" },
  { value: "₹1L", label: "Total prize pool" },
  { value: "30", label: "Finalist teams" },
  { value: "15", label: "Mentors on site" },
];

const COLLEGES = [
  "Computer Science",
  "Information Technology",
  "Electronics",
  "Mechanical",
  "Design",
  "Data Science",
  "Electrical",
  "Civil",
  "Biotech",
  "MBA",
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
    <section id="about" data-label="Who flies" className="routes">
      <DotGlobe />
      <div className="container routes__content">
        <span className="eyebrow">Who flies</span>
        <h2 className="section-title">Open to every branch.</h2>
        <p className="routes__copy">
          You do not need to be a computer science student to build something
          worth showing. Teams of two to four, any discipline, any year.
        </p>
        <div className="routes__stats" data-reveal="stagger">
          {STATS.map((s) => (
            <div key={s.label} className="routes__stat">
              <div className="routes__value">{s.value}</div>
              <div className="routes__label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="routes__cities">
          {COLLEGES.map((c) => (
            <span key={c} className="routes__city">
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
