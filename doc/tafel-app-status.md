---
name: tafel-app-status
description: Tafel Calendar App (Herford + Bielefeld) — live v0.0.5, v0.0.8 delivered (code + vocab + pod layout), teamid.live namespace, roadmap
---

## Versioning (semver)

- doc/v0.1.md was intended as a starter/spec, not a release number
- Live now: v0.0.5
- Patch releases are 0.0.x; minor bump to v0.1.0 once there is a very rough UI plus very first functionality
- v0.0.6 = design groundwork (doc/pod-layout.md, first draft)
- An internal v0.0.7 build (code robustness fixes) existed but was never deployed, so it was folded into v0.0.8 rather than shipped separately
- v0.0.8 = DELIVERED: code (index.html + tlogic.js) + vocabulary (doc/tafel-vocab.ttl) + finalized pod-layout.md, all three bundled together

## Current State: v0.0.5 ✅ Live / v0.0.8 ready to deploy

**What's working (v0.0.5, live):**
- OIDC authentication via @inrupt/solid-client-authn@4.0.0
- RDF profile document fetch + parse with N3@2.0.3
- Debug display of 7 user parameters (WebID, name, preferences, type indices, storage, issuer)
- localStorage session persistence (returning users skip re-login)
- Deployed at serverproject.de/solid-tafel/

**v0.0.8 (built + tested, not yet deployed by user):** same feature set plus a "Get a Pod" link on the guest screen (linking to solidproject.org/users/get-a-pod), single-sourced version number, session-restore fix (stale localStorage can no longer fake a login), issuer resolution fix, redirect URL hygiene. 14-scenario regression suite passing against the real N3 2.0.3 parser and the real @inrupt/solid-client-authn-browser 4.0.0 bundle.

**Tech stack:**
- Vanilla JS + HTML (no frameworks)
- Simple CSS (cdn.simplecss.org)
- Browser-based OIDC flow
- CDN-loaded dependencies (no build step)

**Code location:**
- src/index.html — UI skeleton
- src/tlogic.js — Auth + profile fetch logic
- doc/tafel-vocab.ttl — application vocabulary
- doc/pod-layout.md — pod/container/ACL design
- MIT licensed

---

## Vocabulary & namespace — DECIDED

- Namespace for the app vocabulary: `https://teamid.live/tafel_test/ns#` — corrected from an earlier `serverproject.de` proposal because there is no root/nginx access to serverproject.de; teamid.live is Pal's own Solid Pod server
- `tafel:Appointment` is based on `schema:Event` (not `ical:` — ical lacks a capacity property and its namespace URI is ambiguous in the wild)
- Staff groups use `vcard:Group` + `vcard:hasMember` (not `org:` — lighter, matches WAC `acl:agentGroup`)
- `tafel:Verification` stores a result only (status/verifier/date) — never a copy of or link to the underlying document
- Verification-result retention: 6 months (decided). NOT yet decided: automated expiry job vs. manual deletion by staff/admin
- Deployment still needed: the resource `https://teamid.live/tafel_test/ns` (no trailing slash, no file extension in the URL) must be served with `Content-Type: text/turtle` and be publicly readable (ACL: `acl:agentClass foaf:Agent`, Read) for the namespace to actually dereference

---

## Pod architecture decisions — all six open questions resolved

- Org, admin and consumer pods all use the same pod structure (standard Solid POD), differentiated by ACL/role rather than schema
- All app data lives in one container at the pod root, named after the app: `/solid-tafel/`
- The two (temporary) org pod domains are confirmed: `https://herford.meisdata.io` and `https://bielefeld.meisdata.io` — not the real future domains
- Booking approach: hybrid (documents stay in the consumer pod, org stores only verification results; bookings start simple on the org side) — confirmed
- Staff WebIDs may be public in the staff group documents — confirmed
- Admin-only settings live in `profile/` of the org pod — confirmed, as proposed
- A Solid Pod is a prerequisite for consumers; the app does not provision pods, it offers a "Get a Pod" link instead — confirmed, implemented in v0.0.8

---

## Roadmap

**v0.1.0 (minor):** very rough UI + very first functionality. Candidate scope (not yet confirmed):
- Location radio buttons (Herford / Bielefeld)
- Fetch appointments from the Org Pod's `/solid-tafel/appointments/` container, typed as `tafel:Appointment`/`schema:Event`
- Parse appointment RDF
- Display as simple list (not calendar UI yet)
- Role detection via `staff/*.ttl` group documents (`vcard:Group`)

**Not in that first functional release:**
- No booking functionality
- No staff verification view
- No document uploads
- No WebACL management

**Later:**
- Booking logic + document upload
- Staff view (verify proofs, manage appointments)
- Target: MVP by June 2027, testing with Herford + Bielefeld

---

## Known Unknowns / Blockers

- Calendar UI: widget vs simple list (needs Herford feedback)
- Retention enforcement mechanism (automated vs manual) for the 6-month verification-result expiry
- One tafel:Appointment per resource vs several per container (per-day container?)
- Whether tafel:Booking needs a cancellation reason/timestamp
- Whether "rejected" vs "expired" verification status split is actually wanted
- Namespace document (`https://teamid.live/tafel_test/ns`) not yet actually deployed/served
