import { useEffect, useReducer, useRef, useState } from 'react';
import { exportBackup, lastExport } from '../backup';
import { canPromptInstall, isInstalled, isIos, onInstallChange, promptInstall } from '../pwa';
import { dayDiff, todayISO } from '../domain/dates';
import { migrate } from '../domain/migrate';
import type { Data } from '../domain/model';
import { emptyData, heroName } from '../domain/model';
import { Icon } from '../components/Icon';
import { CloseBtn, onEnter, Portrait, Sheet } from '../components/common';
import { useStore } from '../state/store';


/** Center-crops an image file to a small square JPEG, so the portrait stays light in storage. */
function toPortrait(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight), px = 256;
      const c = document.createElement('canvas');
      c.width = c.height = px;
      c.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, px, px);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}

function summary(d: Data) {
  const parts = [
    'level ' + d.hero.level,
    d.quests.length + (d.quests.length === 1 ? ' quest' : ' quests'),
    d.habits.length + (d.habits.length === 1 ? ' habit' : ' habits'),
    Object.keys(d.camps).length + (Object.keys(d.camps).length === 1 ? ' campaign' : ' campaigns'),
    d.companions.length + d.tomes.length + d.codex.length + ' Glossary entries',
  ];
  return parts.join(', ');
}

/** Picks a backup file, checks it, and asks before replacing the current log. */
export function useImport() {
  const { actions, showToast } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    let d: Data | null = null;
    try { d = migrate(JSON.parse(await file.text()), todayISO()); } catch { d = null; }
    if (input.current) input.current.value = '';
    if (!d) { showToast("That file isn't a Questlog backup", file.name); return; }
    const next = d;
    actions.confirm({
      title: 'Restore this backup?',
      body: 'It holds ' + summary(next) + '. It replaces everything in this browser.',
      confirmLabel: 'Restore backup',
      onConfirm: () => { actions.replaceData(next); showToast('Backup restored', heroName(next.hero) + ' · level ' + next.hero.level); },
    });
  };
  const field = <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />;
  return { open: () => input.current?.click(), field };
}

