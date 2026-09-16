import { useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger, BREAKPOINT, charReveal, lineReveal, childReveal } from "./motion";
import { JetPhoto, JetBlueprint, SEAT_ROWS } from "./JetArt";

const SEATS = SEAT_ROWS * 2;

const PRIZES = [
  { place: "1st place", amount: "₹50,000" },
  { place: "2nd place", amount: "₹30,000" },
  { place: "3rd place", amount: "₹20,000" },
];

// the road to the finale, exactly as issued
const TIMELINE = [
  ["16 Sep", "", "Registration starts"],
  ["17 Sep", "", "Online PS round"],
  ["30 Sep", "11:59 PM", "Registration deadline"],
  ["1 Oct", "11:59 PM", "Submission deadline"],
  ["3 Oct", "12:21 PM", "Shortlisted teams announced"],
  ["10 Oct", "", "Hackathon starts"],
  ["11 Oct", "", "Hackathon ends"],
];

function Schedule({ rows, phase }) {
  return (
    <ol className="jx-sched" data-phase={phase}>
      {rows.map(([date, time, what]) => (
        <li className="jx-sched__row" key={what}>
          <div className="jx-line-h jx-line-h--ink" />
          <div className="jx-u12" />
          <div className="jx-sched__line">
            <span className="jx-sched__time">{date}</span>
            <span className="jx-sched__what">
              {what}
              {time && <em className="jx-sched__at">{time}</em>}
            </span>
          </div>
          <div className="jx-u12" />
        </li>
      ))}
    </ol>
  );
}

/* Runways stand in for tracks until they are announced: painted strips with
   threshold bars and a dashed centreline, marked "to be announced". */
