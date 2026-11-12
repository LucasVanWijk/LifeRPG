// Google sign-in shared by Drive sync and Calendar sync (Google Identity Services, token flow; no server of ours).
// Sign-in in the browser lasts an hour and can only be renewed through a popup, which browsers allow after a tap.

/** OAuth client ID of the web app (public by design); set VITE_GOOGLE_CLIENT_ID at build time. */
export const CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const googleConfigured = CLIENT_ID !== '';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string }) => void }
interface Gis { accounts: { oauth2: { initTokenClient: (c: {
  client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string }) => void;
}) => TokenClient } } }

const gis = () => (window as unknown as { google?: Gis }).google;

let script: Promise<void> | null = null;
/** Loads Google's sign-in script once. Call it early so the later click can open the popup straight away. */
export function loadGis(): Promise<void> {
  if (gis()) return Promise.resolve();
  script ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { script = null; reject(new Error('Could not reach Google. Are you offline?')); };
    document.head.appendChild(s);
  });
  return script;
}

let token: { value: string; exp: number; scope: string } | null = null;
const listeners = new Set<() => void>();
/** Called when a token is obtained or lost. Returns the unsubscribe function. */
export function onTokenChange(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
const changed = () => listeners.forEach((f) => f());

const required = new Set<string>();
/** Scopes this device always asks for (e.g. Calendar once it is switched on), so one sign-in covers everything. */
export function requireScopes(scope: string, on: boolean) { for (const x of scope.split(' ')) { if (on) required.add(x); else required.delete(x); } }

const has = (granted: string, wanted: string) => wanted.split(' ').every((s) => granted.split(' ').includes(s));

/** Is there a sign-in that is still good for these scopes (no popup needed)? */
export function tokenValid(scope: string = DRIVE_SCOPE): boolean {
  return !!token && token.exp > Date.now() + 60_000 && has(token.scope, scope);
}
/** The current access token if it is still good; never opens a popup. */
export function peekToken(scope: string = DRIVE_SCOPE): string | null { return tokenValid(scope) ? token!.value : null; }
export function forgetToken() { token = null; changed(); }

let inflight: Promise<string> | null = null;
/** An access token, asking Google for one (popup, so only from a tap) when there is none or it is about to expire. */
export async function getToken(scope: string = DRIVE_SCOPE): Promise<string> {
  if (tokenValid(scope)) return token!.value;
  // One popup at a time: Drive and Calendar both asking at once share the same sign-in.
  if (inflight) { await inflight.catch(() => undefined); if (tokenValid(scope)) return token!.value; }
  inflight = signIn(scope);
  try { return await inflight; } finally { inflight = null; }
}

async function signIn(scope: string): Promise<string> {
  await loadGis();
  const g = gis();
  if (!g) throw new Error('Google sign-in did not load.');
  // Ask for everything this device uses at once, so one sign-in covers Drive and Calendar.
  const want = [...new Set([...(token?.scope ?? '').split(' '), ...scope.split(' '), ...DRIVE_SCOPE.split(' '), ...required])].filter(Boolean).join(' ');
  return new Promise<string>((resolve, reject) => {
    g.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: want,
      callback: (r) => {
        if (!r.access_token) { reject(new Error(r.error_description || r.error || 'Sign-in was cancelled.')); return; }
        token = { value: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000, scope: want };
        changed();
        resolve(token.value);
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Sign-in was cancelled.' : e.type === 'popup_failed_to_open' ? 'The sign-in popup was blocked. Allow popups for this site.' : 'Sign-in failed.')),
    }).requestAccessToken();
  });
}

/** A Google API call with a bearer token. A 401 forgets the token so the next tap signs in again. */
export async function gfetch(url: string, tok: string, init: RequestInit = {}, what = 'Google'): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: 'Bearer ' + tok } });
  if (res.status === 401) forgetToken();
  if (!res.ok && res.status !== 410 && res.status !== 404 && res.status !== 412) {
    throw new GoogleError(res.status, res.status === 401 ? 'Google sign-in expired. Tap to resume.' : res.status === 403 ? what + ' refused access. Is the API enabled and your account a test user?' : what + ' error ' + res.status + '.');
  }
  return res;
}
export class GoogleError extends Error { constructor(public status: number, message: string) { super(message); } }
