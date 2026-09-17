import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, SplitText, BREAKPOINT, charReveal, lineReveal, childReveal } from "./motion";
import { BackPlate, FrontPlate, FrontOverPlate, Knob } from "./CabinWindow";
import { paintSky } from "./skyPainter";
import { prefersReducedMotion } from "../hooks/useInView";
import { EVENT } from "../config";

const VISITED = "elevate-intro-seen";

const FEATURES = [
  {
    title: ["Round one,", "online"],
    body: "Register your team on Unstop and submit online. The top thirty teams earn a seat on the flight to campus.",
  },
  {
    title: ["Round two,", "on campus"],
    body: `Twenty-four continuous hours at ${EVENT.college.split(" of ")[0]}, ${EVENT.city}, on ${EVENT.dates}.`,
  },
];

/* A word or phrase ringed in a hand-drawn pencil circle — the ring draws
   itself in as the phrase scrolls into view (see the pencil animation
   below). Used twice in the brief: the event name, and "everyone". */
function Circled({ children }) {
  return (
    <span className="jx-circled" data-circled>
      {children}
      <svg className="jx-circled__pencil" viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
        <path
          data-pencil
          d="M168 12 C 96 4, 22 20, 12 52 C 2 86, 78 104, 162 100 C 246 96, 296 78, 290 48 C 284 18, 214 4, 138 10 C 112 12, 94 16, 80 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/* Plate sizes follow the viewport's shape so the painted sky is never
   stretched; widths are capped because the plates are soft by nature. */
function useSkyPlates() {
  const [urls, setUrls] = useState({});
  useEffect(() => {
    let cancelled = false;
    let made = {};
    const ratio = window.innerHeight / Math.max(window.innerWidth, 1);
    const width = Math.min(1600, Math.round(window.innerWidth * Math.min(window.devicePixelRatio || 1, 1.5)));
    paintSky({
      hero: { mode: "hero", width, height: width * ratio * 2, seed: 3 },
      strip: { mode: "strip", width: 2800, height: 380, seed: 11 },
      about: { mode: "about", width, height: width * ratio * 3, seed: 7 },
    })
      .then((out) => {
        made = out;
        if (cancelled) Object.values(out).forEach((u) => u && URL.revokeObjectURL(u));
        else setUrls(out);
      })
      .catch(() => {
        /* no WebGL: the CSS gradients underneath still read as sky */
      });
    return () => {
      cancelled = true;
      Object.values(made).forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, []);
  return urls;
}

export default function Intro() {
  const root = useRef(null);
  const sky = useSkyPlates();

  useLayoutEffect(() => {
    const el = root.current;
    const html = document.documentElement;
    const reduced = prefersReducedMotion();

    let visited = false;
    try {
      visited = Boolean(sessionStorage.getItem(VISITED));
      sessionStorage.setItem(VISITED, "1");
    } catch {
      /* storage blocked: treat every visit as the first */
    }
    // seconds the boarding screen holds before the shade lifts
    const hold = reduced ? 0.2 : visited ? 1 : 3;

    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
      anchors: true,
    });
    lenis.stop();
    html.classList.add("in-intro", "is-boarding");
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const $ = (sel) => el.querySelector(sel);
    const header = document.querySelector("[data-jx-header]");
    const logo = document.querySelector("[data-jx-logo]");
    const cta = document.querySelector("[data-jx-cta]");

    let preSplits = [];
    const ctx = gsap.context((self) => {
      /* The timed sequence waits for the display face: lines are split by
         measured width, so splitting on the fallback font would break every
         line again the moment Archivo arrives. */
      self.add("boot", () => {
      /* ---- boarding screen ---------------------------------------- */
      const pre = $("[data-pre]");
      preSplits = Array.from(pre.querySelectorAll("[data-pre-text]")).map(
        (t) => new SplitText(t, { type: "lines", linesClass: "jx-line" })
      );
      const preLines = preSplits.flatMap((s) => s.lines);
      gsap.set(pre.querySelector(".jx-pre__info"), { visibility: "visible" });
      gsap.fromTo(
        preLines,
        { filter: "blur(36px)", opacity: 0 },
        { filter: "blur(0px)", opacity: 1, duration: 1, stagger: 0.08, ease: "Out" }
      );
      gsap.to(preLines, {
        filter: "blur(36px)",
        opacity: 0,
        duration: 0.6,
        stagger: 0.02,
        ease: "In",
        delay: hold,
        overwrite: "auto",
      });
      // the dark wash rises off the window as a soft dome
      gsap.fromTo(
        $("[data-pre-bg]"),
        { "--mask-p": 0 },
        { "--mask-p": 2, duration: 1.2, delay: Math.max(hold - 0.4, 0), ease: "Out" }
      );
      gsap.to(pre, {
        autoAlpha: 0,
        duration: 0.6,
        delay: hold + 0.4,
        ease: "Out",
        onComplete: () => {
          pre.style.display = "none";
          html.classList.remove("is-boarding");
          lenis.start();
        },
      });

      /* ---- the shade lifts ---------------------------------------- */
      gsap.fromTo($("[data-shade]"), { yPercent: 0, scaleY: 1 }, { yPercent: -92, scaleY: 0.5, duration: 1.2, delay: hold, ease: "InOut" });
      gsap.fromTo($("[data-knob]"), { yPercent: 0 }, { yPercent: -92, duration: 1.2, delay: hold, ease: "InOut" });
      gsap.fromTo($("[data-knob-dark]"), { opacity: 0 }, { opacity: 1, duration: 1.2, delay: hold, ease: "InOut" });
      gsap.fromTo($("[data-front-over]"), { opacity: 1 }, { opacity: 0, duration: 1.2, delay: hold + 0.4, ease: "InOut" });

      /* ---- page chrome and hero copy arrive with the shade -------- */
      // registered on the context so an unmount before it fires reverts it
      self.add("arrive", () => {
        gsap.set([header, cta], { visibility: "visible" });
        gsap.fromTo(header, { yPercent: -100 }, { yPercent: 0, duration: 1.2, ease: "Out" });
        gsap.fromTo(cta, { yPercent: 100 }, { yPercent: 0, duration: 1.2, ease: "Out" });
        el.querySelectorAll("[data-char-reveal]").forEach((t) => charReveal(t));
        el.querySelectorAll("[data-line-reveal]").forEach((t) => lineReveal(t));
        el.querySelectorAll("[data-div-reveal]").forEach((t) => childReveal(t));
      });
      gsap.delayedCall(hold, self.arrive);
      });

      /* ---- scroll choreography ------------------------------------ */
      const heroArea = $("[data-hero-area]");
      const scrub = { trigger: heroArea, start: "top top", end: "bottom bottom", scrub: true };

      // wordmark drops out of the window and settles into the header
      gsap.fromTo(logo, { y: "44vh", scale: 2.1 }, { y: "0vh", scale: 1, ease: "ease", scrollTrigger: scrub });

      const mm = gsap.matchMedia();
      mm.add(
        { desktop: `(min-width: ${BREAKPOINT}px)`, mobile: `(max-width: ${BREAKPOINT - 1}px)` },
        ({ conditions }) => {
          const tl = gsap.timeline({ scrollTrigger: scrub });
          // camera pushes through the window: wall 6.5×, copy 8×
          // 2D transforms (force3D off) so the browser re-rasterises the zoom at
          // the scale actually on screen instead of holding the deepest one
          tl.fromTo($("[data-hero-bg]"), { scale: 1, xPercent: 0 }, { scale: 6.5, xPercent: -2, ease: "none", duration: 1, force3D: false }, 0);
          if (!conditions.desktop) {
            // phones: the brief flows normally, each block blurs in as it arrives
            el.querySelectorAll("[data-scroll-reveal]").forEach((block) => {
              gsap.set(block, { visibility: "visible" });
              gsap.from(Array.from(block.children), {
                filter: "blur(24px)",
                opacity: 0,
                duration: 1,
                stagger: 0.1,
                ease: "Out",
                scrollTrigger: { trigger: block, start: "top 90%", toggleActions: "play none none none" },
              });
            });
            return;
          }


          // the sky drifts at half the scroll speed behind the window
          gsap.fromTo($("[data-sky-hero]"), { y: "0vh" }, { y: "100vh", ease: "none", scrollTrigger: scrub });

          const aboutW = $("[data-about-w]");
          gsap.fromTo($("[data-about-s]"), { y: "-50vh" }, {
            y: "-200vh",
            ease: "none",
            scrollTrigger: { trigger: aboutW, start: "top bottom", end: "bottom top", scrub: true },
          });

          el.querySelectorAll("[data-scroll-reveal]").forEach((block) => {
            gsap.set(block, { visibility: "visible" });
            gsap.from(Array.from(block.children), {
              filter: "blur(36px)",
              opacity: 0,
              duration: 1,
              delay: 0.3,
              stagger: 0.1,
              ease: "Out",
              scrollTrigger: { trigger: block, start: "top bottom", toggleActions: "play none none none" },
            });
          });

        }
      );

      // each pencil circle draws itself round its own word as it scrolls in
      el.querySelectorAll("[data-circled]").forEach((circle, i) => {
        const pencil = circle.querySelector("[data-pencil]");
        if (!pencil) return;
        const len = pencil.getTotalLength();
        gsap.set(pencil, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(pencil, {
          strokeDashoffset: 0,
          duration: 1.4,
          delay: 0.5 + i * 0.15,
          ease: "InOut",
          scrollTrigger: { trigger: circle, start: "top 85%", toggleActions: "play none none reverse" },
        });
      });

      // hide the rest of the site's floating chrome while the intro plays
      // starts before the page top so it is still active when scrolled back to 0
      ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        end: "bottom 60%",
        onToggle: (self) => html.classList.toggle("in-intro", self.isActive),
      });

      return () => {
        mm.revert();
        preSplits.forEach((s) => s.revert());
      };
    }, el);

    let disposed = false;
    const fontsIn = document.fonts?.ready ?? Promise.resolve();
    Promise.race([fontsIn, new Promise((r) => setTimeout(r, 1500))]).then(() => {
      if (disposed) return;
      ctx.boot();
      ScrollTrigger.refresh();
    });

    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);

    return () => {
      disposed = true;
      window.removeEventListener("load", onLoad);
      ctx.revert();
      gsap.ticker.remove(raf);
      lenis.destroy();
      html.classList.remove("in-intro", "is-boarding");
    };
  }, []);

  return (
    <div className="jx" ref={root}>
      {/* ---------------- boarding screen ---------------- */}
      <div className="jx-pre" data-pre aria-hidden="true">
        <div className="jx-pre__c">
          <div className="jx-pre__info">
            <div className="jx-l1" data-pre-text>{EVENT.name}</div>
            <div className="jx-u12" />
            <div className="jx-p5" data-pre-text>24-hour hackathon on campus</div>
          </div>
        </div>
        <div className="jx-pre__bg" data-pre-bg />
      </div>

      <div className="jx-intro">
        {/* ---------------- cabin window ---------------- */}
        <section className="jx-hero-area" id="top" data-label="Cabin" data-hero-area>
          <div className="jx-hero-w">
            {/* landing shows only the window and the wordmark */}
            <div className="jx-hero-bg" data-hero-bg aria-hidden="true">
              <div className="jx-hero-bg__overlay" />
              <div className="jx-plate jx-plate--front-over" data-front-over>
                <div className="jx-stage">
                  <FrontOverPlate />
                </div>
              </div>
              <div className="jx-plate jx-plate--front">
                <div className="jx-stage">
                  <FrontPlate />
                </div>
              </div>
              <div className="jx-plate jx-plate--window">
                <div className="jx-stage">
                  <div className="jx-window-c">
                    <div className="jx-shade" data-shade>
                      <div className="jx-shade__bg" />
                    </div>
                    <div className="jx-knob-c" data-knob>
                      <div className="jx-knob">
                        <Knob />
                      </div>
                      <div className="jx-knob jx-knob--dark" data-knob-dark>
                        <Knob dark />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="jx-plate jx-plate--back">
                <div className="jx-stage">
                  <BackPlate />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- the brief ---------------- */}
        <section className="jx-about-w" id="brief" data-label="Brief" data-about-w>
          <div className="jx-about-s" data-about-s>
            <div className="jx-u96" />
            <div className="jx-about-s__lead" data-scroll-reveal>
              <div>
                <p className="jx-brief">
                  <Circled>{EVENT.name}</Circled> is a {EVENT.format} for <Circled>everyone</Circled>. Form a
                  crew, pick a problem, and ship something real at{" "}
                  {EVENT.college.split(" of ")[0]}, {EVENT.city}.
                </p>
                <div className="jx-u24" />
                <div className="jx-l1 jx-brief__org">
                  Organised by {EVENT.organiser} × {EVENT.partner}
                </div>
              </div>
            </div>
            <div className="jx-u60" />
            <ol className="jx-features" data-scroll-reveal>
              {FEATURES.map((f, i) => (
                <li className="jx-feature" key={f.title.join(" ")}>
                  <span className="jx-feature__n">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="jx-feature__title">
                    {f.title[0]}
                    <br />
                    {f.title[1]}
                  </h3>
                  <p className="jx-feature__body">{f.body}</p>
                </li>
              ))}
            </ol>
            <div className="jx-u156 jx-desktop" />
          </div>
        </section>
        <div className="jx-ghost jx-desktop" />

        {/* ---------------- sky behind everything ---------------- */}
        <div className="jx-sky" aria-hidden="true">
          <div className="jx-sky__hero" data-sky-hero>
            {sky.hero && <img className="jx-sky__img" src={sky.hero} alt="" />}
            <div className="jx-sky__clouds">
              <div className="jx-sky__clouds-list">
                <div className="jx-sky__clouds-item" style={sky.strip ? { backgroundImage: `url(${sky.strip})` } : undefined} />
                <div className="jx-sky__clouds-item" style={sky.strip ? { backgroundImage: `url(${sky.strip})` } : undefined} />
              </div>
            </div>
            <div className="jx-sky__hero-grad" />
          </div>
          <div className="jx-sky__about">
            {sky.about && <img className="jx-sky__img jx-sky__img--about" src={sky.about} alt="" />}
            <div className="jx-sky__about-grad" />
          </div>
        </div>
      </div>
    </div>
  );
}
