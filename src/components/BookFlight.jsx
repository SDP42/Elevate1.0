import { useState } from "react";
import RegisterButton from "./RegisterButton";
import { EVENT } from "../config";

export default function BookFlight() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="bookfab" onClick={() => setOpen(true)}>
        Register Now
      </button>

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
