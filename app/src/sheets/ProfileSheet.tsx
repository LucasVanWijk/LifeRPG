import { useEffect, useReducer, useRef, useState } from 'react';
import { exportBackup, lastExport } from '../backup';
import { download, driveConfigured, driveHasNewer, findFile, getToken, lastSync, loadGis, recordSync, upload } from '../drive';
import { deviceName, payload } from '../sync';
import type { StorageState } from '../storage';
import { storageState } from '../storage';
import { canPromptInstall, isInstalled, isIos, onInstallChange, promptInstall } from '../pwa';
import { dayDiff, todayISO } from '../domain/dates';
import { migrate } from '../domain/migrate';
import type { Data } from '../domain/model';
import { emptyData, HOME_SECTIONS, homeLayout } from '../domain/model';
import type { HomeSection } from '../domain/model';
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
    d.companions.length + d.tomes.length + d.notes.length + ' Glossary entries',
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

function HomeLayoutSection() {
  const { data, actions } = useStore();
  const layout = homeLayout(data.profile);
  const name = (k: HomeSection) => HOME_SECTIONS.find((x) => x.key === k)!.name;
  const save = (order: HomeSection[], hidden: HomeSection[]) =>
    actions.update((d) => ({ ...d, profile: { ...d.profile, home: { order, hidden } } }));
  const move = (i: number, by: number) => {
    const o = [...layout.order];
    const j = i + by;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    save(o, layout.hidden);
  };
  const toggle = (k: HomeSection) => save(layout.order, layout.hidden.includes(k) ? layout.hidden.filter((x) => x !== k) : [...layout.hidden, k]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: 22 }}>Home</h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>Reorder or hide the sections on Home. This is saved with your log, so it follows you between devices.</p>
      {layout.order.map((k, i) => {
        const off = layout.hidden.includes(k);
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, opacity: off ? 0.55 : 1 }}>
            <span className="heading" style={{ flex: 1, fontSize: 17 }}>{name(k)}</span>
            <button className="btn btn-ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={'Move ' + name(k) + ' up'}>↑</button>
            <button className="btn btn-ghost" onClick={() => move(i, 1)} disabled={i === layout.order.length - 1} aria-label={'Move ' + name(k) + ' down'}>↓</button>
            <button className="btn btn-secondary" style={{ minHeight: 34, minWidth: 64 }} onClick={() => toggle(k)} aria-pressed={!off}>{off ? 'Show' : 'Hide'}</button>
          </div>
        );
      })}
    </div>
  );
}

/** Starts the guild over: quests, habits and the Glossary stay. */
function NewGuildSection() {
  const { actions } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: 22 }}>New guild</h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>End this guild and found another. Your quests, habits, calendar and Glossary are kept; the adventurers, town and gold are not.</p>
      {!open ? <button className="btn btn-secondary" onClick={() => setOpen(true)} style={{ minHeight: 46 }}>Start a new guild…</button> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn-primary inked" style={{ minHeight: 46 }} onClick={() => actions.newGuild(true)}>New guild, keep the Hall of Heroes</button>
          <span className="muted" style={{ fontSize: 12 }}>Keeps the heirlooms, monuments, eras and records. The people themselves move on.</span>
          <button className="danger-btn" onClick={() => actions.newGuild(false)}>Start completely clean</button>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
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

      <HomeLayoutSection />

      <ThemeSection />

      <DriveSection />

      <CalendarSection />

      <InstallSection />

      {g && <NewGuildSection />}

      {g && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ fontSize: 22 }}>Holiday mode</h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Stops the guild's clock, expeditions included, until you turn it off. Real-life quests and habits still pay your Champion.</p>
          <button className="btn btn-secondary" onClick={() => actions.holiday(g.holiday === null)} style={{ minHeight: 46 }}>{g.holiday === null ? 'Start a holiday' : 'End the holiday'}</button>
        </div>
      )}

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
  const { data, actions, showToast, sync } = useStore();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(lastSync);
  useEffect(() => { if (driveConfigured) loadGis().catch(() => undefined); }, []);
  useEffect(() => setLast(lastSync()), [sync]);
  if (!driveConfigured) return null;
  const auto = sync.status !== 'off';

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try { await job(); } catch (e) { showToast('Google Drive', e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  };
  const save = () => run(async () => {
    const tok = await getToken();
    const remote = await findFile(tok);
    const write = () => run(async () => {
      const f = await upload(tok, payload(data), remote?.id);
      setLast(recordSync(f, deviceName()));
      showToast('Saved to Google Drive', summary(data));
    });
    if (remote && driveHasNewer(remote, lastSync())) {
      actions.confirm({
        title: 'Overwrite the Drive save?',
        body: 'The save in Google Drive was changed since this device last loaded it (saved ' + new Date(remote.modifiedTime).toLocaleString() + '). Saving now replaces it with this device\'s log. Turn on automatic sync to merge instead.',
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
      onConfirm: () => { actions.replaceData(next); setLast(recordSync(remote, deviceName())); showToast('Loaded from Google Drive', summary(next)); },
    });
  });
  const status = sync.status === 'syncing' ? 'Syncing…' : sync.status === 'paused' ? 'Paused: the Google sign-in lasts an hour. Tap Resume to renew it.'
    : sync.status === 'error' ? (sync.error ?? 'Sync failed.') : sync.status === 'idle' ? 'Up to date.' : 'Off.';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: 22 }}>Google Drive</h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Keep your log in your own Drive. With automatic sync on, changes from every device are merged item by item when the app opens and a few seconds after each edit.
      </p>
      <p className="tnum" style={{ margin: 0, fontSize: 13 }}>
        <strong>Sync:</strong> {status}
        <span className="muted" style={{ display: 'block' }}>
          {last ? 'Last synced ' + new Date(last.at).toLocaleString() + (last.device ? ' · ' + last.device : '') : 'Not synced from this browser yet.'}
        </span>
      </p>
      <div className="two-col">
        {auto
          ? <button className="btn btn-primary inked" onClick={() => void actions.syncNow()} disabled={busy || sync.status === 'syncing'} style={{ minHeight: 46 }}>{sync.status === 'paused' ? 'Resume' : 'Sync now'}</button>
          : <button className="btn btn-primary inked" onClick={() => void actions.setAutoSync(true)} disabled={busy} style={{ minHeight: 46 }}>Turn on automatic sync</button>}
        {auto && <button className="btn btn-secondary" onClick={() => void actions.setAutoSync(false)} style={{ minHeight: 46 }}>Turn off</button>}
      </div>
      <details>
        <summary className="muted" style={{ fontSize: 13, cursor: 'pointer' }}>Manual save and load</summary>
        <div className="two-col" style={{ marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={save} disabled={busy} style={{ minHeight: 46 }}>Save to Drive</button>
          <button className="btn btn-secondary" onClick={load} disabled={busy} style={{ minHeight: 46 }}>Load from Drive</button>
        </div>
      </details>
    </div>
  );
}

