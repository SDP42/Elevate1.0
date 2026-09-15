import { useEffect, useRef, useState } from "react";
import useScrollProgress, { range } from "../hooks/useScrollProgress";
import { prefersReducedMotion } from "../hooks/useInView";
import { cue } from "../audio/bus";
import { CabinWall, CabinSeats, CabinDesk } from "./CabinInterior";
import RegisterButton from "./RegisterButton";
import { EVENT } from "../config";

/* Shade lifts once the boarding screen is out of the way: longer on a first
   visit (preloader showing), almost immediate on a return visit. */
function useShadeOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let boarded = false;
    try {
      boarded = Boolean(sessionStorage.getItem("elevate-boarded"));
    } catch {
      /* storage blocked: assume first visit */
    }
    const delay = prefersReducedMotion() ? 0 : boarded ? 500 : 3000;
    const id = setTimeout(() => setOpen(true), delay);
    return () => clearTimeout(id);
  }, []);
  return open;
}

/* Normalised pointer position (-1..1), eased, desktop pointers only. */
function usePointerParallax() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || prefersReducedMotion()) return;
    let frame = null;
    let cur = { x: 0, y: 0 };

    const onMove = (e) => {
      target.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    const loop = () => {
      cur = {
        x: cur.x + (target.current.x - cur.x) * 0.08,
        y: cur.y + (target.current.y - cur.y) * 0.08,
      };
      setPos(cur);
      frame = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    frame = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return pos;
}

export default function Hero() {
  const [heroRef, p] = useScrollProgress();
  const shadeOpen = useShadeOpen();
  const pointer = usePointerParallax();

  // Exponential growth reads as constant velocity toward the aperture.
  // Nearer planes travel faster: seats > cabin > clouds > sky.
  // Each curve is clamped past the point its layer has faded out — an
  // unbounded scale allocates a texture far larger than the GPU can hold.
  // The whole fly-through is compressed into the first 44% of the section.
  // Everything after that is open sky, so the cloud flight holds for a long
  // stretch of scrolling before the next section arrives.
  const APPROACH = 0.44;
  const a = range(p, 0, APPROACH);

  const deskScale = Math.exp(Math.min(a, 0.7) * Math.log(22));
  const seatScale = Math.exp(Math.min(a, 0.82) * Math.log(14));
  const cabinScale = Math.exp(a * Math.log(9));

  const deskFade = 1 - range(a, 0.24, 0.58);
  const seatFade = 1 - range(a, 0.38, 0.74);
  const cabinFade = 1 - range(a, 0.74, 0.99);
  const copyOpacity = 1 - range(a, 0, 0.42);

  // seatbelt sign is lit while still inside the cabin, switches off once
  // the aircraft reaches open sky
  const beltOn = shadeOpen && a < 0.34;
  const beltWasOn = useRef(false);
  useEffect(() => {
    if (beltWasOn.current && !beltOn) cue("chime");
    beltWasOn.current = beltOn;
  }, [beltOn]);

  // parallax fades out as the camera commits to the window
  const par = 1 - range(a, 0, 0.3);
  const px = pointer.x * par;
  const py = pointer.y * par;

  // light chop while pushing through the window into cloud
  const chop = range(a, 0.5, 0.8) * (1 - range(a, 0.92, 1));
  const shakeX = Math.sin(p * 980) * 5 * chop;
  const shakeY = Math.cos(p * 1330) * 4 * chop;

  const layer = (depth, scale) =>
    `translate(${px * depth + shakeX}px, ${py * depth * 0.6 + shakeY}px) scale(${scale})`;

  return (
    <section id="top" data-label="Cabin" ref={heroRef} className="hero">
      <div className="hero__sticky">
        {/* mid plane — cabin sidewall with the window well */}
        <div
          className="hero__cabin"
          style={{ transform: layer(-8, cabinScale), opacity: cabinFade }}
        >
          <CabinWall shadeOpen={shadeOpen} beltOn={beltOn} />
        </div>

        {/* near plane — seat backs framing the shot */}
        <div
          className="hero__seats"
          style={{ transform: layer(-22, seatScale), opacity: seatFade }}
        >
          <CabinSeats />
        </div>

        {/* nearest plane — tray table, passes the camera first */}
        <div
          className="hero__desk"
          style={{ transform: layer(-34, deskScale), opacity: deskFade }}
        >
          <CabinDesk typing={shadeOpen} />
        </div>

        {/* copy flanks the window rather than stacking over it */}
        <div className="hero__left" style={{ opacity: copyOpacity }}>
          <span className="eyebrow">24-Hour Hackathon</span>
          <h1 className="hero__title">
            Elevate <span className="hero__ver">1.0</span>
          </h1>
          <p className="hero__sub">
            An online qualifier, then twenty-four hours on campus for the
            thirty teams that make it.
          </p>
          <p className="hero__org">
            by {EVENT.organiser} · {EVENT.college}, {EVENT.city}
          </p>
        </div>

        <div className="hero__right" style={{ opacity: copyOpacity }}>
          <ul className="hero__meta">
            <li>
              <span>Dates</span>
              <strong>10 &amp; 11 Oct</strong>
            </li>
            <li>
              <span>Duration</span>
              <strong>24 hours</strong>
            </li>
            <li>
              <span>Teams</span>
              <strong>2 – 4</strong>
            </li>
            <li>
              <span>Domains</span>
              <strong>Revealed soon</strong>
            </li>
          </ul>

          <RegisterButton className="hero__cta">
            Register your team
          </RegisterButton>
        </div>

        {/* the brief arrives at the tail of the cloud flight, inside the same
            sticky frame — a separate section would reintroduce a seam */}
        <div
          className="hero__brief"
          style={{
            opacity: range(p, 0.58, 0.72) * (1 - range(p, 0.94, 1)),
            // keep the centring in the inline value: transform replaces,
            // it does not merge with the rule in the stylesheet
            transform: `translate(-50%, -50%) translateY(${
              (1 - range(p, 0.58, 0.78)) * 40
            }px)`,
          }}
        >
          <span className="eyebrow">The brief</span>
          <p className="hero__briefText">
            Elevate 1.0 runs in two rounds. Everyone starts online; the thirty
            teams that qualify come to campus for twenty-four continuous hours.
            You arrive with an idea and a team, and you leave with something
            that runs.
          </p>
          <p className="hero__briefOrg">
            Organised by {EVENT.organiser}, the {EVENT.department} committee at{" "}
            {EVENT.college}, {EVENT.city}.
          </p>
        </div>
      </div>
    </section>
  );
}
