import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { todayISO } from '../domain/dates';
import type { LevelUp, Outcome, Toast } from '../domain/logic';
import { completeQuest, deleteCampaign, deleteQuest, patchQuest, setStatus, settleCampaigns, toggleHabit, undoQuest } from '../domain/logic';
import { migrate } from '../domain/migrate';
import { mergeData, stamp } from '../domain/merge';
import type { Shared } from '../domain/share';
import { readLaunch } from '../domain/share';
import { autoSyncOn, setAutoSyncFlag, syncOnce } from '../sync';
import type { SyncState } from '../sync';
import { driveConfigured, lastSync } from '../drive';
import { getToken, onTokenChange, peekToken, requireScopes, CALENDAR_SCOPE } from '../google';
import type { EventCache, GCalConfig } from '../gcal';
import { insertEvent as gInsert, listCalendars, loadCache, loadConfig, patchEvent as gPatch, pullEvents, removeEvent as gRemove, saveCache, saveConfig, timeZone, toGoogle, fromGoogle } from '../gcal';
import { applyChanges, syncRound } from '../gcalsync';
import type { CalEvent, Campaign, Data, Habit, QuadKey, Quest, Status, Tombstone } from '../domain/model';
import { emptyData, QM } from '../domain/model';
import type { BuildingId, ClassId, PotionKind, Slot, Stance } from '../domain/guild/content';
import { AWAY_SUMMARY_MS } from '../domain/guild/content';
import * as G from '../domain/guild/engine';
import type { Duty, Entry, Guild } from '../domain/guild/types';

// v1 held the design's sample data; v2 starts every log empty. The data inside carries its own version (see migrate.ts).
const STORAGE_KEY = 'questlog:v2';

export type Tab = 'home' | 'quests' | 'calendar' | 'glossary' | 'guild';
export type GuildTab = 'roster' | 'board' | 'town' | 'tavern' | 'legacy';
export type QuestView = 'board' | 'campaign' | 'habits' | 'someday';
export type GlossaryCat = 'companions' | 'tomes' | 'notes';
export type { Toast };

/** tone 'go' shows the confirm button as a normal action instead of a destructive one. */
export interface Confirm { title: string; body: string; confirmLabel: string; cancelLabel?: string; tone?: 'danger' | 'go'; onConfirm: () => void }

export interface Ui {
  tab: Tab;
  questView: QuestView;
  hiddenCamps: string[];
  campaign: string;
  mobileZone: QuadKey | null;
  openId: number | null;
  sheetMode: 'view' | 'edit';
  newOpen: boolean;
  /** 'new' for the New Campaign sheet, or the key of the campaign being edited. */
  campSheet: string | null;
  profileOpen: boolean;
  chronicleOpen: boolean;
  reviewOpen: boolean;
  /** Calendar: the event being shown ('new' for the New event sheet), and the selected day. */
  eventSheet: number | 'new' | null;
  eventMode: 'view' | 'edit';
  calDay: string;
  gCat: GlossaryCat;
  gSearch: string;
  gDetail: string | null;
  openTome: string | null;
  weekOffset: number;
  selDay: string;
  levelUp: LevelUp | null;
  guildTab: GuildTab;
  /** The adventurer, board offer or outing report being shown. */
  advSheet: string | null;
  offerSheet: string | null;
  reportSheet: string | null;
  /** A building's id (or 'hall'), or 'new' for the list of things to build. */
  buildSheet: string | null;
  /** What happened while the app was closed. */
  away: Entry[] | null;
  confirm: Confirm | null;
  /** Something shared from another app, or a blank new note (home-screen shortcut): the Save to Glossary sheet. */
  capture: Shared | null;
  dragId: number | null;
  dragOver: string | null;
}

function loadData(): Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = migrate(JSON.parse(raw), todayISO());
      if (d) return d;
    }
  } catch {
    /* storage unavailable or corrupt: start a fresh log */
  }
  return emptyData();
}

