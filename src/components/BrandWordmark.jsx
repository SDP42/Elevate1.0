/* The event's distinctive A: a solid aircraft silhouette is cut through the
   letterform, so the mark inherits whichever surface colour it sits over. */
function AviationA() {
  return (
    <svg className="brand-wordmark__a" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <mask id="aviation-a-cutout">
        <rect width="100" height="100" fill="black" />
        <path
          fill="white"
          d="M2 100 31 0h38l29 100H77L68 70H32l-9 30H2Zm36-48h24L50 14 38 52Z"
        />
        <path
          fill="black"
          d="m50 24 7 20 23 12-2 7-21-6-2 24 6 8v5l-11-6-11 6v-5l6-8-2-24-21 6-2-7 23-12 7-20Z"
        />
      </mask>
      <rect width="100" height="100" fill="currentColor" mask="url(#aviation-a-cutout)" />
    </svg>
  );
}

/** A text wordmark with the custom aviation A used in the hero and header. */
export default function BrandWordmark({ version = "1.0", uppercase = false }) {
  const first = uppercase ? "ELEV" : "Elev";
  const last = uppercase ? "TE" : "te";

  return (
    <span className="brand-wordmark" aria-label={`Elevate ${version}`}>
      <span aria-hidden="true">{first}</span>
      <AviationA />
      <span aria-hidden="true">{last}</span>
      {version && <span className="brand-wordmark__version" aria-hidden="true">{version}</span>}
    </span>
  );
}
