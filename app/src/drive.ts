// Sync of the whole log with one file in the user's own Google Drive.
// The browser talks to Google directly (the Drive v3 API); there is no server of ours.
// Scope drive.file lets the app see only files it created itself, never the rest of the Drive.
import { gfetch, googleConfigured } from './google';

export { getToken, loadGis } from './google';
export const driveConfigured = googleConfigured;

export const FILE_NAME = 'questlog-backup.json';
const SYNC_KEY = 'questlog:driveSync';

export interface DriveFile { id: string; modifiedTime: string }
/** The Drive file this browser last loaded from or saved to, and its modified time at that moment. */
export interface SyncRecord extends DriveFile { at: string; device?: string }

const api = (url: string, tok: string, init: RequestInit = {}) => gfetch(url, tok, init, 'Google Drive');

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
export function recordSync(f: DriveFile, device?: string): SyncRecord {
  const r: SyncRecord = { ...f, at: new Date().toISOString(), device };
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(r)); } catch { /* private mode */ }
  return r;
}
