/* Fractal-noise cloud field. Shared so the hero fly-through and the sections
   that follow it render the same sky rather than looking like separate views. */
export default function Clouds({ seed, freq, octaves, className }) {
  const fid = `cloud-${seed}`;
  return (
    <svg
      className={className}
      viewBox="0 0 800 500"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <filter id={fid} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency={freq}
          numOctaves={octaves}
          seed={seed}
          stitchTiles="stitch"
        />
        <feColorMatrix
          values="0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 0 1
                  2.4 0 0 0 -0.92"
        />
      </filter>
      <rect width="800" height="500" filter={`url(#${fid})`} />
    </svg>
  );
}
