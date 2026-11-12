import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Icon } from './Icon';

interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null;
  start(): void; stop(): void;
}
type Ctor = new () => Recognition;
const ctor = (): Ctor | undefined => {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
/** Does this browser have speech recognition? (Chrome, Edge, Safari.) */
export const speechSupported = () => typeof window !== 'undefined' && !!ctor();

const SEEN_KEY = 'questlog:micNoticeSeen';

/** A microphone button: the words you say are handed to `onText`. Hidden where the browser can't do it. */
export function MicButton({ onText, label }: { onText: (t: string) => void; label: string }) {
  const { actions } = useStore();
  const [on, setOn] = useState(false);
  const rec = useRef<Recognition | null>(null);
  useEffect(() => () => rec.current?.stop(), []);
  if (!speechSupported()) return null;

  const begin = () => {
    const C = ctor()!;
    const r = new C();
    r.lang = navigator.language || 'en-US';
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results).map((x) => x[0].transcript).join(' ').trim();
      if (text) onText(text);
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    setOn(true);
    try { r.start(); } catch { setOn(false); }
  };
  const click = () => {
    if (on) { rec.current?.stop(); return; }
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* private mode */ }
    if (seen) { begin(); return; }
    // Chrome sends the audio to Google to turn it into text: say so once.
    actions.confirm({
      title: 'Use your voice?',
      body: 'Your browser turns speech into text. Chrome and Edge send the audio to their makers’ servers to do it (Google for Chrome). Questlog itself never stores or sends it.',
      confirmLabel: 'Start listening', tone: 'go',
      onConfirm: () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ } begin(); },
    });
  };
  return (
    <button className="icon-btn" onClick={click} aria-label={on ? 'Stop listening' : label} aria-pressed={on} title={label}
      style={{ color: on ? 'var(--q-wax)' : undefined }}><Icon n="mic" size={17} /></button>
  );
}
