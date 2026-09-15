import useInView from "../hooks/useInView";

/* Two-stage format as a connecting-flight itinerary: an online qualifying leg,
   a connection where thirty teams are shortlisted, then the offline grand
   finale on campus. */

const LEGS = [
  {
    tag: "Leg 1",
    mode: "Online",
    title: "Qualifier round",
    desc:
      "Register and submit online. Open to every team — no shortlisting to get this far.",
    facts: [
      ["Format", "Online submission"],
      ["Open to", "All teams"],
      ["Outcome", "Top 30 advance"],
    ],
  },
  {
    tag: "Leg 2",
    mode: "On campus",
    title: "Grand finale",
    desc:
      "Thirty shortlisted teams build on site for twenty-four continuous hours.",
    facts: [
      ["Format", "24-hour offline"],
      ["Dates", "10 & 11 October"],
      ["Venue", "DJ Sanghvi, Mumbai"],
    ],
    lead: true,
  },
];

function PlaneMark() {
  return (
    <svg viewBox="0 0 24 24" className="rounds__plane" aria-hidden="true">
      <path
        d="M2 13 H15 L11 6 H14 L21 13 L14 20 H11 L15 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Rounds() {
  const [routeRef, drawn, from] = useInView(0.6);

  return (
    <section id="rounds" data-label="Itinerary" className="rounds">
      <div className="container">
        <div className="rounds__head" data-reveal>
          <span className="eyebrow">Itinerary</span>
          <h2 className="section-title">Two legs to the finale.</h2>
          <p className="rounds__sub">
            Elevate 1.0 runs in two rounds. Everyone flies the first leg
            online; thirty teams make the connection to the grand finale on
            campus.
          </p>
        </div>

        <div
          ref={routeRef}
          className={`rounds__route ${drawn ? "is-drawn" : ""} ${from === "top" ? "from-top" : ""}`}
          aria-hidden="true"
        >
          <span className="rounds__node rounds__node--on" />
          <span className="rounds__path" />
          <span className="rounds__connect">
            <PlaneMark />
            <em>30 teams shortlisted</em>
          </span>
          <span className="rounds__path" />
          <span className="rounds__node rounds__node--on" />
        </div>

        <div className="rounds__legs" data-reveal="stagger">
          {LEGS.map((l) => (
            <article
              key={l.tag}
              className={`rounds__leg ${l.lead ? "rounds__leg--lead" : ""}`}
            >
              <header className="rounds__legHead">
                <span className="rounds__tag">{l.tag}</span>
                <span className="rounds__mode">{l.mode}</span>
              </header>

              <h3 className="rounds__title">{l.title}</h3>
              <p className="rounds__desc">{l.desc}</p>

              <dl className="rounds__facts">
                {l.facts.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
