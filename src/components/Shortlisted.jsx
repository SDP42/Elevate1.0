import { useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../intro/motion";
import { SHORTLISTED, WAITLISTED } from "../config";
import "./shortlisted.css";

const BOARD_SIZE = 10;
const GOLD = "201, 168, 106";
const AMBER = "240, 150, 84";

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const pad = (n) => String(n).padStart(2, "0");

/* One board per ten shortlisted teams, then one for the waitlist — each
   becomes a glass card that stacks over the last as you scroll. */
const BOARDS = [
  ...chunk(SHORTLISTED, BOARD_SIZE).map((teams, i) => ({
    key: `shortlisted-${i}`,
    title: "Shortlisted",
    sub: `Teams ${pad(i * BOARD_SIZE + 1)} - ${pad(i * BOARD_SIZE + teams.length)} of ${SHORTLISTED.length}`,
    teams,
    label: (n) => pad(i * BOARD_SIZE + n),
    rgb: GOLD,
  })),
  {
    key: "waitlisted",
    title: "Waitlisted",
    sub: `${WAITLISTED.length} teams on the waitlist`,
    teams: WAITLISTED,
    label: (n) => `W${n}`,
    rgb: AMBER,
  },
];

const PlaneIcon = ({ flip }) => (
  <svg className={`sl-plane${flip ? " is-flipped" : ""}`} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z"
    />
  </svg>
);

function Board({ board }) {
  const { rgb } = board;
  return (
    <div
      className="sl-card"
      style={{
        "--a8": `rgba(${rgb}, 0.8)`,
        "--a6": `rgba(${rgb}, 0.6)`,
        "--a4": `rgba(${rgb}, 0.4)`,
      }}
    >
      <div className="sl-card__edge" aria-hidden="true" />
      <div className="sl-card__glass">
        <div className="sl-card__sheen" aria-hidden="true" />
        <div className="sl-card__shine" aria-hidden="true" />
        <div className="sl-card__side" aria-hidden="true" />
        <div className="sl-card__frost" aria-hidden="true" />

        <div className="sl-board">
          <header className="sl-board__head">
            <PlaneIcon />
            <div>
              <h3 className="sl-board__title">{board.title}</h3>
              <p className="sl-board__sub">{board.sub}</p>
            </div>
            <PlaneIcon flip />
          </header>

          <div className="sl-cols" aria-hidden="true">
            <span>No.</span>
            <span>Team</span>
          </div>

          <ol className="sl-rows">
            {board.teams.map((team, i) => (
              <li className="sl-row" key={team.name}>
                <span className="sl-tile sl-tile--no">{board.label(i + 1)}</span>
                <span className="sl-tile sl-tile--name">
                  <span className="sl-name">{team.name}</span>
                  {team.note && <span className="sl-note">{team.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function Shortlisted() {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    // everything created inside this context is torn down with it, so
    // cleanup never touches the triggers other sections own
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(
        { stack: "(min-height: 701px)", still: "(prefers-reduced-motion: reduce)" },
        (context) => {
          const { stack, still } = context.conditions;
          const items = gsap.utils.toArray(".sl-item");

          items.forEach((item, i) => {
            const card = item.querySelector(".sl-card");

            // each card shrinks slightly as the ones after it slide over it
            if (stack && !still) {
              const targetScale = 1 - (items.length - i) * 0.05;
              ScrollTrigger.create({
                trigger: item,
                start: "top center",
                end: "bottom center",
                scrub: 1,
                onUpdate: (self) => {
                  gsap.set(card, {
                    scale: gsap.utils.interpolate(1, targetScale, self.progress),
                    transformOrigin: "center top",
                  });
                },
              });
            }

            // rows flip down like a departures board when a card arrives
            if (!still) {
              const rows = card.querySelectorAll(".sl-row");
              const flip = gsap.from(rows, {
                rotateX: -90,
                opacity: 0,
                transformOrigin: "50% 0%",
                duration: 0.5,
                ease: "power2.out",
                stagger: 0.055,
                paused: true,
              });
              ScrollTrigger.create({
                trigger: item,
                start: "top 72%",
                once: true,
                onEnter: () => flip.play(),
              });
            }
          });
        }
      );
    }, root);

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    refresh();

    return () => {
      window.removeEventListener("load", refresh);
      ctx.revert();
    };
  }, []);

  return (
    <section id="shortlisted" data-label="Shortlisted teams" className="sl" ref={rootRef} aria-labelledby="sl-heading">
      <div className="sl__hero">
        <span className="sl__eyebrow">Elevate 1.0 · Round two</span>
        <h2 className="sl__heading" id="sl-heading">
          Shortlisted teams
        </h2>
        <p className="sl__lead">
          {SHORTLISTED.length} teams earned a seat on the flight to campus for the 24-hour finale on 10 and 11
          October. Scroll down to meet them.
        </p>
        <div className="sl__chips">
          <span>{SHORTLISTED.length} shortlisted</span>
          <span>{WAITLISTED.length} waitlisted</span>
        </div>
      </div>

      <div className="sl__stack">
        {BOARDS.map((board, index) => (
          <div className="sl-item" key={board.key} style={{ "--offset": `${index * 25}px` }}>
            <Board board={board} />
          </div>
        ))}
      </div>

      <span className="sl__seam" aria-hidden="true" />
    </section>
  );
}
