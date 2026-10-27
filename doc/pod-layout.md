# Pod Layout — solid-tafel

| | |
|---|---|
| **Version** | 0.4 (replaces the v0.0.9 draft) |
| **Companions** | `ns.ttl` v0.4 (vocabulary), `pflichtenheft.md` / `requirements-specification.md` v1.1 |
| **Status** | Reference baseline. It was frozen as an archive after v0.0.9 and is unfrozen for v0.4, because the vocabulary and the access rules had to be corrected. |
| **Language** | English. Names of containers, classes and properties are as in the code. |

## 0. What changed compared with the v0.0.9 draft

- One uniform container layout in **all** pods (the old draft had one tree for the org pod and another for guests).
- **Who creates what** is defined (section 4): the app creates containers, only `staff/` and the pod root are manual.
- The permission matrix was corrected: writing an `.acl` file needs `acl:Control`, and `Control` is now handed out as narrowly as possible (6.3).
- `submissions/` added to the org pod (staff could not otherwise learn that a document is waiting).
- New vocabulary terms are mapped to their records (section 7), including `tafel:personCount`.
- Fixed accounts: org pod `https://teamid.live/herford/`, test consumer `https://teamid.live/tafel_test/`. The old `meisdata.io` pod domains are obsolete.

## 1. Principles

1. **All pods have the same architecture:** ordinary Solid pods. Differences come only from ACL, data and role.
2. **All app data lives in one container at the pod root:** `{POD}solid-tafel/`. `{POD}` is a pod root URL **with** a trailing `/`.
3. **A role is a relationship, not a pod type.** A WebID is admin, staff or normal user *relative to the organisation* (section 5).
4. **The org pod is also the admin pod.** Its owner (the org WebID in `config.js`) is the root of trust and automatically admin.
5. **The user interface only shows what a role may do. The ACL is the real protection.**
6. **Hybrid data model:** the notice PDF and the booking original stay in the consumer pod; the org pod holds references and results only.

## 2. Fixed accounts

| Purpose | Pod | WebID |
|---|---|---|
| Org pod = admin pod | `https://teamid.live/herford/` | `https://teamid.live/herford/profile/card#me` |
| Test consumer | `https://teamid.live/tafel_test/` | `https://teamid.live/tafel_test/profile/card#me` |

Test people in the group files: `https://teamid.live/renate/profile/card#me` (admins), `https://teamid.live/heike/profile/card#me` (staff).

## 3. Uniform container layout

Every pod gets the **same set** of containers. Containers that are not needed are not created.

```
{POD}solid-tafel/
├── profile/          settings of the pod owner (optional; org pod: settings of the location)
├── documents/        files the owner holds (consumer: notice PDFs)
├── bookings/         consumer pod: own bookings (originals) · org pod: booking references (inbox)
├── appointments/     org pod: time windows (publicly readable)
├── submissions/      org pod: submissions of notices (inbox)
├── verifications/    org pod: verification results
└── staff/
    ├── admins.ttl    vcard:Group  <#admins>   (org pod)
    └── herford.ttl   vcard:Group  <#staff>    (org pod; file name = location code)
```

### 3.1 Who uses which container?

| Container | Org/admin pod | Staff pod | Consumer pod |
|---|---|---|---|
| `profile/` | optional | – | – (MVP) |
| `documents/` | – | – | notice PDFs |
| `bookings/` | `tafel:BookingReference` (inbox) | – | `tafel:Booking` (originals) |
| `appointments/` | `tafel:Appointment` | – | – |
| `submissions/` | `tafel:DocumentSubmission` (inbox) | – | – |
| `verifications/` | `tafel:Verification` | – | – |
| `staff/` | group documents | – | – |

A staff pod uses **no** container in the MVP: the staff role lives in the staff list of the org pod, not in the person's own pod. The same container name can hold different records in different pods (`bookings/`): the name says **what** it is about, the ACL and the record type say **whom** it belongs to.

## 4. Who creates what

