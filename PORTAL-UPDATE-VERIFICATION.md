# Portal update verification — 8 October 2026

## Legacy PS cleanup

PS1 Smart Campus and PS2 Smart School have been deleted from the live database
after confirming there are no team selection/preference references. A private
pre-deletion backup was saved. The four EL01–EL04 rows are unchanged, including
capacities and visibility. `db/remove-legacy-ps.sql` aborts if team data references
either obsolete statement; the configuration script also removes only unused
legacy entries. Disposable PostgreSQL coverage checks reference protection,
scoped deletion and idempotence.

## Latest: scheduled selection opening and fourth-choice fallback

This update supersedes the earlier fourth-choice exclusion policy below.
Selection opens at **Saturday, 10 October 2026, 9:30 AM IST**
(`2026-10-10T04:00:00.000Z`). The API hides participant PS details and rejects
early submissions before any allocation/database queries. Staff can inspect PS
configuration before opening. Server time controls both the inclusive API gate
and the browser's boundary refresh; an incorrect device clock cannot unlock it.
Visible tabs automatically fetch the form at opening, subject to network latency
and browser scheduling; hidden tabs refresh when made visible.

Allocation now considers preferences **1, 2, 3, 4** in order. If the first three
are full, preference four is allocated if available. If all four are full, the
preferences are saved without exceeding capacity. Existing transaction locks and
immutable approved assignments are preserved. EL01–EL04 remain at capacity 8
each; further organizer PS details are pending. No event data was changed.

Verification for this update:

- 45 Node tests passed, including exact before/at/after opening boundaries,
  early read/write denial without SQL, forged client time rejection and staff
  visibility before opening.
- Disposable PostgreSQL: 32 concurrent identical ranked submissions filled
  capacities 2/3/5 and assigned the remaining 22 to the fourth choice; first-three
  full/fourth available, all-four full, hidden choices and immutable duplicates
  passed. Balanced 32-team requests filled all four capacities at 8 each.
- Browser fixtures: server-timed automatic opening with the device clock set to
  2099, four rank fields and no overflow at 1440/390/320 widths. The existing
  event UI regression checks also passed at these widths.
- Live read-only handlers: participant details hidden before opening, staff
  configuration visible, four final statements visible with an injected opening
  clock. No live allocation, registration, meal or score writes were made.
- Production build passed. Changed-module lint has only two existing React
  effect warnings; the existing large bundle warning remains.

These checks do not establish authenticated production-browser or load evidence.

## Changes

- PS requests and approvals share serialized PostgreSQL transactions, enforce
  capacity and per-PS queue order, preserve duplicate-request position, and lock
  approved selections against participant changes. The transaction callback
  builds queries with Neon's raw transaction client so read-retry wrappers cannot
  prematurely execute SELECT statements outside the transaction.
- PS input is code/title only. Backend capacities survive edits and visibility
  changes; newly created entries have capacity 0 until configured in PostgreSQL.
- Admin sections use an OpenGlass UI liquid navigation surface. Bulk roster,
  Core assignments, incident log and incident overview tile are removed.
- Meal rows open a dark glass modal with team/member scan status, food preference
  totals, counter activity, search/filter and scan timestamps. Both admin and meal
  counter screens support the popup. Data refreshes every five seconds while
  visible, using revision checks, no overlapping polling and failure backoff.
- Round 2 includes every team, even without registration. Admins edit the existing
  four-category rubric and feedback; the server validates categories and computes
  the total. Saving returns participant visibility to hidden. An admin leaderboard
  is embedded in that section; the participant leaderboard is removed.
- Submission controls and file rows fit mobile widths.

## Verification

- Node: **40 tests passed**, including three new meal-analysis tests.
- Python: **5 tests passed** for finalist/RSVP normalization.
- `node scripts/verify-ps-postgres.mjs`: disposable PostgreSQL cluster, 32 parallel
  requests; capacity, repeated/concurrent approvals, FIFO, approval/request race,
  revocation, hidden/withdrawn/zero-capacity and idempotent requests passed.
- `node scripts/verify-meals-postgres.mjs`: disposable PostgreSQL, 2/3/4-person
  QR registration and meal completion, replay/ownership/concurrent counter guards,
  immediate reads and dietary data passed. New coverage verifies partial and
  complete analysis, timestamps/counters, revision responses, withdrawn totals,
  participant denial, all-team admin visibility and rubric/feedback persistence.
