// Automatic Drive sync: load and merge the Drive copy, then save the merged log back.
// The sign-in lasts an hour, so when it has expired the sync is "paused" until the next tap.
import { todayISO } from './domain/dates';
import { mergeData } from './domain/merge';
import { migrate } from './domain/migrate';
import type { Data } from './domain/model';
import { download, driveHasNewer, findFile, lastSync, recordSync, upload } from './drive';
import { getToken, peekToken } from './google';

const AUTO_KEY = 'questlog:driveAuto';
const DEVICE_KEY = 'questlog:device';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'paused' | 'error';
export interface SyncState { status: SyncStatus; at?: string; device?: string; error?: string }

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } };

export const autoSyncOn = () => read(AUTO_KEY) === '1';
export const setAutoSyncFlag = (on: boolean) => write(AUTO_KEY, on ? '1' : null);

/** "Chrome on Android" and a short random tag, remembered per browser, so Settings can say which device synced last. */
export function deviceName(): string {
  let n = read(DEVICE_KEY);
  if (!n) {
    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
    n = browser + (os ? ' on ' + os : '') + ' · ' + Math.random().toString(36).slice(2, 6);
    write(DEVICE_KEY, n);
  }
  return n;
}

/** The file written to Drive: the log plus a note of who saved it. `sync` is ignored when loading. */
export const payload = (d: Data) => JSON.stringify({ ...d, sync: { device: deviceName(), at: new Date().toISOString() } });

export interface SyncResult {
  /** What this device should now hold; the same object as the input when nothing came in. */
  data: Data;
  /** The device that last wrote the Drive copy, as far as is known. */
  device?: string;
  uploaded: boolean;
}

/**
 * One round: sign-in (silent unless `interactive`, which needs a tap), merge the Drive copy in when it changed,
 * and save the result when anything is new on either side. Returns null when the sign-in has expired.
 */
export async function syncOnce(local: Data, dirty: boolean, interactive: boolean, now = Date.now()): Promise<SyncResult | null> {
  const tok = interactive ? await getToken() : peekToken();
  if (!tok) return null;
  const remote = await findFile(tok);
  if (!remote) {
    const f = await upload(tok, payload(local));
    recordSync(f, deviceName());
    return { data: local, uploaded: true, device: deviceName() };
  }
  let data = local, device: string | undefined;
  const newer = driveHasNewer(remote, lastSync());
  if (newer) {
    const raw = await download(tok, remote.id);
    device = (raw as { sync?: { device?: string } } | null)?.sync?.device;
    const theirs = migrate(raw, todayISO());
    if (!theirs) throw new Error("The Drive file isn't a Questlog save.");
    data = mergeData(local, theirs, now);
  }
  if (!newer && !dirty) { recordSync(remote, lastSync()?.device); return { data, uploaded: false, device: lastSync()?.device }; }
  const f = await upload(tok, payload(data), remote.id);
  recordSync(f, deviceName());
  return { data, uploaded: true, device: newer ? device : deviceName() };
}