| Pod | Container | Created by | When |
|---|---|---|---|
| Org | `solid-tafel/` (root of the app data) | by hand (exists, private; anonymous access returns 401) | – |
| Org | `staff/` and its two files | **by hand** (done, `staff/.acl` deployed) | the app never creates, overwrites or deletes anything here |
| Org | `appointments/`, `bookings/`, `submissions/`, `verifications/` | **the app**, action "Initialise org pod", **core admin only** | before guests use the app |
| Org | `profile/` | the app, core admin | only when the first org setting is saved |
| Consumer | `solid-tafel/`, `documents/`, `bookings/` | **the app**, the consumer's own session | lazily, on first use (first upload, first booking) |
| Staff pod | – | – | nothing in the MVP |

**Why the org containers cannot be created lazily:** guests may only *append* to the inboxes, they cannot create anything in the org pod. If `bookings/` does not exist yet, a guest's request fails. So the org containers must exist before the first guest uses the app.

**Why only the core admin:** the org pod root is private and owned by the org WebID. An admin from `admins.ttl` has rights in `staff/` only, so an admin can see "setup missing" but cannot fix it.

### 4.1 Rules for creating a container (all pods)

1. **Check first.** If the container exists, do nothing.
2. **Create:** `PUT` to the container URL with a trailing `/` and `Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"`, with `If-None-Match: *`. `201` = created, `412` = already exists (counts as success). The exact request shape is verified on the server first (section 8).
3. **Write its ACL immediately** (templates in 6.4), also with `If-None-Match: *`. A new container starts private, so *creating first and opening up afterwards* is the safe order. Opening up is the risky step.
4. **The owner always keeps `Control`.** Before and after writing an ACL the app checks that the owner is in it.
5. **Read back** the container and its `.acl` and compare with the template. Report the result to the user.
6. **Never overwrite an existing `.acl` silently.** Changing one needs an explicit action and a read-modify-write with the ETag.
7. **Idempotent:** running the setup twice must change nothing. A half-finished run is continued by running it again.
8. **Normal-user flows handle a missing org setup** (a `404` on append) with a clear message, not a raw error.

### 4.2 The action "Initialise org pod" (planned, not built yet)

Visible only to the core admin. It lists each org container with its state (missing / exists / ACL as expected), shows what it **would** create, and creates the missing ones on a button press, never automatically, because it writes access rules. The same function later sets up a further org pod (a second Tafel location) without manual work.

## 5. Roles

| Category | How recognised | Source |
|---|---|---|
| core admin | WebID equals the org WebID in `config.js` | code, no network request |
| admin | WebID is a member of `staff/admins.ttl` | org pod, public |
| staff | WebID is a member of `staff/herford.ttl` | org pod, public |
| normal user | any other WebID | – |

Highest category wins, WebIDs are compared exactly. The group documents are **public by design** and are read without login. If a list cannot be read, nobody gets extra rights from it.

## 6. Permissions

### 6.1 Org pod (`https://teamid.live/herford/`)

| Container | Public | Logged in (normal user) | Staff | Admin (group) | Owner |
|---|---|---|---|---|---|
| `appointments/` | read | read | read, write | read, write | all |
| `bookings/` | – | **append** | read, write; control over contents | read, write; control over contents | all |
| `submissions/` | – | **append** | read, write; control over contents | read, write; control over contents | all |
| `verifications/` | – | – (own file only, per-record ACL) | read, write; control over contents | read, write; control over contents | all |
| `staff/` | read | read | read | read, write | all |
| `profile/` | – | – | read | read, write | all |

"Control over contents" means `acl:Control` **only as `acl:default`**: it applies to the files inside the container, **not** to the container's own ACL. Staff and admins need it to write per-record ACLs. Only the owner can change the ACL of a container.

### 6.2 Consumer pod (after the consumer's release)

| Container | Consumer (owner) | Staff, admin group and org WebID | Everyone else |
|---|---|---|---|
| `documents/` | read, write, control | **read** (only after release, revocable) | – |
| `bookings/` | read, write, control | **read** (only after release, revocable) | – |

