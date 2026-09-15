import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, CustomEase, SplitText);

// the four curves every tween in the intro is built from
CustomEase.create("InOut", "0.76,0,0.24,1");
CustomEase.create("Out", "0.25,1,0.5,1");
CustomEase.create("In", "0.5,0,0.75,0");
CustomEase.create("ease", "0.25,0.1,0.25,1");

// layouts and scroll choreography switch here
export const BREAKPOINT = 992;

// characters arrive out of a heavy blur, one after another
export function charReveal(el, vars = {}) {
  const split = new SplitText(el, { type: "words,chars", wordsClass: "jx-word", charsClass: "jx-char" });
  gsap.set(split.words, { display: "inline-block", whiteSpace: "nowrap" });
  gsap.set(el, { visibility: "visible" });
  return gsap.from(split.chars, {
    filter: "blur(36px)",
    opacity: 0,
    duration: 1,
    delay: 0.3,
    stagger: 0.05,
    ease: "Out",
    // drop the finished blur so no filter layer is left behind per piece
    clearProps: "filter",
    ...vars,
  });
}

// same treatment a line at a time, for running copy
export function lineReveal(el, vars = {}) {
  const split = new SplitText(el, { type: "lines", linesClass: "jx-line" });
  gsap.set(el, { visibility: "visible" });
  return gsap.from(split.lines, {
    filter: "blur(36px)",
    opacity: 0,
    duration: 1,
    delay: 0.3,
    stagger: 0.1,
    ease: "Out",
    // drop the finished blur so no filter layer is left behind per piece
    clearProps: "filter",
    ...vars,
  });
}

// and a child at a time, for blocks that are not a single run of text
export function childReveal(el, vars = {}) {
  const kids = Array.from(el.children);
  gsap.set(el, { visibility: "visible" });
  return gsap.from(kids, {
    filter: "blur(36px)",
    opacity: 0,
    duration: 1,
    delay: 0.3,
    stagger: 0.1,
    ease: "Out",
    // drop the finished blur so no filter layer is left behind per piece
    clearProps: "filter",
    ...vars,
  });
}

export { gsap, ScrollTrigger, SplitText };
