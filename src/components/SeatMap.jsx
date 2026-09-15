import useInView from "../hooks/useInView";

/* Cabin seat map standing in for team slots. Update BOOKED as registrations
   come in — the map, the counter and the bar all read from it. */
const TOTAL = 30;
const BOOKED = 0;

const COLS = 8;
const ROWS = 4; // 2 either side of the aisle

const SEAT_W = 34;
const SEAT_H = 30;
const GAP_X = 12;
const GAP_Y = 9;
const AISLE = 26;
const X0 = 150;
const Y0 = 66;

function seatXY(col, row) {
  const x = X0 + col * (SEAT_W + GAP_X);
  const y = Y0 + row * (SEAT_H + GAP_Y) + (row >= 2 ? AISLE : 0);
  return { x, y };
}

export default function SeatMap() {
  const [mapRef, seen] = useInView(0.4);
  const remaining = TOTAL - BOOKED;
  const pct = Math.round((BOOKED / TOTAL) * 100);

  const seats = [];
  let n = 0;
  for (let col = 0; col < COLS && n < TOTAL; col++) {
    for (let row = 0; row < ROWS && n < TOTAL; row++) {
      const { x, y } = seatXY(col, row);
      const taken = n < BOOKED;
      const seatNo = String(n + 1).padStart(2, "0");
      seats.push(
        <g
          key={`${col}-${row}`}
          className="seat"
          style={{ animationDelay: `${col * 0.07 + row * 0.03}s` }}
        >
          <title>{`Seat ${seatNo} · ${taken ? "taken" : "open"}`}</title>
          <rect
            x={x}
            y={y}
            width={SEAT_W}
            height={SEAT_H}
            rx="7"
            fill={taken ? "#c9a86a" : "#1b1e22"}
            stroke={taken ? "#e8d0a0" : "#3d444c"}
            strokeWidth="1.4"
          />
          {/* seat back lip */}
          <rect
            x={x + 4}
            y={y + 3}
            width={SEAT_W - 8}
            height="6"
            rx="3"
            fill={taken ? "#8a6f3c" : "#2a2f35"}
          />
        </g>
      );
      n++;
    }
  }

  return (
    <section id="seats" data-label="Finale seats" className="seats">
      <div className="container">
        <div className="seats__head" data-reveal>
          <span className="eyebrow">Manifest</span>
          <h2 className="section-title">Thirty seats in the finale.</h2>
          <p className="seats__copy">
            The online qualifier shortlists thirty teams for the grand finale.
            Each seat on this map is one of them.
          </p>
        </div>

        <div ref={mapRef} className={`seats__mapWrap ${seen ? "is-waving" : ""}`}>
          <svg viewBox="0 0 840 240" className="seats__map" aria-hidden="true">
            {/* fuselage */}
            <path
              d="M96 120 C96 54, 150 22, 232 18 L742 18 C790 18, 812 44, 812 120 C812 196, 790 222, 742 222 L232 222 C150 218, 96 186, 96 120 Z"
              fill="#0f1114"
              stroke="#3d444c"
              strokeWidth="2"
            />
            {/* cockpit divider */}
            <path d="M150 30 C126 58, 126 182, 150 210" fill="none" stroke="#3d444c" strokeWidth="1.6" />
            {/* aisle guide */}
            <line x1="150" y1="120" x2="800" y2="120" stroke="#262c33" strokeWidth="1" strokeDasharray="6 8" />
            {/* exits */}
            <rect x="150" y="10" width="34" height="6" rx="3" fill="#7fd18c" opacity="0.7" />
            <rect x="150" y="224" width="34" height="6" rx="3" fill="#7fd18c" opacity="0.7" />
            <rect x="700" y="10" width="34" height="6" rx="3" fill="#7fd18c" opacity="0.7" />
            <rect x="700" y="224" width="34" height="6" rx="3" fill="#7fd18c" opacity="0.7" />

            {seats}
          </svg>
        </div>

        <div className="seats__foot">
          <div className="seats__legend">
            <span className="seats__key seats__key--taken" /> Taken
            <span className="seats__key seats__key--free" /> Available
          </div>

          <div className="seats__meter">
            <div className="seats__bar">
              <div className="seats__fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="seats__count">
              <strong>{remaining}</strong> of {TOTAL} seats remaining
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
