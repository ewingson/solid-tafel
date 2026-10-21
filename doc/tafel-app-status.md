# Tafel Calendar App (solid-tafel) — Status

**Stand:** 2026-10-20 · **Live:** v0.0.11 with `config.js`, group files and `staff/.acl` deployed · **Repo:** `doc/tafel-app-status.md`

## 1. Status at a glance

| Item | State |
|---|---|
| Live app | v0.0.11 deployed (includes v0.0.10) |
| Vocabulary | `https://serverproject.de/solid-tafel/ns.ttl#` (v0.3), confirmed serving `text/turtle` |
| Org pod (= admin pod) | `https://teamid.live/herford/`, WebID `https://teamid.live/herford/profile/card#me` |
| Test consumer | `https://teamid.live/tafel_test/`, WebID `https://teamid.live/tafel_test/profile/card#me` |
| Group files `staff/admins.ttl`, `staff/herford.ttl`, `staff/.acl` | deployed (2026-10-20) |
| `config.js` with `personCount` | deployed (2026-10-20) |
| Pflichtenheft v1.1 (German + English) | delivered (`doc/pflichtenheft.md`, `doc/requirements-specification.md`) |
| Roles in the live system | implemented and deployed; NOT yet confirmed by a real login with the four test accounts (my tools cannot reach the servers; checklist in section 10) |
| Next step | confirm the four logins (section 10), then choose the next change |

## 2. Versions

- Patch releases are 0.0.x; minor bump to 0.1.0 once there is a very rough UI plus very first functionality. `doc/v0.1.md` was a starter/spec, not a release number.
- 0.0.5 live version before 0.0.9 (auth + debug display)
- 0.0.6 design groundwork (`pod-layout.md` first draft)
- 0.0.7 internal build, never deployed, folded into 0.0.8
- 0.0.8 code robustness fixes + vocabulary + pod-layout (namespace on teamid.live at the time)
- 0.0.9 namespace moved to `serverproject.de/solid-tafel/ns.ttl#`; file renamed to `ns.ttl`; deployed
- 0.0.10 `config.js` + small green line when logged in as the org pod (superseded by 0.0.11)
- **0.0.11 DEPLOYED:** four role categories (section 6)
- The Pflichtenheft milestone numbers (M1 = 0.0.10 …) were only a proposal and have drifted: 0.0.10 and 0.0.11 delivered only the role part of M1. Upload is still open, so the next version is 0.0.12.

## 3. What the app does today (v0.0.11)

- OIDC login/logout (`@inrupt/solid-client-authn-browser` 4.0.0), session restored through the library; localStorage keeps only a hint (last WebID/issuer), never a fake login
- Reads the user's profile with `N3` 2.0.3 and shows 7 debug parameters (WebID, name, preferences, type indices, storage, issuer)
- "Get a Pod" link on the start page (a pod is a prerequisite; the app does not create pods)
- `tlogic.js` is an ES module and loads `./js/config.js` dynamically; if the config is missing or invalid the page shows an amber warning instead of hanging, and nobody gets extra rights
- After login a small line shows the role (section 6)
- The app does not use the `tafel:` vocabulary yet and does not write anything to any pod yet
- UI language is English for now (German UI strings are planned, `strings.de.js`)

## 4. Files and deployment layout

| Repo path | Served at / lives at | State |
|---|---|---|
| `src/index.html` | `https://serverproject.de/solid-tafel/` | v0.0.11 deployed |
| `src/tlogic.js` | `…/solid-tafel/tlogic.js` (ES module) | v0.0.11 deployed |
| `src/js/config.js` | `…/solid-tafel/js/config.js` | deployed (version with `personCount`) |
| `doc/ns.ttl` | `…/solid-tafel/ns.ttl` (`.htaccess`: `AddType text/turtle .ttl`) | v0.3 live; v0.4 planned |
| `doc/pod-layout.md` | – | v0.0.9, corrections pending (Pflichtenheft Appendix B) |
| `doc/pflichtenheft.md`, `doc/requirements-specification.md` | – | v1.1 |
| `staff/admins.ttl`, `staff/herford.ttl`, `staff/.acl` | org pod `https://teamid.live/herford/solid-tafel/staff/` | deployed |

Stack: vanilla JS + HTML, no build step, libraries from CDN (`cdn.jsdelivr.net`, `cdn.simplecss.org`). Before a pilot the libraries must be delivered locally (privacy, NFA-01). MIT licensed.

## 5. Pod architecture (decided)

- Org/admin pod, staff pods and consumer pods are architecturally the same Solid pod; differences only through ACL, data and role
- All app data lives in one container at the pod root: `{POD}solid-tafel/`, with the same set of sub-containers in every pod (`profile/`, `documents/`, `bookings/`, `appointments/`, `submissions/`, `verifications/`, `staff/`; unused ones are not created)
- MVP: exactly one org pod (Herford); configured as a list with one entry in `config.js`
- Hybrid model: Bescheid PDF stays in the consumer pod; the org pod stores only references and results
- Staff WebIDs may be public in the group documents; admin-only settings go to `profile/` of the org pod
- A pod is a prerequisite for end consumers; nobody can log in without one
- Verification results are kept 6 months (enforcement mechanism open)
- Booking model proposed in the Pflichtenheft (not yet confirmed as final): booking original in the consumer pod, reference in the org pod, display status derived from both

