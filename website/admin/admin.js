const SESSION_KEY = 'fam-admin-session';
const numberFormat = new Intl.NumberFormat('de-DE');

const elements = {
  accountRole: document.getElementById('account-role'),
  emptyState: document.getElementById('empty-state'),
  inviteButton: document.getElementById('invite-button'),
  inviteError: document.getElementById('invite-error'),
  inviteForm: document.getElementById('invite-form'),
  invitePanel: document.getElementById('invite-panel'),
  invitePassword: document.getElementById('invite-password'),
  invitePasswordConfirm: document.getElementById('invite-password-confirm'),
  loginButton: document.getElementById('login-button'),
  loginError: document.getElementById('login-error'),
  loginForm: document.getElementById('login-form'),
  loginPanel: document.getElementById('login-panel'),
  monthPicker: document.getElementById('month-picker'),
  pageStatus: document.getElementById('page-status'),
  pageTitle: document.getElementById('page-title'),
  password: document.getElementById('password'),
  refreshButton: document.getElementById('refresh-button'),
  searchInput: document.getElementById('user-search'),
  signOutButton: document.getElementById('sign-out-button'),
  totalCredits: document.getElementById('total-credits'),
  suggestionCredits: document.getElementById('suggestion-credits'),
  recipeCredits: document.getElementById('recipe-credits'),
  voiceCredits: document.getElementById('voice-credits'),
  updatedAt: document.getElementById('updated-at'),
  usagePanel: document.getElementById('usage-panel'),
  userCount: document.getElementById('user-count'),
  userList: document.getElementById('user-list'),
};

let users = [];
let accountsWithUsage = 0;

class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function readSession() {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value);
    if (
      typeof session.accessToken !== 'string' ||
      typeof session.refreshToken !== 'string' ||
      typeof session.expiresAt !== 'number' ||
      !Number.isFinite(session.expiresAt)
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(value) {
  if (
    typeof value?.access_token !== 'string' ||
    typeof value?.refresh_token !== 'string' ||
    typeof value?.expires_in !== 'number' ||
    !Number.isFinite(value.expires_in) ||
    value.expires_in <= 0
  ) {
    throw new ApiError(502, 'invalid_session');
  }
  const session = {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt: Date.now() + value.expires_in * 1000,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function consumeInviteRedirect() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.get('type') !== 'invite') return { recognized: false, valid: false };

  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  clearSession();
  try {
    saveSession({
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
      expires_in: Number(params.get('expires_in')),
    });
    return { recognized: true, valid: true };
  } catch {
    clearSession();
    return { recognized: true, valid: false };
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    cache: 'no-store',
    ...options,
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ?? 'request_failed');
  }
  return payload;
}

