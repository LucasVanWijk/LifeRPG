// Traits: 75 small quirks of character. Each changes some numbers and adds a line to the adventurer's backstory.
// Effects use a short vocabulary so the engine reads them all the same way (see `Fx`).
import type { ConditionId, RaceId } from './content';
import type { StageKind } from './content';
import type { Rng } from './rng';

/** What a trait can change. Rating bonuses are in rating points; the rest are fractions (0.1 = 10%). */
export interface Fx {
  /** Flat rating bonus on every check. */
  r?: number;
  /** Rating bonus on one kind of stage: combat, hazard, trap, endurance, boss. */
  c?: number; h?: number; t?: number; e?: number; b?: number;
  /** Change to death, injury and fatigue gain (negative is better), recovery speed at home, XP, expedition gold, and training XP. */
  d?: number; i?: number; f?: number; rec?: number; x?: number; g?: number; tr?: number;
  /** Rating bonus when the party is Bold or Cautious, for a party of one or two, and for each extra member (up to four). */
  bold?: number; caut?: number; solo?: number; team?: number;
  /** Rating bonus setting out in the evening or morning. */
  eve?: number; morn?: number;
  /** Conditions they counter on their own. */
  cnt?: ConditionId[];
}
export type TraitKind = 'good' | 'bad' | 'quirk';
export interface Trait { id: string; name: string; kind: TraitKind; group: string; text: string; fx: Fx; story: string }

const t = (id: string, name: string, kind: TraitKind, group: string, text: string, fx: Fx, story: string): Trait => ({ id, name, kind, group, text, fx, story });

