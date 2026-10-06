/* Paper-plane glyph for the round half of the CTA. */
const PlaneIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M17.6 2.4 2.9 8.3c-.6.2-.6 1.1 0 1.3l5.4 2 2 5.4c.2.6 1.1.6 1.3 0l5.9-14.7c.2-.5-.4-1.1-.9-.9Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="m8.3 11.6 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/* The floating bottom CTA. Registration has closed, so it now points at
   the shortlisted teams instead — a plain anchor, which Lenis smooth-scrolls. */
export default function BookFlight() {
  return (
    <div className="jx-cta" data-jx-cta>
      <a className="jx-cta__btn" href="#shortlisted">
        <span className="jx-cta__label">
          <span className="jx-cta__pill">
            <span className="jx-cta__roll">
              <span className="jx-t7">Shortlisted teams</span>
              <span className="jx-t7 jx-is-2" aria-hidden="true">
                Shortlisted teams
              </span>
            </span>
          </span>
          <span className="jx-cta__icon">
            <span className="jx-cta__roll jx-cta__roll--icon">
              <PlaneIcon />
              <PlaneIcon />
            </span>
          </span>
        </span>
      </a>
    </div>
  );
}
