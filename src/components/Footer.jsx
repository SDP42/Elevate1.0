import { CONTACTS, EVENT, ORGANISER } from "../config";

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="footer__igIcon">
    <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 10.5V16M8 7.6v.1M11.5 16v-5.5M11.5 13c0-1.6 1-2.6 2.3-2.6s2.2.9 2.2 2.6V16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="footer__igIcon">
    <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__about">
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
            <div className="footer__brand">
              ELEVATE <em>1.0</em>
            </div>
          </div>
          <p className="footer__tag">{ORGANISER.blurb}</p>
          <div className="footer__social">
            <a
              className="footer__ig"
              href={ORGANISER.instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              <InstagramIcon />
              <span>Instagram</span>
            </a>
            <a
              className="footer__ig"
              href={ORGANISER.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              <LinkedInIcon />
              <span>LinkedIn</span>
            </a>
          </div>
        </div>

        <div className="footer__col">
          <span className="footer__heading">Event</span>
          <a href="#brief">About</a>
          <a href="#prizes">Prizes</a>
          <a href="#schedule">Schedule</a>
          <a href="#register">Register</a>
        </div>

        <div className="footer__col">
          <span className="footer__heading">Contact</span>
          {CONTACTS.map((c) => (
            <a key={c.name} className="footer__contact" href={`tel:${c.tel}`}>
              <span className="footer__person">{c.name}</span>
              <span className="footer__phone">{c.phone}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="container footer__bottom">
        <span>
          © {new Date().getFullYear()} {EVENT.name} · {EVENT.college}, {EVENT.city}
        </span>
      </div>
    </footer>
  );
}
