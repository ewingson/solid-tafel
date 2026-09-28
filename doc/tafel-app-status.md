---
name: tafel-app-status
description: Tafel Calendar App (Herford + Bielefeld) — live v0.0.5, semver plan (0.0.6 patch, 0.1.0 minor), scope, pod architecture, blockers
sources: [chat]
aliases: ["tafel-app", "tafel-poc"]
---

## Versioning (semver)

- [stated] doc/v0.1.md was intended as a starter/spec, not a release number
- [stated] Live now: v0.0.5
- [stated] Next: v0.0.6 (semver patch update)
- [stated] Minor bump to v0.1.0 once there is a very rough UI plus very first functionality

## Current State: v0.0.5 ✅ Live

**What's working:**
- [stated] OIDC authentication via @inrupt/solid-client-authn@4.0.0
- [stated] RDF profile document fetch + parse with N3@2.0.3
- [stated] Debug display of 7 user parameters (WebID, name, preferences, type indices, storage, issuer)
- [stated] localStorage session persistence (returning users skip re-login)
- [stated] Deployed at serverproject.de/solid-tafel/

**Tech stack:**
- [stated] Vanilla JS + HTML (no frameworks)
- [stated] Simple CSS (cdn.simplecss.org)
- [stated] Browser-based OIDC flow
- [stated] CDN-loaded dependencies (no build step)

**Code location:**
- src/index.html — UI skeleton
- src/tlogic.js — Auth + profile fetch logic
- MIT licensed

---

## Roadmap

**v0.0.6 (patch):** scope still to be planned

**v0.1.0 (minor):** very rough UI + very first functionality. Candidate scope, taken from the old "v0.2" section of doc/v0.1.md (not yet confirmed as the 0.1.0 scope):
- [stated] Location radio buttons (Herford / Bielefeld)
- [stated] Fetch appointments from Org Pod (herford.meisdata.io/Shared/appointments/)
- [stated] Parse appointment RDF
- [stated] Display as simple list (not calendar UI yet)

**Not in that first functional release:**
- [stated] No booking functionality
- [stated] No staff verification view
- [stated] No document uploads
- [stated] No WebACL management

**Later (from doc/v0.1.md, version numbers to be re-mapped to semver):**
- [stated] Booking logic + document upload
- [stated] Staff view (verify proofs, manage appointments)
- [stated] Target: MVP by June 2027, testing with Herford + Bielefeld

---

## Known Unknowns / Blockers

**Data modeling:**
- What does tafel:Appointment RDF look like? (predicates, expected properties?)
- Where exactly do appointments live in Org Pod hierarchy?
- How does user booking get recorded? (write to own pod? Org pod? Both?)

**Pod architecture:**
- [stated] Tafel org pods, admin pods, and consumer pods all use the same pod structure — a standard Solid Personal Online Datastore (POD), differentiated by ACL/role rather than by a different schema per pod type
- Access patterns (how do staff verify documents?) — see [[solid-skills-reference]] WebACL templates (group-access + append-only-inbox patterns are the likely fit)
