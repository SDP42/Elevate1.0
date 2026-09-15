const FACTS = [
  { label: "Team size", value: "2–4 members" },
  { label: "Domains", value: "Revealed soon" },
  { label: "Entry", value: "Free to register" },
  { label: "Eligibility", value: "All branches, all years" },
];

export default function Tracks() {
  return (
    <section id="tracks" data-label="Domains" className="tracks">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="eyebrow">Domains</span>
          <h2 className="section-title">Runways announced shortly.</h2>
        </div>

        <div className="tracks__reveal" data-reveal="stagger">
          <div className="tracks__revealMain">
            <span className="tracks__revealTag">Coming soon</span>
            <p className="tracks__revealCopy">
              The problem domains for Elevate 1.0 are still being finalised.
              They drop here before the gates open on 10 October — register now
              and you will hear first.
            </p>
          </div>

          <ul className="tracks__facts">
            {FACTS.map((f) => (
              <li key={f.label}>
                <span className="tracks__specLabel">{f.label}</span>
                <span className="tracks__specValue">{f.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
