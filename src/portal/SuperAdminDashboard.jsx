import RequireRole from "./RequireRole";
import { AdminHome } from "./AdminDashboard";

/* The oversight login: everything the admin dashboard has, plus the login
   history and per-persona activity that plain admin never sees. */
export default function SuperAdminDashboard() {
  return <RequireRole role="superadmin">{(session) => <AdminHome session={session} superAdmin />}</RequireRole>;
}
