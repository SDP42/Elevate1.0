// Thin fetch wrapper for the portal's API calls — always sends the session
// cookie, always expects JSON, and turns a non-2xx response into a thrown
// Error with the server's own message.
//
// The backend groups related endpoints into one function per file (Vercel's
// Hobby plan caps a deployment at 12 serverless functions), so a single
// path like /api/admin serves several things, picked by method and an
// `action`/`resource` field — see each api/*.js file for its own branches.
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const login = (username, password) =>
  request("/auth", { method: "POST", body: JSON.stringify({ username, password }) });

export const logout = () => request("/auth", { method: "POST", body: JSON.stringify({ action: "logout" }) });

export const me = () => request("/auth");

export const adminTeams = () => request("/admin?resource=teams");

export const adminAccounts = () => request("/admin?resource=accounts");

export const adminMeals = () => request("/admin?resource=meals");

export const mealLookup = (qrPayload, mealSlotCode) =>
  request("/meal", { method: "POST", body: JSON.stringify({ qrPayload, mealSlotCode }) });

export const mealLog = (teamId, mealSlotCode, memberIds) =>
  request("/meal", { method: "POST", body: JSON.stringify({ action: "log", teamId, mealSlotCode, memberIds }) });

export const coreTeams = () => request("/core");

export const coreSubmitMark = (teamId, score) =>
  request("/core", { method: "POST", body: JSON.stringify({ teamId, score }) });

export const leaderboard = () => request("/leaderboard");

export const psList = () => request("/ps");

export const selectPs = (psId) => request("/ps", { method: "POST", body: JSON.stringify({ psId }) });

export const adminSavePs = (ps) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-ps", ...ps }) });

export const adminSaveTeamMembers = (teamId, members) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-team-members", teamId, members }) });