## 6. Roles (implemented in v0.0.11)

| Category | Rule | Line shown after login |
|---|---|---|
| core admin | WebID equals the org WebID from `config.js` (hardcoded trust anchor, no network request) | ✔ Logged in as org pod (core admin) — Tafel Herford |
| admin | WebID is a member of `staff/admins.ttl` | ✔ Logged in as admin — Tafel Herford |
| staff | WebID is a member of `staff/<location>.ttl` (here `herford.ttl`) | ✔ Logged in as staff — Tafel Herford |
| normal user | any other WebID (end consumer) | ✔ Logged in as normal user (end consumer) |

- Live status: code, `config.js`, both group files and `staff/.acl` are deployed. The actual result of logins as `herford`, Renate, Heike and `tafel_test` has not been reported yet; I could not check it from outside because my tools cannot reach the servers.
- Highest category wins; WebIDs are compared exactly.
- The two group files are read WITHOUT login (plain fetch, credentials omitted, no cache, 8 s timeout); they are public by design.
- Fail-open: if a list cannot be read, nobody gets extra rights from it and the line turns amber, e.g. `⚠ Role could not be fully checked (admins.ttl: HTTP 404) — showing: …`. If a group file is missing or not public, everyone except the org pod sees the amber line naming the file and the reason.
- First admin: not hardcoded in the role logic. Only the org pod identity (URL + WebID) is in `config.js`; the org WebID is automatically admin because it owns the pod. Further admins and staff are DATA in the org pod.
- Test people: `https://teamid.live/renate/profile/card#me` in `admins.ttl`, `https://teamid.live/heike/profile/card#me` in `herford.ttl`.
- The role line only changes what the UI shows. Real protection is the ACL of the pods.
- `staff/.acl`: owner Read/Write/Control, admins group (`admins.ttl#admins`) Read+Write, public Read. Deliberate deviation from the Pflichtenheft matrix 6.3, which gave Admin Control on `staff/`: an admin with Control could rewrite the ACL and lock the owner out. Adjust the matrix at the next document revision.
- Recommended (D-15): use the shared `herford` login only for setup and emergencies; admins use personal WebIDs listed in `admins.ttl`.

## 7. Vocabulary and namespace

- Final namespace: `https://serverproject.de/solid-tafel/ns.ttl#` (hash namespace). A URI fragment is never sent to the server, so `ns.ttl#Appointment` and `ns.ttl` are the same request; the trailing `#` is required.
- History: serverproject.de (no root access) → teamid.live Solid pod (drafted `ns.acl`, now unused) → serverproject.de static file + `.htaccess`. It is a plain static file, no WebACL; public by default.
- `tafel:Appointment` is a `schema:Event` (has capacity properties; `ical` was dropped); staff groups use `vcard:Group` + `vcard:hasMember` (not `org:`); `tafel:Verification` stores a result only, never a document copy.
- Planned for ns.ttl v0.4 (additive only; published terms are never renamed): `tafel:DocumentSubmission`, `tafel:forPerson`, `tafel:forDocument`, `tafel:bookedBy`, `tafel:orgRecord`, `tafel:personCount`; widen the domain of `tafel:bookingStatus` to `BookingReference`; correct the comment on `Verification` (a URL reference to the document is allowed, a copy is not).

## 8. personCount

- Parameter `personCount` = number of persons in the household the user picks up for; the user will enter it later. Only change so far (no UI).
- In the deployed `config.js`: `PERSON_COUNT = { min: 1, max: 20 }` (max is a typo guard, a proposal to confirm with Herford) and `validatePersonCount(input)`, which returns `{ ok, value }` or `{ ok: false, error }` with error codes `empty`, `not-a-whole-number`, `too-small`, `too-large`.
- Proposed: stored per pickup on the booking. Open: per pickup or once per person; whether capacity counts bookings or persons.

## 9. MVP scope and Pflichtenheft

- First only ONE org pod; different roles for staff and end consumers; auth is done
- Herford offers pickup time windows; consumers book within a window
- Consumer uploads a PDF of the Bescheid; staff sets its status (`verified` / `pending` / `rejected` / `expired`)
- UI/UX plain; the user is a beginner; no time estimates; basic CRUD expected; likes the booking status code (`requested` / `confirmed` / `cancelled`)
- Order of work: document upload first, then verification by staff, then the time-window/booking UI; careful, small iterations
- Pflichtenheft v1.1 (German + English): 17 sections, milestones M0–M5, 16 security tests (S-01…S-16), 15 acceptance scenarios, decision log D-01…D-15. Its assessment: CRUD is easy; the hard parts are permissions across pods (WAC has no additive inheritance; writing `.acl` needs `acl:Control`), consistency without transactions (capacity confirmed by staff) and consumer onboarding/privacy.
- Findings of the cross-check: one uniform container layout in all pods; tests on one server do not prove cross-provider behaviour (a test pod on another server is needed); guest files opened as blobs need a fixed type plus a first-bytes check; URLs from inbox records must be validated before fetching (FA-V8).