- Browser fixture verification: 1440px, 390px and 320px. Actual glass attributes,
  all 32 score cards/leaderboard, score and feedback saves, unsaved drafts during
  refresh, live popup changes, search/progress filters, Close/Escape, navigation,
  removed sections and mobile submission sizing passed. No uncaught page errors.
  Every browser API request was intercepted with fixtures; no live writes occurred.
- Authenticated local reads against configured Neon: admin sees 32 zero-score
  teams; meal analysis includes 119 participants (116 Veg, 3 Jain); revision-only
  responses and team denial passed. Raw Neon transaction callback verified with a
  read-only transaction. No event data was changed by these reads.
- Production build passed. Lint has zero errors; existing unrelated warnings and
  the existing large-bundle warning remain.
- Known-secret/token-pattern scan found no configured secrets in tracked source
  or reachable Git history. Private backup/RSVP/QA files remain ignored.

## Authorized database reset

A private local snapshot preceded the atomic reset. Both breakfast slots and
uploaded submission files were already empty. All 32 Round 2 rows now have score
and category values zero, with results hidden. Existing feedback, project links,
comments, account credentials, rosters, QR codes and other meals were preserved.
Post-reset reads confirmed 32 teams and 119 participants. This reset is a one-time
operation; deploying these changes does not repeat it.

## Limits

Browser checks use fixtures, backed by separate real-SQL integration and local
read checks. They are not authenticated production-browser tests or a
123-session production load test. The JWT revocation and parallel login-limit
findings in SECURITY-REVIEW.md remain open. Passing characterization tests for
those findings does not mean the vulnerabilities are fixed.

## Subsequent Teams table and roster update — 8 October 2026

The Teams table now uses four individual member columns, a directly openable
GitHub/project URL column, a separate uploaded-documents column and a persisted
meal-claim count. Rename, roster editing, withdrawal and dietary controls are
removed from this table. Visible Teams tabs refresh every five seconds.

Organizer-supplied corrections were applied atomically to Momex and False9 after
a private local backup. Existing member IDs, team accounts and QR tokens remain.
The departing False9 member had no meal, registration or event scans; his roster
slot now holds the replacement leader. The replacement's unspecified college,
year/branch and food preference are not inherited from the departing participant.
The other profiles retain their recorded meal preferences. Contact details and
private backup data are not committed to Git.

Post-update reads verified all supplied contact/profile values and the API's meal
counts against persisted meal logs. There are still 32 teams and 119 participants.
The build and changed-file lint passed. Browser fixtures at 1440/390/320px checked
four member cells, absent controls, new-tab project links, displayed meal counts
and contained table scrolling alongside the existing portal regression checks.

## Uploaded document buttons and multiple uploads — 8 October 2026

Admin Teams cells display uploaded files directly as liquid-glass buttons,
without a dropdown or an embedded preview. File names remain clipped inside the
button and scroll on hover or keyboard focus; reduced-motion settings disable
scrolling. Each button opens an authenticated document viewer in a new tab.
PDF, rendered Markdown, plain text and the existing PowerPoint slide-content
viewer retain original-file download links. Participant popup previews remain.

Participants can select multiple files and upload several documents of the same
type. Each document has its own database row; subsequent uploads no longer
replace earlier ones. There is no per-team document-count limit. The existing
3 MB limit per file, file validation and team/admin access restrictions remain.
The live constraint migration preserved the existing document byte-for-byte.

Verification: 41 Node tests passed, including two same-type uploads without an
upsert; disposable PostgreSQL integration accepted two PDF rows for one team.
Browser fixtures checked real new-tab navigation, rendered Markdown and PDF,
contained animated file names at 1440/390/320px, multi-select uploads retaining
both TXT files, and participant preview dismissal with Escape. Browser uploads
used fixtures and did not alter event submissions. Production build and new
viewer lint passed; the existing bundle-size warning remains.

## Final score, mentoring feedback and announcement audiences — 8 October 2026

Admin and core marks editors now accept one final score and separate Mentoring 1
and Mentoring 2 feedback. Rubric inputs and denominator labels are removed from
editors, the admin leaderboard, participant feedback and printed/exported marks.
The server enforces a finite numeric score from 0 to 100. Existing scores remain
unchanged; the former feedback field remains Mentoring 2 and Mentoring 1 starts
empty. Saving resets the team's release flag. The top release/hide controls
publish or withhold both feedbacks and the final score using the existing gate.