export const TRAITS: Trait[] = [
  // Good
  t('brave', 'Brave', 'good', 'courage', '+1 in fights, +1 against bosses.', { c: 1, b: 1 }, 'never walked away from a fight'),
  t('steady', 'Steady', 'good', 'nerve', '10% less likely to die.', { d: -0.1 }, 'kept a cool head when everyone else panicked'),
  t('sharp', 'Sharp-eyed', 'good', 'sight', '+1 on traps and hazards.', { t: 1, h: 1 }, 'noticed what other people walked straight past'),
  t('tough', 'Tough', 'good', 'body', '12% less likely to be hurt.', { i: -0.12 }, 'grew up on hard bread and harder winters'),
  t('fortunate', 'Fortunate', 'good', 'luck', '+0.5 rating, 5% less likely to die.', { r: 0.5, d: -0.05 }, 'had a way of being just out of reach when things fell'),
  t('quick', 'Quick', 'good', 'body', '+1.5 on hazards.', { h: 1.5 }, 'was always the first one out of the room'),
  t('patient', 'Patient', 'good', 'mind', '+1 on endurance, +1 when Cautious.', { e: 1, caut: 1 }, 'could wait out anything, a siege or a sulk'),
  t('disciplined', 'Disciplined', 'good', 'mind', '+0.5 rating, 10% less tiring.', { r: 0.5, f: -0.1 }, 'kept to a daily routine like a vow'),
  t('cheerful', 'Cheerful', 'good', 'social', '15% less tiring, helps the party.', { f: -0.15, team: 0.2 }, 'sang when the road got long'),
  t('loyal', 'Loyal', 'good', 'social', '+0.3 for each other member in the party.', { team: 0.3 }, 'never left anyone behind, not once'),
  t('generous', 'Generous', 'good', 'social', 'Helps the party, takes 5% less gold.', { team: 0.25, g: -0.05 }, 'gave away half of everything they won'),
  t('clever', 'Clever', 'good', 'mind', '10% more XP.', { x: 0.1 }, 'learned from every mistake the first time'),
  t('strong', 'Strong', 'good', 'body', '+1 in fights, +0.5 on endurance.', { c: 1, e: 0.5 }, 'once carried a mill wheel for a bet'),
  t('hardy', 'Hardy', 'good', 'body', 'Recovers 25% faster at home.', { rec: 0.25 }, 'was up and about while others were still bleeding'),
  t('stalwart', 'Stalwart', 'good', 'courage', '+1.5 against bosses, 5% less likely to die.', { b: 1.5, d: -0.05 }, 'held the line long past reason'),
  t('devout', 'Devout', 'good', 'faith', 'Counters Undead.', { cnt: ['undead'] }, 'prayed before every door and meant it'),
  t('studious', 'Studious', 'good', 'mind', '12% more XP, trains 20% better.', { x: 0.12, tr: 0.2 }, 'read everything, even the labels on jars'),
  t('charming', 'Charming', 'good', 'greed', '8% more gold from expeditions.', { g: 0.08 }, 'talked every merchant into a better price'),
  t('resourceful', 'Resourceful', 'good', 'sight', '+0.7 on hazards, traps and endurance.', { h: 0.7, t: 0.7, e: 0.7 }, 'could mend a boot with a bootlace and a prayer'),
  t('careful', 'Careful', 'good', 'nerve', '+1.5 when Cautious, 8% less likely to be hurt.', { caut: 1.5, i: -0.08 }, 'checked everything twice and then once more'),
  t('tireless', 'Tireless', 'good', 'body', '25% less tiring.', { f: -0.25 }, 'never seemed to need sleep'),
  t('nimble', 'Nimble', 'good', 'body', '10% less likely to be hurt, +0.8 on hazards.', { i: -0.1, h: 0.8 }, 'ducked before the arrow was even loosed'),
  t('calm', 'Calm', 'good', 'nerve', '8% less likely to die, +0.5 on endurance.', { d: -0.08, e: 0.5 }, 'breathed slowly while the roof came down'),
  t('inspiring', 'Inspiring', 'good', 'social', '+0.4 for each other member in the party.', { team: 0.4 }, 'made strangers want to follow'),
  t('campaigner', 'Old Campaigner', 'good', 'veteran', '+0.7 rating, 5% less likely to die.', { r: 0.7, d: -0.05 }, 'had seen worse and said so'),
  t('trailwise', 'Trailwise', 'good', 'wild', 'Counters Open ground, +1 on endurance.', { cnt: ['open'], e: 1 }, 'knew every road from here to the coast'),
  t('forager', 'Forager', 'good', 'wild', '10% less tiring, recovers 10% faster.', { f: -0.1, rec: 0.1 }, 'found supper where there was none'),
  t('earlybird', 'Early Riser', 'good', 'time', '+1.2 setting out in the morning.', { morn: 1.2 }, 'was on the road before the sun'),
  // Bad
  t('reckless', 'Reckless', 'bad', 'courage', '+1.2 when Bold, 12% more likely to die.', { bold: 1.2, d: 0.12 }, 'never met a wall they did not try to climb'),
  t('greedy', 'Greedy', 'bad', 'greed', '6% more gold, 8% more likely to die.', { g: 0.06, d: 0.08 }, 'could not leave a coin on the floor'),
  t('lazy', 'Lazy', 'bad', 'body', 'Trains 30% worse, 10% more tiring.', { tr: -0.3, f: 0.1 }, 'always meant to do it tomorrow'),
  t('timid', 'Timid', 'bad', 'courage', '−1 in fights, +0.8 when Cautious.', { c: -1, caut: 0.8 }, 'flinched first, every time'),
  t('hothead', 'Hot-headed', 'bad', 'temper', '+0.8 in fights, 10% more likely to be hurt.', { c: 0.8, i: 0.1 }, 'fought first and asked questions afterwards'),
  t('clumsy', 'Clumsy', 'bad', 'body', '−1 on hazards and traps.', { h: -1, t: -1 }, 'tripped over their own shadow'),
  t('frail', 'Frail', 'bad', 'body', '15% more likely to be hurt, recovers 15% slower.', { i: 0.15, rec: -0.15 }, 'was a sickly child and never entirely stopped'),
  t('drinker', 'Fond of the Bottle', 'bad', 'vice', '−0.5 rating, 10% more tiring.', { r: -0.5, f: 0.1 }, 'knew the floor of every tavern between here and the sea'),
  t('arrogant', 'Arrogant', 'bad', 'social', '+0.3 rating, −0.4 for each other member.', { r: 0.3, team: -0.4 }, 'would not be told, not by anyone'),
  t('superstitious', 'Superstitious', 'bad', 'faith', '−1 setting out in the evening.', { eve: -1 }, 'refused to step on a grave or a crack in the road'),
  t('gloryhound', 'Glory-hunter', 'bad', 'courage', '+1 against bosses, 8% more likely to die.', { b: 1, d: 0.08 }, 'wanted a song written about them, any song'),
  t('feverish', 'Prone to Fever', 'bad', 'body', 'Recovers 25% slower.', { rec: -0.25 }, 'caught whatever was going round'),
  t('coward', 'Cowardly', 'bad', 'courage', '10% less likely to die, −1.2 in fights and −1.5 against bosses.', { d: -0.1, c: -1.2, b: -1.5 }, 'survived mostly by running, and was good at it'),
  t('stubborn', 'Stubborn', 'bad', 'mind', '8% less XP, 5% less likely to die.', { x: -0.08, d: -0.05 }, 'refused to learn the easy way, or any way'),
  t('vain', 'Vain', 'bad', 'vice', '10% more likely to be hurt.', { i: 0.1 }, 'would not wear the ugly helmet'),
  t('gambler', 'Gambler', 'bad', 'luck', '+10% gold, −0.4 rating.', { g: 0.1, r: -0.4 }, 'bet on everything, the weather included'),
  t('nervous', 'Nervous', 'bad', 'nerve', '−1 on endurance, +0.5 when Cautious.', { e: -1, caut: 0.5 }, 'jumped at every shadow, including their own'),
  t('quarrelsome', 'Quarrelsome', 'bad', 'social', '+0.5 in fights, −0.5 for each other member.', { c: 0.5, team: -0.5 }, 'argued with the map and the person holding it'),
  t('sluggish', 'Sluggish', 'bad', 'body', '−0.8 on hazards, 10% more tiring.', { h: -0.8, f: 0.1 }, 'moved like a winter morning'),
  t('forgetful', 'Forgetful', 'bad', 'mind', '−0.7 on traps, 5% less XP.', { t: -0.7, x: -0.05 }, 'left their pack at the last inn, again'),
  t('bitter', 'Bitter', 'bad', 'temper', '5% less XP, +0.8 against bosses.', { x: -0.05, b: 0.8 }, 'still had a score to settle with someone long gone'),
  t('haunted', 'Haunted', 'bad', 'faith', '6% more likely to die, counters Cursed.', { d: 0.06, cnt: ['cursed'] }, 'saw someone standing there who was not'),
  t('restless', 'Restless', 'bad', 'social', '+0.8 in a party of one or two, −0.3 for each other member.', { solo: 0.8, team: -0.3 }, 'could not sit still for a whole meal'),
  t('paranoid', 'Paranoid', 'bad', 'nerve', '+1 on traps, −0.4 for each other member.', { t: 1, team: -0.4 }, 'trusted the door less than the dark'),
  t('squeamish', 'Squeamish', 'bad', 'body', '−0.8 in fights, 5% less likely to be hurt.', { c: -0.8, i: -0.05 }, 'fainted at the sight of their own blood'),
  // Quirks
  t('lonewolf', 'Lone Wolf', 'quirk', 'social', '+1.5 in a party of one or two, −0.5 for each other member.', { solo: 1.5, team: -0.5 }, 'preferred the road alone'),
  t('teamplayer', 'Team Player', 'quirk', 'social', '+0.5 for each other member, −1 in a party of one or two.', { team: 0.5, solo: -1 }, 'was never any good alone'),
  t('berserker', 'Berserker', 'quirk', 'temper', '+1.5 in fights, 15% more likely to be hurt, 10% more likely to die.', { c: 1.5, i: 0.15, d: 0.1 }, 'went somewhere else when the shouting started'),
  t('pacifist', 'Pacifist', 'quirk', 'temper', '−1.2 in fights, +0.8 on hazards and traps.', { c: -1.2, h: 0.8, t: 0.8 }, 'preferred any way round to the way through'),
  t('scavenger', 'Scavenger', 'quirk', 'greed', '8% more gold, 8% more tiring.', { g: 0.08, f: 0.08 }, 'picked over every battlefield after the others left'),
  t('insomniac', 'Insomniac', 'quirk', 'time', '+1.2 in the evening, −0.8 in the morning.', { eve: 1.2, morn: -0.8 }, 'was wide awake when the rest of town was not'),
  t('nightstalker', 'Night Stalker', 'quirk', 'time', '+1.5 in the evening, −1 in the morning.', { eve: 1.5, morn: -1 }, 'did their best work after dark'),
  t('dawnwalker', 'Dawn-walker', 'quirk', 'time', '+1.5 in the morning, −0.8 in the evening.', { morn: 1.5, eve: -0.8 }, 'liked the first light better than the last'),
  t('caveborn', 'Cave-born', 'quirk', 'wild', 'Counters Darkness and Narrow.', { cnt: ['darkness', 'narrow'] }, 'was born underground and found daylight loud'),
  t('sealegs', 'Sea-legged', 'quirk', 'wild', 'Counters Flooded.', { cnt: ['flooded'] }, 'spent years on the water before the land took them in'),
  t('coldblood', 'Cold-blooded', 'quirk', 'wild', 'Counters Cold, +0.3 on endurance.', { cnt: ['cold'], e: 0.3 }, 'never seemed to feel the winter'),
  t('herbchild', 'Herbalist’s Child', 'quirk', 'wild', 'Counters Plague, recovers 12% faster.', { cnt: ['plague'], rec: 0.12 }, 'was raised among drying herbs and sick neighbours'),
  t('oldsoldier', 'Old Soldier', 'quirk', 'veteran', '+0.7 in fights and on endurance, 5% less XP.', { c: 0.7, e: 0.7, x: -0.05 }, 'had marched for a lord who was long forgotten'),
  t('pious', 'Pious', 'quirk', 'faith', 'Counters Cursed, 4% less likely to die.', { cnt: ['cursed'], d: -0.04 }, 'carried a small book and was not shy about it'),
  t('treasurehunter', 'Treasure-hunter', 'quirk', 'greed', '+10% gold, +0.5 on traps, 5% more likely to die.', { g: 0.1, t: 0.5, d: 0.05 }, 'chased every rumour of buried silver'),
  t('bookish', 'Bookish', 'quirk', 'mind', '10% more XP, −0.5 in fights.', { x: 0.1, c: -0.5 }, 'read more than they fought, and it showed'),
  t('showman', 'Showman', 'quirk', 'social', '+6% gold, +0.8 when Bold, 5% more likely to be hurt.', { g: 0.06, bold: 0.8, i: 0.05 }, 'liked an audience and found one in every town'),
  t('frontierkid', 'Frontier Kid', 'quirk', 'wild', 'Counters Ambush, +0.5 on hazards.', { cnt: ['ambush'], h: 0.5 }, 'grew up where the road ended and the trouble began'),
  t('nobleborn', 'Noble Born', 'quirk', 'veteran', '+0.4 rating, trains 15% better, −0.5 on endurance.', { r: 0.4, tr: 0.15, e: -0.5 }, 'had never carried their own bags until now'),
  t('tracker', 'Tracker', 'quirk', 'wild', 'Counters Beasts, +0.5 on hazards.', { cnt: ['beasts'], h: 0.5 }, 'could read a trail the way others read a page'),
  t('locksmithheir', 'Locksmith’s Heir', 'quirk', 'sight', 'Counters Locked, +0.8 on traps.', { cnt: ['locked'], t: 0.8 }, 'learned from a father who could open any door in the county'),
  t('smithapprentice', 'Smith’s Apprentice', 'quirk', 'body', '+0.5 in fights, 8% less tiring.', { c: 0.5, f: -0.08 }, 'swung a hammer from dawn before they could swing a sword'),
];
export const TRAIT = Object.fromEntries(TRAITS.map((x) => [x.id, x])) as Record<string, Trait>;

