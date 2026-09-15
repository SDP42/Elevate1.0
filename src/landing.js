import { range, easeInOut } from "./hooks/useScrollProgress";

/* Shared landing timing. The animation and the sound engine both read from
   here, so the tyre chirp can never drift out of step with the touchdown. */
export const TOUCHDOWN = 0.68;

export const landingT = (sectionProgress) =>
  easeInOut(range(sectionProgress, 0.06, 0.8));

/* The two opening-act scroll spans the audio needs, measured straight from
   the DOM so they stay correct whatever the section heights become. */
export function sectionProgress(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const span = el.offsetHeight - window.innerHeight;
  if (span <= 0) return null;
  return {
    p: Math.min(Math.max(-rect.top / span, 0), 1),
    visible: rect.bottom > 0 && rect.top < window.innerHeight,
  };
}
