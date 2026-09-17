import { EVENT } from "../config";

/* Five questions, straight from the organisers — the ones people actually
   ask first. Keep this list in step with the timeline in the jet section. */
const FAQS = [
  {
    q: "What is the team size?",
    a: "Teams of 2 to 4 members.",
  },
  {
    q: "Who can participate?",
    a: "It is open for all — across years, colleges and departments.",
  },
  {
    q: "Why should I participate?",
    a: "Networking, a ₹1,00,000 prize pool, and hands-on product development with your team.",
  },
  {
    q: "When and where is the hackathon?",
    a: `At ${EVENT.college} (DJSCE), ${EVENT.city}, on 10 & 11 October.`,
  },
  {
    q: "How do I register?",
    a: "Register your team on Unstop. Registration closes on 30 September at 11:59 PM.",
  },
];

export default function Faq() {
  return (
    <section id="faq" data-label="FAQ" className="faq">
      <div className="container faq__grid">
        {/* a gold jet crosses once, left to right, and the whole panel wipes
            open behind it, rather than just fading up in place. the reveal
            trigger sits on this plain wrapper (not the clipped element
            itself) because a clip-path'd target reports zero intersection
            to IntersectionObserver, which would mean it could never reveal */}
        <div className="faq__reveal" data-reveal>
          {/* lives outside .faq__wipe, not inside it — that element's own
              clip-path still clips anything overflowing its box even once
              "open" (inset(0) clips exactly at the box edge), which would
              cut off a plane sitting above it on a negative offset */}
          <div className="faq__plane" aria-hidden="true">
            <span className="faq__planeTrail" />
            <svg viewBox="0 0 240 100">
              <defs>
                <linearGradient id="faqJetFuse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fbe7d3" />
                  <stop offset="0.5" stopColor="#d8b48c" />
                  <stop offset="1" stopColor="#8a6b56" />
                </linearGradient>
                <linearGradient id="faqJetWing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#9fb3c8" />
                  <stop offset="1" stopColor="#7d6a5c" />
                </linearGradient>
              </defs>
              {/* horizontal stabiliser, then the vertical fin, both behind the fuselage */}
              <path d="M50 56 L18 78 L46 60 Z" fill="url(#faqJetWing)" />
              <path d="M46 40 L20 8 L52 38 Z" fill="url(#faqJetWing)" />
              {/* main wing */}
              <path d="M150 58 L88 96 L128 62 Z" fill="url(#faqJetWing)" />
              {/* fuselage on top, nose to the right */}
              <path
                d="M20 50 C20 40 34 34 55 34 L205 34 C222 34 233 42 236 50 C233 58 222 66 205 66 L55 66 C34 66 20 60 20 50 Z"
                fill="url(#faqJetFuse)"
              />
              <ellipse cx="125" cy="72" rx="13" ry="6.5" fill="#6f5343" />
              <ellipse cx="209" cy="46" rx="7.5" ry="5" fill="#3a3f4c" opacity="0.75" />
              <line
                x1="70"
                y1="42"
                x2="192"
                y2="42"
                stroke="#fff8ed"
                strokeWidth="1.6"
                strokeDasharray="3 5"
                opacity="0.45"
              />
            </svg>
          </div>

          <div className="faq__wipe">
            <div className="faq__head">
              <span className="eyebrow">FAQ</span>
            </div>

            <div className="faq__list">
              {FAQS.map((f) => (
                <details key={f.q} className="faq__item">
                  <summary>
                    <span>{f.q}</span>
                    <i aria-hidden="true" />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