/** The sum of what a set of traits (and any extra effects) does. */
export function traitFx(ids: string[], extra: Fx[] = []) {
  const out = { r: 0, c: 0, h: 0, t: 0, e: 0, b: 0, d: 0, i: 0, f: 0, rec: 0, x: 0, g: 0, tr: 0, bold: 0, caut: 0, solo: 0, team: 0, eve: 0, morn: 0, cnt: [] as ConditionId[] };
  for (const fx of [...ids.map((id) => TRAIT[id]?.fx), ...extra]) {
    if (!fx) continue;
    for (const k of Object.keys(out) as (keyof typeof out)[]) {
      if (k === 'cnt') out.cnt.push(...(fx.cnt ?? []));
      else out[k] += fx[k] ?? 0;
    }
  }
  return out;
}
export type TraitFx = ReturnType<typeof traitFx>;
export const KIND_KEY: Partial<Record<StageKind, 'c' | 'h' | 't' | 'e' | 'b'>> = { combat: 'c', hazard: 'h', trap: 't', endurance: 'e', boss: 'b' };

/** Two traits: not from the same family, and not two flaws if it can be helped. */
export function pickTraits(r: Rng): string[] {
  const kindOf = () => r.weighted<TraitKind>(['good', 'bad', 'quirk'], (k) => ({ good: 40, bad: 28, quirk: 32 }[k]));
  const draw = (k: TraitKind, not: Trait[]) => {
    const pool = TRAITS.filter((x) => x.kind === k && not.every((n) => n.id !== x.id && n.group !== x.group));
    return pool.length ? r.pick(pool) : r.pick(TRAITS.filter((x) => not.every((n) => n.group !== x.group)));
  };
  const a = draw(kindOf(), []);
  let k2 = kindOf();
  if (a.kind === 'bad' && k2 === 'bad') k2 = r.chance(0.5) ? 'good' : 'quirk';
  const b = draw(k2, [a]);
  return [a.id, b.id];
}

