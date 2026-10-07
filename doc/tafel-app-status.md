---
name: tafel-app-status
description: Tafel Calendar App (Herford + Bielefeld) — v0.0.9 live/deployed, ns.ttl confirmed serving, v0.0.10 doc-upload+roles planning
---

## Versioning (semver)

- doc/v0.1.md was intended as a starter/spec, not a release number
- Live now: v0.0.9 (supersedes v0.0.5)
- Patch releases are 0.0.x; minor bump to v0.1.0 once there is a very rough UI plus very first functionality
- v0.0.6 = design groundwork (doc/pod-layout.md, first draft)
- An internal v0.0.7 build (code robustness fixes) existed but was never deployed, folded into v0.0.8
- v0.0.8 = code + vocabulary (then doc/tafel-vocab.ttl) + pod-layout.md, namespace on teamid.live at the time
- v0.0.9 = DEPLOYED: namespace relocated to its final home; zero functional code changes (index.html/tlogic.js only got the version-string bump); doc/tafel-vocab.ttl renamed to doc/ns.ttl
- Going forward: index.html, tlogic.js, tafel-app-status.md are the files expected to keep changing each patch; doc/pod-layout.md and doc/ns.ttl are intended as an archived reference/planning baseline, not routinely edited — caveat below

## Current State: v0.0.9 ✅ Live (deployed, supersedes v0.0.5)

**What's working (originally shipped in v0.0.5, carried forward — v0.0.9 is live now):**
- OIDC authentication via @inrupt/solid-client-authn@4.0.0
- RDF profile document fetch + parse with N3@2.0.3
- Debug display of 7 user parameters (WebID, name, preferences, type indices, storage, issuer)
- localStorage session persistence (returning users skip re-login)
- Deployed at serverproject.de/solid-tafel/

**v0.0.9 (deployed):** same feature set as v0.0.8 (Get a Pod link, single-sourced version number, session-restore/issuer/redirect fixes). 14-scenario regression suite passed against the real N3 2.0.3 parser and the real @inrupt/solid-client-authn-browser 4.0.0 bundle, before deployment. This app does not reference the tafel: vocabulary at all yet — that starts with v0.1.0's appointment fetching.

**Tech stack:**
- Vanilla JS + HTML (no frameworks)
- Simple CSS (cdn.simplecss.org)
- Browser-based OIDC flow
- CDN-loaded dependencies (no build step)

**Code location:**
- src/index.html — UI skeleton
- src/tlogic.js — Auth + profile fetch logic
- doc/ns.ttl — application vocabulary (renamed from tafel-vocab.ttl in v0.0.9)
- doc/pod-layout.md — pod/container/ACL design
- MIT licensed

---

## Vocabulary & namespace — FINAL (v0.0.9)

- Final namespace: **`https://serverproject.de/solid-tafel/ns.ttl#`** — a hash namespace (trailing `#` is required: a URI fragment is never sent to the server per RFC 3986, so `ns.ttl#Appointment` and `ns.ttl` are the same HTTP request; without the `#`, `tafel:Appointment` would wrongly concatenate to `ns.ttlAppointment`)
- Namespace host history: (1) serverproject.de first proposed, dropped for lack of root/nginx access, (2) moved to teamid.live as a Solid Pod resource with a drafted `ns.acl` (owner WebID `https://teamid.live/tafel_test/profile/card#me`) — now UNUSED, (3) v0.0.9: back to serverproject.de, static file + `.htaccess` with `AddType text/turtle .ttl`
- Plain static file on Apache, NOT a Solid Pod resource — no WebACL applies
- Deployment: `/solid-tafel/ns.ttl` on serverproject.de, `.htaccess` with `AddType text/turtle .ttl` — **confirmed live and serving correctly**, AllowOverride concern resolved
- `tafel:Appointment` based on `schema:Event`; staff groups use `vcard:Group` + `vcard:hasMember`
- `tafel:Verification` stores a result only (status/verifier/date), never a document copy/link
- Verification-result retention: 6 months (decided). NOT yet decided: automated expiry job vs. manual deletion

**Data-modeling assessment:** sincere and feasible for what v0.1.0–v0.2 actually need. Genuinely open parts (per-resource vs per-container appointments, cancellation metadata, rejected-vs-expired split, retention enforcement) don't block the near-term roadmap but will need revisiting before v0.3/v0.4 — in tension with "leave ns.ttl as archive."

**On namespace public-readability:** correct, standard practice — vocabularies are conventionally public even when data instances using them are private.

---

## Pod architecture decisions — all six open questions resolved

