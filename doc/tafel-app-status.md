---
name: tafel-app-status
description: Tafel Calendar App (Herford + Bielefeld) — live v0.0.5, v0.0.9 delivered, final namespace serverproject.de/solid-tafel/ns.ttl, archive plan, roadmap
---

## Versioning (semver)

- doc/v0.1.md was intended as a starter/spec, not a release number
- Live now: v0.0.5
- Patch releases are 0.0.x; minor bump to v0.1.0 once there is a very rough UI plus very first functionality
- v0.0.6 = design groundwork (doc/pod-layout.md, first draft)
- An internal v0.0.7 build (code robustness fixes) existed but was never deployed, folded into v0.0.8
- v0.0.8 = code + vocabulary (then doc/tafel-vocab.ttl) + pod-layout.md, namespace on teamid.live at the time
- v0.0.9 = DELIVERED: namespace relocated to its final home; zero functional code changes (index.html/tlogic.js only got the version-string bump); doc/tafel-vocab.ttl renamed to doc/ns.ttl
- Going forward: index.html, tlogic.js, tafel-app-status.md are the files expected to keep changing each patch; doc/pod-layout.md and doc/ns.ttl are intended as an archived reference/planning baseline, not routinely edited — caveat below

## Current State: v0.0.5 ✅ Live / v0.0.9 ready to deploy

**What's working (v0.0.5, live):**
- OIDC authentication via @inrupt/solid-client-authn@4.0.0
- RDF profile document fetch + parse with N3@2.0.3
- Debug display of 7 user parameters (WebID, name, preferences, type indices, storage, issuer)
- localStorage session persistence (returning users skip re-login)
- Deployed at serverproject.de/solid-tafel/

**v0.0.9 (built + tested, not yet deployed by user):** same feature set as v0.0.8 (Get a Pod link, single-sourced version number, session-restore/issuer/redirect fixes). 14-scenario regression suite passing against the real N3 2.0.3 parser and the real @inrupt/solid-client-authn-browser 4.0.0 bundle. This app does not reference the tafel: vocabulary at all yet — that starts with v0.1.0's appointment fetching.

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

- Final namespace: **`https://serverproject.de/solid-tafel/ns.ttl#`** — a hash namespace (trailing `#` is required, not stylistic: a URI fragment is never sent to the server per RFC 3986, so `ns.ttl#Appointment` and `ns.ttl` are the same HTTP request; without the `#`, `tafel:Appointment` would wrongly concatenate to `ns.ttlAppointment`)
- Namespace host history: (1) serverproject.de first proposed, dropped for lack of root/nginx access, (2) moved to teamid.live as a Solid Pod resource with a drafted `ns.acl` (owner WebID `https://teamid.live/tafel_test/profile/card#me`) — now UNUSED, (3) v0.0.9: back to serverproject.de, found a hosting method: plain static file + `.htaccess` with `AddType text/turtle .ttl`
- This is a plain static file on Apache, NOT a Solid Pod resource — no WebACL applies; Apache serves it publicly by default once uploaded, as long as nothing else password-protects that path
- Deployment steps (v0.0.9): upload file content to `/solid-tafel/ns.ttl` on serverproject.de; add `.htaccess` with `AddType text/turtle .ttl` (optionally `Header set Access-Control-Allow-Origin "*"` for future browser-side fetches); verify with `curl -I https://serverproject.de/solid-tafel/ns.ttl` expecting `200` + `Content-Type: text/turtle`
- Caveat (not verified, no access to serverproject.de config): `.htaccess` only works if `AllowOverride FileInfo`/`All` is enabled for that directory — normal on shared hosting, but unconfirmed here
- `tafel:Appointment` is based on `schema:Event` (not `ical:`); staff groups use `vcard:Group` + `vcard:hasMember` (not `org:`) — unchanged from v0.0.8, only the namespace host/path changed in v0.0.9
- `tafel:Verification` stores a result only (status/verifier/date), never a document copy/link
- Verification-result retention: 6 months (decided). NOT yet decided: automated expiry job vs. manual deletion

**Data-modeling assessment:** sincere and feasible for what v0.1.0–v0.2 actually need (appointments, staff groups). The genuinely open parts (per-resource vs per-container appointments, cancellation metadata, rejected-vs-expired split, retention enforcement mechanism) don't block the near-term roadmap, since booking/verification features are v0.3/v0.4 scope. They WILL need revisiting before those land — which is slightly in tension with "leave ns.ttl as archive," since at that point the archived file would need unfreezing. Flagged, not yet resolved.

**On namespace public-readability:** yes, correct and standard practice — vocabularies are conventionally public even when the data instances using them are private (schema.org, foaf, vcard all work this way). Gatekeeping the vocabulary itself would undermine the interoperability that is the point of using a shared/Solid-style vocabulary at all.

---

## Pod architecture decisions — all six open questions resolved

- Org, admin and consumer pods all use the same pod structure (standard Solid POD), differentiated by ACL/role rather than schema
- All app data lives in one container at the pod root, named after the app: `/solid-tafel/`
- The two (temporary) org pod domains are confirmed: `https://herford.meisdata.io` and `https://bielefeld.meisdata.io` — not the real future domains
- Booking approach: hybrid (documents stay in the consumer pod, org stores only verification results; bookings start simple on the org side) — confirmed
- Staff WebIDs may be public in the staff group documents — confirmed
- Admin-only settings live in `profile/` of the org pod — confirmed, as proposed
- A Solid Pod is a prerequisite for consumers; the app does not provision pods, it offers a "Get a Pod" link instead — confirmed, implemented
- doc/pod-layout.md: all six open questions in §5 marked decided; file now treated as the archived reference baseline

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
- Namespace document (`https://serverproject.de/solid-tafel/ns.ttl`) not yet actually uploaded/served — `.htaccess` AllowOverride unverified
- The archive-vs-revisit tension noted above: doc/ns.ttl and pod-layout.md will need unfreezing before v0.3/v0.4 (booking, verification) land