### 6.3 Rules of Web Access Control to remember

1. **Writing an `.acl` needs `acl:Control`** over the resource it protects. "Write" is not enough.
2. **No additive inheritance.** As soon as a resource has its **own** `.acl`, only that one applies. A per-record ACL must list **all** authorised parties again.
3. **Locking yourself out.** An ACL without the owner's `Control` removes the owner's access. Hence rule 4.1.4.
4. **Least privilege for groups.** A group member with `Control` on a container's own ACL could rewrite it and lock the owner out. That is why admins have **no** `Control` on `staff/` and only `default` Control on the contents of the inboxes.

### 6.4 ACL templates

Prefixes for all templates:

```turtle
@prefix acl:  <http://www.w3.org/ns/auth/acl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
```

**(a) Org pod, `appointments/.acl`:** time windows are public, staff and admins maintain them.

```turtle
# https://teamid.live/herford/solid-tafel/appointments/.acl
<#owner> a acl:Authorization ;
    acl:agent <https://teamid.live/herford/profile/card#me> ;
    acl:accessTo <./> ; acl:default <./> ;
    acl:mode acl:Read, acl:Write, acl:Control .

<#team> a acl:Authorization ;
    acl:agentGroup <https://teamid.live/herford/solid-tafel/staff/admins.ttl#admins> ,
                   <https://teamid.live/herford/solid-tafel/staff/herford.ttl#staff> ;
    acl:accessTo <./> ; acl:default <./> ;
    acl:mode acl:Read, acl:Write .

<#public-read> a acl:Authorization ;
    acl:agentClass foaf:Agent ;
    acl:accessTo <./> ; acl:default <./> ;
    acl:mode acl:Read .
```

**(b) Org pod, `bookings/.acl` and `submissions/.acl`:** inboxes that every logged-in user may append to.

```turtle
# https://teamid.live/herford/solid-tafel/bookings/.acl
<#owner> a acl:Authorization ;
    acl:agent <https://teamid.live/herford/profile/card#me> ;
    acl:accessTo <./> ; acl:default <./> ;
    acl:mode acl:Read, acl:Write, acl:Control .

<#team> a acl:Authorization ;
    acl:agentGroup <https://teamid.live/herford/solid-tafel/staff/admins.ttl#admins> ,
                   <https://teamid.live/herford/solid-tafel/staff/herford.ttl#staff> ;
    acl:accessTo <./> ;
    acl:mode acl:Read, acl:Write .

<#team-contents> a acl:Authorization ;
    acl:agentGroup <https://teamid.live/herford/solid-tafel/staff/admins.ttl#admins> ,
                   <https://teamid.live/herford/solid-tafel/staff/herford.ttl#staff> ;
    acl:default <./> ;
    acl:mode acl:Read, acl:Write, acl:Control .

<#guests-append> a acl:Authorization ;
    acl:agentClass acl:AuthenticatedAgent ;
    acl:accessTo <./> ;
    acl:mode acl:Append .
```

**(c) Org pod, `verifications/.acl`:** like (b), but without `guests-append`.

```turtle
# https://teamid.live/herford/solid-tafel/verifications/.acl
<#owner> a acl:Authorization ;
    acl:agent <https://teamid.live/herford/profile/card#me> ;
    acl:accessTo <./> ; acl:default <./> ;
    acl:mode acl:Read, acl:Write, acl:Control .

<#team> a acl:Authorization ;
    acl:agentGroup <https://teamid.live/herford/solid-tafel/staff/admins.ttl#admins> ,
                   <https://teamid.live/herford/solid-tafel/staff/herford.ttl#staff> ;
    acl:accessTo <./> ;
    acl:mode acl:Read, acl:Write .

<#team-contents> a acl:Authorization ;
    acl:agentGroup <https://teamid.live/herford/solid-tafel/staff/admins.ttl#admins> ,
                   <https://teamid.live/herford/solid-tafel/staff/herford.ttl#staff> ;
    acl:default <./> ;
    acl:mode acl:Read, acl:Write, acl:Control .
```

