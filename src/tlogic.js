/**
 * TAFEL CALENDAR APP — tlogic.js v0.1
 * 
 * Solid OIDC Authentication + Profile Fetch + Session Persistence
 * 
 * This is the core logic for:
 * - User login via Pod Provider
 * - OIDC redirect flow
 * - Session restoration from localStorage
 * - Profile document fetching and parsing
 * - Display of 7 key profile parameters
 * 
 * Based on: https://github.com/ewingson/solid-tafel/blob/main/src/tlogic.js
 * Deployed at: https://serverproject.de/solid-tafel/
 */

// ============================================================
// SECTION 1: RDF PREDICATES & CONSTANTS
// ============================================================

// Solid/RDF predicates we extract from the user's profile
const FOAF_NAME = "http://xmlns.com/foaf/0.1/name";
const VCARD_FN = "http://www.w3.org/2006/vcard/ns#fn";
const PREF_FILE = "http://www.w3.org/ns/pim/space#preferencesFile";
const PUBLIC_TI = "http://www.w3.org/ns/solid/terms#publicTypeIndex";
const PRIVATE_TI = "http://www.w3.org/ns/solid/terms#privateTypeIndex";
const STORAGE = "http://www.w3.org/ns/pim/space#storage";

// localStorage keys for session persistence
const STORAGE_KEY_WEBID = 'tafel_webid';
const STORAGE_KEY_ISSUER = 'tafel_issuer';

// ============================================================
// SECTION 2: STATE VARIABLES
// ============================================================

let currentWebId = null;    // User's WebID (e.g., https://pod.example/profile/card#me)
let currentIssuer = null;   // OIDC issuer (e.g., https://pod.example)

// ============================================================
// SECTION 3: DOM ELEMENT REFERENCES
// ============================================================

// Main view containers
const loadingDiv = document.getElementById('loading');
const guestDiv = document.getElementById('auth-guest');
const userDiv = document.getElementById('auth-user');

// Buttons
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const refreshButton = document.getElementById('refresh-button');

// Output elements
const usernameEl = document.getElementById('username');
const statusEl = document.getElementById('status');

// Debug table cells (7 parameters)
const paramWebid = document.getElementById('param-webid');
const paramFn = document.getElementById('param-fn');
const paramPref = document.getElementById('param-pref');
const paramPubti = document.getElementById('param-pubti');
const paramPrivti = document.getElementById('param-privti');
const paramStorage = document.getElementById('param-storage');
const paramIssuer = document.getElementById('param-issuer');

// ============================================================
// SECTION 4: UTILITY FUNCTIONS
// ============================================================

/**
 * setStatus(message, type)
 * Updates the status message box with colored background
 * 
 * @param {string} message - The message to display
 * @param {string} type - 'info' (yellow), 'success' (green), 'error' (red)
 */
function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = '';
  if (type === 'error') statusEl.classList.add('error');
  if (type === 'success') statusEl.classList.add('success');
}

/**
 * clearDebugDisplay()
 * Resets all 7 parameter display fields to "—"
 */
function clearDebugDisplay() {
  [paramWebid, paramFn, paramPref, paramPubti, paramPrivti, paramStorage, paramIssuer]
    .forEach(el => el.textContent = "—");
}

/**
 * showUrl(url)
 * Displays a URL, or "—" if null/undefined
 * (Used to show full URLs without truncation)
 */
function showUrl(url) {
  return url || "—";
}

/**
 * promptForIdp()
 * Asks the user to input their Solid Pod provider URL
 * Normalizes the URL to protocol://hostname:port format
 * 
 * @returns {string|null} The OIDC issuer URL, or null if cancelled
 */
function promptForIdp() {
  const url = prompt(
    'Enter your Solid Pod provider URL.\n\n' +
    'Examples:\n' +
    ' https://solidweb.org\n' +
    ' https://pod.inrupt.com\n' +
    ' https://teamid.live\n\n' +
    'Your URL:'
  );
  
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    // Normalize: just protocol://hostname:port (no path)
    const issuer = `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}`;
    return issuer;
  } catch (e) {
    alert('Invalid URL. Please try again.');
    return null;
  }
}

// ============================================================
// SECTION 5: SESSION MANAGEMENT
// ============================================================

/**
 * saveSession(webId, issuer)
 * Persists the user's session to browser localStorage
 * This allows returning users to skip re-login
 * 
 * @param {string} webId - User's WebID
 * @param {string} issuer - OIDC issuer URL
 */
function saveSession(webId, issuer) {
  try {
    localStorage.setItem(STORAGE_KEY_WEBID, webId);
    localStorage.setItem(STORAGE_KEY_ISSUER, issuer || '');
    console.log('[saveSession] Session saved to localStorage');
  } catch (error) {
    console.warn('[saveSession] Could not save to localStorage:', error);
  }
}

