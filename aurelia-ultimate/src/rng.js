// Generador pseudoaleatorio con semilla (mulberry32). Reproducible y serializable.
export class RNG {
  constructor(seed = 1) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** entero inclusivo [a,b] */
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  float(a = 0, b = 1) { return a + this.next() * (b - a); }
  /** true con probabilidad p (0..1) */
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  weighted(list, wf = (x) => x.w) {
    let total = 0;
    for (const x of list) total += Math.max(0, wf(x));
    if (total <= 0) return list.length ? list[0] : undefined;
    let r = this.next() * total;
    for (const x of list) { r -= Math.max(0, wf(x)); if (r < 0) return x; }
    return list[list.length - 1];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  get state() { return this.s; }
  set state(v) { this.s = v >>> 0; }
}

export function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export const seeded = (x) => new RNG(typeof x === 'string' ? hashStr(x) : x);