**(d) Per-record ACL** for a verification result or a confirmed booking reference. Staff write it so that the person can read **their own** record. It replaces the container rules completely, so everybody is listed again.

```turtle
# https://teamid.live/herford/solid-tafel/verifications/9d3e.ttl.acl
<#owner> a acl:Authorization ;
    acl:agent <https://teamid.live/herford/profile/card#me> ;
    acl:accessTo <9d3e.ttl> ;
    acl:mode acl:Read, acl:Write, acl:Control .

<#team> a acl:Authorization ;
    acl:agentGroup <https://teamid.live/herford/solid-tafel/staff/admins.ttl#admins> ,
                   <https://teamid.live/herford/solid-tafel/staff/herford.ttl#staff> ;
    acl:accessTo <9d3e.ttl> ;
    acl:mode acl:Read, acl:Write, acl:Control .

<#person> a acl:Authorization ;
    acl:agent <https://teamid.live/tafel_test/profile/card#me> ;
    acl:accessTo <9d3e.ttl> ;
    acl:mode acl:Read .
```

**(e) Consumer pod, `documents/.acl` and `bookings/.acl`**, written by the consumer's app when the consumer grants the release:

```turtle
# https://teamid.live/tafel_test/solid-tafel/documents/.acl
<#owner> a acl:Authorization ;
    acl:agent <https://teamid.live/tafel_test/profile/card#me> ;
    acl:accessTo <./> ; acl:default <./> ;
    acl:mode acl:Read, acl:Write, acl:Control .

<#tafel-staff> a acl:Authorization ;
    acl:agent <https://teamid.live/herford/profile/card#me> ;
    acl:agentGroup <https://teamid.live/herford/solid-tafel/staff/admins.ttl#admins> ,
                   <https://teamid.live/herford/solid-tafel/staff/herford.ttl#staff> ;
    acl:accessTo <./> ; acl:default <./> ;
    acl:mode acl:Read .
```

**(f) Org pod, `staff/.acl` as deployed:** the admins group maintains the lists but cannot change the access rules.

```turtle
# https://teamid.live/herford/solid-tafel/staff/.acl
<#owner> a acl:Authorization ;
    acl:agent <https://teamid.live/herford/profile/card#me> ;
    acl:accessTo <./> ; acl:default <./> ;
    acl:mode acl:Read, acl:Write, acl:Control .

<#admins> a acl:Authorization ;
    acl:agentGroup <https://teamid.live/herford/solid-tafel/staff/admins.ttl#admins> ;
    acl:accessTo <./> ; acl:default <./> ;
    acl:mode acl:Read, acl:Write .

<#public-read> a acl:Authorization ;
    acl:agentClass foaf:Agent ;
    acl:accessTo <./> ; acl:default <./> ;
    acl:mode acl:Read .
```

The templates are drafts until the checks in section 8 have run on the real server.

## 7. Records

| Record | Class | Container | Created by | Read by |
|---|---|---|---|---|
| Time window | `tafel:Appointment` (`schema:Event`) | org `appointments/` | staff | everyone |
| Booking (original) | `tafel:Booking` | consumer `bookings/` | consumer | consumer; staff after release |
| Booking reference | `tafel:BookingReference` | org `bookings/` | consumer (append); staff change the status | staff; the consumer only the own one, once staff grant it |
| Notice | PDF | consumer `documents/` | consumer | consumer; staff after release |
| Submission | `tafel:DocumentSubmission` | org `submissions/` | consumer (append) | staff |
| Verification result | `tafel:Verification` | org `verifications/` | staff | staff; the person only the own one |

New in vocabulary v0.4: `tafel:DocumentSubmission`, `tafel:forPerson`, `tafel:forDocument`, `tafel:bookedBy`, `tafel:orgRecord`, `tafel:personCount`, `tafel:note`.

`tafel:personCount` (number of persons in the household the user picks up for) is stored per pickup, on the booking **and** on the booking reference, so staff can read it without opening the consumer's pod.

