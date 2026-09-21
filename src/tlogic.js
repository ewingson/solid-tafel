/**
 * tlogic.js — Tafel Calendar App Logic — v0.0.2
 * 
 * First iteration: OIDC authentication + debug profile display
 * Inspired by: https://github.com/ewingson/solid-note-experiment/blob/main/slogic.js
 * 
 * Fetches and displays 7 key parameters from the user's Solid Pod:
 *   1. WebID (unique identifier)
 *   2. Display Name (vCard)
 *   3. Preferences File
 *   4. Public Type Index
 *   5. Private Type Index
 *   6. Storage Root
 *   7. OIDC Issuer (Pod Provider)
 * 
 * NEXT STEPS (iteration 2):
 *   - Add calendar view (fetch appointments from Org Pod)
 *   - Add location selector (Herford / Bielefeld)
 *   - Add role detection (consumer vs. staff)
 */

// ============================================================
// SECTION 1: CONFIGURATION & CONSTANTS
// ============================================================

// Solid RDF Predicates (URIs for profile properties)
const FOAF_NAME = "http://xmlns.com/foaf/0.1/name";
const VCARD_FN = "http://www.w3.org/2006/vcard/ns#fn";
const PREF_FILE = "http://www.w3.org/ns/pim/space#preferencesFile";
const PUBLIC_TI = "http://www.w3.org/ns/solid/terms#publicTypeIndex";
const PRIVATE_TI = "http://www.w3.org/ns/solid/terms#privateTypeIndex";
const STORAGE = "http://www.w3.org/ns/pim/space#storage";

// Config (will be populated on login)
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
 * Updates the status message box.
 * type: 'info' (yellow), 'success' (green), 'error' (red), or default (gray)
 */
function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = '';
  if (type === 'error') statusEl.classList.add('error');
  if (type === 'success') statusEl.classList.add('success');
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
 * truncateUrl(url, length)
 * Shortens long URLs for display (keeps protocol + domain + first path segment)
 */
function truncateUrl(url, length = 50) {
  if (!url) return "—";
  if (url.length <= length) return url;
  try {
    const parsed = new URL(url);
    const short = `${parsed.protocol}//${parsed.hostname}/…`;
    if (short.length < length) return url.substring(0, length - 3) + "…";
    return short;
  } catch (e) {
    return url.substring(0, length - 3) + "…";
  }
}

/**
 * promptForIdp()
 * Asks user to input their Solid Pod provider URL
 */
function promptForIdp() {
  const url = prompt(
    'Enter your Solid Pod provider URL.\n\n' +
    'Examples:\n' +
    '  https://solidweb.org\n' +
    '  https://pod.inrupt.com\n' +
    '  https://herford.meisdata.io\n\n' +
    'Your URL:'
  );
  
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    // Normalize: remove trailing slash and pathname
    const issuer = `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}`;
    return issuer;
  } catch (e) {
    alert('Invalid URL. Please try again.');
    return null;
  }
}

/**
 * readSolidDocument(url)
 * Fetches a Turtle RDF document and parses it with N3.
 * Returns an array of Quads.
 */
