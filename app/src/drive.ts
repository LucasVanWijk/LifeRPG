// Manual sync of the whole log with one file in the user's own Google Drive.
// The browser talks to Google directly (Google Identity Services + the Drive v3 API); there is no server of ours.
// Scope drive.file lets the app see only files it created itself, never the rest of the Drive.

/** OAuth client ID of the web app (public by design); set VITE_GOOGLE_CLIENT_ID at build time. */
export const CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const driveConfigured = CLIENT_ID !== '';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const FILE_NAME = 'questlog-backup.json';
const SYNC_KEY = 'questlog:driveSync';

export interface DriveFile { id: string; modifiedTime: string }
/** The Drive file this browser last loaded from or saved to, and its modified time at that moment. */
export interface SyncRecord extends DriveFile { at: string }

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

let token: { value: string; exp: number } | null = null;

/** An access token, asking Google for one (popup) when there is none or it is about to expire. */
export async function getToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  await loadGis();
  const g = gis();
  if (!g) throw new Error('Google sign-in did not load.');
  return new Promise<string>((resolve, reject) => {
    g.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) { reject(new Error(r.error_description || r.error || 'Sign-in was cancelled.')); return; }
        token = { value: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(token.value);
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Sign-in was cancelled.' : e.type === 'popup_failed_to_open' ? 'The sign-in popup was blocked. Allow popups for this site.' : 'Sign-in failed.')),
    }).requestAccessToken();
  });
}

async function api(url: string, tok: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: 'Bearer ' + tok } });
  if (res.status === 401) token = null;
  if (!res.ok) throw new Error(res.status === 401 ? 'Google sign-in expired. Try again.' : res.status === 403 ? 'Google refused access. Is the Drive API enabled and your account a test user?' : 'Google Drive error ' + res.status + '.');
  return res;
}

/** The newest Questlog save this app created in the Drive, if any. */
export async function findFile(tok: string): Promise<DriveFile | null> {
  const q = encodeURIComponent("name = '" + FILE_NAME + "' and trashed = false");
  const res = await api('https://www.googleapis.com/drive/v3/files?q=' + q + '&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id,modifiedTime)', tok);
  const { files } = (await res.json()) as { files: DriveFile[] };
  return files[0] ?? null;
}

export async function download(tok: string, id: string): Promise<unknown> {
  const res = await api('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media', tok);
  return res.json();
}

/** Writes the log to the existing file, or creates it. Returns the file with its new modified time. */
export async function upload(tok: string, json: string, id?: string): Promise<DriveFile> {
  if (id) {
    const res = await api('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media&fields=id,modifiedTime', tok, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json,
    });
    return res.json();
  }
  const boundary = 'questlog' + Date.now();
  const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: FILE_NAME, mimeType: 'application/json' })
    + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + json + '\r\n--' + boundary + '--';
  const res = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime', tok, {
    method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body,
  });
  return res.json();
}

/** True when the Drive file was changed by someone else since this browser last synced it. */
export const driveHasNewer = (remote: DriveFile, last: SyncRecord | null) => !last || last.id !== remote.id || last.modifiedTime !== remote.modifiedTime;

export function lastSync(): SyncRecord | null {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY) ?? 'null') as SyncRecord | null; } catch { return null; }
}
export function recordSync(f: DriveFile): SyncRecord {
  const r: SyncRecord = { ...f, at: new Date().toISOString() };
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(r)); } catch { /* private mode */ }
  return r;
}