| Milestone | Content | State |
|---|---|---|
| M0 | Preparation: org pod, test accounts, config, group files, ns.ttl v0.4, server behaviour checks (T-0.9) | org pod, test consumer, config, group files and ACL deployed; ns.ttl v0.4, more test accounts (2nd guest, staff, guest on another server) and T-0.9 pending |
| M1 | Foundation, roles, upload | roles done (0.0.10/0.0.11); module split, `strings.de.js`, `pod.js`, upload to own pod pending |
| M2 | Release (ACL), submission, verification | not started |
| M3 | Time windows | not started |
| M4 | Booking | not started |
| M5 | Hardening and pilot | not started |

## 10. Next step (not chosen yet)

1. Confirm the roles in a real browser with four logins (checklist below), plus the `curl` checks (group files readable without login, anonymous write returns 401/403, owner can still write)
2. ns.ttl v0.4 (small, additive)
3. M1 remainder: module split plus pod access layer, then upload of a PDF into the user's own `solid-tafel/documents/` (no release, no submission yet)

Role check, expected line per login:

| Login | Expected line |
|---|---|
| `https://teamid.live/herford/profile/card#me` | ✔ Logged in as org pod (core admin) — Tafel Herford |
| `https://teamid.live/renate/profile/card#me` | ✔ Logged in as admin — Tafel Herford |
| `https://teamid.live/heike/profile/card#me` | ✔ Logged in as staff — Tafel Herford |
| `https://teamid.live/tafel_test/profile/card#me` (or any other WebID) | ✔ Logged in as normal user (end consumer) |

- The org pod case needs no network request, so it does not prove that the lists can be read. The other three do; a normal user without an amber line proves that both lists are readable.
- An amber line names the file and the reason: `HTTP 401/403` = not public (ACL), `HTTP 404` = wrong path or missing file, `not readable` = network or CORS (see the browser console), `not valid Turtle` = syntax error.
- If Renate or Heike have no accounts, temporarily list `tafel_test` in `herford.ttl` (expect staff), then in `admins.ttl` (expect admin), and remove it again.

## 11. Open decisions (most important)

- D-01 Does a guest book the whole time window or an exact time inside it? (recommended: the whole window)
- D-02 Booking before the notice is verified? (recommended: yes, staff decide)
- D-03 Booking rules (per week, cancellation and request deadlines): clarify with Herford
- D-07 What exactly "6 months" means and who deletes
- D-12 Accept photos (JPEG/PNG) of the Bescheid besides PDF?
- D-14 File name `staff/herford.ttl` or `staff/staff.ttl`? (kept: `herford.ttl`)
- D-15 Who uses the shared `herford` account?
- personCount: per pickup or per person; max 20 OK; capacity in persons or bookings
- Calendar UI: widget or simple list (needs Herford feedback)
- Appointment granularity (one file per window or per day); cancellation reason/timestamp on bookings; whether "rejected" and "expired" are both wanted

## 12. Risks and not yet verified

- Not verified in a real browser: the role result of the four logins, the look of the role line, CORS of the plain fetch from serverproject.de to teamid.live
- Deployed but results not reported: anonymous read of the group files, anonymous write refused on `staff/`, owner still able to write
- Not verified on the target server (T-0.9): `POST` with `Slug` into an append-only container, relative IRIs in `POST` bodies, implicit container creation by `PUT`, ETag/`If-Match`, `acl:agentGroup` across servers, `acl:default` with only `Control`, foreign issuers, group-change caching
- Org pod and test consumer are on the same server; cross-server behaviour is untested
- Guests need a pod: onboarding is the biggest adoption risk (pilot with staff support)
- CDN libraries must be replaced by local files before any pilot (privacy)
- `ns.ttl` and `pod-layout.md` were meant as an archive but must be unfrozen for v0.4 and before booking/verification

## 13. Testing

- 35 automated scenarios pass for v0.0.11: 13 regression, 19 role, 3 config-failure. The real `tlogic.js` runs as an ES module in Node against a mocked Solid library and the real N3 parser.
- `config.js` has its own checks: org entry validation and 32 `personCount` inputs.
- Earlier notes said "14 old + 17 role + 3 config"; the correct split is 13 + 19 + 3.
- Not covered: real browser rendering, real login on teamid.live, real pod access.

## 14. Working agreements

- Careful, small iterations, one change at a time; version number only as agreed
- The user needs 24 h up to one week to deploy; the next step waits for the user's report
- Terms in the UI: "normal user (end consumer)"; the Pflichtenheft uses guest/consumer
- Deliverables as Markdown; double-checked claims; unverified things are marked as such
