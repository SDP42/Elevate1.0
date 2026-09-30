import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useInView";

/* Deadline reminders that matter this week — kept out of the scroll story
   entirely and pinned under the nav as a departures-board ticker, the one
   place on the site guaranteed to be seen without scrolling. */
const ANNOUNCEMENTS = [
  "Last day to register: 3 October, 11:59 PM",
  "Submission deadline: 3 October, 11:59 PM",
];

/* Sits fixed just under the header. The header floats over the page and
   never reserves layout space for itself, so this bar measures the
   header's real, responsive height instead of guessing a fixed offset. */
function useHeaderHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const header = document.querySelector(".jx-header");
    if (!header) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
  return height;
}

export default function Announcements() {
  const top = useHeaderHeight();
  const reduced = useRef(prefersReducedMotion()).current;

  return (
    <div
      className="announce"
      style={{ top }}
      role="region"
      aria-label="Announcements"
    >
      <div className={`announce__track${reduced ? " is-static" : ""}`}>
        {(reduced ? [0] : [0, 1]).map((rep) => (
          <div className="announce__set" aria-hidden={rep === 1} key={rep}>
            {ANNOUNCEMENTS.map((line) => (
              <span className="announce__item" key={line}>
                <i className="announce__dot" />
                {line}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
