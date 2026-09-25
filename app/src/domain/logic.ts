import { addDays, nextAnnual, parseDay } from './dates';
import type { Data, Every, Habit, Hero, Quest, Status } from './model';
import { habitReward, reward, streakText } from './model';

export interface Toast { text: string; sub: string }
/** The result of anything that pays out: new data, what to announce, and whether to show the level-up screen. */
export interface Outcome { data: Data; toasts: Toast[]; leveledUp: boolean }

const none = (data: Data): Outcome => ({ data, toasts: [], leveledUp: false });
const merge = (a: Outcome, b: Outcome): Outcome => ({ data: b.data, toasts: [...a.toasts, ...b.toasts], leveledUp: a.leveledUp || b.leveledUp });

export function gain(hero: Hero, xpGain: number, goldGain: number): { hero: Hero; leveledUp: boolean } {
  let { xp, level, next } = hero;
  xp += xpGain;
  let leveledUp = false;
  while (xp >= next) {
    xp -= next;
    level++;
    next += 100;
    leveledUp = true;
  }
  return { hero: { ...hero, xp, level, next, gold: hero.gold + goldGain }, leveledUp };
}

/** Takes a reward back. Levels are never lost; XP and gold stop at zero. */
export const lose = (hero: Hero, xp: number, gold: number): Hero =>
  ({ ...hero, xp: Math.max(0, hero.xp - xp), gold: Math.max(0, hero.gold - gold) });

export const patchQuest = (data: Data, id: number, patch: Partial<Quest>): Data => ({
  ...data,
  quests: data.quests.map((q) => (q.id === id ? { ...q, ...patch } : q)),
});

/**
 * Pays a campaign's reward the moment its last quest is done. A campaign finished today
 * that gets an open quest again (one reopened or added) gives the reward back; deleting
 * its quests doesn't, and one finished on an earlier day keeps its seal.
 */
export function settleCampaigns(data: Data, today: string): Outcome {
  let out = none(data);
  for (const [key, c] of Object.entries(data.camps)) {
    const qs = out.data.quests.filter((q) => q.campaign === key);
    const complete = qs.length > 0 && qs.every((q) => q.status === 'done');
    const d = out.data;
    if (complete && !c.completedOn) {
      const g = gain(d.hero, c.xp, c.gold);
      out = merge(out, {
        data: { ...d, hero: g.hero, camps: { ...d.camps, [key]: { ...c, completedOn: today } } },
        toasts: [{ text: 'Campaign complete · ' + c.name, sub: c.seal + ' · +' + c.xp + ' XP · +' + c.gold + ' gold' }],
        leveledUp: g.leveledUp,
      });
    } else if (c.completedOn === today && qs.some((q) => q.status !== 'done')) {
      out = merge(out, none({ ...d, hero: lose(d.hero, c.xp, c.gold), camps: { ...d.camps, [key]: { ...c, completedOn: null } } }));
    }
  }
  return out;
}

/** Pays out a quest and moves it to Done. Returns null when there is nothing to pay. */
export function completeQuest(data: Data, id: number, today: string): Outcome | null {
  const q = data.quests.find((x) => x.id === id);
  if (!q || q.status === 'done') return null;
  const r = reward(q);
  const g = gain(data.hero, r.xp, r.gold);
  const paid: Outcome = {
    data: { ...patchQuest(data, id, { status: 'done', doneOn: today, prevStatus: q.status }), hero: g.hero },
    toasts: [{ text: '+' + r.xp + ' XP · +' + r.gold + ' gold', sub: q.title }],
    leveledUp: g.leveledUp,
  };
  return merge(paid, settleCampaigns(paid.data, today));
}

/** Reopens a done quest and takes its reward back. */
export function undoQuest(data: Data, id: number, today: string): Outcome {
  const q = data.quests.find((x) => x.id === id);
  if (!q || q.status !== 'done') return none(data);
  const r = reward(q);
  const reopened = patchQuest(data, id, { status: q.prevStatus && q.prevStatus !== 'done' ? q.prevStatus : 'todo', doneOn: null });
  return settleCampaigns({ ...reopened, hero: lose(data.hero, r.xp, r.gold) }, today);
}

