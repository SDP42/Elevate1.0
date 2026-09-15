import Globe from "./Globe";
import useScrollProgress, { range } from "../hooks/useScrollProgress";

const STOPS = [
  { time: "09:00", day: 1, label: "Check-in & badges", note: "Desks, wifi, team kits." },
  { time: "10:00", day: 1, label: "Opening ceremony", note: "Domains revealed on stage." },
  { time: "11:00", day: 1, label: "Hackathon starts", note: "The 24 hours begin here." },
  { time: "13:00", day: 1, label: "Lunch", note: "Served onwards, in hall." },
  { time: "17:00", day: 1, label: "Snacks & high tea", note: "Short reset before the evening push." },
  { time: "18:00", day: 1, label: "Mentoring round 1", note: "Every team gets a slot." },
  { time: "20:00", day: 1, label: "Dinner", note: "Served onwards." },
  { time: "00:00", day: 2, label: "Jamming session", note: "Music, games, midnight energy." },
  { time: "02:00", day: 2, label: "Mentoring round 2", note: "Late-night course correction." },
  { time: "04:00", day: 2, label: "Submission instructions", note: "How and where to submit." },
  { time: "07:00", day: 2, label: "Breakfast", note: "Served onwards." },
  { time: "11:00", day: 2, label: "Hackathon ends", note: "Tools down, repos locked." },
  { time: "12:00", day: 2, label: "Judging round 1", note: "First pass across all teams." },
  { time: "13:00", day: 2, label: "Lunch", note: "Served onwards." },
  { time: "14:00", day: 2, label: "Final judging", note: "Shortlisted teams present." },
];

const DAYS = [
  { n: 1, label: "Fri 10 Oct" },
  { n: 2, label: "Sat 11 Oct" },
];

export default function Timeline() {
  const [ref, p] = useScrollProgress();

  const active = Math.min(
    Math.floor(range(p, 0.06, 0.95) * STOPS.length),
    STOPS.length - 1
  );

  // clicking a stop scrolls to the point in the section where it is active,
  // aiming at the middle of its slice so it doesn't sit on a boundary
  const goTo = (i) => {
    const el = ref.current;
    if (!el) return;
    const span = el.offsetHeight - window.innerHeight;
    const k = 0.06 + ((i + 0.5) / STOPS.length) * 0.89;
    window.scrollTo({ top: el.offsetTop + span * k, behavior: "smooth" });
  };

  return (
    <section id="timeline" data-label="Finale schedule" ref={ref} className="timeline">
      <div className="timeline__sticky">
        <div className="timeline__word" aria-hidden="true">
          24 HOURS
        </div>

        <div className="timeline__globeWrap">
          <Globe
            progress={range(p, 0.05, 0.95)}
            marker={STOPS[active].time}
            stops={STOPS.map((s) => s.time)}
            activeIndex={active}
          />
        </div>

        <div className="container timeline__inner">
          <div className="timeline__head">
            <span className="eyebrow">Grand finale · on campus</span>
            <h2 className="timeline__title">10 — 11 October</h2>
            <div className="timeline__detail">
              <span className="timeline__day">
                {DAYS.find((d) => d.n === STOPS[active].day).label}
              </span>
              <strong className="timeline__detailLabel">
                {STOPS[active].label}
              </strong>
              <span className="timeline__note">{STOPS[active].note}</span>
            </div>
          </div>

          <div className="timeline__days">
            {DAYS.map((d) => (
              <div key={d.n} className="timeline__dayCol">
                <span className="timeline__dayHead">{d.label}</span>
                <ol className="timeline__rail">
                  {STOPS.map((s, i) =>
                    s.day !== d.n ? null : (
                      <li key={s.time + s.label}>
                        <button
                          type="button"
                          onClick={() => goTo(i)}
                          aria-current={i === active ? "step" : undefined}
                          className={`timeline__stop ${
                            i === active ? "timeline__stop--on" : ""
                          } ${i < active ? "timeline__stop--done" : ""}`}
                        >
                          <span className="timeline__dot" />
                          <span className="timeline__time">{s.time}</span>
                          <span className="timeline__label">{s.label}</span>
                        </button>
                      </li>
                    )
                  )}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
