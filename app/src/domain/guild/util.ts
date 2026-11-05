// Small helpers shared by the engine and the legacy rules.
import { isActive } from './adventurer';
import type { Entry, Guild } from './types';

export const log = (g: Guild, e: Omit<Entry, 'at'>, at = g.t) => { g.chronicle = [...g.chronicle, { at, ...e }]; };
export const nextId = (g: Guild, prefix: string) => prefix + (++g.counter).toString(36);
export const byId = (g: Guild, id: string | null | undefined) => (id ? g.adventurers.find((a) => a.id === id) : undefined);
export const active = (g: Guild) => g.adventurers.filter(isActive);
export const champion = (g: Guild) => { const a = byId(g, g.championId); return a && isActive(a) ? a : undefined; };
