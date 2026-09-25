import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { todayISO } from '../domain/dates';
import type { Outcome, Toast } from '../domain/logic';
import { completeQuest, deleteCampaign, deleteQuest, patchQuest, setStatus, settleCampaigns, toggleHabit, undoQuest } from '../domain/logic';
import { migrate } from '../domain/migrate';
import type { Campaign, Data, Habit, Hero, QuadKey, Quest, Reward, Status } from '../domain/model';
import { emptyData, QM } from '../domain/model';

// v1 held the design's sample data; v2 starts every log empty. The data inside carries its own version (see migrate.ts).
const STORAGE_KEY = 'questlog:v2';

export type Tab = 'home' | 'quests' | 'glossary' | 'adventure';
export type QuestView = 'board' | 'campaign' | 'habits';
export type GlossaryCat = 'companions' | 'tomes' | 'codex';
export type { Toast };

export interface Confirm { title: string; body: string; confirmLabel: string; onConfirm: () => void }

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
  gCat: GlossaryCat;
  gSearch: string;
  gDetail: string | null;
  openTome: string | null;
  weekOffset: number;
  selDay: string;
  buyId: number | null;
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
    tab: pick('screen', ['home', 'quests', 'glossary', 'adventure'] as const, 'home'),
    questView: pick('view', ['board', 'campaign', 'habits'] as const, 'board'),
    campaign: p.get('campaign') || '',
    mobileZone: (p.get('zone') as QuadKey) in QM ? (p.get('zone') as QuadKey) : null,
    openId: quest > 0 ? quest : null,
    sheetMode: p.get('mode') === 'edit' ? 'edit' : 'view',
    newOpen: false,
    campSheet: null,
    profileOpen: false,
    gCat: pick('cat', ['companions', 'tomes', 'codex'] as const, 'companions'),
    gSearch: '',
    gDetail: p.get('detail'),
    openTome: null,
    weekOffset: 0,
    selDay: today,
    buyId: null,
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

function useStoreValue() {
  const [today, setToday] = useState(todayISO);
  const [data, setData] = useState<Data>(loadData);
  const [ui, setUiState] = useState<Ui>(() => initialUi(today));
  const [toast, setToast] = useState<Toast | null>(null);
  const [lastToast, setLastToast] = useState<Toast>({ text: '', sub: '' });
  const toastTimer = useRef<number | undefined>(undefined);
  const toastQueue = useRef<Toast[]>([]);
  const isDesk = useLayout();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep "today" right when the app stays open overnight or is resumed from the background.
  useEffect(() => {
    const on = () => setToday(todayISO());
    document.addEventListener('visibilitychange', on);
    const t = window.setInterval(on, 60_000);
    return () => { document.removeEventListener('visibilitychange', on); window.clearInterval(t); };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota or private mode */ }
  }, [data]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const setUi = useCallback((patch: Partial<Ui> | ((u: Ui) => Partial<Ui>)) =>
    setUiState((u) => ({ ...u, ...(typeof patch === 'function' ? patch(u) : patch) })), []);

  // Toasts play one after another, so a quest's reward and its campaign's reward are both seen.
  const playNext = useCallback(() => {
    const t = toastQueue.current.shift();
    if (!t) { setToast(null); return; }
    setToast(t);
    setLastToast(t);
    toastTimer.current = window.setTimeout(playNext, 2600);
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
    commit(o.data);
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
        if (q) commit(patchQuest(d(), id, { steps: q.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)) }));
      },
      deleteQuest(id: number) { apply(deleteQuest(d(), id, today)); setUi({ openId: null }); },

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
      createHabit(h: Pick<Habit, 'title' | 'every' | 'size'>) {
        const cur = d();
        commit({ ...cur, habits: [...cur.habits, { id: nextId(cur.habits), log: [], created: today, ...h }] });
        showToast('Habit started', h.title);
      },
      updateHabit(id: number, patch: Partial<Habit>) { commit({ ...d(), habits: d().habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) }); },
      deleteHabit(id: number) { commit({ ...d(), habits: d().habits.filter((h) => h.id !== id) }); },

      // Tavern
      buy(id: number) {
        const cur = d(), r = cur.rewards.find((x) => x.id === id);
        if (!r || r.price > cur.hero.gold) return;
        commit({ ...cur, hero: { ...cur.hero, gold: cur.hero.gold - r.price } });
        setUi({ buyId: null });
        showToast('Enjoy: ' + r.title, '−' + r.price + ' gold');
      },
      addReward(title: string, price: number) {
        commit({ ...d(), rewards: [...d().rewards, { id: nextId(d().rewards), title, price }] });
        showToast('Added to the Tavern', title + ' · ' + price + ' gold');
      },
      updateReward(id: number, patch: Partial<Reward>) { commit({ ...d(), rewards: d().rewards.map((r) => (r.id === id ? { ...r, ...patch } : r)) }); },
      deleteReward(id: number) { commit({ ...d(), rewards: d().rewards.filter((r) => r.id !== id) }); },

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
      openQuest(id: number) { setUi({ openId: id, newOpen: false, campSheet: null, sheetMode: 'view' }); },
    };
  }, [today, commit, apply, showToast, setUi]);

  return { today, data, ui, setUi, toast, lastToast, isDesk, scrollRef, showToast, actions };
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
