// Seeded PRNG (mulberry32 style): one seed always builds the same city and the same run,
// which is what makes the ?shot= scenes reproducible.
export function createRandom(seed) {
  let a = (seed | 0) || 1;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function randPick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