/**
 * loadSession()
 * Retrieves the user's saved session from localStorage
 * 
 * @returns {Object|null} { webId, issuer } or null if not found
 */
function loadSession() {
  try {
    const webId = localStorage.getItem(STORAGE_KEY_WEBID);
    const issuer = localStorage.getItem(STORAGE_KEY_ISSUER);
    if (!webId) return null;
    console.log('[loadSession] Session found in localStorage');
    return { webId, issuer };
  } catch (error) {
    console.warn('[loadSession] Could not load from localStorage:', error);
    return null;
  }
}

/**
 * clearSession()
 * Removes the user's session from localStorage
 * Called on logout
 */
function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY_WEBID);
    localStorage.removeItem(STORAGE_KEY_ISSUER);
    console.log('[clearSession] Session cleared from localStorage');
  } catch (error) {
    console.warn('[clearSession] Could not clear localStorage:', error);
  }
}

// ============================================================
// SECTION 6: SOLID DOCUMENT OPERATIONS
// ============================================================

/**
 * readSolidDocument(url)
 * Fetches and parses a Turtle RDF document from a Solid Pod
 * Uses solidClientAuthentication.fetch() to include auth headers
 * 
 * @param {string} url - The document URL (e.g., https://pod/profile/card)
 * @returns {Array} Array of N3 Quad objects, empty if fetch fails
 */
async function readSolidDocument(url) {
  try {
    const response = await solidClientAuthentication.fetch(url, {
      headers: { 'Accept': 'text/turtle' }
    });
    
    if (!response.ok) {
      console.warn(`[readSolidDocument] Could not fetch ${url}: ${response.status}`);
      return [];
    }
    
    const text = await response.text();
    const parser = new N3.Parser({ baseIRI: url });
    return parser.parse(text);
  } catch (error) {
    console.error(`[readSolidDocument] Error reading ${url}:`, error);
    return [];
  }
}

/**
 * getProfileValue(quads, predicate)
 * Finds the first RDF triple matching a predicate and returns its object
 * 
 * @param {Array} quads - Array of N3 Quad objects
 * @param {string} predicate - RDF predicate URI to search for
 * @returns {string|null} The object value, or null if not found
 */
function getProfileValue(quads, predicate) {
  const quad = quads.find(q => q.predicate.value === predicate);
  return quad ? quad.object.value : null;
}

/**
 * fetchUserProfile(webId, issuer)
 * Fetches the user's profile document and extracts all 7 parameters
 * 
 * The profile document is RDF/Turtle format containing metadata about the user
 * We extract: name, preferences, type indices, storage location, etc.
 * 
 * @param {string} webId - User's WebID
 * @param {string} issuer - OIDC issuer (for display)
 * @returns {Object} Profile object with all 7 parameters
 * @throws {Error} If profile document cannot be read or parsed
 */
async function fetchUserProfile(webId, issuer) {
  try {
    setStatus('📖 Fetching your profile…', 'info');
    
    // The WebID points to a fragment (e.g., #me), we need the document URL
    const profileDocUrl = webId.split('#')[0];
    console.log('[fetchUserProfile] Fetching:', profileDocUrl);
    
    const quads = await readSolidDocument(profileDocUrl);
    
    if (quads.length === 0) {
      throw new Error('Profile document empty or unreadable');
    }
    
    // Extract all 7 parameters from the RDF quads
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
    
    console.log('[fetchUserProfile] Profile fetched:', profile);
    return profile;
  } catch (error) {
    console.error('[fetchUserProfile] Error:', error);
    setStatus(`❌ Error: ${error.message}`, 'error');
    throw error;
  }
}

// ============================================================
// SECTION 7: UI UPDATE FUNCTIONS
// ============================================================

/**
 * updateAuthenticatedUI(profile)
 * Updates the page to show authenticated state with user's profile data
 * Populates all 7 parameter fields and shows the authenticated view
 * 
 * @param {Object} profile - Profile object returned by fetchUserProfile()
 */
function updateAuthenticatedUI(profile) {
  // Set welcome message
  usernameEl.textContent = profile.fn || 'User';
  
  // Set all 7 debug parameters
  paramWebid.textContent = showUrl(profile.webId);
  paramFn.textContent = profile.fn || '—';
  paramPref.textContent = showUrl(profile.pref);
  paramPubti.textContent = showUrl(profile.pubti);
  paramPrivti.textContent = showUrl(profile.privti);
  paramStorage.textContent = showUrl(profile.storage);
  paramIssuer.textContent = showUrl(profile.issuer);
  
  // Toggle visibility
  loadingDiv.setAttribute('hidden', '');
  guestDiv.setAttribute('hidden', '');
  userDiv.removeAttribute('hidden');
  
  setStatus('✅ Profile loaded successfully!', 'success');
}