function CalendarSection() {
  const { gcfg, gstate, actions } = useStore();
  if (!driveConfigured) return null;
  const toggleShown = (id: string) => actions.setCalendars({ shown: gcfg.shown.includes(id) ? gcfg.shown.filter((x) => x !== id) : [...gcfg.shown, id] });
  const status = gstate.status === 'syncing' ? 'Syncing…' : gstate.status === 'paused' ? 'Paused: the Google sign-in lasts an hour. Tap Resume to renew it.'
    : gstate.status === 'error' ? (gstate.error ?? 'Sync failed.') : gstate.status === 'idle' ? 'Up to date.' : 'Off.';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: 22 }}>Google Calendar</h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Show your Google events in Questlog and send events made here to Google. Changes go both ways; the most recently changed version wins. Repeating events show every occurrence; change a whole series in Google Calendar. Imported .ics events, quest deadlines and birthdays stay in Questlog.
      </p>
      {gcfg.on && (
        <>
          <p className="tnum" style={{ margin: 0, fontSize: 13 }}><strong>Sync:</strong> {status}{gcfg.at ? <span className="muted" style={{ display: 'block' }}>Last synced {new Date(gcfg.at).toLocaleString()}. Shows 30 days back to a year ahead.</span> : null}</p>
          {gcfg.calendars.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="label">Show these calendars</span>
              {gcfg.calendars.map((c) => (
                <label key={c.id} className="toggle-row" style={{ minHeight: 38 }}>
                  <input type="checkbox" checked={gcfg.shown.includes(c.id)} onChange={() => toggleShown(c.id)} />
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color ?? 'var(--color-accent-700)', flex: 'none' }} />
                  <span>{c.name}{c.writable ? '' : ' (read only)'}</span>
                </label>
              ))}
              <div className="field"><label htmlFor="gcal-target">New Questlog events go to</label>
                <select id="gcal-target" className="input" value={gcfg.target} onChange={(e) => actions.setCalendars({ target: e.target.value })} style={{ minHeight: 44 }}>
                  {gcfg.calendars.filter((c) => c.writable).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </>
      )}
      <div className="two-col">
        {gcfg.on
          ? <button className="btn btn-primary inked" onClick={() => void actions.calendarSyncNow()} disabled={gstate.status === 'syncing'} style={{ minHeight: 46 }}>{gstate.status === 'paused' ? 'Resume' : 'Sync now'}</button>
          : <button className="btn btn-primary inked" onClick={() => void actions.setCalendarSync(true)} style={{ minHeight: 46 }}>Connect Google Calendar</button>}
        {gcfg.on && <button className="btn btn-secondary" onClick={() => void actions.setCalendarSync(false)} style={{ minHeight: 46 }}>Turn off</button>}
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
