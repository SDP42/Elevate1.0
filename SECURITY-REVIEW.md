# Security review — 8 October 2026

## Scope and conclusion

Reviewed the finalist release `ce855a3` and the follow-up dependency/private-file
patches. Testing used the real API handlers with injected fixture storage,
disposable PostgreSQL, Chrome with fixture responses, and read-only requests to
the configured local API. It did not run destructive attacks on the event DB.

**Two application findings remain open. This review is not a full production
penetration test or a statement that every endpoint is secure.**

## Findings

| Finding | Severity | Status | Evidence / next action |
| --- | --- | --- | --- |
| Existing JWT sessions are not revoked after password reset, account deletion or role changes | High | Open | Uploads and most `requireRole` routes trust an unexpired token. A fixture password change leaves submission access working. Read-only local HTTP reproduces a valid signed token for a nonexistent account: `/api/auth` rejects it, but `/api/leaderboard` accepts it. The latter token was minted for the test, not forged by a remote attacker. A stolen previously issued token can retain its old access for up to the 14-day lifetime. Validate current account/role/team ownership on every protected route and add a session version checked against the database; increment it on resets/role changes. Apply this consistently to uploads and auth actions. |
| Concurrent login attempts bypass the sequential username lockout | Medium | Open | The failure-count read and insertion are separate statements. Twelve simultaneous fixture attempts all returned 401 and were recorded despite the threshold of eight. Sequential attempt nine correctly returns 429. Replace the check/write with an atomic reservation or bounded attempt limiter; use a trusted deployment client identity if adding IP limits. |
| Private RSVP/QA files exposed by the local dev server | High when dev server is accessible to others | Fixed | Before patch, `/.local-rsvp/finalists.json` and the QA JSON endpoint returned 200. Git ignore rules did not protect Vite serving. Added `server.fs.deny` for RSVP/QA folders, generated credential files, environment files and Git data. Direct and `/@fs` fixture requests now return 403, verified against the running local server too. The server is bound to loopback; this was not evidence of a deployed production data leak. |
| Vulnerable `source-map-js` dependency | High advisory severity | Fixed | Updated locked development dependency 1.2.1 → 1.2.2. The [upstream advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) covers indexed source-map denial of service. npm audit changed from one high finding to zero known findings across the installed graph. This was a development dependency; an exploitable production path was not demonstrated. |

## Controls exercised

- **Authentication:** altered/expired/unsigned/wrong-key/HS384 JWTs rejected;
  scan proofs cannot authenticate as sessions. Login normalizes usernames;
  production cookie construction includes Secure, HttpOnly and SameSite=Lax.
- **Authorization:** every top-level API rejects anonymous read requests.
  Participant sessions cannot access admin/core/registration/incident/staff-meal
  views. Fixture team-file lookup and upload are bound to the session team,
  ignoring body/query attempts to select another team. Authorized admins can
  inspect the requested team's submissions, but cannot upload as teams.
- **Input/CSRF:** foreign-origin writes denied; invalid object/string inputs,
  oversize request bodies, unsafe submission protocols and SQL-like usernames
  tested. SQL-like usernames remain bound query parameters.
- **Uploads:** executable extensions, corrupt/noncanonical Base64, fake PDF/PPTX,
  invalid UTF-8, NUL bytes and oversized files rejected. PPTX tests reject 2,001+
  entries and a compressed 31 MB payload. PDF validation checks the signature,
  not comprehensive document safety. No antivirus scanning was performed.
- **Preview:** Chrome verifies raw HTML/scripts/event handlers and javascript
  links do not execute in Markdown; remote Markdown image beacons are omitted;
  external links have `noopener noreferrer`; Close and Escape dismiss the popup.
  PDF renders in a canvas with eval disabled. PPTX rendering restricts images
  to embedded raster assets and does not fetch external deck relationships.
- **Scanners/database:** disposable PostgreSQL checks 2/3/4-person team scans,
  one person per confirmation, single-use proofs, duplicate/concurrent counter
  protection, member/team foreign-key ownership, private receipts and completed
  meal teams appearing only after the last member. This is not a physical-camera
  or venue-network test.
- **Secrets:** no configured database/session secrets or scanned private-key /
  GitHub-token / Neon-password patterns found in tracked files or reachable Git
  blob history. Ignored RSVP/QA/environment/generated-credential files are not
  tracked. This was a targeted pattern/known-secret scan, not a guarantee that
  all possible credential formats or prior external disclosures were covered.
- **Event data:** live read-only checks leave 32 teams, 119 participants, zero
  meal scans, zero registration scans and zero submission files.

## Results and reproducibility

```sh
node --test tests/*.test.mjs
PYTHONPATH=. python3 -m unittest discover -s tests -p 'test_*.py'
node scripts/verify-meals-postgres.mjs
npm audit --json
npm run build
npm run lint
```

- 37 Node tests completed successfully. Three deliberately reproduce the open
  session/limiter findings; their passing assertions confirm the weaknesses,
  not successful protection against them. Five Python tests pass.
- Disposable PostgreSQL checks pass; Chrome malicious-Markdown checks pass.
- Production build passes. Lint has no errors; existing warnings remain.
- GitHub reports the finalist `ce855a3` production deployment successful.
  The generated deployment URL redirects unauthenticated requests through
  deployment protection, so deployed application headers and authenticated
  flows were not independently verified through that URL.

## Further hardening

The deployed CSP currently supplies base-uri/object/frame-ancestor restrictions
but no script-src/default-src policy. Add and test a complete policy with PDF
workers, data/blob preview assets, Vercel analytics and glass rendering before
enforcement. Do not deploy an untested policy that breaks the ticket/scanner.
Credentials previously shared through chat should be rotated under an explicit
credential handover plan; this review did not rotate the configured database
password/session secret or participants' passwords.

Keep the destructive `replace-finalists.mjs --apply` script away from routine
operations after registration starts. It intentionally resets roster activity;
later corrections should use the guarded ordinary importer/admin roster editor.