```turtle
@prefix tafel:   <https://serverproject.de/solid-tafel/ns.ttl#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
```

```turtle
# Booking, original in the consumer pod: .../tafel_test/solid-tafel/bookings/3f2a.ttl
<#this> a tafel:Booking ;
    tafel:forAppointment <https://teamid.live/herford/solid-tafel/appointments/2026-11-04-1000.ttl#this> ;
    tafel:bookingStatus tafel:requested ;
    tafel:personCount 4 ;
    tafel:orgRecord <https://teamid.live/herford/solid-tafel/bookings/a7c1> ;
    dcterms:created "2026-10-26T09:15:00Z"^^xsd:dateTime .
```

```turtle
# Booking reference in the org pod: .../herford/solid-tafel/bookings/a7c1
<#this> a tafel:BookingReference ;
    tafel:forAppointment <https://teamid.live/herford/solid-tafel/appointments/2026-11-04-1000.ttl#this> ;
    tafel:bookedBy <https://teamid.live/tafel_test/profile/card#me> ;
    tafel:bookingResource <https://teamid.live/tafel_test/solid-tafel/bookings/3f2a.ttl#this> ;
    tafel:bookingStatus tafel:requested ;
    tafel:personCount 4 ;
    dcterms:created "2026-10-26T09:15:02Z"^^xsd:dateTime .
```

```turtle
# Submission in the org pod: .../herford/solid-tafel/submissions/b410
<#this> a tafel:DocumentSubmission ;
    tafel:forPerson <https://teamid.live/tafel_test/profile/card#me> ;
    tafel:forDocument <https://teamid.live/tafel_test/solid-tafel/documents/bescheid-20261026T091500Z.pdf> ;
    dcterms:created "2026-10-26T09:15:03Z"^^xsd:dateTime .
```

The display status of a booking and of a notice is derived, not stored. The rules are in `pflichtenheft.md`, section 5.2.

## 8. Server behaviour still to verify (on `teamid.live`)

Short tests with the owner login, before code relies on them:

- **Container creation:** `PUT` with a trailing `/` and the `Link` header, or `POST` with `Slug` and `Link`? Which one does the server accept?
- **`If-None-Match: *`** on `PUT`: is `412` returned when the container or `.acl` already exists?
- **Implicit creation:** does writing a file create missing parent containers?
- **A new container's default ACL:** is it private (inherits the pod root's owner-only rule)?
- **`POST` with `Slug`** into a container where the caller only has `Append`; relative IRIs (`<#this>`) in a `POST` body: against which URL are they resolved?
- **ETag / `If-Match`** on `PUT`.
- **`acl:default` with only `acl:Control`** for a group (the "control over contents" rule).
- **`acl:agentGroup` across servers:** a consumer pod on another server must evaluate a group document on `teamid.live`. Same-server evaluation is already confirmed (the admin write test on `staff/`).
- **Foreign issuers** (a login from another identity provider) are accepted by the org pod.
- **Cache behaviour** after a person is removed from a group.

## 9. Corrections to `pflichtenheft.md` v1.1

To be applied at its next revision:

1. `staff/`: the admins group has `Read, Write` but **no** `Control` (as deployed); matrix 6.3 gave admins `Control`.
2. Inboxes and `verifications/`: admins and staff get `Control` only as `acl:default` (contents), not on the container's own ACL. Template 6.5 (b) and (c) gave the admins group `Control` on the container.
3. Section 6.6 "Setting up the org pod (manual)" shrinks: only the pod root and `staff/` are manual, the rest is created by the app (4).
4. Template for `appointments/.acl` (public read) is now written out (6.4 a).
5. `tafel:personCount` and `tafel:note` belong to the vocabulary; Appendix A of the Pflichtenheft lists them as pending.

## 10. Open points

- `personCount`: once per person or per pickup (modelled per pickup); is capacity counted in bookings or in persons?
- Who may run "Initialise org pod" if a second org pod is added: the core admin of that pod, by the same rule.
- Whether `profile/` is needed at all in the MVP.
- One file per time window or one container per day (affects listing speed).
