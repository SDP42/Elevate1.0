# Portal update verification — 8 October 2026

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
