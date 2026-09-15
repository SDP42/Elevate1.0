import { useEffect, useRef, useState } from "react";

/* True while the element is meaningfully on screen. It re-arms once the
   element has left the viewport completely, so an arrival animation plays
   again when the visitor scrolls back to it from either direction — scrolling
   up should feel like scrolling down in reverse, not like a page that has
   gone still.

   "Meaningfully" is either the ratio threshold or a quarter of the viewport
   height, so tall blocks that can never reach the ratio still trigger. */
export default function useInView(threshold = 0.3) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  // which edge the element last left by: "bottom" (still below, the normal
  // way down) or "top" (scrolled past, so it will come back from above)
  const [from, setFrom] = useState("bottom");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        const enough =
          entry.intersectionRatio >= threshold ||
          entry.intersectionRect.height > window.innerHeight * 0.25;
        if (entry.isIntersecting && enough) {
          setInView(true);
        } else if (!entry.isIntersecting) {
          setFrom(entry.boundingClientRect.top < 0 ? "top" : "bottom");
          setInView(false);
        }
      },
      { threshold: [0, 0.05, threshold, Math.min(threshold + 0.25, 1)] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, inView, from];
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
