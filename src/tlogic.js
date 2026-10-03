/**
 * tlogic.js — Tafel Calendar App Logic — v0.0.9
 *
 * OIDC auth + code + vocab + pod-layout.
 * Inspired by: https://github.com/ewingson/solid-note-experiment/blob/main/slogic.js
 *
 * Note on version numbering: a v0.0.7 build existed internally (the
 * changes listed below) but was never actually deployed, so it was
 * folded into v0.0.8 rather than shipped separately. v0.0.9 changes
 * NOTHING in this file functionally — the only change this release is
 * the tafel: vocabulary namespace moving to
 * https://serverproject.de/solid-tafel/ns.ttl# (see doc/ns.ttl and
 * doc/pod-layout.md). This app doesn't reference the vocabulary at all
 * yet (that starts in v0.1.0's appointment fetching), so the version
 * bump here is purely to keep index.html/tlogic.js/doc/* numbered
 * together as one release.
 *
 * Fetches and displays 7 key parameters from the user's Solid Pod:
 *   1. WebID (unique identifier)
 *   2. Display Name (vCard / FOAF)
 *   3. Preferences File
 *   4. Public Type Index
 *   5. Private Type Index
 *   6. Storage Root
 *   7. OIDC Issuer (Pod Provider)
 *
 * Changes in this release (vs v0.0.5):
 *   - "Get a Pod" link on the start page (index.html)
 *   - Session is ALWAYS restored through the Inrupt library
 *     (handleIncomingRedirect). localStorage is only a hint (last WebID /
 *     issuer), never a substitute for a real login.
 *   - Profile values are read for the WebID subject only (not for other
 *     people mentioned in the profile document)
 *   - Issuer is the one the user logged in with (or solid:oidcIssuer from the
 *     profile); it is no longer guessed from the WebID origin
 *   - Single #status element, errors are no longer wiped by showGuestUI()
 *   - Login errors are shown; redirectUrl has no query/hash; issuer input
 *     accepts "solidweb.org" without https://
 *   - Version number lives in APP_VERSION only (shown in page via
 *     data-app-version)
 *
 * Structure decision: index.html + tlogic.js only, until pod writes arrive.
 * NEXT STEPS: see doc/pod-layout.md (role detection via staff/*.ttl,
 * appointments from /solid-tafel/appointments/).
 */

// ============================================================
// SECTION 1: CONFIGURATION & CONSTANTS
// ============================================================

const APP_VERSION = '0.0.9';
const APP_NAME = 'Tafel Calendar App';

// Solid RDF Predicates (URIs for profile properties)
const FOAF_NAME = "http://xmlns.com/foaf/0.1/name";
const VCARD_FN = "http://www.w3.org/2006/vcard/ns#fn";
const PREF_FILE = "http://www.w3.org/ns/pim/space#preferencesFile";
const PUBLIC_TI = "http://www.w3.org/ns/solid/terms#publicTypeIndex";
const PRIVATE_TI = "http://www.w3.org/ns/solid/terms#privateTypeIndex";
const STORAGE = "http://www.w3.org/ns/pim/space#storage";
const OIDC_ISSUER = "http://www.w3.org/ns/solid/terms#oidcIssuer";

// localStorage keys (a HINT for returning users, not a session)
const STORAGE_KEY_WEBID = 'tafel_webid';
const STORAGE_KEY_ISSUER = 'tafel_issuer';

// Config (populated on login)
let currentWebId = null;
let currentIssuer = null;

// ============================================================
// SECTION 2: DOM ELEMENT REFERENCES
// ============================================================

const loadingDiv = document.getElementById('loading');
const guestDiv = document.getElementById('auth-guest');
const userDiv = document.getElementById('auth-user');

const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const refreshButton = document.getElementById('refresh-button');

const usernameEl = document.getElementById('username');
const statusEl = document.getElementById('status');

// Debug parameters (7 fields)
const paramWebid = document.getElementById('param-webid');
const paramFn = document.getElementById('param-fn');
const paramPref = document.getElementById('param-pref');
const paramPubti = document.getElementById('param-pubti');
const paramPrivti = document.getElementById('param-privti');
const paramStorage = document.getElementById('param-storage');
const paramIssuer = document.getElementById('param-issuer');

