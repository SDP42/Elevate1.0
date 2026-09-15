import { useEffect, useState } from "react";

const START = new Date("2026-10-10T09:00:00");

function useCountdown(target) {
  const [left, setLeft] = useState(() => target - new Date());

  useEffect(() => {
    const id = setInterval(() => setLeft(target - new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, [target]);

  if (left <= 0) return "Underway";
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  return `${days}d ${hours}h`;
}

export default function StatsBar() {
  const countdown = useCountdown(START);

  return (
    <section className="statsbar">
      <div className="container statsbar__grid">
        <div className="statsbar__item">
          <span className="statsbar__label">Dates</span>
          <span className="statsbar__value">10 &amp; 11 October</span>
        </div>
        <div className="statsbar__item">
          <span className="statsbar__label">Format</span>
          <span className="statsbar__value">24 hours, non-stop</span>
        </div>
        <div className="statsbar__item">
          <span className="statsbar__label">Doors open in</span>
          <span className="statsbar__value statsbar__value--mono">
            {countdown}
          </span>
        </div>
      </div>
    </section>
  );
}
