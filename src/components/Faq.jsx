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
        <div className="faq__head" data-reveal>
          <span className="eyebrow">FAQ</span>
          <h2 className="section-title">Before you board.</h2>
        </div>

        <div className="faq__list" data-reveal="stagger">
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
    </section>
  );
}
