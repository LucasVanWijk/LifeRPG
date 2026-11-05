// Gear: how it's made, what it's worth, and what happens to it as it wears out.
import type { ConditionId, Slot } from './content';
import {
  ARMOUR_INJURY, COND_IDS, CONDITIONS, GEAR_NAMES, GRADE_DURABILITY, GRADE_RATING, GRADE_VALUE, GRADE_WORD, SALVAGE_IRON, SLOT_RATING, SLOTS,
} from './content';
import type { Rng } from './rng';
import type { Item, ItemDraft } from './types';

/** How much the item adds to its wearer's rating. */
export const itemRating = (i: Pick<Item, 'grade' | 'slot'>) => GRADE_RATING[i.grade] * SLOT_RATING[i.slot];
/** Armour makes injury less likely, by grade. */
export const itemInjuryCut = (i: Pick<Item, 'grade' | 'slot'>) => (i.slot === 'armour' ? ARMOUR_INJURY * (i.grade + 1) : 0);
export const itemValue = (i: Pick<Item, 'grade'>) => GRADE_VALUE[i.grade];
export const itemIron = (i: Pick<Item, 'grade'>) => SALVAGE_IRON[i.grade];
export const maxWear = (i: Pick<Item, 'grade'>) => GRADE_DURABILITY[i.grade];

/** Higher grade first, then more wear left. */
export const better = (a: Item, b: Item) => b.grade - a.grade || b.wear - a.wear;

export function makeDraft(r: Rng, grade: number, slot?: Slot, counter?: ConditionId): ItemDraft {
  const sl = slot ?? r.pick(SLOTS);
  let counters: ConditionId | undefined;
  if (sl === 'trinket' && (counter || (grade >= 2 && r.chance(0.6)))) counters = counter ?? r.pick(COND_IDS);
  const name = counters ? CONDITIONS[counters].trinket : r.pick(GRADE_WORD[grade]) + ' ' + r.pick(GEAR_NAMES[sl]);
  return { name: counters && grade >= 3 ? 'Fine ' + name : name, slot: sl, grade, wear: GRADE_DURABILITY[grade], counters };
}

/** The grade a drop from a tier is likely to have. */
export function dropGrade(r: Rng, tier: number, bonus = 0): number {
  const g = r.weighted([0, 1, 2, 3, 4], (x) => Math.max(0, 40 - Math.abs(x - (tier - 1 + bonus)) * 22 - (x > tier ? 25 : 0)));
  return Math.min(4, g);
}
