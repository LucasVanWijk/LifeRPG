// Words for the guild: chronicle lines and expedition reports, written when shown (saves keep only ids and numbers).
import type { IconName } from '../../components/Icon';
import type { StageKind } from './content';
import type { BuildingId, RegionId } from './content';
import { BUILDINGS, CLASSES, hallRank, PHASES_PER_YEAR, REGIONS } from './content';
import { fullName } from './adventurer';
import { byId } from './engine';
import { hash } from './rng';
import type { Entry, Guild, Outing } from './types';

const nameOf = (g: Guild, id: string | undefined) => { const a = byId(g, id); return a ? fullName(a) : 'Someone'; };
const firstOf = (g: Guild, id: string | undefined) => byId(g, id)?.first ?? 'Someone';

/** "Bram", "Bram and Clover", "Bram, Clover and Gorm". */
export function names(list: string[]) {
  if (list.length <= 1) return list[0] ?? '';
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}
export const partyNames = (g: Guild, o: Outing) => names(o.party.map((id) => firstOf(g, id)));

export type EntryView = { text: string; icon: IconName; tone: 'good' | 'bad' | 'plain' };

export function entryText(g: Guild, e: Entry): EntryView {
  const who = nameOf(g, e.a);
  const o = e.o ? g.outings.find((x) => x.id === e.o) : undefined;
  const b = e.t ? BUILDINGS[e.t as BuildingId]?.name : undefined;
  switch (e.k) {
    case 'found': return { text: e.t + ' was founded in ' + g.town + '.', icon: 'flag', tone: 'good' };
    case 'hire': return { text: who + ' joined the guild' + (e.v ? ' for ' + e.v + 'g' : '') + '.', icon: 'users', tone: 'plain' };
    case 'leave': return { text: who + ' left the guild.', icon: 'users', tone: 'plain' };
    case 'back': return { text: (o ? partyNames(g, o) + ' came back from ' + o.offer.name : 'A party came back') + (e.v ? ' with ' + e.v + ' gold' : '') + '.', icon: 'compass', tone: 'plain' };
    case 'fell': return { text: who + ' fell' + (o ? ' at ' + o.offer.name : '') + (e.v ? '. The guild was paid ' + e.v + 'g insurance' : '') + '.', icon: 'skull', tone: 'bad' };
    case 'hurt': return { text: who + ' came back with ' + e.t + ' (' + e.v + (e.v === 1 ? ' day' : ' days') + ').', icon: 'heart', tone: 'bad' };
    case 'scar': return { text: who + ' will carry it for good: ' + (e.t ?? '').toLowerCase() + '.', icon: 'alert', tone: 'bad' };
    case 'retire': {
      const a = byId(g, e.a);
      const years = a && a.endedPhase !== undefined ? Math.round((a.endedPhase - a.joinedPhase) / PHASES_PER_YEAR) : 0;
      return { text: who + ' retired after ' + years + (years === 1 ? ' year' : ' years') + (e.v ? ', leaving ' + e.v + 'g to the guild' : '') + '.', icon: 'home', tone: 'good' };
    }
    case 'level': return { text: who + ' reached level ' + e.v + '.', icon: 'star', tone: 'good' };
    case 'champion': return { text: who + ' became Champion.', icon: 'crown', tone: 'good' };
    case 'notice': return { text: 'A notice went up at the tavern for a ' + (CLASSES[e.t as keyof typeof CLASSES]?.name ?? 'recruit') + '.', icon: 'scroll', tone: 'plain' };
    case 'year': return { text: 'Year ' + e.v + ' began.', icon: 'sun', tone: 'plain' };
    case 'season': return { text: ['Spring', 'Summer', 'Autumn', 'Winter'][e.v ?? 0] + ' came to ' + g.town + '.', icon: 'sun', tone: 'plain' };
    case 'built': return { text: 'A ' + (b ?? 'building') + ' was finished.', icon: 'hammer', tone: 'good' };
    case 'upgraded': return { text: 'The ' + (b ?? 'building') + ' reached level ' + e.v + '.', icon: 'hammer', tone: 'good' };
    case 'hall': return { text: 'The Guild Hall reached level ' + e.v + ' (' + hallRank(e.v ?? 1) + ' rank).', icon: 'crown', tone: 'good' };
    case 'demolish': return { text: 'The ' + (b ?? 'building') + ' was pulled down.', icon: 'hammer', tone: 'plain' };
    case 'broke': return { text: who + '’s ' + e.t + ' broke and was melted down.', icon: 'alert', tone: 'plain' };
    case 'forged': return { text: 'The Blacksmith forged ' + e.t + '.', icon: 'hammer', tone: 'plain' };
    case 'pair': return { text: who + ' and ' + nameOf(g, e.b) + ' became a couple.', icon: 'heart', tone: 'good' };
    case 'birth': return { text: nameOf(g, e.a) + ' was born to ' + nameOf(g, e.b) + '.', icon: 'cake', tone: 'good' };
    case 'adult': return { text: who + ' came of age and walked into the tavern.', icon: 'users', tone: 'good' };
    case 'pass': return { text: who + ' passed away peacefully.', icon: 'feather', tone: 'plain' };
    case 'kin': return { text: 'A relative of ' + who + ' turned up at the tavern: ' + nameOf(g, e.b) + '.', icon: 'users', tone: 'good' };
    case 'era': return { text: 'An era ended. They will call it the Age of ' + who + '.', icon: 'trophy', tone: 'good' };
    case 'liberated': return { text: (REGIONS[e.t as RegionId]?.name ?? 'A region') + ' was freed. The guild gained an outpost.', icon: 'flag', tone: 'good' };
    case 'monument': return { text: 'A monument to “' + e.t + '” was raised in the Garden of Valor.', icon: 'flag', tone: 'good' };
    case 'heirloom': return { text: e.a ? who + '’s ' + e.t + ' was kept as an heirloom.' : 'A new heirloom was forged: ' + e.t + '.', icon: 'star', tone: 'good' };
    case 'tomb': return { text: who + ' was brought home and laid to rest.', icon: 'skull', tone: 'good' };
    case 'legend': return { text: who + ' is remembered as a legend.', icon: 'trophy', tone: 'good' };
    case 'region': return { text: (REGIONS[e.t as RegionId]?.name ?? 'A region') + ' was charted.', icon: 'map', tone: 'good' };
  }
}

