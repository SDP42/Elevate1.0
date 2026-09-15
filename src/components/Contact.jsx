import RegisterButton from "./RegisterButton";
import { EVENT, registrationOpen } from "../config";

export default function Contact() {
  return (
    <section id="register" data-label="Registration" className="contact">
      <div className="container contact__grid">
        <div>
          <span className="eyebrow">Registration</span>
          <h2 className="section-title">Get your team on the manifest.</h2>
          <p className="contact__copy">
            {EVENT.name} is a {EVENT.format} organised by {EVENT.organiser},
            the {EVENT.department} committee at {EVENT.college}, {EVENT.city}.
            Registration is handled on Unstop, and opens the online qualifier
            round — the top thirty teams are called to the on-campus finale.
          </p>
        </div>

        <div className="contact__panel" data-reveal>
          <dl className="contact__facts">
            <div>
              <dt>Dates</dt>
              <dd>{EVENT.dates}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>Online round, then 24h finale</dd>
            </div>
            <div>
              <dt>Team size</dt>
              <dd>2 – 4 members</dd>
            </div>
            <div>
              <dt>Domains</dt>
              <dd>Revealed soon</dd>
            </div>
          </dl>

          <RegisterButton className="contact__submit" />

          <p className="contact__note">
            {registrationOpen()
              ? "Opens in a new tab on Unstop."
              : "The Unstop registration link goes live shortly."}
          </p>
        </div>
      </div>
    </section>
  );
}