- Org, admin and consumer pods all use the same pod structure, differentiated by ACL/role rather than schema
- All app data lives in `/solid-tafel/` at the pod root
- Org pod domains used in docs so far: `https://herford.meisdata.io` / `https://bielefeld.meisdata.io`
- High-probability replacement: `https://teamid.live/herford` / `https://teamid.live/bielefeld` (path-based pods on teamid.live) — not yet fully confirmed. Each would need its own CSS account/pod + WebID
- Booking: hybrid (documents in consumer pod, org stores only verification results)
- Staff WebIDs may be public in group documents
- Admin-only settings live in `profile/` of the org pod
- A Solid Pod is a prerequisite for consumers; app offers a "Get a Pod" link
- doc/pod-layout.md: all six questions resolved; treated as archived reference baseline

---

## Roadmap

**v0.1.0 (minor):** rough UI + first functionality. Candidate scope:
- Location radio buttons (Herford / Bielefeld)
- Fetch appointments from org pod's `/solid-tafel/appointments/`, typed as `tafel:Appointment`/`schema:Event`
- Parse appointment RDF, display as simple list
- Role detection via `staff/*.ttl` group documents

**Not in that first release:** booking, staff verification view, document uploads, WebACL management

**Later:** booking logic + document upload, staff view, MVP target June 2027

---

## v0.0.10+ planning: document upload & roles (pre-code concept review)

- v0.0.10 splits into: document (Sozialhilfebescheid) upload, role differentiation by WebID, calendar UI — in that order, calendar last
- Consumer uploads to `{pod-root}/solid-tafel/documents/`
- Roles: admin (`staff/admins.ttl`), staff/member (`staff/{location}.ttl`), else consumer — read from the ORG pod, never self-declared
- First runtime step after login: evaluate assigned rights
- v0.0.10 shows a role icon; any role can upload; upload-only first, verification deferred

**Assessment:**
- Role source of truth stays the org pod's group docs, never the consumer's own profile
- "Upload first" (priority) and "evaluate rights first" (runtime order) aren't contradictory — role detection is plumbing upload depends on
- Role display needs no location UI: probe both org pods' group docs silently
- But the staff-read ACL grant on an uploaded document needs a location, which nothing captures yet — resolution: v0.0.10's upload lands PDF in consumer's own pod only, status defaults `tafel:pending`, no ACL grant yet; location + grant become part of the verification patch
- Vocab gap: `tafel:Verification` has no property linking it to the uploaded document — needs a small addition (`tafel:forDocument`) before the verification patch; first real instance of the archive-vs-revisit tension
- Binary+metadata pairing undecided; filename/versioning policy undecided
- New dependency likely needed: `@inrupt/solid-client` or raw binary PUT — `tlogic.js` currently read-only

**Org-pod determination & admin bootstrap:**
- Org pod URLs NOT dynamically discovered — hardcoded array, pending final domain choice; code should keep this a single easily-edited list, location derived from whichever entry matched
- It's WRITE access to `staff/*.ttl` that's admin-only, not read — read is public by design
- First admin bootstrapped out-of-band: manually create `staff/admins.ttl` with the first admin's WebID as `vcard:hasMember`, AND manually set Write+Control on that container's ACL. Two manual steps, no app can do this for itself
- No admin-management UI exists or is planned; manual editing is fine at PoC scale

**Feasibility for 0.0.10 — upload before role detection:**
- Upload has zero dependency on org pod domains — buildable/testable today regardless of which domains end up final
- Role detection depends on the org pods existing and being reachable — still unconfirmed, likely not provisioned yet
- Recommended: role detection fails open — unreachable org pod = "not staff there," same as the default. Both ship in 0.0.10, but upload is verified first since it has no external dependency

**Proposed three-patch plan (not yet confirmed):**
1. **0.0.10**: role display via org-pod probing (fail-open) + upload mechanics (own pod only, no ACL, status=pending) + `tafel:forDocument` vocab addition
2. **0.0.11**: staff-read ACL grant (location decision happens here) + minimal staff verification UI
3. **0.0.12 / v0.1.0**: calendar UI, appointment fetching, booking

## Known Unknowns / Blockers

- Calendar UI: widget vs simple list (needs Herford feedback)
- Retention enforcement mechanism (automated vs manual)
- Appointment granularity (per-resource vs per-container)
- Whether tafel:Booking needs cancellation metadata
- Whether rejected-vs-expired split is wanted
- v0.0.9 deployed and confirmed stable. `https://serverproject.de/solid-tafel/ns.ttl` confirmed serving `text/turtle` — resolved, no longer open
- Archive-vs-revisit tension: doc/ns.ttl and pod-layout.md will need unfreezing before v0.3/v0.4 land