const LINES: Record<StageKind | 'odd', Record<'clear' | 'strain' | 'fail', string[]>> = {
  combat: {
    clear: ['{a} and {b} made short work of it.', '{a} struck first, and it was over quickly.', 'They fought well; nobody was touched.'],
    strain: ['It was close. {a} came out bloodied but standing.', 'They won, barely, with {a} limping.'],
    fail: ['They were driven back, and {a} took the worst of it.', 'It went badly. {a} was cut off from the others.'],
  },
  hazard: {
    clear: ['{a} found a safe way across.', 'They picked their way through without trouble.'],
    strain: ['They got through, scraped and bruised.', '{a} slipped, but the others caught them.'],
    fail: ['The ground gave way under {a}.', 'They lost half a day and most of their nerve.'],
  },
  trap: {
    clear: ['{a} spotted the trap and took it apart.', 'Nothing in here was going to catch {a}.'],
    strain: ['{a} sprang it, and it only grazed them.', 'They got the lock open, though not quietly.'],
    fail: ['The trap caught {a} full on.', 'The mechanism snapped shut on {a}.'],
  },
  endurance: {
    clear: ['They kept a good pace and arrived fresh.', '{a} kept spirits up the whole way.'],
    strain: ['It wore them down.', 'By the end even {a} had stopped talking.'],
    fail: ['Exhaustion set in; {a} could barely stand.', 'They were lost for hours, and it told.'],
  },
  boss: {
    clear: ['{a} landed the blow that ended it.', 'It fell, and the way to the chest was open.'],
    strain: ['They brought it down, at a cost.', '{a} and {b} wore it down together.'],
    fail: ['It was too strong for them.', '{a} was thrown across the room, and they ran.'],
  },
  rest: { clear: ['They rested, mended their gear and slept.', 'A quiet night by the fire.'], strain: [''], fail: [''] },
  odd: {
    clear: ['Done, and done well.', 'No trouble at all.'],
    strain: ['Done, though not neatly.', 'It took longer than it should have.'],
    fail: ['It didn’t go to plan.', 'They came back with nothing to show for it.'],
  },
};

/** The lines a stage reads as in the report. */
export function stageLines(g: Guild, o: Outing, i: number): string[] {
  const st = o.result.stages[i];
  const plan = o.offer.stages[i];
  const kind = o.offer.scale === 'odd' ? 'odd' : plan.kind;
  const pool = LINES[kind][st.outcome];
  const h = hash(o.id, i);
  // Who the line is about: anyone still with the party at this stage.
  const fallenBefore = new Set(o.result.stages.slice(0, i).map((s) => s.died).filter(Boolean));
  const here = o.party.filter((id) => !fallenBefore.has(id));
  const a = firstOf(g, here[h % here.length]);
  const b = firstOf(g, here[(h + 1) % here.length]);
  const lines = [pool[h % pool.length].replace('{a}', a).replace('{b}', here.length > 1 ? b : a)];
  if (st.saved) {
    const x = firstOf(g, st.saved.id);
    const healer = o.party.find((id) => byId(g, id) && (CLASSES[byId(g, id)!.cls].role === 'healer' || CLASSES[byId(g, id)!.cls].second === 'healer') && id !== st.died);
    lines.push(st.saved.by === 'healer' ? firstOf(g, healer) + ' kept ' + x + ' alive.' : st.saved.by === 'luck' ? x + ' should have died there, and somehow didn’t.' : st.saved.by === 'ward' ? x + '’s ward flared and took the blow.' : x + ' was struck down, but pulled through.');
  }
  if (st.died) lines.push(firstOf(g, st.died) + ' fell here.');
  const hurt = st.injured.filter((id) => id !== st.saved?.id);
  if (hurt.length) lines.push(names(hurt.map((id) => firstOf(g, id))) + (hurt.length === 1 ? ' was hurt.' : ' were hurt.'));
  return lines.filter(Boolean);
}
