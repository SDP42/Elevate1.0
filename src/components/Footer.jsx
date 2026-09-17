import { CONTACTS, EVENT, ORGANISER, VENUE_MAP_URL } from "../config";
import { WordmarkPlane } from "./SiteChrome";

// the venue's Google Maps embed — same pin as the footer's "Location" link,
// shown in place rather than as another tab to lose people to
const MAP_EMBED_SRC =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3770.0028276924054!2d72.83507967544199!3d19.107531882103615!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c9c65184a307%3A0x66af50c5443b4371!2s4R5Q%2B235%20Dwarkadas%20Jivanlal%20Sanghvi%20College%20Of%20Engineering%2C%20Navpada%2C%20Suvarna%20Nagar%2C%20Juhu%2C%20Mumbai%2C%20Maharashtra%20400056!5e0!3m2!1sen!2sin!4v1789617976182!5m2!1sen!2sin";

/* Brand marks drawn to the official glyphs (the same shapes catalogued on
   svgl.app) rather than a generic outline — Instagram's gradient camera ring
   and LinkedIn's blue "in" badge, each on its own square so they read at a
   glance in the footer row. */
const InstagramIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className="footer__igIcon">
    <defs>
      <radialGradient id="ig-grad" cx="0.3" cy="1" r="1.2">
        <stop offset="0" stopColor="#FED576" />
        <stop offset="0.26" stopColor="#F47133" />
        <stop offset="0.61" stopColor="#BC3081" />
        <stop offset="1" stopColor="#4C63D2" />
      </radialGradient>
    </defs>
    <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#ig-grad)" />
    <rect x="12.5" y="12.5" width="23" height="23" rx="7.5" fill="none" stroke="#fff" strokeWidth="2.6" />
    <circle cx="24" cy="24" r="6.6" fill="none" stroke="#fff" strokeWidth="2.6" />
    <circle cx="32.6" cy="15.4" r="1.7" fill="#fff" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true" className="footer__igIcon">
    <rect x="1" y="1" width="46" height="46" rx="9" fill="#0A66C2" />
    <rect x="11" y="19" width="5.4" height="18" fill="#fff" />
    <circle cx="13.7" cy="13" r="3" fill="#fff" />
    <path
      d="M22.4 19h5.2v2.6h.1c.9-1.6 3-2.9 5.8-2.9 5.4 0 7.5 3 7.5 8.8V37h-5.4v-8.5c0-2.9-.6-5.1-3.6-5.1-2.7 0-4.2 1.7-4.2 5.1V37h-5.4V19Z"
      fill="#fff"
    />
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
              ELEV
              <WordmarkPlane />
              ATE <em>1.0</em>
            </div>
          </div>
          <p className="footer__tag">{ORGANISER.blurb}</p>
          <div className="footer__social">
            <a
              className="footer__ig"
              href={ORGANISER.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="DJS NSDC on Instagram"
              title="Instagram"
            >
              <InstagramIcon />
            </a>
            <a
              className="footer__ig"
              href={ORGANISER.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="DJS NSDC on LinkedIn"
              title="LinkedIn"
            >
              <LinkedInIcon />
            </a>
          </div>
        </div>

        <div className="footer__col">
          <span className="footer__heading">Event</span>
          <a href="#brief">About</a>
          <a href="#prizes">Prizes</a>
          <a href="#schedule">Schedule</a>
          <a href="#register">Register</a>
          <a href={VENUE_MAP_URL} target="_blank" rel="noopener noreferrer">
            Location
          </a>
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

      <div className="container footer__map">
        <iframe
          src={MAP_EMBED_SRC}
          title={`${EVENT.college} — venue map`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>

      <div className="container footer__bottom">
        <span>
          © {new Date().getFullYear()} {EVENT.name} · {EVENT.college}, {EVENT.city}
        </span>
      </div>
    </footer>
  );
}