/** Moving to Done pays out; moving out of Done takes the reward back first. */
export function setStatus(data: Data, id: number, status: Status, today: string): Outcome {
  const q = data.quests.find((x) => x.id === id);
  if (!q || q.status === status) return none(data);
  if (status === 'done') return completeQuest(data, id, today) ?? none(data);
  const base = q.status === 'done' ? undoQuest(data, id, today) : none(data);
  return merge(base, settleCampaigns(patchQuest(base.data, id, { status }), today));
}

export const deleteQuest = (data: Data, id: number, today: string) =>
  settleCampaigns({ ...data, quests: data.quests.filter((q) => q.id !== id) }, today);

/** Quests of a deleted campaign stay on the board without one. */
export function deleteCampaign(data: Data, key: string): Data {
  const camps = { ...data.camps };
  delete camps[key];
  return { ...data, camps, quests: data.quests.map((q) => (q.campaign === key ? { ...q, campaign: null } : q)) };
}

// ── Habits ──────────────────────────────────────────────────

/** The day that identifies a habit period: the day itself, or the Monday of its week. */
export function periodOf(day: string, every: Every): string {
  if (every === 'daily') return day;
  return addDays(day, -((parseDay(day).getDay() + 6) % 7));
}
const stepBack = (period: string, every: Every) => addDays(period, every === 'daily' ? -1 : -7);

export const habitDone = (h: Habit, today: string) => h.log.some((d) => periodOf(d, h.every) === periodOf(today, h.every));

/** Consecutive periods done, counting back from this period (or the last one, if this one is still open). */
export function habitStreak(h: Habit, today: string): number {
  const done = new Set(h.log.map((d) => periodOf(d, h.every)));
  let p = periodOf(today, h.every);
  if (!done.has(p)) p = stepBack(p, h.every);
  let n = 0;
  while (done.has(p)) { n++; p = stepBack(p, h.every); }
  return n;
}

export function bestStreak(h: Habit): number {
  const periods = [...new Set(h.log.map((d) => periodOf(d, h.every)))].sort();
  let best = 0, run = 0, prev = '';
  for (const p of periods) {
    run = prev && stepBack(p, h.every) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = p;
  }
  return best;
}

/** Checks a habit in for this period, or undoes this period's check-in. */
export function toggleHabit(data: Data, id: number, today: string): Outcome {
  const h = data.habits.find((x) => x.id === id);
  if (!h) return none(data);
  const r = habitReward(h);
  const setLog = (log: string[]) => data.habits.map((x) => (x.id === id ? { ...x, log } : x));
  if (habitDone(h, today)) {
    const cur = periodOf(today, h.every);
    return none({ ...data, hero: lose(data.hero, r.xp, r.gold), habits: setLog(h.log.filter((d) => periodOf(d, h.every) !== cur)) });
  }
  const g = gain(data.hero, r.xp, r.gold);
  const next = { ...h, log: [...h.log, today] };
  return {
    data: { ...data, hero: g.hero, habits: setLog(next.log) },
    toasts: [{ text: '+' + r.xp + ' XP · +' + r.gold + ' gold', sub: h.title + ' · ' + streakText(habitStreak(next, today), h.every) }],
    leveledUp: g.leveledUp,
  };
}

// ── Calendar ────────────────────────────────────────────────

export interface CalendarEvent { date: string; label: string; kind: 'Companion' | 'Codex'; target: string; who?: string }

/** Birthdays and dated Glossary notes that show on the Home week strip. */
export function glossaryEvents(data: Data, today: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const y = Number(today.slice(0, 4));
  for (const c of data.companions) {
    if (c.bday) for (const yr of [y - 1, y, y + 1]) out.push({ date: yr + '-' + c.bday, label: c.first + "'s birthday", kind: 'Companion', target: 'companion:' + c.id, who: c.first });
    for (const n of c.notes) if (n.date) out.push({ date: n.date, label: n.label || c.first + ': ' + n.t, kind: 'Companion', target: 'companion:' + c.id, who: c.first });
  }
  for (const x of data.codex)
    for (const f of x.fields) if (f.date) out.push({ date: f.date, label: f.label || x.name + ': ' + f.k, kind: 'Codex', target: 'codex:' + x.id });
  return out;
}

export const nextBirthday = (bday: string, today: string) => nextAnnual(bday, today);