// ============================================================
// SECTION 3: UTILITY FUNCTIONS
// ============================================================

/**
 * setStatus(message, type)
 * Updates the (single) status message box.
 * type: 'info' (yellow), 'success' (green), 'error' (red)
 */
function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = '';
  if (type === 'error') statusEl.classList.add('error');
  if (type === 'success') statusEl.classList.add('success');
}

/**
 * showVersion()
 * Writes APP_VERSION into every [data-app-version] element.
 */
function showVersion() {
  document.querySelectorAll('[data-app-version]').forEach(el => {
    el.textContent = 'v' + APP_VERSION;
  });
}

/**
 * clearDebugDisplay()
 * Resets all 7 parameter fields to "—"
 */
function clearDebugDisplay() {
  paramWebid.textContent = "—";
  paramFn.textContent = "—";
  paramPref.textContent = "—";
  paramPubti.textContent = "—";
  paramPrivti.textContent = "—";
  paramStorage.textContent = "—";
  paramIssuer.textContent = "—";
}

/**
 * saveSession(webId, issuer)
 * Remembers the last WebID + issuer in localStorage.
 * This is only a HINT (prefills the login prompt, keeps the issuer shown in
 * the debug table). Being "logged in" is decided solely by the Inrupt library.
 */
function saveSession(webId, issuer) {
  try {
    localStorage.setItem(STORAGE_KEY_WEBID, webId || '');
    localStorage.setItem(STORAGE_KEY_ISSUER, issuer || '');
  } catch (error) {
    console.warn('[saveSession] Could not save to localStorage:', error);
  }
}

/**
 * saveIssuerHint(issuer)
 * Stores the issuer the user typed, right before the redirect to the IdP.
 * (The library does not tell us the issuer after the redirect.)
 */
function saveIssuerHint(issuer) {
  try {
    localStorage.setItem(STORAGE_KEY_ISSUER, issuer || '');
  } catch (error) {
    console.warn('[saveIssuerHint] Could not save to localStorage:', error);
  }
}

/**
 * loadSession()
 * Returns { webId, issuer } (either may be null). Never throws.
 */
function loadSession() {
  try {
    return {
      webId: localStorage.getItem(STORAGE_KEY_WEBID) || null,
      issuer: localStorage.getItem(STORAGE_KEY_ISSUER) || null
    };
  } catch (error) {
    console.warn('Could not load from localStorage:', error);
    return { webId: null, issuer: null };
  }
}

/**
 * clearSession()
 * Removes the hint from localStorage. Called on logout.
 */
function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY_WEBID);
    localStorage.removeItem(STORAGE_KEY_ISSUER);
  } catch (error) {
    console.warn('Could not clear localStorage:', error);
  }
}

/**
 * showUrl(url)
 * Displays full URLs without truncation
 */
function showUrl(url) {
  return url || "—";
}

/**
 * promptForIdp(defaultUrl)
 * Asks the user for their Solid Pod provider URL.
 * Accepts "solidweb.org" (https:// is added). Only https is allowed
 * (http only for localhost). Returns the issuer origin, or null.
 * Note: issuers with a path (https://host/idp) are not supported here.
 */
function promptForIdp(defaultUrl = '') {
  let url = prompt(
    'Enter your Solid Pod provider URL.\n\n' +
    'Examples:\n' +
    '  https://solidweb.org\n' +
    '  https://pod.inrupt.com\n' +
    '  https://herford.meisdata.io\n\n' +
    'Your URL:',
    defaultUrl
  );

  if (!url) return null;
  url = url.trim();
  if (!url) return null;

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  try {
    const parsed = new URL(url);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
      alert('Please use an https:// address.');
      return null;
    }
    return parsed.origin;
  } catch (e) {
    alert('Invalid URL. Please try again.');
    return null;
  }
}

/**
 * readSolidDocument(url)
 * Fetches a Turtle RDF document and parses it with N3.
 * Returns an array of Quads ([] if missing / unreadable / unparsable).
 */
