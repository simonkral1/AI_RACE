export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const round1 = (value: number): number => Math.round(value * 10) / 10;

export const mulberry32 = (seed: number): (() => number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

export const pickOne = <T>(rng: () => number, items: T[]): T => {
  return items[Math.floor(rng() * items.length)];
};