function Runways() {
  return (
    <ol className="jx-sched jx-runways" data-phase="2">
      {[0, 1, 2].map((i) => (
        <li className="jx-sched__row jx-runway" key={i}>
          <svg viewBox="0 0 320 44" className="jx-runway__strip" aria-hidden="true">
            <rect x="0" y="4" width="320" height="36" rx="4" fill="#3a3230" />
            {[0, 1, 2, 3].map((k) => (
              <rect key={k} x={10} y={9 + k * 7.5} width="18" height="4" fill="#efe6da" />
            ))}
            {[0, 1, 2, 3].map((k) => (
              <rect key={`e${k}`} x={292} y={9 + k * 7.5} width="18" height="4" fill="#efe6da" />
            ))}
            {Array.from({ length: 9 }).map((_, k) => (
              <rect key={`c${k}`} x={44 + k * 26} y="20.5" width="14" height="3" fill="#efe6da" opacity="0.8" />
            ))}
          </svg>
          <div className="jx-runway__label">
            <span className="jx-l1">RWY {String(i + 1).padStart(2, "0")}</span>
            <span className="jx-l1 jx-gray">Track to be announced</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* Prize pool, then the two-day schedule, then the finale cabin.
   One jet carries the section: it rises into frame as the prize pool is
   revealed, shrinks toward the top as the schedule slides in (10 October
   first, 11 October second), and finally turns into a cabin plan whose
   thirty empty seats are the thirty finalist places still up for grabs. */
export default function JetSection() {
  const root = useRef(null);

  useLayoutEffect(() => {
    const el = root.current;
    const $ = (s) => el.querySelector(s);
    const header = document.querySelector("[data-jx-header]");
    let disposed = false;

    const ctx = gsap.context((self) => {
      self.add("build", () => {
        const area = $("[data-jet-area]");

        // the cream wash takes over from the sky
        gsap.fromTo($("[data-light-bg]"), { opacity: 0 }, {
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: area, start: "top top", end: "center center", scrub: true },
        });

        // keep the site's floating chrome out of this section too
        ScrollTrigger.create({
          trigger: el,
          start: "top bottom",
          end: "bottom 60%",
          onToggle: (st) => document.documentElement.classList.toggle("in-jet", st.isActive),
        });

        // dark header over the light section
        ScrollTrigger.create({
          trigger: area,
          start: "top top-=75%",
          end: "bottom top",
          onToggle: (st) => header?.classList.toggle("jx-header--ink", st.isActive),
        });

        // prize copy arrives as the section does
        el.querySelectorAll("[data-jet-chars]").forEach((t) => {
          const tween = charReveal(t, { paused: true });
          ScrollTrigger.create({ trigger: t, start: "top bottom", once: true, onEnter: () => tween.play() });
        });
        el.querySelectorAll("[data-jet-lines]").forEach((t) => {
          const tween = lineReveal(t, { paused: true });
          ScrollTrigger.create({ trigger: t, start: "top bottom", once: true, onEnter: () => tween.play() });
        });
        el.querySelectorAll("[data-jet-divs]").forEach((t) => {
          const tween = childReveal(t, { paused: true });
          ScrollTrigger.create({ trigger: t, start: "top bottom", once: true, onEnter: () => tween.play() });
        });

        const seats = el.querySelectorAll(".jx-seat");
        const box = $("[data-jet-box]");
        const badge = $("[data-seat-badge]");

        // photo gives way to the cabin plan, seats lighting tail-first as it passes
        const cabinReveal = (trigger) => {
          gsap.fromTo(box, { "--swap": 0 }, { "--swap": 1, ease: "none", scrollTrigger: trigger });
          gsap.fromTo(seats, { opacity: 0, scale: 0.6, transformOrigin: "50% 50%" }, {
            opacity: 1,
            scale: 1,
            ease: "Out",
            stagger: { each: 0.05, from: "end" },
            scrollTrigger: trigger,
          });
        };

        // a schedule phase: its heading, then its rows one after another
        const phase = (n, trigger) => {
          const head = el.querySelectorAll(`[data-phase-day="${n}"] > *`);
          const rows = el.querySelectorAll(`[data-phase="${n}"] .jx-sched__row`);
          gsap.fromTo([...head, ...rows], { opacity: 0, filter: "blur(18px)", y: 12 }, {
            opacity: 1,
            filter: "blur(0px)",
            y: 0,
            ease: "Out",
            stagger: 0.12,
            scrollTrigger: trigger,
          });
        };

        const mm = gsap.matchMedia();
        mm.add(`(min-width: ${BREAKPOINT}px)`, () => {
          const at = (start, end, extra = {}) => ({ trigger: area, start, end, ...extra });

          // prize panel slides out below as the schedule slides in from above
          gsap.fromTo([$("[data-jet-w]"), $("[data-spec-w]")], { yPercent: 0 }, {
            yPercent: 100,
            ease: "none",
            scrollTrigger: at("50% center", "85% bottom", { scrub: 1.2 }),
          });

          // jet shrinks toward the top of the frame
          gsap.fromTo($("[data-jet]"), { scale: 1, yPercent: 0 }, {
            scale: 0.4,
            yPercent: -15,
            ease: "In",
            scrollTrigger: at("25% center", "85% bottom", { scrub: 1.2 }),
          });

          // phase one (10 October) lands with the panel, phase two (11 October) after it
          phase(1, at("58% center", "85% bottom", { scrub: true }));
          phase(2, at("85% bottom", "95% bottom", { scrub: true }));

          cabinReveal(at("85% bottom", "bottom bottom", { scrub: true }));
          // streaks in sideways under a directional (horizontal-only) motion blur
          const blur = $("[data-dirblur]");
          const badgeIn = gsap.timeline({ scrollTrigger: at("74% bottom", "84% bottom", { scrub: true }) });
          badgeIn
            .fromTo(badge, { opacity: 0, xPercent: -60 }, { opacity: 1, xPercent: -50, ease: "Out", duration: 1 }, 0)
            .fromTo(blur, { attr: { stdDeviation: "48 0" } }, { attr: { stdDeviation: "0 0" }, ease: "Out", duration: 1 }, 0);
        });

        mm.add(`(max-width: ${BREAKPOINT - 1}px)`, () => {
          const plane = $("[data-jet]");
          phase(1, { trigger: $('[data-phase="1"]'), start: "top 90%", end: "bottom 70%", scrub: true });
          phase(2, { trigger: $('[data-phase="2"]'), start: "top 90%", end: "bottom 70%", scrub: true });
          cabinReveal({ trigger: plane, start: "top 70%", end: "bottom 60%", scrub: true });
          gsap.fromTo(badge, { opacity: 0, y: 16 }, {
            opacity: 1,
            y: 0,
            scrollTrigger: { trigger: badge, start: "top 95%", end: "top 70%", scrub: true },
          });
        });

        return () => mm.revert();
      });
    }, el);

    const fontsIn = document.fonts?.ready ?? Promise.resolve();
    Promise.race([fontsIn, new Promise((r) => setTimeout(r, 1500))]).then(() => {
      if (disposed) return;
      ctx.build();
      ScrollTrigger.refresh();
    });

    return () => {
      disposed = true;
      header?.classList.remove("jx-header--ink");
      document.documentElement.classList.remove("in-jet");
      ctx.revert();
    };
  }, []);

  return (
    <section className="jx jx-jet" data-label="Prize pool" ref={root}>
      <div className="jx-jet-area" data-jet-area>
        <div className="jx-jet-switcher">
          <div className="jx-light-bg" data-light-bg />

          {/* ---------------- prize pool ---------------- */}
          <div className="jx-jet-w" data-jet-w>
            <div className="jx-jet-s">
              <div className="jx-jet-s__top" />
              <div className="jx-jet-s__title">
                <div className="jx-h1" data-jet-chars>
                  Prize
                </div>
                <div className="jx-jet-s__push" />
                <div className="jx-h1 jx-right" data-jet-chars>
                  Pool
                </div>
              </div>
              <div className="jx-jet-s__bot">
                <div className="jx-grid jx-fill">
                  <div className="jx-jet-s__sub">
                    <div className="jx-u36" />
                    <h3 className="jx-p5" data-jet-lines>
                      Split across <br />
                      three podium <br />
                      places
                    </h3>
                  </div>
                  <div className="jx-jet-s__desc">
                    <div className="jx-jet-s__desc-title" data-jet-divs>
                      <div className="jx-line-h jx-line-h--ink" />
                      <div className="jx-u12" />
                    </div>
                    <div className="jx-u36" />
                    <ul className="jx-prizes" data-jet-divs>
                      {PRIZES.map((p) => (
                        <li key={p.place}>
                          <span className="jx-p7 jx-gray-ink">{p.place}</span>
                          <span className="jx-p5">{p.amount}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="jx-u24" />
                    <p className="jx-p7 jx-gray-ink" data-jet-lines>
                      Winners take home certificates and goodies; every finalist team gets a
                      participation certificate.
                    </p>
                    <div className="jx-u36 jx-desktop" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---------------- schedule, two phases ---------------- */}
          <div className="jx-spec-w" data-spec-w>
            <div className="jx-spec-s">
              <div className="jx-u96" />
              <div className="jx-line-h jx-line-h--ink" />
              <div className="jx-grid jx-fill">
                <div className="jx-spec-s__col jx-spec-s__col--l">
                  <div className="jx-spec-day" data-phase-day="1">
                    <div className="jx-u12" />
                    <div className="jx-p5">Flight plan</div>
                    <div className="jx-u24" />
                    <div className="jx-h2 jx-ink">Timeline</div>
                  </div>
                  <div className="jx-sched-wrap">
                    <Schedule rows={TIMELINE} phase="1" />
                  </div>
                </div>

                <div className="jx-spec-s__center">
                  <svg className="jx-svg-defs" aria-hidden="true">
                    <filter id="jx-dirblur" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur data-dirblur stdDeviation="0 0" />
                    </filter>
                  </svg>
                  <div className="jx-seat-badge" data-seat-badge>
                    <div className="jx-l1 jx-gray">Finale cabin · On campus</div>
                    <div className="jx-u12" />
                    <div className="jx-seat-badge__pill">
                      <i className="jx-seat-badge__dot" />
                      <span className="jx-t7">
                        <span className="jx-seat-badge__n">{SEATS}</span> of {SEATS} seats remaining
                      </span>
                    </div>
                  </div>
                </div>

                <div className="jx-spec-s__col jx-spec-s__col--r">
                  <div className="jx-spec-day" data-phase-day="2">
                    <div className="jx-u12" />
                    <div className="jx-p5">Runways</div>
                    <div className="jx-u24" />
                    <div className="jx-h2 jx-ink">Tracks</div>
                    <div className="jx-u24" />
                    <div className="jx-ps">
                      <span className="jx-l1 jx-gray">Problem statements &amp; tracks</span>
                      <span className="jx-ps__tag jx-l1">
                        <i /> Revealed soon
                      </span>
                    </div>
                  </div>
                  <div className="jx-sched-wrap">
                    <Runways />
                  </div>
                </div>
              </div>
              <div className="jx-u36" />
            </div>
          </div>
        </div>

        {/* nav target: the point where both schedule phases are on screen */}
        <div className="jx-jet-anchor jx-jet-anchor--prizes" id="prizes" aria-hidden="true" />
        <div className="jx-jet-anchor" id="schedule" aria-hidden="true" />

        {/* ---------------- the jet ---------------- */}
        <div className="jx-jet-plane">
          <div className="jx-jet-plane__scale" data-jet>
            <div className="jx-jet-box" data-jet-box>
              <div className="jx-jet-photo">
                <JetPhoto />
              </div>
              <div className="jx-jet-blueprint">
                <JetBlueprint />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="jx-jet-tail" aria-hidden="true" />
    </section>
  );
}
