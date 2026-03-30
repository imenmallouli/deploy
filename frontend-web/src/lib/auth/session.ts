const TOKEN_KEY = 'access_token';

type SessionData = {
  accessToken: string;
  role?: string;
  email?: string;
  userId?: number;
};

export function saveSession(session: SessionData) {
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  if (session.role) localStorage.setItem('role', session.role);
  if (session.email) localStorage.setItem('email', session.email);
  if (session.userId !== undefined) localStorage.setItem('user_id', String(session.userId));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('role');
  localStorage.removeItem('email');
  localStorage.removeItem('user_id');
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function hasSession() {
  return Boolean(getAccessToken());
}
