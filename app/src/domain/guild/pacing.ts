// A bot that plays the real engine for a year, the way a typical player might, to check how fast the Guild Hall rises.
import type { BuildingId, Role } from './content';
import { HALL_STEPS, PHASE_MS, PHASES_PER_DAY, tierLevels } from './content';
import { advance, build, found, hire, payReal, send, setChampion, upgrade, expeditionsOut } from './engine';
import { canGoOut, phaseAt, rating, role } from './adventurer';
import { bld, buildProblem, hallLevel, outLimit, rosterLimit, tierLimit } from './town';
import type { Guild, Offer } from './types';

export interface PlayStyle {
  /** Real quests a day, and habit check-ins. */
  quests: number;
  habits: number;
  /** Real hours between visits to the app. */
  visitEvery: number;
}
export const TYPICAL: PlayStyle = { quests: 5, habits: 3, visitEvery: 6 };

const AVG_QUEST = { xp: 45, gold: 15 };
const AVG_HABIT = { xp: 10, gold: 3 };

/** Production buildings in the order a player would raise them. */
const ECONOMY: BuildingId[] = ['forestry', 'quarry', 'warehouse', 'mine', 'lodge', 'tavern'];

function pickParty(g: Guild, offer: Offer): string[] | null {
  const p = phaseAt(g.t);
  const ready = g.adventurers.filter((a) => canGoOut(a, p) && a.state === 'active' && a.health >= 55 && a.fatigue <= 60).sort((a, b) => rating(b) - rating(a));
  const need = (r: Role) => ready.find((a) => role(a) === r);
  const party: typeof ready = [];
  for (const r of offer.needs) { const a = need(r); if (!a) return null; party.push(a); }
  for (const r of ['tank', 'healer'] as Role[]) if (offer.minParty >= 2 && !party.some((a) => role(a) === r)) { const a = need(r); if (a) party.push(a); }
  for (const a of ready) { if (party.length >= Math.min(offer.maxParty, Math.max(offer.minParty, 4))) break; if (!party.includes(a)) party.push(a); }
  return party.length >= offer.minParty ? party.map((a) => a.id) : null;
}

export interface PacingResult { hallDay: number[]; /** Share of the gold earned up to Hall 6 that came from real life. */ realShare: number; gold: number; renown: number; adventurers: number; fallen: number; buildings: number; end?: Guild }

