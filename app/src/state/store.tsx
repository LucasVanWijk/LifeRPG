import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { todayISO } from '../domain/dates';
import type { Outcome, Toast } from '../domain/logic';
import { completeQuest, deleteCampaign, deleteQuest, patchQuest, setStatus, settleCampaigns, toggleHabit, undoQuest } from '../domain/logic';
import { migrate } from '../domain/migrate';
import type { CalEvent, Campaign, Data, Habit, Hero, QuadKey, Quest, Status } from '../domain/model';
import type { Skill } from '../domain/expedition/content';
import { ITEMS, SHOP, SKILL_NAME } from '../domain/expedition/content';
import type { Activity, Summary } from '../domain/expedition/engine';
import * as X from '../domain/expedition/engine';
import { emptyData, QM } from '../domain/model';

// v1 held the design's sample data; v2 starts every log empty. The data inside carries its own version (see migrate.ts).
const STORAGE_KEY = 'questlog:v2';

export type Tab = 'home' | 'quests' | 'calendar' | 'glossary' | 'adventure';
export type QuestView = 'board' | 'campaign' | 'habits';
export type GlossaryCat = 'companions' | 'tomes' | 'codex';
export type { Toast };

/** tone 'go' shows the confirm button as a normal action instead of a destructive one. */
export interface Confirm { title: string; body: string; confirmLabel: string; cancelLabel?: string; tone?: 'danger' | 'go'; onConfirm: () => void }

export interface Ui {
  tab: Tab;
  questView: QuestView;
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
  levelUp: boolean;
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

/** Initial screen can be deep-linked, e.g. ?screen=quests&zone=main or ?quest=4&mode=edit. */
function initialUi(today: string): Ui {
  const p = new URLSearchParams(window.location.search);
  const pick = <T extends string>(k: string, allowed: readonly T[], def: T): T => (allowed.includes(p.get(k) as T) ? (p.get(k) as T) : def);
  const quest = Number(p.get('quest'));
  return {
    tab: pick('screen', ['home', 'quests', 'calendar', 'glossary', 'adventure'] as const, 'home'),
    questView: pick('view', ['board', 'campaign', 'habits'] as const, 'board'),
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
    levelUp: false,
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

/** Undo is still safe while the quest log and rewards are unchanged; Expeditions ticking alongside doesn't count. */
const sameLog = (a: Data, b: Data) =>
  a.quests === b.quests && a.habits === b.habits && a.camps === b.camps && a.hero.xp === b.hero.xp && a.hero.gold === b.hero.gold && a.hero.level === b.hero.level;

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

  // Saving is throttled (Expeditions changes data every second) and flushed when the app is hidden or closed.
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
    if (o.leveledUp) setUi({ levelUp: true });
  }, [commit, showToasts, setUi]);

  const actions = useMemo(() => {
    const d = () => dataRef.current;
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
        apply('campaign' in patch ? settleCampaigns(next, today) : { data: next, toasts: [], leveledUp: false });
      },
      createQuest(q: Omit<Quest, 'id'>) {
        const cur = d();
        apply(settleCampaigns({ ...cur, quests: [...cur.quests, { ...q, id: nextId(cur.quests) }] }, today));
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
          // Put the log back, but keep Expeditions as it is now and take the undone XP out of the skill-point pool.
          const cur = dataRef.current;
          const points = Math.max(0, cur.hero.points - (u.after.hero.points - u.before.hero.points));
          commit({ ...u.before, expedition: cur.expedition, hero: { ...u.before.hero, points } });
          undoRef.current = null;
          setUi({ levelUp: false });
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
      markReviewed(monday: string) { commit({ ...d(), hero: { ...d().hero, reviewedWeek: monday } }); setUi({ reviewOpen: false }); },

      // Expeditions
      /** Plays out the time since the last tick; the screen calls this every second while open. */
      expAdvance(now = Date.now()): Summary {
        const r = X.advance(d().expedition, now);
        commit({ ...d(), expedition: r.exp });
        return r.summary;
      },
      expStart(kind: Activity['kind'], id: string) {
        const now = Date.now();
        const r = X.start(X.advance(d().expedition, now).exp, kind, id, now);
        if (!r.ok) { showToast("Can't start", r.reason); return; }
        commit({ ...d(), expedition: r.exp });
      },
      expStop() { const now = Date.now(); commit({ ...d(), expedition: X.stop(X.advance(d().expedition, now).exp, now) }); },
      expBuy(shopId: string) {
        const cur = d(), r = X.buy(cur.expedition, cur.hero.gold, shopId);
        if (!r.ok) { showToast("Can't buy that", r.reason); return; }
        commit({ ...cur, expedition: r.exp, hero: { ...cur.hero, gold: r.gold } });
        showToast('Bought ' + SHOP.find((x) => x.id === shopId)!.name, '−' + (cur.hero.gold - r.gold) + ' gold');
      },
      expEquip(item: string) { commit({ ...d(), expedition: X.equip(d().expedition, item) }); showToast('Equipped', ITEMS[item].name); },
      expTrain(skill: Skill) {
        const cur = d(), before = X.level(cur.expedition, skill);
        const r = X.train(cur.expedition, cur.hero.points, skill);
        if (!r.used) return;
        commit({ ...cur, expedition: r.exp, hero: { ...cur.hero, points: cur.hero.points - r.used } });
        const after = X.level(r.exp, skill);
        showToast(after > before ? SKILL_NAME[skill] + ' level ' + after : SKILL_NAME[skill] + ' trained', '−' + r.used + ' skill points');
      },

      // Profile and backup
      updateHero(patch: Partial<Hero>) { commit({ ...d(), hero: { ...d().hero, ...patch } }); },
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
  }, [today, commit, apply, showToast, setUi]);

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
