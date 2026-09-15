import { useEffect, useRef } from "react";
import { EVENT, ORGANISER } from "../config";

const LINKS = [
  { href: "#brief", label: "About" },
  { href: "#prizes", label: "Prizes" },
  { href: "#schedule", label: "Schedule" },
  { href: "#perks", label: "Perks" },
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

export default function Header() {
  const ref = useRef(null);
  useInkOverLight(ref);

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
        <div className="jx-header__logo">
          <a className="jx-logo" href="#top" data-jx-logo aria-label={`${EVENT.name} home`}>
            Elevate<span>1.0</span>
          </a>
        </div>
        <div className="jx-header__cta jx-desktop">
          <NavItem href="#schedule">{EVENT.dates}</NavItem>
          <NavItem href={ORGANISER.instagram} target="_blank" rel="noopener noreferrer">
            {ORGANISER.handle}
          </NavItem>
        </div>
      </div>
      <div className="jx-u24" />
    </header>
  );
}
