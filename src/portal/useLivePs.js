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
      try { await loader.current(); } finally {
        busy = false;
        if (!stopped) timer = setTimeout(refresh, 5000);
      }
    }
    const visible = () => { clearTimeout(timer); if (!document.hidden) refresh(); };
    refresh();
    document.addEventListener('visibilitychange', visible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
}
