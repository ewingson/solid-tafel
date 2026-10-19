/**
 * config.js — the ONLY place with fixed addresses and identities.
 *
 * WHERE IT LIVES: in the APP, not in the org pod.
 *   repo:      src/js/config.js
 *   deployed:  https://serverproject.de/solid-tafel/js/config.js
 * Reason: the app must know which org pod to talk to BEFORE it can read
 * anything from that pod. A setting that tells you where the pod is cannot
 * be stored inside the pod.
 *
 * WHAT THE FIRST ADMIN IS: `webId` of the org pod below (trust anchor, AF-08).
 * That WebID is shown as "admin" by the user interface without any lookup.
 * Everybody else (more admins, staff) comes from the group documents in the
 * org pod: staff/admins.ttl and staff/<locationCode>.ttl.
 *
 * IMPORTANT
 *  - This file is public. NEVER put passwords, tokens or secrets in here.
 *  - Being "admin" here only changes what the user interface SHOWS. The real
 *    protection is the ACL of the pods, which the app cannot change by
 *    editing this file.
 *  - Addresses of pods always end with "/".
 *  - Loaded as an ES module: <script type="module">. The live app (v0.0.9)
 *    still uses tlogic.js and does not load this file yet.
 */

// Name of the container at the root of EVERY pod (org pod, staff pod, guest pod).
export const APP_ROOT = 'solid-tafel/';

// Vocabulary namespace (hash namespace, ends with "#").
export const NS = 'https://serverproject.de/solid-tafel/ns.ttl#';

// Org pods. MVP: exactly one entry (Tafel Herford).
export const ORG_PODS = [
  {
    locationCode: 'herford',                                  // used in file names: staff/herford.ttl
    label: 'Tafel Herford',
    podUrl: 'https://teamid.live/herford/',                   // must end with "/"
    webId: 'https://teamid.live/herford/profile/card#me'      // owner of the pod = implicit first admin
  }
];

// Limits and defaults.
export const MAX_PDF_BYTES = 10 * 1024 * 1024;                // 10 MB

/**
 * Addresses inside one org pod, derived from the entry above.
 * Nobody else builds these strings by hand (avoids missing or doubled "/").
 */
export function orgUrls(org) {
  const root = org.podUrl + APP_ROOT;
  return {
    root,
    profile: root + 'profile/',
    appointments: root + 'appointments/',
    bookings: root + 'bookings/',
    submissions: root + 'submissions/',
    verifications: root + 'verifications/',
    adminsDoc: root + 'staff/admins.ttl',
    staffDoc: root + `staff/${org.locationCode}.ttl`,
    adminsGroup: root + 'staff/admins.ttl#admins',
    staffGroup: root + `staff/${org.locationCode}.ttl#staff`
  };
}

/**
 * Checks a list of org pod entries. Throws an Error with a clear message at
 * the first problem, so that a typo shows up immediately and not as a strange
 * 404 somewhere later.
 */
export function validateOrgPods(list) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('config: ORG_PODS must contain at least one org pod');
  }
  const seen = new Set();
  for (const org of list) {
    const where = `config: org pod "${org && org.locationCode}"`;
    if (!org || typeof org !== 'object') throw new Error('config: invalid ORG_PODS entry');
    if (!/^[a-z0-9-]+$/.test(org.locationCode || '')) {
      throw new Error(`${where}: locationCode may only contain a-z, 0-9 and "-"`);
    }
    if (seen.has(org.locationCode)) throw new Error(`${where}: duplicate locationCode`);
    seen.add(org.locationCode);

    let pod, web;
    try { pod = new URL(org.podUrl); web = new URL(org.webId); }
    catch (e) { throw new Error(`${where}: podUrl and webId must be valid URLs`); }

    if (pod.protocol !== 'https:' || web.protocol !== 'https:') {
      throw new Error(`${where}: podUrl and webId must use https`);
    }
    if (!org.podUrl.endsWith('/')) throw new Error(`${where}: podUrl must end with "/"`);
    if (pod.origin !== web.origin) throw new Error(`${where}: webId must be on the same server as podUrl`);
    if (!web.pathname.startsWith(pod.pathname)) throw new Error(`${where}: webId must lie inside podUrl`);
    if (!web.hash) throw new Error(`${where}: webId must contain a fragment such as #me`);
  }
}

// Fail loudly at start-up if the configuration is wrong.
validateOrgPods(ORG_PODS);

// MVP convenience: the one and only org pod. Remove this line when a second org pod is added
// and iterate over ORG_PODS instead.
export const ORG = ORG_PODS[0];
