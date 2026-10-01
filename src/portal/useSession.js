import { useEffect, useState } from "react";
import { me } from "./api";

/* Who's logged in, per the session cookie — checked once on mount. Three
   states a consumer needs to tell apart: still checking, no one (null),
   or a session object with { role, displayName, team }. */
export default function useSession() {
  const [state, setState] = useState({ loading: true, session: null });

  useEffect(() => {
    let cancelled = false;
    me()
      .then((session) => {
        if (!cancelled) setState({ loading: false, session });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, session: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
