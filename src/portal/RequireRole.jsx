import { Navigate } from "react-router-dom";
import useSession from "./useSession";

const DASHBOARD_PATH = {
  admin: "/portal/admin",
  core: "/portal/core",
  meal: "/portal/meal",
  team: "/portal/team",
  regidesk: "/portal/regidesk",
  volunteer: "/portal/volunteer",
};

/* Gate a dashboard behind a logged-in session with the right role. Not
   logged in → the login page. Logged in as the wrong role → their own
   dashboard, not an error page — the login tab someone picks is just a
   hint, the account's real role always wins. */
export default function RequireRole({ role, children }) {
  const { loading, session } = useSession();

  if (loading) return <div className="portal-loading">Checking your session…</div>;
  if (!session) return <Navigate to="/portal/login" replace />;
  if (session.role !== role) return <Navigate to={DASHBOARD_PATH[session.role]} replace />;

  return children(session);
}
