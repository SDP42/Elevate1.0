import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "#prizes", label: "Prizes" },
  { href: "#timeline", label: "Schedule" },
  { href: "#perks", label: "Perks" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const clicks = useRef([]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // five quick taps on the wordmark call in a fly-over
  const onBrand = () => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 1800), now];
    if (clicks.current.length >= 5) {
      clicks.current = [];
      window.dispatchEvent(new Event("elevate:flyover"));
    }
  };

  return (
    <header className={`nav ${scrolled ? "nav--scrolled" : ""}`}>
      <div className="nav__inner container">
        <a href="#top" className="nav__brand" onClick={onBrand}>
          ELEVATE <em>1.0</em>
        </a>
        <nav className="nav__links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <a href="#register" className="nav__cta">
          Register
        </a>
      </div>
    </header>
  );
}
