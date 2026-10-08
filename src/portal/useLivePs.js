import { useEffect, useRef } from 'react';

// Visible screens refresh promptly; never overlap requests or poll hidden tabs.
export default function useLivePs(load) {
  const loader = useRef(load);
  useEffect(() => { loader.current = load; }, [load]);
  useEffect(() => {
    let stopped = false, timer, busy = false;
    async function refresh() {
      if (stopped || busy) return;
      if (document.hidden) return;
      busy = true;
      let delay = 5000;
      const started = performance.now();
      try {
        const data = await loader.current();
        if (data?.selectionOpen === false && data.opensAt && data.serverNow) {
          // Schedule against server time, independent of the device's wall clock.
          // The next request lands at the opening boundary, even between polls.
          const remaining = Date.parse(data.opensAt) - Date.parse(data.serverNow)
            - (performance.now() - started) / 2;
          delay = Math.max(50, Math.min(delay, remaining));
        }
      } finally {
        busy = false;
        if (!stopped) timer = setTimeout(refresh, delay);
      }
    }
    const visible = () => { clearTimeout(timer); if (!document.hidden) refresh(); };
    refresh();
    document.addEventListener('visibilitychange', visible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
}