const HIDDEN_CAMPS_KEY = 'liferpg-hidden-campaigns';
function loadHiddenCamps(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN_CAMPS_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

/** Initial screen can be deep-linked, e.g. ?screen=quests&zone=main or ?quest=4&mode=edit. */
function initialUi(today: string): Ui {
  const p = new URLSearchParams(window.location.search);
  const pick = <T extends string>(k: string, allowed: readonly T[], def: T): T => (allowed.includes(p.get(k) as T) ? (p.get(k) as T) : def);
  const quest = Number(p.get('quest'));
  const launch = readLaunch(window.location.search);
  return {
    tab: launch.action === 'checkin' ? 'quests' : pick('screen', ['home', 'quests', 'calendar', 'glossary', 'guild'] as const, 'home'),
    questView: launch.action === 'checkin' ? 'habits' : pick('view', ['board', 'campaign', 'habits', 'someday'] as const, 'board'),
    hiddenCamps: loadHiddenCamps(),
    campaign: p.get('campaign') || '',
    mobileZone: (p.get('zone') as QuadKey) in QM ? (p.get('zone') as QuadKey) : null,
    openId: quest > 0 ? quest : null,
    sheetMode: p.get('mode') === 'edit' ? 'edit' : 'view',
    newOpen: launch.action === 'new-quest',
    campSheet: null,
    profileOpen: false,
    chronicleOpen: false,
    reviewOpen: false,
    eventSheet: null,
    eventMode: 'view',
    calDay: today,
    gCat: pick('cat', ['companions', 'tomes', 'notes'] as const, 'companions'),
    gSearch: '',
    gDetail: p.get('detail'),
    openTome: null,
    weekOffset: 0,
    selDay: today,
    levelUp: null,
    guildTab: pick('gtab', ['roster', 'board', 'town', 'tavern', 'legacy'] as const, 'roster'),
    advSheet: null,
    offerSheet: null,
    reportSheet: null,
    buildSheet: null,
    away: null,
    confirm: null,
    capture: launch.action === 'new-note' ? { title: '', text: '', url: '' } : launch.shared,
    dragId: null,
    dragOver: null,
  };
}

function useLayout() {
  const forced = new URLSearchParams(window.location.search).get('layout');
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return forced ? forced === 'desktop' : w >= 900;
}

/** A new numeric id. It is also at least the current time, so two devices that were offline never hand out the same one. */
const nextId = (xs: { id: number }[]) => Math.max(Date.now(), ...xs.map((x) => x.id + 1));

/** Undo is still safe while the quest log and real-life payments are unchanged; the guild's clock ticking alongside doesn't count. */
const sameLog = (a: Data, b: Data) =>
  a.quests === b.quests && a.habits === b.habits && a.camps === b.camps && a.guild?.ledger === b.guild?.ledger;

function useStoreValue() {
  const [today, setToday] = useState(todayISO);
  const [data, setData] = useState<Data>(loadData);
  const [ui, setUiState] = useState<Ui>(() => initialUi(today));
  const [toast, setToast] = useState<Toast | null>(null);
  const [lastToast, setLastToast] = useState<Toast>({ text: '', sub: '' });
  const toastTimer = useRef<number | undefined>(undefined);
  const toastQueue = useRef<Toast[]>([]);
  // The data just before and after the last undoable action; Undo only applies while nothing else has changed.
  const undoRef = useRef<{ before: Data; after: Data } | null>(null);
  const isDesk = useLayout();
  const scrollRef = useRef<HTMLDivElement>(null);

  // A share or shortcut opened the app: take its parameters out of the address so a reload doesn't repeat it.
  useEffect(() => {
    const l = readLaunch(window.location.search);
    if (l.shared || l.action) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }, []);

  // Keep "today" right when the app stays open overnight or is resumed from the background.
  useEffect(() => {
    const on = () => setToday(todayISO());
    document.addEventListener('visibilitychange', on);
    const t = window.setInterval(on, 60_000);
    return () => { document.removeEventListener('visibilitychange', on); window.clearInterval(t); };
  }, []);

  // Saving is throttled (the guild's clock changes data while the app is open) and flushed when the app is hidden or closed.
  const savedAt = useRef(0);
  const saveTimer = useRef<number | undefined>(undefined);
  const latest = useRef(data);
  latest.current = data;
  useEffect(() => {
    const save = () => {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
      savedAt.current = Date.now();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(latest.current)); } catch { /* quota or private mode */ }
    };
    const wait = 5000 - (Date.now() - savedAt.current);
    if (wait <= 0) save();
    else if (saveTimer.current === undefined) saveTimer.current = window.setTimeout(save, wait);
  }, [data]);
  useEffect(() => {
    const flush = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(latest.current)); } catch { /* ignore */ } };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); };
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    try { localStorage.setItem(HIDDEN_CAMPS_KEY, JSON.stringify(ui.hiddenCamps)); } catch { /* private mode */ }
  }, [ui.hiddenCamps]);
  const setUi = useCallback((patch: Partial<Ui> | ((u: Ui) => Partial<Ui>)) =>
    setUiState((u) => ({ ...u, ...(typeof patch === 'function' ? patch(u) : patch) })), []);

  // Toasts play one after another, so a quest's reward and its campaign's reward are both seen.
  const playNext = useCallback(() => {
    const t = toastQueue.current.shift();
    if (!t) { setToast(null); return; }
    setToast(t);
    setLastToast(t);
    toastTimer.current = window.setTimeout(playNext, t.undo ? 5000 : 2600);
  }, []);
  const showToasts = useCallback((ts: Toast[]) => {
    if (!ts.length) return;
    window.clearTimeout(toastTimer.current);
    toastQueue.current = [...ts];
    playNext();
  }, [playNext]);
  const showToast = useCallback((text: string, sub: string) => showToasts([{ text, sub }]), [showToasts]);

  // Reads the latest data synchronously so completion side effects (toast, level-up) fire once.
  const dataRef = useRef(data);
  dataRef.current = data;
  /** Saves an edit: changed items get their update times, deleted ones a tombstone. */
  const commit = useCallback((d: Data) => { const n = stamp(dataRef.current, d, Date.now()); dataRef.current = n; setData(n); }, []);
  /** Puts data in as it is, without stamping (a restore, or a copy merged from another device). */
  const commitRaw = useCallback((d: Data) => { dataRef.current = d; setData(d); }, []);
  const apply = useCallback((o: Outcome | null) => {
    if (!o) return;
    const before = dataRef.current;
    commit(o.data);
    if (o.toasts.some((t) => t.undo)) undoRef.current = { before, after: dataRef.current };
    showToasts(o.toasts);
    if (o.levelUp) setUi({ levelUp: o.levelUp });
  }, [commit, showToasts, setUi]);

  /** Brings the guild up to now. Returns the data as it is afterwards. */
  const tick = useCallback((summary = false): Data => {
    const cur = dataRef.current;
    if (!cur.guild) return cur;
    const r = G.advance(cur.guild, Date.now());
    if (r.guild === cur.guild) return cur;
    const next = { ...cur, guild: r.guild };
    commit(next);
    if (summary && r.elapsed >= AWAY_SUMMARY_MS && r.entries.length) setUi({ away: r.entries });
    return next;
  }, [commit, setUi]);
  // Catch up on opening and on coming back to the app, and keep ticking while it is open.
  useEffect(() => {
    tick(true);
    const onVis = () => { if (document.visibilityState === 'visible') tick(true); };
    document.addEventListener('visibilitychange', onVis);
    const t = window.setInterval(() => tick(false), 15_000);
    return () => { document.removeEventListener('visibilitychange', onVis); window.clearInterval(t); };
  }, [tick]);

  // ── Drive sync ──
  const [sync, setSync] = useState<SyncState>(() => {
    const l = lastSync();
    return { status: driveConfigured && autoSyncOn() ? 'paused' : 'off', at: l?.at, device: l?.device };
  });
  const syncBusy = useRef(false);
  const dirty = useRef(false);
  const merged = useRef<Data | null>(null);
  const runSync = useCallback(async (interactive: boolean) => {
    if (!driveConfigured || !autoSyncOn() || syncBusy.current) return;
    syncBusy.current = true;
    const snapshot = dataRef.current;
    const wasDirty = dirty.current;
    dirty.current = false;
    setSync((s) => ({ ...s, status: 'syncing', error: undefined }));
    try {
      const r = await syncOnce(snapshot, wasDirty, interactive);
      if (!r) { dirty.current = dirty.current || wasDirty; setSync((s) => ({ ...s, status: 'paused' })); return; }
      let next = r.data;
      // Edits made while the round was running are merged in rather than overwritten, and sent on the next round.
      if (dataRef.current !== snapshot) { next = mergeData(dataRef.current, next, Date.now()); dirty.current = true; }
      if (next !== dataRef.current) { merged.current = next; commitRaw(next); }
      const l = lastSync();
      setSync({ status: 'idle', at: l?.at ?? new Date().toISOString(), device: r.device ?? l?.device });
    } catch (e) {
      dirty.current = true;
      setSync((s) => ({ ...s, status: 'error', error: e instanceof Error ? e.message : 'Sync failed.' }));
    } finally { syncBusy.current = false; }
  }, [commitRaw]);
  // The parts of the log that sync; the guild's clock ticking alone doesn't count as an edit.
  const syncKey = [data.quests, data.habits, data.camps, data.companions, data.tomes, data.notes, data.events, data.profile, data.tombstones];
  useEffect(() => {
    if (merged.current === dataRef.current) { merged.current = null; return; }
    if (!driveConfigured || !autoSyncOn()) return;
    dirty.current = true;
    const t = window.setTimeout(() => void runSync(false), 4000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, syncKey);
  useEffect(() => {
    void runSync(false);
    const onVis = () => { if (document.visibilityState === 'hidden') { if (dirty.current) void runSync(false); } else void runSync(false); };
    document.addEventListener('visibilitychange', onVis);
    const t = window.setInterval(() => void runSync(false), 5 * 60_000);
    const off = onTokenChange(() => void runSync(false));
    return () => { document.removeEventListener('visibilitychange', onVis); window.clearInterval(t); off(); };
  }, [runSync]);

  // ── Google Calendar ──
  const [gcfg, setGcfg] = useState<GCalConfig>(loadConfig);
  const [gcache, setGcache] = useState<EventCache>(loadCache);
  const [gstate, setGstate] = useState<{ status: 'off' | 'idle' | 'syncing' | 'paused' | 'error'; error?: string }>(() => ({ status: driveConfigured && loadConfig().on ? 'paused' : 'off' }));
  const gcfgRef = useRef(gcfg); gcfgRef.current = gcfg;
  const gcacheRef = useRef(gcache); gcacheRef.current = gcache;
  const gBusy = useRef(false);
  const gDirty = useRef(false);
  requireScopes(CALENDAR_SCOPE, gcfg.on);
  const setG = useCallback((cfg: GCalConfig, cache?: EventCache) => {
    gcfgRef.current = cfg; setGcfg(cfg); saveConfig(cfg);
    if (cache) { gcacheRef.current = cache; setGcache(cache); saveCache(cache); }
  }, []);
  const runGcal = useCallback(async (interactive: boolean) => {
    if (!driveConfigured || !gcfgRef.current.on || gBusy.current) return;
    gBusy.current = true;
    setGstate((s) => ({ ...s, status: 'syncing', error: undefined }));
    try {
      const tok = interactive ? await getToken(CALENDAR_SCOPE) : peekToken(CALENDAR_SCOPE);
      if (!tok) { setGstate({ status: 'paused' }); return; }
      let cfg = gcfgRef.current;
      if (!cfg.calendars.length) {
        const calendars = await listCalendars(tok);
        const primary = calendars.find((c) => c.primary) ?? calendars[0];
        cfg = { ...cfg, calendars, shown: primary ? [primary.id] : [], target: primary?.writable ? primary.id : (calendars.find((c) => c.writable)?.id ?? '') };
      }
      const today = todayISO(), now = Date.now();
      const snap = dataRef.current;
      const r = await syncRound({
        api: { pull: (c, o) => pullEvents(tok, c, o), insert: (c, b) => gInsert(tok, c, b), patch: (c, id, b) => gPatch(tok, c, id, b), remove: (c, id) => gRemove(tok, c, id) },
        cfg, cache: gcacheRef.current, events: snap.events, tombstones: snap.tombstones, today, tz: timeZone(), now,
      });
      setG({ ...r.cfg, at: new Date().toISOString() }, r.cache);
      if (r.changes.length) {
        const cur = dataRef.current;
        const gone = r.changes.filter((c) => c.kind === 'remove').map((c) => c.id);
        const tombs: Tombstone[] = gone.map((id) => ({ key: 'event:' + id, at: now }));
        // The events change as they are (no new update times): the sync itself must not look like an edit.
        commitRaw({ ...cur, events: applyChanges(cur.events, r.changes), tombstones: [...cur.tombstones, ...tombs] });
      }
      gDirty.current = false;
      setGstate({ status: 'idle' });
    } catch (e) {
      gDirty.current = true;
      setGstate({ status: 'error', error: e instanceof Error ? e.message : 'Calendar sync failed.' });
    } finally { gBusy.current = false; }
  }, [commitRaw, setG]);
  useEffect(() => {
    if (!gcfgRef.current.on) return;
    gDirty.current = true;
    const t = window.setTimeout(() => void runGcal(false), 4000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.events, data.tombstones]);
  useEffect(() => {
    void runGcal(false);
    const onVis = () => { if (document.visibilityState === 'visible') void runGcal(false); };
    document.addEventListener('visibilitychange', onVis);
    const t = window.setInterval(() => void runGcal(false), 5 * 60_000);
    const off = onTokenChange(() => void runGcal(false));
    return () => { document.removeEventListener('visibilitychange', onVis); window.clearInterval(t); off(); };
  }, [runGcal]);
  /** Your events plus those of the shown Google calendars. */
  const cal: Data = useMemo(() => {
    if (!gcfg.on) return data;
    const extra = gcfg.shown.flatMap((c) => gcache[c] ?? []);
    return extra.length ? { ...data, events: [...data.events, ...extra] } : data;
  }, [data, gcfg.on, gcfg.shown, gcache]);

  const actions = useMemo(() => {
    // Every action starts from the guild as it is now.
    const d = () => tick();
    const guildDo = (fn: (g: Guild) => G.Result, done?: (g: Guild) => void) => {
      const cur = d();
      if (!cur.guild) return false;
      const r = fn(cur.guild);
      if (!r.ok) { showToast("Can't do that", r.reason); return false; }
      commit({ ...cur, guild: r.guild });
      done?.(r.guild);
      return true;
    };
    return {
      // Quests
      complete(id: number) { apply(completeQuest(d(), id, today)); },
      undo(id: number) { apply(undoQuest(d(), id, today)); },
      toggleToday(id: number) {
        const q = d().quests.find((x) => x.id === id);
        if (q) apply(q.doneOn === today ? undoQuest(d(), id, today) : completeQuest(d(), id, today));
      },
      setStatus(id: number, s: Status) { apply(setStatus(d(), id, s, today)); },
      updateQuest(id: number, patch: Partial<Quest>) {
        const next = patchQuest(d(), id, patch);
        // Only a change of campaign can finish or unfinish one.
        apply('campaign' in patch ? settleCampaigns(next, today) : { data: next, toasts: [], levelUp: null });
      },
      createQuest(q: Omit<Quest, 'id'>) {
        const cur = d();
        apply(settleCampaigns({ ...cur, quests: [...cur.quests, { ...q, id: nextId(cur.quests) }] }, today));
        // A new quest should not vanish because its campaign is filtered out of the board.
        const camp = q.campaign || '';
        setUi((u) => (u.hiddenCamps.includes(camp) ? { hiddenCamps: u.hiddenCamps.filter((x) => x !== camp) } : {}));
        showToast('Quest pinned', 'Added to ' + (q.campaign && cur.camps[q.campaign] ? cur.camps[q.campaign].name : QM[q.quad].name));
      },
      toggleStep(id: number, stepId: number) {
        const q = d().quests.find((x) => x.id === id);
        if (!q) return;
        const steps = q.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
        commit(patchQuest(d(), id, { steps }));
        // Ticking the last step offers to finish the quest.
        if (q.status !== 'done' && steps.every((s) => s.done) && steps.find((s) => s.id === stepId)?.done) {
          setUi({ confirm: {
            title: 'All steps done', body: '“' + q.title + '” has every step ticked. Complete the quest?',
            confirmLabel: 'Complete quest', cancelLabel: 'Not yet', tone: 'go',
            onConfirm: () => { apply(completeQuest(dataRef.current, id, today)); setUi({ openId: null }); },
          } });
        }
      },
      deleteQuest(id: number) {
        const q = d().quests.find((x) => x.id === id);
        const o = deleteQuest(d(), id, today);
        apply({ ...o, toasts: [...o.toasts, { text: 'Quest deleted', sub: q?.title ?? '', undo: true }] });
        setUi({ openId: null });
      },
      /** Reverses the last completion, check-in or delete, if nothing has changed since. */
      undoLast() {
        const u = undoRef.current;
        window.clearTimeout(toastTimer.current);
        toastQueue.current = [];
        if (u && sameLog(dataRef.current, u.after)) {
          // Put the log back, and take back exactly what was paid since, keeping the guild's clock where it is now.
          const cur = dataRef.current;
          let guild = cur.guild;
          if (guild) {
            const had = new Set(u.before.guild?.ledger ?? []);
            for (const e of (u.after.guild?.ledger ?? []).filter((x) => !had.has(x)).reverse()) guild = G.refund(guild, e.key);
          }
          commit({ ...u.before, guild });
          undoRef.current = null;
          setUi({ levelUp: null });
          showToast('Undone', 'Rewards put back as they were');
        } else setToast(null);
      },

      // Campaigns
      createCampaign(c: Campaign) {
        const key = 'c' + Date.now();
        commit({ ...d(), camps: { ...d().camps, [key]: c } });
        setUi({ campaign: key, questView: 'campaign', campSheet: null });
        showToast('Campaign begun', c.name);
      },
      updateCampaign(key: string, patch: Partial<Campaign>) {
        const c = d().camps[key];
        if (c) commit({ ...d(), camps: { ...d().camps, [key]: { ...c, ...patch } } });
      },
      deleteCampaign(key: string) { commit(deleteCampaign(d(), key)); setUi({ campSheet: null, campaign: '' }); },

      // Habits
      toggleHabit(id: number) { apply(toggleHabit(d(), id, today)); },
      createHabit(h: Pick<Habit, 'title' | 'every' | 'size' | 'target'>) {
        const cur = d();
        commit({ ...cur, habits: [...cur.habits, { id: nextId(cur.habits), log: [], created: today, ...h }] });
        showToast('Habit started', h.title);
      },
      updateHabit(id: number, patch: Partial<Habit>) { commit({ ...d(), habits: d().habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) }); },
      deleteHabit(id: number) { commit({ ...d(), habits: d().habits.filter((h) => h.id !== id) }); },

      /** Copies a quest (steps unticked, back to To Do) and opens the copy for editing. */
      duplicateQuest(id: number) {
        const cur = d(), q = cur.quests.find((x) => x.id === id);
        if (!q) return;
        const nid = nextId(cur.quests);
        const copy: Quest = {
          ...q, id: nid, title: q.title + ' (copy)', status: 'todo', doneOn: null, prevStatus: null,
          steps: q.steps.map((st, i) => ({ ...st, id: Date.now() + i, done: false })), notes: q.notes.map((n, i) => ({ ...n, id: Date.now() + 100 + i })),
        };
        apply(settleCampaigns({ ...cur, quests: [...cur.quests, copy] }, today));
        setUi({ openId: nid, sheetMode: 'edit' });
        showToast('Quest duplicated', copy.title);
      },

      // Calendar
      createEvent(e: Omit<CalEvent, 'id'>) {
        const cur = d(), id = nextId(cur.events);
        commit({ ...cur, events: [...cur.events, { ...e, id }] });
        setUi({ eventSheet: null, calDay: e.start });
        showToast('Event added', e.title);
      },
      updateEvent(id: number, patch: Partial<CalEvent>) {
        if (id < 0) { void actions.editGoogleEvent(id, patch); return; }
        commit({ ...d(), events: d().events.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
      },
      deleteEvent(id: number) {
        if (id < 0) { void actions.deleteGoogleEvent(id); return; }
        commit({ ...d(), events: d().events.filter((e) => e.id !== id) });
        setUi({ eventSheet: null });
      },
      /** Edits an event that lives only in Google Calendar: straight to Google, then into the cache. */
      async editGoogleEvent(id: number, patch: Partial<CalEvent>) {
        const found = Object.entries(gcacheRef.current).flatMap(([c, l]) => l.map((e) => [c, e] as const)).find(([, e]) => e.id === id);
        if (!found) return;
        const [calId, old] = found;
        try {
          const tok = await getToken(CALENDAR_SCOPE);
          const next = { ...old, ...patch, g: old.g };
          const res = await gPatch(tok, calId, old.g!.id, toGoogle(next, timeZone()));
          const updated = res ? (fromGoogle(res, calId) ?? next) : next;
          const cache = { ...gcacheRef.current, [calId]: (gcacheRef.current[calId] ?? []).map((e) => (e.id === id ? { ...updated, companions: next.companions } : e)) };
          setG(gcfgRef.current, cache);
          setUi({ eventMode: 'view' });
        } catch (e) { showToast('Google Calendar', e instanceof Error ? e.message : 'Could not save.'); }
      },
      async deleteGoogleEvent(id: number) {
        const found = Object.entries(gcacheRef.current).flatMap(([c, l]) => l.map((e) => [c, e] as const)).find(([, e]) => e.id === id);
        if (!found) return;
        try {
          const tok = await getToken(CALENDAR_SCOPE);
          await gRemove(tok, found[0], found[1].g!.id);
          setG(gcfgRef.current, { ...gcacheRef.current, [found[0]]: gcacheRef.current[found[0]].filter((e) => e.id !== id) });
          setUi({ eventSheet: null });
        } catch (e) { showToast('Google Calendar', e instanceof Error ? e.message : 'Could not delete.'); }
      },
      /** Switches Google Calendar sync on (a sign-in, so from a tap) or off. */
      async setCalendarSync(on: boolean) {
        if (!on) { setG({ ...gcfgRef.current, on: false }); setGstate({ status: 'off' }); return; }
        setG({ ...gcfgRef.current, on: true });
        await runGcal(true);
      },
      setCalendars(patch: Partial<Pick<GCalConfig, 'shown' | 'target'>>) {
        const cfg = { ...gcfgRef.current, ...patch };
        // A calendar that is no longer shown forgets its sync position, so showing it again fetches fresh.
        for (const c of cfg.calendars) if (!cfg.shown.includes(c.id)) { delete cfg.tokens[c.id]; delete cfg.full[c.id]; }
        setG(cfg, Object.fromEntries(Object.entries(gcacheRef.current).filter(([c]) => cfg.shown.includes(c))));
        void runGcal(false);
      },
      calendarSyncNow() { return runGcal(true); },
      /** Adds imported events, skipping any whose .ics UID is already in the calendar. Returns how many were added. */
      importEvents(list: Omit<CalEvent, 'id'>[]): number {
        const cur = d(), known = new Set(cur.events.map((e) => e.uid).filter(Boolean));
        let id = nextId(cur.events);
        const fresh = list.filter((e) => !e.uid || !known.has(e.uid)).map((e) => ({ ...e, id: id++ }));
        commit({ ...cur, events: [...cur.events, ...fresh] });
        return fresh.length;
      },
      /** Ends the "Plan your day" card for today and picks the chosen quests; yesterday's picks that weren't chosen expire. */
      planDay(ids: number[]) {
        const cur = d();
        commit({
          ...cur,
          quests: cur.quests.map((q) => (ids.includes(q.id) ? { ...q, pick: today } : q.pick && q.pick < today ? { ...q, pick: undefined } : q)),
          profile: { ...cur.profile, plannedDay: today },
        });
      },
      markReviewed(monday: string) { const cur = d(); commit({ ...cur, profile: { ...cur.profile, reviewedWeek: monday } }); setUi({ reviewOpen: false }); },

      // Guild
      found(f: G.Founding, championId: string) {
        const g = G.found(f, Date.now());
        const c = G.setChampion(g, championId);
        commit({ ...dataRef.current, guild: c.ok ? c.guild : g });
        setUi({ tab: 'guild', guildTab: 'board' });
      },
      hire(id: string) { guildDo((g) => G.hire(g, id), (g) => showToast('Welcome to the guild', g.adventurers.at(-1)!.first + ' signs the roster')); },
      release(id: string) { guildDo((g) => G.release(g, id), () => setUi({ advSheet: null })); },
      setChampion(id: string) {
        let levels = 0;
        guildDo((g) => { const r = G.setChampion(g, id); if (r.ok) levels = r.levels ?? 0; return r; }, (g) => {
          const a = G.byId(g, id)!;
          showToast(a.first + ' is your Champion', 'Real-life XP and practice go to them now');
          if (levels) setUi({ levelUp: { name: a.first, level: a.level } });
        });
      },
      setDuty(id: string, duty: Duty) { const cur = d(); if (cur.guild) commit({ ...cur, guild: G.setDuty(cur.guild, id, duty) }); },
      postNotice(cls: ClassId) { guildDo((g) => G.postNotice(g, cls), () => showToast('Notice posted', 'Someone will answer it at the next tavern day')); },
      send(offerId: string, party: string[], stance: Stance) {
        return guildDo((g) => G.send(g, offerId, party, stance), () => { setUi({ offerSheet: null }); showToast('They set out', 'Check the Roster to follow them'); });
      },
      // Town
      build(type: BuildingId) { guildDo((g) => G.build(g, type), () => { setUi({ buildSheet: null }); showToast('Work begins', 'A crew has started on it'); }); },
      upgrade(id: string) { guildDo((g) => G.upgrade(g, id), () => showToast('Work begins', 'A crew has started on it')); },
      demolish(id: string) { guildDo((g) => G.demolish(g, id), () => setUi({ buildSheet: null })); },
      assignStaff(advId: string, buildingId: string | null) { guildDo((g) => G.assignStaff(g, advId, buildingId)); },
      sell(s: G.Sale) { guildDo((g) => G.sell(g, s), () => showToast('Sold', 'The Merchant House paid in gold')); },
      buyMarket(id: string) { guildDo((g) => G.buyMarket(g, id), () => showToast('Bought', 'It is on the racks')); },
      forge(slot: Slot, grade: number) { guildDo((g) => G.forge(g, slot, grade), () => showToast('Forged', 'It is on the racks')); },
      reforge(id: string) { guildDo((g) => G.reforge(g, id), () => showToast('Reforged', 'As good as new')); },
      salvage(id: string) { guildDo((g) => G.salvage(g, id)); },
      lockItem(id: string) { const cur = d(); if (cur.guild) commit({ ...cur, guild: G.lockItem(cur.guild, id) }); },
      brew(kind: PotionKind) { guildDo((g) => G.brew(g, kind), () => showToast('Brewed', 'It is on the shelf')); },
      equip(advId: string, itemId: string) { guildDo((g) => G.equip(g, advId, itemId)); },
      unequip(advId: string, slot: Slot) { guildDo((g) => G.unequip(g, advId, slot)); },
      setAutoBuy(id: string, on: boolean) { const cur = d(); if (cur.guild) commit({ ...cur, guild: G.setAutoBuy(cur.guild, id, on) }); },
      holiday(on: boolean) {
        const cur = d();
        if (!cur.guild) return;
        commit({ ...cur, guild: G.setHoliday(cur.guild, on, Date.now()) });
        showToast(on ? 'On holiday' : 'Welcome back', on ? 'The guild’s clock is stopped' : 'The guild’s clock is running again');
      },
      markRead(id: string) { const cur = d(); if (cur.guild) { const g = G.markRead(cur.guild, id); if (g !== cur.guild) commit({ ...cur, guild: g }); } },
      /** Testing aid (?dev): moves the guild's clock forward. */
      skip(ms: number) {
        const cur = d();
        if (!cur.guild) return;
        commit({ ...cur, guild: G.skipTime(cur.guild, ms) });
        setUi({ profileOpen: false });
        tick(true);
      },

      // Sync
      /** Turns automatic Drive sync on (with a sign-in, so call it from a tap) or off. */
      async setAutoSync(on: boolean) {
        setAutoSyncFlag(on);
        if (!on) { setSync((s) => ({ ...s, status: 'off' })); return; }
        setSync((s) => ({ ...s, status: 'paused' }));
        await runSync(true);
      },
      /** Renews the sign-in (a tap) and syncs. */
      syncNow() { return runSync(true); },

      // Backup
      replaceData(next: Data) { commitRaw(next); setUi({ openId: null, gDetail: null, campaign: '', profileOpen: false }); },

      /** Generic edit for Glossary data that never pays out. */
      update(fn: (d: Data) => Data) { commit(fn(d())); },
      confirm(c: Confirm) { setUi({ confirm: c }); },

      // Navigation
      goTab(tab: Tab) {
        setUi({ tab, mobileZone: null, gDetail: null, openId: null });
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      },
      goGlossary(detail: string) {
        setUi({ tab: 'glossary', gDetail: detail, gSearch: '', openId: null });
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      },
      openQuest(id: number) { setUi({ openId: id, newOpen: false, campSheet: null, eventSheet: null, sheetMode: 'view' }); },
      openEvent(id: number | 'new') { setUi({ eventSheet: id, eventMode: id === 'new' ? 'edit' : 'view', openId: null, newOpen: false }); },
    };
  }, [today, commit, commitRaw, apply, showToast, setUi, tick, runSync, runGcal, setG]);

  const canUndo = !!toast?.undo && !!undoRef.current && sameLog(data, undoRef.current.after);
  return { today, data, ui, setUi, toast, lastToast, canUndo, isDesk, scrollRef, showToast, actions, sync, cal, gcfg, gstate };
}

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
