// What the app was opened with: a share from another app (title, text, url), or a home-screen shortcut.

export interface Shared { title: string; text: string; url: string }
export type StartAction = 'new-quest' | 'checkin' | 'new-note';

const URL_RE = /https?:\/\/[^\s<>"]+/;

/** Reads the query string. Android puts a shared link in `text`; `url` is used when the sender fills it. */
export function readLaunch(search: string): { shared: Shared | null; action: StartAction | null } {
  const p = new URLSearchParams(search);
  const action = p.get('action');
  const title = (p.get('title') ?? '').trim(), text = (p.get('text') ?? '').trim();
  let url = (p.get('url') ?? '').trim();
  const found = !url && URL_RE.exec(text);
  if (found) url = found[0];
  const rest = url && text ? text.replace(url, '').trim() : text;
  const has = !!(title || rest || url);
  return {
    shared: has ? { title, text: rest, url } : null,
    action: action === 'new-quest' || action === 'checkin' || action === 'new-note' ? action : null,
  };
}

/** A title for a shared item: its title, else the first line of the text, else the address's host. */
export function sharedTitle(s: Shared): string {
  if (s.title) return s.title;
  const line = s.text.split('\n').find((l) => l.trim());
  if (line) return line.trim().slice(0, 80);
  try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return s.url; }
}

/** The body of a note made from a share: the text, then the link. */
export const sharedBody = (s: Shared) => [s.text, s.url].filter(Boolean).join('\n\n');
