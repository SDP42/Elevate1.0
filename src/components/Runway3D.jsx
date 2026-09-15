import { useEffect, useRef } from "react";
import { createRunwayScene } from "../three/runwayScene";

/* Vanilla-Three.js replacement for the flat top-view landing graphic: real
   3D aircraft, camera low and front-on during approach, rising to an
   elevated view over their tails once they're down. Driven purely by `t`,
   the same 0..1 landing progress PrizeFleet already computes from scroll. */
export default function Runway3D({ t }) {
  const canvasRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const api = createRunwayScene(canvas);
    apiRef.current = api;
    api.setRunning(true);

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
    apiRef.current?.setState({ t });
  }, [t]);

  return (
    <div className="land__scene3d">
      <canvas ref={canvasRef} />
    </div>
  );
}
