import Clouds from "./Clouds";
import Runway3D from "./Runway3D";
import useScrollProgress, { range, easeInOut } from "../hooks/useScrollProgress";
import { TOUCHDOWN, landingT } from "../landing";

const PRIZES = [
  { key: "second", rw: "24L", place: "2nd Place", value: 30000 },
  { key: "first", rw: "24C", place: "1st Place", value: 50000 },
  { key: "third", rw: "24R", place: "3rd Place", value: 20000 },
];

export default function PrizeFleet() {
  const [ref, p] = useScrollProgress();

  // one progress value drives all three aircraft, so they land together
  const t = landingT(p);

  const deck = 1 - range(t, 0.12, 0.42);
  const settle = range(t, TOUCHDOWN + 0.06, 0.96);
  const handoff = range(p, 0.9, 1);
  const headOpacity = range(p, 0.01, 0.08);

  return (
    <section id="prizes" data-label="Final approach" ref={ref} className="prizes">
      <div className="land">
        {/* grass is painted flat in screen space: a textured 3D plane wide
            enough to reach the screen edges overruns the GPU tile budget,
            and the browser silently drops parts of it */}
        <div className="land__grass" />

        {/* real 3D airfield: front-on while the aircraft are airborne, then
            the camera rises to an elevated view over the tails once they've
            landed — the flat top-view icon couldn't give either angle */}
        <Runway3D t={t} />

        {/* haze where the ground meets the sky */}
        <div className="land__haze" />

        {/* the cloud deck the aircraft descend through */}
        <div className="land__deck" style={{ opacity: deck }}>
          <Clouds seed={77} freq="0.009" octaves="4" className="land__deckClouds" />
        </div>

        <div className="land__head" style={{ opacity: headOpacity }}>
          <span className="eyebrow">Prize pool</span>
          <h2 className="land__title">₹1,00,000 on the table</h2>
        </div>

        <div className="land__labels">
          {PRIZES.map((z) => (
            <div
              key={z.key}
              className={`land__label land__label--${z.key}`}
              style={{
                opacity: settle,
                transform: `translateY(${(1 - settle) * 22}px)`,
              }}
            >
              <span className="land__place">
                {z.place} · {z.rw}
              </span>
              <strong className="land__amount">
                ₹{Math.round(z.value * easeInOut(settle)).toLocaleString("en-IN")}
              </strong>
            </div>
          ))}
        </div>

        <div className="land__handoff" style={{ opacity: easeInOut(handoff) }} />
      </div>
    </section>
  );
}
