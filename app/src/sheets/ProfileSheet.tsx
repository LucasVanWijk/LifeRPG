import { useEffect, useReducer, useRef, useState } from 'react';
import { exportBackup, lastExport } from '../backup';
import { download, driveConfigured, driveHasNewer, findFile, getToken, lastSync, loadGis, recordSync, upload } from '../drive';
import type { StorageState } from '../storage';
import { storageState } from '../storage';
import { canPromptInstall, isInstalled, isIos, onInstallChange, promptInstall } from '../pwa';
import { dayDiff, todayISO } from '../domain/dates';
import { migrate } from '../domain/migrate';
import type { Data } from '../domain/model';
import { emptyData } from '../domain/model';
import { PHASE_MS } from '../domain/guild/content';
import { CloseBtn, Sheet } from '../components/common';
import { useStore } from '../state/store';
import { BOARD_THEMES, loadBoardTheme, saveBoardTheme, type BoardTheme } from '../theme';


function summary(d: Data) {
  const parts = [
    d.guild ? d.guild.name : 'no guild yet',
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
      onConfirm: () => { actions.replaceData(next); showToast('Backup restored', next.guild?.name ?? 'Your quest log'); },
    });
  };
  const field = <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />;
  return { open: () => input.current?.click(), field };
}

function ThemeSection() {
  const [theme, setTheme] = useState<BoardTheme>(loadBoardTheme);
  const pick = (t: BoardTheme) => { setTheme(t); saveBoardTheme(t); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="radiogroup" aria-label="Board theme">
      <h3 style={{ fontSize: 22 }}>Theme</h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>The wooden board and notes on the Quests screen.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {BOARD_THEMES.map((t) => (
          <button key={t.key} type="button" role="radio" aria-checked={theme === t.key} onClick={() => pick(t.key)} className="opt-btn" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, minHeight: 44, outline: theme === t.key ? '2px solid var(--color-accent-700)' : undefined }}>
            <span style={{ display: 'flex', alignSelf: 'stretch', height: 22, borderRadius: 3, overflow: 'hidden', border: '1px solid var(--q-rule)' }}>
              {t.swatch.map((c) => <i key={c} style={{ flex: 1, background: c }} />)}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'left' }}>
              <span className="heading" style={{ fontSize: 16 }}>{t.name}{theme === t.key ? ' ✓' : ''}</span>
              <span className="muted" style={{ fontSize: 11 }}>{t.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProfileSheet() {
  const { data, setUi, today, actions, showToast } = useStore();
  const g = data.guild;
  const [lastExportDay, setLastExport] = useState(lastExport);
  const [stored, setStored] = useState<StorageState>('unknown');
  useEffect(() => { void storageState().then(setStored); }, []);
  const restore = useImport();
  const close = () => setUi({ profileOpen: false });
  const questsDone = data.quests.filter((q) => q.status === 'done').length;
  const seals = Object.values(data.camps).filter((c) => c.completedOn).length;

  const exportLog = () => {
    const file = exportBackup(data, today);
    setLastExport(today);
    showToast('Backup saved', file);
  };

  const startOver = () => actions.confirm({
    title: 'Start over?',
    body: 'This erases every quest, habit, campaign, Glossary entry and your guild in this browser. Export a backup first if you might want it back.',
    confirmLabel: 'Erase everything',
    onConfirm: () => { actions.replaceData(emptyData()); showToast('A fresh log', 'Everything was erased'); },
  });

  const since = lastExportDay ? dayDiff(today, lastExportDay) : null;
  const backupNote = since === null ? 'You have not exported a backup from this browser yet.'
    : since === 0 ? 'Last backup: today.' : 'Last backup: ' + since + (since === 1 ? ' day' : ' days') + ' ago.';

  return (
    <Sheet onClose={close} label="Profile">
      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 6 }}><h3 style={{ fontSize: 26 }}>Settings</h3><span style={{ marginLeft: 'auto' }}><CloseBtn onClick={close} /></span></div>
      <div className="facts" style={{ gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--q-rule)', borderBottom: '1px solid var(--q-rule)' }}>
        {[['Guild gold', g?.gold ?? 0], ['Adventurers', g?.adventurers.filter((a) => a.state === 'active').length ?? 0], ['Quests done', questsDone], ['Seals', seals]].map(([k, v]) => (
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
        <p className="tnum" style={{ margin: 0, fontSize: 13, color: stored === 'persisted' ? 'var(--q-moss)' : 'var(--color-accent-800)' }}>
          <strong>Storage:</strong>{' '}
          {stored === 'persisted' ? 'kept permanently by this browser.' : stored === 'best-effort' ? 'the browser may clear it when space runs low, so back up regularly.' : 'this browser does not say whether it keeps the log.'}
          {isIos() && !isInstalled() && <span style={{ display: 'block', color: 'var(--q-wax)', marginTop: 4 }}>On iPhone, Safari deletes data from sites you haven't opened in 7 days. Add Questlog to your Home Screen to keep it.</span>}
        </p>
        <div className="two-col">
          <button className="btn btn-primary inked" onClick={exportLog} style={{ minHeight: 46 }}>Export backup</button>
          <button className="btn btn-secondary" onClick={restore.open} style={{ minHeight: 46 }}>Restore backup</button>
        </div>
        {restore.field}
      </div>

      <ThemeSection />

      <DriveSection />

      <InstallSection />

      {g && new URLSearchParams(window.location.search).has('dev') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ fontSize: 22 }}>Time skip (testing)</h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Moves the guild's clock forward. Only shown with ?dev in the address.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {([['+1 phase', 1], ['+1 day', 3], ['+1 week', 24], ['+1 season', 48], ['+1 year', 192]] as const).map(([label, n]) => (
              <button key={label} className="btn btn-secondary" onClick={() => actions.skip(n * PHASE_MS)} style={{ minHeight: 40 }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--q-rule)' }}>
        <button className="danger-btn" onClick={startOver}>Start over</button>
      </div>
    </Sheet>
  );
}

/** Offers "Install app" where the browser supports it, and explains Add to Home Screen on iPhone. */
/** Manual sync with a file in the user's own Google Drive: nothing happens until a button is pressed. */
function DriveSection() {
  const { data, actions, showToast } = useStore();
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState(lastSync);
  useEffect(() => { if (driveConfigured) loadGis().catch(() => undefined); }, []);
  if (!driveConfigured) return null;

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try { await job(); } catch (e) { showToast('Google Drive', e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  };
  const save = () => run(async () => {
    const tok = await getToken();
    const remote = await findFile(tok);
    const write = () => run(async () => {
      const f = await upload(tok, JSON.stringify(data, null, 2), remote?.id);
      setSync(recordSync(f));
      showToast('Saved to Google Drive', summary(data));
    });
    if (remote && driveHasNewer(remote, lastSync())) {
      actions.confirm({
        title: 'Overwrite the Drive save?',
        body: 'The save in Google Drive was changed since this device last loaded it (saved ' + new Date(remote.modifiedTime).toLocaleString() + '). Saving now replaces it with this device\'s log. Load it first if you want its changes.',
        confirmLabel: 'Overwrite', onConfirm: write,
      });
    } else await write();
  });
  const load = () => run(async () => {
    const tok = await getToken();
    const remote = await findFile(tok);
    if (!remote) { showToast('No save in Google Drive yet', 'Use Save to Drive first.'); return; }
    const next = migrate(await download(tok, remote.id), todayISO());
    if (!next) { showToast("That Drive file isn't a Questlog save", remote.id); return; }
    actions.confirm({
      title: 'Load the Drive save?',
      body: 'It holds ' + summary(next) + ' (saved ' + new Date(remote.modifiedTime).toLocaleString() + '). It replaces everything in this browser.',
      confirmLabel: 'Load save', tone: 'go',
      onConfirm: () => { actions.replaceData(next); setSync(recordSync(remote)); showToast('Loaded from Google Drive', summary(next)); },
    });
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: 22 }}>Google Drive</h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Keep one save in your own Drive and move it between devices. Nothing syncs by itself: press Save to put this log there, Load to bring it here.
        {sync ? ' Last synced ' + new Date(sync.at).toLocaleString() + '.' : ' Not synced from this browser yet.'}
      </p>
      <div className="two-col">
        <button className="btn btn-primary inked" onClick={save} disabled={busy} style={{ minHeight: 46 }}>Save to Drive</button>
        <button className="btn btn-secondary" onClick={load} disabled={busy} style={{ minHeight: 46 }}>Load from Drive</button>
      </div>
    </div>
  );
}

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