// ── Backstories ──────────────────────────────────────────────

const PLACES: Record<RaceId, string[]> = {
  human: ['Willowbend', 'Oakhollow', 'Marrow Cross', 'Dunmere', 'Thistlegate', 'Ashby-on-the-Fen', 'Brackenford', 'Kettle Row'],
  dwarf: ['Deepforge', 'Anvil Gap', 'Greyvein', 'Stonebrook Hold', 'Coalmarch', 'Hammerfell'],
  elf: ['Silverleaf Reach', 'the Lantern Wood', 'Mistwater', 'Evenfall Glade', 'Thornwhisper', 'Dawnmere'],
  halfling: ['Puddlewick', 'Honeybarrow', 'Underhill Green', 'Mossbottom', 'Bramblecombe', 'Warmhearth'],
};
const BIRTH = [
  'were born in {place}, the third of five', 'grew up in {place}, behind the mill', 'came from {place}, where nothing much ever happened', 'were raised in {place} by an aunt and a stubborn goat',
  'left {place} at sixteen with one good boot', 'were a ferryman’s child from {place}', 'spent a quiet childhood in {place} and did not enjoy it', 'were the baker’s youngest in {place}',
];
const REASONS = [
  'The harvest failed, and so they came to the guild.', 'A debt came due, and the guild paid better than the lender.', 'A letter arrived with no signature, and they followed it here.',
  'An old teacher died, and left them a sword and no instructions.', 'The village ran out of stories, so they went to find some.', 'They lost a bet, and the stakes were a year of service.',
  'They wanted to see the sea, and the guild was going that way.', 'Somebody had to, and nobody else would.', 'They were running from something small that grew.',
  'They heard the guild never leaves anyone behind, and wanted to see if it was true.', 'A friend vouched for them, and has not been heard of since.', 'They simply could not stay.',
];

/** Three or four sentences, made from where they came from and what they are like. Nothing here says who they are other than "they". */
export function backstory(r: Rng, race: RaceId, traitIds: string[]): string {
  const place = r.pick(PLACES[race]);
  const [a, b] = traitIds.map((id) => TRAIT[id]?.story ?? '');
  return ['They ' + r.pick(BIRTH).replace('{place}', place) + '.', 'They ' + a + (b ? ', and ' + b : '') + '.', r.pick(REASONS)].join(' ');
}
