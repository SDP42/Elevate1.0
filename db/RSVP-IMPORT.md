# Participant RSVP import and team QR scans

The import stores team and participant names, email/phone, college, year/branch,
member food preferences, RSVP attendance, response timestamp, payment payer names,
and the terms/declaration text. It excludes upload/Drive links and never fetches
ID cards or payment screenshots. Names are formatted for display, email is
lowercased, Indian phone numbers use +91, and explicit college aliases share a
canonical name. Unknown acronyms are preserved rather than expanded by guesswork.

Preparation uses Python with `openpyxl`:

```sh
python3 db/prepare_rsvp.py '/path/to/Responses.xlsx' .local-rsvp
```

`.local-rsvp` is ignored by Git. Files are private (0600); the directory is 0700.
Preparation creates `normalized.json` and a blank account `mapping.json`. It
prints counts and issues without exposing contact details. Naive form timestamps
are interpreted as Asia/Kolkata (+05:30).

Assign every response to an **existing issued account** in `mapping.json`:

```json
[
  {"sourceTeam": "Example Flight", "username": "ELEV01"},
  {"sourceTeam": "Roster Needing Review", "username": "ELEV02", "memberPositions": [1,2,3]}
]
```

An explicit `memberPositions` list resolves a roster-size mismatch. It is not
inferred from form row order. If a chosen member's food preference needs an
organiser correction, add `memberOverrides` keyed by source position, for example
`{"4":{"foodPreference":"Veg"}}`. Review the correction before applying.

Dry-run the issued identity changes against the intended database first:

```sh
node --env-file=.env db/team-identities.mjs
```

The identity plan checks username/code collisions and preserves account IDs. Run
with `--apply` only on the selected target after review; it saves a private identity
backup. The participant mapping uses ELEV01–ELEV32 in the organiser's supplied
team order. Deploy the case-insensitive login handler before changing account usernames.
Apply the additive migration before identity changes so case-insensitive username
uniqueness is enforced. The code branch remains local until release is authorised.

Dry-run the participant import against the intended database:

```sh
node --env-file=.env db/import-rsvp.mjs .local-rsvp/normalized.json .local-rsvp/mapping.json
```

Resolve every issue before applying. The identity migration changes issued team logins and codes to ELEV01, ELEV02,
etc. Login is case insensitive. Passwords, seats and QR tokens are preserved.
The participant import then preserves these identities. Member IDs are updated in place;
import rejects replacing named identities or reassigning/removing members with
meal or registration history. Trailing unused placeholders can be removed when
no history is attached. Imports have a private backup and run in one transaction.

After the target database and mapping have been reviewed, apply the **additive**
`db/participant-details.sql` migration, then run the same command with `--apply`.
The full `schema.sql` also contains these changes for fresh environments. There
is no automatic migration or import during deployment, and no production change
is made by preparation or dry-run. Existing admin roster edits preserve imported
profiles and reject identity changes that would erase history.

## Event operation

Each team retains one QR. For a team of N people, staff scan the same QR N times
and confirm one participant per scan. Registration and each meal slot maintain
independent progress from committed database records. Staff select the person at
the counter so food preferences remain accurate even if the team arrives out of
roster order. Each lookup issues a signed short-lived scan proof bound to the
team, counter, action and meal slot. A proof can record only one participant; a
unique database scan ID prevents replay for a second participant. Meal uniqueness
also prevents simultaneous counters from serving the same person twice.

Meal lookup shows per-person Veg/Jain labels and excludes members who have not
registered. Confirmation inserts the selected serving atomically and returns
its actual inserted member ID. The counter celebrates only a new serving. An
open participant portal polls its own meal receipts every three seconds, then
shows the same full-screen 10-second airplane/message/confetti animation. Native
modal behavior blocks the underlying portal. Escape also dismisses the overlay;
reduced-motion users get the receipt without moving decorations. Historical
meals establish a baseline on page load and do not replay.

Meal administrators can click each meal in "Meals served" to view served teams,
participants, preference, counter and timestamp. Totals and the selected history
refresh every five seconds and after local confirmation. This is polling, not a
push connection; writes are committed before the API success response.

## Verification

```sh
node --test tests/*.test.mjs
python3 tests/test_rsvp_normalization.py
node scripts/verify-meals-postgres.mjs
```

The PostgreSQL script requires `initdb`, `pg_ctl` and `psql` on PATH. It creates
and cleans up a disposable local cluster, never loads `.env`, and verifies real
SQL and concurrent counters with synthetic participants. It checks 2/3/4-person
teams, proof replay, duplicate servings, immediate reads, history by meal slot,
and private participant receipts. Camera framing/permissions still need a venue
phone check over HTTPS; manual team-code fallback uses the same single-scan rules.

### Local verification on 8 October 2026

- 21 Node tests and 2 Python normalization tests pass.
- Disposable PostgreSQL integration verifies repeated team QR scans for 2, 3 and
  4 people, proof replay protection, concurrent counters and immediate reads.
- Headless Chrome with synthetic API fixtures verifies ticket layouts at 1440,
  768, 390 and 320 pixels, sponsor ordering, food labels, meal confirmations,
  participant polling, modal blocking/10-second dismissal, history selection and
  repeated registration UI. This is not a phone-camera or deployed-system check.
- Production build succeeds; existing large-bundle and lint warnings remain.
- Configured database reads show 35 issued placeholder teams, 6 meal records and
  3 registration records. Import must reconcile those records before changing
  their identities. Slaughter declares 3 participants but supplies 4 names.
- No migration, import, identity rename, production scan, push or deployment has
  been performed as part of these checks.
