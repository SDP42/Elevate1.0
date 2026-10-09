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
  let res;
  try {
    res = await fetch(`/api${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    // the venue's WiFi dropping for a few seconds shouldn't read as a
    // broken app — this is the one message every scan/save screen shows
    // for it, with a clear next step (retry) rather than a blank error
    throw new Error("Network error — check your connection and try again.");
  }
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

export const requestHelp = (message) =>
  request("/auth", { method: "POST", body: JSON.stringify({ action: "help", message }) });

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

export const mealLog = (teamId, mealSlotCode, memberIds, scanProof) =>
  request("/meal", { method: "POST", body: JSON.stringify({ action: "log", teamId, mealSlotCode, memberIds, scanProof }) });

export const mealUndo = (teamId, mealSlotCode, memberId) =>
  request("/meal", { method: "POST", body: JSON.stringify({ action: "undo", teamId, mealSlotCode, memberId }) });

export const mealTally = () => request("/meal");
export const mealReceipts = (after) => request(`/meal?receipt=1${after == null ? "" : `&after=${after}`}`);
export const mealHistory = (slotCode) => request(`/meal?slotCode=${encodeURIComponent(slotCode)}`);

export const coreTeams = () => request("/core");

export const coreSubmitMark = (teamId, score, mentoring1Feedback, mentoring2Feedback, stage = "mentoring1") =>
  request("/core", { method: "POST", body: JSON.stringify({ teamId, score, mentoring1Feedback, mentoring2Feedback, stage }) });

export const coreSaveRound1Note = (teamId, note) =>
  request("/core", { method: "POST", body: JSON.stringify({ action: "round1-note", teamId, note }) });

export const coreCheckinLookup = (qrPayload) =>
  request("/core", { method: "POST", body: JSON.stringify({ action: "checkin-lookup", qrPayload }) });

export const coreCheckinLog = (teamId, memberIds) =>
  request("/core", { method: "POST", body: JSON.stringify({ action: "checkin-log", teamId, memberIds }) });

export const leaderboard = () => request("/leaderboard");

export const psList = () => request("/ps");

export const selectPs = (preferences) => request("/ps", { method: "POST", body: JSON.stringify({ preferences }) });

export const adminSavePs = (ps) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-ps", ...ps }) });

export const adminSaveTeamMembers = (teamId, members) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-team-members", teamId, members }) });

export const adminSaveTeamName = (accountId, displayName) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-team-name", accountId, displayName }) });

export const adminSetShortlist = (teamId, shortlisted) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "set-shortlist", teamId, shortlisted }) });

export const adminCreateTeam = (payload) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "create-team", ...payload }) });

export const adminSaveTeamNotes = (teamId, dietary) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-team-notes", teamId, dietary }) });

export const adminBulkImport = (csvText) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "bulk-import", csvText }) });

export const adminSaveAnnouncement = (announcement) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "save-announcement", ...announcement }) });

export const adminSaveAssignment = (coreAccountId, teamIds, slotTimes) =>
  request("/admin", {
    method: "POST",
    body: JSON.stringify({ action: "save-assignment", coreAccountId, teamIds, slotTimes }),
  });

export const superLoginActivity = () => request("/admin?resource=login-activity");

export const superPersonaActivity = () => request("/admin?resource=persona-activity");

export const superAuditFull = (role = "", action = "") =>
  request(`/admin?resource=audit-full&role=${encodeURIComponent(role)}&action=${encodeURIComponent(action)}`);

export const adminOverview = () => request("/admin?resource=overview");

export const adminSettings = () => request("/admin?resource=settings");

export const adminFreezeResults = (frozen) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "freeze-results", frozen }) });

export const adminSetWithdrawn = (teamId, withdrawn) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "set-withdrawn", teamId, withdrawn }) });

export const incidentsList = () => request("/incidents");

export const incidentRaise = (type, message, teamId) =>
  request("/incidents", { method: "POST", body: JSON.stringify({ type, message, teamId }) });

export const incidentResolve = (id) =>
  request("/incidents", { method: "POST", body: JSON.stringify({ action: "resolve", id }) });

export const coreToggleRecuse = (teamId) =>
  request("/core", { method: "POST", body: JSON.stringify({ action: "toggle-recuse", teamId }) });

export const mealLogGuest = (teamId, mealSlotCode, note) =>
  request("/meal", { method: "POST", body: JSON.stringify({ action: "log-guest", teamId, mealSlotCode, note }) });

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

export const adminApproveFeedback = (teamId, approved) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "approve-feedback", teamId, approved }) });

export const adminApproveAllFeedback = (approved = true) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "approve-feedback", all: true, approved }) });

export const adminCreateStaff = (payload) =>
  request("/admin", { method: "POST", body: JSON.stringify({ action: "create-staff", ...payload }) });


export const submissionFiles = (teamId) => request(`/auth?resource=submission-files${teamId ? `&teamId=${teamId}` : ""}`);
export const submissionFile = (id, teamId) => request(`/auth?resource=submission-files&fileId=${id}${teamId ? `&teamId=${teamId}` : ""}`);
export const uploadSubmission = (name, base64) => request("/auth", { method: "POST", body: JSON.stringify({ action: "upload", name, base64 }) });

export const staffSnapshot = (endpoint, slotCode, revision, resource = "staff") => request(`/${endpoint}?resource=${encodeURIComponent(resource)}${slotCode ? `&slotCode=${encodeURIComponent(slotCode)}` : ""}${revision ? `&since=${encodeURIComponent(revision)}` : ""}`);

export const adminFinalShortlist = (teamId, shortlisted) => request("/admin", {method:"POST",body:JSON.stringify({action:"final-shortlist",teamId,shortlisted})});

export const regideskSaveMembers = (teamId, members, scanProof) =>
  request("/regidesk", { method: "POST", body: JSON.stringify({ action: "save-members", teamId, members, scanProof }) });
