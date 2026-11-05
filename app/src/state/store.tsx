import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { todayISO } from '../domain/dates';
import type { LevelUp, Outcome, Toast } from '../domain/logic';
import { completeQuest, deleteCampaign, deleteQuest, patchQuest, setStatus, settleCampaigns, toggleHabit, undoQuest } from '../domain/logic';
import { migrate } from '../domain/migrate';
import type { CalEvent, Campaign, Data, Habit, QuadKey, Quest, Status } from '../domain/model';
import { emptyData, QM } from '../domain/model';
import type { BuildingId, ClassId, PotionKind, Slot, Stance } from '../domain/guild/content';
import { AWAY_SUMMARY_MS } from '../domain/guild/content';
import * as G from '../domain/guild/engine';
import type { Duty, Entry, Guild } from '../domain/guild/types';

// v1 held the design's sample data; v2 starts every log empty. The data inside carries its own version (see migrate.ts).
const STORAGE_KEY = 'questlog:v2';

export type Tab = 'home' | 'quests' | 'calendar' | 'glossary' | 'guild';
export type GuildTab = 'roster' | 'board' | 'town' | 'tavern' | 'legacy';
export type QuestView = 'board' | 'campaign' | 'habits';
export type GlossaryCat = 'companions' | 'tomes' | 'codex';
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
  /** The plot chosen on the map for a new building. */
  buildPlot: number | null;
  /** What happened while the app was closed. */
  away: Entry[] | null;
  confirm: Confirm | null;
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
  return {
    tab: pick('screen', ['home', 'quests', 'calendar', 'glossary', 'guild'] as const, 'home'),
    questView: pick('view', ['board', 'campaign', 'habits'] as const, 'board'),
    hiddenCamps: loadHiddenCamps(),
    campaign: p.get('campaign') || '',
    mobileZone: (p.get('zone') as QuadKey) in QM ? (p.get('zone') as QuadKey) : null,
    openId: quest > 0 ? quest : null,
    sheetMode: p.get('mode') === 'edit' ? 'edit' : 'view',
    newOpen: false,
    campSheet: null,
    profileOpen: false,
    chronicleOpen: false,
    reviewOpen: false,
    eventSheet: null,
    eventMode: 'view',
    calDay: today,
    gCat: pick('cat', ['companions', 'tomes', 'codex'] as const, 'companions'),
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
    buildPlot: null,
    away: null,
    confirm: null,
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

const nextId = (xs: { id: number }[]) => Math.max(0, ...xs.map((x) => x.id)) + 1;

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
  const commit = useCallback((d: Data) => { dataRef.current = d; setData(d); }, []);
  const apply = useCallback((o: Outcome | null) => {
    if (!o) return;
    const before = dataRef.current;
    commit(o.data);
    if (o.toasts.some((t) => t.undo)) undoRef.current = { before, after: o.data };
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
      updateEvent(id: number, patch: Partial<CalEvent>) { commit({ ...d(), events: d().events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }); },
      deleteEvent(id: number) { commit({ ...d(), events: d().events.filter((e) => e.id !== id) }); setUi({ eventSheet: null }); },
      /** Adds imported events, skipping any whose .ics UID is already in the calendar. Returns how many were added. */
      importEvents(list: Omit<CalEvent, 'id'>[]): number {
        const cur = d(), known = new Set(cur.events.map((e) => e.uid).filter(Boolean));
        let id = nextId(cur.events);
        const fresh = list.filter((e) => !e.uid || !known.has(e.uid)).map((e) => ({ ...e, id: id++ }));
        commit({ ...cur, events: [...cur.events, ...fresh] });
        return fresh.length;
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
      build(type: BuildingId, plot?: number) { guildDo((g) => G.build(g, type, plot), () => { setUi({ buildSheet: null, buildPlot: null }); showToast('Work begins', 'A crew has started on it'); }); },
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

      // Backup
      replaceData(next: Data) { commit(next); setUi({ openId: null, gDetail: null, campaign: '', profileOpen: false }); },

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
  }, [today, commit, apply, showToast, setUi, tick]);

  const canUndo = !!toast?.undo && !!undoRef.current && sameLog(data, undoRef.current.after);
  return { today, data, ui, setUi, toast, lastToast, canUndo, isDesk, scrollRef, showToast, actions };
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
