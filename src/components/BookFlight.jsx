import { useState } from "react";
import RegisterButton from "./RegisterButton";
import { EVENT } from "../config";

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

export default function BookFlight() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="jx-cta" data-jx-cta>
        <button className="jx-cta__btn" onClick={() => setOpen(true)}>
          <span className="jx-cta__label">
            <span className="jx-cta__pill">
              <span className="jx-cta__roll">
                <span className="jx-t7">Register your team</span>
                <span className="jx-t7 jx-is-2" aria-hidden="true">
                  Register your team
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
        </button>
      </div>

      {open && (
        <div className="bookmodal" role="dialog" aria-modal="true">
          <div className="bookmodal__backdrop" onClick={() => setOpen(false)} />
          <div className="bookmodal__panel">
            <button
              className="bookmodal__close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>

            <span className="eyebrow">{EVENT.name}</span>
            <h3 className="bookmodal__title">Reserve a team slot</h3>

            <p className="bookmodal__lead">
              A {EVENT.format} by {EVENT.organiser} — the {EVENT.department}{" "}
              committee at {EVENT.college}, {EVENT.city}.
            </p>

            <dl className="bookmodal__facts">
              <div>
                <dt>Dates</dt>
                <dd>{EVENT.dates}</dd>
              </div>
              <div>
                <dt>Team size</dt>
                <dd>2 – 4</dd>
              </div>
            </dl>

            <RegisterButton className="bookmodal__submit" />
            <p className="bookmodal__note">
              Registration is handled on Unstop.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
