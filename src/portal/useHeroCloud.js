import { useEffect, useState } from "react";
import { paintSky } from "../intro/skyPainter";

/* The same cloud sea as the marketing site's own boarding pass — same
   seed, same mode — so the portal doesn't invent a second sky, it's the
   one the site already promised, continued into the tool people actually
   use on the day. */
export default function useHeroCloud(seed = 3) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    let made = "";
    const ratio = window.innerHeight / Math.max(window.innerWidth, 1);
    const width = Math.min(1600, Math.round(window.innerWidth * Math.min(window.devicePixelRatio || 1, 1.5)));
    paintSky({ hero: { mode: "hero", width, height: Math.round(width * ratio * 1.4), seed } })
      .then((out) => {
        made = out.hero || "";
        if (cancelled) {
          if (made) URL.revokeObjectURL(made);
        } else {
          setUrl(made);
        }
      })
      .catch(() => {
        /* no WebGL — the CSS gradient underneath still reads as sky */
      });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [seed]);

  return url;
}
