/* Tiny global handle on the sound engine. The toggle registers the engine
   when sound is switched on; everything else calls cue() and gets silence
   when sound is off, so no component needs to know the audio state. */
let active = null;

export function setActiveEngine(engine) {
  active = engine;
}

export function cue(name, ...args) {
  if (active && typeof active[name] === "function") active[name](...args);
}
