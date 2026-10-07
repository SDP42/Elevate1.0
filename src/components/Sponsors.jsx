import { SPONSORS } from "../config";

const COLUMNS = 3;

function chunk(items, size) {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/* The tile row on the back of the boarding pass — sponsors in rows of
   three, each a plain card linking out to its own site. Grouped by row
   (rather than one flat grid) so a short trailing row — e.g. 2 of 8 —
   splits its width evenly between however many tiles it has, instead of
   sitting in two of three same-size grid columns with an empty gap. Any
   tile may carry a perks list (CodeCrafters' VIP membership breakdown);
   tiles without one just stop at the name. */
export default function Sponsors() {
  const rows = chunk(SPONSORS, COLUMNS);
  return (
    <div className="sponsors__list">
      {rows.map((row, i) => (
        <div className="sponsors__row" key={i}>
          {row.map((s) => {
            const Card = s.url ? "a" : "div";
            return (
              <Card
                key={s.name}
                className="sponsors__card"
                href={s.url || undefined}
                target={s.url ? "_blank" : undefined}
                rel={s.url ? "noopener noreferrer" : undefined}
                aria-label={`${s.role}: ${s.name}`}
              >
                <span className="sponsors__role">{s.role}</span>
                {s.showName ? (
                  <span className="sponsors__lockup">
                    <img className="sponsors__logo" src={s.logo} alt="" />
                    <span className={`sponsors__name${s.name === "ARINA AI" ? " sponsors__name--arina" : ""}`}>
                      {s.name}
                    </span>
                  </span>
                ) : (
                  <img className="sponsors__logo" src={s.logo} alt={s.name} />
                )}
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
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