export function ProfileSheet() {
  const { data, setUi, today, actions, showToast } = useStore();
  const { hero } = data;
  const [lastExportDay, setLastExport] = useState(lastExport);
  const picker = useRef<HTMLInputElement>(null);
  const restore = useImport();
  const close = () => setUi({ profileOpen: false });
  const questsDone = data.quests.filter((q) => q.status === 'done').length;
  const seals = Object.values(data.camps).filter((c) => c.completedOn).length;

  const pickPortrait = async (file: File | undefined) => {
    if (!file) return;
    try { actions.updateHero({ portrait: await toPortrait(file) }); } catch { showToast("That picture couldn't be read", file.name); }
    if (picker.current) picker.current.value = '';
  };

  const exportLog = () => {
    const file = exportBackup(data, today);
    setLastExport(today);
    showToast('Backup saved', file);
  };

  const startOver = () => actions.confirm({
    title: 'Start over?',
    body: 'This erases every quest, habit, campaign, Glossary entry and reward in this browser, and resets you to level 1. Export a backup first if you might want it back.',
    confirmLabel: 'Erase everything',
    onConfirm: () => { actions.replaceData(emptyData()); showToast('A fresh log', 'Everything was erased'); },
  });

  const since = lastExportDay ? dayDiff(today, lastExportDay) : null;
  const backupNote = since === null ? 'You have not exported a backup from this browser yet.'
    : since === 0 ? 'Last backup: today.' : 'Last backup: ' + since + (since === 1 ? ' day' : ' days') + ' ago.';

  return (
    <Sheet onClose={close} label="Profile">
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 6 }}><h3 style={{ fontSize: 26 }}>Profile</h3><span style={{ marginLeft: 'auto' }}><CloseBtn onClick={close} /></span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Portrait hero={hero} size={84} fontSize={40} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <button className="btn btn-secondary" onClick={() => picker.current?.click()} style={{ minHeight: 40 }}><Icon n="pencil" size={14} />{hero.portrait ? 'Change picture' : 'Add a picture'}</button>
          {hero.portrait && <button className="btn btn-ghost inked" onClick={() => actions.updateHero({ portrait: undefined })}>Use monogram</button>}
          <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => pickPortrait(e.target.files?.[0])} />
        </div>
      </div>
      <div className="field"><label htmlFor="hero-name">Name</label>
        <input id="hero-name" className="input" value={hero.name} placeholder="Adventurer" onChange={(e) => actions.updateHero({ name: e.target.value })}
          onBlur={() => { if (!hero.name.trim()) actions.updateHero({ name: 'Adventurer' }); }} style={{ minHeight: 44, fontSize: 16 }} />
      </div>
      <div className="facts" style={{ gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--q-rule)', borderBottom: '1px solid var(--q-rule)' }}>
        {[['Level', hero.level], ['Gold', hero.gold], ['Quests done', questsDone], ['Seals', seals]].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 0' }}>
            <span className="label" style={{ fontSize: 10 }}>{k}</span>
            <span className="heading tnum" style={{ fontSize: 22 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={{ fontSize: 22 }}>Backup</h3>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Your log is kept only in this browser. Clearing site data or switching devices loses it, so export a backup now and then. {backupNote}
        </p>
        <div className="two-col">
          <button className="btn btn-primary inked" onClick={exportLog} style={{ minHeight: 46 }}>Export backup</button>
          <button className="btn btn-secondary" onClick={restore.open} style={{ minHeight: 46 }}>Restore backup</button>
        </div>
        {restore.field}
      </div>

      <InstallSection />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--q-rule)' }}>
        <button className="danger-btn" onClick={startOver}>Start over</button>
      </div>
    </Sheet>
  );
}

/** First launch: ask for a name, or restore a backup from another device. */
export function Welcome() {
  const { actions } = useStore();
  const [name, setName] = useState('');
  const restore = useImport();
  const begin = () => actions.updateHero({ name: name.trim() || 'Adventurer' });
  return (
    <div className="modal" style={{ zIndex: 70 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="welcome-title" style={{ width: 'min(360px,100%)', display: 'flex', flexDirection: 'column', gap: 12, padding: '28px 22px 20px', textAlign: 'center', border: '1px solid color-mix(in srgb, var(--color-accent-800) 35%, transparent)', borderRadius: 'var(--radius-lg)', boxShadow: 'inset 0 0 0 5px var(--q-parch), inset 0 0 0 6px var(--color-accent-500), var(--shadow-lg)', background: 'var(--q-parch)' }}>
        <span className="seal heading" style={{ width: 64, height: 64, fontSize: 30, alignSelf: 'center' }}>Q</span>
        <span className="kicker">Welcome to Questlog</span>
        <h2 id="welcome-title" style={{ fontSize: 28 }}>What should we call you?</h2>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter(begin)} placeholder="Your name" aria-label="Your name" autoFocus style={{ minHeight: 46, fontSize: 17, textAlign: 'center' }} />
        <button className="btn btn-primary inked" onClick={begin} style={{ minHeight: 46, fontSize: 17 }}>Begin</button>
        <button className="btn btn-ghost inked" onClick={restore.open} style={{ fontSize: 13 }}>Restore a backup instead</button>
        {restore.field}
      </div>
    </div>
  );
}

/** Offers "Install app" where the browser supports it, and explains Add to Home Screen on iPhone. */
function InstallSection() {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => onInstallChange(rerender), []);
  if (isInstalled()) return null;
  if (!canPromptInstall() && !isIos()) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: 22 }}>Install</h3>
      {canPromptInstall() ? (
        <>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Put Questlog on your home screen. It opens like an app and works offline.</p>
          <button className="btn btn-primary inked" onClick={promptInstall} style={{ minHeight: 46 }}>Install app</button>
        </>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>To put Questlog on your home screen, tap Share in Safari, then Add to Home Screen. It opens like an app and works offline.</p>
      )}
    </div>
  );
}
