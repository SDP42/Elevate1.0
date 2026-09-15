import { EVENT } from "../config";

const TEAM = ["Vrinda Talwar", "Atharva Deo", "Swayam Panchal"];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <div className="footer__brandRow">
            {/* drop the committee logo at public/nsdc-logo.png and it appears
                here; until the file exists the mark is simply omitted */}
            <img
              src="/nsdc-logo.png"
              alt=""
              className="footer__logo"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="nav__brand">
              ELEVATE <em>1.0</em>
            </div>
          </div>
          <p className="footer__tag">
            A 24-hour hackathon by {EVENT.organiser} — {EVENT.department},{" "}
            {EVENT.college}, {EVENT.city}.
          </p>
        </div>

        <div className="footer__col">
          <span className="footer__heading">Event</span>
          <a href="#prizes">Prizes</a>
          <a href="#timeline">Schedule</a>
          <a href="#safety">Briefing</a>
          <a href="#register">Register</a>
        </div>

        <div className="footer__col">
          <span className="footer__heading">Contact</span>
          {TEAM.map((name) => (
            <span key={name} className="footer__person">
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="container footer__bottom">
        <span>
          © {new Date().getFullYear()} {EVENT.name} · {EVENT.organiser}
        </span>
      </div>
    </footer>
  );
}