async function refreshSession(session) {
  try {
    const payload = await apiRequest('/api/admin/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    return saveSession(payload);
  } catch (error) {
    clearSession();
    throw error;
  }
}

async function validSession() {
  const session = readSession();
  if (!session) throw new ApiError(401, 'session_expired');
  if (session.expiresAt <= Date.now() + 60_000) return refreshSession(session);
  return session;
}

async function authenticatedRequest(path, options = {}) {
  let session = await validSession();
  let response;
  try {
    response = await fetch(path, {
      cache: 'no-store',
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${session.accessToken}`,
      },
    });
  } catch {
    throw new ApiError(0, 'network_error');
  }

  if (response.status === 401) {
    session = await refreshSession(session);
    try {
      response = await fetch(path, {
        cache: 'no-store',
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
    } catch {
      throw new ApiError(0, 'network_error');
    }
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) clearSession();
    throw new ApiError(response.status, payload?.error ?? 'request_failed');
  }
  return payload;
}

function authenticatedGet(path) {
  return authenticatedRequest(path);
}

function authenticatedPost(path, body) {
  return authenticatedRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setLoginError(message) {
  elements.loginError.textContent = message;
  elements.loginError.hidden = !message;
}

function setPageStatus(message, kind = 'info') {
  elements.pageStatus.textContent = message;
  elements.pageStatus.dataset.kind = kind;
  elements.pageStatus.hidden = !message;
}

function showDashboard() {
  elements.loginPanel.hidden = true;
  elements.invitePanel.hidden = true;
  elements.usagePanel.hidden = false;
  elements.accountRole.hidden = false;
}

function showLogin(message = '') {
  elements.loginPanel.hidden = false;
  elements.invitePanel.hidden = true;
  elements.usagePanel.hidden = true;
  elements.accountRole.hidden = true;
  setLoginError(message);
}

function showInvite(message = '', valid = true) {
  elements.loginPanel.hidden = true;
  elements.invitePanel.hidden = false;
  elements.inviteForm.hidden = !valid;
  elements.usagePanel.hidden = true;
  elements.accountRole.hidden = true;
  elements.inviteError.textContent = message;
  elements.inviteError.hidden = !message;
}

function creditsValue(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function renderUser(user) {
  const row = document.createElement('div');
  row.className = 'user-row';
  row.setAttribute('role', 'listitem');

  const person = document.createElement('div');
  person.className = 'person';
  const name = document.createElement('strong');
  name.textContent = user.name;
  const email = document.createElement('small');
  email.textContent = user.email;
  person.append(name, email);

  const credits = {
    suggestions: creditsValue(user.credits?.suggestions),
    recipes: creditsValue(user.credits?.recipes),
    voice: creditsValue(user.credits?.voice),
    total: creditsValue(user.credits?.total),
  };
  const track = document.createElement('div');
  track.className = 'track';
  track.setAttribute(
    'aria-label',
    `${numberFormat.format(credits.suggestions)} Vorschläge, ${numberFormat.format(credits.recipes)} Rezepte, ${numberFormat.format(credits.voice)} Sprache`,
  );
  track.setAttribute('role', 'img');
  const actionSegments = [
    ['suggestions', credits.suggestions],
    ['recipes', credits.recipes],
    ['voice', credits.voice],
  ];
  for (const [action, amount] of actionSegments) {
    if (amount === 0 || credits.total === 0) continue;
    const segment = document.createElement('span');
    segment.className = `track-segment ${action}`;
    segment.style.width = `${(amount / credits.total) * 100}%`;
    track.append(segment);
  }

  const sum = document.createElement('div');
  sum.className = 'credits-sum';
  sum.append(document.createTextNode(numberFormat.format(credits.total)));
  const unit = document.createElement('small');
  unit.textContent = 'Credits';
  sum.append(unit);
  row.append(person, track, sum);
  return row;
}

function renderUsers() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase('de-DE');
  const visibleUsers = users.filter((user) =>
    `${user.name} ${user.email}`.toLocaleLowerCase('de-DE').includes(query),
  );
  elements.userList.replaceChildren(...visibleUsers.map(renderUser));
  elements.emptyState.hidden = visibleUsers.length > 0;
  elements.userCount.textContent = query
    ? `${numberFormat.format(visibleUsers.length)} von ${numberFormat.format(users.length)} Konten`
    : `${numberFormat.format(users.length)} Konten · ${numberFormat.format(accountsWithUsage)} mit Verbrauch`;
}

function formatMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  return new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

function updateDashboard(data) {
  const totals = data?.totals;
  if (!totals || !Array.isArray(data.users) || typeof data.month !== 'string') {
    throw new ApiError(502, 'invalid_admin_data');
  }
  elements.totalCredits.textContent = numberFormat.format(creditsValue(totals.total_credits));
  elements.suggestionCredits.textContent = numberFormat.format(creditsValue(totals.suggestions));
  elements.recipeCredits.textContent = numberFormat.format(creditsValue(totals.recipes));
  elements.voiceCredits.textContent = numberFormat.format(creditsValue(totals.voice));
  accountsWithUsage = creditsValue(totals.users_with_usage);
  elements.monthPicker.value = data.month;
  elements.pageTitle.textContent = `KI-Nutzung · ${formatMonth(data.month)}`;
  users = data.users.map((user) => ({
    name: typeof user.name === 'string' && user.name ? user.name : 'Unbekannter Nutzer',
    email: typeof user.email === 'string' ? user.email : '',
    credits: user.credits ?? {},
  }));
  renderUsers();
  elements.updatedAt.textContent = `Aktualisiert ${new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())}`;
}

async function loadUsage() {
  const month = elements.monthPicker.value || new Date().toISOString().slice(0, 7);
  setPageStatus('Nutzungsdaten werden geladen.');
  elements.userList.setAttribute('aria-busy', 'true');
  elements.refreshButton.disabled = true;
  try {
    const data = await authenticatedGet(`/api/admin/usage?month=${encodeURIComponent(month)}`);
    updateDashboard(data);
    setPageStatus('');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      showLogin('Deine Sitzung ist abgelaufen oder dieses Konto hat keine Adminfreigabe.');
      return;
    }
    setPageStatus('Die Nutzungsdaten konnten nicht geladen werden. Versuch es erneut.', 'error');
  } finally {
    elements.userList.setAttribute('aria-busy', 'false');
    elements.refreshButton.disabled = false;
  }
}

async function submitLogin(event) {
  event.preventDefault();
  setLoginError('');
  elements.loginButton.disabled = true;
  elements.loginButton.textContent = 'Anmeldung wird geprüft';
  const form = new FormData(elements.loginForm);
  try {
    const session = await apiRequest('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      }),
    });
    saveSession(session);
    elements.password.value = '';
    showDashboard();
    elements.monthPicker.value = new Date().toISOString().slice(0, 7);
    await loadUsage();
  } catch (error) {
    clearSession();
    setLoginError(
      error instanceof ApiError && error.status === 403
        ? 'Dieses Konto ist nicht für den Adminbereich freigeschaltet.'
        : 'Anmeldung fehlgeschlagen. Prüfe deine Zugangsdaten und versuche es erneut.',
    );
  } finally {
    elements.loginButton.disabled = false;
    elements.loginButton.textContent = 'Anmelden';
  }
}

async function submitInvite(event) {
  event.preventDefault();
  elements.inviteError.textContent = '';
  elements.inviteError.hidden = true;
  if (elements.invitePassword.value !== elements.invitePasswordConfirm.value) {
    elements.inviteError.textContent = 'Die Passwörter stimmen nicht überein.';
    elements.inviteError.hidden = false;
    return;
  }

  elements.inviteButton.disabled = true;
  elements.inviteButton.textContent = 'Passwort wird gespeichert';
  try {
    await authenticatedPost('/api/admin/auth/accept-invite', {
      password: elements.invitePassword.value,
    });
    elements.inviteForm.reset();
    showDashboard();
    elements.monthPicker.value = new Date().toISOString().slice(0, 7);
    await loadUsage();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      clearSession();
      showInvite(
        error.status === 403
          ? 'Dieses Konto hat keine Freigabe für den Adminbereich.'
          : 'Der Einladungslink ist abgelaufen. Bitte lass eine neue Einladung senden.',
        false,
      );
      return;
    }
    elements.inviteError.textContent =
      error instanceof ApiError && error.status === 400
        ? 'Das Passwort wurde nicht akzeptiert. Prüfe die Passwortregeln und versuche es erneut.'
        : 'Das Passwort konnte nicht gespeichert werden. Versuch es erneut.';
    elements.inviteError.hidden = false;
  } finally {
    elements.inviteButton.disabled = false;
    elements.inviteButton.textContent = 'Passwort festlegen';
  }
}

async function signOut() {
  const session = readSession();
  clearSession();
  if (session) {
    try {
      await apiRequest('/api/admin/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
    } catch {
      // Clearing the tab session still ends access from this page.
    }
  }
  users = [];
  elements.loginForm.reset();
  showLogin();
}

elements.loginForm.addEventListener('submit', submitLogin);
elements.inviteForm.addEventListener('submit', submitInvite);
elements.refreshButton.addEventListener('click', loadUsage);
elements.signOutButton.addEventListener('click', signOut);
elements.searchInput.addEventListener('input', renderUsers);
elements.monthPicker.addEventListener('change', loadUsage);

const inviteRedirect = consumeInviteRedirect();

if (inviteRedirect.recognized) {
  showInvite(
    inviteRedirect.valid ? '' : 'Der Einladungslink ist ungültig oder abgelaufen. Bitte lass eine neue Einladung senden.',
    inviteRedirect.valid,
  );
} else if (readSession()) {
  showDashboard();
  loadUsage();
} else {
  showLogin();
}
