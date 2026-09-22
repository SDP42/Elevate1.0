import { SPONSORS } from "../config";

/* The tile row on the back of the boarding pass — up to three sponsors
   side by side, each a plain card linking out to its own site. Any tile
   may carry a perks list (CodeCrafters' VIP membership breakdown); tiles
   without one just stop at the name. */
export default function Sponsors() {
  return (
    <div className="sponsors__list">
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
          {s.perks && (
            <ul className="sponsors__perks">
              {s.perks.map(([place, perk]) => (
                <li key={place}>
                  <span>{place}</span>
                  <strong>{perk}</strong>
                </li>
              ))}
            </ul>
          )}
        </a>
      ))}
    </div>
  );
}