async function readSolidDocument(url) {
  try {
    const response = await solidClientAuthentication.fetch(url, {
      headers: { 'Accept': 'text/turtle' }
    });

    if (!response.ok) {
      console.warn(`Could not fetch ${url}: ${response.status}`);
      return [];
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (!/turtle/i.test(contentType)) {
      console.warn(`Unexpected Content-Type for ${url}: ${contentType}`);
    }

    const text = await response.text();
    const parser = new N3.Parser({ baseIRI: url });
    return parser.parse(text);
  } catch (error) {
    console.error(`Error reading document ${url}:`, error);
    return [];
  }
}

/**
 * getValue(quads, subject, predicate)
 * Value of `predicate` for `subject` only (a profile document can also
 * describe other people, e.g. foaf:knows entries).
 */
function getValue(quads, subject, predicate) {
  const quad = quads.find(q =>
    q.subject.value === subject && q.predicate.value === predicate);
  return quad ? quad.object.value : null;
}

/**
 * findStorageRoot(url)
 * Walks up the URL hierarchy to find the storage root (fallback if
 * pim:storage is not in the profile). Looks for a Link header of type
 * pim:Storage; falls back to the origin.
 */
async function findStorageRoot(url) {
  url = url.replace(/#.*$/, '').replace(/\/$/, '');

  if (url.split('/').length <= 3) {
    // We're at the domain level
    return url + '/';
  }

  const parentUrl = url.substring(0, url.lastIndexOf('/'));

  try {
    // Containers end with "/"
    const response = await solidClientAuthentication.fetch(parentUrl + '/', {
      method: 'HEAD'
    });

    const link = response.headers.get('Link');
    if (link && link.includes('space#Storage')) {
      return parentUrl + '/';
    }
  } catch (error) {
    console.warn(`Could not check ${parentUrl}:`, error);
  }

  return findStorageRoot(parentUrl);
}

// ============================================================
// SECTION 4: PROFILE FETCHING
// ============================================================

/**
 * fetchUserProfile(webId, issuerHint)
 * Reads the user's profile document and extracts all 7 parameters.
 * Returns { webId, fn, pref, pubti, privti, storage, issuer }
 */
async function fetchUserProfile(webId, issuerHint) {
  try {
    setStatus('📖 Fetching your profile…', 'info');

    const quads = await readSolidDocument(webId);

    if (quads.length === 0) {
      throw new Error('Profile document empty or unreadable');
    }

    const profile = {
      webId: webId,
      fn: getValue(quads, webId, VCARD_FN) ||
          getValue(quads, webId, FOAF_NAME) ||
          'Anonymous',
      pref: getValue(quads, webId, PREF_FILE),
      pubti: getValue(quads, webId, PUBLIC_TI),
      privti: getValue(quads, webId, PRIVATE_TI),
      storage: getValue(quads, webId, STORAGE),
      // The issuer used for login wins; else what the profile declares
      issuer: issuerHint || getValue(quads, webId, OIDC_ISSUER)
    };

    if (!profile.storage) {
      setStatus('🔍 Finding your storage root…', 'info');
      try {
        profile.storage = await findStorageRoot(webId);
      } catch (e) {
        console.warn('Could not find storage root:', e);
        profile.storage = null;
      }
    }

    return profile;
  } catch (error) {
    console.error('Error fetching profile:', error);
    setStatus(`❌ Error fetching profile: ${error.message}`, 'error');
    throw error;
  }
}

// ============================================================
// SECTION 5: UI UPDATE LOGIC
// ============================================================

/**
 * updateAuthenticatedUI(profile)
 * Populates the authenticated view with the user's profile data.
 */
function updateAuthenticatedUI(profile) {
  usernameEl.textContent = profile.fn || 'User';

  paramWebid.textContent = showUrl(profile.webId);
  paramFn.textContent = profile.fn || '—';
  paramPref.textContent = showUrl(profile.pref);
  paramPubti.textContent = showUrl(profile.pubti);
  paramPrivti.textContent = showUrl(profile.privti);
  paramStorage.textContent = showUrl(profile.storage);
  paramIssuer.textContent = showUrl(profile.issuer);

  loadingDiv.setAttribute('hidden', '');
  guestDiv.setAttribute('hidden', '');
  userDiv.removeAttribute('hidden');

  setStatus('✅ Profile loaded successfully!', 'success');
}

/**
 * showGuestUI(keepStatus)
 * Shows the login prompt. keepStatus=true leaves the current status
 * message (e.g. an error) visible.
 */
function showGuestUI(keepStatus = false) {
  clearDebugDisplay();
  loadingDiv.setAttribute('hidden', '');
  userDiv.setAttribute('hidden', '');
  guestDiv.removeAttribute('hidden');
  if (!keepStatus) setStatus('', 'info');
}

// ============================================================
// SECTION 6: AUTHENTICATION FLOW
// ============================================================

/**
 * handleLogin()
 * Prompts for the IdP, then redirects to OIDC login.
 */
async function handleLogin() {
  const issuer = promptForIdp(loadSession().issuer || '');
  if (!issuer) {
    setStatus('❌ Login cancelled.', 'error');
    return;
  }

  setStatus(`🔐 Redirecting to ${issuer}…`, 'info');
  saveIssuerHint(issuer);

  try {
    await solidClientAuthentication.login({
      oidcIssuer: issuer,
      // No query string / hash: it must match after the redirect
      redirectUrl: window.location.origin + window.location.pathname,
      clientName: APP_NAME
    });
  } catch (error) {
    console.error('Login error:', error);
    setStatus(`❌ Login failed: ${error.message}`, 'error');
  }
}

/**
 * handleLogout()
 * Logs the user out and returns to guest state.
 */
async function handleLogout() {
  try {
    logoutButton.setAttribute('disabled', '');
    setStatus('Logging out…', 'info');

    await solidClientAuthentication.logout();

    clearSession();
    currentWebId = null;
    currentIssuer = null;
    showGuestUI();
    setStatus('✅ Logged out.', 'success');
  } catch (error) {
    setStatus(`❌ Logout error: ${error.message}`, 'error');
  } finally {
    logoutButton.removeAttribute('disabled');
  }
}

/**
 * handleRefresh()
 * Re-fetches the profile data without logging in again.
 */
async function handleRefresh() {
  if (!currentWebId) {
    setStatus('❌ Not logged in. Cannot refresh.', 'error');
    return;
  }

  try {
    refreshButton.setAttribute('disabled', '');
    const profile = await fetchUserProfile(currentWebId, currentIssuer);
    updateAuthenticatedUI(profile);
  } catch (error) {
    setStatus(`❌ Refresh failed: ${error.message}`, 'error');
  } finally {
    refreshButton.removeAttribute('disabled');
  }
}

// ============================================================
// SECTION 7: INITIALIZATION
// ============================================================

/**
 * main()
 * Runs on page load.
 *  1. Lets the Inrupt library finish an OIDC redirect or restore a previous
 *     session (restorePreviousSession may redirect to the IdP and back).
 *  2. Not logged in -> guest UI. Logged in -> profile.
 */
async function main() {
  try {
    if (typeof solidClientAuthentication === 'undefined' || typeof N3 === 'undefined') {
      throw new Error('Could not load required libraries (CDN blocked?)');
    }

    setStatus('⏳ Checking session…', 'info');

    await solidClientAuthentication.handleIncomingRedirect({
      restorePreviousSession: true
    });

    const session = solidClientAuthentication.getDefaultSession();

    if (!session.info.isLoggedIn) {
      showGuestUI();
      return;
    }

    currentWebId = session.info.webId;
    // The library does not expose the issuer: use the hint saved at login
    currentIssuer = loadSession().issuer || null;

    const profile = await fetchUserProfile(currentWebId, currentIssuer);
    currentIssuer = profile.issuer || null;
    saveSession(currentWebId, currentIssuer);
    updateAuthenticatedUI(profile);

  } catch (error) {
    console.error('Initialization error:', error);
    showGuestUI(true);
    setStatus(`❌ Initialization failed: ${error.message}`, 'error');
  }
}

// ============================================================
// SECTION 8: EVENT LISTENERS
// ============================================================

loginButton.addEventListener('click', handleLogin);
logoutButton.addEventListener('click', handleLogout);
refreshButton.addEventListener('click', handleRefresh);

// ============================================================
// SECTION 9: START THE APP
// ============================================================

showVersion();
main();
