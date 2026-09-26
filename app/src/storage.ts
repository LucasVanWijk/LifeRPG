// Asks the browser to keep Questlog's data, and reports whether it will.
import { isInstalled, isIos } from './pwa';

const IOS_KEY = 'questlog:iosWarningDismissed';

/** Requests persistent storage once; browsers that support it then won't clear the log under storage pressure. */
export async function persistStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist?.();
  } catch { /* not supported */ }
}

export type StorageState = 'persisted' | 'best-effort' | 'unknown';
export async function storageState(): Promise<StorageState> {
  try {
    if (!navigator.storage?.persisted) return 'unknown';
    return (await navigator.storage.persisted()) ? 'persisted' : 'best-effort';
  } catch { return 'unknown'; }
}

/** Safari on iPhone clears site data after 7 days without a visit, unless the site is on the Home Screen. */
export const iosAtRisk = () => {
  try { return isIos() && !isInstalled() && localStorage.getItem(IOS_KEY) !== '1'; } catch { return isIos() && !isInstalled(); }
};
export const dismissIosWarning = () => { try { localStorage.setItem(IOS_KEY, '1'); } catch { /* ignore */ } };
