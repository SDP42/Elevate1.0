import { SPONSORS } from "../config";

/* Sits between the boarding pass and the FAQ: the logo is dark artwork, so
   it rests on a cream card against the dark seam between the two. */
export default function Sponsors() {
  return (
    <section id="sponsors" data-label="Partners" className="sponsors">
      <div className="container">
        <div className="sponsors__head" data-reveal>
          <span className="eyebrow">Our partners</span>
        </div>
        <div className="sponsors__list" data-reveal>
          {SPONSORS.map((s) => (
            <a
              key={s.name}
              className="sponsors__card"
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${s.role}: ${s.name}`}
            >
              <span className="sponsors__role">{s.role}</span>
              <img className="sponsors__logo" src={s.logo} alt={s.name} />
              <span className="sponsors__name">Winners receive CodeCrafters VIP memberships</span>
              <ul className="sponsors__perks">
                {s.perks.map(([place, perk]) => (
                  <li key={place}>
                    <span>{place}</span>
                    <strong>{perk}</strong>
                  </li>
                ))}
              </ul>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
