/**
 * tlogic.js — Tafel Calendar App Logic — v0.0.3
 * 
 * First iteration: OIDC authentication + debug profile display + session persistence
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

// localStorage keys (modular, easy to refactor)
const STORAGE_KEY_WEBID = 'tafel_webid';
const STORAGE_KEY_ISSUER = 'tafel_issuer';

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
 * saveSession(webId, issuer)
 * Persists session to localStorage.
 * Modular: can be replaced with IndexedDB or SessionStorage later.
 * 
 * Future: when "open app" button is added to start page,
 * this allows returning users to skip re-login.
 */
function saveSession(webId, issuer) {
  try {
    console.log('[saveSession] Saving webId:', webId);
    console.log('[saveSession] Saving issuer:', issuer);
    localStorage.setItem(STORAGE_KEY_WEBID, webId);
    localStorage.setItem(STORAGE_KEY_ISSUER, issuer || '');
    console.log('[saveSession] ✅ Session saved to localStorage');
  } catch (error) {
    console.warn('[saveSession] ⚠️ Could not save session to localStorage:', error);
  }
}

/**
 * loadSession()
 * Retrieves session from localStorage.
 * Returns: { webId, issuer } or null if not found.
 */
function loadSession() {
  try {
    const webId = localStorage.getItem(STORAGE_KEY_WEBID);
    const issuer = localStorage.getItem(STORAGE_KEY_ISSUER);
    
    if (!webId) {
      return null;
    }
    
    console.log('Session loaded from localStorage');
    return { webId, issuer };
  } catch (error) {
    console.warn('Could not load session from localStorage:', error);
    return null;
  }
}

/**
 * clearSession()
 * Removes session from localStorage.
 * Called on logout.
 */
function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY_WEBID);
    localStorage.removeItem(STORAGE_KEY_ISSUER);
    console.log('Session cleared from localStorage');
  } catch (error) {
    console.warn('Could not clear session from localStorage:', error);
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

  // Set all 7 parameters (full URLs, no truncation)
  paramWebid.textContent = showUrl(profile.webId) || '—';
  paramFn.textContent = profile.fn || '—';
  paramPref.textContent = showUrl(profile.pref) || '—';
  paramPubti.textContent = showUrl(profile.pubti) || '—';
  paramPrivti.textContent = showUrl(profile.privti) || '—';
  paramStorage.textContent = showUrl(profile.storage) || '—';
  paramIssuer.textContent = showUrl(profile.issuer) || '—';

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
    setStatus('Logging out…', 'info');
    
    await solidClientAuthentication.logout();
    
    // Clear localStorage session
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

    // STEP 1: Check if user has a saved session in localStorage
    const savedSession = loadSession();
    if (savedSession && savedSession.webId) {
      console.log('Resuming saved session from localStorage');
      currentWebId = savedSession.webId;
      currentIssuer = savedSession.issuer || new URL(currentWebId).origin;
      
      // Fetch and display profile from saved session
      const profile = await fetchUserProfile(currentWebId, currentIssuer);
      updateAuthenticatedUI(profile);
      return; // Exit here if saved session works
    }

    // STEP 2: No saved session; handle OIDC redirect (first-time login or session expired)
    await solidClientAuthentication.handleIncomingRedirect({
      restorePreviousSession: true
    });

    // Get current session from @inrupt library
    const session = solidClientAuthentication.getDefaultSession();

    if (!session.info.isLoggedIn) {
      showGuestUI();
      return;
    }

    // STEP 3: User just logged in via OIDC; save to localStorage
    currentWebId = session.info.webId;
    currentIssuer = session.info.issuer || new URL(currentWebId).origin;
    
    // Save this new session for future visits
    saveSession(currentWebId, currentIssuer);

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
