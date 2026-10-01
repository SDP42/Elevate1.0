// Thin fetch wrapper for the portal's API calls — always sends the session
// cookie, always expects JSON, and turns a non-2xx response into a thrown
// Error with the server's own message.
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
  request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });

export const logout = () => request("/auth/logout", { method: "POST" });

export const me = () => request("/auth/me");

export const adminTeams = () => request("/admin/teams");

export const adminAccounts = () => request("/admin/accounts");

export const adminMeals = () => request("/admin/meals");

export const mealLookup = (qrPayload, mealSlotCode) =>
  request("/meal/lookup", { method: "POST", body: JSON.stringify({ qrPayload, mealSlotCode }) });

export const mealLog = (teamId, mealSlotCode, memberIds) =>
  request("/meal/log", { method: "POST", body: JSON.stringify({ teamId, mealSlotCode, memberIds }) });

export const coreTeams = () => request("/core/teams");

export const coreSubmitMark = (teamId, score) =>
  request("/core/marks", { method: "POST", body: JSON.stringify({ teamId, score }) });

export const leaderboard = () => request("/leaderboard");

export const psList = () => request("/ps");

export const selectPs = (psId) => request("/team/select-ps", { method: "POST", body: JSON.stringify({ psId }) });

export const adminSavePs = (ps) => request("/admin/ps", { method: "POST", body: JSON.stringify(ps) });

export const adminSaveTeamMembers = (teamId, members) =>
  request("/admin/team-members", { method: "POST", body: JSON.stringify({ teamId, members }) });