async function readSolidDocument(url) {
  try {
    const response = await solidClientAuthentication.fetch(url, {
      headers: { 'Accept': 'text/turtle' }
    });

    // If the document doesn't exist or isn't readable, return empty array
    if (!response.ok) {
      console.warn(`Could not fetch ${url}: ${response.status}`);
      return [];
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
 * getProfileValue(quads, predicate)
 * Extracts the value of a specific RDF predicate from quads.
 */
function getProfileValue(quads, predicate) {
  const quad = quads.find(q => q.predicate.value === predicate);
  return quad ? quad.object.value : null;
}

/**
 * findStorageRoot(url)
 * Recursively walks up the Pod hierarchy to find the storage root.
 * Used as fallback if pim:storage predicate is not found in profile.
 */
async function findStorageRoot(url) {
  // Normalize URL
  url = url.replace(/#.*$/, '').replace(/\/$/, '');
  
  if (url.split('/').length <= 3) {
    // We're at the domain level
    return url + '/';
  }
  
  // Try going up one level
  const parentUrl = url.substring(0, url.lastIndexOf('/'));
  
  try {
    const response = await solidClientAuthentication.fetch(parentUrl, {
      method: 'HEAD'
    });
    
    // Check if response has storage type link header
    const link = response.headers.get('Link');
    if (link && link.includes('space#Storage')) {
      return parentUrl + '/';
    }
  } catch (error) {
    console.warn(`Could not check ${parentUrl}:`, error);
  }
  
  // Recursively try parent
  return findStorageRoot(parentUrl);
}

// ============================================================
// SECTION 4: PROFILE FETCHING
// ============================================================

/**
 * fetchUserProfile(webId)
 * Reads the user's profile document and extracts all 7 parameters.
 * Returns an object with keys: webId, fn, pref, pubti, privti, storage, issuer
 */
async function fetchUserProfile(webId, issuer) {
  try {
    setStatus('📖 Fetching your profile…', 'info');
    
    const quads = await readSolidDocument(webId);
    
    if (quads.length === 0) {
      throw new Error('Profile document empty or unreadable');
    }

    // Extract all 7 parameters
    const profile = {
      webId: webId,
      fn: getProfileValue(quads, VCARD_FN) || 
          getProfileValue(quads, FOAF_NAME) || 
          'Anonymous',
      pref: getProfileValue(quads, PREF_FILE),
      pubti: getProfileValue(quads, PUBLIC_TI),
      privti: getProfileValue(quads, PRIVATE_TI),
      storage: getProfileValue(quads, STORAGE),
      issuer: issuer
    };

    // If storage not found, try to find it
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
  // Set username
  usernameEl.textContent = profile.fn || 'User';

  // Set all 7 parameters (with truncation for long URLs)
  paramWebid.textContent = truncateUrl(profile.webId, 60) || '—';
  paramFn.textContent = profile.fn || '—';
  paramPref.textContent = truncateUrl(profile.pref) || '—';
  paramPubti.textContent = truncateUrl(profile.pubti) || '—';
  paramPrivti.textContent = truncateUrl(profile.privti) || '—';
  paramStorage.textContent = truncateUrl(profile.storage) || '—';
  paramIssuer.textContent = truncateUrl(profile.issuer, 40) || '—';

  // Update visibility
  loadingDiv.setAttribute('hidden', '');
  guestDiv.setAttribute('hidden', '');
  userDiv.removeAttribute('hidden');

  setStatus('✅ Profile loaded successfully!', 'success');
}

/**
 * showGuestUI()
 * Shows the login prompt.
 */
function showGuestUI() {
  clearDebugDisplay();
  loadingDiv.setAttribute('hidden', '');
  userDiv.setAttribute('hidden', '');
  guestDiv.removeAttribute('hidden');
  setStatus('', 'info');
}

// ============================================================
// SECTION 6: AUTHENTICATION FLOW
// ============================================================

/**
 * handleLogin()
 * Triggered when user clicks "Log In" button.
 * Prompts for IdP, then redirects to OIDC login.
 */
function handleLogin() {
  const issuer = promptForIdp();
  if (!issuer) {
    setStatus('❌ Login cancelled.', 'error');
    return;
  }

  setStatus(`🔐 Redirecting to ${issuer}…`, 'info');

  solidClientAuthentication.login({
    oidcIssuer: issuer,
    redirectUrl: window.location.href,
    clientName: 'Tafel Calendar App'
  });
}

/**
 * handleLogout()
 * Logs the user out and returns to guest state.
 */
async function handleLogout() {
  try {
    logoutButton.setAttribute('disabled', '');
    setStatus('🚪 Logging out…', 'info');
    
    await solidClientAuthentication.logout();
    
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
// SECTION 7: INITIALIZATION & EVENT HANDLERS
// ============================================================

/**
 * main()
 * Runs on page load.
 * Checks if user is already logged in, and if so, loads their profile.
 */
async function main() {
  try {
    setStatus('⏳ Checking session…', 'info');

    // Handle redirect from OIDC provider
    await solidClientAuthentication.handleIncomingRedirect({
      restorePreviousSession: true
    });

    // Get current session
    const session = solidClientAuthentication.getDefaultSession();

    if (!session.info.isLoggedIn) {
      showGuestUI();
      return;
    }

    // User is logged in
    currentWebId = session.info.webId;
    
    // Extract issuer from OIDC provider URL (stored in session if available)
    // Fallback: extract from WebID hostname
    currentIssuer = session.info.issuer || 
                    new URL(currentWebId).origin;

    // Fetch and display profile
    const profile = await fetchUserProfile(currentWebId, currentIssuer);
    updateAuthenticatedUI(profile);

  } catch (error) {
    console.error('Initialization error:', error);
    setStatus(`❌ Initialization failed: ${error.message}`, 'error');
    showGuestUI();
  }
}

// ============================================================
// SECTION 8: ATTACH EVENT LISTENERS
// ============================================================

loginButton.addEventListener('click', handleLogin);
logoutButton.addEventListener('click', handleLogout);
refreshButton.addEventListener('click', handleRefresh);

// ============================================================
// SECTION 9: START THE APP
// ============================================================

main();
