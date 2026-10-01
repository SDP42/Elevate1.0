// Thin fetch wrapper for the portal's API calls — always sends the session
// cookie, always expects JSON (except the CSV export, read separately),
// and turns a non-2xx response into a thrown Error with the server's own
// message.
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

export const submitProject = (submissionUrl, submissionNote) =>
  request("/auth", { method: "POST", body: JSON.stringify({ action: "submit", submissionUrl, submissionNote }) });

export const adminTeams = () => request("/admin?resource=teams");

export const adminAccounts = () => request("/admin?resource=accounts");

export const adminMeals = () => request("/admin?resource=meals");

export const adminAudit = () => request("/admin?resource=audit");

export const adminAnnouncements = () => request("/admin?resource=announcements");

export const adminAssignments = () => request("/admin?resource=assignments");

/* Triggers a browser download rather than returning JSON — the export
   endpoint sends a raw CSV body. */
export async function adminExport(type) {
  const res = await fetch(`/api/admin?resource=export&type=${type}`, { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `elevate-${type}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const mealLookup = (qrPayload, mealSlotCode) =>
  request("/meal", { method: "POST", body: JSON.stringify({ qrPayload, mealSlotCode }) });

export const mealLookupByCode = (teamCode, mealSlotCode) =>
  request("/meal", { method: "POST", body: JSON.stringify({ action: "lookup-by-code", teamCode, mealSlotCode }) });

export const mealLog = (teamId, mealSlotCode, memberIds) =>
  request("/meal", { method: "POST", body: JSON.stringify({ action: "log", teamId, mealSlotCode, memberIds }) });

export const mealTally = () => request("/meal");

export const coreTeams = () => request("/core");

export const coreSubmitMark = (teamId, criteria, feedback) =>
  request("/core", { method: "POST", body: JSON.stringify({ teamId, criteria, feedback }) });

export const coreSaveRound1Note = (teamId, note) =>
  request("/core", { method: "POST", body: JSON.stringify({ action: "round1-note", teamId, note }) });

export const coreCheckinLookup = (qrPayload) =>
  request("/core", { method: "POST", body: JSON.stringify({ action: "checkin-lookup", qrPayload }) });

export const coreCheckinLog = (teamId, memberIds) =>
  request("/core", { method: "POST", body: JSON.stringify({ action: "checkin-log", teamId, memberIds }) });

export const leaderboard = () => request("/leaderboard");

export const psList = () => request("/ps");

export const selectPs = (psId) => request("/ps", { method: "POST", body: JSON.stringify({ psId }) });

export const adminSavePs = (ps) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-ps", ...ps }) });

export const adminSaveTeamMembers = (teamId, members) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-team-members", teamId, members }) });

export const adminSetShortlist = (teamId, shortlisted) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "set-shortlist", teamId, shortlisted }) });

export const adminSaveTeamNotes = (teamId, dietary) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-team-notes", teamId, dietary }) });

export const adminBulkImport = (csvText) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "bulk-import", csvText }) });

export const adminResetPassword = (accountId) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "reset-password", accountId }) });

export const adminSaveAnnouncement = (announcement) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-announcement", ...announcement }) });

export const adminSaveAssignment = (coreAccountId, teamIds) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-assignment", coreAccountId, teamIds }) });

export const adminPsRequests = () => request("/admin?resource=ps-requests");

export const adminApprovePs = (teamId) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "approve-ps", teamId }) });

export const adminRevokePs = (teamId) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "revoke-ps", teamId }) });

export const regideskLookup = (qrPayload) =>
  request("/regidesk", { method: "POST", body: JSON.stringify({ qrPayload }) });

export const regideskLookupByCode = (teamCode) =>
  request("/regidesk", { method: "POST", body: JSON.stringify({ action: "lookup-by-code", teamCode }) });

export const regideskSave = (memberId, teamId, details) =>
  request("/regidesk", { method: "POST", body: JSON.stringify({ action: "save", memberId, teamId, ...details }) });