/**
 * showGuestUI()
 * Updates the page to show guest state (login prompt)
 */
function showGuestUI() {
  clearDebugDisplay();
  loadingDiv.setAttribute('hidden', '');
  userDiv.setAttribute('hidden', '');
  guestDiv.removeAttribute('hidden');
  setStatus('', 'info');
}

// ============================================================
// SECTION 8: AUTHENTICATION EVENT HANDLERS
// ============================================================

/**
 * handleLogin()
 * Called when user clicks "Log In with Solid" button
 * 
 * Flow:
 * 1. Prompt user for Pod Provider URL
 * 2. Call solidClientAuthentication.login() which redirects to OIDC IdP
 * 3. User authenticates
 * 4. IdP redirects back to this page with ?code=... parameters
 * 5. main() processes the redirect
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
 * Called when user clicks "Abmelden" (Logout) button
 * 
 * Clears the OIDC session and localStorage
 */
async function handleLogout() {
  try {
    logoutButton.setAttribute('disabled', '');
    setStatus('Logging out…', 'info');
    
    // Call Solid library logout
    await solidClientAuthentication.logout();
    
    // Clear our localStorage session
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
 * Called when user clicks "Profil aktualisieren" (Refresh Profile) button
 * 
 * Re-fetches the profile data without requiring re-login
 */
async function handleRefresh() {
  if (!currentWebId) {
    setStatus('❌ Not logged in.', 'error');
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
// SECTION 9: MAIN INITIALIZATION
// ============================================================

/**
 * main()
 * Entry point - runs on page load
 * 
 * Handles three cases:
 * 1. User has a saved session in localStorage → restore it
 * 2. User is returning from OIDC redirect → process it
 * 3. First visit, not logged in → show login prompt
 */
async function main() {
  try {
    setStatus('⏳ Checking session…', 'info');
    
    // ================================================================
    // STEP 1: CHECK LOCALSTORAGE FOR SAVED SESSION
    // ================================================================
    // This is how we avoid making users re-login on every page refresh
    const savedSession = loadSession();
    if (savedSession && savedSession.webId) {
      console.log('[main] Found saved session in localStorage, resuming...');
      currentWebId = savedSession.webId;
      currentIssuer = savedSession.issuer || new URL(currentWebId).origin;
      
      // Fetch profile with saved credentials
      const profile = await fetchUserProfile(currentWebId, currentIssuer);
      updateAuthenticatedUI(profile);
      return; // Exit - we're done
    }
    
    // ================================================================
    // STEP 2: HANDLE OIDC REDIRECT
    // ================================================================
    // If the user just authenticated, the IdP redirected back with
    // ?code=... &state=... &iss=... parameters.
    // handleIncomingRedirect() processes these and establishes the session.
    console.log('[main] No saved session, checking for OIDC redirect...');
    await solidClientAuthentication.handleIncomingRedirect({
      restorePreviousSession: true
    });
    
    // ================================================================
    // STEP 3: GET CURRENT SESSION
    // ================================================================
    // After handleIncomingRedirect(), the session is available via
    // getDefaultSession(). This works if the user just logged in via OIDC.
    const session = solidClientAuthentication.getDefaultSession();
    console.log('[main] Current session:', session ? 'active' : 'none');
    
    // Check if user is logged in
    if (!session.info.isLoggedIn) {
      console.log('[main] User not logged in, showing login prompt');
      showGuestUI();
      return;
    }
    
    // ================================================================
    // STEP 4: USER JUST LOGGED IN
    // ================================================================
    // Extract WebID and issuer from the session
    // Note: session.info.webId, not session.webId
    console.log('[main] User logged in!');
    currentWebId = session.info.webId;
    currentIssuer = session.info.issuer || new URL(currentWebId).origin;
    
    // Save to localStorage so they don't have to login again next time
    saveSession(currentWebId, currentIssuer);
    
    // Fetch and display their profile
    const profile = await fetchUserProfile(currentWebId, currentIssuer);
    updateAuthenticatedUI(profile);
    
  } catch (error) {
    console.error('[main] Initialization error:', error);
    setStatus(`❌ Error: ${error.message}`, 'error');
    showGuestUI();
  }
}

// ============================================================
// SECTION 10: ATTACH EVENT LISTENERS
// ============================================================

loginButton.addEventListener('click', handleLogin);
logoutButton.addEventListener('click', handleLogout);
refreshButton.addEventListener('click', handleRefresh);

// ============================================================
// SECTION 11: START THE APP
// ============================================================

console.log('[init] Starting Tafel Calendar App v0.1');
main();
