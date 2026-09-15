import { useEffect, useState } from "react";
import Clouds from "./Clouds";

/* One fixed sky behind the whole opening act. Every section above the prize
   runway is transparent and sits on this single element, so there is no
   boundary where two skies meet — matching colours across a section join can
   never be exact once the layers are scaling independently. */
export default function SkyBackdrop() {
  const [p, setP] = useState(0);
  const [dusk, setDusk] = useState(0);

  useEffect(() => {
    let frame = null;

    const measure = () => {
      frame = null;
      const hero = document.querySelector(".hero");
      if (!hero) return;
      const span = hero.offsetHeight - window.innerHeight;
      setP(span > 0 ? Math.min(Math.max(window.scrollY / span, 0), 1) : 0);

      // the day ages as the page goes on: by the landing it is late afternoon
      const land = document.querySelector(".prizes");
      if (land) {
        const end = land.offsetTop + land.offsetHeight * 0.6;
        setDusk(Math.min(Math.max(window.scrollY / end, 0), 1));
      }
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
  }, []);

  const skyScale = Math.exp(p * Math.log(1.7));
  const cloudScale = Math.exp(p * Math.log(2.6));

  return (
    <div className="sky" aria-hidden="true">
      <div className="sky__grad" style={{ transform: `scale(${skyScale})` }}>
        <Clouds seed={7} freq="0.006" octaves="5" className="sky__cloudFar" />
      </div>
      <div
        className="sky__nearWrap"
        style={{ transform: `scale(${cloudScale})` }}
      >
        <Clouds seed={22} freq="0.013" octaves="4" className="sky__cloudNear" />
      </div>
      {/* warm low sun takes over as the flight goes on */}
      <div
        className="sky__dusk"
        style={{ opacity: Math.max(dusk - 0.25, 0) / 0.75 }}
      />
    </div>
  );
}
