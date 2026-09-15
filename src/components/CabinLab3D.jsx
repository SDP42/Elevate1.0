import { useEffect, useRef, useState } from "react";
import { createLabScene } from "../three/labScene";
import useInView from "../hooks/useInView";

/* How far the section has scrolled through the viewport, 0 (just arriving
   at the bottom) to 1 (about to leave at the top) — drives the camera pan
   across the table, so scrolling further into the cabin reveals the room. */
function useSectionScroll(ref) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let frame = null;
    const measure = () => {
      frame = null;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const span = window.innerHeight + rect.height;
      const raw = (window.innerHeight - rect.top) / span;
      setT(Math.min(Math.max(raw, 0), 1));
    };
    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);
  return t;
}

/* Vanilla-Three.js interior: what the cabin turns into for the 24 hours —
   a team of four at a shared table, laptops open. Scrolling pans the camera
   down the table; dragging looks around further on top of that. */
export default function CabinLab3D() {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const [wrapRef, inView] = useInView(0.15);
  const scrollT = useSectionScroll(wrapRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    const api = createLabScene(canvas);
    apiRef.current = api;

    const el = canvas.parentElement;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      api.resize(rect.width, rect.height);
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    api.resize(rect.width, rect.height);

    return () => {
      ro.disconnect();
      api.dispose();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    apiRef.current?.setRunning(inView);
  }, [inView]);

  useEffect(() => {
    apiRef.current?.setState({ scrollT });
  }, [scrollT]);

  return (
    <section id="cabin-lab" data-label="Onboard" className="lab" ref={wrapRef}>
      {/* the build bay sits in open sky: the same clouds the flight began in */}
      <div className="lab__sky" aria-hidden="true">
        <span className="lab__cloud lab__cloud--a" />
        <span className="lab__cloud lab__cloud--b" />
        <span className="lab__cloud lab__cloud--c" />
      </div>
      <div className="lab__stage">
        <canvas ref={canvasRef} />
      </div>
    </section>
  );
}
