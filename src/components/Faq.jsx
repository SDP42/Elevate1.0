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
            <svg viewBox="0 0 120 48">
              <path
                d="M4 26 C4 18 14 14 28 14 L88 14 L118 24 L88 34 L28 34 C14 34 4 30 4 26 Z"
                fill="currentColor"
              />
              <path d="M46 30 L20 46 L42 32 Z" fill="currentColor" opacity="0.9" />
              <path d="M16 14 L8 2 L26 14 Z" fill="currentColor" opacity="0.9" />
            </svg>
          </div>

          <div className="faq__wipe">
            <div className="faq__head">
              <span className="eyebrow">FAQ</span>
              <h2 className="section-title">Before you board.</h2>
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