Announcements have an audience selector defaulting to All, with code/name options
for the teams. The database stores an optional team foreign key; the session API
returns global announcements plus only those addressed to that participant's
team. Pin/activation changes preserve the audience, including requests that omit
an audience field. Invalid/nonexistent target teams are rejected.

A private snapshot preceded the additive live migration. All 32 score/feedback
rows and all four existing announcements were preserved. No feedback was
released and no announcement was sent to event participants during verification.

The 41 Node tests passed. Disposable PostgreSQL integration verified final-score
bounds/type validation, both feedback persistence, save hiding, release/hide
privacy, announcement audience isolation and audience preservation. Browser
fixtures verified 1440/390/320px admin layouts, unsaved edits surviving polling,
score/feedback saves, the release control and default All selector. Separate
390/320px core and participant checks verified the single editor and released
feedback with no rubric or page overflow. Build passed; existing bundle-size and
unrelated effect warnings remain. These are fixture/local integration checks,
not authenticated production browser evidence.

## Ranked PS allocation, staged scores and participant arrivals — 8 October 2026

Public waitlisted boards/counts are removed; shortlisted teams remain. Login now
shows Team, Meal, Regi desk and Admin in a two-column layout. Core/superadmin
accounts retain their existing role-based routes, without login selector tabs.
The announcement audience control is an actual OpenGlass liquid dropdown with
keyboard options, selected-state styling, outside-click and Escape dismissal.

Marks have separate Mentoring 1, Judging Round 1 and Final Round scores (each
currently bounded to 100). The former saved score is preserved as Mentoring 1.
The admin's final-shortlist control is distinct from the event's existing
shortlist, initially false for all teams. Final score entry and display are
restricted by this flag in both UI and SQL, including row locking against
concurrent eligibility changes. Judging and final leaderboards/export/print
follow the appropriate stage; the leaderboard endpoint uses Judging Round 1
while live and only final-shortlisted final scores when frozen. Two mentoring
feedbacks and the organizer-controlled release gate remain.

Participants submit four distinct ranked choices; the fourth is recorded only.
A locked READ COMMITTED transaction checks current capacity and allocates the
first available of preferences 1–3 immediately. Duplicate submits return the
locked assignment; hidden/withdrawn/invalid choices are rejected. If all three
are full, preferences persist without allocating the fourth. Transactions use
database lock order, without priority based on team code or administrator.
Admin PS occupancy refreshes while the overview is visible.

Organizer-confirmed live PS configuration is EL01 Sports Analytics, EL02 AI
Agents, EL03 Elevate and EL04 Obliq, descriptions NA and capacities 8 each.
The two named legacy selections were cleared only after explicit authorization,
with a private backup. Old placeholder PSs are hidden. Other participant,
submission, meal, registration, feedback and score data were preserved. The
schema migration keeps 32 teams and 119 participants.

Meal-counter celebrations are removed; participant meal celebrations remain.
Registration uses touch-sized member buttons with airplane selected/registered
states, preserving one fresh QR/manual lookup proof per registered participant.
GitHub ID, medical-note and note entry fields are removed. The same private
participant receipt response includes that team's saved registration members;
no staff/other-team registration receipts are exposed. Visible participant tabs
refresh approximately every 3 seconds until registration is complete, then use
the existing slower meal polling cadence. Hidden tabs pause. New check-ins show
an actual liquid-glass welcome dialog with the supplied banner, close cross,
Escape and backdrop dismissal; duplicate popups are deduplicated per tab/member.
The banner is optimized from 8.4 MB PNG to approximately 210 KB WebP.

Verification: 41 Node tests, production build and changed-module lint passed.
Disposable PostgreSQL tests checked 32 simultaneous ranked requests, capacity
fallback, fourth-choice exclusion, duplicate/hidden/full cases, invalid request
shapes, and a balanced 32-team allocation at capacity 8 each. Score tests checked
independent stages, final eligibility enforcement/removal, correct live/frozen
leaderboard stages, release privacy and own-team registration receipt isolation.
Browser fixtures checked 1440/390/320 layouts, glass audience choices, ranked
submission, final-shortlist gating, registration buttons, no staff celebration,
participant welcome/banner/close/Escape/backdrop, retained participant meal
celebration, four login selectors and absent public waitlist. Live read-only
handler checks confirmed the configured four PSs, cleared legacy selections,
32 score teams and own-team registration responses. Fixtures did not write event
scans/scores/uploads; these checks are not authenticated production-browser or
123-session load evidence. Existing unrelated warnings and security findings
remain as documented above.
