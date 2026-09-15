import { useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger, BREAKPOINT, charReveal, lineReveal, childReveal } from "./motion";
import { JetPhoto, JetBlueprint, SEAT_ROWS } from "./JetArt";

const SEATS = SEAT_ROWS * 2;

const PRIZES = [
  { place: "1st place", amount: "₹50,000" },
  { place: "2nd place", amount: "₹30,000" },
  { place: "3rd place", amount: "₹20,000" },
];

// the finale schedule, exactly as issued; blank times stay unlabelled
const DAY_ONE = [
  ["9–10 AM", "Registration and Check-In"],
  ["10–11 AM", "PS Selection and Opening Ceremony"],
  ["11:00", "Flight Take Off"],
  ["13:00", "Lunch"],
  ["15:00", "In-Flight Security Check 1 Begins"],
  ["17:00", "High Tea"],
  ["20:00", "Dinner"],
  ["", "Mentoring Session"],
  ["", "Jamming Session + Midnight Snacks"],
];

const DAY_TWO = [
  ["07:00", "Breakfast"],
  ["11:00", "Flight Landing + Luggage Collection"],
  ["11:30", "Immigration Check (Judging Round 1)"],
  ["12:00", "Lunch + 15 Min Window for Result Declaration"],
  ["13:30", "Currency Exchange (Final Judging Round)"],
  ["16:00", "Award Ceremony"],
];

function Schedule({ rows, phase }) {
  return (
    <ol className="jx-sched" data-phase={phase}>
      {rows.map(([time, what]) => (
        <li className="jx-sched__row" key={what}>
          <div className="jx-line-h jx-line-h--ink" />
          <div className="jx-u12" />
          <div className="jx-sched__line">
            <span className={`jx-sched__time ${time ? "" : "jx-sched__time--tba"}`}>
              {time || "Night"}
            </span>
            <span className="jx-sched__what">{what}</span>
          </div>
          <div className="jx-u12" />
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
          gsap.fromTo(badge, { opacity: 0, y: 20 }, {
            opacity: 1,
            y: 0,
            ease: "Out",
            scrollTrigger: at("76% bottom", "84% bottom", { scrub: true }),
          });
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
                  Prizes
                </div>
                <div className="jx-jet-s__push" />
                <div className="jx-h1 jx-right" data-jet-chars>
                  ₹1 Lakh
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
                      <div className="jx-jet-s__desc-row">
                        <div className="jx-l1">Prize pool</div>
                        <div className="jx-l1">
                          <strong>₹1,00,000</strong>
                        </div>
                      </div>
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
                    <div className="jx-p5">Phase 01 · Take-off</div>
                    <div className="jx-u24" />
                    <div className="jx-h2 jx-ink">10 Oct</div>
                    <div className="jx-u24" />
                    <div className="jx-ps">
                      <span className="jx-l1 jx-gray">Problem statements</span>
                      <span className="jx-ps__tag jx-l1">
                        <i /> Revealed soon
                      </span>
                    </div>
                  </div>
                  <div className="jx-sched-wrap">
                    <Schedule rows={DAY_ONE} phase="1" />
                  </div>
                </div>

                <div className="jx-spec-s__center">
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
                    <div className="jx-p5">Phase 02 · Landing</div>
                    <div className="jx-u24" />
                    <div className="jx-h2 jx-ink">11 Oct</div>
                    <div className="jx-u24" />
                    <div className="jx-ps">
                      <span className="jx-l1 jx-gray">Finale</span>
                      <span className="jx-p7">Two judging rounds, results, then the award ceremony.</span>
                    </div>
                  </div>
                  <div className="jx-sched-wrap">
                    <Schedule rows={DAY_TWO} phase="2" />
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