/** `days` real days of play. `hallDay[n]` is the real day the Hall reached level n+2. */
export function simulate(days: number, style: PlayStyle = TYPICAL, seed = 3): PacingResult {
  let g = found({ name: 'Bot', town: 'Botton', charter: 'martial', crestSeed: 1, seed }, 0);
  g = (setChampion(g, g.adventurers[0].id) as { ok: true; guild: Guild }).guild;
  const hallDay: number[] = [];
  let key = 0, real = 0, outGold = 0, shareAt6 = -1;
  const counted = new Set<string>();
  const steps = Math.round((days * 24) / style.visitEvery);
  for (let step = 1; step <= steps; step++) {
    const now = step * style.visitEvery * PHASE_MS;
    g = advance(g, now).guild;
    for (const o of g.outings) if (o.done && !counted.has(o.id)) { counted.add(o.id); outGold += o.result.loot.gold; }
    // Real life, once a day on the first visit after noon.
    if (Math.floor(now / PHASE_MS) % 24 < style.visitEvery) {
      for (let i = 0; i < style.quests; i++) { const r = payReal(g, { key: 'q' + key++, ...AVG_QUEST, kind: 'quest', title: 'q', date: '', attr: 'wits', notable: false }); g = r.guild; real += r.entry.guild + r.entry.purse; }
      for (let i = 0; i < style.habits; i++) { const r = payReal(g, { key: 'h' + key++, ...AVG_HABIT, kind: 'habit', title: 'h', date: '', attr: 'main', notable: false }); g = r.guild; real += r.entry.guild + r.entry.purse; }
    }
    // Keep the roster full with the best affordable recruits.
    for (let n = 0; n < 3 && g.adventurers.filter((a) => a.state === 'active').length < rosterLimit(g); n++) {
      const cand = [...g.recruits].filter((r) => r.fee <= g.gold * 0.4).sort((a, b) => b.adv.talent * 3 + b.adv.level - (a.adv.talent * 3 + a.adv.level))[0];
      if (!cand) break;
      const r = hire(g, cand.adv.id);
      if (r.ok) g = r.guild;
    }
    // Send parties out on the best expedition they can handle.
    for (let n = 0; n < 4 && expeditionsOut(g) < outLimit(g); n++) {
      const ready = g.adventurers.filter((a) => a.state === 'active' && !a.awayOn);
      const top = ready.sort((a, b) => b.level - a.level).slice(0, 4);
      const lvl = top.length ? top.reduce((s, a) => s + a.level, 0) / top.length : 1;
      const wantMats = g.stock.wood < 300 || g.stock.stone < 300;
      const offers = g.board.filter((o) => o.scale === 'expedition' && !o.recover && o.tier <= tierLimit(g) && tierLevels(o.tier)[0] <= lvl + 2)
        .sort((a, b) => b.tier - a.tier || Number(wantMats && b.kind === 'materials') - Number(wantMats && a.kind === 'materials'));
      let sent = false;
      for (const o of offers) {
        const party = pickParty(g, o);
        if (!party) continue;
        const r = send(g, o.id, party, 'steady');
        if (r.ok) { g = r.guild; sent = true; break; }
      }
      if (!sent) break;
    }
    // Build: the Hall first, then the economy, and homes or farms when the town runs short.
    for (let n = 0; n < 3; n++) {
      const hall = bld(g, 'hall')!;
      const hp = buildProblem(g, 'hall');
      if (!hp) { const r = upgrade(g, hall.id); if (r.ok) { g = r.guild; continue; } }
      const next = HALL_STEPS[hallLevel(g) + 1];
      const saving = !!next && g.renown >= next.renown * 0.7;
      let did = false;
      // Fix a shortage the way a player would: raise the lowest Home or Farm, or add one, or a Watch House for order.
      const fix = (type: BuildingId) => {
        const mine = g.buildings.filter((b) => b.type === type).sort((a, b) => a.level - b.level);
        const low = mine.find((b) => !buildProblem(g, type, b));
        if (low) { const r = upgrade(g, low.id); if (r.ok) { g = r.guild; did = true; return; } }
        if (type === 'watch' && bld(g, 'watch')) return;
        if (!buildProblem(g, type)) { const r = build(g, type); if (r.ok) { g = r.guild; did = true; } }
      };
      const tryBuild = (type: BuildingId, existing = bld(g, type)) => {
        if (did) return;
        const problem = existing ? buildProblem(g, type, existing) : buildProblem(g, type);
        if (problem && /food/.test(problem)) { fix('farm'); return; }
        if (problem && /housing/.test(problem)) { fix('home'); return; }
        if (problem && /order/.test(problem)) { fix('watch'); return; }
        if (problem && /happiness/.test(problem)) { fix('chapel'); return; }
        if (problem) return;
        if (type !== 'warehouse' && saving && next && (g.stock.wood < next.wood * 1.1 || g.stock.stone < next.stone * 1.1)) return;
        const r = existing ? upgrade(g, existing.id) : build(g, type);
        if (r.ok) { g = r.guild; did = true; }
      };
      for (const type of ECONOMY) { tryBuild(type); if (did) break; }
      if (!did) break;
    }
    const h = hallLevel(g);
    if (h >= 6 && shareAt6 < 0) shareAt6 = real / Math.max(1, real + outGold);
    while (hallDay.length < h - 1) hallDay.push(Math.round(((step * style.visitEvery) / 24) * 10) / 10);
  }
  return { hallDay, realShare: shareAt6, gold: g.gold, renown: g.renown, adventurers: g.adventurers.filter((a) => a.state === 'active').length, fallen: g.adventurers.filter((a) => a.state === 'fallen').length, buildings: g.buildings.length, end: g };
}
void PHASES_PER_DAY;
