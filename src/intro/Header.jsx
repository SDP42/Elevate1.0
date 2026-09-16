import { useEffect, useRef, useState } from "react";
import { EVENT, ORGANISER } from "../config";

const LINKS = [
  { href: "#brief", label: "About" },
  { href: "#prizes", label: "Prizes" },
];

/* Label rolls up to a duplicate and a soft plate rises behind it on hover. */
export function NavItem({ href, children, ...rest }) {
  return (
    <a className="jx-nav-item" href={href} {...rest}>
      <span className="jx-nav-item__label">
        <span className="jx-t7">{children}</span>
        <span className="jx-t7 jx-is-2" aria-hidden="true">
          {children}
        </span>
      </span>
      <span className="jx-nav-item__bg" aria-hidden="true">
        <span className="jx-nav-item__hover" />
      </span>
    </a>
  );
}

/* Ink-coloured header while a light section sits under it. The jet section
   sets its own class from its scroll timeline; plain light sections opt in
   with data-header-ink. */
function useInkOverLight(ref) {
  useEffect(() => {
    let frame = null;
    const check = () => {
      frame = null;
      const y = 40;
      const over = [...document.querySelectorAll("[data-header-ink]")].some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= y && r.bottom >= y;
      });
      ref.current?.classList.toggle("jx-header--light-bg", over);
    };
    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);
}

/* the desktop links, folded into one list so the phone drawer and the
   inline nav/cta groups all read from the same source */
const ALL_LINKS = [
  ...LINKS,
  { href: "#schedule", label: "Schedule" },
  { href: ORGANISER.instagram, label: ORGANISER.handle, external: true },
];

export default function Header() {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  useInkOverLight(ref);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("jx-menu-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("jx-menu-open");
    };
  }, [open]);

  return (
    <header className="jx-header" data-jx-header ref={ref}>
      <div className="jx-u24" />
      <div className="jx-header__c">
        <nav className="jx-header__nav jx-desktop">
          {LINKS.map((l) => (
            <NavItem key={l.href} href={l.href}>
              {l.label}
            </NavItem>
          ))}
        </nav>
        <button
          type="button"
          className="jx-menu-btn jx-mobile"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`jx-menu-btn__bars${open ? " is-open" : ""}`}>
            <i />
            <i />
            <i />
          </span>
        </button>
        <div className="jx-header__logo">
          <a className="jx-logo" href="#top" data-jx-logo aria-label={`${EVENT.name} home`}>
            Elevate<span>1.0</span>
          </a>
        </div>
        <div className="jx-header__cta jx-desktop">
          <NavItem href="#schedule">Schedule</NavItem>
          <NavItem href={ORGANISER.instagram} target="_blank" rel="noopener noreferrer">
            {ORGANISER.handle}
          </NavItem>
        </div>
      </div>
      <div className="jx-u24" />

      <div className={`jx-mobile-menu${open ? " is-open" : ""}`}>
        <nav className="jx-mobile-menu__links">
          {ALL_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener noreferrer" : undefined}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
      <button
        type="button"
        className={`jx-mobile-menu__backdrop${open ? " is-open" : ""}`}
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />
    </header>
  );
}
