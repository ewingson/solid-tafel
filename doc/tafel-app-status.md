---
name: tafel-app-status
description: Tafel Calendar App (Herford + Bielefeld) — live v0.0.7, semver plan (0.0.8 patch, 0.1.0 minor), scope, pod architecture, blockers
sources: [chat]
aliases: ["tafel-app", "tafel-poc"]
---
# Tafel Calendar App — Project Status

**Last updated:** Sep 28, 2026

## Summary

**Tafel Calendar App (Herford + Bielefeld)** — live v0.0.7, v0.0.8 in preparation, semver plan (`0.1.0` = rough UI + first function), pod layout decisions, open questions.

## Details

### Versioning (semver)

- `doc/v0.1.md` was intended as a starter/spec, not a release number.
- **Live now:** `v0.0.7`
- Patch releases are `0.0.x`; minor bump to `v0.1.0` once there is a very rough UI plus very first functionality.
- **Next code deliverable requested:** `v0.0.8` (`index.html` + `tlogic.js` only for now), double/triple-checked before handing over.
- `v0.0.6` = design groundwork (pod-layout draft in `doc/pod-layout.md`).

### Current State: v0.0.7 ✅ Live

#### What's working

- OIDC authentication via `@inrupt/solid-client-authn@4.0.0`
- RDF profile document fetch + parse with `N3@2.0.3`
- Debug display of 7 user parameters:
  - WebID
  - name
  - preferences
  - type indices
  - storage
  - issuer
- `localStorage` session persistence (returning users skip re-login)
- Deployed at `serverproject.de/solid-tafel/`

#### Tech stack

- Vanilla JS + HTML (no frameworks)
- Simple CSS (`cdn.simplecss.org`)
- Browser-based OIDC flow
- CDN-loaded dependencies (no build step)

#### Code location

- `src/index.html` — UI skeleton
- `src/tlogic.js` — Auth + profile fetch logic
- MIT licensed

## Pod Architecture Decisions

- Org, admin and consumer pods all use the same pod structure (standard Solid POD), differentiated by ACL/role rather than schema.
- All app data lives in one container at the pod root, named after the app: `/solid-tafel/`.
- One org pod per location:
  - `herford.meisdata.io`
  - `bielefeld.meisdata.io`
- Booking approach: hybrid is okay for now (documents stay in the consumer pod, org stores only verification results; bookings start simple on the org side).
- Staff WebIDs may be public in the staff group documents.
- Admin-only settings live in `profile/` of the org pod.
- People without a pod: add a **"get a pod"** link to the start page.
- Verification-result retention (how long, who deletes): still to be decided.
- Draft: `doc/pod-layout.md` (containers, roles, permission matrix, ACL sketches, booking flows).

## Roadmap

### v0.1.0 — Minor Release

**Goal:** Very rough UI + very first functionality.

Candidate scope, from the old `"v0.2"` section of `doc/v0.1.md` (not yet confirmed):

- Location radio buttons (Herford / Bielefeld)
- Fetch appointments from the Org Pod's `/solid-tafel/` container (replaces the older `/Shared/appointments/` path from `doc/v0.1.md`)
- Parse appointment RDF
- Display as a simple list (not calendar UI yet)
- Role detection via `staff/*.ttl` group documents (proposed in pod-layout draft)

### Not in that first functional release

- No booking functionality
- No staff verification view
- No document uploads
- No WebACL management

### Later

From `doc/v0.1.md`, to be re-mapped to semver:

- Booking logic + document upload
- Staff view (verify proofs, manage appointments)

**Target:** MVP by June 2027, testing with Herford + Bielefeld.

## Known Unknowns / Blockers

- **`tafel:Appointment` RDF:** Which existing vocabulary to reuse (`schema:Event` / iCal), and what the real namespace URL for `tafel:` should be.
- **Calendar UI:** Widget vs. simple list (needs Herford feedback).
- **Retention of verification results.**
