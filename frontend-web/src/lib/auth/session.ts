const TOKEN_KEY = 'access_token';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage;
}

function clearLegacyLocalStorage() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem('role');
  window.localStorage.removeItem('email');
  window.localStorage.removeItem('user_id');
}

type SessionData = {
  accessToken: string;
  role?: string;
  email?: string;
  userId?: number;
};

export function saveSession(session: SessionData) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  clearLegacyLocalStorage();

  storage.setItem(TOKEN_KEY, session.accessToken);
  if (session.role) storage.setItem('role', session.role);
  if (session.email) storage.setItem('email', session.email);
  if (session.userId !== undefined) storage.setItem('user_id', String(session.userId));
}

export function clearSession() {
  const storage = getStorage();
  storage?.removeItem(TOKEN_KEY);
  storage?.removeItem('role');
  storage?.removeItem('email');
  storage?.removeItem('user_id');

  clearLegacyLocalStorage();
}

export function getAccessToken() {
  const storage = getStorage();
  return storage?.getItem(TOKEN_KEY) ?? null;
}

export function hasSession() {
  return Boolean(getAccessToken());
}

export function getRole() {
  const storage = getStorage();
  return (storage?.getItem('role') ?? '').toLowerCase();
}
