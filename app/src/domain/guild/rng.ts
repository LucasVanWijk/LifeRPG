// Seeded dice. Every random outcome is derived from the guild's seed plus what it is for
// (a phase, an outing, a recruit), so catching up gives the same results however often the app is opened.

/** A 32-bit hash of any mix of strings and numbers. */
export function hash(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0x9e; h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** 1..sides */
  roll(sides: number): number;
  /** min..max inclusive */
  int(min: number, max: number): number;
  pick<T>(xs: readonly T[]): T;
  chance(p: number): boolean;
  /** Picks by weight; weights may be zero but not all. */
  weighted<T>(xs: readonly T[], w: (x: T) => number): T;
}

export function rng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    roll: (sides) => 1 + Math.floor(next() * sides),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    chance: (p) => next() < p,
    weighted(xs, w) {
      const total = xs.reduce((n, x) => n + w(x), 0);
      let r = next() * total;
      for (const x of xs) { r -= w(x); if (r < 0) return x; }
      return xs[xs.length - 1];
    },
  };
}

/** Dice for one purpose: rngFor(guild.seed, 'board', day). */
export const rngFor = (seed: number, ...parts: (string | number)[]) => rng(hash(seed, ...parts));
