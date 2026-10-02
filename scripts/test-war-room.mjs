import { sql } from "../api/_lib/db.js";

const BASE_URL = "http://localhost:5173";

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, errorDetail = "") {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed += 1;
  } else {
    console.error(`  [FAIL] ${testName} - ${errorDetail}`);
    failed += 1;
    failures.push({ test: testName, error: errorDetail });
  }
}

async function api(path, options = {}, cookie = "") {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(`${BASE_URL}/api${path}`, { ...options, headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, data: json, raw: text };
}

async function loginAs(username, password) {
  const res = await api("/auth", {
    method: "POST",
    body: JSON.stringify({ action: "login", username, password }),
  });
  const cookie = res.headers.get("set-cookie") || "";
  return { res, cookie, data: res.data };
}

async function cleanupTestData() {
  await sql.query(
    "delete from accounts where id in (select account_id from teams where team_code in ('T97', 'T98', 'T99'))"
  );
  await sql.query("delete from ps_list where code in ('PS01', 'PS02')");
}

async function runComprehensiveTest() {
  console.log("\n=======================================================");
  console.log("  WAR ROOM COMPLETE ZERO-FAILURE SIMULATION SUITE");
  console.log("=======================================================\n");

  await cleanupTestData();

  // Fetch actual credentials from DB directly so we are 100% current
  const accounts = await sql.query(`
    select a.id, a.username, a.role, a.initial_password, t.id as team_id, t.team_code, t.qr_token
    from accounts a
    left join teams t on t.account_id = a.id
    order by a.id asc
  `);

  const adminAcc = accounts.find((a) => a.role === "admin");
  const coreAcc = accounts.find((a) => a.role === "core");
  const regiAcc = accounts.find((a) => a.role === "regidesk");
  const mealAcc = accounts.find((a) => a.role === "meal");
  const teamAcc = accounts.find((a) => a.role === "team");

  console.log("Current Live Accounts:", {
    admin: adminAcc?.username,
    core: coreAcc?.username,
    regi: regiAcc?.username,
    meal: mealAcc?.username,
    team: teamAcc?.username,
  });

  // 1. AUTHENTICATION & SESSIONS
  console.log("\n--- 1. Authentication & Role Security ---");
  const adminLog = await loginAs(adminAcc.username, adminAcc.initial_password);
  assert(adminLog.res.status === 200 && adminLog.data?.role === "admin", "Admin login succeeds");

  const coreLog = await loginAs(coreAcc.username, coreAcc.initial_password);
  assert(coreLog.res.status === 200 && coreLog.data?.role === "core", "Core judge login succeeds");

  const regiLog = await loginAs(regiAcc.username, regiAcc.initial_password);
  assert(regiLog.res.status === 200 && regiLog.data?.role === "regidesk", "RegiDesk login succeeds");

  const mealLog = await loginAs(mealAcc.username, mealAcc.initial_password);
  assert(mealLog.res.status === 200 && mealLog.data?.role === "meal", "Meal counter login succeeds");

  const teamLog = await loginAs(teamAcc.username, teamAcc.initial_password);
  assert(teamLog.res.status === 200 && teamLog.data?.role === "team", "Team login succeeds");

  // Invalid password
  const badLog = await api("/auth", {
    method: "POST",
    body: JSON.stringify({ action: "login", username: teamAcc.username, password: "IncorrectPassword" }),
  });
  assert(badLog.status === 401, "Invalid password returns 401");

  // Unauthorized route protection
  const teamOnAdmin = await api("/admin?resource=teams", {}, teamLog.cookie);
  assert(teamOnAdmin.status === 401, "Team role denied access to /api/admin");

  const mealOnCore = await api("/core", {}, mealLog.cookie);
  assert(mealOnCore.status === 401, "Meal counter denied access to /api/core");

  const regiOnAdmin = await api("/admin?resource=overview", {}, regiLog.cookie);
  assert(regiOnAdmin.status === 401, "RegiDesk denied access to /api/admin");

  // 2. ADMIN ENDPOINTS
  console.log("\n--- 2. Admin Capabilities & Data Integrity ---");
  const overview = await api("/admin?resource=overview", {}, adminLog.cookie);
  assert(overview.status === 200 && typeof overview.data.teamCount === "number", "Admin overview returns stats");

  const teamsRes = await api("/admin?resource=teams", {}, adminLog.cookie);
  assert(teamsRes.status === 200 && teamsRes.data.teams.length >= 35, "Admin lists all teams");

  const accountsRes = await api("/admin?resource=accounts", {}, adminLog.cookie);
  assert(
    accountsRes.status === 200 && accountsRes.data.accounts.every((a) => Boolean(a.initialPassword)),
    "Admin accounts view exposes cleartext passwords for all accounts"
  );

  // Test Admin: Announcements
  const annRes = await api(
    "/admin",
    {
      method: "POST",
      body: JSON.stringify({
        action: "save-announcement",
        message: "Simulation: Gates are officially open!",
        pinned: true,
        sortOrder: 1,
      }),
    },
    adminLog.cookie
  );
  assert(annRes.status === 200, "Admin can create pinned announcement");

  // Test Admin: Create Team
  const testCode = "T99";
  const createTeamRes = await api(
    "/admin",
    {
      method: "POST",
      body: JSON.stringify({
        action: "create-team",
        teamCode: testCode,
        displayName: "Nexus Titans",
        seatNo: 99,
        members: ["Titans Lead", "Titans Dev"],
        shortlisted: true,
      }),
    },
    adminLog.cookie
  );
  assert(createTeamRes.status === 200, "Admin create team succeeds");
  const createdTeam = createTeamRes.data;
  assert(Boolean(createdTeam.qrToken), "Newly created team has an active QR token");
  assert(Boolean(createdTeam.password), "Newly created team has an initial password");

  // Test Admin: Rename Team (testing both accountId and teamId resilience)
  const renameRes = await api(
    "/admin",
    {
      method: "POST",
      body: JSON.stringify({
        action: "save-team-name",
        teamId: createdTeam.teamId,
        displayName: "Nexus Vipers",
      }),
    },
    adminLog.cookie
  );
  console.log("  [DEBUG] Rename with teamId status:", renameRes.status, renameRes.data);

  // Test Admin: Bulk Import with Team Names
  const bulkRes = await api(
    "/admin",
    {
      method: "POST",
      body: JSON.stringify({
        action: "bulk-import",
        csvText: "T97,VectorSquad,Vector Lead,Vector Member",
      }),
    },
    adminLog.cookie
  );
  assert(bulkRes.status === 200 && bulkRes.data.results?.[0]?.ok, "Bulk import with team name succeeds");

  // 3. REGISTRATION DESK FLOW
  console.log("\n--- 3. Registration Desk Check-In ---");
  // Lookup created team by QR
  const qrScanRes = await api(
    "/regidesk",
    {
      method: "POST",
      body: JSON.stringify({ qrPayload: `ELEVATE1:${createdTeam.qrToken}` }),
    },
    regiLog.cookie
  );
  assert(qrScanRes.status === 200, "RegiDesk can scan team QR code");
  assert(Boolean(qrScanRes.data.team?.teamName || qrScanRes.data.team?.displayName), "RegiDesk returns team name");

  // Lookup by team code
  const codeLookupRes = await api(
    "/regidesk",
    {
      method: "POST",
      body: JSON.stringify({ action: "lookup-by-code", teamCode: testCode }),
    },
    regiLog.cookie
  );
  assert(codeLookupRes.status === 200, "RegiDesk can look up team by code");

  // Save member check-in
  const memberToSave = qrScanRes.data.members[0];
  const saveMemberRes = await api(
    "/regidesk",
    {
      method: "POST",
      body: JSON.stringify({
        action: "save",
        memberId: memberToSave.id,
        teamId: createdTeam.teamId,
        githubId: "octocat",
        govtIdChecked: true,
        bagChecked: true,
        kitChecked: true,
        medicalNote: "None",
        lateArrival: false,
        notes: "Checked in on time",
      }),
    },
    regiLog.cookie
  );
  assert(saveMemberRes.status === 200, "RegiDesk check-in details saved");

  // 4. MEAL COUNTER FLOW
  console.log("\n--- 4. Meal Counter Flow & Rule Enforcement ---");
  // Team 97 has NOT checked in at registration desk yet
  const t97Rows = await sql.query("select qr_token from teams where team_code = 'T97'");
  const t97Qr = t97Rows[0]?.qr_token;
  const uncheckinMeal = await api(
    "/meal",
    {
      method: "POST",
      body: JSON.stringify({ qrPayload: `ELEVATE1:${t97Qr}`, mealSlotCode: "d1_lunch" }),
    },
    mealLog.cookie
  );
  assert(
    uncheckinMeal.status === 403 && uncheckinMeal.data.error.includes("not checked in at the registration desk"),
    "Meal scan properly blocks teams who have not checked in at registration desk"
  );

  // T99 HAS checked in -> meal scan should succeed
  const validMealScan = await api(
    "/meal",
    {
      method: "POST",
      body: JSON.stringify({ qrPayload: `ELEVATE1:${createdTeam.qrToken}`, mealSlotCode: "d1_lunch" }),
    },
    mealLog.cookie
  );
  assert(validMealScan.status === 200, "Meal scan succeeds for checked-in team");

  // Log meal for member
  const mealMemberId = validMealScan.data.members[0].id;
  const logMealRes = await api(
    "/meal",
    {
      method: "POST",
      body: JSON.stringify({
        action: "log",
        teamId: createdTeam.teamId,
        mealSlotCode: "d1_lunch",
        memberIds: [mealMemberId],
      }),
    },
    mealLog.cookie
  );
  assert(logMealRes.status === 200, "Meal successfully logged for member");

  // Scan again -> should show member as already given
  const reScanMeal = await api(
    "/meal",
    {
      method: "POST",
      body: JSON.stringify({ qrPayload: `ELEVATE1:${createdTeam.qrToken}`, mealSlotCode: "d1_lunch" }),
    },
    mealLog.cookie
  );
  const servedMember = reScanMeal.data.members.find((m) => m.id === mealMemberId);
  assert(servedMember?.alreadyGiven === true, "Double-swipe prevention: member is marked already given");

  // Undo meal
  const undoRes = await api(
    "/meal",
    {
      method: "POST",
      body: JSON.stringify({
        action: "undo",
        teamId: createdTeam.teamId,
        mealSlotCode: "d1_lunch",
        memberId: mealMemberId,
      }),
    },
    mealLog.cookie
  );
  assert(undoRes.status === 200, "Meal counter can undo accidental meal scan");

  // 5. CORE / JUDGING FLOW
  console.log("\n--- 5. Core Mentoring & Marks Entry ---");
  const coreTeamsList = await api("/core", {}, coreLog.cookie);
  assert(coreTeamsList.status === 200, "Core can fetch assigned teams");
  // Check if T99 (checked in) appears
  const t99InCore = coreTeamsList.data.teams.find((t) => t.teamCode === testCode);
  assert(Boolean(t99InCore), "Checked-in team T99 appears in Core dashboard");

  // Add Round 1 Note
  const r1NoteRes = await api(
    "/core",
    {
      method: "POST",
      body: JSON.stringify({
        action: "round1-note",
        teamId: createdTeam.teamId,
        note: "Great progress on architecture during morning check-in",
      }),
    },
    coreLog.cookie
  );
  assert(r1NoteRes.status === 200, "Core can add Round 1 mentoring note");

  // Submit Round 2 Marks
  const marksRes = await api(
    "/core",
    {
      method: "POST",
      body: JSON.stringify({
        teamId: createdTeam.teamId,
        criteria: {
          innovation: 23,
          technical: 23,
          impact: 23,
          presentation: 23,
        },
        feedback: "Impressive live demo and system design.",
      }),
    },
    coreLog.cookie
  );
  assert(marksRes.status === 200, "Core can submit Round 2 evaluation marks");

  // 6. TEAM DASHBOARD & PROBLEM STATEMENTS
  console.log("\n--- 6. Team Experience & Problem Statements ---");
  const teamMe = await api("/auth", {}, teamLog.cookie);
  assert(teamMe.status === 200 && teamMe.data.team, "Team can fetch /api/auth me profile");
  // Admin creates problem statements
  await api(
    "/admin",
    {
      method: "POST",
      body: JSON.stringify({
        action: "save-ps",
        code: "PS01",
        title: "Autonomous Drone Logistics",
        description: "Develop routing and obstacle avoidance",
        capacity: 5,
        revealed: true,
        sortOrder: 1,
      }),
    },
    adminLog.cookie
  );

  await api(
    "/admin",
    {
      method: "POST",
      body: JSON.stringify({
        action: "save-ps",
        code: "PS02",
        title: "Smart Campus Energy Grid",
        description: "Optimize power consumption",
        capacity: 5,
        revealed: true,
        sortOrder: 2,
      }),
    },
    adminLog.cookie
  );

  // PS Selection
  const psListRes = await api("/ps", {}, teamLog.cookie);
  assert(psListRes.status === 200 && psListRes.data.problemStatements.length >= 2, "Team can view revealed PS list");
  const firstPs = psListRes.data.problemStatements[0];

  const pickPsRes = await api(
    "/ps",
    {
      method: "POST",
      body: JSON.stringify({ psId: firstPs.id }),
    },
    teamLog.cookie
  );
  assert(pickPsRes.status === 200, "Team can request problem statement");

  // Admin approves PS
  const approvePsRes = await api(
    "/admin",
    {
      method: "POST",
      body: JSON.stringify({ action: "approve-ps", teamId: teamAcc.team_id }),
    },
    adminLog.cookie
  );
  assert(approvePsRes.status === 200, "Admin can approve team problem statement");

  // Team tries to change PS after approval -> must be rejected (locked in)
  if (psListRes.data.problemStatements[1]) {
    const secondPs = psListRes.data.problemStatements[1];
    const changeLockedPs = await api(
      "/ps",
      {
        method: "POST",
        body: JSON.stringify({ psId: secondPs.id }),
      },
      teamLog.cookie
    );
    assert(
      changeLockedPs.status === 409,
      "Team cannot change problem statement after admin approval (locked in)"
    );
  }

  // Project submission
  const submitRes = await api(
    "/auth",
    {
      method: "POST",
      body: JSON.stringify({
        action: "submit",
        submissionUrl: "https://github.com/elevate/project-alpha",
        submissionNote: "Ready for evaluation",
      }),
    },
    teamLog.cookie
  );
  assert(submitRes.status === 200, "Team can submit project repository URL");

  // Team SOS help request
  const sosRes = await api(
    "/auth",
    {
      method: "POST",
      body: JSON.stringify({ action: "help", message: "Power socket stopped working at seat 99" }),
    },
    teamLog.cookie
  );
  assert(sosRes.status === 200, "Team can raise SOS help request");

  // 7. LEADERBOARD & INCIDENTS
  console.log("\n--- 7. Leaderboard & Incident Resolution ---");
  const lbRes = await api("/leaderboard", {}, teamLog.cookie);
  assert(lbRes.status === 200 && Array.isArray(lbRes.data.leaderboard), "Leaderboard accessible to teams");
  // Check if T99 (scored) appears on leaderboard
  const t99InLb = lbRes.data.leaderboard.find((r) => r.teamCode === testCode);
  assert(Boolean(t99InLb && t99InLb.score === 92), `T99 scored 92 on leaderboard (got ${t99InLb?.score})`);

  // Incident resolution by admin
  const incidentsRes = await api("/incidents", {}, adminLog.cookie);
  assert(incidentsRes.status === 200 && incidentsRes.data.incidents.length > 0, "Admin can view open incidents");
  const openSos = incidentsRes.data.incidents.find((i) => i.type === "sos");
  if (openSos) {
    const resolveRes = await api(
      "/incidents",
      {
        method: "POST",
        body: JSON.stringify({ action: "resolve", id: openSos.id }),
      },
      adminLog.cookie
    );
    assert(resolveRes.status === 200, "Admin can resolve SOS incident");
  }

  // Freeze results
  const freezeRes = await api(
    "/admin",
    {
      method: "POST",
      body: JSON.stringify({ action: "freeze-results", frozen: true }),
    },
    adminLog.cookie
  );
  assert(freezeRes.status === 200, "Admin can freeze leaderboard results");
  const frozenLb = await api("/leaderboard", {}, teamLog.cookie);
  assert(frozenLb.data.frozen === true, "Leaderboard reports frozen state to all viewers");

  // Unfreeze leaderboard for normal operation
  await api(
    "/admin",
    {
      method: "POST",
      body: JSON.stringify({ action: "freeze-results", frozen: false }),
    },
    adminLog.cookie
  );

  // Complete cleanup of test teams and test PS items
  await cleanupTestData();

  console.log("\n=======================================================");
  console.log(`TOTAL CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  if (failures.length > 0) {
    console.log("FAILURES TO FIX:");
    failures.forEach((f) => console.log(` - ${f.test}: ${f.error}`));
  }
  console.log("=======================================================\n");
}

runComprehensiveTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
