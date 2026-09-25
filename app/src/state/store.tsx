import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { todayISO } from '../domain/dates';
import { completeQuest, patchQuest, setStatus, undoQuest } from '../domain/logic';
import type { Campaign, Data, QuadKey, Quest, Status } from '../domain/model';
import { QM } from '../domain/model';
import { seedData } from '../domain/seed';

const STORAGE_KEY = 'questlog:v1';

export type Tab = 'home' | 'quests' | 'glossary' | 'adventure';
export type QuestView = 'board' | 'campaign';
export type GlossaryCat = 'companions' | 'tomes' | 'codex';

export interface Ui {
  tab: Tab;
  questView: QuestView;
  campaign: string;
  mobileZone: QuadKey | null;
  openId: number | null;
  sheetMode: 'view' | 'edit';
  newOpen: boolean;
  newCampOpen: boolean;
  gCat: GlossaryCat;
  gSearch: string;
  gDetail: string | null;
  openTome: string | null;
  weekOffset: number;
  selDay: string;
  buyId: number | null;
  levelUp: boolean;
  dragId: number | null;
  dragOver: string | null;
}

export interface Toast { text: string; sub: string }

function loadData(today: string): Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Data;
      if (d && d.version === 1 && Array.isArray(d.quests)) return d;
    }
  } catch {
    /* storage unavailable or corrupt: fall back to the sample log */
  }
  return seedData(today);
}

/** Initial screen can be deep-linked, e.g. ?screen=quests&zone=main or ?quest=4&mode=edit. */
function initialUi(today: string): Ui {
  const p = new URLSearchParams(window.location.search);
  const pick = <T extends string>(k: string, allowed: readonly T[], def: T): T => (allowed.includes(p.get(k) as T) ? (p.get(k) as T) : def);
  const quest = Number(p.get('quest'));
  return {
    tab: pick('screen', ['home', 'quests', 'glossary', 'adventure'] as const, 'home'),
    questView: pick('view', ['board', 'campaign'] as const, 'board'),
    campaign: p.get('campaign') || 'ireland',
    mobileZone: (p.get('zone') as QuadKey) in QM ? (p.get('zone') as QuadKey) : null,
    openId: quest > 0 ? quest : null,
    sheetMode: p.get('mode') === 'edit' ? 'edit' : 'view',
    newOpen: false,
    newCampOpen: false,
    gCat: pick('cat', ['companions', 'tomes', 'codex'] as const, 'companions'),
    gSearch: '',
    gDetail: p.get('detail'),
    openTome: 'shows',
    weekOffset: 0,
    selDay: today,
    buyId: null,
    levelUp: false,
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

function useStoreValue() {
  const [today, setToday] = useState(todayISO);
  const [data, setData] = useState<Data>(() => loadData(today));
  const [ui, setUiState] = useState<Ui>(() => initialUi(today));
  const [toast, setToast] = useState<Toast | null>(null);
  const [lastToast, setLastToast] = useState<Toast>({ text: '', sub: '' });
  const toastTimer = useRef<number | undefined>(undefined);
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

  const showToast = useCallback((text: string, sub: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, sub });
    setLastToast({ text, sub });
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Reads the latest data synchronously so completion side effects (toast, level-up) fire once.
  const dataRef = useRef(data);
  dataRef.current = data;
  const commit = useCallback((d: Data) => { dataRef.current = d; setData(d); }, []);

  const announce = useCallback((c: ReturnType<typeof completeQuest>) => {
    if (!c) return;
    showToast('+' + c.xp + ' XP · +' + c.gold + ' gold', c.toastSub);
    if (c.leveledUp) setUi({ levelUp: true });
  }, [showToast, setUi]);

  const actions = useMemo(() => ({
    complete(id: number) {
      const c = completeQuest(dataRef.current, id, today);
      if (c) { commit(c.data); announce(c); }
    },
    undo(id: number) { commit(undoQuest(dataRef.current, id, today)); },
    toggleToday(id: number) {
      const q = dataRef.current.quests.find((x) => x.id === id);
      if (!q) return;
      if (q.doneOn === today || q.lastDone === today) { commit(undoQuest(dataRef.current, id, today)); return; }
      const c = completeQuest(dataRef.current, id, today);
      if (c) { commit(c.data); announce(c); }
    },
    setStatus(id: number, s: Status) {
      const r = setStatus(dataRef.current, id, s, today);
      commit(r.data);
      announce(r.completion);
    },
    updateQuest(id: number, patch: Partial<Quest>) { commit(patchQuest(dataRef.current, id, patch)); },
    createQuest(q: Pick<Quest, 'title' | 'quad' | 'due' | 'campaign'>) {
      const d = dataRef.current;
      const id = Math.max(0, ...d.quests.map((x) => x.id)) + 1;
      commit({ ...d, quests: [...d.quests, { id, size: 'M', status: 'todo', recur: null, notes: [], ...q }] });
      showToast('Quest pinned', 'Added to ' + QM[q.quad].name);
    },
    createCampaign(c: Campaign) {
      const d = dataRef.current, key = 'c' + Date.now();
      commit({ ...d, camps: { ...d.camps, [key]: c } });
      setUi({ campaign: key, questView: 'campaign', newCampOpen: false });
      showToast('Campaign begun', c.name);
    },
    update(fn: (d: Data) => Data) { commit(fn(dataRef.current)); },
    buy(id: number) {
      const d = dataRef.current, r = d.rewards.find((x) => x.id === id);
      if (!r || r.price > d.hero.gold) return;
      commit({ ...d, hero: { ...d.hero, gold: d.hero.gold - r.price } });
      setUi({ buyId: null });
      showToast('Enjoy: ' + r.title, '−' + r.price + ' gold');
    },
    addReward(title: string, price: number) {
      const d = dataRef.current;
      commit({ ...d, rewards: [...d.rewards, { id: Date.now(), title, price }] });
      showToast('Added to the Tavern', title + ' · ' + price + ' gold');
    },
    goTab(tab: Tab) {
      setUi({ tab, mobileZone: null, gDetail: null, openId: null });
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    },
    goGlossary(detail: string) {
      setUi({ tab: 'glossary', gDetail: detail, gSearch: '', openId: null });
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    },
    openQuest(id: number) { setUi({ openId: id, newOpen: false, newCampOpen: false, sheetMode: 'view' }); },
    resetSample() { commit(seedData(today)); },
  }), [today, commit, announce, showToast, setUi]);

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
