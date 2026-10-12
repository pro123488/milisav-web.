(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/rng.js
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  var RNG;
  var init_rng = __esm({
    "src/rng.js"() {
      RNG = class {
        constructor(seed = 1) {
          this.s = seed >>> 0 || 2654435769;
        }
        next() {
          this.s = this.s + 1831565813 >>> 0;
          let t = this.s;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
        /** entero inclusivo [a,b] */
        int(a, b) {
          return a + Math.floor(this.next() * (b - a + 1));
        }
        float(a = 0, b = 1) {
          return a + this.next() * (b - a);
        }
        /** true con probabilidad p (0..1) */
        chance(p) {
          return this.next() < p;
        }
        pick(arr) {
          return arr[Math.floor(this.next() * arr.length)];
        }
        weighted(list, wf = (x) => x.w) {
          let total = 0;
          for (const x of list) total += Math.max(0, wf(x));
          if (total <= 0) return list.length ? list[0] : void 0;
          let r = this.next() * total;
          for (const x of list) {
            r -= Math.max(0, wf(x));
            if (r < 0) return x;
          }
          return list[list.length - 1];
        }
        shuffle(arr) {
          const a = arr.slice();
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
          }
          return a;
        }
        get state() {
          return this.s;
        }
        set state(v) {
          this.s = v >>> 0;
        }
      };
    }
  });

  // src/gfx/color.js
  function parseHex(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function mix(a, b, t) {
    const A3 = parseHex(a), B = parseHex(b);
    return toHex(A3[0] + (B[0] - A3[0]) * t, A3[1] + (B[1] - A3[1]) * t, A3[2] + (B[2] - A3[2]) * t);
  }
  function rgb2hsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    h = (h % 360 + 360) % 360;
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  function shiftHue(hex, deg, sat = 0) {
    if (!deg && !sat) return hex;
    const [r, g, b] = parseHex(hex);
    const [h, s, l] = rgb2hsl(r, g, b);
    const [nr, ng, nb] = hsl2rgb(h + deg, Math.max(0, Math.min(1, s + sat)), l);
    return toHex(nr, ng, nb);
  }
  var toHex, lighten, darken;
  var init_color = __esm({
    "src/gfx/color.js"() {
      toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
      lighten = (c, t) => mix(c, "#ffffff", t);
      darken = (c, t) => mix(c, "#1a1030", t);
    }
  });

  // src/gfx/tiles.js
  function T(name, props, draw2) {
    defs[name] = { name, props, draw: draw2 };
  }
  function tileProps(key) {
    const [n, v] = key.split(":");
    const d = defs[n];
    if (!d) throw new Error("Tile desconocido: " + key);
    return typeof d.props === "function" ? d.props(v || "") : d.props;
  }
  function tileCanvas(key, frame = 0) {
    const k = key + "#" + frame;
    let c = cache.get(k);
    if (!c) {
      const [name, v] = key.split(":");
      const d = defs[name];
      if (!d) throw new Error("Tile desconocido: " + key);
      c = mk();
      const g = c.getContext("2d");
      d.draw(g, new RNG(hashStr(key) + frame * 977), v || "", frame);
      cache.set(k, c);
    }
    return c;
  }
  function treeTile(kind, part, c1, c2, c3) {
    const off = part === "t" ? 0 : 16;
    return (g) => {
      const set = (x, cy, c) => {
        const y = cy - off;
        if (x >= 0 && x < 16 && y >= 0 && y < 16) px(g, x, y, c);
      };
      const disc = (cx, cy, r, c) => {
        for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, c);
      };
      const trunk = (x0, w) => {
        for (let y = 20; y < 32; y++) {
          for (let x = x0; x < x0 + w; x++) set(x, y, x === x0 ? "#9a6a3c" : x === x0 + w - 1 ? "#5a3818" : "#7a4e2a");
        }
        for (let x = x0 - 2; x < x0 + w + 2; x++) set(x, 31, "rgba(0,0,0,.25)");
      };
      if (kind === "oak") {
        trunk(6, 4);
        disc(8, 13, 8.6, c3);
        disc(7.5, 12, 7.8, c2);
        disc(6, 9, 5, c1);
        disc(11.5, 16.5, 3.4, c3);
        disc(4, 16, 2.6, c3);
        for (const [x, y] of [[4, 8], [5, 7], [9, 6], [3, 11]]) set(x, y, lighten(c1, 0.35));
        for (const [x, y] of [[11, 14], [12, 17], [8, 19]]) set(x, y, darken(c3, 0.3));
      } else if (kind === "pine") {
        trunk(7, 2);
        for (const [top, h, w] of [[2, 9, 5], [8, 10, 7], [15, 11, 8]]) for (let r = 0; r < h; r++) {
          const half = Math.round(w * (r + 1) / h);
          for (let x = 8 - half; x < 8 + half; x++) set(x, top + r, x < 8 - half * 0.2 ? c1 : x > 8 + half * 0.35 ? c3 : c2);
        }
      } else if (kind === "palm") {
        for (let y = 9; y < 32; y++) {
          const x = 8 + Math.round(Math.sin((y - 9) / 8) * 1);
          for (let w = 0; w < 3; w++) set(x + w - 1, y, w === 0 ? "#b8844a" : w === 2 ? "#6e4624" : "#9a6a3a");
          if (y % 3 === 0) set(8 + Math.round(Math.sin((y - 9) / 8)) - 1, y, "#5a381c");
        }
        for (const [dx, dy] of [[-6, 2], [-4, -1], [-1, -3], [3, -2], [6, 1], [5, 4], [-5, 5]]) for (let i = 0; i < 4; i++) {
          set(8 + Math.round(dx * i / 3), 8 + Math.round(dy * i / 3) + (i > 2 ? 1 : 0), i % 2 ? c1 : c2);
          set(8 + Math.round(dx * i / 3), 9 + Math.round(dy * i / 3), c3);
        }
        disc(8, 9, 2, c2);
        set(7, 10, "#7a4a2a");
        set(9, 10, "#7a4a2a");
      }
    };
  }
  function bPalette(v) {
    const [kind, roof, wall] = v.split("_");
    return { kind, roof: ROOFS[roof] || ROOFS.red, wall: WALLS[wall] || WALLS.cream };
  }
  function roofTile(g, p, edge, lower) {
    const [a, b, c] = p.roof;
    fillBase(g, a);
    for (let y = 0; y < 16; y += 4) {
      rect(g, 0, y + 3, 16, 1, b);
    }
    for (let y = 0; y < 16; y += 4) for (let x = y / 4 % 2 ? 2 : 6; x < 16; x += 8) rect(g, x, y, 1, 4, b);
    rect(g, 0, 0, 16, 1, c);
    if (edge === "l") {
      rect(g, 0, 0, 1, 16, b);
      rect(g, 1, 0, 1, 16, c);
    }
    if (edge === "r") {
      rect(g, 15, 0, 1, 16, b);
      rect(g, 14, 0, 1, 16, a);
    }
    if (lower) {
      rect(g, 0, 13, 16, 3, b);
      rect(g, 0, 15, 16, 1, darken(b, 0.3));
    }
  }
  function wallTile(g, p, win, door) {
    const [a, b, c] = p.wall;
    fillBase(g, a);
    rect(g, 0, 0, 16, 2, b);
    rect(g, 0, 15, 16, 1, b);
    rect(g, 0, 2, 16, 1, c);
    if (win) {
      rect(g, 3, 4, 10, 8, "#6a5a48");
      rect(g, 4, 5, 8, 6, "#9ad8f8");
      rect(g, 4, 5, 8, 2, "#cdeeff");
      rect(g, 7, 5, 1, 6, "#6a5a48");
      rect(g, 4, 8, 8, 1, "#6a5a48");
      rect(g, 3, 12, 10, 1, "#8a7a60");
    }
    if (door) {
      rect(g, 2, 2, 12, 14, "#4a3420");
      rect(g, 3, 3, 10, 13, "#8a5a30");
      rect(g, 3, 3, 10, 2, "#a87444");
      rect(g, 8, 3, 1, 13, "#6a4220");
      px(g, 10, 10, "#f2d060");
      px(g, 6, 10, "#f2d060");
      rect(g, 2, 15, 12, 1, "#2a1c10");
    }
  }
  function icon(g, kind) {
    const w = "#fff";
    if (kind === "center") {
      rect(g, 6, 3, 4, 10, w);
      rect(g, 3, 6, 10, 4, w);
      rect(g, 7, 4, 2, 8, "#e84a5a");
      rect(g, 4, 7, 8, 2, "#e84a5a");
    } else if (kind === "shop") {
      rect(g, 3, 5, 10, 8, w);
      rect(g, 5, 3, 6, 3, w);
      rect(g, 4, 6, 8, 6, "#4a7ad8");
      px(g, 7, 8, w);
      px(g, 8, 8, w);
      rect(g, 7, 9, 2, 2, w);
    } else if (kind === "gym") {
      rect(g, 4, 3, 8, 6, "#f2d060");
      rect(g, 3, 3, 1, 3, "#f2d060");
      rect(g, 12, 3, 1, 3, "#f2d060");
      rect(g, 7, 9, 2, 3, "#f2d060");
      rect(g, 5, 12, 6, 2, "#f2d060");
      rect(g, 5, 4, 2, 2, "#fff2a0");
    } else if (kind === "lab") {
      rect(g, 6, 3, 4, 3, w);
      rect(g, 5, 6, 6, 7, "#6ad8a8");
      rect(g, 4, 11, 8, 2, "#6ad8a8");
      rect(g, 6, 7, 1, 3, w);
      px(g, 9, 9, w);
    } else if (kind === "hall") {
      rect(g, 3, 6, 10, 7, "#d8d0a8");
      for (const x of [4, 7, 10]) rect(g, x, 7, 2, 5, "#8a8460");
      rect(g, 2, 4, 12, 2, "#b8b088");
      rect(g, 6, 2, 4, 2, "#b8b088");
    } else if (kind === "dojo") {
      rect(g, 3, 3, 10, 2, "#f08a3a");
      rect(g, 5, 5, 6, 7, w);
      rect(g, 7, 6, 2, 5, "#c8452f");
    } else if (kind === "inn") {
      rect(g, 3, 8, 10, 4, "#e8a0a0");
      rect(g, 3, 6, 4, 3, w);
      rect(g, 12, 6, 1, 6, "#8a5a30");
      rect(g, 3, 12, 1, 2, "#8a5a30");
    }
  }
  var T16, defs, cache, mk, px, rect, fillBase, speck, GR, ROOFS, WALLS;
  var init_tiles = __esm({
    "src/gfx/tiles.js"() {
      init_rng();
      init_color();
      T16 = 16;
      defs = {};
      cache = /* @__PURE__ */ new Map();
      mk = () => {
        const c = document.createElement("canvas");
        c.width = c.height = T16;
        return c;
      };
      px = (g, x, y, c) => {
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      };
      rect = (g, x, y, w, h, c) => {
        g.fillStyle = c;
        g.fillRect(x, y, w, h);
      };
      fillBase = (g, c) => rect(g, 0, 0, 16, 16, c);
      speck = (g, rng, n, cols, x0 = 0, y0 = 0, x1 = 16, y1 = 16) => {
        for (let i = 0; i < n; i++) px(g, rng.int(x0, x1 - 1), rng.int(y0, y1 - 1), rng.pick(cols));
      };
      GR = { a: "#62c264", b: "#4faa57", c: "#86d977", d: "#3e8f4a" };
      T("grass", { blend: { prio: 6, color: GR.b } }, (g, r, v) => {
        fillBase(g, GR.a);
        speck(g, r, 14, [GR.b, GR.c], 0, 0);
        for (let i = 0; i < 4; i++) {
          const x = r.int(1, 14), y = r.int(2, 14);
          px(g, x, y, GR.d);
          px(g, x, y - 1, GR.c);
        }
        if (v === "1") {
          px(g, 5, 5, "#f4f08a");
          px(g, 11, 10, "#f4f08a");
        }
      });
      T("tallgrass", { enc: "hierba", anim: 2, blend: { prio: 6, color: GR.d } }, (g, r, v, f) => {
        fillBase(g, "#4b9e50");
        for (let i = 0; i < 9; i++) {
          const x = 1 + i % 3 * 5 + (f ? 1 : 0), y = 3 + Math.floor(i / 3) * 5;
          rect(g, x, y + 1, 1, 4, GR.d);
          rect(g, x + 1, y, 1, 5, "#58b45a");
          rect(g, x + 2, y + 1, 1, 4, GR.d);
          px(g, x + 1, y - 1, "#9be58a");
          px(g, x - (f ? 0 : 1), y, "#9be58a");
        }
      });
      T("flowers", { blend: { prio: 6, color: GR.b } }, (g, r, v) => {
        fillBase(g, GR.a);
        speck(g, r, 10, [GR.b, GR.c]);
        const cols = v === "y" ? ["#ffe24a", "#fff2a0"] : v === "b" ? ["#8fb0ff", "#d8e4ff"] : ["#ff7a8a", "#ffc2cc"];
        for (const [x, y] of [[3, 4], [10, 3], [7, 10], [12, 12], [2, 12]]) {
          px(g, x, y, cols[0]);
          px(g, x + 1, y, cols[1]);
          px(g, x, y + 1, cols[1]);
          px(g, x, y + 2, "#3e8f4a");
        }
      });
      T("path", { blend: { prio: 4, color: "#d2b07a" } }, (g, r) => {
        fillBase(g, "#dcc08a");
        speck(g, r, 16, ["#cdab74", "#e8d3a2", "#bf9d68"]);
      });
      T("sand", { blend: { prio: 3, color: "#ecd9a0" }, enc: null }, (g, r) => {
        fillBase(g, "#efdca6");
        speck(g, r, 14, ["#e0cb92", "#f8ecc2"]);
        for (let i = 0; i < 2; i++) {
          const y = r.int(3, 13);
          rect(g, r.int(0, 8), y, 6, 1, "#e3d09a");
        }
      });
      T("dune", { enc: "desierto", blend: { prio: 3, color: "#e6c77c" } }, (g, r) => {
        fillBase(g, "#e8c97e");
        speck(g, r, 12, ["#d9b86a", "#f2dc9a"]);
        rect(g, 0, 5, 16, 1, "#d4b062");
        rect(g, 2, 6, 10, 1, "#f4e0a4");
        rect(g, 4, 12, 12, 1, "#d4b062");
        rect(g, 0, 13, 8, 1, "#f4e0a4");
      });
      T("beach", { enc: "arena", blend: { prio: 3, color: "#f2e2b0" } }, (g, r) => {
        fillBase(g, "#f3e4b2");
        speck(g, r, 12, ["#e8d59c", "#fff3d0", "#d9c58a"]);
      });
      T("water", { water: true, anim: 4, enc: "agua" }, (g, r, v, f) => {
        fillBase(g, "#3f90e6");
        for (const [x, y] of [[1, 3], [9, 7], [4, 11], [12, 14]]) {
          const xx = (x + f * 2) % 16;
          rect(g, xx, y, 4, 1, "#7ab8f4");
          px(g, xx + 1, y + 1, "#2f78cc");
        }
        speck(g, new RNG(7), 6, ["#58a2ee"], 0, 0);
      });
      T("deepwater", { water: true, anim: 4, enc: "agua" }, (g, r, v, f) => {
        fillBase(g, "#2c63c0");
        for (const [x, y] of [[2, 4], [10, 9], [5, 13]]) {
          const xx = (x + f * 2) % 16;
          rect(g, xx, y, 3, 1, "#4a86e0");
        }
      });
      T("swampwater", { water: true, anim: 4, enc: "pantano" }, (g, r, v, f) => {
        fillBase(g, "#4a7a5a");
        for (const [x, y] of [[1, 4], [9, 8], [4, 12]]) {
          const xx = (x + f) % 16;
          rect(g, xx, y, 4, 1, "#6a9a6e");
        }
        px(g, 12, 3, "#9ec07a");
        px(g, 3, 9, "#9ec07a");
        rect(g, 7, 12, 3, 2, "#5a8a3a");
      });
      T("mud", { enc: "pantano", blend: { prio: 4, color: "#6b5238" } }, (g, r) => {
        fillBase(g, "#755a3c");
        speck(g, r, 16, ["#6b5238", "#85694a", "#5e4630"]);
      });
      T("snow", { blend: { prio: 6, color: "#dfe9f8" } }, (g, r) => {
        fillBase(g, "#f3f8ff");
        speck(g, r, 12, ["#dfe9f8", "#ffffff", "#cfdcf0"]);
      });
      T("ice", { blend: { prio: 5, color: "#a8dcf0" } }, (g, r) => {
        fillBase(g, "#b4e4f6");
        rect(g, 2, 3, 6, 1, "#e8fbff");
        rect(g, 9, 9, 5, 1, "#e8fbff");
        speck(g, r, 8, ["#98d0ea", "#d4f2fc"]);
      });
      T("lava", { solid: true, anim: 4, kind: "lava" }, (g, r, v, f) => {
        fillBase(g, "#d8431a");
        for (const [x, y] of [[1, 3], [8, 8], [3, 12]]) {
          const xx = (x + f * 2) % 16;
          rect(g, xx, y, 5, 2, "#ff8c2a");
          rect(g, xx + 1, y, 3, 1, "#ffd24a");
        }
        speck(g, new RNG(3 + f), 4, ["#ff6a1f", "#a02a10"]);
      });
      T("cavefloor", { enc: "cueva", blend: { prio: 5, color: "#4c4852" } }, (g, r) => {
        fillBase(g, "#5a5662");
        speck(g, r, 20, ["#4e4a58", "#68646f", "#44404c"]);
      });
      T("cavewall", { solid: true }, (g, r) => {
        fillBase(g, "#3a3644");
        rect(g, 0, 0, 16, 3, "#4c4858");
        speck(g, r, 22, ["#2e2a38", "#504c5c", "#26222e"]);
        rect(g, 0, 13, 16, 3, "#2a2634");
      });
      T("rubble", { enc: "cueva" }, (g, r) => {
        fillBase(g, "#5a5662");
        for (const [x, y, w] of [[2, 3, 4], [9, 6, 5], [4, 11, 5]]) {
          rect(g, x, y, w, 3, "#7a7686");
          rect(g, x, y, w, 1, "#948fa2");
          rect(g, x, y + 2, w, 1, "#4a4656");
        }
      });
      T("ruinfloor", { blend: { prio: 5, color: "#a8a08a" }, enc: "ruinas" }, (g, r) => {
        fillBase(g, "#b5ad98");
        rect(g, 0, 7, 16, 1, "#8f8872");
        rect(g, 7, 0, 1, 8, "#8f8872");
        rect(g, 3, 8, 1, 8, "#8f8872");
        rect(g, 12, 8, 1, 8, "#8f8872");
        speck(g, r, 12, ["#c6bfa8", "#a39b86"]);
      });
      T("cobble", { blend: { prio: 5, color: "#9a98a8" } }, (g, r) => {
        fillBase(g, "#b8b6c4");
        for (let y = 0; y < 16; y += 4) {
          rect(g, 0, y, 16, 1, "#9a98a8");
          const off = y / 4 % 2 ? 4 : 0;
          for (let x = off; x < 16; x += 8) rect(g, x, y, 1, 4, "#9a98a8");
        }
        speck(g, r, 8, ["#c8c6d4", "#a8a6b4"]);
      });
      T("bridge", { water: false }, (g, r) => {
        fillBase(g, "#a8763c");
        for (let x = 0; x < 16; x += 4) rect(g, x, 0, 1, 16, "#7d5528");
        rect(g, 0, 0, 16, 2, "#c58e50");
        rect(g, 0, 14, 16, 2, "#7d5528");
        speck(g, r, 6, ["#b88448", "#8f6232"]);
      });
      T("dock", {}, (g, r) => {
        fillBase(g, "#b48244");
        for (let y = 0; y < 16; y += 4) rect(g, 0, y, 16, 1, "#8c5e2c");
        rect(g, 3, 0, 1, 16, "#8c5e2c");
        rect(g, 12, 0, 1, 16, "#8c5e2c");
      });
      T("clifftop", { solid: true }, (g, r) => {
        fillBase(g, "#8f8a7a");
        rect(g, 0, 0, 16, 4, "#aaa493");
        rect(g, 0, 4, 16, 1, "#6e6a5c");
        speck(g, r, 18, ["#7e7a6a", "#a09a88", "#6e6a5c"]);
        rect(g, 0, 12, 16, 4, "#6e6a5c");
      });
      T("cliff", { solid: true }, (g, r) => {
        fillBase(g, "#79746a");
        speck(g, r, 24, ["#6a665c", "#8a857a", "#5c5850"]);
        for (let x = 0; x < 16; x += 5) rect(g, x, 0, 1, 16, "#5c5850");
      });
      T("rockwall", { solid: true, climb: true }, (g, r) => {
        fillBase(g, "#867e70");
        speck(g, r, 18, ["#756d60", "#978f80"]);
        for (const x of [2, 7, 12]) {
          rect(g, x, 1, 1, 14, "#5a5246");
          rect(g, x - 1, 4, 3, 1, "#cfc4a8");
          rect(g, x - 1, 9, 3, 1, "#cfc4a8");
        }
      });
      T("sandstone", { solid: true }, (g, r) => {
        fillBase(g, "#d6b574");
        rect(g, 0, 0, 16, 3, "#ebd096");
        rect(g, 0, 8, 16, 1, "#b8955a");
        speck(g, r, 14, ["#c8a566", "#e2c488"]);
        rect(g, 0, 13, 16, 3, "#b8955a");
      });
      T("void", { solid: true }, (g) => {
        fillBase(g, "#14101e");
      });
      T("tree_t", { solid: true, kind: "tree" }, treeTile("oak", "t", "#4fbf5a", "#3a9a48", "#2c7a3c"));
      T("tree_b", { solid: true, kind: "tree" }, treeTile("oak", "b", "#4fbf5a", "#3a9a48", "#2c7a3c"));
      T("pine_t", { solid: true, kind: "tree" }, treeTile("pine", "t", "#3c9a5a", "#2c7a48", "#1f5c38"));
      T("pine_b", { solid: true, kind: "tree" }, treeTile("pine", "b", "#3c9a5a", "#2c7a48", "#1f5c38"));
      T("snowpine_t", { solid: true, kind: "tree" }, treeTile("pine", "t", "#e8f2ff", "#a8c8e0", "#5c8aa8"));
      T("snowpine_b", { solid: true, kind: "tree" }, treeTile("pine", "b", "#e8f2ff", "#a8c8e0", "#5c8aa8"));
      T("palm_t", { solid: true, kind: "tree" }, treeTile("palm", "t", "#56c06a", "#3a9a52", "#2c7a3c"));
      T("palm_b", { solid: true, kind: "tree" }, treeTile("palm", "b", "#56c06a", "#3a9a52", "#2c7a3c"));
      T("dead_t", { solid: true, kind: "tree" }, treeTile("oak", "t", "#8a7a6a", "#6a5a4c", "#4a3c30"));
      T("dead_b", { solid: true, kind: "tree" }, treeTile("oak", "b", "#8a7a6a", "#6a5a4c", "#4a3c30"));
      T("swamptree_t", { solid: true, kind: "tree" }, treeTile("oak", "t", "#7a9a4a", "#5e7e3a", "#445a2a"));
      T("swamptree_b", { solid: true, kind: "tree" }, treeTile("oak", "b", "#7a9a4a", "#5e7e3a", "#445a2a"));
      T("autumn_t", { solid: true, kind: "tree" }, treeTile("oak", "t", "#f0a43a", "#d4782a", "#a85420"));
      T("autumn_b", { solid: true, kind: "tree" }, treeTile("oak", "b", "#f0a43a", "#d4782a", "#a85420"));
      T("bush", { solid: true, cut: true }, (g) => {
        for (const [x, y, rr, c] of [[8, 9, 6.5, "#2e8a44"], [7, 8, 5.5, "#3fa656"], [6, 6, 3, "#5cc472"]]) for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rr * rr) px(g, xx, yy, c);
        rect(g, 3, 14, 10, 1, "rgba(0,0,0,.2)");
      });
      T("boulder", { solid: true }, (g, r) => {
        for (const [x, y, rr, c] of [[8, 9, 6.5, "#6a665c"], [7, 8, 5.6, "#8a857a"], [6, 6, 3, "#aaa598"]]) for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rr * rr) px(g, xx, yy, c);
        rect(g, 3, 14, 10, 1, "rgba(0,0,0,.2)");
      });
      T("rock", { solid: true }, (g) => {
        for (const [x, y, rr, c] of [[8, 11, 4.8, "#6a665c"], [7, 10, 4, "#8f8a7e"]]) for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rr * rr) px(g, xx, yy, c);
        rect(g, 4, 15, 8, 1, "rgba(0,0,0,.2)");
      });
      T("stalagmite", { solid: true }, (g) => {
        for (let y = 3; y < 15; y++) {
          const w = Math.round((y - 3) * 0.45) + 1;
          rect(g, 8 - w, y, w * 2, 1, y < 8 ? "#7c788a" : "#5e5a6c");
          rect(g, 8 - w, y, 1, 1, "#a09cb0");
        }
        rect(g, 4, 15, 8, 1, "rgba(0,0,0,.25)");
      });
      T("crystal", { solid: true }, (g) => {
        const c = ["#8ae0ff", "#c8f4ff", "#4ab0e0"];
        for (const [x, h, i] of [[5, 9, 0], [9, 12, 1], [12, 7, 2]]) for (let y = 15 - h; y < 15; y++) {
          const w = Math.min(2, Math.floor((y - (15 - h)) / 3) + 1);
          rect(g, x - w + 1, y, w * 2 - 1, 1, y < 15 - h + 3 ? c[1] : c[0]);
          px(g, x + w - 1, y, c[2]);
        }
      });
      T("mushroom", { solid: true }, (g) => {
        rect(g, 7, 9, 3, 6, "#f0e6d0");
        for (let y = 3; y < 10; y++) {
          const w = y < 5 ? y - 1 : 6 - (y - 5) * 0.2;
          rect(g, 8 - w, y, w * 2 + 1, 1, y < 6 ? "#d84a5a" : "#b83040");
        }
        px(g, 5, 6, "#fff");
        px(g, 9, 5, "#fff");
        px(g, 11, 7, "#fff");
      });
      T("cactus", { solid: true }, (g) => {
        rect(g, 6, 3, 4, 12, "#3f9a4a");
        rect(g, 6, 3, 1, 12, "#5cc06a");
        rect(g, 2, 7, 4, 2, "#3f9a4a");
        rect(g, 2, 4, 2, 4, "#3f9a4a");
        rect(g, 10, 6, 4, 2, "#3f9a4a");
        rect(g, 12, 3, 2, 4, "#3f9a4a");
        for (const [x, y] of [[7, 5], [8, 9], [7, 12]]) px(g, x, y, "#e8f0c0");
        rect(g, 5, 15, 7, 1, "rgba(0,0,0,.2)");
      });
      T("pillar", { solid: true }, (g) => {
        rect(g, 4, 0, 8, 16, "#bdb59e");
        rect(g, 4, 0, 2, 16, "#d8d0b8");
        rect(g, 10, 0, 2, 16, "#8f8872");
        rect(g, 3, 0, 10, 2, "#a8a088");
        rect(g, 3, 14, 10, 2, "#a8a088");
        rect(g, 6, 5, 4, 1, "#6a6450");
        rect(g, 6, 9, 4, 1, "#6a6450");
      });
      T("brokenpillar", { solid: true }, (g) => {
        rect(g, 4, 6, 8, 10, "#bdb59e");
        rect(g, 4, 6, 2, 10, "#d8d0b8");
        rect(g, 10, 6, 2, 10, "#8f8872");
        rect(g, 5, 4, 3, 2, "#bdb59e");
        rect(g, 9, 5, 2, 1, "#bdb59e");
        rect(g, 3, 14, 10, 2, "#a8a088");
      });
      T("statue", { solid: true }, (g) => {
        rect(g, 4, 11, 8, 5, "#8f8aa0");
        rect(g, 6, 5, 4, 7, "#b4afc8");
        rect(g, 6, 2, 4, 4, "#cfcae0");
        rect(g, 4, 6, 2, 4, "#b4afc8");
        rect(g, 10, 6, 2, 4, "#b4afc8");
        px(g, 7, 3, "#5a5470");
        px(g, 9, 3, "#5a5470");
      });
      T("torch", { solid: true, anim: 2 }, (g, r, v, f) => {
        rect(g, 7, 6, 2, 9, "#6a4a2a");
        rect(g, 5, 5, 6, 2, "#8a6a3a");
        const c = f ? ["#ff6a1f", "#ffd24a"] : ["#ff8c2a", "#fff2a0"];
        rect(g, 6, 1, 4, 4, c[0]);
        rect(g, 7, 0, 2, 3, c[1]);
      });
      T("fence_h", { solid: true }, (g) => {
        rect(g, 0, 7, 16, 2, "#d8b070");
        rect(g, 0, 7, 16, 1, "#ecd0a0");
        for (const x of [1, 7, 13]) {
          rect(g, x, 4, 2, 10, "#c49a58");
          rect(g, x, 4, 2, 1, "#ecd0a0");
        }
        rect(g, 0, 12, 16, 1, "#a07a40");
      });
      T("fence_v", { solid: true }, (g) => {
        rect(g, 7, 0, 2, 16, "#d8b070");
        rect(g, 7, 0, 1, 16, "#ecd0a0");
        rect(g, 5, 2, 6, 2, "#c49a58");
        rect(g, 5, 12, 6, 2, "#c49a58");
      });
      T("sign", { solid: true, kind: "sign" }, (g) => {
        rect(g, 7, 9, 2, 6, "#7a5230");
        rect(g, 2, 2, 12, 8, "#b88448");
        rect(g, 2, 2, 12, 1, "#dca868");
        rect(g, 2, 9, 12, 1, "#8a5e2c");
        for (const y of [4, 6]) rect(g, 4, y, 8, 1, "#4a2e14");
      });
      T("lamp", { solid: true }, (g) => {
        rect(g, 7, 4, 2, 11, "#4a4a58");
        rect(g, 5, 1, 6, 4, "#ffe9a0");
        rect(g, 5, 0, 6, 1, "#4a4a58");
        rect(g, 5, 5, 6, 1, "#4a4a58");
      });
      T("fountain", { solid: true, anim: 2 }, (g, r, v, f) => {
        rect(g, 1, 6, 14, 9, "#a8a4b8");
        rect(g, 2, 7, 12, 7, "#4a9cec");
        rect(g, 2, 7, 12, 1, "#a8e0ff");
        rect(g, 6, 3, 4, 8, "#c8c4d8");
        const y = f ? 0 : 1;
        px(g, 7, y, "#a8e0ff");
        px(g, 8, y + 1, "#a8e0ff");
        px(g, 5, 4, "#a8e0ff");
        px(g, 10, 4, "#a8e0ff");
      });
      T("flowerbed", { solid: true }, (g, r) => {
        rect(g, 1, 8, 14, 7, "#7a5230");
        rect(g, 1, 8, 14, 1, "#9a6a3c");
        for (let i = 0; i < 9; i++) {
          const x = 2 + i % 5 * 3, y = 5 + i % 2 * 2;
          rect(g, x, y + 2, 1, 4, "#3e8f4a");
          px(g, x, y, ["#ff7a8a", "#ffe24a", "#8fb0ff", "#ffa0e0"][i % 4]);
          px(g, x + 1, y + 1, ["#ffc2cc", "#fff2a0", "#d8e4ff", "#ffd0f0"][i % 4]);
        }
      });
      T("hay", { solid: true }, (g, r) => {
        rect(g, 1, 5, 14, 10, "#e0b440");
        rect(g, 1, 5, 14, 2, "#f4d070");
        for (let x = 3; x < 14; x += 3) rect(g, x, 7, 1, 8, "#b88a20");
        rect(g, 1, 14, 14, 1, "#a07a18");
      });
      T("crate", { solid: true }, (g) => {
        rect(g, 2, 3, 12, 12, "#b88448");
        rect(g, 2, 3, 12, 1, "#dca868");
        rect(g, 2, 14, 12, 1, "#7d5528");
        rect(g, 2, 3, 1, 12, "#8a5e2c");
        rect(g, 13, 3, 1, 12, "#8a5e2c");
        rect(g, 3, 4, 10, 10, "rgba(0,0,0,0)");
        for (let i = 0; i < 10; i++) {
          px(g, 3 + i, 4 + i, "#8a5e2c");
          px(g, 12 - i, 4 + i, "#8a5e2c");
        }
      });
      T("well", { solid: true }, (g) => {
        rect(g, 2, 7, 12, 8, "#8f8aa0");
        rect(g, 3, 8, 10, 4, "#2a4a8a");
        rect(g, 2, 7, 12, 1, "#b4afc8");
        rect(g, 3, 1, 1, 8, "#7a5230");
        rect(g, 12, 1, 1, 8, "#7a5230");
        rect(g, 2, 1, 12, 2, "#a85a3c");
      });
      T("mailbox", { solid: true }, (g) => {
        rect(g, 7, 8, 2, 7, "#7a5230");
        rect(g, 3, 3, 10, 6, "#d84a4a");
        rect(g, 3, 3, 10, 1, "#f08a8a");
        rect(g, 10, 1, 2, 3, "#f2c030");
      });
      T("gate", {}, (g) => {
        fillBase(g, "rgba(0,0,0,0)");
      });
      ROOFS = { red: ["#d84a4a", "#a83030", "#f08080"], blue: ["#4a7ad8", "#2f55a8", "#8aaaf0"], green: ["#4aa85a", "#2f7a3c", "#8ad898"], brown: ["#a8683c", "#7a4824", "#d0946a"], purple: ["#8a5ad0", "#5e3a9a", "#b894f0"], orange: ["#e8883a", "#b8601e", "#f8b878"], grey: ["#8a90a8", "#5e647c", "#b8bdd0"], teal: ["#3aa8a0", "#247a74", "#7ad8d0"], gold: ["#e0b83a", "#a8861c", "#f8e078"], white: ["#e8ecf4", "#a8aec0", "#ffffff"], black: ["#4a4658", "#2a2638", "#7a7690"] };
      WALLS = { cream: ["#f4e8c8", "#d8c8a0", "#fff6e0"], white: ["#f4f6fa", "#c8cedc", "#ffffff"], stone: ["#b8b4c4", "#8f8ba0", "#d4d0e0"], wood: ["#c8935a", "#9a6a38", "#e0b078"], pink: ["#f0c8d0", "#c8a0a8", "#ffe8ec"], sand: ["#e8d09a", "#c0a870", "#f8e8c0"], dark: ["#6a6478", "#48425a", "#8a849c"], ice: ["#d8ecf8", "#a8c8e0", "#f4fbff"] };
      T("bldg", (v) => ({ solid: !v.endsWith("_door"), kind: v.endsWith("_door") ? "door" : "building" }), (g, r, v) => {
        const parts = v.split("_");
        const part = parts.pop();
        const p = bPalette(parts.join("_"));
        switch (part) {
          case "rl":
            roofTile(g, p, "l", false);
            break;
          case "rm":
            roofTile(g, p, "", false);
            break;
          case "rr":
            roofTile(g, p, "r", false);
            break;
          case "r2l":
            roofTile(g, p, "l", true);
            break;
          case "r2m":
            roofTile(g, p, "", true);
            break;
          case "r2r":
            roofTile(g, p, "r", true);
            break;
          case "r2s":
            roofTile(g, p, "", true);
            rect(g, 1, 1, 14, 12, p.wall[0]);
            rect(g, 1, 1, 14, 1, p.wall[2]);
            rect(g, 1, 12, 14, 1, p.wall[1]);
            icon(g, p.kind);
            break;
          case "wl":
            wallTile(g, p, true, false);
            break;
          case "wr":
            wallTile(g, p, true, false);
            break;
          case "wm":
            wallTile(g, p, false, false);
            break;
          case "door":
            wallTile(g, p, false, true);
            break;
          default:
            wallTile(g, p, false, false);
        }
      });
      T("wood", { blend: null }, (g, r) => {
        fillBase(g, "#c89a5c");
        for (let y = 0; y < 16; y += 4) rect(g, 0, y + 3, 16, 1, "#a87a40");
        for (let y = 0; y < 16; y += 4) rect(g, y / 4 * 5 % 16, y, 1, 3, "#a87a40");
        speck(g, r, 8, ["#d8aa6c", "#b88848"]);
      });
      T("carpet", {}, (g, r) => {
        fillBase(g, "#b8453f");
        rect(g, 0, 0, 16, 1, "#d86a60");
        rect(g, 0, 15, 16, 1, "#8a2e2a");
        speck(g, r, 10, ["#a83a36", "#c8554e"]);
      });
      T("floor", {}, (g) => {
        fillBase(g, "#e8eaf4");
        rect(g, 0, 0, 16, 1, "#c8cce0");
        rect(g, 0, 0, 1, 16, "#c8cce0");
        rect(g, 8, 8, 8, 8, "#dfe2f0");
        rect(g, 0, 0, 8, 8, "#dfe2f0");
      });
      T("floor2", {}, (g) => {
        fillBase(g, "#9aa0b8");
        rect(g, 0, 0, 16, 1, "#7c82a0");
        rect(g, 0, 0, 1, 16, "#7c82a0");
        rect(g, 8, 8, 8, 8, "#a8aec4");
        rect(g, 0, 0, 8, 8, "#a8aec4");
      });
      T("mat", {}, (g) => {
        fillBase(g, "#c89a5c");
        rect(g, 2, 3, 12, 10, "#d8453f");
        rect(g, 3, 4, 10, 8, "#ee6a5c");
        rect(g, 4, 5, 8, 1, "#ffd0c8");
      });
      T("wallint", { solid: true }, (g, r) => {
        fillBase(g, "#e8dcc0");
        rect(g, 0, 0, 16, 3, "#c0a878");
        rect(g, 0, 3, 16, 1, "#a89060");
        rect(g, 0, 12, 16, 4, "#d0bc92");
        rect(g, 0, 12, 16, 1, "#b8a070");
      });
      T("wallint2", { solid: true }, (g) => {
        fillBase(g, "#dfe6f6");
        rect(g, 0, 0, 16, 3, "#9aa8d0");
        rect(g, 0, 3, 16, 1, "#7c8ab8");
        rect(g, 0, 12, 16, 4, "#c4cee8");
        rect(g, 0, 12, 16, 1, "#a8b4d8");
      });
      T("wallint3", { solid: true }, (g, r) => {
        fillBase(g, "#4a4458");
        rect(g, 0, 0, 16, 3, "#2e2a3c");
        rect(g, 0, 3, 16, 1, "#6a647c");
        speck(g, r, 8, ["#3e384c", "#58526a"]);
      });
      T("table", { solid: true }, (g) => {
        rect(g, 1, 4, 14, 9, "#b88448");
        rect(g, 1, 4, 14, 2, "#dca868");
        rect(g, 1, 12, 14, 1, "#7d5528");
        rect(g, 2, 13, 2, 3, "#8a5e2c");
        rect(g, 12, 13, 2, 3, "#8a5e2c");
      });
      T("shelf", { solid: true }, (g) => {
        rect(g, 1, 0, 14, 16, "#9a6a3c");
        rect(g, 2, 1, 12, 14, "#5a3a1c");
        for (const y of [1, 6, 11]) rect(g, 2, y + 4, 12, 1, "#b88448");
        const cols = ["#d84a4a", "#4a7ad8", "#4aa85a", "#e0b83a", "#8a5ad0"];
        for (let s = 0; s < 3; s++) for (let i = 0; i < 5; i++) rect(g, 3 + i * 2 + (i > 2 ? 1 : 0), 2 + s * 5, 2, 4, cols[(i + s) % 5]);
      });
      T("bed", { solid: true }, (g) => {
        rect(g, 1, 1, 14, 14, "#8a5e2c");
        rect(g, 2, 2, 12, 12, "#f4f0f8");
        rect(g, 2, 2, 12, 4, "#8a9ae8");
        rect(g, 3, 3, 4, 2, "#fff");
        rect(g, 2, 8, 12, 6, "#6a82e0");
        rect(g, 2, 8, 12, 1, "#a8b8f8");
      });
      T("counter", { solid: true }, (g) => {
        rect(g, 0, 3, 16, 12, "#c8935a");
        rect(g, 0, 3, 16, 3, "#e8b878");
        rect(g, 0, 14, 16, 1, "#8a5e2c");
        rect(g, 0, 6, 16, 1, "#a87a40");
      });
      T("pc", { solid: true, kind: "pc", anim: 2 }, (g, r, v, f) => {
        rect(g, 2, 2, 12, 9, "#4a4a60");
        rect(g, 3, 3, 10, 6, f ? "#6adfa8" : "#4ac890");
        rect(g, 4, 4, 5, 1, "#c8ffe8");
        rect(g, 6, 11, 4, 2, "#4a4a60");
        rect(g, 2, 13, 12, 2, "#6a6a80");
      });
      T("healer", { solid: true, kind: "healer", anim: 2 }, (g, r, v, f) => {
        rect(g, 1, 4, 14, 11, "#e8ecf4");
        rect(g, 1, 4, 14, 2, "#fff");
        rect(g, 3, 6, 10, 5, "#4a4a60");
        const c = ["#ff6a8a", "#8aff9a", "#8ac8ff"];
        for (let i = 0; i < 3; i++) rect(g, 4 + i * 3, 7, 2, 3, (f + i) % 2 ? c[i] : lighten(c[i], 0.4));
        rect(g, 7, 1, 2, 3, "#e84a5a");
        rect(g, 6, 2, 4, 1, "#e84a5a");
      });
      T("plant", { solid: true }, (g) => {
        rect(g, 5, 10, 6, 5, "#a85a3c");
        rect(g, 5, 10, 6, 1, "#c8785a");
        for (const [x, y, rr] of [[8, 6, 4], [5, 8, 3], [11, 8, 3]]) for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rr * rr) px(g, xx, yy, "#3fa656");
        px(g, 7, 4, "#6ad87a");
        px(g, 4, 7, "#6ad87a");
      });
      T("rug", {}, (g) => {
        fillBase(g, "#c8935a");
        rect(g, 1, 1, 14, 14, "#6a82e0");
        rect(g, 2, 2, 12, 12, "#8aa0f0");
        rect(g, 4, 4, 8, 8, "#f2d060");
        rect(g, 5, 5, 6, 6, "#6a82e0");
      });
      T("tv", { solid: true }, (g) => {
        rect(g, 2, 3, 12, 9, "#3a3a4a");
        rect(g, 3, 4, 10, 6, "#5a9ae0");
        rect(g, 4, 5, 3, 1, "#c8e4ff");
        rect(g, 5, 12, 6, 2, "#3a3a4a");
      });
      T("chair", { solid: true }, (g) => {
        rect(g, 4, 2, 8, 6, "#b88448");
        rect(g, 4, 8, 8, 4, "#dca868");
        rect(g, 4, 12, 2, 3, "#8a5e2c");
        rect(g, 10, 12, 2, 3, "#8a5e2c");
      });
      T("cauldron", { solid: true, anim: 2 }, (g, r, v, f) => {
        rect(g, 2, 6, 12, 9, "#3a3a4a");
        rect(g, 1, 5, 14, 2, "#5a5a70");
        rect(g, 3, 5, 10, 2, f ? "#8aff6a" : "#6ae04a");
        px(g, 5, 3, "#c8ffa8");
        px(g, 10, f ? 2 : 3, "#c8ffa8");
        rect(g, 3, 15, 2, 1, "#2a2a38");
        rect(g, 11, 15, 2, 1, "#2a2a38");
      });
      T("bookcase", { solid: true }, (g) => {
        rect(g, 0, 0, 16, 16, "#6a4a2c");
        rect(g, 1, 1, 14, 14, "#3a2a18");
        for (const y of [1, 6, 11]) {
          rect(g, 1, y + 4, 14, 1, "#8a6a3c");
          const cols = ["#c84a4a", "#4a6ac8", "#4ab86a", "#d8b83a", "#8a5ac8", "#e0803a"];
          for (let i = 0; i < 6; i++) rect(g, 2 + i * 2 + (i > 3 ? 1 : 0), y + i % 3, 2, 4 - i % 3, cols[(i + y) % 6]);
        }
      });
      T("trophy", { solid: true }, (g) => {
        rect(g, 6, 11, 4, 4, "#a8861c");
        rect(g, 4, 13, 8, 2, "#8a6a10");
        rect(g, 5, 3, 6, 6, "#f2d060");
        rect(g, 7, 9, 2, 3, "#e0b83a");
        rect(g, 3, 4, 2, 3, "#f2d060");
        rect(g, 11, 4, 2, 3, "#f2d060");
        px(g, 6, 4, "#fff6c0");
      });
      T("banner", { solid: true }, (g) => {
        rect(g, 3, 0, 10, 13, "#c8453f");
        rect(g, 3, 0, 10, 1, "#8a2e2a");
        rect(g, 5, 3, 6, 6, "#f2d060");
        for (let i = 0; i < 3; i++) rect(g, 3 + i * 4, 13, 2, 2, "#c8453f");
      });
      T("window_int", { solid: true }, (g) => {
        fillBase(g, "#e8dcc0");
        rect(g, 0, 0, 16, 3, "#c0a878");
        rect(g, 3, 3, 10, 9, "#6a5a48");
        rect(g, 4, 4, 8, 7, "#9ad8f8");
        rect(g, 4, 4, 8, 2, "#cdeeff");
        rect(g, 7, 4, 1, 7, "#6a5a48");
        rect(g, 0, 12, 16, 4, "#d0bc92");
      });
      T("snowgrass", { enc: "nieve", anim: 2, blend: { prio: 6, color: "#cfdcf0" } }, (g, r, v, f) => {
        fillBase(g, "#e8f0fc");
        for (let i = 0; i < 6; i++) {
          const x = 1 + i % 3 * 5 + (f ? 1 : 0), y = 3 + Math.floor(i / 3) * 7;
          rect(g, x, y + 2, 1, 4, "#8fb0d8");
          rect(g, x + 1, y, 1, 6, "#a8c4e8");
          rect(g, x + 2, y + 2, 1, 4, "#8fb0d8");
          px(g, x + 1, y - 1, "#ffffff");
        }
      });
      T("bog", { blend: { prio: 6, color: "#5a7a4a" } }, (g, r) => {
        fillBase(g, "#6a8a56");
        speck(g, r, 16, ["#5a7a4a", "#7a9a64", "#4e6a3e"]);
        for (let i = 0; i < 3; i++) {
          const x = r.int(1, 12), y = r.int(1, 13);
          rect(g, x, y, 2, 1, "#c8d890");
        }
      });
      T("ash", { blend: { prio: 6, color: "#4a4444" } }, (g, r) => {
        fillBase(g, "#5a5252");
        speck(g, r, 20, ["#4a4444", "#6a6262", "#3a3434"]);
        for (let i = 0; i < 2; i++) px(g, r.int(0, 15), r.int(0, 15), "#c85a2a");
      });
      T("cinder", { enc: "volcan", anim: 2, blend: { prio: 6, color: "#3e3434" } }, (g, r, v, f) => {
        fillBase(g, "#443a3a");
        speck(g, r, 18, ["#2e2626", "#5a4a4a"]);
        for (const [x, y] of [[3, 4], [10, 9], [6, 12]]) {
          px(g, x, y, f ? "#ff8c2a" : "#d8431a");
          px(g, x + 1, y, "#a02a10");
        }
      });
      T("gravel", { blend: { prio: 5, color: "#9a968a" } }, (g, r) => {
        fillBase(g, "#a8a498");
        speck(g, r, 26, ["#8f8b80", "#bab6aa", "#7a766c"]);
      });
      T("marble", { blend: { prio: 6, color: "#e8e4f0" } }, (g, r) => {
        fillBase(g, "#eeeaf6");
        rect(g, 0, 0, 16, 1, "#d4d0e2");
        rect(g, 0, 0, 1, 16, "#d4d0e2");
        speck(g, r, 6, ["#dcd8ea", "#ffffff"]);
        px(g, 5, 8, "#c8c4dc");
        px(g, 6, 9, "#c8c4dc");
      });
      T("darkfloor", { blend: null }, (g, r) => {
        fillBase(g, "#3a3450");
        rect(g, 0, 0, 16, 1, "#2a2640");
        rect(g, 0, 0, 1, 16, "#2a2640");
        speck(g, r, 10, ["#464060", "#302a48"]);
      });
      T("arenafloor", { blend: { prio: 5, color: "#d8b872" } }, (g, r) => {
        fillBase(g, "#e0c080");
        speck(g, r, 22, ["#d0b070", "#ecd29a", "#c8a862"]);
        if (r.chance(0.3)) rect(g, r.int(0, 8), r.int(2, 13), 5, 1, "#c8a862");
      });
      T("pad", { anim: 2, kind: "pad" }, (g, r, v, f) => {
        fillBase(g, "#3a3450");
        rect(g, 1, 1, 14, 14, "#524a78");
        rect(g, 3, 3, 10, 10, f ? "#8a6aff" : "#a88aff");
        rect(g, 5, 5, 6, 6, f ? "#d0baff" : "#efe2ff");
        rect(g, 7, 7, 2, 2, "#ffffff");
      });
      T("metalfloor", {}, (g, r) => {
        fillBase(g, "#8a90a0");
        rect(g, 0, 0, 16, 1, "#6a7080");
        rect(g, 0, 0, 1, 16, "#6a7080");
        rect(g, 8, 8, 8, 8, "#949aaa");
        speck(g, r, 6, ["#a0a6b4", "#7a8090"]);
      });
      T("lightfloor", { anim: 2 }, (g, r, v, f) => {
        fillBase(g, "#f4eed0");
        rect(g, 0, 0, 16, 1, "#e0d8b0");
        rect(g, 0, 0, 1, 16, "#e0d8b0");
        rect(g, 5, 5, 6, 6, f ? "#fff2a0" : "#ffe27a");
      });
      T("hedge", { solid: true }, (g, r) => {
        fillBase(g, "#2e7a3c");
        speck(g, r, 40, ["#3fa656", "#256a32", "#58c470"]);
        rect(g, 0, 0, 16, 2, "#58c470");
        rect(g, 0, 14, 16, 2, "#1f5a2a");
      });
      T("iceblock", { solid: true }, (g, r) => {
        fillBase(g, "#a8dcf0");
        rect(g, 1, 1, 14, 14, "#c8f0ff");
        rect(g, 2, 2, 5, 3, "#ffffff");
        rect(g, 1, 13, 14, 2, "#7ab8d8");
        rect(g, 13, 1, 2, 14, "#7ab8d8");
      });
      T("barrier_e", { solid: true, anim: 2 }, (g, r, v, f) => {
        rect(g, 0, 3, 16, 10, "rgba(0,0,0,0)");
        rect(g, 1, 0, 3, 16, "#5a5a70");
        rect(g, 12, 0, 3, 16, "#5a5a70");
        for (let i = 0; i < 4; i++) rect(g, 4, 2 + i * 3, 8, 1, (i + f) % 2 ? "#fff08a" : "#ffd830");
      });
      T("gate_iron", { solid: true }, (g) => {
        rect(g, 0, 2, 16, 12, "#4a4a60");
        for (let x = 1; x < 16; x += 3) rect(g, x, 0, 2, 16, "#7a7a98");
        rect(g, 0, 7, 16, 2, "#9a9ab8");
      });
      T("switch_off", { solid: true }, (g) => {
        rect(g, 3, 4, 10, 10, "#4a4a60");
        rect(g, 4, 5, 8, 8, "#8a2e2a");
        rect(g, 6, 6, 4, 4, "#d84a4a");
      });
      T("switch_on", { solid: true }, (g) => {
        rect(g, 3, 4, 10, 10, "#4a4a60");
        rect(g, 4, 5, 8, 8, "#2e8a4a");
        rect(g, 6, 6, 4, 4, "#5ae08a");
      });
      T("console", { solid: true, anim: 2 }, (g, r, v, f) => {
        rect(g, 1, 3, 14, 12, "#3a3a52");
        rect(g, 2, 4, 12, 6, "#1a1a2e");
        for (let i = 0; i < 5; i++) rect(g, 3 + i * 2, 5 + (i + f) % 3, 1, 2, ["#5ae08a", "#ffd24a", "#ff6a7a"][i % 3]);
        for (let i = 0; i < 4; i++) rect(g, 3 + i * 3, 12, 2, 2, "#6a6a88");
      });
      T("dragonstatue", { solid: true }, (g) => {
        rect(g, 3, 12, 10, 4, "#8f8aa0");
        rect(g, 5, 5, 6, 8, "#b4afc8");
        rect(g, 4, 2, 4, 4, "#cfcae0");
        rect(g, 8, 3, 4, 2, "#cfcae0");
        px(g, 5, 3, "#5a5470");
        rect(g, 2, 6, 3, 5, "#a8a3be");
        rect(g, 11, 6, 3, 5, "#a8a3be");
      });
      T("lavarock", { solid: true }, (g, r) => {
        for (const [x, y, rr, c] of [[8, 9, 6.5, "#3a2a2a"], [7, 8, 5.4, "#5a3e3a"]]) for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rr * rr) px(g, xx, yy, c);
        px(g, 6, 7, "#ff8c2a");
        px(g, 10, 10, "#d8431a");
      });
      T("seat", { solid: true }, (g, r) => {
        rect(g, 0, 4, 16, 12, "#8a3a3a");
        for (let x = 0; x < 16; x += 4) rect(g, x, 4, 1, 12, "#6a2a2a");
        rect(g, 0, 4, 16, 2, "#b85a5a");
      });
      T("tent", { solid: true }, (g) => {
        for (let y = 1; y < 15; y++) {
          const w = Math.round(y / 14 * 7) + 1;
          rect(g, 8 - w, y, w * 2, 1, y % 2 ? "#e8c06a" : "#d8a848");
        }
        rect(g, 6, 9, 4, 6, "#5a3a1c");
      });
      T("bonfire", { solid: true, anim: 2 }, (g, r, v, f) => {
        rect(g, 3, 12, 10, 3, "#5a3a1c");
        rect(g, 6, 6, 4, 6, f ? "#ff6a1f" : "#ff8c2a");
        rect(g, 7, 4, 2, 4, "#ffd24a");
      });
      T("rocktable", { solid: true }, (g) => {
        rect(g, 1, 6, 14, 6, "#8a857a");
        rect(g, 1, 6, 14, 2, "#aaa598");
        rect(g, 2, 12, 3, 3, "#6a665c");
        rect(g, 11, 12, 3, 3, "#6a665c");
      });
      T("altar", { solid: true, anim: 2 }, (g, r, v, f) => {
        rect(g, 2, 8, 12, 7, "#a8a3be");
        rect(g, 3, 6, 10, 3, "#cfcae0");
        rect(g, 6, 2, 4, 4, f ? "#fff2a0" : "#ffd870");
        rect(g, 7, 3, 2, 2, "#ffffff");
      });
      T("boat", { solid: true }, (g) => {
        rect(g, 1, 9, 14, 5, "#8a5a30");
        rect(g, 3, 13, 10, 2, "#6a4220");
        rect(g, 7, 1, 1, 9, "#d8c8a0");
        rect(g, 8, 2, 5, 6, "#f4f0e8");
      });
      T("lighthouse", { solid: true }, (g) => {
        rect(g, 4, 3, 8, 13, "#f4f0e8");
        for (const y of [5, 9, 13]) rect(g, 4, y, 8, 2, "#d84a4a");
        rect(g, 3, 1, 10, 3, "#4a4a60");
        rect(g, 6, 2, 4, 2, "#ffe27a");
      });
    }
  });

  // src/world.js
  var world_exports = {};
  __export(world_exports, {
    MAP_DEFS: () => MAP_DEFS,
    MapBuilder: () => MapBuilder,
    clearMapCache: () => clearMapCache,
    defineMap: () => defineMap,
    dirVec: () => dirVec,
    getMap: () => getMap,
    groundProps: () => groundProps,
    inBounds: () => inBounds,
    isWaterTile: () => isWaterTile,
    mapExists: () => mapExists,
    mapIdx: () => mapIdx,
    objProps: () => objProps,
    reachable: () => reachable,
    terrainSolid: () => terrainSolid,
    tid: () => tid,
    tkey: () => tkey,
    tprops: () => tprops
  });
  function tid(key) {
    if (!key) return 0;
    let id = keyToId.get(key);
    if (!id) {
      id = idToKey.length;
      idToKey.push(key);
      keyToId.set(key, id);
      propsById.push(tileProps(key));
    }
    return id;
  }
  function defineMap(id, w, h, opts, fn) {
    MAP_DEFS[id] = { id, w, h, opts, fn };
  }
  function getMap(id) {
    let m = BUILT.get(id);
    if (!m) {
      const d = MAP_DEFS[id];
      if (!d) throw new Error("Mapa no definido: " + id);
      const b = new MapBuilder(d.id, d.w, d.h, d.opts);
      d.fn(b);
      m = b.finish();
      BUILT.set(id, m);
    }
    return m;
  }
  function groundProps(m, x, y) {
    return inBounds(m, x, y) ? tprops(m.ground[mapIdx(m, x, y)]) : {};
  }
  function objProps(m, x, y) {
    return inBounds(m, x, y) ? tprops(m.obj[mapIdx(m, x, y)]) : {};
  }
  function terrainSolid(m, x, y) {
    if (!inBounds(m, x, y)) return true;
    const gp = groundProps(m, x, y), op = objProps(m, x, y);
    return !!(gp.solid || op.solid);
  }
  function reachable(m, sx, sy, abilities = {}) {
    const seen = /* @__PURE__ */ new Set([sx + "," + sy]);
    const q2 = [[sx, sy]];
    const blockedByEntity = new Set(m.entities.filter((e) => e.solid && !e.free && e.kind !== "item").map((e) => e.x + "," + e.y));
    while (q2.length) {
      const [x, y] = q2.shift();
      for (const [dx, dy] of Object.values(dirVec)) {
        const nx = x + dx, ny = y + dy, k = nx + "," + ny;
        if (seen.has(k) || !inBounds(m, nx, ny)) continue;
        const gp = groundProps(m, nx, ny), op = objProps(m, nx, ny);
        let solid = !!(gp.solid || op.solid);
        if (op.cut && abilities.cut) solid = false;
        if (op.climb || gp.climb) solid = !abilities.climb;
        if (gp.water && !op.solid && !abilities.water) solid = true;
        if (solid || blockedByEntity.has(k)) continue;
        seen.add(k);
        if (!m.warps.has(k)) q2.push([nx, ny]);
      }
    }
    return seen;
  }
  var keyToId, idToKey, propsById, tkey, tprops, MAP_DEFS, BUILT, mapExists, clearMapCache, MapBuilder, mapIdx, inBounds, isWaterTile, dirVec;
  var init_world = __esm({
    "src/world.js"() {
      init_tiles();
      init_rng();
      keyToId = /* @__PURE__ */ new Map();
      idToKey = [""];
      propsById = [{}];
      tkey = (id) => idToKey[id] || "";
      tprops = (id) => propsById[id] || {};
      MAP_DEFS = {};
      BUILT = /* @__PURE__ */ new Map();
      mapExists = (id) => !!MAP_DEFS[id];
      clearMapCache = () => BUILT.clear();
      MapBuilder = class {
        constructor(id, w, h, opts = {}) {
          this.id = id;
          this.w = w;
          this.h = h;
          this.opts = opts;
          this.ground = new Uint16Array(w * h);
          this.obj = new Uint16Array(w * h);
          this.topL = new Uint16Array(w * h);
          this.entities = [];
          this.warps = /* @__PURE__ */ new Map();
          this.connections = {};
          this.spawns = {};
          this.triggers = [];
          this.rng = new RNG(hashStr(id) ^ 1540483477);
          this.enc = opts.encounters || null;
          this.buildings = [];
          if (opts.fill) this.fill(opts.fill);
        }
        idx(x, y) {
          return y * this.w + x;
        }
        inb(x, y) {
          return x >= 0 && y >= 0 && x < this.w && y < this.h;
        }
        // ---------- terreno ----------
        fill(key) {
          this.ground.fill(tid(key));
          return this;
        }
        set(x, y, key) {
          if (this.inb(x, y)) this.ground[this.idx(x, y)] = tid(key);
          return this;
        }
        rect(x, y, w, h, key) {
          for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, key);
          return this;
        }
        get(x, y) {
          return this.inb(x, y) ? tkey(this.ground[this.idx(x, y)]) : "";
        }
        obj(x, y, key) {
          if (this.inb(x, y)) this.obj_[this.idx(x, y)] = 0;
          return this;
        }
        put(x, y, key) {
          if (this.inb(x, y)) this.obj[this.idx(x, y)] = tid(key);
          return this;
        }
        topPut(x, y, key) {
          if (this.inb(x, y)) this.topL[this.idx(x, y)] = tid(key);
          return this;
        }
        getObj(x, y) {
          return this.inb(x, y) ? tkey(this.obj[this.idx(x, y)]) : "";
        }
        clear(x, y) {
          if (this.inb(x, y)) this.obj[this.idx(x, y)] = 0;
          return this;
        }
        clearRect(x, y, w, h) {
          for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.clear(i, j);
          return this;
        }
        putRect(x, y, w, h, key) {
          for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.put(i, j, key);
          return this;
        }
        hline(x, y, len, key, layer = "ground") {
          for (let i = 0; i < len; i++) layer === "ground" ? this.set(x + i, y, key) : this.put(x + i, y, key);
          return this;
        }
        vline(x, y, len, key, layer = "ground") {
          for (let i = 0; i < len; i++) layer === "ground" ? this.set(x, y + i, key) : this.put(x, y + i, key);
          return this;
        }
        /** Parche orgánico elíptico de terreno */
        blob(cx, cy, rx, ry, key, { rough = 0.25, layer = "ground", only = null } = {}) {
          for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
            if (!this.inb(x, y)) continue;
            const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
            if (d <= 1 - rough * (this.rng.next() * 0.9)) {
              if (only && !only.includes(this.get(x, y))) continue;
              layer === "ground" ? this.set(x, y, key) : this.put(x, y, key);
            }
          }
          return this;
        }
        /** Camino poligonal con grosor. */
        path(points, key = "path", width = 1) {
          for (let i = 0; i < points.length - 1; i++) {
            let [x, y] = points[i];
            const [tx, ty] = points[i + 1];
            const stamp = (px2, py) => {
              for (let a = 0; a < width; a++) for (let b = 0; b < width; b++) {
                this.set(px2 + a, py + b, key);
                if (this.getObj(px2 + a, py + b) && !/^(bldg|sign)/.test(this.getObj(px2 + a, py + b))) this.clear(px2 + a, py + b);
              }
            };
            while (x !== tx || y !== ty) {
              stamp(x, y);
              if (x !== tx) x += Math.sign(tx - x);
              else y += Math.sign(ty - y);
            }
            stamp(tx, ty);
          }
          return this;
        }
        /** Árbol de 2 tiles: base en (x,y), copa en (x,y-1). kind: oak|pine|snowpine|palm|dead|swamptree|autumn */
        tree(x, y, kind = "oak") {
          const k = kind === "oak" ? "tree" : kind;
          if (!this.inb(x, y) || !this.inb(x, y - 1)) return this;
          this.put(x, y - 1, k + "_t");
          this.put(x, y, k + "_b");
          return this;
        }
        /** Rellena un rectángulo con árboles espaciados (densidad 0-1). */
        forest(x, y, w, h, kind = "oak", density = 0.7, { avoid = [], on = null } = {}) {
          for (let j = y + 1; j < y + h; j += 2) for (let i = x; i < x + w; i++) {
            if (this.rng.next() > density) continue;
            if (this.getObj(i, j) || this.getObj(i, j - 1)) continue;
            if (on && (!on.includes(this.get(i, j)) || !on.includes(this.get(i, j - 1)))) continue;
            if (this.entityAt(i, j) || this.warps.has(i + "," + j)) continue;
            if (avoid.some(([ax, ay, aw, ah]) => i >= ax && i < ax + aw && j >= ay && j < ay + ah + 1)) continue;
            this.tree(i, j, kind);
          }
          return this;
        }
        /** Borde de árboles/rocas en el perímetro, dejando huecos para conexiones. */
        frame(kind = "oak", thickness = 2, gaps = []) {
          const inGap = (x, y) => gaps.some(([gx, gy, gw, gh]) => x >= gx && x < gx + gw && y >= gy && y < gy + gh);
          for (let j = 1; j < this.h; j += 2) for (let i = 0; i < this.w; i++) {
            const edge = i < thickness || i >= this.w - thickness || j <= thickness || j >= this.h - thickness;
            if (!edge || inGap(i, j) || inGap(i, j - 1)) continue;
            this.tree(i, j, kind);
          }
          return this;
        }
        /** Ruido de objetos sobre ciertos terrenos. */
        scatter(key, n, { rect: rect2 = null, on = null, layer = "obj", avoidNear = 0, tries = 40 } = {}) {
          const [rx, ry, rw, rh] = rect2 || [0, 0, this.w, this.h];
          let placed = 0;
          for (let t = 0; t < n * tries && placed < n; t++) {
            const x = this.rng.int(rx, rx + rw - 1), y = this.rng.int(ry, ry + rh - 1);
            if (this.getObj(x, y)) continue;
            if (on && !on.includes(this.get(x, y))) continue;
            if (this.entityAt(x, y) || this.warps.has(x + "," + y)) continue;
            if (layer === "obj") this.put(x, y, key);
            else this.set(x, y, key);
            placed++;
          }
          return this;
        }
        fenceRect(x, y, w, h, gaps = []) {
          const gap = (i, j) => gaps.some(([gx, gy]) => gx === i && gy === j);
          for (let i = x; i < x + w; i++) {
            if (!gap(i, y)) this.put(i, y, "fence_h");
            if (!gap(i, y + h - 1)) this.put(i, y + h - 1, "fence_h");
          }
          for (let j = y + 1; j < y + h - 1; j++) {
            if (!gap(x, j)) this.put(x, j, "fence_v");
            if (!gap(x + w - 1, j)) this.put(x + w - 1, j, "fence_v");
          }
          return this;
        }
        /**
         * Edificio w×h (mín. 3×3). o: {kind, roof, wall, to, tx, ty, name, doorX}
         * La puerta está en la fila inferior; devuelve {doorX, doorY}.
         */
        building(x, y, w, h, o = {}) {
          const kind = o.kind || "house", roof = o.roof || "red", wall = o.wall || "cream";
          const base = `${kind}_${roof}_${wall}`;
          const doorX = x + (o.doorX ?? Math.floor((w - 1) / 2)), doorY = y + h - 1;
          for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            const edge = i === 0 ? "l" : i === w - 1 ? "r" : "m";
            let part;
            if (j < h - 2) part = "r" + edge;
            else if (j === h - 2) part = o.sign !== false && edge === "m" && x + i === doorX ? "r2s" : "r2" + edge;
            else part = x + i === doorX ? "door" : edge === "m" ? "wm" : "wl";
            if (j === h - 1 && part === "wm" && i % 2 === 1) part = "wl";
            this.put(x + i, y + j, `bldg:${base}_${part}`);
          }
          if (this.inb(doorX, doorY + 1) && !this.getObj(doorX, doorY + 1)) {
            if (!/^(path|cobble|sand|beach|dune|snow|ruinfloor)/.test(this.get(doorX, doorY + 1))) this.set(doorX, doorY + 1, o.step || "path");
          }
          if (o.to) this.warp(doorX, doorY, o.to, o.tx ?? 0, o.ty ?? 0, "up", { door: true, sfx: "door" });
          if (o.key) this.spawn("door_" + o.key, doorX, doorY + 1, "down");
          this.buildings.push({ x, y, w, h, doorX, doorY, kind, name: o.name || null });
          return { doorX, doorY };
        }
        // ---------- conexiones y warps ----------
        warp(x, y, to, tx, ty, dir = "down", opts = {}) {
          this.warps.set(x + "," + y, { x, y, to, tx, ty, dir, ...opts });
          return this;
        }
        connect(side, mapId, { offset = 0, rng = null } = {}) {
          this.connections[side] = { map: mapId, offset, range: rng };
          return this;
        }
        spawn(name, x, y, dir = "down") {
          this.spawns[name] = { x, y, dir };
          return this;
        }
        // ---------- entidades ----------
        entityAt(x, y) {
          return this.entities.find((e) => e.x === x && e.y === y && !e.free);
        }
        /** Objeto interactuable sobre una casilla (tile sólido + texto o guion) */
        object(x, y, tile, def = {}) {
          if (tile) this.put(x, y, tile);
          this.entities.push({ kind: "object", x, y, solid: true, free: true, ...def });
          return this;
        }
        npc(def) {
          this.entities.push({ kind: "npc", solid: true, dir: "down", ...def });
          return this;
        }
        /** Obstáculo dinámico (puerta, barrera, interruptor): se dibuja con un tile y desaparece cuando show() es falso */
        gate(x, y, tile, def = {}) {
          this.entities.push({ kind: "gate", x, y, tile, solid: true, ...def });
          return this;
        }
        trainer(def) {
          this.entities.push({ kind: "trainer", solid: true, dir: "down", sight: 4, ...def });
          return this;
        }
        sign(x, y, text, { name = "Cartel" } = {}) {
          this.put(x, y, "sign");
          this.entities.push({ kind: "sign", x, y, solid: true, free: true, name, text });
          return this;
        }
        item(x, y, item, { n = 1, key = null, hidden = false, show = null } = {}) {
          this.entities.push({ kind: "item", x, y, solid: false, item, n, key: key || `${this.id}:${x},${y}`, hidden, show });
          return this;
        }
        hidden(x, y, item, opts = {}) {
          return this.item(x, y, item, { ...opts, hidden: true });
        }
        /** Disparador invisible al pisar la casilla */
        trigger(x, y, fn, { once = false, key = null, show = null, w = 1, h = 1 } = {}) {
          this.triggers.push({ x, y, w, h, fn, once, key: key || `${this.id}:trig:${x},${y}`, show });
          return this;
        }
        encounters(spec) {
          this.enc = spec;
          return this;
        }
        // ---------- final ----------
        finish() {
          const o = this.opts;
          const map = {
            id: this.id,
            name: o.name || this.id,
            w: this.w,
            h: this.h,
            region: o.region || null,
            music: o.music || "route",
            indoor: !!o.indoor,
            dark: !!o.dark,
            zone: o.zone || null,
            tags: o.tags || [],
            weather: o.weather !== void 0 ? o.weather : !o.indoor,
            climate: o.climate || "templado",
            cave: !!o.cave,
            ground: this.ground,
            obj: this.obj,
            top: this.topL,
            entities: this.entities,
            warps: this.warps,
            connections: this.connections,
            spawns: this.spawns,
            triggers: this.triggers,
            enc: this.enc,
            buildings: this.buildings,
            fly: o.fly || null,
            title: o.title || o.name || this.id,
            level: o.level || null,
            ownerHooks: o.hooks || null,
            onEnter: o.onEnter || null,
            bg: o.bg || null
          };
          return map;
        }
      };
      mapIdx = (m, x, y) => y * m.w + x;
      inBounds = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
      isWaterTile = (m, x, y) => !!groundProps(m, x, y).water && !m.obj[mapIdx(m, x, y)];
      dirVec = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    }
  });

  // src/config.js
  var GAME, TILE, SCALE, VIEW_W, VIEW_H, MAX_LEVEL, PARTY_MAX, BOX_COUNT, BOX_SIZE, MAX_MOVES, MONEY_MAX;
  var init_config = __esm({
    "src/config.js"() {
      GAME = {
        name: "Aurelia Ultimate",
        subtitle: "Aventura de Criaturas",
        region: "Aurelia",
        version: "0.1.0",
        saveVersion: 1,
        slots: 3,
        storagePrefix: "aurelia-ultimate"
      };
      TILE = 16;
      SCALE = 3;
      VIEW_W = 960;
      VIEW_H = 540;
      MAX_LEVEL = 100;
      PARTY_MAX = 6;
      BOX_COUNT = 12;
      BOX_SIZE = 30;
      MAX_MOVES = 4;
      MONEY_MAX = 999999;
    }
  });

  // src/maprender.js
  var maprender_exports = {};
  __export(maprender_exports, {
    drawGroundLayers: () => drawGroundLayers,
    drawObjectLayers: () => drawObjectLayers,
    drawTopLayer: () => drawTopLayer,
    getMapRender: () => getMapRender,
    invalidateMapRender: () => invalidateMapRender
  });
  function edgeStrip(g, ox, oy, side, color, seedKey, maxDepth = 3) {
    const r = new RNG(hashStr(seedKey));
    let d = r.int(1, maxDepth);
    g.fillStyle = color;
    for (let i = 0; i < T16; i++) {
      d = Math.max(1, Math.min(maxDepth, d + r.pick([-1, 0, 0, 1])));
      if (side === "n") g.fillRect(ox + i, oy, 1, d);
      else if (side === "s") g.fillRect(ox + i, oy + T16 - d, 1, d);
      else if (side === "w") g.fillRect(ox, oy + i, d, 1);
      else g.fillRect(ox + T16 - d, oy + i, d, 1);
    }
  }
  function getMapRender(map) {
    let mr = cache4.get(map.id);
    if (mr) return mr;
    if (cache4.size > 5) cache4.delete(cache4.keys().next().value);
    mr = buildMapRender(map);
    cache4.set(map.id, mr);
    return mr;
  }
  function invalidateMapRender(id) {
    cache4.delete(id);
  }
  function buildMapRender(map) {
    const W = map.w * T16, H = map.h * T16;
    const groundC = mkCanvas(W, H), shoreC = mkCanvas(W, H), objC = mkCanvas(W, H), topC = mkCanvas(W, H);
    const gg = groundC.getContext("2d"), gs = shoreC.getContext("2d"), go = objC.getContext("2d"), gt = topC.getContext("2d");
    const animGround = [], animObj = [];
    const at = (x, y) => x < 0 || y < 0 || x >= map.w || y >= map.h ? 0 : map.ground[y * map.w + x];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const i = y * map.w + x;
      const gid = map.ground[i];
      if (gid) {
        const key = tkey(gid), pr = tprops(gid);
        let k = key;
        if (key === "grass") k = "grass:" + ((x * 7 + y * 13) % 11 === 0 ? "1" : "0");
        gg.drawImage(tileCanvas(k, 0), x * T16, y * T16);
        if (pr.anim) animGround.push({ x, y, key, frames: pr.anim });
      }
      const oid = map.obj[i];
      if (oid) {
        const key = tkey(oid), pr = tprops(oid);
        if (pr.anim) animObj.push({ x, y, key, frames: pr.anim });
        else go.drawImage(tileCanvas(key, 0), x * T16, y * T16);
      }
      const tid_ = map.top[i];
      if (tid_) gt.drawImage(tileCanvas(tkey(tid_), 0), x * T16, y * T16);
    }
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const gid = map.ground[y * map.w + x];
      if (!gid) continue;
      const mp = tprops(gid);
      const myPrio = mp.blend ? mp.blend.prio : mp.water ? 0 : mp.solid ? 99 : 1;
      for (const [side, dx, dy] of SIDES) {
        const nid = at(x + dx, y + dy);
        if (!nid || nid === gid) continue;
        const np = tprops(nid);
        if (mp.water) {
          if (!np.water && !np.solid) {
            if (np.blend) edgeStrip(gs, x * T16, y * T16, side, np.blend.color, `${x},${y},${side}`);
            const foam = "rgba(255,255,255,.75)";
            const fx = x * T16, fy = y * T16;
            gs.fillStyle = foam;
            const d = np.blend ? 4 : 1;
            if (side === "n") gs.fillRect(fx, fy + d, T16, 1);
            else if (side === "s") gs.fillRect(fx, fy + T16 - d - 1, T16, 1);
            else if (side === "w") gs.fillRect(fx + d, fy, 1, T16);
            else gs.fillRect(fx + T16 - d - 1, fy, 1, T16);
          }
        } else if (np.blend && np.blend.prio > myPrio && !np.water && !np.solid) {
          edgeStrip(gg, x * T16, y * T16, side, np.blend.color, `${x},${y},${side}`);
        }
      }
    }
    return { groundC, shoreC, objC, topC, animGround, animObj, W, H };
  }
  function blitLayer(ctx, c, camX, camY, vw, vh) {
    const sx = Math.max(0, camX), sy = Math.max(0, camY);
    const dx = (sx - camX) * SCALE, dy = (sy - camY) * SCALE;
    const sw = Math.min(c.width - sx, vw / SCALE - (sx - camX)), sh = Math.min(c.height - sy, vh / SCALE - (sy - camY));
    if (sw > 0 && sh > 0) ctx.drawImage(c, sx, sy, Math.ceil(sw), Math.ceil(sh), dx, dy, Math.ceil(sw) * SCALE, Math.ceil(sh) * SCALE);
  }
  function drawAnim(ctx, list, camX, camY, vw, vh, t) {
    for (const a of list) {
      const px2 = a.x * T16 - camX, py = a.y * T16 - camY;
      if (px2 < -T16 || py < -T16 || px2 > vw / SCALE || py > vh / SCALE) continue;
      ctx.drawImage(tileCanvas(a.key, frameOf(t, a.frames)), px2 * SCALE, py * SCALE, T16 * SCALE, T16 * SCALE);
    }
  }
  function drawGroundLayers(ctx, mr, camX, camY, vw, vh, t) {
    ctx.imageSmoothingEnabled = false;
    blitLayer(ctx, mr.groundC, camX, camY, vw, vh);
    drawAnim(ctx, mr.animGround, camX, camY, vw, vh, t);
    blitLayer(ctx, mr.shoreC, camX, camY, vw, vh);
  }
  function drawObjectLayers(ctx, mr, camX, camY, vw, vh, t) {
    ctx.imageSmoothingEnabled = false;
    blitLayer(ctx, mr.objC, camX, camY, vw, vh);
    drawAnim(ctx, mr.animObj, camX, camY, vw, vh, t);
  }
  function drawTopLayer(ctx, mr, camX, camY, vw, vh) {
    ctx.imageSmoothingEnabled = false;
    blitLayer(ctx, mr.topC, camX, camY, vw, vh);
  }
  var mkCanvas, cache4, SIDES, frameOf;
  var init_maprender = __esm({
    "src/maprender.js"() {
      init_world();
      init_tiles();
      init_rng();
      init_config();
      mkCanvas = (w, h) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        return c;
      };
      cache4 = /* @__PURE__ */ new Map();
      SIDES = [["n", 0, -1], ["s", 0, 1], ["w", -1, 0], ["e", 1, 0]];
      frameOf = (t, frames) => Math.floor(t * (frames >= 4 ? 4 : 2)) % frames;
    }
  });

  // src/maps/alba.js
  init_world();

  // src/maps/looks.js
  var L = (o) => ({ skin: 1, hair: "short", hairColor: 1, outfit: "tshirt", top: 0, bottom: 0, shoes: "#3a2a22", hat: "none", hatColor: 0, glasses: false, scarf: null, bag: null, ...o });
  var LOOKS = {
    tia: L({ skin: 1, hair: "bun", hairColor: 2, outfit: "dress", top: 4, bottom: 5 }),
    sauce: L({ skin: 2, hair: "short", hairColor: 4, outfit: "coat", top: 7, bottom: 1, glasses: true }),
    ayudante: L({ skin: 0, hair: "ponytail", hairColor: 3, outfit: "jacket", top: 6, bottom: 1 }),
    kai: L({ skin: 3, hair: "spiky", hairColor: 0, outfit: "hoodie", top: 3, bottom: 1, hat: "goggles", hatColor: 7, bag: 1 }),
    nino: L({ skin: 1, hair: "short", hairColor: 3, outfit: "tshirt", top: 1, bottom: 2, hat: "cap", hatColor: 0 }),
    nina: L({ skin: 0, hair: "ponytail", hairColor: 5, outfit: "overalls", top: 3, bottom: 6, hat: "ribbon", hatColor: 9 }),
    abuelo: L({ skin: 2, hair: "bald", hairColor: 4, outfit: "coat", top: 8, bottom: 7, glasses: true }),
    abuela: L({ skin: 1, hair: "bun", hairColor: 4, outfit: "dress", top: 9, bottom: 5, scarf: 8 }),
    tendero: L({ skin: 4, hair: "short", hairColor: 0, outfit: "overalls", top: 7, bottom: 3, hat: "cap", hatColor: 1 }),
    enfermera: L({ skin: 0, hair: "bob", hairColor: 5, outfit: "dress", top: 9, bottom: 5, hat: "headband", hatColor: 9 }),
    excursionista: L({ skin: 2, hair: "short", hairColor: 1, outfit: "jacket", top: 5, bottom: 2, hat: "hat", hatColor: 3, bag: 3 }),
    marinero: L({ skin: 3, hair: "short", hairColor: 0, outfit: "tshirt", top: 7, bottom: 0, hat: "cap", hatColor: 1, scarf: 1 }),
    pescador: L({ skin: 2, hair: "curly", hairColor: 4, outfit: "overalls", top: 6, bottom: 2, hat: "hat", hatColor: 3 }),
    cientifico: L({ skin: 1, hair: "spiky", hairColor: 8, outfit: "coat", top: 7, bottom: 1, glasses: true }),
    nadador: L({ skin: 3, hair: "short", hairColor: 0, outfit: "tshirt", top: 1, bottom: 0 }),
    karateka: L({ skin: 2, hair: "mohawk", hairColor: 0, outfit: "jacket", top: 7, bottom: 7, hat: "headband", hatColor: 0 }),
    minero: L({ skin: 4, hair: "short", hairColor: 0, outfit: "overalls", top: 3, bottom: 2, hat: "hat", hatColor: 3 }),
    bruja: L({ skin: 0, hair: "long", hairColor: 9, outfit: "dress", top: 4, bottom: 8, hat: "hat", hatColor: 4 }),
    esquiador: L({ skin: 0, hair: "short", hairColor: 3, outfit: "hoodie", top: 1, bottom: 0, hat: "beanie", hatColor: 0, scarf: 0 }),
    domador: L({ skin: 5, hair: "curly", hairColor: 0, outfit: "jacket", top: 1, bottom: 2, hat: "goggles", hatColor: 6 }),
    jugador_extra: L({ skin: 2, hair: "bob", hairColor: 8, outfit: "tshirt", top: 5, bottom: 0 }),
    // Orden del Eclipse
    recluta: L({ skin: 1, hair: "short", hairColor: 8, outfit: "uniform", top: 8, bottom: 8, hat: "beanie", hatColor: 4, shoes: "#1a1226" }),
    recluta2: L({ skin: 2, hair: "ponytail", hairColor: 8, outfit: "uniform", top: 8, bottom: 8, hat: "beanie", hatColor: 4, shoes: "#1a1226" }),
    teniente: L({ skin: 0, hair: "long", hairColor: 5, outfit: "coat", top: 8, bottom: 8, hat: "none", shoes: "#1a1226", scarf: 4 }),
    teniente2: L({ skin: 4, hair: "mohawk", hairColor: 0, outfit: "coat", top: 8, bottom: 8, hat: "none", shoes: "#1a1226", scarf: 0 }),
    vesper: L({ skin: 1, hair: "long", hairColor: 4, outfit: "coat", top: 8, bottom: 8, hat: "none", shoes: "#1a1226", scarf: 4, glasses: true }),
    // líderes y élite
    fresia: L({ skin: 0, hair: "long", hairColor: 8, outfit: "dress", top: 2, bottom: 5, hat: "ribbon", hatColor: 3 }),
    marlo: L({ skin: 3, hair: "short", hairColor: 0, outfit: "tshirt", top: 1, bottom: 0, hat: "cap", hatColor: 1, scarf: 7 }),
    volta: L({ skin: 4, hair: "spiky", hairColor: 3, outfit: "jacket", top: 3, bottom: 1, hat: "goggles", hatColor: 3 }),
    petra: L({ skin: 2, hair: "bob", hairColor: 1, outfit: "overalls", top: 5, bottom: 2, hat: "hat", hatColor: 3 }),
    ignacio: L({ skin: 2, hair: "spiky", hairColor: 5, outfit: "jacket", top: 0, bottom: 1, scarf: 5 }),
    morgana: L({ skin: 0, hair: "long", hairColor: 9, outfit: "dress", top: 4, bottom: 8, hat: "hat", hatColor: 4 }),
    boreal: L({ skin: 0, hair: "curly", hairColor: 4, outfit: "coat", top: 7, bottom: 0, scarf: 1 }),
    draconia: L({ skin: 1, hair: "ponytail", hairColor: 6, outfit: "coat", top: 4, bottom: 8, hat: "none", glasses: false }),
    elite1: L({ skin: 5, hair: "mohawk", hairColor: 0, outfit: "hoodie", top: 8, bottom: 8, scarf: 0 }),
    elite2: L({ skin: 2, hair: "short", hairColor: 3, outfit: "jacket", top: 8, bottom: 7 }),
    elite3: L({ skin: 0, hair: "bob", hairColor: 9, outfit: "dress", top: 9, bottom: 8, hat: "ribbon", hatColor: 9 }),
    elite4: L({ skin: 3, hair: "spiky", hairColor: 8, outfit: "tshirt", top: 4, bottom: 3, hat: "headband", hatColor: 3 }),
    campeon: L({ skin: 2, hair: "long", hairColor: 3, outfit: "coat", top: 3, bottom: 8, hat: "crown", scarf: 0 })
  };
  var look = (name, over = {}) => ({ ...LOOKS[name] || LOOKS.nino, ...over });

  // src/maps/helpers.js
  init_world();

  // src/data/moves.js
  var MOVES = {};
  var MOVES_BY_TYPE = {};
  function M(id, name, type, cat, pow, acc, pp, fx = {}, pri = 0, desc = "") {
    const m = { id, name, type, cat, pow, acc, pp, fx, pri, desc };
    MOVES[id] = m;
    (MOVES_BY_TYPE[type] || (MOVES_BY_TYPE[type] = [])).push(m);
    return m;
  }
  var S = (who, stat, n, p = 100) => [who, stat, n, p];
  M("ascua", "Ascua", "fuego", "esp", 40, 100, 25, { st: ["quemado", 10] }, 0, "Una peque\xF1a lluvia de brasas.");
  M("aliento_igneo", "Aliento \xCDgneo", "fuego", "esp", 60, 100, 20, { st: ["quemado", 10] }, 0, "Exhala un aire abrasador.");
  M("colmillo_brasa", "Colmillo Brasa", "fuego", "fis", 65, 95, 15, { st: ["quemado", 10], flinch: 10 }, 0, "Muerde con colmillos al rojo vivo.");
  M("calcinada", "Calcinada", "fuego", "fis", 70, 100, 15, { st: ["quemado", 10] }, 0, "Se lanza envuelto en llamas.");
  M("puno_magma", "Pu\xF1o Magma", "fuego", "fis", 85, 90, 10, { st: ["quemado", 20] }, 0, "Un golpe de roca fundida.");
  M("ola_calor", "Ola de Calor", "fuego", "esp", 90, 90, 10, { st: ["quemado", 10] }, 0, "Una ola de aire ardiente.");
  M("torbellino_igneo", "Torbellino \xCDgneo", "fuego", "esp", 110, 85, 5, { st: ["quemado", 30] }, 0, "Un remolino de fuego devastador.");
  M("nova_ardiente", "Nova Ardiente", "fuego", "esp", 120, 90, 5, { stat: [S("self", "spa", -2)] }, 0, "Libera toda su energ\xEDa; baja su Ataque Esp.");
  M("danza_llama", "Danza de Llamas", "fuego", "est", 0, 0, 20, { stat: [S("self", "atk", 1), S("self", "spa", 1)] }, 0, "Sube Ataque y Ataque Esp.");
  M("sol_abrasador", "Sol Abrasador", "fuego", "est", 0, 0, 5, { weather: "soleado" }, 0, "Intensifica el sol durante 5 turnos.");
  M("chorro_menor", "Chorro Menor", "agua", "esp", 40, 100, 25, {}, 0, "Un chorro de agua a presi\xF3n.");
  M("burbujeo", "Burbujeo", "agua", "esp", 45, 100, 25, { stat: [S("foe", "spe", -1, 10)] }, 0, "Burbujas que pueden frenar al rival.");
  M("remolino_marino", "Remolino Marino", "agua", "esp", 60, 90, 15, { stat: [S("foe", "spe", -1, 100)] }, 0, "Atrapa al rival en una corriente.");
  M("cascada", "Cascada", "agua", "fis", 80, 100, 15, { flinch: 20 }, 0, "Se abalanza como una catarata.");
  M("cola_acuatica", "Cola Acu\xE1tica", "agua", "fis", 90, 90, 10, {}, 0, "Azota con una cola empapada.");
  M("torrente", "Torrente", "agua", "esp", 90, 100, 15, {}, 0, "Un torrente irresistible.");
  M("ola_marina", "Ola Marina", "agua", "esp", 95, 100, 10, {}, 0, "Invoca una gran ola.");
  M("hidrocanon", "Hidroca\xF1\xF3n", "agua", "esp", 110, 80, 5, {}, 0, "Disparo de agua descomunal.");
  M("danza_lluvia", "Danza de Lluvia", "agua", "est", 0, 0, 5, { weather: "lluvia" }, 0, "Hace llover durante 5 turnos.");
  M("coraza_acuosa", "Coraza Acuosa", "agua", "est", 0, 0, 20, { stat: [S("self", "def", 1), S("self", "spd", 1)] }, 0, "Sube Defensa y Defensa Esp.");
  M("latigo_cepa", "L\xE1tigo Cepa", "planta", "fis", 45, 100, 25, {}, 0, "Azota con lianas.");
  M("hoja_afilada", "Hoja Afilada", "planta", "fis", 55, 95, 25, { crit: 1 }, 0, "Hojas cortantes; golpe cr\xEDtico frecuente.");
  M("zarzas", "Zarzas", "planta", "fis", 70, 100, 15, { stat: [S("foe", "spe", -1, 20)] }, 0, "Zarzas que enredan al rival.");
  M("drenaje", "Drenaje", "planta", "esp", 75, 100, 10, { drain: 0.5 }, 0, "Absorbe la mitad del da\xF1o como salud.");
  M("bomba_semillas", "Bomba de Semillas", "planta", "fis", 80, 100, 15, {}, 0, "Lanza semillas explosivas.");
  M("tormenta_petalos", "Tormenta de P\xE9talos", "planta", "esp", 100, 95, 10, {}, 0, "Un hurac\xE1n de p\xE9talos.");
  M("rayo_clorofila", "Rayo de Clorofila", "planta", "esp", 120, 100, 5, { charge: true }, 0, "Carga un turno y dispara (sin carga con sol).");
  M("esporas_sueno", "Esporas Sue\xF1o", "planta", "est", 0, 75, 15, { st: ["dormido", 100] }, 0, "Duerme al rival.");
  M("semilla_parasita", "Semilla Par\xE1sita", "planta", "est", 0, 90, 10, { leech: true }, 0, "Drena PS del rival cada turno.");
  M("brote_vital", "Brote Vital", "planta", "est", 0, 0, 20, { stat: [S("self", "atk", 1), S("self", "spa", 1)] }, 0, "Sube Ataque y Ataque Esp.");
  M("fotosintesis", "Fotos\xEDntesis", "planta", "est", 0, 0, 10, { heal: 0.5 }, 0, "Recupera PS (m\xE1s con sol, menos con lluvia).");
  M("chispa", "Chispa", "electrico", "esp", 40, 100, 30, { st: ["paralizado", 10] }, 0, "Una descarga leve.");
  M("descarga", "Descarga", "electrico", "esp", 55, 100, 20, { st: ["paralizado", 20] }, 0, "Una descarga que puede paralizar.");
  M("colmillo_trueno", "Colmillo Trueno", "electrico", "fis", 65, 95, 15, { st: ["paralizado", 10], flinch: 10 }, 0, "Muerde con electricidad.");
  M("puno_trueno", "Pu\xF1o Trueno", "electrico", "fis", 75, 100, 15, { st: ["paralizado", 10] }, 0, "Un pu\xF1etazo cargado.");
  M("rayo_corto", "Rayo Corto", "electrico", "esp", 90, 100, 15, { st: ["paralizado", 10] }, 0, "Un rayo potente.");
  M("voltio_cruzado", "Voltio Cruzado", "electrico", "fis", 100, 100, 5, { recoil: 0.25 }, 0, "Se lanza como un rayo; sufre retroceso.");
  M("trueno_fuerte", "Trueno Fuerte", "electrico", "esp", 110, 70, 10, { st: ["paralizado", 30] }, 0, "Un trueno imprevisible.");
  M("onda_electrica", "Onda El\xE9ctrica", "electrico", "est", 0, 90, 20, { st: ["paralizado", 100] }, 0, "Paraliza al rival.");
  M("carga_voltio", "Carga Voltio", "electrico", "est", 0, 0, 20, { stat: [S("self", "spa", 1), S("self", "spd", 1)] }, 0, "Sube Ataque Esp y Defensa Esp.");
  M("barro_rapido", "Barro R\xE1pido", "tierra", "esp", 40, 100, 25, { stat: [S("foe", "acc", -1, 100)] }, 0, "Barro a los ojos: baja la precisi\xF3n.");
  M("zarpazo_tierra", "Zarpazo Tierra", "tierra", "fis", 60, 100, 20, {}, 0, "Una garra cargada de tierra.");
  M("temblor", "Temblor", "tierra", "fis", 60, 100, 20, { stat: [S("foe", "spe", -1, 100)] }, 0, "Sacude el suelo y frena al rival.");
  M("lluvia_huesos", "Lluvia de Huesos", "tierra", "fis", 25, 90, 10, { multi: [2, 5] }, 0, "Golpea de 2 a 5 veces.");
  M("derrumbe_barro", "Derrumbe de Barro", "tierra", "esp", 90, 100, 10, {}, 0, "Una avalancha de lodo.");
  M("sismo", "Sismo", "tierra", "fis", 100, 100, 10, {}, 0, "Un terremoto devastador.");
  M("aplastamiento", "Aplastamiento", "tierra", "fis", 120, 80, 5, { recoil: 0.25 }, 0, "Se deja caer con todo su peso.");
  M("tormenta_arena", "Tormenta de Arena", "tierra", "est", 0, 0, 10, { weather: "arena" }, 0, "Levanta una tormenta de arena 5 turnos.");
  M("ataque_arena", "Ataque Arena", "tierra", "est", 0, 100, 15, { stat: [S("foe", "acc", -1, 100)] }, 0, "Baja la precisi\xF3n del rival.");
  M("piedra_lanzada", "Piedra Lanzada", "roca", "fis", 50, 90, 20, {}, 0, "Arroja una roca.");
  M("pulverizar", "Pulverizar", "roca", "fis", 65, 100, 15, { stat: [S("foe", "def", -1, 50)] }, 0, "Machaca la defensa rival.");
  M("poder_gema", "Poder Gema", "roca", "esp", 80, 100, 20, { stat: [S("self", "spa", 1, 10)] }, 0, "Energ\xEDa de gemas antiguas.");
  M("avalancha", "Avalancha", "roca", "fis", 75, 90, 10, { flinch: 30 }, 0, "Lluvia de rocas que puede amedrentar.");
  M("derrumbe_mayor", "Derrumbe Mayor", "roca", "fis", 90, 85, 10, {}, 0, "Un alud de piedras.");
  M("roca_afilada", "Roca Afilada", "roca", "fis", 100, 80, 5, { crit: 1 }, 0, "Una roca cortante; cr\xEDtico frecuente.");
  M("muro_piedra", "Muro de Piedra", "roca", "est", 0, 0, 15, { stat: [S("self", "def", 2)] }, 0, "Sube mucho la Defensa.");
  M("coraza_roca", "Coraza Roca", "roca", "est", 0, 0, 20, { stat: [S("self", "def", 1), S("self", "spd", 1)] }, 0, "Sube Defensa y Defensa Esp.");
  M("picotazo", "Picotazo", "aire", "fis", 35, 100, 35, {}, 0, "Un picotazo r\xE1pido.");
  M("rafaga", "R\xE1faga", "aire", "esp", 40, 100, 25, {}, 0, "Una r\xE1faga de viento.");
  M("ala_cortante", "Ala Cortante", "aire", "fis", 60, 100, 35, {}, 0, "Golpea con las alas.");
  M("aire_cortante", "Aire Cortante", "aire", "esp", 75, 95, 15, { crit: 1 }, 0, "Cuchillas de viento; cr\xEDtico frecuente.");
  M("pico_taladro", "Pico Taladro", "aire", "fis", 80, 100, 20, { crit: 1 }, 0, "Un pico giratorio.");
  M("vendaval", "Vendaval", "aire", "esp", 90, 90, 10, { stat: [S("foe", "spe", -1, 10)] }, 0, "Un vendaval furioso.");
  M("cae_halcon", "Cae Halc\xF3n", "aire", "fis", 100, 95, 10, { recoil: 0.25 }, 0, "Se precipita en picado; sufre retroceso.");
  M("embate_celeste", "Embate Celeste", "aire", "fis", 120, 90, 5, { recharge: true }, 0, "Golpe brutal; descansa el turno siguiente.");
  M("pluma_veloz", "Pluma Veloz", "aire", "est", 0, 0, 20, { stat: [S("self", "spe", 2)] }, 0, "Sube mucho la Velocidad.");
  M("rafaga_cegadora", "R\xE1faga Cegadora", "aire", "est", 0, 100, 15, { stat: [S("foe", "acc", -1, 100)] }, 0, "Baja la precisi\xF3n del rival.");
  M("aliento_helado", "Aliento Helado", "hielo", "esp", 40, 100, 25, { st: ["congelado", 10] }, 0, "Un soplo g\xE9lido.");
  M("copos_cortantes", "Copos Cortantes", "hielo", "esp", 55, 95, 20, { stat: [S("foe", "spe", -1, 10)] }, 0, "Copos afilados como cuchillas.");
  M("carambano", "Car\xE1mbano", "hielo", "fis", 25, 95, 15, { multi: [2, 5] }, 0, "Lanza de 2 a 5 car\xE1mbanos.");
  M("colmillo_hielo", "Colmillo Hielo", "hielo", "fis", 65, 95, 15, { st: ["congelado", 10], flinch: 10 }, 0, "Muerde con colmillos helados.");
  M("puno_hielo", "Pu\xF1o Hielo", "hielo", "fis", 75, 100, 15, { st: ["congelado", 10] }, 0, "Un pu\xF1etazo helado.");
  M("rayo_hielo", "Rayo Hielo", "hielo", "esp", 90, 100, 10, { st: ["congelado", 10] }, 0, "Un rayo de hielo.");
  M("ventisca", "Ventisca", "hielo", "esp", 110, 70, 5, { st: ["congelado", 10] }, 0, "Ventisca (precisi\xF3n perfecta con granizo).");
  M("granizo", "Granizo", "hielo", "est", 0, 0, 10, { weather: "granizo" }, 0, "Provoca granizo durante 5 turnos.");
  M("piel_cristal", "Piel de Cristal", "hielo", "est", 0, 0, 15, { stat: [S("self", "def", 2)] }, 0, "Endurece la piel con hielo.");
  M("golpe_corto", "Golpe Corto", "lucha", "fis", 40, 100, 30, {}, 1, "Siempre golpea primero.");
  M("karate_tajo", "Karate-Tajo", "lucha", "fis", 50, 100, 25, { crit: 1 }, 0, "Un tajo con cr\xEDtico frecuente.");
  M("barrido", "Barrido", "lucha", "fis", 60, 100, 20, { stat: [S("foe", "def", -1, 20)] }, 0, "Un barrido que debilita.");
  M("rafaga_punos", "R\xE1faga de Pu\xF1os", "lucha", "fis", 25, 90, 15, { multi: [2, 5] }, 0, "De 2 a 5 pu\xF1etazos.");
  M("golpe_certero", "Golpe Certero", "lucha", "fis", 80, 100, 15, {}, 0, "Un golpe limpio y fuerte.");
  M("puno_titan", "Pu\xF1o Tit\xE1n", "lucha", "fis", 100, 60, 5, { confuse: 100 }, 0, "Muy potente; deja confuso al rival.");
  M("fuerza_bruta", "Fuerza Bruta", "lucha", "fis", 120, 100, 5, { stat: [S("self", "def", -1), S("self", "spd", -1)] }, 0, "Potencia bruta; baja sus defensas.");
  M("respiracion_zen", "Respiraci\xF3n Zen", "lucha", "est", 0, 0, 20, { stat: [S("self", "atk", 1), S("self", "def", 1)] }, 0, "Sube Ataque y Defensa.");
  M("contragolpe", "Contragolpe", "lucha", "fis", 70, 100, 15, { stat: [S("self", "spe", 1, 30)] }, 0, "Un golpe que puede acelerarlo.");
  M("picadura_toxica", "Picadura T\xF3xica", "veneno", "fis", 35, 100, 35, { st: ["envenenado", 30] }, 0, "Un aguij\xF3n envenenado.");
  M("acido", "\xC1cido", "veneno", "esp", 40, 100, 30, { stat: [S("foe", "spd", -1, 10)] }, 0, "Un \xE1cido corrosivo.");
  M("colmillo_veneno", "Colmillo Veneno", "veneno", "fis", 50, 100, 15, { st: ["envenenado", 50] }, 0, "Colmillos venenosos.");
  M("residuos", "Residuos", "veneno", "fis", 65, 100, 20, { st: ["envenenado", 30] }, 0, "Lanza desechos t\xF3xicos.");
  M("bomba_lodo", "Bomba de Lodo", "veneno", "esp", 90, 100, 10, { st: ["envenenado", 30] }, 0, "Lodo venenoso.");
  M("canon_residual", "Ca\xF1\xF3n Residual", "veneno", "fis", 120, 80, 5, { st: ["envenenado", 30] }, 0, "Un disparo de residuos.");
  M("niebla_toxica", "Niebla T\xF3xica", "veneno", "est", 0, 90, 15, { st: ["envenenado", 100] }, 0, "Envenena al rival.");
  M("corrosion", "Corrosi\xF3n", "veneno", "est", 0, 100, 20, { stat: [S("foe", "def", -2)] }, 0, "Baja mucho la Defensa del rival.");
  M("confusion", "Confusi\xF3n", "mental", "esp", 50, 100, 25, { confuse: 10 }, 0, "Una onda mental.");
  M("psicorrayo", "Psicorrayo", "mental", "esp", 65, 100, 20, { confuse: 10 }, 0, "Un rayo extra\xF1o.");
  M("cabezazo_zen", "Cabezazo Zen", "mental", "fis", 80, 90, 15, { flinch: 20 }, 0, "Un cabezazo concentrado.");
  M("impacto_mental", "Impacto Mental", "mental", "esp", 80, 100, 15, { stat: [S("foe", "spd", -1, 10)] }, 0, "Un impacto ps\xEDquico.");
  M("psiquico_fuerte", "Ps\xEDquico Fuerte", "mental", "esp", 90, 100, 10, { stat: [S("foe", "spd", -1, 10)] }, 0, "Poder mental en estado puro.");
  M("telequinesis", "Telequinesis", "mental", "esp", 100, 90, 5, {}, 0, "Lanza al rival con la mente.");
  M("hipnosis", "Hipnosis", "mental", "est", 0, 60, 20, { st: ["dormido", 100] }, 0, "Duerme al rival.");
  M("meditacion", "Meditaci\xF3n", "mental", "est", 0, 0, 20, { stat: [S("self", "spa", 1), S("self", "spd", 1)] }, 0, "Sube Ataque Esp y Defensa Esp.");
  M("reflejo", "Reflejo", "mental", "est", 0, 0, 20, { barrier: "fis" }, 0, "Reduce el da\xF1o f\xEDsico 5 turnos.");
  M("muro_psiquico", "Muro Ps\xEDquico", "mental", "est", 0, 0, 20, { barrier: "esp" }, 0, "Reduce el da\xF1o especial 5 turnos.");
  M("sanacion_mental", "Sanaci\xF3n Mental", "mental", "est", 0, 0, 10, { heal: 0.5 }, 0, "Recupera la mitad de los PS.");
  M("descanso", "Descanso", "mental", "est", 0, 0, 10, { rest: true }, 0, "Duerme 2 turnos y se cura del todo.");
  M("sombra_fugaz", "Sombra Fugaz", "sombra", "fis", 40, 100, 30, {}, 1, "Siempre golpea primero.");
  M("mordisco_oscuro", "Mordisco Oscuro", "sombra", "fis", 60, 100, 25, { flinch: 20 }, 0, "Un mordisco traicionero.");
  M("robo_vital", "Robo Vital", "sombra", "esp", 60, 100, 15, { drain: 0.5 }, 0, "Roba la mitad del da\xF1o como PS.");
  M("garra_nocturna", "Garra Nocturna", "sombra", "fis", 70, 100, 15, { crit: 1 }, 0, "Garras en la oscuridad.");
  M("pulso_umbrio", "Pulso Umbr\xEDo", "sombra", "esp", 80, 100, 15, { flinch: 20 }, 0, "Un pulso de oscuridad.");
  M("golpe_traicionero", "Golpe Traicionero", "sombra", "fis", 85, 100, 10, {}, 0, "Un golpe a traici\xF3n.");
  M("abismo", "Abismo", "sombra", "esp", 110, 85, 5, {}, 0, "Abre un abismo bajo el rival.");
  M("mal_de_ojo", "Mal de Ojo", "sombra", "est", 0, 100, 15, { stat: [S("foe", "atk", -1), S("foe", "spa", -1)] }, 0, "Baja Ataque y Ataque Esp del rival.");
  M("noche_cerrada", "Noche Cerrada", "sombra", "est", 0, 100, 15, { stat: [S("foe", "acc", -2)] }, 0, "Oscurece el campo: baja mucho la precisi\xF3n.");
  M("destello", "Destello", "luz", "esp", 40, 100, 30, { stat: [S("foe", "acc", -1, 10)] }, 0, "Un destello cegador.");
  M("rayo_luz", "Rayo de Luz", "luz", "esp", 65, 100, 20, {}, 0, "Un rayo luminoso.");
  M("halo_purificador", "Halo Purificador", "luz", "esp", 65, 100, 15, { cure: true }, 0, "Da\xF1a y cura su propio estado.");
  M("lanza_solar", "Lanza Solar", "luz", "fis", 85, 100, 10, {}, 0, "Una lanza de luz s\xF3lida.");
  M("resplandor", "Resplandor", "luz", "esp", 90, 100, 10, { stat: [S("foe", "spd", -1, 10)] }, 0, "Luz que quema las defensas.");
  M("rayo_prisma", "Rayo Prisma", "luz", "esp", 110, 85, 5, {}, 0, "Luz concentrada en un prisma.");
  M("luz_curativa", "Luz Curativa", "luz", "est", 0, 0, 10, { heal: 0.5 }, 0, "Recupera la mitad de los PS.");
  M("velo_luz", "Velo de Luz", "luz", "est", 0, 0, 15, { barrier: "ambos" }, 0, "Reduce todo el da\xF1o durante 5 turnos.");
  M("mirada_cegadora", "Mirada Cegadora", "luz", "est", 0, 100, 15, { stat: [S("foe", "acc", -2)] }, 0, "Baja mucho la precisi\xF3n.");
  M("aura_protectora", "Aura Protectora", "luz", "est", 0, 0, 10, { protect: true }, 4, "Evita todo da\xF1o este turno.");
  M("garra_metal", "Garra Metal", "metal", "fis", 50, 95, 35, { stat: [S("self", "atk", 1, 10)] }, 0, "Garras de acero.");
  M("golpe_acero", "Golpe Acero", "metal", "fis", 70, 90, 25, {}, 0, "Un golpe de acero.");
  M("cabezazo_hierro", "Cabezazo Hierro", "metal", "fis", 80, 100, 15, { flinch: 30 }, 0, "Cabeza de hierro.");
  M("canon_plata", "Ca\xF1\xF3n Plata", "metal", "esp", 80, 100, 10, { stat: [S("foe", "spd", -1, 10)] }, 0, "Un ca\xF1\xF3n de plata.");
  M("bomba_hierro", "Bomba de Hierro", "metal", "fis", 90, 85, 10, {}, 0, "Una bola de acero pesada.");
  M("meteoro_acero", "Meteoro Acero", "metal", "fis", 100, 95, 5, {}, 0, "Cae como un meteoro met\xE1lico.");
  M("coraza_ferrea", "Coraza F\xE9rrea", "metal", "est", 0, 0, 15, { stat: [S("self", "def", 2)] }, 0, "Sube mucho la Defensa.");
  M("pulido", "Pulido", "metal", "est", 0, 0, 20, { stat: [S("self", "spe", 2)] }, 0, "Sube mucho la Velocidad.");
  M("picadura", "Picadura", "insecto", "fis", 40, 100, 30, {}, 0, "Una picadura.");
  M("zumbido", "Zumbido", "insecto", "esp", 60, 100, 20, { stat: [S("foe", "spd", -1, 10)] }, 0, "Un zumbido molesto.");
  M("alas_cortantes", "Alas Cortantes", "insecto", "fis", 70, 95, 15, { crit: 1 }, 0, "Alas afiladas.");
  M("tijera_doble", "Tijera Doble", "insecto", "fis", 80, 100, 15, {}, 0, "Dos tijeretazos.");
  M("chupa_vida", "Chupa Vida", "insecto", "fis", 80, 100, 10, { drain: 0.5 }, 0, "Absorbe la mitad del da\xF1o.");
  M("rafaga_insecto", "R\xE1faga Insecto", "insecto", "esp", 90, 100, 10, { stat: [S("foe", "spa", -1, 10)] }, 0, "Una nube de insectos.");
  M("hilo_pegajoso", "Hilo Pegajoso", "insecto", "est", 0, 95, 40, { stat: [S("foe", "spe", -2)] }, 0, "Baja mucho la Velocidad.");
  M("enjambre", "Enjambre", "insecto", "est", 0, 0, 20, { stat: [S("self", "atk", 1), S("self", "spe", 1)] }, 0, "Sube Ataque y Velocidad.");
  M("aliento_dragon", "Aliento Drag\xF3n", "dragon", "esp", 60, 100, 20, { st: ["paralizado", 30] }, 0, "Un aliento ancestral.");
  M("cola_dragon", "Cola Drag\xF3n", "dragon", "fis", 60, 90, 10, {}, 0, "Azota con la cola.");
  M("garra_dragon", "Garra Drag\xF3n", "dragon", "fis", 80, 100, 15, {}, 0, "Garras de drag\xF3n.");
  M("pulso_dragon", "Pulso Drag\xF3n", "dragon", "esp", 85, 100, 10, {}, 0, "Una onda drac\xF3nica.");
  M("colera_draconica", "C\xF3lera Drac\xF3nica", "dragon", "fis", 120, 100, 5, { stat: [S("self", "atk", -1)] }, 0, "Furia brutal; baja su Ataque.");
  M("rugido_ancestral", "Rugido Ancestral", "dragon", "esp", 110, 85, 5, { stat: [S("self", "spa", -1)] }, 0, "Un rugido atronador.");
  M("meteoro_dragon", "Meteoro Drag\xF3n", "dragon", "esp", 130, 90, 5, { stat: [S("self", "spa", -2)] }, 0, "Poder extremo; baja mucho su Atq. Esp.");
  M("danza_dragon", "Danza Drag\xF3n", "dragon", "est", 0, 0, 20, { stat: [S("self", "atk", 1), S("self", "spe", 1)] }, 0, "Sube Ataque y Velocidad.");
  M("eco", "Eco", "sonido", "esp", 40, 100, 25, {}, 0, "Un eco que retumba.");
  M("onda_sonica", "Onda S\xF3nica", "sonido", "esp", 55, 100, 20, {}, 0, "Ondas de sonido.");
  M("retumbo", "Retumbo", "sonido", "fis", 80, 100, 15, { flinch: 20 }, 0, "Un golpe sonoro.");
  M("voz_cristal", "Voz de Cristal", "sonido", "esp", 80, 100, 15, { stat: [S("foe", "spd", -1, 20)] }, 0, "Un agudo que quiebra defensas.");
  M("alboroto", "Alboroto", "sonido", "esp", 90, 100, 10, { flinch: 20 }, 0, "Un estruendo aturdidor.");
  M("estruendo", "Estruendo", "sonido", "esp", 110, 85, 5, {}, 0, "Un estruendo ensordecedor.");
  M("alarido", "Alarido", "sonido", "est", 0, 85, 40, { stat: [S("foe", "def", -2)] }, 0, "Baja mucho la Defensa.");
  M("cancion_cuna", "Canci\xF3n de Cuna", "sonido", "est", 0, 60, 15, { st: ["dormido", 100] }, 0, "Duerme al rival.");
  M("melodia_calmante", "Melod\xEDa Calmante", "sonido", "est", 0, 100, 20, { stat: [S("foe", "atk", -1), S("foe", "spa", -1)] }, 0, "Baja Ataque y Ataque Esp del rival.");
  M("himno_valeroso", "Himno Valeroso", "sonido", "est", 0, 0, 20, { stat: [S("self", "atk", 1), S("self", "spa", 1)] }, 0, "Sube Ataque y Ataque Esp.");
  M("lenguetazo", "Leng\xFCetazo", "espiritu", "fis", 30, 100, 30, { st: ["paralizado", 30] }, 0, "Un leng\xFCetazo helado.");
  M("toque_fantasma", "Toque Fantasma", "espiritu", "fis", 40, 100, 30, {}, 1, "Siempre golpea primero.");
  M("aullido_espectral", "Aullido Espectral", "espiritu", "esp", 65, 100, 20, {}, 0, "Un aullido de ultratumba.");
  M("bola_espectral", "Bola Espectral", "espiritu", "esp", 80, 100, 15, { stat: [S("foe", "spd", -1, 20)] }, 0, "Una esfera fantasmal.");
  M("posesion", "Posesi\xF3n", "espiritu", "fis", 90, 100, 10, {}, 0, "Se apodera por un instante del rival.");
  M("niebla_espectral", "Niebla Espectral", "espiritu", "esp", 100, 90, 5, { stat: [S("foe", "spa", -1, 30)] }, 0, "Una niebla que apaga las fuerzas.");
  M("fuego_fatuo", "Fuego Fatuo", "espiritu", "est", 0, 85, 15, { st: ["quemado", 100] }, 0, "Quema al rival con llamas azules.");
  M("susurro_gelido", "Susurro G\xE9lido", "espiritu", "est", 0, 100, 20, { stat: [S("foe", "spa", -1), S("foe", "spd", -1)] }, 0, "Baja Atq. Esp. y Def. Esp. del rival.");
  M("reposo_astral", "Reposo Astral", "espiritu", "est", 0, 0, 10, { heal: 0.5 }, 0, "Recupera la mitad de los PS.");
  M("lluvia_estelar", "Lluvia Estelar", "luz", "esp", 100, 100, 10, { stat: [S("foe", "spd", -1, 30)] }, 0, "Estrellas caen sobre el rival.");
  M("juicio_alba", "Juicio del Alba", "luz", "esp", 130, 90, 5, { stat: [S("self", "spa", -1)] }, 0, "El poder del primer amanecer.");
  M("eclipse_total", "Eclipse Total", "sombra", "esp", 130, 90, 5, { stat: [S("self", "spa", -1)] }, 0, "Apaga el sol y la esperanza.");
  M("tormenta_primordial", "Tormenta Primordial", "electrico", "esp", 120, 85, 5, { st: ["paralizado", 30] }, 0, "Una tormenta ancestral.");
  M("erupcion_ancestral", "Erupci\xF3n Ancestral", "fuego", "esp", 120, 90, 5, { st: ["quemado", 30] }, 0, "Despierta el volc\xE1n.");
  M("glaciar_eterno", "Glaciar Eterno", "hielo", "esp", 120, 90, 5, { st: ["congelado", 20] }, 0, "Hielo de eras pasadas.");
  M("colosal_golpe", "Golpe Colosal", "metal", "fis", 120, 90, 5, { stat: [S("self", "spe", -1)] }, 0, "Un pu\xF1etazo de monta\xF1a.");
  M("lamento_eterno", "Lamento Eterno", "espiritu", "esp", 110, 95, 5, { stat: [S("foe", "spd", -1, 50)] }, 0, "El lamento de eras olvidadas.");
  M("sinfonia_final", "Sinfon\xEDa Final", "sonido", "esp", 130, 90, 5, { stat: [S("self", "spa", -1)] }, 0, "La melod\xEDa que cierra el mundo.");
  M("vida_primigenia", "Vida Primigenia", "planta", "esp", 100, 100, 5, { drain: 0.5 }, 0, "La esencia de todas las plantas.");
  M("forma_quimerica", "Forma Quim\xE9rica", "mental", "est", 0, 0, 5, { stat: [S("self", "atk", 1), S("self", "def", 1), S("self", "spa", 1), S("self", "spd", 1), S("self", "spe", 1)] }, 0, "Sube todas sus estad\xEDsticas.");
  M("escudo_vital", "Escudo Vital", "luz", "est", 0, 0, 10, { shield: 0.3 }, 0, "Crea un escudo con el 30% de sus PS m\xE1ximos.");
  M("escudo_hielo", "Escudo de Hielo", "hielo", "est", 0, 0, 10, { shield: 0.25 }, 0, "Crea un escudo con el 25% de sus PS m\xE1ximos.");
  M("escudo_roca", "Escudo de Roca", "roca", "est", 0, 0, 10, { shield: 0.25 }, 0, "Crea un escudo con el 25% de sus PS m\xE1ximos.");
  M("escudo_agua", "Escudo de Agua", "agua", "est", 0, 0, 10, { shield: 0.25 }, 0, "Crea un escudo con el 25% de sus PS m\xE1ximos.");
  M("disipar", "Disipar", "aire", "est", 0, 0, 10, { clear: true }, 0, "Restablece todos los cambios de estad\xEDsticas.");
  M("lucha_final", "Lucha Final", "lucha", "fis", 1, 100, 5, { fixed: "lvl" }, 0, "Da\xF1o igual al nivel del usuario.");
  M("onda_nivel", "Onda de Nivel", "mental", "esp", 1, 100, 5, { fixed: "lvl" }, 0, "Da\xF1o igual al nivel del usuario.");
  M("baculo_trueno", "B\xE1culo del Trueno", "electrico", "fis", 70, 100, 15, { st: ["paralizado", 20] }, 0, "Golpe con un b\xE1culo cargado.");
  M("cuchilla_fuego", "Cuchilla de Fuego", "fuego", "fis", 90, 95, 10, { crit: 1 }, 0, "Un tajo ardiente con cr\xEDtico frecuente.");
  M("lanza_agua", "Lanza de Agua", "agua", "fis", 75, 100, 15, { crit: 1 }, 0, "Una lanza de agua afilada.");
  M("espina_planta", "Espina Venenosa", "planta", "fis", 60, 100, 20, { st: ["envenenado", 30] }, 0, "Una espina cargada de toxina.");
  var EXCLUSIVE_MOVES = /* @__PURE__ */ new Set(["lluvia_estelar", "juicio_alba", "eclipse_total", "tormenta_primordial", "erupcion_ancestral", "glaciar_eterno", "colosal_golpe", "lamento_eterno", "sinfonia_final", "vida_primigenia", "forma_quimerica", "lucha_final", "onda_nivel"]);
  for (const t of Object.keys(MOVES_BY_TYPE)) MOVES_BY_TYPE[t] = MOVES_BY_TYPE[t].filter((m) => !EXCLUSIVE_MOVES.has(m.id));
  function getMove(id) {
    const m = MOVES[id];
    if (!m) throw new Error("Movimiento desconocido: " + id);
    return m;
  }
  function moveTier(m) {
    if (m.cat === "est") {
      const f = m.fx;
      if (f.weather || f.barrier || f.heal || f.shield || f.rest) return 2;
      if (f.stat && f.stat.some((s) => Math.abs(s[2]) >= 2)) return 2;
      return 1;
    }
    const p = m.pow;
    return p < 50 ? 0 : p < 70 ? 1 : p < 90 ? 2 : p < 110 ? 3 : 4;
  }

  // src/data/items.js
  var ITEMS = {};
  var POCKETS = {
    medicina: "Medicinas",
    capturas: "C\xE1psulas",
    evolucion: "Evoluci\xF3n",
    discos: "Discos T\xE9cnicos",
    exploracion: "Exploraci\xF3n",
    mision: "Misi\xF3n",
    tesoros: "Tesoros",
    viaje: "Viaje"
  };
  var POCKET_ORDER = ["medicina", "capturas", "evolucion", "discos", "exploracion", "viaje", "mision", "tesoros"];
  function I(id, name, pocket, price, desc, fx = {}, o = {}) {
    ITEMS[id] = { id, name, pocket, price, desc, fx, use: o.use || "field", sell: o.sell ?? (price > 0 && pocket !== "mision" && pocket !== "exploracion" && !fx.key), ...o };
  }
  I("pocion", "Poci\xF3n", "medicina", 200, "Restaura 20 PS.", { heal: 20 }, { use: "both" });
  I("super_pocion", "S\xFAper Poci\xF3n", "medicina", 600, "Restaura 60 PS.", { heal: 60 }, { use: "both" });
  I("hiper_pocion", "Hiper Poci\xF3n", "medicina", 1400, "Restaura 120 PS.", { heal: 120 }, { use: "both" });
  I("pocion_maxima", "Poci\xF3n M\xE1xima", "medicina", 2600, "Restaura todos los PS.", { healFull: true }, { use: "both" });
  I("cura_total", "Cura Total", "medicina", 1800, "Restaura todos los PS y cura cualquier estado.", { healFull: true, cure: "all" }, { use: "both" });
  I("antidoto", "Ant\xEDdoto", "medicina", 100, "Cura el envenenamiento.", { cure: "envenenado" }, { use: "both" });
  I("antiquemar", "Antiquemar", "medicina", 150, "Cura las quemaduras.", { cure: "quemado" }, { use: "both" });
  I("antiparalizador", "Antiparalizador", "medicina", 150, "Cura la par\xE1lisis.", { cure: "paralizado" }, { use: "both" });
  I("despertar", "Despertar", "medicina", 150, "Despierta a una criatura dormida.", { cure: "dormido" }, { use: "both" });
  I("antihielo", "Antihielo", "medicina", 150, "Descongela a una criatura.", { cure: "congelado" }, { use: "both" });
  I("cura_estados", "Cura Estados", "medicina", 300, "Cura cualquier estado alterado.", { cure: "all" }, { use: "both" });
  I("revivir", "Revivir", "medicina", 1500, "Revive a una criatura con la mitad de sus PS.", { revive: 0.5 }, { use: "both" });
  I("revivir_max", "Revivir M\xE1x.", "medicina", 3500, "Revive con todos los PS.", { revive: 1 }, { use: "both" });
  I("eter", "\xC9ter", "medicina", 1200, "Restaura 10 PP de un movimiento.", { pp: 10 }, { use: "field" });
  I("eter_max", "\xC9ter M\xE1x.", "medicina", 2500, "Restaura todos los PP de un movimiento.", { pp: 99 }, { use: "field" });
  I("elixir", "Elixir", "medicina", 3e3, "Restaura 10 PP de todos los movimientos.", { ppAll: 10 }, { use: "field" });
  I("caramelo_exp_s", "Caramelo Exp. S", "medicina", 300, "Otorga 100 puntos de experiencia.", { xp: 100 }, { use: "field" });
  I("caramelo_exp_m", "Caramelo Exp. M", "medicina", 1500, "Otorga 800 puntos de experiencia.", { xp: 800 }, { use: "field" });
  I("caramelo_exp_l", "Caramelo Exp. L", "medicina", 5e3, "Otorga 3000 puntos de experiencia.", { xp: 3e3 }, { use: "field" });
  I("caramelo_raro", "Caramelo Raro", "medicina", 0, "Sube 1 nivel (respeta el l\xEDmite de nivel por medallas).", { lvUp: 1 }, { use: "field", sell: false });
  I("proteina", "Prote\xEDna", "medicina", 4e3, "Entrena el Ataque (+10 esfuerzo).", { ev: { stat: "atk", n: 10 } }, { use: "field" });
  I("hierro", "Hierro", "medicina", 4e3, "Entrena la Defensa (+10 esfuerzo).", { ev: { stat: "def", n: 10 } }, { use: "field" });
  I("calcio", "Calcio", "medicina", 4e3, "Entrena el Ataque Esp. (+10 esfuerzo).", { ev: { stat: "spa", n: 10 } }, { use: "field" });
  I("zinc", "Zinc", "medicina", 4e3, "Entrena la Defensa Esp. (+10 esfuerzo).", { ev: { stat: "spd", n: 10 } }, { use: "field" });
  I("carbono", "Carbono", "medicina", 4e3, "Entrena la Velocidad (+10 esfuerzo).", { ev: { stat: "spe", n: 10 } }, { use: "field" });
  I("vigor", "Vigor", "medicina", 4e3, "Entrena los PS (+10 esfuerzo).", { ev: { stat: "hp", n: 10 } }, { use: "field" });
  I("baya_amistad", "Baya Amistad", "medicina", 500, "Aumenta la amistad de una criatura.", { friend: 12 }, { use: "field" });
  I("capsula", "C\xE1psula", "capturas", 200, "Dispositivo b\xE1sico de captura.", { ball: { mult: 1 } }, { use: "battle" });
  I("super_capsula", "S\xFAper C\xE1psula", "capturas", 600, "Mejor que la c\xE1psula b\xE1sica (x1,5).", { ball: { mult: 1.5 } }, { use: "battle" });
  I("ultra_capsula", "Ultra C\xE1psula", "capturas", 1200, "Alto rendimiento (x2).", { ball: { mult: 2 } }, { use: "battle" });
  I("capsula_red", "C\xE1psula Red", "capturas", 1e3, "x3,5 contra criaturas de Agua e Insecto.", { ball: { mult: 1, cond: "red" } }, { use: "battle" });
  I("capsula_noche", "C\xE1psula Noche", "capturas", 1e3, "x3 de noche o en cuevas.", { ball: { mult: 1, cond: "noche" } }, { use: "battle" });
  I("capsula_veloz", "C\xE1psula Veloz", "capturas", 1e3, "x4 si se lanza en el primer turno.", { ball: { mult: 1, cond: "veloz" } }, { use: "battle" });
  I("capsula_atlas", "C\xE1psula Atlas", "capturas", 1e3, "x3,5 contra especies que a\xFAn no tienes registradas.", { ball: { mult: 1, cond: "atlas" } }, { use: "battle" });
  I("capsula_maestra", "C\xE1psula Maestra", "capturas", 0, "Captura sin fallo. Solo hay una.", { ball: { mult: 255, master: true } }, { use: "battle", sell: false });
  I("gema_ignea", "Gema \xCDgnea", "evolucion", 2100, "Una gema ardiente que hace evolucionar a ciertas criaturas.", { evo: true }, { use: "field" });
  I("gema_marina", "Gema Marina", "evolucion", 2100, "Una gema h\xFAmeda que hace evolucionar a ciertas criaturas.", { evo: true }, { use: "field" });
  I("gema_silvestre", "Gema Silvestre", "evolucion", 2100, "Una gema verde que hace evolucionar a ciertas criaturas.", { evo: true }, { use: "field" });
  I("gema_chispa", "Gema Chispa", "evolucion", 2100, "Una gema cargada que hace evolucionar a ciertas criaturas.", { evo: true }, { use: "field" });
  I("gema_lunar", "Gema Lunar", "evolucion", 2100, "Una gema p\xE1lida que hace evolucionar a ciertas criaturas.", { evo: true }, { use: "field" });
  I("gema_solar", "Gema Solar", "evolucion", 2400, "Una gema luminosa que hace evolucionar a ciertas criaturas.", { evo: true }, { use: "field" });
  I("gema_escarcha", "Gema Escarcha", "evolucion", 2400, "Una gema helada que hace evolucionar a ciertas criaturas.", { evo: true }, { use: "field" });
  I("gema_ocaso", "Gema Ocaso", "evolucion", 2400, "Una gema oscura que hace evolucionar a ciertas criaturas.", { evo: true }, { use: "field" });
  I("repelente", "Repelente", "exploracion", 350, "Evita encuentros salvajes durante 100 pasos.", { repel: 100 }, { use: "field", sell: true });
  I("super_repelente", "S\xFAper Repelente", "exploracion", 500, "Evita encuentros durante 200 pasos.", { repel: 200 }, { use: "field", sell: true });
  I("cuerda_fuga", "Cuerda de Fuga", "exploracion", 550, "Te saca al instante de una cueva.", { escape: true }, { use: "field", sell: true });
  I("lupa", "Lupa de Aurelia", "exploracion", 0, "Muestra destellos de objetos ocultos cercanos.", { key: "lupa" }, { use: "none", sell: false });
  I("bicicleta", "Bicicleta", "exploracion", 0, "Doble de velocidad. Act\xEDvala desde la mochila.", { key: "bicicleta" }, { use: "field", sell: false });
  I("barca", "Barca Plegable", "exploracion", 0, "Permite navegar por el agua.", { key: "barca" }, { use: "none", sell: false });
  I("piolet", "Piolet", "exploracion", 0, "Permite escalar paredes de roca agrietada.", { key: "piolet" }, { use: "none", sell: false });
  I("machete", "Machete", "exploracion", 0, "Corta la maleza espesa que bloquea el camino.", { key: "machete" }, { use: "none", sell: false });
  I("linterna", "Linterna", "exploracion", 0, "Ilumina las cuevas oscuras.", { key: "linterna" }, { use: "none", sell: false });
  I("repartir_exp", "Repartir Exp.", "exploracion", 0, "Reparte parte de la experiencia con todo el equipo.", { key: "repartir_exp" }, { use: "none", sell: false });
  I("pase_viaje", "Pase de Viaje", "viaje", 0, "Permite viajar a las ciudades que ya visitaste.", { key: "pase_viaje" }, { use: "none", sell: false });
  I("mapa", "Mapa de Aurelia", "viaje", 0, "Un mapa de toda la regi\xF3n.", { key: "mapa" }, { use: "none", sell: false });
  I("billete_ferry", "Billete de Ferry", "viaje", 0, "Te permite embarcar en el puerto.", { key: "billete" }, { use: "none", sell: false });
  I("amuleto_exp", "Amuleto Exp.", "exploracion", 0, "Aumenta un 20% la experiencia ganada.", { key: "amuleto_exp" }, { use: "none", sell: false });
  I("paquete_sauce", "Paquete del Prof. Sauce", "mision", 0, "Un paquete fr\xE1gil para el Museo de Ciudad Roble.", {}, { use: "none", sell: false });
  I("carta_roble", "Carta de Fresia", "mision", 0, "Una carta sellada con la hoja del Gimnasio Roble.", {}, { use: "none", sell: false });
  I("prisma_ambar", "Prisma \xC1mbar", "mision", 0, "Un fragmento del sello antiguo, c\xE1lido al tacto.", {}, { use: "none", sell: false });
  I("prisma_zafiro", "Prisma Zafiro", "mision", 0, "Un fragmento del sello antiguo, fr\xEDo como el mar.", {}, { use: "none", sell: false });
  I("prisma_esmeralda", "Prisma Esmeralda", "mision", 0, "Un fragmento del sello antiguo, vivo como el bosque.", {}, { use: "none", sell: false });
  I("prisma_nacar", "Prisma N\xE1car", "mision", 0, "Un fragmento del sello antiguo, p\xE1lido como la nieve.", {}, { use: "none", sell: false });
  I("fusible", "Fusible D\xEDnamo", "mision", 0, "Un fusible grande de la central el\xE9ctrica.", {}, { use: "none", sell: false });
  I("mineral_estrella", "Mineral Estrella", "mision", 0, "Un mineral raro que centellea.", {}, { use: "none", sell: false });
  I("amuleto_pantano", "Amuleto del Pantano", "mision", 0, "Un talism\xE1n de las brujas de la niebla.", {}, { use: "none", sell: false });
  I("diario_perdido", "Diario Perdido", "mision", 0, "El diario de un explorador desaparecido.", {}, { use: "none", sell: false });
  I("llave_ruinas", "Llave de las Ruinas", "mision", 0, "Abre la puerta sellada de las ruinas.", {}, { use: "none", sell: false });
  I("pase_liga", "Pase de la Liga", "mision", 0, "Acredita tus ocho medallas.", {}, { use: "none", sell: false });
  I("huevo_misterioso", "Huevo Misterioso", "mision", 0, "Un huevo c\xE1lido que alguien dej\xF3 en el camino.", {}, { use: "none", sell: false });
  I("baston_perdido", "Bast\xF3n Perdido", "mision", 0, "El bast\xF3n de un anciano de Villa Alba.", {}, { use: "none", sell: false });
  I("medalla_foto", "Fotograf\xEDa Rara", "mision", 0, "Una foto borrosa de una criatura esquiva.", {}, { use: "none", sell: false });
  I("pepita", "Pepita", "tesoros", 1e3, "Una pepita de oro. Se vende bien.", {}, { use: "none", sell: true });
  I("perla", "Perla", "tesoros", 700, "Una perla brillante.", {}, { use: "none", sell: true });
  I("perla_grande", "Perla Grande", "tesoros", 3e3, "Una perla enorme.", {}, { use: "none", sell: true });
  I("fragmento_estrella", "Fragmento Estelar", "tesoros", 1500, "Un fragmento de meteorito.", {}, { use: "none", sell: true });
  I("hueso_antiguo", "Hueso Antiguo", "tesoros", 1e3, "Un hueso fosilizado.", {}, { use: "none", sell: true });
  I("concha_rara", "Concha Rara", "tesoros", 500, "Una concha nacarada.", {}, { use: "none", sell: true });
  I("polvo_cristal", "Polvo de Cristal", "tesoros", 400, "Polvo brillante de cuevas.", {}, { use: "none", sell: true });
  var TM_LIST = [
    "garra_dragon",
    "rayo_corto",
    "rayo_hielo",
    "psiquico_fuerte",
    "bomba_lodo",
    "sismo",
    "derrumbe_mayor",
    "torrente",
    "ola_calor",
    "drenaje",
    "pulso_umbrio",
    "rayo_luz",
    "golpe_acero",
    "vendaval",
    "chupa_vida",
    "bola_espectral",
    "alboroto",
    "golpe_certero",
    "puno_trueno",
    "puno_hielo",
    "hoja_afilada",
    "colmillo_brasa",
    "cabezazo_zen",
    "esporas_sueno",
    "reflejo",
    "muro_psiquico",
    "velo_luz",
    "pulido",
    "tormenta_arena",
    "sol_abrasador",
    "danza_lluvia",
    "granizo",
    "aura_protectora",
    "descanso",
    "semilla_parasita",
    "coraza_ferrea",
    "danza_dragon",
    "sombra_fugaz",
    "golpe_corto",
    "escudo_vital"
  ];
  TM_LIST.forEach((mid, i) => {
    const m = MOVES[mid];
    const n = String(i + 1).padStart(2, "0");
    I("dt" + n, `DT${n} ${m.name}`, "discos", 1500 + Math.min(4, Math.max(m.pow, 40) / 30 | 0) * 600, `Ense\xF1a ${m.name} (${m.type}). Reutilizable.`, { tm: mid }, { use: "field", sell: true });
  });
  function getItem(id) {
    const it = ITEMS[id];
    if (!it) throw new Error("Objeto desconocido: " + id);
    return it;
  }

  // src/data/shops.js
  var SHOPS = {
    alba: { name: "Tienda de Villa Alba", stock: [["pocion", 0], ["capsula", 0], ["antidoto", 0], ["despertar", 0], ["antiparalizador", 0], ["repelente", 1]] },
    general: { name: "Tienda", stock: [["pocion", 0], ["super_pocion", 1], ["hiper_pocion", 4], ["antidoto", 0], ["antiquemar", 0], ["antiparalizador", 0], ["despertar", 0], ["antihielo", 0], ["cura_estados", 2], ["revivir", 3], ["capsula", 0], ["super_capsula", 2], ["ultra_capsula", 5], ["repelente", 0], ["super_repelente", 3], ["cuerda_fuga", 2], ["eter", 3], ["caramelo_exp_s", 1]] },
    puerto: { name: "Tienda del Puerto", stock: [["pocion", 0], ["super_pocion", 0], ["capsula", 0], ["super_capsula", 0], ["capsula_red", 0], ["antidoto", 0], ["concha_rara", 99]] },
    grandes: { name: "Grandes Almacenes D\xEDnamo", stock: [["super_pocion", 0], ["hiper_pocion", 2], ["revivir", 2], ["cura_estados", 0], ["super_capsula", 0], ["ultra_capsula", 3], ["capsula_veloz", 2], ["capsula_noche", 2], ["super_repelente", 0], ["eter", 0], ["elixir", 5], ["caramelo_exp_s", 0], ["caramelo_exp_m", 4], ["proteina", 4], ["hierro", 4], ["calcio", 4], ["zinc", 4], ["carbono", 4], ["vigor", 4]] },
    discos: { name: "Tienda de Discos T\xE9cnicos", stock: TM_LIST.map((m, i) => ["dt" + String(i + 1).padStart(2, "0"), 2 + Math.floor(i / 6)]) },
    gemas: { name: "Joyer\xEDa Evolutiva", stock: [["gema_ignea", 3], ["gema_marina", 3], ["gema_silvestre", 3], ["gema_chispa", 3], ["gema_lunar", 4], ["gema_solar", 5], ["gema_escarcha", 5], ["gema_ocaso", 5]] },
    atlas: { name: "Emporio de Arcana", stock: [["hiper_pocion", 0], ["pocion_maxima", 6], ["cura_total", 6], ["revivir_max", 7], ["ultra_capsula", 0], ["capsula_atlas", 0], ["capsula_veloz", 0], ["capsula_noche", 0], ["caramelo_exp_l", 6], ["elixir", 0]] }
  };
  function shopStock(id, badges) {
    const s = SHOPS[id] || SHOPS.general;
    return s.stock.filter(([, b]) => b <= badges && b < 99).map(([it]) => it);
  }

  // src/maps/helpers.js
  function interior(id, w, h, opts, fn) {
    const cx = opts.exitX ?? Math.floor(w / 2);
    defineMap(id, w, h, { indoor: true, music: "indoor", weather: false, fill: opts.floor || "wood", ...opts }, (m) => {
      for (let x = 0; x < w; x++) {
        m.put(x, 0, opts.wall || "wallint");
        m.put(x, 1, opts.wall || "wallint");
      }
      m.set(cx, h - 1, "mat");
      if (opts.exit) m.warp(cx, h - 1, opts.exit.to, opts.exit.spawn, 0, "down", { sfx: "door" });
      m.spawn("door", cx, h - 2, "up");
      fn(m, { cx, w, h });
    });
    return id;
  }
  function setRespawn(g, cityId, spawn) {
    const sp = getMap(cityId).spawns[spawn];
    if (sp) g.state.lastHeal = { map: cityId, x: sp.x, y: sp.y };
  }
  function defineShopInterior(cityId, shopId, { name = null, clerk = "tendero", roofLook = null } = {}) {
    const id = `int_${cityId}_tienda`;
    interior(id, 10, 8, { name: SHOPS[shopId]?.name || "Tienda", title: name || SHOPS[shopId]?.name || "Tienda", floor: "wood", exit: { to: cityId, spawn: "door_tienda" } }, (m, { cx }) => {
      for (let x = 1; x <= 6; x++) m.put(x, 3, "counter");
      m.put(8, 2, "shelf");
      m.put(9, 2, "shelf");
      m.put(1, 2, "shelf");
      m.put(2, 2, "shelf");
      m.put(7, 5, "crate");
      m.put(8, 5, "crate");
      m.put(1, 6, "plant");
      m.npc({ id: "tendero", x: 3, y: 2, dir: "down", look: look(clerk), name: "Dependiente", move: "static", talk: async (g) => {
        await g.say("\xA1Bienvenido! \xBFEn qu\xE9 puedo ayudarte?", { speaker: "Dependiente" });
        await g.openShop(shopId);
        await g.say("\xA1Gracias por tu visita!", { speaker: "Dependiente" });
      } });
      m.npc({ id: "cliente", x: 6, y: 5, dir: "up", look: look("nina"), name: "Cliente", text: "Las c\xE1psulas son lo m\xE1s importante del viaje. \xA1Lleva siempre unas cuantas!", move: "static" });
    });
    return id;
  }
  function defineHouse(cityId, key, { name = "Casa", w = 9, h = 7, npcs = [], decor = null, floor = "wood", title = null } = {}) {
    const id = `int_${cityId}_${key}`;
    interior(id, w, h, { name, title: title || name, floor, exit: { to: cityId, spawn: "door_" + key } }, (m, { cx }) => {
      m.put(1, 2, "bed");
      m.put(w - 2, 2, "bookcase");
      m.put(w - 3, 2, "shelf");
      m.put(3, 1, "window_int");
      m.put(2, 4, "table");
      m.put(w - 2, h - 2, "plant");
      m.rect(cx - 1, 3, 3, 2, "rug");
      for (const n of npcs) m.npc({ move: "static", ...n, look: typeof n.look === "string" ? look(n.look) : n.look });
      if (decor) decor(m);
    });
    return id;
  }

  // src/util.js
  var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  var fmtMoney = (n) => "\u20B3" + Math.floor(n).toLocaleString("es-ES");
  function fmtTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  }
  var uid = /* @__PURE__ */ (() => {
    let n = 0;
    return () => "u" + Date.now().toString(36) + (n++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  })();
  function el(tag, props = {}, kids = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of [].concat(kids)) {
      if (c == null || c === false) continue;
      n.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return n;
  }

  // src/data/species.js
  var species_exports = {};
  __export(species_exports, {
    BEHAVIORS: () => BEHAVIORS,
    EGG_GROUPS: () => EGG_GROUPS,
    RARITY: () => RARITY,
    RARITY_ORDER: () => RARITY_ORDER,
    SPECIES: () => SPECIES,
    SPECIES_BY_NAME: () => SPECIES_BY_NAME,
    SPECIES_LIST: () => SPECIES_LIST,
    STAT_KEYS: () => STAT_KEYS,
    STAT_NAMES: () => STAT_NAMES,
    TYPE_COUNT: () => TYPE_COUNT,
    XP_GROUPS: () => XP_GROUPS,
    canLearnTM: () => canLearnTM,
    evolutionFamily: () => evolutionFamily,
    getSpecies: () => getSpecies,
    learnsAtLevel: () => learnsAtLevel,
    movesAtLevel: () => movesAtLevel,
    speciesByHabitat: () => speciesByHabitat,
    speciesByName: () => speciesByName,
    xpForLevel: () => xpForLevel
  });

  // src/data/species_data.js
  var RAW = [];
  var S2 = (id, name, types, st, rar, o = {}) => RAW.push({ id, name, types: types.split("/"), st, rar, ...o });
  S2(1, "Brot\xEDn", "planta", [45, 50, 52, 62, 55, 40], "R", {
    cr: 45,
    h: 0.5,
    w: 6.5,
    xp: 64,
    g: "parab",
    ab: ["espesura", "aura_sanadora"],
    hab: [],
    egg: ["planta", "campo"],
    bh: "curioso",
    look: "blob ear:leaf tail:tuft eye:big mouth:smile pat:belly ex:sprout sz:.72",
    desc: "Un brote \xE1gil que vive pegado a su compa\xF1ero. La hoja de su cabeza se estira hacia el sol como una antena.",
    evo: [[2, 16]]
  });
  S2(2, "Frondeo", "planta", [60, 65, 68, 80, 70, 52], "R", {
    cr: 45,
    h: 1,
    w: 28,
    xp: 142,
    g: "parab",
    ab: ["espesura", "aura_sanadora"],
    hab: [],
    egg: ["planta", "campo"],
    bh: "curioso",
    look: "quad ear:leaf tail:leaf eye:big pat:belly ex:vines sz:.88",
    desc: "Las enredaderas de su lomo se agitan cuando huele peligro. Prefiere esquivar antes que golpear.",
    evo: [[3, 34]]
  });
  S2(3, "Selvar\xF3n", "planta/lucha", [80, 102, 90, 90, 84, 66], "R", {
    cr: 45,
    h: 1.9,
    w: 112,
    xp: 236,
    g: "parab",
    ab: ["espesura", "fuerza_pura"],
    hab: [],
    egg: ["planta", "monstruo"],
    bh: "terco",
    look: "bip ear:leaf arm:big tail:leaf eye:angry pat:band ex:mane sz:1.0",
    desc: "Guardi\xE1n de la espesura. Su corteza endurecida detiene hachas y colmillos; defiende a su entrenador con pu\xF1os de ra\xEDz."
  });
  S2(4, "Chisp\xEDn", "fuego", [39, 52, 43, 60, 50, 65], "R", {
    cr: 45,
    h: 0.5,
    w: 8.5,
    xp: 62,
    g: "parab",
    ab: ["llama_interior", "cuerpo_ardiente"],
    hab: [],
    egg: ["campo"],
    bh: "agresivo",
    look: "quad ear:point tail:flame eye:big pat:belly sz:.72",
    desc: "Una cr\xEDa traviesa cuya cola nunca se apaga. Si se enfada, salta chispas por todas partes.",
    evo: [[5, 16]]
  });
  S2(5, "Piroc\xE1n", "fuego", [58, 64, 58, 80, 65, 80], "R", {
    cr: 45,
    h: 1.1,
    w: 30,
    xp: 142,
    g: "parab",
    ab: ["llama_interior", "cuerpo_ardiente"],
    hab: [],
    egg: ["campo"],
    bh: "agresivo",
    look: "quad ear:point tail:flame ex:mane eye:angry pat:belly sz:.9",
    desc: "Corre tan r\xE1pido que deja un rastro de brasas. Su melena arde con m\xE1s fuerza cuanto m\xE1s feliz est\xE1.",
    evo: [[6, 36]]
  });
  S2(6, "Infernox", "fuego/dragon", [78, 84, 78, 109, 85, 100], "R", {
    cr: 45,
    h: 1.8,
    w: 90,
    xp: 240,
    g: "parab",
    ab: ["corazon_volcan", "llama_interior"],
    hab: [],
    egg: ["dragon", "monstruo"],
    bh: "agresivo",
    look: "quad horn:big wing:small tail:flame ex:mane eye:angry pat:band c1:#a8283a c2:#f0b868 c4:#f6b040 sz:1.0",
    desc: "Un drag\xF3n joven que domina las llamas con su aliento. Las leyendas dicen que su cola puede encender un volc\xE1n dormido."
  });
  S2(7, "Burb\xEDn", "agua", [44, 48, 65, 50, 64, 43], "R", {
    cr: 45,
    h: 0.5,
    w: 9,
    xp: 63,
    g: "parab",
    ab: ["marea_viva", "absorbe_agua"],
    hab: [],
    egg: ["agua", "campo"],
    bh: "sociable",
    look: "blob ear:fin tail:fin eye:big mouth:smile pat:belly ex:bubbles sz:.72",
    desc: "Siempre rodeado de burbujas. Las usa para jugar, esconderse y, si hace falta, para atontar a un rival.",
    evo: [[8, 16]]
  });
  S2(8, "Marejo", "agua", [59, 63, 80, 65, 80, 58], "R", {
    cr: 45,
    h: 1.1,
    w: 32,
    xp: 142,
    g: "parab",
    ab: ["marea_viva", "absorbe_agua"],
    hab: [],
    egg: ["agua", "campo"],
    bh: "sociable",
    look: "quad ear:fin tail:fin eye:big pat:belly ex:bubbles sz:.9",
    desc: "Nada y camina con la misma elegancia. Su piel resbaladiza desv\xEDa los golpes m\xE1s duros.",
    evo: [[9, 36]]
  });
  S2(9, "Abisal\xF3n", "agua/hielo", [79, 83, 100, 85, 105, 78], "R", {
    cr: 45,
    h: 2,
    w: 195,
    xp: 238,
    g: "parab",
    ab: ["marea_viva", "alma_glaciar"],
    hab: [],
    egg: ["agua", "monstruo"],
    bh: "terco",
    look: "bip horn:big arm:fin tail:fin ex:crystal eye:angry sz:1.02",
    desc: "Habita los mares helados del norte. Las cristalizaciones de su espalda reflejan la aurora y confunden a los rivales."
  });
  S2(10, "Pelus\xEDn", "aire", [40, 45, 40, 35, 35, 56], "C", {
    cr: 255,
    h: 0.3,
    w: 1.8,
    xp: 50,
    g: "medio",
    ab: ["ojo_critico", "insomnio"],
    hab: ["pradera", "playa"],
    egg: ["volador"],
    bh: "timido",
    look: "bird wing:small eye:big mouth:beak pat:belly sz:.62",
    desc: "Un polluelo esponjoso que nunca se aleja del nido. P\xEDa tan fuerte que se le oye desde la otra punta del prado.",
    evo: [[11, 14]]
  });
  S2(11, "Plumeo", "aire", [63, 60, 55, 50, 50, 71], "U", {
    cr: 120,
    h: 0.9,
    w: 15,
    xp: 112,
    g: "medio",
    ab: ["ojo_critico", "insomnio"],
    hab: ["pradera", "playa", "montana"],
    egg: ["volador"],
    bh: "curioso",
    look: "bird wing:feather tail:tuft eye:dot mouth:beak pat:belly ex:crest sz:.82",
    desc: "Sus alas ya levantan polvareda al despegar. Patrulla su territorio trazando c\xEDrculos cada vez m\xE1s amplios.",
    evo: [[12, 32]]
  });
  S2(12, "Alcar\xE1n", "aire/lucha", [83, 80, 75, 70, 70, 91], "R", {
    cr: 45,
    h: 1.5,
    w: 38,
    xp: 180,
    g: "medio",
    ab: ["ojo_critico", "intimidar"],
    hab: ["montana"],
    egg: ["volador"],
    bh: "agresivo",
    look: "bird wing:big tail:long eye:angry mouth:beak arm:claw pat:band ex:crest sz:1.0",
    desc: "Un halc\xF3n de monta\xF1a que se lanza en picado a gran velocidad. Su mirada fija intimida hasta a los dragones j\xF3venes."
  });
  S2(13, "Roed\xEDn", "tierra", [35, 46, 34, 35, 35, 60], "C", {
    cr: 255,
    h: 0.3,
    w: 3.5,
    xp: 48,
    g: "medio",
    ab: ["pies_arena", "robustez"],
    hab: ["pradera", "desierto"],
    egg: ["campo"],
    bh: "timido",
    look: "quad ear:round tail:tuft eye:big mouth:snout pat:belly sz:.6",
    desc: "Cava t\xFAneles diminutos bajo la hierba alta. Si lo asustas, desaparece en un abrir y cerrar de ojos.",
    evo: [[14, 20]]
  });
  S2(14, "Zapador", "tierra", [65, 90, 65, 45, 55, 100], "U", {
    cr: 90,
    h: 0.8,
    w: 28,
    xp: 130,
    g: "medio",
    ab: ["pies_arena", "fuerza_pura"],
    hab: ["pradera", "cueva", "desierto"],
    egg: ["campo"],
    bh: "agresivo",
    look: "quad ear:point arm:claw tail:club eye:angry mouth:fang pat:band sz:.85",
    desc: "Excava galer\xEDas enteras en una noche. Las garras de sus patas delanteras parten la roca como si fuera mantequilla."
  });
  S2(15, "Gusan\xEDn", "insecto", [45, 30, 35, 20, 20, 45], "C", {
    cr: 255,
    h: 0.3,
    w: 3,
    xp: 39,
    g: "medio",
    ab: ["plaga", "mente_clara"],
    hab: ["pradera", "bosque"],
    egg: ["bicho"],
    bh: "timido",
    look: "bug eye:big mouth:smile sz:.55",
    desc: "Devora hojas sin parar. Cuando est\xE1 lleno, se enrolla bajo un tronco y echa una cabezadita.",
    evo: [[16, 5]]
  });
  S2(16, "Capull\xEDn", "insecto", [50, 20, 55, 25, 25, 30], "C", {
    cr: 120,
    h: 0.7,
    w: 10,
    xp: 72,
    g: "medio",
    ab: ["piel_dura"],
    hab: ["bosque"],
    egg: ["bicho"],
    bh: "dormilon",
    look: "bug eye:sleepy ex:cocoon sz:.7",
    desc: "Se mantiene inm\xF3vil mientras su cuerpo cambia por dentro. Solo se mueve para esquivar el viento.",
    evo: [[17, 10]]
  });
  S2(17, "Lum\xEDnea", "insecto/luz", [60, 45, 50, 90, 80, 70], "U", {
    cr: 45,
    h: 1.1,
    w: 32,
    xp: 178,
    g: "medio",
    ab: ["ojo_compuesto", "aura_luz"],
    hab: ["bosque", "pradera"],
    egg: ["bicho"],
    bh: "curioso",
    look: "bug wing:moth ex:antenna eye:big pat:spots sz:.88",
    desc: "Sus alas esparcen un polvo luminoso que cura peque\xF1as heridas. De noche brillan como linternas."
  });
  S2(18, "Hormigu\xEDn", "insecto", [30, 56, 50, 25, 25, 50], "C", {
    cr: 230,
    h: 0.3,
    w: 2.5,
    xp: 45,
    g: "medio",
    ab: ["fuerza_pura", "robustez"],
    hab: ["pradera", "bosque"],
    egg: ["bicho"],
    bh: "sociable",
    look: "bug ex:antenna arm:claw eye:angry mouth:fang sz:.58",
    desc: "Vive en colonias disciplinadas. Una sola hormiga levanta cien veces su peso, y nunca va sola.",
    evo: [[19, 24]]
  });
  S2(19, "Soldad\xF3n", "insecto/lucha", [60, 100, 85, 40, 60, 75], "U", {
    cr: 75,
    h: 1.2,
    w: 40,
    xp: 148,
    g: "medio",
    ab: ["fuerza_pura", "intimidar"],
    hab: ["bosque"],
    egg: ["bicho"],
    bh: "agresivo",
    look: "bug ex:antenna arm:blade horn:small eye:angry mouth:fang pat:band sz:.95",
    desc: "Capit\xE1n de la colonia. Sus mand\xEDbulas blindadas crujen como espadas al chocar."
  });
  S2(20, "Sap\xEDn", "agua", [40, 45, 40, 50, 40, 55], "C", {
    cr: 230,
    h: 0.4,
    w: 5,
    xp: 52,
    g: "medio",
    ab: ["nado_veloz", "absorbe_agua"],
    hab: ["lago", "pantano"],
    egg: ["agua", "campo"],
    bh: "curioso",
    look: "blob eye:big mouth:smile ear:fin pat:spots sz:.62",
    desc: "Croa al ritmo de la lluvia. Su lengua pegajosa atrapa insectos antes de que lo noten.",
    evo: [[21, 22]]
  });
  S2(21, "Ranazo", "agua/lucha", [75, 92, 72, 68, 62, 76], "U", {
    cr: 75,
    h: 1.3,
    w: 60,
    xp: 150,
    g: "medio",
    ab: ["nado_veloz", "impulso"],
    hab: ["lago", "pantano"],
    egg: ["agua", "campo"],
    bh: "terco",
    look: "bip eye:angry mouth:smile arm:big pat:spots ear:fin sz:.95",
    desc: "Campe\xF3n de los estanques. Lanza pu\xF1etazos tan r\xE1pidos que levantan olas."
  });
  S2(22, "Volt\xEDn", "electrico", [35, 35, 30, 55, 40, 70], "C", {
    cr: 200,
    h: 0.4,
    w: 5,
    xp: 55,
    g: "medio",
    ab: ["estatica", "pararrayos"],
    hab: ["pradera", "bosque"],
    egg: ["campo"],
    bh: "curioso",
    look: "blob ear:round tail:bolt eye:big mouth:smile ex:sparks c1:#46b8e8 c2:#d8f4ff c3:#ffe24a sz:.62",
    desc: "Acumula electricidad en las mejillas. Un abrazo suyo en invierno da calambre.",
    evo: [[23, 18]]
  });
  S2(23, "Fulm\xEDn", "electrico", [55, 50, 45, 80, 60, 90], "U", {
    cr: 100,
    h: 0.8,
    w: 18,
    xp: 122,
    g: "medio",
    ab: ["estatica", "pararrayos"],
    hab: ["pradera", "montana"],
    egg: ["campo"],
    bh: "curioso",
    look: "quad ear:round tail:bolt eye:big mouth:snout ex:mane,sparks c1:#3aa6e0 c2:#e8f8ff c3:#ffe24a pat:belly sz:.82",
    desc: "Corre entre las nubes de tormenta absorbiendo rayos. Cuando se carga, su pelaje se eriza.",
    evo: [[24, 0, "item:gema_chispa"]]
  });
  S2(24, "Fulgur\xF3n", "electrico", [70, 65, 60, 110, 80, 105], "R", {
    cr: 45,
    h: 1.4,
    w: 42,
    xp: 215,
    g: "medio",
    ab: ["chispa_viva", "pararrayos"],
    hab: [],
    egg: ["campo"],
    bh: "agresivo",
    look: "quad horn:big ear:round tail:bolt eye:angry ex:mane,sparks pat:band c1:#2f86d8 c2:#dff4ff c3:#ffe24a sz:1.0",
    desc: "Un rel\xE1mpago con patas. Dicen que sus rugidos pueden verse antes de o\xEDrse."
  });
  S2(25, "Espor\xEDn", "planta", [50, 40, 55, 50, 50, 30], "C", {
    cr: 200,
    h: 0.3,
    w: 2.5,
    xp: 58,
    g: "medio",
    ab: ["espesura", "aura_sanadora"],
    hab: ["bosque", "pantano"],
    egg: ["planta"],
    bh: "timido",
    look: "plant eye:sleepy mouth:smile pat:spots sz:.6",
    desc: "Una seta peque\xF1a que suelta esporas inofensivas cuando duerme. Brilla un poco en la humedad.",
    evo: [[26, 28]]
  });
  S2(26, "Hongarr\xF3n", "planta/veneno", [85, 70, 90, 85, 85, 45], "U", {
    cr: 75,
    h: 1.1,
    w: 48,
    xp: 158,
    g: "medio",
    ab: ["puas_toxicas", "aura_sanadora"],
    hab: ["bosque", "pantano"],
    egg: ["planta"],
    bh: "terco",
    look: "plant eye:angry mouth:fang pat:spots arm:big ex:spores sz:.95",
    desc: "Sombrero enorme, esporas dulces y veneno terrible. Los viajeros prudentes dan un rodeo."
  });
  S2(27, "Murcil\xEDn", "aire/sombra", [40, 45, 35, 30, 40, 55], "C", {
    cr: 255,
    h: 0.4,
    w: 2.2,
    xp: 49,
    g: "medio",
    ab: ["ojo_compuesto", "insomnio"],
    hab: ["cueva"],
    egg: ["volador"],
    bh: "timido",
    tm: "n",
    look: "bird wing:bat ear:big eye:big mouth:fang sz:.6 hue:20",
    desc: "Se orienta en las cuevas con chillidos que ning\xFAn o\xEDdo humano percibe. Teme la luz del d\xEDa.",
    evo: [[28, 28]]
  });
  S2(28, "Murciel\xF3n", "aire/sombra", [75, 80, 70, 65, 75, 100], "U", {
    cr: 60,
    h: 1.6,
    w: 55,
    xp: 165,
    g: "medio",
    ab: ["ojo_compuesto", "aura_sombra"],
    hab: ["cueva", "ruinas"],
    egg: ["volador"],
    bh: "agresivo",
    look: "bird wing:bat ear:big eye:angry mouth:fang tail:spike sz:1.0 hue:20",
    desc: "Cuelga del techo de las cuevas m\xE1s hondas. Sus alas membranosas cortan el aire con un silbido."
  });
  S2(29, "Guijarro", "roca", [40, 60, 80, 30, 30, 20], "C", {
    cr: 230,
    h: 0.4,
    w: 25,
    xp: 55,
    g: "medio",
    ab: ["robustez", "piel_petrea"],
    hab: ["cueva", "montana"],
    egg: ["mineral"],
    bh: "terco",
    look: "golem eye:dot sz:.6",
    desc: "Parece una piedra m\xE1s hasta que te mira. Rueda cuesta abajo cuando se asusta.",
    evo: [[30, 25]]
  });
  S2(30, "Pe\xF1asco", "roca", [60, 85, 105, 40, 50, 30], "U", {
    cr: 120,
    h: 1,
    w: 105,
    xp: 130,
    g: "medio",
    ab: ["robustez", "piel_petrea"],
    hab: ["cueva", "montana"],
    egg: ["mineral"],
    bh: "terco",
    look: "golem arm:big eye:angry pat:band sz:.82",
    desc: "Un bloque de roca con brazos. Levanta bloques enormes para construir su guarida.",
    evo: [[31, 40]]
  });
  S2(31, "Monta\xF1\xF3n", "roca/tierra", [85, 115, 130, 55, 65, 40], "R", {
    cr: 45,
    h: 2.4,
    w: 300,
    xp: 210,
    g: "lento",
    ab: ["robustez", "coraza_antigua"],
    hab: ["montana"],
    egg: ["mineral"],
    bh: "terco",
    look: "golem arm:big eye:angry pat:band ex:crystal horn:small sz:1.05",
    desc: "Del tama\xF1o de una casa. Cuando duerme, los p\xE1jaros anidan en sus hombros y los l\xEDquenes cubren su espalda."
  });
  S2(32, "Arenito", "tierra", [40, 55, 50, 30, 40, 45], "C", {
    cr: 230,
    h: 0.4,
    w: 6,
    xp: 50,
    g: "medio",
    ab: ["pies_arena", "remolino_arena"],
    hab: ["desierto", "playa"],
    egg: ["campo", "mineral"],
    bh: "timido",
    look: "blob eye:dot mouth:smile ear:point tail:tuft sz:.62 c1:#d8b070",
    desc: "Se esconde bajo la arena con solo los ojos fuera. Los exploradores lo confunden con un montoncito de dunas.",
    evo: [[33, 26]]
  });
  S2(33, "Escorpiar", "tierra/veneno", [70, 95, 80, 50, 70, 70], "U", {
    cr: 75,
    h: 1,
    w: 42,
    xp: 150,
    g: "medio",
    ab: ["pies_arena", "puas_toxicas"],
    hab: ["desierto"],
    egg: ["bicho", "campo"],
    bh: "agresivo",
    look: "bug arm:claw tail:scorp eye:angry sz:.92 c1:#c89a50",
    desc: "La cola en forma de arp\xF3n inyecta un veneno que aletarga. Acecha entre las rocas calientes del desierto."
  });
  S2(34, "Cact\xEDn", "planta", [45, 45, 60, 50, 50, 35], "C", {
    cr: 200,
    h: 0.5,
    w: 7,
    xp: 56,
    g: "medio",
    ab: ["espinas", "absorbe_agua"],
    hab: ["desierto"],
    egg: ["planta"],
    bh: "timido",
    look: "plant eye:sleepy mouth:smile ear:none ex:flowerhead sz:.62 hue:-10",
    desc: "Guarda agua en su cuerpo durante meses. Las flores de su cabeza se abren solo tras la lluvia.",
    evo: [[35, 30]]
  });
  S2(35, "Cactarr\xF3n", "planta/tierra", [75, 85, 95, 70, 80, 45], "U", {
    cr: 75,
    h: 1.5,
    w: 90,
    xp: 160,
    g: "medio",
    ab: ["espinas", "piel_dura"],
    hab: ["desierto"],
    egg: ["planta"],
    bh: "terco",
    look: "plant eye:angry mouth:fang arm:big ex:flowerhead pat:spots sz:.98 hue:-10",
    desc: "Sus p\xFAas disparan al aire si lo molestan. Tras una tormenta, florece con colores imposibles."
  });
  S2(36, "Pecec\xEDn", "agua", [35, 45, 40, 35, 35, 65], "C", {
    cr: 255,
    h: 0.3,
    w: 2,
    xp: 44,
    g: "medio",
    ab: ["nado_veloz", "absorbe_agua"],
    hab: ["lago", "playa", "mar"],
    egg: ["agua"],
    bh: "timido",
    look: "fish eye:big mouth:smile tail:fin sz:.58",
    desc: "Viaja en bancos de cientos. Cada uno brilla un poco distinto, como escamas de arco\xEDris.",
    evo: [[37, 26]]
  });
  S2(37, "Tiburox", "agua/sombra", [75, 115, 70, 60, 60, 85], "U", {
    cr: 60,
    h: 2,
    w: 110,
    xp: 165,
    g: "medio",
    ab: ["intimidar", "nado_veloz"],
    hab: ["mar", "isla"],
    egg: ["agua"],
    bh: "agresivo",
    look: "fish eye:angry mouth:fang tail:fin pat:belly c1:#5b78a8 c2:#e8eef6 c4:#33507e sz:1.0",
    desc: "Un cazador veloz de aguas profundas. Se dice que huele una gota de sangre a tres leguas."
  });
  S2(38, "Pinz\xF3n", "agua", [45, 65, 70, 35, 40, 35], "C", {
    cr: 220,
    h: 0.4,
    w: 7,
    xp: 54,
    g: "medio",
    ab: ["piel_dura", "absorbe_agua"],
    hab: ["playa", "mar", "lago"],
    egg: ["agua", "bicho"],
    bh: "terco",
    look: "shell arm:claw eye:big sz:.62 hue:-15",
    desc: "Un cangrejo que no suelta lo que atrapa. Camina de lado y pellizca de frente.",
    evo: [[39, 28]]
  });
  S2(39, "Coral\xF3n", "agua/roca", [70, 100, 110, 65, 70, 50], "U", {
    cr: 75,
    h: 1.2,
    w: 90,
    xp: 155,
    g: "medio",
    ab: ["piel_dura", "piel_petrea"],
    hab: ["mar", "isla"],
    egg: ["agua", "mineral"],
    bh: "terco",
    look: "shell arm:claw eye:angry ex:crystal pat:spots sz:.95 hue:-15",
    desc: "Su caparaz\xF3n est\xE1 cubierto de coral vivo. Las peque\xF1as criaturas marinas viven en \xE9l como en un arrecife."
  });
  S2(40, "Medus\xEDn", "agua", [40, 25, 35, 65, 65, 50], "C", {
    cr: 190,
    h: 0.5,
    w: 4,
    xp: 60,
    g: "medio",
    ab: ["absorbe_agua", "pararrayos"],
    hab: ["lago", "playa", "mar"],
    egg: ["agua", "amorfo"],
    bh: "curioso",
    look: "float eye:big mouth:smile ex:tentacles sz:.65",
    desc: "Flota como una campana transl\xFAcida. Sus tent\xE1culos pican lo justo para que se aparten.",
    evo: [[41, 30]]
  });
  S2(41, "Medus\xF3n", "agua/espiritu", [80, 40, 70, 100, 95, 65], "R", {
    cr: 60,
    h: 1.8,
    w: 46,
    xp: 170,
    g: "medio",
    ab: ["absorbe_agua", "lamento_espiritual"],
    hab: ["mar", "isla", "pantano"],
    egg: ["agua", "amorfo"],
    bh: "sociable",
    look: "float eye:wide ex:tentacles pat:spots sz:1.0 hue:60",
    desc: "Un fantasma del mar que brilla en la noche. Los marineros juran que canta, aunque nadie ha o\xEDdo su voz."
  });
  S2(42, "Magm\xEDn", "fuego", [40, 50, 60, 50, 40, 25], "C", {
    cr: 200,
    h: 0.4,
    w: 22,
    xp: 55,
    g: "medio",
    ab: ["cuerpo_ardiente", "robustez"],
    hab: ["volcan", "cueva"],
    egg: ["mineral"],
    bh: "terco",
    look: "shell eye:big mouth:smile ex:flame pat:spots sz:.62 hue:-10",
    desc: "Un caracol de lava que deja un rastro humeante. Su caparaz\xF3n es tan caliente que cuece huevos.",
    evo: [[43, 30]]
  });
  S2(43, "Volcar\xF3n", "fuego/roca", [70, 80, 110, 90, 70, 35], "U", {
    cr: 75,
    h: 1.4,
    w: 160,
    xp: 165,
    g: "medio",
    ab: ["cuerpo_ardiente", "corazon_volcan"],
    hab: ["volcan"],
    egg: ["mineral"],
    bh: "terco",
    look: "shell eye:angry ex:flame horn:big pat:spots sz:1.0 hue:-10",
    desc: "Un volc\xE1n ambulante. Cuando se enfada, el cono de su espalda lanza ceniza ardiente."
  });
  S2(44, "Pavesa", "fuego", [38, 35, 40, 55, 50, 45], "U", {
    cr: 150,
    h: 0.3,
    w: 1,
    xp: 60,
    g: "medio",
    ab: ["llama_interior", "aura_sanadora"],
    hab: ["volcan", "ruinas"],
    egg: ["amorfo", "fantasia"],
    bh: "curioso",
    tm: "n",
    look: "float eye:big ex:flame sz:.58 hue:25",
    desc: "Una llamita a la deriva que busca calor en cuevas y ruinas. Se apaga si la dejan sola demasiado tiempo.",
    evo: [[45, 20]]
  });
  S2(45, "Cirio", "fuego/espiritu", [60, 50, 60, 85, 75, 60], "R", {
    cr: 75,
    h: 0.9,
    w: 5,
    xp: 140,
    g: "medio",
    ab: ["llama_interior", "lamento_espiritual"],
    hab: ["volcan", "ruinas"],
    egg: ["amorfo", "fantasia"],
    bh: "curioso",
    look: "float eye:wide ex:flame tail:long sz:.82 hue:25",
    desc: "Un esp\xEDritu de cera derretida con una llama azulada. Gu\xEDa a los perdidos o los desorienta, seg\xFAn su humor.",
    evo: [[46, 0, "item:gema_ocaso"]]
  });
  S2(46, "Candel\xF3n", "fuego/espiritu", [78, 62, 82, 115, 95, 78], "V", {
    cr: 45,
    h: 1.6,
    w: 12,
    xp: 220,
    g: "medio",
    ab: ["corazon_volcan", "lamento_espiritual"],
    hab: [],
    egg: ["amorfo", "fantasia"],
    bh: "sociable",
    look: "float eye:wide ex:flame tail:long arm:fin pat:gems sz:1.0 hue:25",
    desc: "Un candelabro vivo que alumbra los pasillos de las ruinas. Su llama no calienta: hiela."
  });
  S2(47, "Cop\xEDn", "hielo", [40, 35, 35, 55, 50, 45], "C", {
    cr: 220,
    h: 0.3,
    w: 1.5,
    xp: 52,
    g: "medio",
    ab: ["alma_glaciar", "patinaje"],
    hab: ["nieve"],
    egg: ["amorfo"],
    bh: "curioso",
    look: "blob eye:big mouth:smile ex:snow sz:.58",
    desc: "Un copo de nieve con vida propia. Se disuelve en tu mano, pero nunca del todo.",
    evo: [[48, 20]]
  });
  S2(48, "Nevisca", "hielo", [62, 50, 55, 80, 70, 65], "U", {
    cr: 100,
    h: 0.9,
    w: 12,
    xp: 120,
    g: "medio",
    ab: ["alma_glaciar", "patinaje"],
    hab: ["nieve"],
    egg: ["amorfo"],
    bh: "curioso",
    look: "float eye:big mouth:smile ex:snow tail:long sz:.82",
    desc: "Danza en las tormentas de nieve. All\xED donde pasa, la escarcha florece en los cristales.",
    evo: [[49, 0, "item:gema_escarcha"]]
  });
  S2(49, "Ventisquero", "hielo/aire", [80, 65, 75, 110, 95, 90], "V", {
    cr: 45,
    h: 1.6,
    w: 25,
    xp: 210,
    g: "medio",
    ab: ["alma_glaciar", "patinaje"],
    hab: [],
    egg: ["amorfo"],
    bh: "sociable",
    look: "float wing:feather eye:wide ex:snow tail:long sz:1.0",
    desc: "Un remolino de nieve con alas. Cuando agita su cola desciende la temperatura de toda la monta\xF1a."
  });
  S2(50, "Polar\xEDn", "hielo", [55, 60, 55, 35, 40, 35], "C", {
    cr: 200,
    h: 0.6,
    w: 30,
    xp: 56,
    g: "medio",
    ab: ["pelaje_grueso", "alma_glaciar"],
    hab: ["nieve"],
    egg: ["campo"],
    bh: "sociable",
    look: "quad ear:round tail:tuft eye:big mouth:snout pat:belly sz:.68",
    desc: "Un osezno que se desliza panza abajo por las laderas. Duerme abrazado a su hermano.",
    evo: [[51, 32]]
  });
  S2(51, "Polaron", "hielo/lucha", [90, 110, 85, 50, 70, 60], "U", {
    cr: 60,
    h: 2,
    w: 240,
    xp: 170,
    g: "medio",
    ab: ["pelaje_grueso", "fuerza_pura"],
    hab: ["nieve"],
    egg: ["campo"],
    bh: "agresivo",
    look: "bip ear:round arm:claw eye:angry mouth:fang pat:band sz:1.05",
    desc: "Rompe el hielo con un pu\xF1etazo. Un solo rugido provoca avalanchas en las cumbres."
  });
  S2(52, "Pu\xF1\xEDn", "lucha", [45, 60, 40, 30, 35, 45], "C", {
    cr: 220,
    h: 0.5,
    w: 11,
    xp: 50,
    g: "medio",
    ab: ["fuerza_pura", "robustez"],
    hab: ["montana", "pradera"],
    egg: ["monstruo"],
    bh: "agresivo",
    look: "bip arm:big eye:angry mouth:smile sz:.65",
    desc: "Entrena golpeando troncos desde que sale el sol. A\xFAn no sabe encajar un golpe, pero nunca se rinde.",
    evo: [[53, 22]]
  });
  S2(53, "Pu\xF1et\xF3n", "lucha", [70, 90, 65, 45, 55, 60], "U", {
    cr: 100,
    h: 1.2,
    w: 55,
    xp: 120,
    g: "medio",
    ab: ["fuerza_pura", "impulso"],
    hab: ["montana"],
    egg: ["monstruo"],
    bh: "agresivo",
    look: "bip arm:big eye:angry mouth:fang pat:band sz:.85",
    desc: "Tiene los nudillos como piedras. Busca rivales fuertes para medirse, no para vencerlos.",
    evo: [[54, 36]]
  });
  S2(54, "Titanox", "lucha", [90, 125, 90, 55, 70, 70], "R", {
    cr: 45,
    h: 2,
    w: 130,
    xp: 210,
    g: "lento",
    ab: ["fuerza_pura", "intimidar"],
    hab: [],
    egg: ["monstruo"],
    bh: "terco",
    look: "bip arm:big eye:angry mouth:fang pat:band ex:mane horn:small sz:1.05",
    desc: "Un coloso de m\xFAsculos como cuerdas. Respeta a quien le planta cara, aunque pierda."
  });
  S2(55, "Macaqu\xEDn", "lucha", [50, 55, 45, 45, 45, 70], "C", {
    cr: 200,
    h: 0.6,
    w: 12,
    xp: 54,
    g: "medio",
    ab: ["impulso", "ojo_critico"],
    hab: ["bosque"],
    egg: ["campo"],
    bh: "curioso",
    look: "bip ear:round tail:long eye:big mouth:smile pat:belly sz:.68",
    desc: "Salta de rama en rama imitando todo lo que ve. Es capaz de copiar un golpe tras verlo una vez.",
    evo: [[56, 28]]
  });
  S2(56, "Macaquirr\xF3n", "lucha/planta", [76, 88, 72, 62, 68, 94], "U", {
    cr: 60,
    h: 1.4,
    w: 50,
    xp: 155,
    g: "medio",
    ab: ["impulso", "espesura"],
    hab: ["bosque"],
    egg: ["campo"],
    bh: "agresivo",
    look: "bip ear:round tail:leaf arm:big eye:angry mouth:fang pat:belly ex:vines sz:.95",
    desc: "L\xEDder de su tropa. Combina golpes de artes marciales con trucos de la selva que nadie le ense\xF1\xF3."
  });
  S2(57, "Serp\xEDn", "veneno", [40, 50, 45, 40, 40, 55], "C", {
    cr: 230,
    h: 0.8,
    w: 3,
    xp: 50,
    g: "medio",
    ab: ["puas_toxicas", "mente_clara"],
    hab: ["pantano", "pradera"],
    egg: ["campo", "dragon"],
    bh: "timido",
    look: "snake eye:slit mouth:fang sz:.62",
    desc: "Mordisquea por defensa y sisea sin parar. Se camufla perfectamente entre la maleza h\xFAmeda.",
    evo: [[58, 22]]
  });
  S2(58, "V\xEDbora", "veneno", [60, 80, 65, 60, 60, 75], "U", {
    cr: 100,
    h: 1.8,
    w: 18,
    xp: 130,
    g: "medio",
    ab: ["puas_toxicas", "intimidar"],
    hab: ["pantano"],
    egg: ["campo", "dragon"],
    bh: "agresivo",
    look: "snake eye:slit mouth:fang horn:small pat:band sz:.82",
    desc: "Hipnotiza a sus presas balanceando la cabeza. Su mordedura paraliza antes que envenena.",
    evo: [[59, 38]]
  });
  S2(59, "Basilisco", "veneno/dragon", [80, 105, 90, 80, 80, 85], "R", {
    cr: 45,
    h: 3.2,
    w: 75,
    xp: 215,
    g: "medio",
    ab: ["puas_toxicas", "aura_eclipse"],
    hab: [],
    egg: ["campo", "dragon"],
    bh: "agresivo",
    look: "snake eye:slit mouth:fang horn:big ex:crest pat:band sz:1.05",
    desc: "Antiguas cr\xF3nicas lo describen como un drag\xF3n sin alas. Su mirada es tan hipn\xF3tica como su veneno."
  });
  S2(60, "Mist\xEDn", "mental", [42, 35, 40, 60, 55, 60], "U", {
    cr: 150,
    h: 0.5,
    w: 7,
    xp: 62,
    g: "medio",
    ab: ["aura_sanadora", "ojo_compuesto"],
    hab: ["pradera", "bosque"],
    egg: ["campo", "fantasia"],
    bh: "curioso",
    look: "quad ear:point tail:fluff eye:big ex:gem pat:belly sz:.65",
    desc: "Un zorrito con una gema en la frente. Si te mira fijamente, sientes que sabe lo que piensas.",
    evo: [[61, 24]]
  });
  S2(61, "Ilusor", "mental", [62, 50, 55, 85, 75, 80], "R", {
    cr: 75,
    h: 1.1,
    w: 22,
    xp: 140,
    g: "medio",
    ab: ["aura_sanadora", "ojo_compuesto"],
    hab: ["bosque"],
    egg: ["campo", "fantasia"],
    bh: "curioso",
    look: "quad ear:point tail:fluff eye:wide ex:gem pat:belly sz:.88",
    desc: "Crea ilusiones de s\xED mismo para desorientar a los depredadores. Nadie sabe cu\xE1l de sus colas es la real.",
    evo: [[62, 0, "item:gema_solar"]]
  });
  S2(62, "Or\xE1culo", "mental/luz", [75, 58, 72, 118, 100, 92], "V", {
    cr: 45,
    h: 1.5,
    w: 35,
    xp: 218,
    g: "medio",
    ab: ["aura_luz", "aura_sanadora"],
    hab: [],
    egg: ["campo", "fantasia"],
    bh: "sociable",
    look: "quad ear:point tail:fluff eye:wide ex:halo pat:gems sz:1.0",
    desc: "Se dice que predice el futuro con sus nueve colas de luz. Rara vez muestra su rostro a la gente."
  });
  S2(63, "Lechuz", "mental/aire", [50, 40, 45, 60, 55, 50], "C", {
    cr: 180,
    h: 0.5,
    w: 2.5,
    xp: 58,
    g: "medio",
    ab: ["insomnio", "ojo_compuesto"],
    hab: ["bosque"],
    egg: ["volador"],
    bh: "curioso",
    tm: "n",
    look: "bird wing:small ear:point eye:big mouth:beak pat:belly sz:.65",
    desc: "Gira la cabeza casi del todo y no hace ruido al volar. Es la vigilante m\xE1s callada del bosque.",
    evo: [[64, 34]]
  });
  S2(64, "Sabiolo", "mental/aire", [78, 58, 72, 98, 92, 68], "U", {
    cr: 60,
    h: 1.3,
    w: 34,
    xp: 170,
    g: "medio",
    ab: ["insomnio", "ojo_compuesto"],
    hab: ["bosque", "ruinas"],
    egg: ["volador"],
    bh: "sociable",
    tm: "n",
    look: "bird wing:big ear:point eye:wide mouth:beak pat:belly ex:crest sz:.92",
    desc: "Un viejo b\xFAho que acumula historias. Los m\xE1s ancianos de los pueblos a\xFAn le piden consejo."
  });
  S2(65, "So\xF1ol\xEDn", "mental", [70, 45, 45, 45, 60, 25], "C", {
    cr: 190,
    h: 0.8,
    w: 45,
    xp: 62,
    g: "lento",
    ab: ["insomnio", "aura_sanadora"],
    hab: ["cueva", "pradera"],
    egg: ["campo"],
    bh: "dormilon",
    look: "blob ear:round eye:sleepy mouth:smile pat:belly sz:.8",
    desc: "Se pasa quince horas al d\xEDa dormido. Cuando sue\xF1a, sus sue\xF1os flotan sobre \xE9l como pompas.",
    evo: [[66, 30, "time:noche"]]
  });
  S2(66, "On\xEDrico", "mental/espiritu", [100, 60, 70, 95, 105, 40], "U", {
    cr: 60,
    h: 1.8,
    w: 150,
    xp: 175,
    g: "lento",
    ab: ["aura_sanadora", "lamento_espiritual"],
    hab: [],
    egg: ["campo"],
    bh: "dormilon",
    look: "blob ear:round eye:sleepy ex:cloud pat:belly arm:fin sz:1.05 hue:15",
    desc: "Se alimenta de sue\xF1os ajenos. Si te encuentras con \xE9l, tendr\xE1s una noche extra\xF1a pero tranquila."
  });
  S2(67, "Noctur\xEDn", "sombra", [40, 52, 40, 45, 40, 63], "C", {
    cr: 200,
    h: 0.4,
    w: 5,
    xp: 52,
    g: "medio",
    ab: ["aura_sombra", "ojo_compuesto"],
    hab: ["bosque", "pradera"],
    egg: ["campo"],
    bh: "curioso",
    tm: "n",
    look: "quad ear:point tail:long eye:slit mouth:smile sz:.62",
    desc: "Un gatito negro de ojos violeta. Solo sale al anochecer y desaparece si lo miras demasiado.",
    evo: [[68, 28, "time:noche"]]
  });
  S2(68, "Panter\xF3n", "sombra", [68, 98, 66, 70, 66, 100], "R", {
    cr: 50,
    h: 1.5,
    w: 60,
    xp: 178,
    g: "medio",
    ab: ["aura_sombra", "impulso"],
    hab: ["bosque"],
    egg: ["campo"],
    bh: "agresivo",
    tm: "n",
    look: "quad ear:point tail:long eye:slit mouth:fang pat:band sz:1.0",
    desc: "Una pantera hecha de sombra. Se lanza desde la oscuridad con una precisi\xF3n escalofriante."
  });
  S2(69, "Cuerv\xEDn", "sombra/aire", [45, 55, 40, 45, 40, 60], "C", {
    cr: 200,
    h: 0.5,
    w: 3.5,
    xp: 54,
    g: "medio",
    ab: ["ojo_critico", "insomnio"],
    hab: ["cueva", "nieve", "ruinas"],
    egg: ["volador"],
    bh: "curioso",
    look: "bird wing:small eye:slit mouth:beak sz:.65 hue:-20",
    desc: "Roba objetos brillantes y los esconde en grietas. Algunos exploradores recuperan as\xED tesoros perdidos.",
    evo: [[70, 30, "time:noche"]]
  });
  S2(70, "Corvux", "sombra/aire", [78, 95, 62, 70, 62, 88], "U", {
    cr: 75,
    h: 1.3,
    w: 28,
    xp: 160,
    g: "medio",
    ab: ["ojo_critico", "aura_sombra"],
    hab: ["ruinas"],
    egg: ["volador"],
    bh: "agresivo",
    tm: "n",
    look: "bird wing:big tail:long eye:slit mouth:beak ex:crest sz:.95 hue:-20",
    desc: "L\xEDder de bandadas de cuervos. Dicen que sabe d\xF3nde guarda cada ladr\xF3n su bot\xEDn."
  });
  S2(71, "Hal\xEDn", "luz", [45, 35, 45, 60, 60, 50], "U", {
    cr: 130,
    h: 0.4,
    w: 3,
    xp: 62,
    g: "medio",
    ab: ["aura_luz", "aura_sanadora"],
    hab: ["pradera", "montana"],
    egg: ["fantasia", "volador"],
    bh: "sociable",
    look: "float wing:small ex:halo eye:big mouth:smile sz:.6",
    desc: "Un angelito redondo que flota sobre los prados. Su halo es c\xE1lido al tacto.",
    evo: [[72, 0, "friend"]]
  });
  S2(72, "Aureolo", "luz", [65, 50, 65, 85, 85, 70], "R", {
    cr: 75,
    h: 0.9,
    w: 8,
    xp: 140,
    g: "medio",
    ab: ["aura_luz", "aura_sanadora"],
    hab: [],
    egg: ["fantasia", "volador"],
    bh: "sociable",
    look: "float wing:feather ex:halo eye:big arm:fin sz:.82",
    desc: "Aparece cuando un entrenador cuida a su compa\xF1ero con cari\xF1o. Su aureola crece con la amistad.",
    evo: [[73, 0, "item:gema_solar"]]
  });
  S2(73, "Seraf\xEDn", "luz/aire", [82, 62, 78, 112, 100, 90], "V", {
    cr: 40,
    h: 1.7,
    w: 30,
    xp: 225,
    g: "medio",
    ab: ["aura_alba", "aura_sanadora"],
    hab: [],
    egg: ["fantasia", "volador"],
    bh: "sociable",
    look: "float wing:big ex:halo eye:wide arm:fin pat:gems sz:1.0",
    desc: "Un mensajero del amanecer. Donde extiende sus seis alas, la lluvia amaina y brota el trigo."
  });
  S2(74, "Cervatillo", "planta", [55, 48, 52, 50, 52, 55], "C", {
    cr: 190,
    h: 0.8,
    w: 20,
    xp: 58,
    g: "medio",
    ab: ["espesura", "aura_sanadora"],
    hab: ["bosque", "pradera"],
    egg: ["campo"],
    bh: "timido",
    look: "quad ear:leaf horn:small eye:big mouth:snout pat:spots sz:.7",
    desc: "Un cervatillo moteado de hojas. Se queda quieto como una estatua para pasar desapercibido.",
    evo: [[75, 28, "friend"]]
  });
  S2(75, "Albaciervo", "planta/luz", [88, 82, 84, 76, 88, 78], "R", {
    cr: 60,
    h: 1.9,
    w: 110,
    xp: 180,
    g: "medio",
    ab: ["aura_luz", "espesura"],
    hab: [],
    egg: ["campo"],
    bh: "sociable",
    look: "quad ear:leaf horn:antler eye:wide mouth:snout pat:spots ex:halo sz:1.0",
    desc: "Sus astas florecen con la primavera. Los habitantes del bosque lo consideran un protector."
  });
  S2(76, "Tornill\xEDn", "metal", [40, 55, 70, 30, 35, 35], "C", {
    cr: 220,
    h: 0.3,
    w: 12,
    xp: 52,
    g: "medio",
    ab: ["piel_dura", "robustez"],
    hab: ["cueva", "ruinas"],
    egg: ["mineral"],
    bh: "curioso",
    look: "golem eye:big ex:gear sz:.58",
    desc: "Un peque\xF1o aut\xF3mata de tuercas. Nadie recuerda qui\xE9n lo fabric\xF3, pero sigue funcionando.",
    evo: [[77, 25, "place:cueva"]]
  });
  S2(77, "Engran\xF3n", "metal", [60, 85, 95, 45, 55, 50], "U", {
    cr: 100,
    h: 1,
    w: 85,
    xp: 125,
    g: "medio",
    ab: ["piel_dura", "robustez"],
    hab: ["cueva", "ruinas"],
    egg: ["mineral"],
    bh: "terco",
    look: "golem arm:big eye:angry ex:gear pat:band sz:.82",
    desc: "Sus engranajes giran al comp\xE1s de su respiraci\xF3n. Si tose, sale vapor.",
    evo: [[78, 42]]
  });
  S2(78, "Coloso F\xE9rreo", "metal/roca", [85, 120, 130, 50, 70, 45], "R", {
    cr: 40,
    h: 2.5,
    w: 420,
    xp: 222,
    g: "lento",
    ab: ["coraza_antigua", "robustez"],
    hab: [],
    egg: ["mineral"],
    bh: "terco",
    look: "golem arm:big eye:angry ex:gear horn:small pat:band sz:1.06",
    desc: "Una m\xE1quina viva forjada hace milenios. Aplasta rocas con un movimiento de brazo."
  });
  S2(79, "Espad\xEDn", "metal/espiritu", [40, 55, 65, 35, 45, 45], "U", {
    cr: 120,
    h: 0.5,
    w: 3,
    xp: 62,
    g: "medio",
    ab: ["piel_dura", "lamento_espiritual"],
    hab: ["ruinas"],
    egg: ["mineral", "fantasia"],
    bh: "curioso",
    look: "float eye:wide ex:blade sz:.6",
    desc: "Una espada vac\xEDa que se mueve sola. Se dice que guarda el esp\xEDritu de un caballero olvidado.",
    evo: [[80, 30]]
  });
  S2(80, "Hojad\xF3n", "metal/espiritu", [65, 100, 115, 50, 75, 65], "R", {
    cr: 60,
    h: 1.4,
    w: 25,
    xp: 175,
    g: "medio",
    ab: ["coraza_antigua", "lamento_espiritual"],
    hab: [],
    egg: ["mineral", "fantasia"],
    bh: "terco",
    look: "float arm:blade eye:wide ex:blade pat:band sz:1.0",
    desc: "Un guerrero fantasma con un escudo y una espada que fueron de otra era. No ataca sin ser desafiado."
  });
  S2(81, "Drac\xEDn", "dragon", [45, 64, 45, 50, 50, 50], "R", {
    cr: 45,
    h: 0.9,
    w: 3.3,
    xp: 60,
    g: "lento",
    ab: ["intimidar", "plaga"],
    hab: ["montana"],
    egg: ["dragon", "agua"],
    bh: "curioso",
    look: "snake eye:big mouth:smile horn:small ear:fin sz:.65",
    desc: "Una peque\xF1a serpiente de aire que vive en cascadas de altura. Es esquiva y muy t\xEDmida.",
    evo: [[82, 30]]
  });
  S2(82, "Dragonar", "dragon", [65, 84, 65, 70, 70, 70], "R", {
    cr: 45,
    h: 2.1,
    w: 16,
    xp: 140,
    g: "lento",
    ab: ["intimidar", "nube_lluvia"],
    hab: ["montana"],
    egg: ["dragon", "agua"],
    bh: "terco",
    look: "drag wing:small eye:big horn:small tail:long sz:.9",
    desc: "Un joven drag\xF3n que ya vuela. Sus alas diminutas lo sostienen gracias a su magia natural.",
    evo: [[83, 50]]
  });
  S2(83, "Drakonor", "dragon/aire", [91, 134, 95, 100, 100, 80], "E", {
    cr: 25,
    h: 2.2,
    w: 210,
    xp: 300,
    g: "lento",
    ab: ["intimidar", "robustez"],
    hab: [],
    egg: ["dragon"],
    bh: "terco",
    look: "drag wing:big horn:big eye:angry tail:long arm:claw pat:belly sz:1.05",
    desc: "Un drag\xF3n majestuoso que cruza el oc\xE9ano en un d\xEDa. Rescata a n\xE1ufragos aunque no sea su costumbre."
  });
  S2(84, "Cant\xEDn", "sonido/aire", [45, 40, 40, 60, 45, 60], "C", {
    cr: 220,
    h: 0.3,
    w: 1.6,
    xp: 53,
    g: "medio",
    ab: ["voz_potente", "ojo_critico"],
    hab: ["pradera", "bosque", "montana"],
    egg: ["volador"],
    bh: "sociable",
    look: "bird wing:small eye:big mouth:beak ex:notes sz:.6",
    desc: "Un pajarito cantor. Cada macho tiene una melod\xEDa propia que ense\xF1a a sus cr\xEDas.",
    evo: [[85, 26]]
  });
  S2(85, "Cantor", "sonido/aire", [70, 55, 60, 100, 70, 95], "U", {
    cr: 90,
    h: 0.9,
    w: 9,
    xp: 140,
    g: "medio",
    ab: ["voz_potente", "ojo_critico"],
    hab: ["bosque", "montana"],
    egg: ["volador"],
    bh: "sociable",
    look: "bird wing:feather tail:long eye:big mouth:beak ex:notes pat:belly sz:.82",
    desc: "Su canto cambia el clima de \xE1nimo del bosque entero. Los animales dejan de pelear cuando lo oyen."
  });
  S2(86, "Campan\xEDn", "sonido", [50, 45, 60, 55, 50, 35], "C", {
    cr: 200,
    h: 0.4,
    w: 6,
    xp: 55,
    g: "medio",
    ab: ["voz_potente", "piel_dura"],
    hab: ["ruinas", "montana", "cueva"],
    egg: ["mineral"],
    bh: "timido",
    look: "bell eye:big mouth:smile c1:#c99a3c c2:#f2dc8a sz:.6",
    desc: "Una campana peque\xF1a que suena con el viento. Los antiguos pueblos las colgaban en las puertas.",
    evo: [[87, 32]]
  });
  S2(87, "Campan\xF3n", "sonido/metal", [85, 65, 95, 90, 80, 45], "U", {
    cr: 75,
    h: 1.4,
    w: 130,
    xp: 160,
    g: "medio",
    ab: ["voz_potente", "coraza_antigua"],
    hab: ["ruinas"],
    egg: ["mineral"],
    bh: "terco",
    look: "bell eye:angry arm:big pat:band c1:#c99a3c c2:#f2dc8a sz:1.0",
    desc: "Su repique atraviesa las rocas. Los mineros lo oyen avisar cuando se acerca un derrumbe."
  });
  S2(88, "Tambor\xEDn", "sonido", [55, 60, 50, 45, 45, 45], "C", {
    cr: 200,
    h: 0.5,
    w: 8,
    xp: 54,
    g: "medio",
    ab: ["voz_potente", "fuerza_pura"],
    hab: ["bosque", "montana"],
    egg: ["campo"],
    bh: "agresivo",
    look: "bip arm:big eye:big mouth:smile ex:drum sz:.65",
    desc: "Lleva un tambor en la barriga y lo toca cuando est\xE1 contento. Es muy ruidoso, pero buena compa\xF1\xEDa.",
    evo: [[89, 34]]
  });
  S2(89, "Tronador", "sonido/lucha", [90, 98, 72, 66, 68, 58], "U", {
    cr: 60,
    h: 1.7,
    w: 95,
    xp: 165,
    g: "medio",
    ab: ["voz_potente", "intimidar"],
    hab: ["montana"],
    egg: ["campo"],
    bh: "agresivo",
    look: "bip arm:big eye:angry mouth:fang ex:drum pat:band sz:1.0",
    desc: "Con cada golpe de tambor hace temblar el suelo. Su ritmo marca el comp\xE1s de las batallas."
  });
  S2(90, "Brum\xEDn", "espiritu", [35, 30, 35, 55, 45, 50], "C", {
    cr: 200,
    h: 0.4,
    w: 0.5,
    xp: 52,
    g: "medio",
    ab: ["levitar", "lamento_espiritual"],
    hab: ["pantano", "ruinas"],
    egg: ["amorfo"],
    bh: "timido",
    tm: "n",
    look: "float eye:big mouth:smile tail:long sz:.58",
    desc: "Una brizna de niebla con ojos curiosos. Se queda en los rincones sin que lo vea nadie.",
    evo: [[91, 22]]
  });
  S2(91, "Nebl\xEDn", "espiritu", [55, 45, 50, 80, 65, 70], "U", {
    cr: 100,
    h: 1,
    w: 1.2,
    xp: 120,
    g: "medio",
    ab: ["levitar", "lamento_espiritual"],
    hab: ["pantano", "ruinas"],
    egg: ["amorfo"],
    bh: "curioso",
    tm: "n",
    look: "float eye:wide mouth:fang arm:fin tail:long sz:.82",
    desc: "Aparece en las noches de niebla gimiendo suavemente. Quien lo oye cree escuchar a un viejo conocido.",
    evo: [[92, 38]]
  });
  S2(92, "Aparecido", "espiritu", [70, 60, 70, 115, 90, 85], "R", {
    cr: 45,
    h: 1.6,
    w: 2.5,
    xp: 205,
    g: "medio",
    ab: ["levitar", "aura_sombra"],
    hab: [],
    egg: ["amorfo"],
    bh: "agresivo",
    look: "float eye:wide mouth:fang arm:fin tail:long ex:crown sz:1.0",
    desc: "El esp\xEDritu de un antiguo se\xF1or del pantano. Observa los viajes desde lejos y a veces los gu\xEDa."
  });
  S2(93, "Antifaz", "espiritu", [50, 55, 60, 50, 50, 45], "C", {
    cr: 190,
    h: 0.5,
    w: 2,
    xp: 58,
    g: "medio",
    ab: ["levitar", "insomnio"],
    hab: ["ruinas", "cueva"],
    egg: ["fantasia"],
    bh: "curioso",
    look: "float eye:wide ex:mask sz:.62",
    desc: "Una m\xE1scara de piedra que flota en las ruinas. Cambia de expresi\xF3n seg\xFAn el humor del que la mira.",
    evo: [[94, 0, "item:gema_ocaso"]]
  });
  S2(94, "Mascar\xF3n", "espiritu/sombra", [78, 90, 90, 66, 78, 66], "R", {
    cr: 60,
    h: 1.4,
    w: 22,
    xp: 178,
    g: "medio",
    ab: ["levitar", "aura_sombra"],
    hab: [],
    egg: ["fantasia"],
    bh: "agresivo",
    look: "float eye:wide ex:mask arm:blade pat:band tail:long sz:1.0",
    desc: "Una m\xE1scara ceremonial con capa de sombras. Los arque\xF3logos dicen que se vigilaba a s\xED misma."
  });
  S2(95, "Ara\xF1\xEDn", "insecto", [40, 50, 45, 45, 40, 55], "C", {
    cr: 220,
    h: 0.3,
    w: 3,
    xp: 50,
    g: "medio",
    ab: ["plaga", "puas_toxicas"],
    hab: ["bosque", "cueva"],
    egg: ["bicho"],
    bh: "timido",
    look: "bug arm:claw eye:three mouth:fang pat:spots sz:.58",
    desc: "Teje telara\xF1as tan finas que solo se ven al amanecer. Atrapa insectos y gotas de roc\xEDo.",
    evo: [[96, 28]]
  });
  S2(96, "Tejedora", "insecto/veneno", [70, 80, 70, 85, 70, 85], "U", {
    cr: 75,
    h: 1.4,
    w: 38,
    xp: 158,
    g: "medio",
    ab: ["plaga", "puas_toxicas"],
    hab: ["bosque", "pantano"],
    egg: ["bicho"],
    bh: "agresivo",
    look: "bug arm:blade eye:three mouth:fang pat:spots tail:spike sz:.95",
    desc: "Su seda se usa para bordar trajes de gala. No es tan generosa si te acercas a su nido."
  });
  S2(97, "Mant\xEDn", "insecto", [45, 60, 45, 40, 45, 65], "U", {
    cr: 130,
    h: 0.5,
    w: 4,
    xp: 60,
    g: "medio",
    ab: ["plaga", "ojo_critico"],
    hab: ["bosque", "pradera"],
    egg: ["bicho"],
    bh: "agresivo",
    look: "bug arm:blade eye:angry mouth:smile sz:.65",
    desc: "Una peque\xF1a mantis que se camufla en las hojas. Sus guada\xF1as todav\xEDa est\xE1n afil\xE1ndose.",
    evo: [[98, 33]]
  });
  S2(98, "Guada\xF1\xF3n", "insecto/aire", [72, 105, 72, 50, 68, 98], "R", {
    cr: 50,
    h: 1.7,
    w: 30,
    xp: 178,
    g: "medio",
    ab: ["plaga", "ojo_critico"],
    hab: ["bosque"],
    egg: ["bicho"],
    bh: "agresivo",
    look: "bug wing:big arm:blade eye:angry mouth:fang sz:1.0",
    desc: "Sus guada\xF1as cortan hojas de acero. Antes de atacar cierra los ojos para concentrarse."
  });
  S2(99, "Escarab\xEDn", "insecto", [45, 55, 70, 30, 35, 30], "C", {
    cr: 200,
    h: 0.4,
    w: 12,
    xp: 52,
    g: "medio",
    ab: ["piel_dura", "plaga"],
    hab: ["bosque", "cueva"],
    egg: ["bicho"],
    bh: "terco",
    look: "bug horn:single eye:big sz:.62 hue:-30",
    desc: "Rueda bolitas de tierra m\xE1s grandes que \xE9l. Su caparaz\xF3n brilla bajo la luz de la luna.",
    evo: [[100, 34]]
  });
  S2(100, "Titan\xE1baro", "insecto/roca", [80, 115, 125, 40, 65, 45], "R", {
    cr: 45,
    h: 1.8,
    w: 240,
    xp: 190,
    g: "lento",
    ab: ["piel_dura", "piel_petrea"],
    hab: [],
    egg: ["bicho"],
    bh: "terco",
    look: "bug horn:big arm:claw eye:angry pat:band sz:1.04 hue:-30",
    desc: "Su cuerno parte troncos como si fueran ramitas. Es el campe\xF3n de los torneos de escarabajos de Roble."
  });
  S2(101, "Armad\xEDn", "tierra", [45, 55, 75, 30, 35, 30], "C", {
    cr: 200,
    h: 0.5,
    w: 14,
    xp: 52,
    g: "medio",
    ab: ["piel_dura", "robustez"],
    hab: ["desierto", "cueva", "pradera"],
    egg: ["campo"],
    bh: "timido",
    look: "shell ear:round eye:big tail:tuft sz:.65 hue:15",
    desc: "Se enrolla en una bola impenetrable si lo asustan. Rueda cuesta abajo para escapar.",
    evo: [[102, 30]]
  });
  S2(102, "Blindarr\xF3n", "tierra/metal", [75, 95, 125, 45, 65, 35], "U", {
    cr: 60,
    h: 1.5,
    w: 130,
    xp: 170,
    g: "medio",
    ab: ["piel_dura", "coraza_antigua"],
    hab: ["desierto", "cueva"],
    egg: ["campo", "mineral"],
    bh: "terco",
    look: "shell arm:claw eye:angry ex:spikes pat:band sz:1.0 hue:15",
    desc: "Su armadura met\xE1lica resiste la lava y el hielo. Es un tanque vivo que apenas se mueve."
  });
  S2(103, "Fosil\xEDn", "roca", [45, 60, 80, 55, 50, 25], "R", {
    cr: 70,
    h: 0.7,
    w: 9,
    xp: 88,
    g: "medio",
    ab: ["robustez", "piel_petrea"],
    hab: ["cueva", "ruinas"],
    egg: ["mineral", "agua"],
    bh: "timido",
    look: "shell eye:big ex:spiral pat:spots sz:.7 hue:40",
    desc: "Un f\xF3sil que cobr\xF3 vida al tocar el agua. A\xFAn recuerda el mar antiguo y huye de la tierra seca.",
    evo: [[104, 36]]
  });
  S2(104, "Amonit\xF3n", "roca/planta", [78, 86, 110, 95, 68, 48], "V", {
    cr: 40,
    h: 1.6,
    w: 90,
    xp: 195,
    g: "medio",
    ab: ["piel_petrea", "espesura"],
    hab: [],
    egg: ["mineral", "agua"],
    bh: "terco",
    look: "shell eye:angry ex:spiral tail:leaf arm:claw pat:band sz:1.0 hue:40",
    desc: "Una criatura prehist\xF3rica con zarcillos de hojas. Las algas crecen en su caparaz\xF3n enroscado."
  });
  S2(105, "Bateruela", "electrico/metal", [45, 40, 60, 60, 50, 35], "U", {
    cr: 150,
    h: 0.4,
    w: 7,
    xp: 62,
    g: "medio",
    ab: ["pararrayos", "robustez"],
    hab: ["cueva", "ruinas"],
    egg: ["mineral"],
    bh: "curioso",
    look: "golem eye:big mouth:smile ex:sparks arm:fin sz:.62",
    desc: "Una pila viviente. Guarda energ\xEDa para a\xF1os y se la ofrece a quien le cae bien.",
    evo: [[106, 33]]
  });
  S2(106, "Dinam\xF3n", "electrico/metal", [80, 65, 95, 105, 85, 50], "R", {
    cr: 60,
    h: 1.5,
    w: 110,
    xp: 190,
    g: "medio",
    ab: ["pararrayos", "piel_dura"],
    hab: [],
    egg: ["mineral"],
    bh: "terco",
    look: "golem arm:big eye:angry ex:sparks horn:small pat:band sz:1.0",
    desc: "Un generador con patas. Su zumbido tranquiliza a los t\xE9cnicos de las centrales el\xE9ctricas."
  });
  S2(107, "Lucecita", "insecto/electrico", [40, 35, 40, 60, 45, 55], "C", {
    cr: 200,
    h: 0.3,
    w: 0.8,
    xp: 52,
    g: "medio",
    ab: ["chispa_viva", "plaga"],
    hab: ["bosque", "pantano"],
    egg: ["bicho"],
    bh: "curioso",
    tm: "n",
    look: "bug wing:small ex:glowtail eye:big mouth:smile sz:.58",
    desc: "Una luci\xE9rnaga que parpadea en c\xF3digo. Se comunica con las dem\xE1s con destellos de colores.",
    evo: [[108, 26]]
  });
  S2(108, "Fulgor", "insecto/electrico", [70, 60, 65, 105, 80, 90], "U", {
    cr: 75,
    h: 1.1,
    w: 12,
    xp: 150,
    g: "medio",
    ab: ["chispa_viva", "plaga"],
    hab: ["bosque", "pantano"],
    egg: ["bicho"],
    bh: "sociable",
    tm: "n",
    look: "bug wing:moth ex:glowtail eye:big pat:spots sz:.9",
    desc: "Ilumina enjambres de noche como una constelaci\xF3n en movimiento. Su luz hipnotiza."
  });
  S2(109, "Flor\xEDn", "planta", [45, 40, 50, 65, 60, 40], "C", {
    cr: 190,
    h: 0.4,
    w: 3,
    xp: 56,
    g: "medio",
    ab: ["espesura", "aura_sanadora"],
    hab: ["pradera", "bosque"],
    egg: ["planta"],
    bh: "sociable",
    look: "plant eye:big mouth:smile ex:flowerhead sz:.6 hue:70",
    desc: "Una florecilla que sigue al sol dando saltitos. Su perfume calma a quien lo huele.",
    evo: [[110, 0, "item:gema_solar"]]
  });
  S2(110, "Floralia", "planta/luz", [78, 58, 78, 108, 98, 58], "R", {
    cr: 45,
    h: 1.3,
    w: 14,
    xp: 195,
    g: "medio",
    ab: ["aura_luz", "aura_sanadora"],
    hab: [],
    egg: ["planta", "fantasia"],
    bh: "sociable",
    look: "plant eye:wide mouth:smile ex:flowerhead arm:fin ear:leaf pat:gems sz:.95 hue:70",
    desc: "Su corola irradia luz propia. Dicen que florece solo ante personas de buen coraz\xF3n."
  });
  S2(111, "Anguil\xEDn", "agua", [45, 45, 40, 55, 40, 60], "C", {
    cr: 190,
    h: 0.7,
    w: 4,
    xp: 55,
    g: "medio",
    ab: ["nado_veloz", "pararrayos"],
    hab: ["lago", "pantano", "mar"],
    egg: ["agua"],
    bh: "timido",
    look: "snake eye:big mouth:smile tail:fin sz:.62 hue:-40",
    desc: "Una peque\xF1a anguila que lanza chispitas al ser sorprendida. Prefiere el agua dulce y fresca.",
    evo: [[112, 34]]
  });
  S2(112, "Voltanguila", "agua/electrico", [82, 85, 68, 98, 68, 82], "R", {
    cr: 60,
    h: 2.4,
    w: 55,
    xp: 180,
    g: "medio",
    ab: ["pararrayos", "nado_veloz"],
    hab: ["lago", "mar"],
    egg: ["agua"],
    bh: "agresivo",
    look: "snake eye:angry mouth:fang tail:fin ex:sparks pat:band sz:1.0 hue:-40",
    desc: "Una anguila gigante que ilumina la profundidad con descargas. Los pescadores la temen y la respetan."
  });
  S2(113, "Tempestra", "aire/electrico", [90, 90, 85, 125, 90, 110], "L", {
    cr: 15,
    h: 2.4,
    w: 68,
    xp: 330,
    g: "lento",
    ab: ["tormenta_viva", "pararrayos"],
    hab: ["isla"],
    egg: ["sin"],
    bh: "agresivo",
    look: "bird wing:big tail:bolt eye:angry mouth:beak ex:sparks crest pat:band sz:1.08",
    lore: "Guardiana de las tormentas. Cuando bate sus alas, el cielo se parte en rayos. Su nido est\xE1 en lo m\xE1s alto de la Isla Tormenta.",
    desc: "La Guardiana de las Tormentas. Cada vez que bate sus alas, el cielo de Aurelia se llena de truenos."
  });
  S2(114, "Magmaron", "fuego/tierra", [100, 125, 100, 100, 85, 70], "L", {
    cr: 15,
    h: 3.6,
    w: 620,
    xp: 330,
    g: "lento",
    ab: ["corazon_volcan", "robustez"],
    hab: ["volcan"],
    egg: ["sin"],
    bh: "terco",
    look: "quad horn:big arm:claw eye:angry mouth:fang ex:flame pat:spots sz:1.08",
    desc: "El Guardi\xE1n del Cr\xE1ter. Duerme dentro del volc\xE1n y sus sue\xF1os provocan temblores y fumarolas."
  });
  S2(115, "Glaciaris", "hielo/agua", [95, 85, 115, 125, 105, 60], "L", {
    cr: 15,
    h: 3,
    w: 310,
    xp: 330,
    g: "lento",
    ab: ["alma_glaciar", "marea_viva"],
    hab: ["nieve"],
    egg: ["sin"],
    bh: "terco",
    look: "drag wing:feather horn:antler tail:long eye:wide ex:crystal pat:belly sz:1.08",
    desc: "El Guardi\xE1n del Hielo Eterno. Cada paso suyo cubre de escarcha el sendero que pisa."
  });
  S2(116, "Arkanion", "metal/espiritu", [90, 110, 130, 80, 115, 55], "L", {
    cr: 15,
    h: 3.8,
    w: 850,
    xp: 330,
    g: "lento",
    ab: ["coraza_antigua", "lamento_espiritual"],
    hab: ["ruinas"],
    egg: ["sin"],
    bh: "terco",
    look: "golem arm:big horn:crown eye:wide ex:gems pat:band sz:1.1",
    desc: "El Centinela de las Ruinas. Hecho de metal y de recuerdos, vigila el sello desde antes de que Aurelia tuviera nombre."
  });
  S2(117, "Aurelion", "luz/dragon", [105, 100, 100, 130, 110, 95], "L", {
    cr: 10,
    h: 4,
    w: 380,
    xp: 350,
    g: "lento",
    ab: ["aura_alba", "aura_luz"],
    hab: ["final"],
    egg: ["sin"],
    bh: "sociable",
    look: "drag wing:big horn:crown tail:long eye:wide ex:halo pat:gems sz:1.12",
    desc: "El Drag\xF3n del Alba. Se dice que cada amanecer es su primer aliento. Sin \xE9l, el d\xEDa no llegar\xEDa a Aurelia."
  });
  S2(118, "Umbraxis", "sombra/dragon", [105, 130, 100, 110, 100, 95], "L", {
    cr: 10,
    h: 4.2,
    w: 410,
    xp: 350,
    g: "lento",
    ab: ["aura_eclipse", "intimidar"],
    hab: ["final"],
    egg: ["sin"],
    bh: "agresivo",
    look: "drag wing:bat horn:big tail:spike eye:angry mouth:fang ex:crystal pat:band sz:1.12",
    desc: "El Drag\xF3n del Ocaso, gemelo de Aurelion. Su hambre de oscuridad es solo el reflejo del miedo de quienes lo despertaron."
  });
  S2(119, "Lunaria", "mental/espiritu", [95, 70, 95, 120, 125, 95], "L", {
    cr: 12,
    h: 2,
    w: 90,
    xp: 320,
    g: "lento",
    ab: ["lamento_espiritual", "aura_sanadora"],
    hab: ["ruinas"],
    egg: ["sin"],
    bh: "timido",
    tm: "n",
    look: "float wing:feather tail:long eye:wide ex:halo arm:fin pat:gems sz:1.05 c1:#a9bcf0 c2:#f0f4ff c3:#ffe58a c4:#7f8fe0",
    desc: "La Dama de la Luna. Solo aparece en noches claras sobre las ruinas, y desaparece si siente que la persiguen."
  });
  S2(120, "Eterna", "planta/espiritu", [110, 80, 105, 95, 115, 95], "M", {
    cr: 8,
    h: 1.6,
    w: 35,
    xp: 340,
    g: "lento",
    ab: ["aura_sanadora", "espesura"],
    hab: [],
    egg: ["sin"],
    bh: "timido",
    look: "plant ear:leaf eye:wide mouth:smile ex:flowerhead arm:fin pat:gems wing:leaf sz:1.0 c1:#78dca4 c2:#eafff0 c3:#ff9ad0 c4:#4fb88a",
    desc: "La Semilla Eterna. Brota una vez cada mil a\xF1os en un rinc\xF3n secreto. Quien la cuida recibe su bendici\xF3n."
  });
  S2(121, "Quimera", "sonido/mental", [90, 110, 85, 125, 90, 100], "M", {
    cr: 8,
    h: 1.9,
    w: 120,
    xp: 340,
    g: "lento",
    ab: ["voz_potente", "mente_clara"],
    hab: [],
    egg: ["sin"],
    bh: "curioso",
    look: "float wing:moth horn:antler eye:three mouth:fang ex:notes pat:gems tail:long sz:.9",
    desc: "Un ser cambiante que adopta la forma de lo que oye. Solo se manifiesta ante quien completa el desaf\xEDo del Eco."
  });

  // src/data/species.js
  init_rng();

  // src/data/types.js
  var TYPE_IDS = ["fuego", "agua", "planta", "electrico", "tierra", "roca", "aire", "hielo", "lucha", "veneno", "mental", "sombra", "luz", "metal", "insecto", "dragon", "sonido", "espiritu"];
  var TYPES = {
    fuego: { name: "Fuego", color: "#ef5b2a", dark: "#8f2a0c", light: "#ffb27a", alt: "#ffd24a" },
    agua: { name: "Agua", color: "#3f8fe8", dark: "#1b4a96", light: "#9ad0ff", alt: "#5fe0e8" },
    planta: { name: "Planta", color: "#4fb547", dark: "#236b2a", light: "#a8e87a", alt: "#e8d24a" },
    electrico: { name: "El\xE9ctrico", color: "#f2c830", dark: "#9a7a08", light: "#fff08a", alt: "#6ad0ff" },
    tierra: { name: "Tierra", color: "#c79a52", dark: "#7a5522", light: "#ecd096", alt: "#8a6a3a" },
    roca: { name: "Roca", color: "#a39a7c", dark: "#5e5740", light: "#d8d0b0", alt: "#7a8aa0" },
    aire: { name: "Aire", color: "#8fb4f0", dark: "#4c6cb0", light: "#d4e6ff", alt: "#f0f0ff" },
    hielo: { name: "Hielo", color: "#7fd8e6", dark: "#3a8aa0", light: "#d6f6ff", alt: "#ffffff" },
    lucha: { name: "Lucha", color: "#c8452f", dark: "#74200f", light: "#f08a6a", alt: "#f0c070" },
    veneno: { name: "Veneno", color: "#a455c8", dark: "#5e2a7a", light: "#d89af0", alt: "#7ae060" },
    mental: { name: "Mental", color: "#f0609a", dark: "#9a2a62", light: "#ffa8cc", alt: "#a870f0" },
    sombra: { name: "Sombra", color: "#5a4a7a", dark: "#262038", light: "#9a88c0", alt: "#e05a6a" },
    luz: { name: "Luz", color: "#f6e08a", dark: "#b08a2a", light: "#fffbe0", alt: "#ffb86a" },
    metal: { name: "Metal", color: "#9aa8b8", dark: "#566474", light: "#dce6f0", alt: "#e0b050" },
    insecto: { name: "Insecto", color: "#9ac02a", dark: "#4e6a10", light: "#ccea6a", alt: "#e0782a" },
    dragon: { name: "Drag\xF3n", color: "#5a58d8", dark: "#2a2a82", light: "#9a9af0", alt: "#e0488a" },
    sonido: { name: "Sonido", color: "#e07ac0", dark: "#8a3a78", light: "#ffb8e8", alt: "#5ad0c8" },
    espiritu: { name: "Esp\xEDritu", color: "#7a78c8", dark: "#383a7a", light: "#bcbaf0", alt: "#68e8c8" }
  };
  var CH = {
    fuego: { SE: ["planta", "hielo", "insecto", "metal"], NVE: ["fuego", "agua", "roca", "dragon"] },
    agua: { SE: ["fuego", "tierra", "roca"], NVE: ["agua", "planta", "dragon"] },
    planta: { SE: ["agua", "tierra", "roca"], NVE: ["fuego", "planta", "veneno", "aire", "insecto", "dragon"] },
    electrico: { SE: ["agua", "aire", "metal"], NVE: ["electrico", "planta", "dragon"], NO: ["tierra"] },
    tierra: { SE: ["fuego", "electrico", "veneno", "roca", "metal"], NVE: ["planta", "insecto"], NO: ["aire"] },
    roca: { SE: ["fuego", "hielo", "aire", "insecto"], NVE: ["lucha", "tierra", "metal"] },
    aire: { SE: ["planta", "lucha", "insecto"], NVE: ["electrico", "roca", "metal"] },
    hielo: { SE: ["planta", "tierra", "aire", "dragon"], NVE: ["fuego", "agua", "hielo", "metal"] },
    lucha: { SE: ["roca", "hielo", "sombra", "metal"], NVE: ["veneno", "aire", "mental", "insecto", "luz"], NO: ["espiritu"] },
    veneno: { SE: ["planta", "luz"], NVE: ["veneno", "tierra", "roca", "espiritu"], NO: ["metal"] },
    mental: { SE: ["lucha", "veneno", "sonido"], NVE: ["mental", "metal"], NO: ["sombra"] },
    sombra: { SE: ["mental", "espiritu", "sonido"], NVE: ["sombra", "lucha", "luz"] },
    luz: { SE: ["sombra", "espiritu", "insecto", "dragon"], NVE: ["luz", "fuego", "metal"] },
    metal: { SE: ["hielo", "roca", "luz"], NVE: ["fuego", "agua", "electrico", "metal"] },
    insecto: { SE: ["planta", "mental", "sombra"], NVE: ["fuego", "lucha", "aire", "veneno", "espiritu"] },
    dragon: { SE: ["dragon", "aire", "sonido"], NVE: ["metal", "roca"] },
    sonido: { SE: ["hielo", "roca", "insecto"], NVE: ["sonido", "metal", "espiritu"] },
    espiritu: { SE: ["mental", "espiritu", "planta", "insecto"], NVE: ["metal", "luz", "tierra"] }
  };
  var MUL = {};
  for (const a of TYPE_IDS) {
    MUL[a] = {};
    for (const d of TYPE_IDS) MUL[a][d] = 1;
    const c = CH[a];
    for (const d of c.SE) MUL[a][d] = 2;
    for (const d of c.NVE) MUL[a][d] = 0.5;
    for (const d of c.NO || []) MUL[a][d] = 0;
  }
  function effectiveness(atk, defTypes) {
    let m = 1;
    for (const d of defTypes) m *= MUL[atk][d] ?? 1;
    return m;
  }
  function weaknesses(defTypes) {
    return TYPE_IDS.map((t) => ({ type: t, mult: effectiveness(t, defTypes) })).filter((x) => x.mult > 1).sort((a, b) => b.mult - a.mult);
  }
  function resistances(defTypes) {
    return TYPE_IDS.map((t) => ({ type: t, mult: effectiveness(t, defTypes) })).filter((x) => x.mult < 1).sort((a, b) => a.mult - b.mult);
  }
  function effectLabel(m) {
    if (m === 0) return "Sin efecto";
    if (m >= 4) return "Ultra eficaz";
    if (m > 1) return "Muy eficaz";
    if (m < 1 && m <= 0.25) return "Muy poco eficaz";
    if (m < 1) return "Poco eficaz";
    return "";
  }

  // src/data/species.js
  var RARITY = {
    C: { name: "Com\xFAn", w: 40, color: "#9aa4b2" },
    U: { name: "Poco com\xFAn", w: 25, color: "#5fbf6a" },
    R: { name: "Rara", w: 12, color: "#4a9be8" },
    V: { name: "Muy rara", w: 5, color: "#a45ce0" },
    E: { name: "\xC9lite", w: 2, color: "#f0a030" },
    L: { name: "Legendaria", w: 0, color: "#f0d040" },
    M: { name: "M\xEDtica", w: 0, color: "#ff6aa8" }
  };
  var RARITY_ORDER = ["C", "U", "R", "V", "E", "L", "M"];
  var STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];
  var STAT_NAMES = { hp: "PS", atk: "Ataque", def: "Defensa", spa: "At. Esp.", spd: "Def. Esp.", spe: "Velocidad", acc: "Precisi\xF3n", eva: "Evasi\xF3n" };
  var XP_GROUPS = {
    rapido: (n) => Math.floor(0.8 * n ** 3),
    medio: (n) => n ** 3,
    parab: (n) => Math.max(0, Math.floor(1.15 * n ** 3 - 12 * n ** 2 + 90 * n - 120)),
    lento: (n) => Math.floor(1.25 * n ** 3)
  };
  var xpForLevel = (group, lv) => lv <= 1 ? 0 : XP_GROUPS[group](lv);
  var BEHAVIORS = {
    timido: "T\xEDmida: huye con facilidad si est\xE1 herida.",
    curioso: "Curiosa: se acerca a investigar y ataca con variedad.",
    agresivo: "Agresiva: nunca huye y busca siempre el golpe m\xE1s fuerte.",
    terco: "Terca: aguanta mucho antes de retirarse.",
    sociable: "Sociable: se deja capturar con facilidad si conf\xEDa.",
    dormilon: "Dormilona: tarda en reaccionar y suele dormir."
  };
  var EGG_GROUPS = ["campo", "volador", "agua", "bicho", "mineral", "planta", "monstruo", "fantasia", "amorfo", "dragon", "sin"];
  function parseLook(str) {
    const parts = str.trim().split(/\s+/);
    const look2 = { plan: parts[0] };
    for (const p of parts.slice(1)) {
      const i = p.indexOf(":");
      const k = p.slice(0, i), v = p.slice(i + 1);
      look2[k] = k === "sz" || k === "hue" ? parseFloat(v) : v;
    }
    return look2;
  }
  function parseEvo(e) {
    const [to, lv, extra] = e;
    const r = { to, lv: lv || 0 };
    if (extra) {
      for (const part of extra.split("&")) {
        const [k, v] = part.split(":");
        if (k === "friend") r.friend = true;
        else r[k] = v;
      }
    }
    return r;
  }
  var SPECIES = {};
  var SPECIES_LIST = [];
  var SPECIES_BY_NAME = {};
  for (const r of RAW) {
    const [hp, atk, def, spa, spd, spe] = r.st;
    const s = {
      id: r.id,
      name: r.name,
      types: r.types,
      base: { hp, atk, def, spa, spd, spe },
      bst: hp + atk + def + spa + spd + spe,
      rarity: r.rar,
      cr: r.cr ?? 120,
      h: r.h ?? 1,
      w: r.w ?? 10,
      expYield: r.xp ?? 60,
      xpGroup: r.g ?? "medio",
      abilities: r.ab ?? [],
      habitats: r.hab ?? [],
      egg: r.egg ?? ["campo"],
      behavior: r.bh ?? "curioso",
      timeOnly: r.tm || null,
      weather: r.wx || null,
      look: parseLook(r.look || "blob"),
      desc: r.desc,
      lore: r.lore || null,
      evo: (r.evo || []).map(parseEvo),
      legendary: r.rar === "L" || r.rar === "M"
    };
    SPECIES[s.id] = s;
    SPECIES_LIST.push(s);
    SPECIES_BY_NAME[s.name.toLowerCase()] = s;
  }
  for (const s of SPECIES_LIST) for (const e of s.evo) {
    SPECIES[e.to].prev = s.id;
  }
  for (const s of SPECIES_LIST) {
    let root = s, stage = 1;
    while (root.prev) {
      root = SPECIES[root.prev];
      stage++;
    }
    s.root = root.id;
    s.stage = stage;
  }
  for (const s of SPECIES_LIST) {
    s.family = SPECIES_LIST.filter((x) => x.root === s.root).map((x) => x.id);
    s.finalStage = s.evo.length === 0;
    s.hatch = { C: 2560, U: 3840, R: 5120, V: 6400, E: 7680, L: 0, M: 0 }[s.rarity] * (s.stage === 1 ? 1 : 1);
  }
  function getSpecies(id) {
    const s = SPECIES[id];
    if (!s) throw new Error("Especie desconocida: " + id);
    return s;
  }
  var speciesByName = (n) => SPECIES_BY_NAME[String(n).toLowerCase()];
  var evolutionFamily = (id) => getSpecies(id).family.map((i) => SPECIES[i]);
  var SLOT_LEVELS = [1, 1, 4, 8, 12, 17, 22, 28, 34, 40, 47, 55, 64];
  var COVER = {
    fuego: ["tierra", "lucha", "roca"],
    agua: ["hielo", "tierra", "lucha"],
    planta: ["veneno", "tierra", "lucha"],
    electrico: ["aire", "sonido", "metal"],
    tierra: ["roca", "lucha", "veneno"],
    roca: ["lucha", "tierra", "metal"],
    aire: ["lucha", "electrico", "sonido"],
    hielo: ["agua", "aire", "mental"],
    lucha: ["roca", "sombra", "tierra"],
    veneno: ["sombra", "tierra", "insecto"],
    mental: ["luz", "sombra", "sonido"],
    sombra: ["mental", "lucha", "veneno"],
    luz: ["mental", "aire", "insecto"],
    metal: ["roca", "lucha", "electrico"],
    insecto: ["planta", "veneno", "aire"],
    dragon: ["fuego", "aire", "lucha"],
    sonido: ["aire", "mental", "electrico"],
    espiritu: ["sombra", "mental", "veneno"]
  };
  var tierForLevel = (lv) => lv < 8 ? 0 : lv < 16 ? 1 : lv < 28 ? 2 : lv < 45 ? 3 : 4;
  function generateLearnset(s) {
    const rng = new RNG(s.id * 7919 + 17);
    const physical = s.base.atk >= s.base.spa;
    const cover = COVER[s.types[0]] || [];
    const covType = cover[s.id % cover.length];
    const used = /* @__PURE__ */ new Set();
    const out = [];
    const bump = s.stage - 1;
    const pickFrom2 = (type, tier, wantStatus, preferCat, strict) => {
      let pool = (MOVES_BY_TYPE[type] || []).filter((m) => !used.has(m.id));
      if (wantStatus) {
        const st = pool.filter((m) => m.cat === "est");
        if (st.length) return rng.pick(st);
      }
      const atk = pool.filter((m) => m.cat !== "est");
      const cat = atk.filter((m) => m.cat === preferCat);
      if (strict && !cat.length) return null;
      const base = cat.length ? cat : atk;
      if (!base.length) return null;
      const sorted = base.slice().sort((a, b) => Math.abs(moveTier(a) - tier) - Math.abs(moveTier(b) - tier) || a.pow - b.pow);
      const best = Math.abs(moveTier(sorted[0]) - tier);
      const near = sorted.filter((m) => Math.abs(moveTier(m) - tier) <= best);
      return rng.pick(near);
    };
    SLOT_LEVELS.forEach((lv, i) => {
      const tier = Math.min(4, tierForLevel(lv) + (lv > 1 ? bump * 0 : 0));
      let type = s.types[0], wantStatus = false;
      if (i === 1) wantStatus = true;
      else if (i >= 2) {
        if (i % 4 === 2 && s.types[1]) type = s.types[1];
        else if (i % 4 === 3) type = covType;
        else if (i % 4 === 0 && s.types[1]) type = s.types[1];
        if (i % 5 === 4) wantStatus = true;
      }
      if (wantStatus && i === 1 && (MOVES_BY_TYPE[type] || []).every((m2) => m2.cat !== "est" || used.has(m2.id))) wantStatus = false;
      const cat = physical ? "fis" : "esp";
      const order = [type, ...s.types, covType, ...cover];
      let m = null;
      if (wantStatus) m = pickFrom2(type, tier, true, cat, true);
      for (const t of order) {
        if (m) break;
        m = pickFrom2(t, tier, false, cat, true);
      }
      if (!m) m = pickFrom2(type, tier, false, cat, false) || pickFrom2(s.types[0], tier, false, cat, false);
      if (!m) return;
      used.add(m.id);
      out.push([lv, m.id]);
    });
    return out;
  }
  var SIGNATURE = {
    1: [[1, "latigo_cepa"], [1, "brote_vital"], [5, "hoja_afilada"], [10, "drenaje"], [16, "esporas_sueno"], [22, "bomba_semillas"], [28, "fotosintesis"]],
    2: [[1, "latigo_cepa"], [1, "brote_vital"], [10, "drenaje"], [16, "hoja_afilada"], [22, "esporas_sueno"], [28, "bomba_semillas"], [34, "semilla_parasita"], [40, "tormenta_petalos"]],
    3: [[1, "latigo_cepa"], [1, "drenaje"], [10, "hoja_afilada"], [16, "karate_tajo"], [24, "bomba_semillas"], [30, "golpe_certero"], [36, "respiracion_zen"], [44, "fuerza_bruta"], [52, "rayo_clorofila"], [60, "tormenta_petalos"]],
    4: [[1, "ascua"], [1, "alarido"], [5, "colmillo_brasa"], [10, "aliento_igneo"], [16, "danza_llama"], [22, "ola_calor"], [28, "garra_nocturna"]],
    5: [[1, "ascua"], [1, "alarido"], [10, "aliento_igneo"], [16, "colmillo_brasa"], [22, "danza_llama"], [28, "calcinada"], [34, "ola_calor"], [40, "garra_nocturna"], [46, "torbellino_igneo"]],
    6: [[1, "ascua"], [1, "aliento_dragon"], [10, "aliento_igneo"], [24, "ola_calor"], [32, "garra_dragon"], [38, "danza_dragon"], [44, "torbellino_igneo"], [52, "pulso_dragon"], [60, "nova_ardiente"]],
    7: [[1, "chorro_menor"], [1, "coraza_acuosa"], [5, "burbujeo"], [10, "remolino_marino"], [16, "cascada"], [22, "torrente"], [28, "aliento_helado"]],
    8: [[1, "chorro_menor"], [1, "coraza_acuosa"], [10, "burbujeo"], [16, "remolino_marino"], [22, "cascada"], [28, "aliento_helado"], [34, "torrente"], [40, "rayo_hielo"], [46, "ola_marina"]],
    9: [[1, "chorro_menor"], [1, "copos_cortantes"], [10, "burbujeo"], [24, "torrente"], [32, "rayo_hielo"], [38, "escudo_hielo"], [44, "cola_acuatica"], [52, "ventisca"], [60, "hidrocanon"]],
    113: [[1, "descarga"], [1, "rafaga"], [20, "vendaval"], [35, "rayo_corto"], [50, "aire_cortante"], [60, "tormenta_primordial"], [70, "trueno_fuerte"]],
    114: [[1, "ascua"], [1, "zarpazo_tierra"], [20, "ola_calor"], [35, "sismo"], [50, "puno_magma"], [60, "erupcion_ancestral"], [70, "torbellino_igneo"]],
    115: [[1, "aliento_helado"], [1, "chorro_menor"], [20, "copos_cortantes"], [35, "rayo_hielo"], [50, "torrente"], [60, "glaciar_eterno"], [70, "ventisca"]],
    116: [[1, "garra_metal"], [1, "toque_fantasma"], [20, "bola_espectral"], [35, "cabezazo_hierro"], [50, "meteoro_acero"], [60, "lamento_eterno"], [70, "colosal_golpe"]],
    117: [[1, "destello"], [1, "aliento_dragon"], [20, "rayo_luz"], [35, "pulso_dragon"], [50, "rayo_prisma"], [60, "juicio_alba"], [70, "escudo_vital"]],
    118: [[1, "mordisco_oscuro"], [1, "aliento_dragon"], [20, "pulso_umbrio"], [35, "garra_dragon"], [50, "abismo"], [60, "eclipse_total"], [70, "noche_cerrada"]],
    119: [[1, "confusion"], [1, "toque_fantasma"], [20, "bola_espectral"], [35, "psiquico_fuerte"], [50, "luz_curativa"], [60, "lluvia_estelar"], [70, "telequinesis"]],
    120: [[1, "drenaje"], [1, "toque_fantasma"], [20, "fotosintesis"], [35, "bola_espectral"], [50, "tormenta_petalos"], [60, "vida_primigenia"], [70, "escudo_vital"]],
    121: [[1, "eco"], [1, "confusion"], [20, "onda_sonica"], [35, "psicorrayo"], [50, "alboroto"], [60, "sinfonia_final"], [70, "forma_quimerica"]]
  };
  var FLAVOR = {
    12: ["pico_taladro", "karate_tajo"],
    21: ["rafaga_punos"],
    24: ["rayo_corto", "trueno_fuerte"],
    31: ["sismo", "derrumbe_mayor"],
    37: ["mordisco_oscuro", "cascada"],
    51: ["puno_hielo", "barrido"],
    59: ["aliento_dragon", "bomba_lodo"],
    62: ["rayo_luz", "psiquico_fuerte"],
    73: ["luz_curativa", "vendaval"],
    83: ["garra_dragon", "vendaval", "danza_dragon"],
    100: ["chupa_vida", "roca_afilada"],
    111: ["chispa"],
    54: ["puno_titan", "fuerza_bruta"],
    68: ["garra_nocturna", "golpe_traicionero"],
    78: ["bomba_hierro", "sismo"],
    98: ["alas_cortantes", "tijera_doble"],
    10: ["picotazo", "rafaga"],
    11: ["ala_cortante", "pluma_veloz"],
    14: ["zarpazo_tierra", "golpe_corto"],
    17: ["rayo_luz", "zumbido", "enjambre"],
    15: ["picadura"],
    16: ["hilo_pegajoso"]
  };
  for (const s of SPECIES_LIST) {
    let ls;
    if (SIGNATURE[s.id]) ls = SIGNATURE[s.id].slice();
    else {
      ls = generateLearnset(s);
      const lvs = [6, 14, 24, 36, 48];
      (FLAVOR[s.id] || []).forEach((mid, i) => {
        if (MOVES[mid] && !ls.some((x) => x[1] === mid)) ls.push([lvs[i], mid]);
      });
    }
    ls.sort((a, b) => a[0] - b[0]);
    const seen = /* @__PURE__ */ new Set();
    s.learnset = ls.filter(([, id]) => MOVES[id] && !seen.has(id) ? (seen.add(id), true) : false);
  }
  function movesAtLevel(sp, lv) {
    const list = getSpecies(sp).learnset.filter(([l]) => l <= lv).map((x) => x[1]);
    const uniq = [...new Set(list)];
    return uniq.slice(-4);
  }
  function learnsAtLevel(sp, lv) {
    return getSpecies(sp).learnset.filter(([l]) => l === lv).map((x) => x[1]);
  }
  function canLearnTM(sp, moveId) {
    const m = MOVES[moveId];
    const s = getSpecies(sp);
    if (!m) return false;
    if (s.types.includes(m.type)) return true;
    const cov = COVER[s.types[0]] || [];
    return cov.includes(m.type) && m.cat !== "est" && m.pow <= 100;
  }
  var speciesByHabitat = (hab) => SPECIES_LIST.filter((s) => s.habitats.includes(hab));
  var TYPE_COUNT = Object.fromEntries(TYPE_IDS.map((t) => [t, SPECIES_LIST.filter((s) => s.types.includes(t)).length]));

  // src/data/abilities.js
  var ABILITIES = {};
  var A = (id, name, desc, fx) => {
    ABILITIES[id] = { id, name, desc, ...fx };
  };
  A("intimidar", "Intimidar", "Al entrar, reduce el Ataque del rival.", { enter: { stat: ["foe", "atk", -1] } });
  A("nube_lluvia", "Nube de Lluvia", "Al entrar, provoca lluvia.", { enter: { weather: "lluvia" } });
  A("sol_radiante", "Sol Radiante", "Al entrar, provoca sol intenso.", { enter: { weather: "soleado" } });
  A("remolino_arena", "Remolino de Arena", "Al entrar, levanta una tormenta de arena.", { enter: { weather: "arena" } });
  A("aura_helada", "Aura Helada", "Al entrar, provoca granizo.", { enter: { weather: "granizo" } });
  A("absorbe_agua", "Absorbe Agua", "Inmune al agua; la absorbe para curarse.", { absorb: { type: "agua", heal: 0.25 } });
  A("pararrayos", "Pararrayos", "Inmune a lo el\xE9ctrico; lo absorbe para curarse.", { absorb: { type: "electrico", heal: 0.25 } });
  A("piel_seca", "Piel \xCDgnea", "Inmune al fuego; lo absorbe para curarse.", { absorb: { type: "fuego", heal: 0.25 } });
  A("levitar", "Levitaci\xF3n", "Flota: inmune a los movimientos de Tierra.", { immuneType: "tierra" });
  A("llama_interior", "Llama Interior", "Con pocos PS potencia el fuego.", { boost: { type: "fuego", mult: 1.5, pinch: true } });
  A("marea_viva", "Marea Viva", "Con pocos PS potencia el agua.", { boost: { type: "agua", mult: 1.5, pinch: true } });
  A("espesura", "Espesura", "Con pocos PS potencia la planta.", { boost: { type: "planta", mult: 1.5, pinch: true } });
  A("plaga", "Plaga", "Con pocos PS potencia los insectos.", { boost: { type: "insecto", mult: 1.5, pinch: true } });
  A("chispa_viva", "Chispa Viva", "Con pocos PS potencia lo el\xE9ctrico.", { boost: { type: "electrico", mult: 1.5, pinch: true } });
  A("cuerpo_ardiente", "Cuerpo Ardiente", "Puede quemar a quien lo golpea.", { contact: { st: ["quemado", 30] } });
  A("estatica", "Est\xE1tica", "Puede paralizar a quien lo golpea.", { contact: { st: ["paralizado", 30] } });
  A("puas_toxicas", "P\xFAas T\xF3xicas", "Puede envenenar a quien lo golpea.", { contact: { st: ["envenenado", 30] } });
  A("espinas", "Espinas", "Da\xF1a a quien lo golpea.", { contact: { dmg: 0.125 } });
  A("cuerpo_libre", "Cuerpo Libre", "No sufre estados alterados.", { noStatus: "all" });
  A("insomnio", "Insomnio", "No se puede dormir.", { noStatus: ["dormido"] });
  A("nado_veloz", "Nado Veloz", "Doble de velocidad con lluvia.", { weatherSpeed: { lluvia: 2 } });
  A("clorofila", "Clorofila", "Doble de velocidad con sol.", { weatherSpeed: { soleado: 2 } });
  A("pies_arena", "Pies de Arena", "Doble de velocidad en tormenta de arena.", { weatherSpeed: { arena: 2 } });
  A("patinaje", "Patinaje", "Doble de velocidad con granizo.", { weatherSpeed: { granizo: 2 } });
  A("regeneracion", "Regeneraci\xF3n", "Recupera 1/16 de sus PS cada turno.", { regen: 0.0625 });
  A("robustez", "Robustez", "Sobrevive con 1 PS a un golpe letal si ten\xEDa PS completos.", { sturdy: true });
  A("pelaje_grueso", "Pelaje Grueso", "Resiste el fuego y el hielo.", { resist: { fuego: 0.5, hielo: 0.5 } });
  A("piel_dura", "Piel Dura", "Reduce el da\xF1o f\xEDsico recibido.", { physRed: 0.8 });
  A("ojo_compuesto", "Ojo Compuesto", "Aumenta la precisi\xF3n de sus movimientos.", { accMult: 1.3 });
  A("ojo_critico", "Ojo Cr\xEDtico", "Sus golpes cr\xEDticos son m\xE1s probables.", { critBoost: 1 });
  A("impulso", "Impulso", "Al derrotar a un rival sube su Ataque.", { onKo: { stat: ["atk", 1] } });
  A("voz_potente", "Voz Potente", "Potencia los movimientos de sonido.", { boost: { type: "sonido", mult: 1.3 } });
  A("mente_clara", "Mente Clara", "Sus estad\xEDsticas no pueden ser bajadas por el rival.", { noDrop: true });
  A("piel_petrea", "Piel P\xE9trea", "Inmune a la arena y m\xE1s resistente a golpes de roca.", { sandImmune: true, resist: { roca: 0.5 } });
  A("aura_sanadora", "Aura Sanadora", "Puede curar su estado alterado al final del turno.", { cleanse: 0.33 });
  A("adaptable", "Adaptable", "Potencia el bonus por mismo tipo (STAB).", { adaptable: true });
  A("fuerza_pura", "Fuerza Pura", "Potencia sus movimientos f\xEDsicos.", { atkMult: 1.3 });
  A("aura_sombra", "Aura de Sombra", "Potencia los movimientos de Sombra.", { boost: { type: "sombra", mult: 1.25 } });
  A("aura_luz", "Aura de Luz", "Potencia los movimientos de Luz.", { boost: { type: "luz", mult: 1.25 } });
  A("aura_alba", "Aura del Alba", "Al entrar provoca sol; potencia la Luz.", { enter: { weather: "soleado" }, boost: { type: "luz", mult: 1.3 } });
  A("aura_eclipse", "Aura del Eclipse", "Potencia la Sombra y el Drag\xF3n.", { boost: { type: "sombra", mult: 1.3 } });
  A("tormenta_viva", "Tormenta Viva", "Al entrar provoca lluvia.", { enter: { weather: "lluvia" }, boost: { type: "electrico", mult: 1.2 } });
  A("corazon_volcan", "Coraz\xF3n de Volc\xE1n", "Al entrar provoca sol; potencia el fuego.", { enter: { weather: "soleado" }, boost: { type: "fuego", mult: 1.25 } });
  A("alma_glaciar", "Alma de Glaciar", "Al entrar provoca granizo; resiste el hielo.", { enter: { weather: "granizo" }, resist: { hielo: 0.5 } });
  A("coraza_antigua", "Coraza Antigua", "Reduce el da\xF1o recibido de todo tipo.", { physRed: 0.85, resist: { roca: 0.5, metal: 0.5 } });
  A("lamento_espiritual", "Lamento Espiritual", "Al entrar baja el Ataque Esp. del rival.", { enter: { stat: ["foe", "spa", -1] } });

  // src/creatures.js
  var creatures_exports = {};
  __export(creatures_exports, {
    EV_CAP: () => EV_CAP,
    EV_TOTAL: () => EV_TOTAL,
    NATURES: () => NATURES,
    NATURE_IDS: () => NATURE_IDS,
    STATUS: () => STATUS,
    addEv: () => addEv,
    battleXp: () => battleXp,
    calcStat: () => calcStat,
    canFight: () => canFight,
    changeFriendship: () => changeFriendship,
    createCreature: () => createCreature,
    displayName: () => displayName,
    evYield: () => evYield,
    gainXp: () => gainXp,
    healCreature: () => healCreature,
    healParty: () => healParty,
    hpRatio: () => hpRatio,
    isFainted: () => isFainted,
    learnMove: () => learnMove,
    levelUpOnce: () => levelUpOnce,
    makeMove: () => makeMove,
    natureMod: () => natureMod,
    recalcStats: () => recalcStats,
    setStatus: () => setStatus,
    speciesOf: () => speciesOf,
    validateCreature: () => validateCreature,
    xpProgress: () => xpProgress,
    xpToNext: () => xpToNext
  });
  init_config();
  init_rng();
  var N = (id, name, up, down, text) => [id, { id, name, up, down, text }];
  var NATURES = Object.fromEntries([
    N("audaz", "Audaz", "atk", "def", "Le encanta lanzarse al ataque."),
    N("fiero", "Fiero", "atk", "spa", "Prefiere los golpes directos."),
    N("brusco", "Brusco", "atk", "spd", "Golpea sin pensar en las consecuencias."),
    N("pesado", "Pesado", "atk", "spe", "Fuerte pero lento de reflejos."),
    N("placido", "Pl\xE1cido", "def", "atk", "Aguanta cualquier cosa con calma."),
    N("firme", "Firme", "def", "spa", "Se planta y no cede ni un paso."),
    N("rudo", "Rudo", "def", "spd", "Es duro como una roca."),
    N("cauto", "Cauto", "def", "spe", "Siempre protege su posici\xF3n."),
    N("sagaz", "Sagaz", "spa", "atk", "Prefiere el ingenio a la fuerza."),
    N("astuto", "Astuto", "spa", "def", "Brilla en los trucos y en los poderes."),
    N("ingenioso", "Ingenioso", "spa", "spd", "Es creativo y arriesgado."),
    N("reflexivo", "Reflexivo", "spa", "spe", "Piensa cada movimiento."),
    N("sereno", "Sereno", "spd", "atk", "Mantiene la calma ante todo."),
    N("paciente", "Paciente", "spd", "def", "Resiste los poderes ajenos."),
    N("humilde", "Humilde", "spd", "spa", "Se concentra en no ser golpeado."),
    N("sonador", "So\xF1ador", "spd", "spe", "Se pierde en sus pensamientos."),
    N("alegre", "Alegre", "spe", "atk", "Corre feliz de un lado a otro."),
    N("travieso", "Travieso", "spe", "def", "Esquiva y pica sin parar."),
    N("agil", "\xC1gil", "spe", "spa", "Veloz y escurridizo."),
    N("inquieto", "Inquieto", "spe", "spd", "No se queda quieto un instante."),
    N("equilibrado", "Equilibrado", "", "", "Es muy estable y arm\xF3nico."),
    N("docil", "D\xF3cil", "", "", "Obedece sin rechistar."),
    N("timido", "T\xEDmido", "", "", "Evita llamar la atenci\xF3n."),
    N("formal", "Formal", "", "", "Le gusta seguir las reglas."),
    N("sincero", "Sincero", "", "", "Dice siempre lo que piensa.")
  ]);
  var NATURE_IDS = Object.keys(NATURES);
  var STATUS = {
    quemado: { name: "Quemado", short: "QUE", color: "#ef5b2a" },
    envenenado: { name: "Envenenado", short: "ENV", color: "#a455c8" },
    paralizado: { name: "Paralizado", short: "PAR", color: "#f2c830" },
    dormido: { name: "Dormido", short: "DOR", color: "#8a96b8" },
    congelado: { name: "Congelado", short: "CON", color: "#7fd8e6" }
  };
  var EV_CAP = 100;
  var EV_TOTAL = 300;
  function natureMod(natureId, stat) {
    const n = NATURES[natureId];
    if (!n || !n.up) return 1;
    if (n.up === stat) return 1.1;
    if (n.down === stat) return 0.9;
    return 1;
  }
  function calcStat(key, base, iv, ev, lv, nature) {
    const core = Math.floor((2 * base + iv * 2 + Math.floor(ev / 4)) * lv / 100);
    if (key === "hp") return core + lv + 10;
    return Math.floor((core + 5) * natureMod(nature, key));
  }
  function recalcStats(c, healDelta = true) {
    const s = getSpecies(c.sp);
    const old = c.maxHp || 0;
    const stats = {};
    for (const k of STAT_KEYS) stats[k] = calcStat(k, s.base[k], c.iv[k], c.ev[k], c.lv, c.nature);
    c.stats = stats;
    c.maxHp = stats.hp;
    if (healDelta && old > 0) c.hp = clamp(c.hp + (c.maxHp - old), c.hp > 0 ? 1 : 0, c.maxHp);
    c.hp = clamp(c.hp, 0, c.maxHp);
    return c;
  }
  function makeMove(id) {
    const m = getMove(id);
    return { id, pp: m.pp, max: m.pp };
  }
  function createCreature(spId, lv, opts = {}) {
    const s = getSpecies(spId);
    const rng = opts.rng || new RNG(Math.random() * 4294967296 >>> 0);
    lv = clamp(Math.floor(lv), 1, MAX_LEVEL);
    const iv = opts.iv || Object.fromEntries(STAT_KEYS.map((k) => [k, rng.int(0, 15)]));
    const abilitySlot = opts.abilitySlot ?? (s.abilities.length > 2 && rng.chance(0.1) ? 2 : rng.int(0, Math.min(1, s.abilities.length - 1)));
    const c = {
      uid: uid(),
      sp: spId,
      nick: opts.nick || null,
      lv,
      xp: xpForLevel(s.xpGroup, lv),
      nature: opts.nature || rng.pick(NATURE_IDS),
      iv,
      ev: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      hp: 1,
      maxHp: 0,
      stats: null,
      moves: [],
      ability: s.abilities[abilitySlot] || s.abilities[0] || null,
      abilitySlot,
      status: null,
      statusTurns: 0,
      friendship: opts.friendship ?? 70,
      variant: opts.variant ?? (rng.chance(1 / 64) ? { hue: rng.pick([140, 200, 260, 320]), rare: true } : { hue: rng.int(-8, 8), rare: false }),
      ot: opts.ot || null,
      ball: opts.ball || "capsula",
      caught: opts.caught || null,
      pendingMoves: [],
      pendingEvo: null,
      heldItem: null,
      kos: 0
    };
    recalcStats(c, false);
    c.hp = c.maxHp;
    const mv = opts.moves && opts.moves.length ? opts.moves.filter((m) => MOVES[m]).slice(0, MAX_MOVES) : movesAtLevel(spId, lv);
    c.moves = mv.map(makeMove);
    return c;
  }
  var speciesOf = (c) => getSpecies(c.sp);
  var displayName = (c) => c.nick || getSpecies(c.sp).name;
  var isFainted = (c) => c.hp <= 0;
  var canFight = (c) => !c.egg && c.hp > 0;
  var hpRatio = (c) => c.maxHp ? c.hp / c.maxHp : 0;
  var xpToNext = (c) => c.lv >= MAX_LEVEL ? 0 : xpForLevel(speciesOf(c).xpGroup, c.lv + 1) - c.xp;
  function xpProgress(c) {
    if (c.lv >= MAX_LEVEL) return 1;
    const g = speciesOf(c).xpGroup;
    const a = xpForLevel(g, c.lv), b = xpForLevel(g, c.lv + 1);
    return clamp((c.xp - a) / (b - a), 0, 1);
  }
  function healCreature(c, { pp = true } = {}) {
    c.hp = c.maxHp;
    c.status = null;
    c.statusTurns = 0;
    if (pp) for (const m of c.moves) m.pp = m.max;
    return c;
  }
  function healParty(party) {
    for (const c of party) if (!c.egg) healCreature(c);
  }
  function learnMove(c, moveId, replaceIdx = null) {
    if (c.moves.some((m) => m.id === moveId)) return "known";
    if (c.moves.length < MAX_MOVES) {
      c.moves.push(makeMove(moveId));
      return "learned";
    }
    if (replaceIdx == null) return "full";
    c.moves[replaceIdx] = makeMove(moveId);
    return "learned";
  }
  function levelUpOnce(c) {
    const before = { ...c.stats };
    c.lv += 1;
    recalcStats(c, true);
    c.friendship = clamp(c.friendship + (c.friendship < 100 ? 5 : c.friendship < 200 ? 3 : 2), 0, 255);
    const learnable = learnsAtLevel(c.sp, c.lv);
    const learned = [], pending = [];
    for (const m of learnable) {
      const r = learnMove(c, m);
      if (r === "learned") learned.push(m);
      else if (r === "full" && !c.pendingMoves.includes(m)) {
        c.pendingMoves.push(m);
        pending.push(m);
      }
    }
    const gains = {};
    for (const k of STAT_KEYS) gains[k] = c.stats[k] - before[k];
    return { lv: c.lv, gains, learned, pending };
  }
  function gainXp(c, amount, levelCap = MAX_LEVEL) {
    const ups = [];
    amount = Math.max(0, Math.floor(amount));
    if (c.lv >= MAX_LEVEL || amount === 0) return ups;
    const g = speciesOf(c).xpGroup;
    c.xp += amount;
    while (c.lv < Math.min(MAX_LEVEL, levelCap) && c.xp >= xpForLevel(g, c.lv + 1)) ups.push(levelUpOnce(c));
    if (c.lv >= MAX_LEVEL) c.xp = Math.min(c.xp, xpForLevel(g, MAX_LEVEL));
    return ups;
  }
  function battleXp(foe, { trainer = false, participants = 1, ownLv = 1 }) {
    const y = speciesOf(foe).expYield;
    const ratio = clamp(foe.lv / Math.max(1, ownLv), 0.35, 1.4);
    const base = y * foe.lv / 7;
    return Math.max(1, Math.floor(base * (trainer ? 1.5 : 1) * ratio / Math.max(1, participants)));
  }
  function evYield(foe) {
    const s = speciesOf(foe);
    let best = "hp", v = -1;
    for (const k of STAT_KEYS) if (s.base[k] > v) {
      v = s.base[k];
      best = k;
    }
    return { stat: best, n: s.stage >= 3 || s.legendary ? 2 : 1 };
  }
  function addEv(c, stat, n) {
    const total = STAT_KEYS.reduce((a, k) => a + c.ev[k], 0);
    const room = Math.min(EV_CAP - c.ev[stat], EV_TOTAL - total, n);
    if (room <= 0) return 0;
    c.ev[stat] += room;
    recalcStats(c, true);
    return room;
  }
  function setStatus(c, st) {
    c.status = st;
    c.statusTurns = st === "dormido" ? 0 : 0;
  }
  function changeFriendship(c, n) {
    c.friendship = clamp(c.friendship + n, 0, 255);
  }
  function validateCreature(c) {
    try {
      if (!c || typeof c !== "object") return false;
      if (c.egg) return !!getSpecies(c.sp);
      const s = getSpecies(c.sp);
      c.lv = clamp(Math.floor(c.lv) || 1, 1, MAX_LEVEL);
      c.xp = Math.max(0, Math.floor(c.xp) || 0);
      c.iv || (c.iv = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])));
      c.ev || (c.ev = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])));
      if (!NATURES[c.nature]) c.nature = "equilibrado";
      c.moves = (c.moves || []).filter((m) => MOVES[m.id]).slice(0, MAX_MOVES).map((m) => ({ id: m.id, pp: clamp(m.pp ?? MOVES[m.id].pp, 0, MOVES[m.id].pp), max: MOVES[m.id].pp }));
      if (!c.moves.length) c.moves = movesAtLevel(c.sp, c.lv).map(makeMove);
      if (!c.ability) c.ability = s.abilities[0] || null;
      c.pendingMoves || (c.pendingMoves = []);
      c.friendship = clamp(c.friendship ?? 70, 0, 255);
      c.variant || (c.variant = { hue: 0, rare: false });
      if (!c.uid) c.uid = uid();
      const hp = c.hp;
      recalcStats(c, false);
      c.hp = clamp(Number.isFinite(hp) ? hp : c.maxHp, 0, c.maxHp);
      return true;
    } catch {
      return false;
    }
  }

  // src/gfx/creature_gfx.js
  init_color();
  init_rng();
  var SPR = 48;
  var cache2 = /* @__PURE__ */ new Map();
  var E = (cx, cy, rx, ry, rot = 0) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    const f = (x, y) => {
      const dx = x - cx, dy = y - cy;
      const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
      return Math.sqrt(u * u + v * v) - 1;
    };
    f.c = rot === 0 ? [cx, cy, rx, ry] : null;
    return f;
  };
  var C = (cx, cy, r) => E(cx, cy, r, r);
  var CAP = (x1, y1, x2, y2, r) => {
    const vx = x2 - x1, vy = y2 - y1, l2 = vx * vx + vy * vy || 1;
    return (x, y) => {
      let t = ((x - x1) * vx + (y - y1) * vy) / l2;
      t = Math.max(0, Math.min(1, t));
      const px2 = x1 + vx * t, py = y1 + vy * t;
      return Math.hypot(x - px2, y - py) - r;
    };
  };
  var TRI = (x1, y1, x2, y2, x3, y3) => (x, y) => {
    const d1 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2), d2 = (x - x3) * (y2 - y3) - (x2 - x3) * (y - y3), d3 = (x - x1) * (y3 - y1) - (x3 - x1) * (y - y1);
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    return neg && pos ? 1 : -1;
  };
  var RR = (cx, cy, hw, hh, r) => (x, y) => {
    const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
  function makePalette(sp, hue) {
    const t1 = TYPES[sp.types[0]], t2 = TYPES[sp.types[1] || sp.types[0]];
    const L2 = sp.look;
    let body = L2.c1 || t1.color, belly = L2.c2 || t1.light, accent = L2.c3 || (sp.types[1] ? t2.color : t1.alt);
    let dark = t1.dark;
    const sh = (c) => shiftHue(c, hue);
    body = sh(body);
    belly = sh(belly);
    accent = sh(accent);
    dark = sh(dark);
    return {
      body,
      belly,
      accent,
      dark,
      line: darken(dark, 0.55),
      light: sh(t1.light),
      second: L2.c4 ? L2.c4 : sh(sp.types[1] ? t2.color : t1.alt),
      secondD: sh(sp.types[1] ? t2.dark : darken(t1.alt, 0.3)),
      white: "#fffaf0",
      ink: "#1b1228",
      gold: "#f2c040",
      fire: "#ff7a2a",
      fireY: "#ffd24a",
      fireW: "#fff2b0"
    };
  }
  var tone = (c) => ({ base: c, hi: lighten(c, 0.28), lo: mix(c, "#2a1840", 0.38), lo2: mix(c, "#2a1840", 0.55) });
  var Scene = class {
    constructor(pal) {
      this.S = [];
      this.pal = pal;
      this.eyes = [];
      this.mouth = null;
      this.head = { x: 24, y: 16, r: 8 };
      this.anch = {};
    }
    add(sdf, col, z, o = {}) {
      this.S.push({ sdf, col, z, i: this.S.length, ...o });
      return this;
    }
    color(col) {
      return col[0] === "#" ? col : this.pal[col] || this.pal.body;
    }
  };
  var PLANS = {
    blob(s) {
      s.add(E(17, 43, 4.5, 2.6), "dark", 1, { line: true }).add(E(31, 43, 4.5, 2.6), "dark", 1, { line: true });
      s.add(E(24, 30, 13.5, 12.5), "body", 3, { big: true });
      s.head = { x: 24, y: 27, r: 11 };
      s.eyes = [[19, 27], [29, 27]];
      s.mouth = [24, 32];
      s.anch = { earY: 21, earX: 15, hornY: 18, tail: [37, 36], wing: [11, 30], arm: [11, 34], belly: [24, 35, 8, 6], chest: [24, 33], back: [24, 20] };
    },
    bip(s) {
      s.add(CAP(19, 38, 19, 42, 3.4), "dark", 1, { line: true }).add(CAP(29, 38, 29, 42, 3.4), "dark", 1, { line: true });
      s.add(E(24, 28, 9, 10.5), "body", 3, { big: true });
      s.add(E(24, 14, 8.5, 8), "body", 5, { big: true, line: true });
      s.head = { x: 24, y: 14, r: 8 };
      s.eyes = [[20.5, 14], [27.5, 14]];
      s.mouth = [24, 18.5];
      s.anch = { earY: 9, earX: 17, hornY: 7, tail: [31, 36], wing: [15, 24], arm: [15, 24], belly: [24, 31, 6, 7], chest: [24, 26], back: [24, 20] };
      if (!s.look.arm) {
        s.add(CAP(15.5, 22, 12.5, 31, 2.6), "body", 2, { line: true }).add(CAP(32.5, 22, 35.5, 31, 2.6), "body", 2, { line: true });
      }
    },
    quad(s) {
      s.add(CAP(15, 39, 15, 43, 3.6), "dark", 2, { line: true }).add(CAP(33, 39, 33, 43, 3.6), "dark", 2, { line: true });
      s.add(E(24, 35, 14.5, 8.5), "body", 3, { big: true });
      s.add(E(24, 22, 10.5, 9.5), "body", 5, { big: true, line: true });
      s.head = { x: 24, y: 22, r: 9.5 };
      s.eyes = [[19.5, 22], [28.5, 22]];
      s.mouth = [24, 27];
      s.anch = { earY: 15, earX: 16, hornY: 13, tail: [38, 34], wing: [12, 32], arm: [12, 36], belly: [24, 37, 8, 5], chest: [24, 33], back: [24, 28] };
    },
    bird(s) {
      s.add(CAP(20, 40, 20, 43, 1.4), "accent", 1).add(CAP(28, 40, 28, 43, 1.4), "accent", 1);
      s.add(E(24, 30, 10.5, 12.5), "body", 3, { big: true });
      s.add(E(24, 17, 8, 7.5), "body", 5, { big: true, line: true });
      s.head = { x: 24, y: 17, r: 7.5 };
      s.eyes = [[20.5, 16.5], [27.5, 16.5]];
      s.mouth = [24, 21];
      s.anch = { earY: 11, earX: 18, hornY: 10, tail: [24, 41], wing: [13.5, 29], arm: [13.5, 29], belly: [24, 33, 7, 8], chest: [24, 29], back: [24, 24] };
    },
    snake(s) {
      s.add(C(30, 41, 4.6), "body", 1, { line: true });
      s.add(C(21, 36, 8.2), "body", 2, { big: true, line: true });
      s.add(C(29, 29, 7.4), "body", 3, { big: true, line: true });
      s.add(C(22, 22, 6.6), "body", 4, { big: true, line: true });
      s.add(E(24, 13, 7.8, 7.2), "body", 5, { big: true, line: true });
      s.head = { x: 24, y: 13, r: 7.5 };
      s.eyes = [[20.8, 12.5], [27.2, 12.5]];
      s.mouth = [24, 17];
      s.anch = { earY: 8, earX: 18, hornY: 6, tail: [33, 42], wing: [16, 24], arm: [15, 28], belly: [26, 31, 4, 6], chest: [25, 27], back: [24, 20] };
    },
    fish(s) {
      s.add(TRI(34, 27, 46, 15, 46, 39), "second", 1, { line: true });
      s.add(TRI(18, 18, 30, 18, 25, 8), "second", 1, { line: true });
      s.add(E(22, 27, 15.5, 10.5), "body", 3, { big: true, line: true });
      s.add(E(20, 32, 10, 5), "belly", 4);
      s.head = { x: 14, y: 26, r: 8 };
      s.eyes = [[13, 24]];
      s.mouth = [7.5, 29];
      s.anch = { earY: 18, earX: 14, hornY: 16, tail: [40, 27], wing: [22, 35], arm: [22, 36], belly: [20, 32, 9, 4], chest: [20, 28], back: [22, 18] };
    },
    bug(s) {
      for (const sg of [-1, 1]) {
        s.add(CAP(24 + sg * 4, 23, 24 + sg * 12, 28, 1.1), "dark", 1).add(CAP(24 + sg * 12, 28, 24 + sg * 14, 36, 1.1), "dark", 1);
        s.add(CAP(24 + sg * 4, 26, 24 + sg * 11, 33, 1.1), "dark", 1).add(CAP(24 + sg * 11, 33, 24 + sg * 13, 41, 1.1), "dark", 1);
      }
      s.add(E(24, 36, 8, 9.2), "body", 3, { big: true, line: true });
      s.add(E(24, 24, 6.3, 5.8), "second", 4, { big: true, line: true });
      s.add(E(24, 13, 7, 6.4), "body", 5, { big: true, line: true });
      s.head = { x: 24, y: 13, r: 6.8 };
      s.eyes = [[21, 13], [27, 13]];
      s.mouth = [24, 17.5];
      s.anch = { earY: 8, earX: 19, hornY: 7, tail: [24, 45], wing: [19, 22], arm: [18, 25], belly: [24, 38, 5, 6], chest: [24, 24], back: [24, 30] };
    },
    drag(s) {
      s.add(CAP(18, 38, 17, 43, 3.6), "dark", 1, { line: true }).add(CAP(30, 38, 31, 43, 3.6), "dark", 1, { line: true });
      s.add(E(24, 29.5, 10.5, 13.5), "body", 3, { big: true });
      s.add(E(24, 33, 6.5, 9), "belly", 4);
      s.add(E(24, 12.5, 7.4, 6.8), "body", 5, { big: true, line: true });
      s.add(E(24, 16.2, 4.4, 3.2), "belly", 6);
      s.head = { x: 24, y: 12.5, r: 7 };
      s.eyes = [[20.8, 11], [27.2, 11]];
      s.mouth = [24, 17.5];
      s.anch = { earY: 8, earX: 18, hornY: 6, tail: [32, 38], wing: [14, 24], arm: [14, 26], belly: [24, 33, 6, 8], chest: [24, 27], back: [24, 22] };
      if (!s.look.wing) {
      }
    },
    float(s) {
      if (!s.exs.has("tentacles")) {
        s.add(E(25, 43, 4, 2.6), "body", 1, { line: true });
        s.add(E(24, 38, 7, 6), "body", 2, { line: true });
      }
      s.add(E(24, 24.5, 12.8, 12), "body", 4, { big: true, line: true });
      s.head = { x: 24, y: 24, r: 11 };
      s.eyes = [[19, 23.5], [29, 23.5]];
      s.mouth = [24, 29.5];
      s.anch = { earY: 15, earX: 16, hornY: 12, tail: [34, 36], wing: [11, 25], arm: [11, 28], belly: [24, 29, 8, 6], chest: [24, 28], back: [24, 14] };
    },
    bell(s) {
      s.add(C(24, 43, 2.8), "dark", 1, { line: true });
      s.add(RR(24, 38, 13.8, 4.4, 2.2), "body", 2, { line: true });
      s.add(E(24, 25.5, 10.8, 13.5), "body", 3, { big: true, line: true });
      s.add(C(24, 9.5, 2.4), "dark", 1, { line: true });
      s.head = { x: 24, y: 27, r: 9 };
      s.eyes = [[19.8, 27], [28.2, 27]];
      s.mouth = [24, 32];
      s.anch = { earY: 17, earX: 15, hornY: 13, tail: [36, 38], wing: [11, 28], arm: [11, 33], belly: [24, 33, 6, 4], chest: [24, 31], back: [24, 18] };
    },
    golem(s) {
      s.add(RR(18, 42, 4.4, 2.8, 1.6), "dark", 1, { line: true }).add(RR(30, 42, 4.4, 2.8, 1.6), "dark", 1, { line: true });
      s.add(RR(24, 30, 11.5, 11, 3.5), "body", 3, { big: true, line: true });
      s.add(RR(24, 12.5, 8.4, 6.8, 2.6), "body", 5, { big: true, line: true });
      s.head = { x: 24, y: 12.5, r: 7.5 };
      s.eyes = [[20.5, 12.5], [27.5, 12.5]];
      s.mouth = [24, 17.5];
      s.anch = { earY: 8, earX: 17, hornY: 6, tail: [34, 38], wing: [12, 24], arm: [11, 29], belly: [24, 34, 7, 5], chest: [24, 28], back: [24, 20] };
      s.golem = true;
      if (!s.look.arm) {
        s.add(RR(10.5, 30, 3.2, 7, 2), "body", 4, { line: true }).add(RR(37.5, 30, 3.2, 7, 2), "body", 4, { line: true });
      }
    },
    plant(s) {
      const ex = s.exs;
      if (ex.has("flowerhead")) {
        s.add(E(15, 41, 5.5, 2.6, -0.3), "accent", 1, { line: true }).add(E(33, 41, 5.5, 2.6, 0.3), "accent", 1, { line: true });
        s.add(E(24, 34, 8.4, 9), "second", 2, { big: true, line: true });
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * Math.PI * 2 - 1.57;
          s.add(C(24 + Math.cos(a) * 8.2, 15.5 + Math.sin(a) * 7.6, 5.4), "accent", 3, { line: true });
        }
        s.add(C(24, 15.5, 7.2), "body", 5, { big: true, line: true });
        s.head = { x: 24, y: 15.5, r: 7 };
        s.eyes = [[20.8, 15], [27.2, 15]];
        s.mouth = [24, 19.5];
      } else {
        s.add(CAP(18, 39, 18, 43, 3.2), "belly", 1, { line: true }).add(CAP(30, 39, 30, 43, 3.2), "belly", 1, { line: true });
        s.add(E(24, 34, 8, 8.6), "belly", 2, { big: true, line: true });
        s.add(E(24, 20, 15, 11), "body", 4, { big: true, line: true });
        s.head = { x: 24, y: 28, r: 8 };
        s.eyes = [[20.5, 31], [27.5, 31]];
        s.mouth = [24, 35];
        s.mush = true;
      }
      s.anch = { earY: 10, earX: 16, hornY: 8, tail: [32, 40], wing: [14, 28], arm: [14, 30], belly: [24, 36, 5, 5], chest: [24, 32], back: [24, 18] };
    },
    shell(s) {
      s.add(E(10, 38, 4.4, 3.2), "dark", 2, { line: true }).add(E(38, 38, 4.4, 3.2), "dark", 2, { line: true });
      s.add(E(24, 30, 15.5, 12), "body", 3, { big: true, line: true });
      s.add(E(24, 38.5, 7, 5.8), "belly", 5, { big: true, line: true });
      s.head = { x: 24, y: 38, r: 6.5 };
      s.eyes = [[21, 37], [27, 37]];
      s.mouth = [24, 41.2];
      s.anch = { earY: 30, earX: 12, hornY: 20, tail: [38, 34], wing: [10, 28], arm: [10, 38], belly: [24, 39, 5, 4], chest: [24, 25], back: [24, 20] };
      s.shell = true;
    }
  };
  function addEars(s, kind) {
    const h = s.head, r = h.r;
    for (const sg of [-1, 1]) {
      const x = h.x + sg * r * 0.75, y = h.y - r * 0.75;
      if (kind === "point") {
        s.add(TRI(h.x + sg * r * 0.15, h.y - r * 0.85, h.x + sg * r * 0.95, h.y - r * 0.35, h.x + sg * r * 0.95, h.y - r * 1.65), "body", 4, { line: true });
        s.add(TRI(h.x + sg * r * 0.5, h.y - r * 0.8, h.x + sg * r * 0.85, h.y - r * 0.55, h.x + sg * r * 0.85, h.y - r * 1.25), "accent", 4);
      } else if (kind === "round") s.add(C(x, y, r * 0.42), "body", 4, { line: true }).add(C(x, y, r * 0.2), "accent", 4);
      else if (kind === "long") s.add(CAP(h.x + sg * r * 0.4, h.y - r * 0.8, h.x + sg * r * 1.15, h.y - r * 2.05, r * 0.24), "body", 4, { line: true }).add(CAP(h.x + sg * r * 0.45, h.y - r * 0.95, h.x + sg * r * 1.1, h.y - r * 1.9, r * 0.1), "accent", 4);
      else if (kind === "big") s.add(TRI(h.x + sg * r * 0.2, h.y - r * 0.4, h.x + sg * r * 1.25, h.y - r * 0.1, h.x + sg * r * 0.95, h.y - r * 2), "body", 4, { line: true });
      else if (kind === "leaf") s.add(E(h.x + sg * r * 0.85, h.y - r * 0.95, r * 0.62, r * 0.24, sg * -0.85), "accent", 4, { line: true });
      else if (kind === "fin") s.add(TRI(h.x + sg * r * 0.85, h.y - r * 0.1, h.x + sg * r * 1.65, h.y - r * 0.9, h.x + sg * r * 1.5, h.y + r * 0.6), "second", 4, { line: true });
    }
  }
  function addHorns(s, kind) {
    const h = s.head, r = h.r;
    if (kind === "small") s.add(TRI(h.x - 2, h.y - r * 0.85, h.x + 2, h.y - r * 0.85, h.x, h.y - r * 1.55), "gold", 6, { line: true });
    else if (kind === "single") s.add(TRI(h.x - 1.9, h.y - r * 0.75, h.x + 1.9, h.y - r * 0.75, h.x, h.y - r * 2.2), "gold", 6, { line: true });
    else if (kind === "big") for (const sg of [-1, 1]) s.add(TRI(h.x + sg * r * 0.2, h.y - r * 0.85, h.x + sg * r * 0.65, h.y - r * 0.65, h.x + sg * r * 0.55, h.y - r * 1.9), "gold", 6, { line: true });
    else if (kind === "curve") for (const sg of [-1, 1]) {
      s.add(CAP(h.x + sg * r * 0.5, h.y - r * 0.85, h.x + sg * r * 0.95, h.y - r * 1.4, 1.7), "gold", 6, { line: true }).add(CAP(h.x + sg * r * 0.95, h.y - r * 1.4, h.x + sg * r * 0.6, h.y - r * 1.95, 1.2), "gold", 6, { line: true });
    }
    else if (kind === "antler") for (const sg of [-1, 1]) {
      s.add(CAP(h.x + sg * r * 0.4, h.y - r * 0.9, h.x + sg * r * 0.8, h.y - r * 2, 1.3), "gold", 6, { line: true });
      s.add(CAP(h.x + sg * r * 0.6, h.y - r * 1.4, h.x + sg * r * 1.35, h.y - r * 1.65, 1), "gold", 6, { line: true });
      s.add(CAP(h.x + sg * r * 0.75, h.y - r * 1.8, h.x + sg * r * 1.25, h.y - r * 2.3, 0.9), "gold", 6, { line: true });
    }
    else if (kind === "crown") {
      for (let i = -2; i <= 2; i++) s.add(TRI(h.x + i * r * 0.32 - 1.6, h.y - r * 0.85, h.x + i * r * 0.32 + 1.6, h.y - r * 0.85, h.x + i * r * 0.32, h.y - r * (1.45 + (i % 2 === 0 ? 0.35 : 0))), "gold", 6, { line: true });
    }
  }
  function addTail(s, kind) {
    const [tx, ty] = s.anch.tail;
    const sg = s.look.plan === "fish" ? 0 : 1;
    const z = 0;
    if (kind === "tuft") s.add(C(tx + 2, ty - 2, 4.2), "second", z, { line: true });
    else if (kind === "fluff") s.add(E(tx + 2, ty - 6, 5.5, 8.5, 0.35), "second", z, { line: true, big: true });
    else if (kind === "long") s.add(CAP(tx - 3, ty + 1, tx + 5, ty - 3, 2.4), "body", z, { line: true }).add(CAP(tx + 5, ty - 3, tx + 7, ty - 12, 2), "body", z, { line: true }).add(C(tx + 7, ty - 13, 2.6), "second", z, { line: true });
    else if (kind === "club") s.add(CAP(tx - 3, ty + 1, tx + 5, ty - 1, 2.4), "body", z, { line: true }).add(C(tx + 7.5, ty - 2, 4.6), "second", z, { line: true });
    else if (kind === "leaf") s.add(E(tx + 3, ty - 4, 7, 3, -0.7), "accent", z, { line: true }).add(E(tx + 5, ty - 1, 6, 2.6, -0.1), "accent", z, { line: true });
    else if (kind === "fin") s.add(TRI(tx - 2, ty + 2, tx + 9, ty - 10, tx + 10, ty + 3), "second", z, { line: true });
    else if (kind === "spike") for (let i = 0; i < 3; i++) s.add(TRI(tx + i * 3 - 2, ty + 1, tx + i * 3 + 2, ty + 1, tx + i * 3 + 4, ty - 7 - i), "second", z, { line: true });
    else if (kind === "scorp") {
      s.add(CAP(tx - 2, ty + 2, tx + 6, ty - 3, 2.4), "body", z, { line: true }).add(CAP(tx + 6, ty - 3, tx + 7, ty - 14, 2.3), "body", z, { line: true }).add(CAP(tx + 7, ty - 14, tx + 2, ty - 20, 2), "body", z, { line: true });
      s.add(TRI(tx + 2, ty - 19, tx - 2, ty - 17, tx - 3, ty - 24), "dark", z + 0);
    } else if (kind === "curl") {
      s.add(C(tx + 3, ty - 2, 3.2), "body", z, { line: true }).add(C(tx + 7, ty - 6, 3.6), "body", z, { line: true }).add(C(tx + 6, ty - 12, 3), "second", z, { line: true });
    } else if (kind === "bolt") {
      const c = "#ffd830";
      s.add(CAP(tx, ty, tx + 5, ty - 5, 1.7), c, z, { line: true }).add(CAP(tx + 5, ty - 5, tx + 2, ty - 5, 1.7), c, z, { line: true }).add(CAP(tx + 2, ty - 5, tx + 8, ty - 13, 1.7), c, z, { line: true });
    } else if (kind === "flame") flame(s, tx + 3, ty - 4, 0.9, z + 0);
  }
  function flame(s, x, y, k, z) {
    s.add(E(x, y, 4.5 * k, 7 * k, 0), "#ff6a1f", z, { line: true, nos: true });
    s.add(E(x, y + 1.5 * k, 3 * k, 5 * k), "#ffb52e", z, { nos: true });
    s.add(E(x, y + 3 * k, 1.6 * k, 3 * k), "#fff2a0", z, { nos: true });
    s.add(TRI(x - 3 * k, y - 4 * k, x, y - 11 * k, x + 3 * k, y - 4 * k), "#ff6a1f", z, { nos: true });
  }
  function addWings(s, kind) {
    const [wx, wy] = s.anch.wing;
    for (const sg of [-1, 1]) {
      const x = sg < 0 ? wx : 48 - wx;
      if (kind === "small") s.add(E(x + sg * -0.5, wy, 3.6, 7.5, sg * -0.25), "second", 0, { line: true });
      else if (kind === "big") {
        s.add(TRI(x + sg * 2, wy - 10, x + sg * -9 * -1 + sg * 6, wy - 6, x + sg * 3, wy + 8), "second", 0, { line: true });
        s.add(E(x + sg * 6, wy - 3, 10, 6, sg * -0.6), "second", 0, { line: true });
      } else if (kind === "feather") {
        s.add(E(x + sg * 3, wy + 2, 4.2, 12, sg * -0.5), "second", 0, { line: true, big: true });
        s.add(E(x + sg * 6.5, wy - 2, 3.4, 10, sg * -0.8), "accent", 0, { line: true });
      } else if (kind === "bat") {
        s.add(TRI(x + sg * 2, wy - 6, x + sg * 14, wy - 12, x + sg * 3, wy + 8), "second", 0, { line: true });
        s.add(TRI(x + sg * 8, wy - 9, x + sg * 16, wy + 2, x + sg * 6, wy + 4), "second", 0, { line: true });
      } else if (kind === "moth") {
        s.add(E(x + sg * 5, wy - 4, 9.5, 8.2, sg * -0.4), "second", 0, { line: true, big: true });
        s.add(E(x + sg * 3, wy + 6, 6, 5.5, sg * 0.3), "accent", 0, { line: true });
        s.add(C(x + sg * 8, wy - 5, 2.2), "white", 0, { nos: true });
      } else if (kind === "leaf") s.add(E(x + sg * 5, wy - 2, 8.5, 3.6, sg * -0.55), "accent", 0, { line: true });
    }
  }
  function addArms(s, kind) {
    const [ax, ay] = s.anch.arm;
    for (const sg of [-1, 1]) {
      const x = sg < 0 ? ax : 48 - ax;
      if (kind === "claw") {
        s.add(CAP(x + sg * -1, ay - 1, x + sg * 3, ay + 6, 2.6), "body", 6, { line: true });
        for (let i = -1; i <= 1; i++) s.add(CAP(x + sg * 3 + i * 1.6, ay + 6, x + sg * 3 + i * 2.2, ay + 10, 0.9), "white", 6);
      } else if (kind === "blade") {
        s.add(CAP(x + sg * -1, ay - 1, x + sg * 2, ay + 6, 2.4), "body", 6, { line: true });
        s.add(TRI(x + sg * 0, ay + 3, x + sg * 5, ay + 4, x + sg * 3, ay + 16), "#d8e2ee", 6, { line: true });
      } else if (kind === "big") {
        s.add(CAP(x + sg * -1, ay - 1, x + sg * 2, ay + 7, 3.4), "body", 6, { line: true });
        s.add(C(x + sg * 2.5, ay + 10, 4.4), "second", 6, { line: true, big: true });
      } else if (kind === "fin") s.add(TRI(x, ay - 3, x + sg * 8, ay + 4, x + sg * 1, ay + 9), "second", 6, { line: true });
    }
  }
  function addExtras(s, exs) {
    const h = s.head, r = h.r, pal = s.pal;
    for (const ex of exs) {
      switch (ex) {
        case "flame":
          if (s.shell) flame(s, s.anch.back[0], s.anch.back[1] - 2, 0.95, 7);
          else flame(s, h.x, h.y - r * 1.2, 0.95, 7);
          break;
        case "sprout":
          s.add(CAP(h.x, h.y - r * 0.9, h.x, h.y - r * 1.5, 1.1), "accent", 6).add(E(h.x - 3, h.y - r * 1.65, 3.8, 1.7, -0.5), "accent", 6, { line: true }).add(E(h.x + 3, h.y - r * 1.75, 3.8, 1.7, 0.5), "accent", 6, { line: true });
          break;
        case "crown":
          for (let i = -1; i <= 1; i++) s.add(TRI(h.x + i * 3 - 1.8, h.y - r * 0.9, h.x + i * 3 + 1.8, h.y - r * 0.9, h.x + i * 3, h.y - r * (1.5 + (i === 0 ? 0.4 : 0))), "gold", 7, { line: true });
          break;
        case "mane":
          for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) s.add(C(h.x + sg * (r * 0.7 + i * 0.3), h.y - r * 0.5 + i * 3.2, 3.6), "second", 3, { line: true });
          s.add(C(h.x - 2, h.y - r * 0.95, 3.6), "second", 6, { line: true });
          s.add(C(h.x + 2, h.y - r * 0.95, 3.6), "second", 6, { line: true });
          break;
        case "spikes":
          for (let i = 0; i < 4; i++) s.add(TRI(s.anch.back[0] - 7 + i * 4.4, s.anch.back[1] + 3, s.anch.back[0] - 4.6 + i * 4.4, s.anch.back[1] + 3, s.anch.back[0] - 5.8 + i * 4.4, s.anch.back[1] - 3), "second", 5, { line: true });
          break;
        case "crystal":
          for (const [dx, dy, k] of [[-7, 2, 1], [0, -2, 1.3], [7, 2, 1]]) s.add(TRI(s.anch.back[0] + dx - 2.4 * k, s.anch.back[1] + 6, s.anch.back[0] + dx + 2.4 * k, s.anch.back[1] + 6, s.anch.back[0] + dx, s.anch.back[1] - 5 * k + dy), "#bfefff", 5, { line: true, nos: false });
          break;
        case "gem":
          s.add(TRI(h.x - 1.8, h.y - r * 0.55, h.x + 1.8, h.y - r * 0.55, h.x, h.y - r * 0.05), "accent", 7, { line: true });
          break;
        case "halo":
          s.add(E(h.x, h.y - r * 1.45, 6.5, 2.1), "#ffe27a", 7, { nos: true }).add(E(h.x, h.y - r * 1.45, 4.2, 0.9), "#2a1840", 7, { nos: true });
          break;
        case "hat":
          s.add(E(h.x, h.y - r * 0.95, r * 0.9, 2.6), "accent", 7, { line: true });
          break;
        case "crest":
          s.add(TRI(h.x - 2.4, h.y - r * 0.8, h.x + 2.4, h.y - r * 0.8, h.x - 1, h.y - r * 1.8), "second", 7, { line: true }).add(TRI(h.x - 0.5, h.y - r * 0.9, h.x + 4, h.y - r * 0.8, h.x + 4.4, h.y - r * 1.55), "second", 7, { line: true });
          break;
        case "antenna":
          for (const sg of [-1, 1]) {
            s.add(CAP(h.x + sg * 2.4, h.y - r * 0.7, h.x + sg * 6, h.y - r * 1.8, 0.8), "dark", 0, {});
            s.add(C(h.x + sg * 6.2, h.y - r * 1.85, 1.5), "accent", 6, { line: true });
          }
          break;
        case "cocoon":
          s.add(RR(24, 30, 12, 13, 8), "belly", 6, { line: true, big: true });
          for (let i = 0; i < 4; i++) s.add(CAP(14, 22 + i * 5, 34, 24 + i * 5, 0.7), "dark", 7, { nos: true });
          break;
        case "bubbles":
          for (const [dx, dy, rr] of [[-14, 10, 2.4], [15, 8, 3], [-10, -4, 1.6]]) s.add(E(24 + dx, 20 + dy, rr, rr), "#cfeeff", 7, { nos: true, ring: true });
          break;
        case "sparks":
          for (const [dx, dy] of [[-15, 12], [14, 8], [-12, 28]]) {
            s.add(CAP(24 + dx, 8 + dy, 24 + dx + 3, 12 + dy, 0.8), "#ffe24a", 7, { nos: true }).add(CAP(24 + dx + 3, 12 + dy, 24 + dx, 12 + dy, 0.8), "#ffe24a", 7, { nos: true }).add(CAP(24 + dx, 12 + dy, 24 + dx + 3, 17 + dy, 0.8), "#ffe24a", 7, { nos: true });
          }
          break;
        case "snow":
          for (const [dx, dy] of [[-15, 8], [14, 4], [-11, 26], [16, 24], [3, -4]]) s.add(C(24 + dx, 14 + dy, 1.5), "#ffffff", 7, { nos: true });
          break;
        case "notes":
          for (const [dx, dy] of [[-15, 8], [15, 4]]) {
            s.add(E(24 + dx, 16 + dy, 2.1, 1.6, -0.4), "#4a3a70", 7, { nos: true }).add(CAP(24 + dx + 1.8, 16 + dy, 24 + dx + 1.8, 8 + dy, 0.6), "#4a3a70", 7, { nos: true }).add(CAP(24 + dx + 1.8, 8 + dy, 24 + dx + 5, 10 + dy, 0.7), "#4a3a70", 7, { nos: true });
          }
          break;
        case "spores":
          for (const [dx, dy] of [[-14, 6], [13, 10], [-8, -3], [8, -6]]) s.add(C(24 + dx, 12 + dy, 1.6), "#e9f2c0", 7, { nos: true });
          break;
        case "tentacles":
          for (let i = 0; i < 5; i++) {
            const x = 15.5 + i * 4.2;
            s.add(CAP(x, 31, x + (i % 2 ? 2 : -2), 43, 1.6), "second", 3, { line: true });
          }
          break;
        case "glowtail":
          s.add(E(24, 37, 5, 6), "#fff6a0", 5, { nos: true }).add(E(24, 37, 3, 4), "#ffffff", 5, { nos: true });
          break;
        case "gear":
          for (const [dx, dy, rr] of [[-7, 4, 3.4], [6, -3, 2.6]]) {
            s.add(C(s.anch.chest[0] + dx, s.anch.chest[1] + dy, rr + 1), "#c8b068", 7, { line: true, nos: true });
            s.add(C(s.anch.chest[0] + dx, s.anch.chest[1] + dy, 1.2), "#4a3a28", 7, { nos: true });
          }
          break;
        case "bell":
          s.add(CAP(24, 14, 24, 19, 1), "dark", 7).add(C(24, 6, 2.6), "gold", 8, { line: true });
          break;
        case "drum":
          s.add(E(s.anch.chest[0], s.anch.chest[1] + 6, 8.4, 4.4), "#e8c070", 7, { line: true }).add(E(s.anch.chest[0], s.anch.chest[1] + 5, 6.4, 2.4), "#fff2c8", 7, { nos: true });
          break;
        case "blade":
          s.add(TRI(h.x - 3, h.y - r * 0.4, h.x + 3, h.y - r * 0.4, h.x, h.y - r * 2.7), "#dfe7f2", 7, { line: true }).add(RR(h.x, h.y - r * 0.4, 5, 1.4, 0.5), "gold", 8, { line: true });
          break;
        case "mask":
          s.add(RR(h.x, h.y, r * 0.9, r * 0.95, 3), "#efe6cf", 7, { line: true });
          break;
        case "spiral":
          break;
        // se pinta como patrón
        case "rings":
          break;
        default:
          break;
      }
    }
  }
  function rasterize(sc, sz) {
    const N2 = SPR;
    const layer = new Int16Array(N2 * N2).fill(-1);
    const order = sc.S.slice().sort((a, b) => a.z - b.z || a.i - b.i);
    const inv = 1 / sz;
    for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
      const dx = 24 + (x + 0.5 - 24) * inv, dy = 44 + (y + 0.5 - 44) * inv;
      let l = -1;
      for (const sh of order) {
        if (sh.sdf(dx, dy) < 0) l = sh.i;
      }
      layer[y * N2 + x] = l;
    }
    return layer;
  }
  function render(sp, variant) {
    const L2 = sp.look;
    const hue = (L2.hue || 0) + (variant?.hue || 0);
    const pal = makePalette(sp, hue);
    const sc = new Scene(pal);
    sc.look = L2;
    sc.exs = new Set((L2.ex || "").split(",").filter(Boolean));
    const plan = PLANS[L2.plan] || PLANS.blob;
    plan(sc);
    const sz = L2.sz || 1;
    if (L2.ear && L2.ear !== "none") addEars(sc, L2.ear);
    if (L2.horn && L2.horn !== "none") addHorns(sc, L2.horn);
    if (L2.tail && L2.tail !== "none") addTail(sc, L2.tail);
    const wing = L2.wing && L2.wing !== "none" ? L2.wing : L2.plan === "bird" ? "small" : null;
    if (wing) addWings(sc, wing);
    if (L2.arm && L2.arm !== "none") addArms(sc, L2.arm);
    if (L2.mouth === "beak" || L2.plan === "bird" && !L2.mouth) {
      const h = sc.head;
      sc.add(TRI(h.x - 2.8, h.y + 1.2, h.x + 2.8, h.y + 1.2, h.x, h.y + 6), "#f2b430", 6, { line: true });
    }
    if (L2.mouth === "snout") {
      const h = sc.head;
      sc.add(E(h.x, h.y + h.r * 0.45, h.r * 0.5, h.r * 0.38), "belly", 6, { line: true });
    }
    if (L2.pat === "belly" && sc.anch.belly) {
      const [bx, by, rx, ry] = sc.anch.belly;
      sc.add(E(bx, by, rx, ry), "belly", 4);
    }
    if (L2.pat === "cheeks") {
      const h = sc.head;
      for (const sg of [-1, 1]) sc.add(C(h.x + sg * h.r * 0.78, h.y + h.r * 0.35, 2.6), "#ff6a5a", 6, { nos: true });
    }
    addExtras(sc, [...sc.exs]);
    const layer = rasterize(sc, sz);
    return finish(sc, layer, sz, sp, L2, variant);
  }
  function finish(sc, layer, sz, sp, L2, variant) {
    const N2 = SPR, pal = sc.pal;
    const cv = document.createElement("canvas");
    cv.width = cv.height = N2;
    const ctx = cv.getContext("2d");
    const img = ctx.createImageData(N2, N2);
    const d = img.data;
    const at = (x, y) => x < 0 || y < 0 || x >= N2 || y >= N2 ? -1 : layer[y * N2 + x];
    const tones = /* @__PURE__ */ new Map();
    const tn = (shape) => {
      const c = sc.color(shape.col);
      if (!tones.has(c)) tones.set(c, tone(c));
      return tones.get(c);
    };
    const put = (x, y, hex, a = 255) => {
      if (x < 0 || y < 0 || x >= N2 || y >= N2) return;
      const [r, g, b] = parseHex(hex);
      const i = (y * N2 + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = a;
    };
    const outline = darken(pal.dark, 0.6);
    const inv = 1 / sz;
    const pix = new Array(N2 * N2).fill(null);
    for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
      const l = layer[y * N2 + x];
      if (l < 0) continue;
      const sh = sc.S[l], t = tn(sh);
      let c = t.base;
      if (!sh.nos) {
        if (sh.sdf.c) {
          const [cx, cy, rx, ry] = sh.sdf.c;
          const dx = 24 + (x + 0.5 - 24) * inv, dy = 44 + (y + 0.5 - 44) * inv;
          const nx = (dx - cx) / rx, ny = (dy - cy) / ry;
          const lit = -(nx * 0.55 + ny * 0.8);
          if (sh.big) {
            if (lit > 0.5) c = t.hi;
            else if (lit < -0.45) c = t.lo;
            if (lit < -0.85) c = t.lo2;
          } else if (lit < -0.55) c = t.lo;
        } else {
          const a = at(x - 1, y - 1), b = at(x + 1, y + 1);
          if (b !== l && (b < 0 || sc.S[b].z <= sh.z)) c = t.lo;
          else if (a !== l && (a < 0 || sc.S[a].z <= sh.z)) c = t.hi;
        }
      }
      pix[y * N2 + x] = c;
    }
    for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
      const l = layer[y * N2 + x];
      if (l < 0) {
        let edge = false;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + ox, y + oy) >= 0) {
          edge = true;
          break;
        }
        if (edge) put(x, y, outline);
        continue;
      }
      let c = pix[y * N2 + x];
      const sh = sc.S[l];
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = at(x + ox, y + oy);
        if (n >= 0 && n !== l) {
          const ns = sc.S[n];
          if (ns.line && ns.z > sh.z) {
            c = mix(c, outline, 0.62);
            break;
          }
        }
      }
      put(x, y, c);
    }
    if (L2.plan === "golem") {
      for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) {
        const l = layer[y * N2 + x];
        if (l < 0) continue;
        const hsh = (x * 73856093 ^ y * 19349663) >>> 0;
        if (hsh % 17 === 0) put(x, y, mix(pix[y * N2 + x], "#2a1840", 0.28));
        else if (hsh % 29 === 0) put(x, y, mix(pix[y * N2 + x], "#ffffff", 0.22));
      }
    }
    const rng = new RNG(hashStr(sp.name));
    const isBody = (x, y) => {
      const l = at(x, y);
      return l >= 0 && sc.S[l].col === "body" && sc.S[l].z >= 2;
    };
    const dark = pal.dark, acc = pal.accent;
    if (L2.pat === "stripe" || L2.pat === "band") {
      const w = L2.pat === "stripe" ? 3 : 2, per = L2.pat === "stripe" ? 7 : 11;
      for (let y = 0; y < N2; y++) for (let x = 0; x < N2; x++) if (isBody(x, y) && (y + (x >> 2)) % per < w && y > 16) put(x, y, mix(parseHex ? toHex(...parseHex(sc.color("body"))) : dark, dark, 0.55));
    }
    if (L2.pat === "spots") {
      for (let k = 0; k < 7; k++) {
        const cx = rng.int(13, 35), cy = rng.int(14, 40), rr = rng.chance(0.5) ? 1.4 : 2.1;
        for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= rr * rr && isBody(cx + x, cy + y)) put(cx + x, cy + y, k % 2 ? acc : mix(sc.color("body"), dark, 0.5));
      }
    }
    if (L2.pat === "mask") {
      const h = sc.head;
      const hx = 24 + (h.x - 24) * sz, hy = 44 + (h.y - 44) * sz;
      for (let y = -3; y <= 3; y++) for (let x = -9; x <= 9; x++) if (x * x / 80 + y * y / 9 <= 1 && at(Math.round(hx + x), Math.round(hy + y)) >= 0) put(Math.round(hx + x), Math.round(hy + y), mix(sc.color("body"), dark, 0.65));
    }
    if (L2.pat === "gems" || sc.exs.has("gems")) {
      const cx = Math.round(24 + (sc.anch.chest[0] - 24) * sz), cy = Math.round(44 + (sc.anch.chest[1] - 44) * sz);
      for (const [dx, dy] of [[0, 0], [-4, 2], [4, 2]]) {
        put(cx + dx, cy + dy, "#ffffff");
        put(cx + dx, cy + dy + 1, pal.accent);
        put(cx + dx - 1, cy + dy + 1, pal.accent);
        put(cx + dx + 1, cy + dy + 1, pal.accent);
        put(cx + dx, cy + dy + 2, pal.accent);
      }
    }
    if (sc.mush) {
      for (const [x, y] of [[14, 20], [20, 14], [28, 15], [34, 21], [24, 22], [18, 25], [31, 26]]) {
        const px2 = Math.round(24 + (x - 24) * sz), py = Math.round(44 + (y - 44) * sz);
        for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (at(px2 + a, py + b) >= 0) put(px2 + a, py + b, "#fff8e4");
      }
    }
    if (sc.shell) {
      const cx = Math.round(24), cy = Math.round(44 + (30 - 44) * sz);
      for (let k = -2; k <= 2; k++) for (let y = -8; y <= 4; y++) {
        const px2 = Math.round(cx + k * 5 * sz), py = Math.round(cy + y * sz);
        if (isBody(px2, py) && Math.abs(y + 2) < 1) put(px2, py, mix(sc.color("body"), dark, 0.5));
      }
      if (sc.exs.has("spiral") || L2.ex === "spiral") {
        for (let t = 0; t < 40; t++) {
          const a = t * 0.45, r2 = 1 + t * 0.28;
          const px2 = Math.round(24 + Math.cos(a) * r2 * sz), py = Math.round(44 + (28 - 44) * sz + Math.sin(a) * r2 * 0.8 * sz);
          if (isBody(px2, py)) put(px2, py, mix(sc.color("body"), dark, 0.55));
        }
      }
    }
    if (sc.golem && L2.pat === "band") {
    }
    const ink = pal.ink, wht = pal.white;
    const mp = (x, y) => [Math.round(24 + (x - 24) * sz), Math.round(44 + (y - 44) * sz)];
    const eye = L2.eye || "dot";
    const drawEye = (ex, ey, sd) => {
      if (eye === "dot") {
        put(ex, ey, ink);
        put(ex + 1, ey, ink);
        put(ex, ey + 1, ink);
        put(ex + 1, ey + 1, ink);
        put(ex, ey, wht);
      } else if (eye === "big") {
        for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) put(ex + x - 1, ey + y - 1, ink);
        put(ex - 1, ey - 1, wht);
        put(ex, ey - 1, wht);
        put(ex, ey + 1, acc);
        put(ex + 1, ey + 1, acc);
      } else if (eye === "angry") {
        put(ex, ey, ink);
        put(ex + 1, ey, ink);
        put(ex, ey + 1, ink);
        put(ex + 1, ey + 1, ink);
        put(ex, ey, "#ff9a8a");
        for (let k = 0; k < 4; k++) put(ex - 1 + k, ey - 2 + (sd < 0 ? Math.floor(k / 1.5) : 2 - Math.floor(k / 1.5)), ink);
      } else if (eye === "sleepy") {
        for (let k = -1; k <= 2; k++) put(ex + k, ey + 1, ink);
        put(ex - 1, ey, ink);
        put(ex + 2, ey, ink);
      } else if (eye === "slit") {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) put(ex + x - 1, ey + y - 1, "#f6e050");
        for (let y = 0; y < 3; y++) put(ex, ey + y - 1, ink);
      } else if (eye === "wide") {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) put(ex + x - 1, ey + y - 1, pal.accent);
        put(ex - 1, ey - 1, "#ffffff");
        put(ex, ey, ink);
        put(ex + 1, ey + 1, pal.light);
      } else if (eye === "three") {
        put(ex, ey, ink);
        put(ex + 1, ey, ink);
        put(ex, ey + 1, ink);
        put(ex + 1, ey + 1, ink);
        put(ex, ey, wht);
      } else if (eye === "one") {
        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if ((x - 2) ** 2 + (y - 2) ** 2 <= 5) put(ex + x - 2, ey + y - 2, (x - 2) ** 2 + (y - 2) ** 2 <= 1 ? ink : wht);
      }
    };
    const eyes = eye === "one" ? [[sc.head.x, sc.head.y - 1]] : sc.eyes;
    eyes.forEach(([x, y], i) => {
      const [px2, py] = mp(x, y);
      drawEye(px2 - 1, py - 1, i === 0 ? -1 : 1);
    });
    if (eye === "three") {
      const [px2, py] = mp(sc.head.x, sc.head.y - 3.5);
      drawEye(px2 - 1, py - 1, 0);
    }
    if (L2.plan === "fish") {
    }
    const mt = L2.mouth || (L2.plan === "bird" ? "beak" : "smile");
    if (mt !== "beak" && mt !== "none" && sc.mouth) {
      const [mx, my] = mp(sc.mouth[0], sc.mouth[1] + (mt === "snout" ? 0 : 0));
      const mc = pal.ink;
      if (mt === "smile") {
        put(mx - 2, my, mc);
        put(mx - 1, my + 1, mc);
        put(mx, my + 1, mc);
        put(mx + 1, my + 1, mc);
        put(mx + 2, my, mc);
      } else if (mt === "fang") {
        put(mx - 2, my, mc);
        put(mx - 1, my, mc);
        put(mx, my, mc);
        put(mx + 1, my, mc);
        put(mx + 2, my, mc);
        put(mx - 2, my + 1, wht);
        put(mx + 2, my + 1, wht);
      } else if (mt === "snout") {
        put(mx - 1, my - 2, mc);
        put(mx, my - 2, mc);
        put(mx - 1, my, mc);
        put(mx, my + 1, mc);
        put(mx + 1, my, mc);
      } else if (mt === "open") {
        put(mx - 1, my, mc);
        put(mx, my, mc);
        put(mx - 1, my + 1, "#d84a5a");
        put(mx, my + 1, "#d84a5a");
        put(mx + 1, my, mc);
      }
    }
    ctx.putImageData(img, 0, 0);
    if (variant?.rare) {
      ctx.fillStyle = "rgba(255,255,255,.9)";
      for (const [x, y] of [[6, 8], [40, 12], [10, 36], [38, 34]]) {
        ctx.fillRect(x, y - 2, 1, 5);
        ctx.fillRect(x - 2, y, 5, 1);
      }
    }
    return cv;
  }
  function creatureCanvas(spId, variant = null) {
    const key = spId + "|" + (variant ? variant.hue + (variant.rare ? "r" : "") : "0");
    let cv = cache2.get(key);
    if (!cv) {
      cv = render(getSpecies(spId), variant);
      cache2.set(key, cv);
    }
    return cv;
  }
  function drawCreature(ctx, spId, x, y, scale = 4, opts = {}) {
    const cv = creatureCanvas(spId, opts.variant);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const w = SPR * scale;
    if (opts.flip) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(cv, 0, 0, w, w);
    } else ctx.drawImage(cv, x, y, w, w);
    ctx.restore();
  }
  function silhouetteCanvas(spId, color = "#14101e") {
    const src = creatureCanvas(spId);
    const cv = document.createElement("canvas");
    cv.width = cv.height = SPR;
    const c = cv.getContext("2d");
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = color;
    c.fillRect(0, 0, SPR, SPR);
    return cv;
  }

  // src/ui.js
  var typeChip = (t) => el("span", { class: "chip", style: { background: TYPES[t].color } }, TYPES[t].name);
  var statusBadge = (s) => s ? el("span", { class: "badge-st", style: { background: STATUS[s].color } }, STATUS[s].short) : null;
  function hpBar(cur, max) {
    const p = max ? Math.max(0, Math.min(1, cur / max)) : 0;
    return el("div", { class: "hpbar " + (p <= 0.2 ? "low" : p <= 0.5 ? "mid" : "") }, el("i", { style: { width: p * 100 + "%" } }));
  }
  function creatureImg(spId, px2 = 96, variant = null, opts = {}) {
    const src = creatureCanvas(spId, variant);
    const c = document.createElement("canvas");
    c.width = c.height = SPR;
    c.className = "sprite";
    c.style.width = c.style.height = px2 + "px";
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    if (opts.silhouette) {
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = "#14101e";
      g.fillRect(0, 0, SPR, SPR);
    } else {
      if (opts.flip) {
        g.translate(SPR, 0);
        g.scale(-1, 1);
      }
      g.drawImage(src, 0, 0);
    }
    return c;
  }
  var UI = class {
    constructor(game) {
      this.game = game;
      this.root = document.getElementById("ui");
      this.stage = document.getElementById("stage");
      this.toasts = el("div", { id: "toasts" });
      this.root.append(this.toasts);
      this.fadeEl = el("div", { id: "fade" });
      this.root.append(this.fadeEl);
      this.dialogEl = null;
      this.hud = el("div", { class: "layer", id: "hud" });
      this.root.prepend(this.hud);
      this.rescale();
      window.addEventListener("resize", () => this.rescale());
    }
    rescale() {
      const s = Math.min(window.innerWidth / 960, window.innerHeight / 540);
      this.stage.style.transform = `translate(-50%,-50%) scale(${s})`;
      this.scale = s;
    }
    get input() {
      return this.game.input;
    }
    get speed() {
      return { lento: 28, normal: 60, rapido: 140, instantaneo: 9999 }[this.game.settings.textSpeed] || 60;
    }
    // ---------- diálogo ----------
    /** Muestra texto con efecto de máquina de escribir. Resuelve al avanzar. */
    say(text, { speaker = null, wait = true } = {}) {
      return new Promise((resolve2) => {
        this.closeDialog();
        const txt = el("div", { class: "txt" });
        const next = el("div", { class: "next" }, "\u25BC");
        const box = el("div", { id: "dialog", class: "panel" }, [speaker ? el("div", { class: "who" }, speaker) : null, txt, next]);
        next.style.display = "none";
        this.root.append(box);
        this.dialogEl = box;
        const full = String(text);
        let i = 0, done = false, timer = null;
        const finish2 = () => {
          done = true;
          clearInterval(timer);
          txt.textContent = full;
          next.style.display = "";
        };
        const tick = () => {
          i += Math.max(1, Math.round(this.speed / 30));
          txt.textContent = full.slice(0, i);
          if (i % 3 === 0) this.game.audio.sfx("blip");
          if (i >= full.length) finish2();
        };
        timer = setInterval(tick, 33);
        tick();
        const advance = () => {
          if (!done) {
            finish2();
            return;
          }
          off();
          box.remove();
          if (this.dialogEl === box) this.dialogEl = null;
          resolve2();
        };
        const off = this.input.push((a) => {
          if (a === "confirm" || a === "cancel") advance();
        });
        box.addEventListener("click", advance);
        if (!wait) {
          off();
          resolve2();
        }
      });
    }
    async sayAll(lines, opts) {
      for (const l of lines) await this.say(l, opts);
    }
    closeDialog() {
      if (this.dialogEl) {
        this.dialogEl.remove();
        this.dialogEl = null;
      }
    }
    /** Pregunta con opciones. Devuelve el índice elegido (o -1 si se cancela y cancelable). */
    async ask(text, options, { speaker = null, cancel = -1, labels = null } = {}) {
      this.closeDialog();
      const txt = el("div", { class: "txt" }, text);
      const box = el("div", { id: "dialog", class: "panel" }, [speaker ? el("div", { class: "who" }, speaker) : null, txt]);
      this.root.append(box);
      this.dialogEl = box;
      const idx = await this.menu(options.map((o, i) => ({ label: o, value: i })), { parent: box, cls: "ch", cancel: cancel >= 0 ? cancel : null, panel: true });
      box.remove();
      this.dialogEl = null;
      return idx ?? cancel;
    }
    async yesNo(text, opts = {}) {
      const r = await this.ask(text, ["S\xED", "No"], { ...opts, cancel: 1 });
      return r === 0;
    }
    // ---------- menús ----------
    /**
     * items: [{label, value, disabled, hint, onSelect}] -> resuelve con value (o null si se cancela)
     * opts: {parent, cls, style, title, cancel (valor devuelto al cancelar | null para ignorar), index, panel, onChange}
     */
    menu(items, opts = {}) {
      return new Promise((resolve2) => {
        const boxed = !!(opts.panel || opts.title);
        const list = el("div", { class: boxed ? "menu" : "menu " + (opts.cls || ""), style: boxed ? {} : opts.style || {} });
        const wrap = boxed ? el("div", { class: "panel " + (opts.cls || ""), style: opts.style || {} }, [opts.title ? el("div", { class: "title" }, opts.title) : null, list]) : list;
        if (boxed && (!opts.style || !opts.style.position)) wrap.style.position = "absolute";
        if (boxed && opts.style?.display === "grid") {
          list.style.display = "grid";
          list.style.gridTemplateColumns = opts.style.gridTemplateColumns;
          list.style.gap = opts.style.gap;
          list.style.maxHeight = "none";
          wrap.style.display = "block";
          wrap.style.gridTemplateColumns = "";
        }
        const nodes = items.map((it, i) => {
          const n = el("div", { class: "mi" + (it.disabled ? " off" : "") }, [it.icon ? it.icon : null, el("span", {}, it.label), it.hint ? el("span", { class: "hint" }, it.hint) : null]);
          n.addEventListener("mouseenter", () => setSel(i, true));
          n.addEventListener("click", () => {
            setSel(i, true);
            choose();
          });
          list.append(n);
          return n;
        });
        (opts.parent || this.root).append(wrap);
        let sel = Math.min(opts.index ?? 0, items.length - 1);
        if (sel < 0) sel = 0;
        const setSel = (i, mouse = false) => {
          if (i === sel && nodes[i]?.classList.contains("sel")) return;
          sel = (i + items.length) % items.length;
          nodes.forEach((n, k) => n.classList.toggle("sel", k === sel));
          if (!mouse) nodes[sel]?.scrollIntoView({ block: "nearest" });
          if (opts.onChange) opts.onChange(items[sel], sel);
        };
        const finish2 = (v) => {
          off();
          wrap.remove();
          resolve2(v);
        };
        const choose = () => {
          const it = items[sel];
          if (!it) return;
          if (it.disabled) {
            this.game.audio.sfx("error");
            return;
          }
          this.game.audio.sfx("confirm");
          if (it.onSelect) it.onSelect();
          finish2(it.value);
        };
        const off = this.input.push((a, rep) => {
          const cols = opts.cols || 1;
          const mv = (d) => {
            this.game.audio.sfx("select");
            let n = sel + d;
            if (cols > 1 && (n < 0 || n >= items.length)) n = sel;
            setSel(n);
          };
          if (a === "up") mv(-cols);
          else if (a === "down") mv(cols);
          else if (cols > 1 && a === "left") mv(-1);
          else if (cols > 1 && a === "right") mv(1);
          else if (a === "confirm") choose();
          else if (a === "cancel" && opts.cancel !== void 0) {
            this.game.audio.sfx("cancel");
            finish2(opts.cancel);
          } else if (opts.onAction) opts.onAction(a, sel, items[sel], finish2);
        });
        if (!items.length) {
          finish2(opts.cancel ?? null);
          return;
        }
        setSel(sel);
        opts._finish = finish2;
      });
    }
    /** Pide un texto (p. ej. un mote). Devuelve string o null. */
    prompt(title, def = "", max = 12) {
      return new Promise((resolve2) => {
        const inp = el("input", { type: "text", maxlength: String(max), value: def, spellcheck: "false", autocomplete: "off" });
        const ok = el("button", { class: "btn", onclick: () => done(inp.value.trim()) }, "Aceptar"), no = el("button", { class: "btn", onclick: () => done(null) }, "Cancelar");
        const box = el("div", { class: "panel", style: { position: "absolute", left: "280px", top: "170px", width: "400px", zIndex: 80 } }, [el("div", { class: "title" }, title), inp, el("div", { class: "row", style: { marginTop: "12px", justifyContent: "flex-end" } }, [no, ok])]);
        this.root.append(box);
        setTimeout(() => inp.focus(), 30);
        const off = this.input.push((a) => {
          if (a === "cancel") done(null);
        });
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            done(inp.value.trim());
          }
          if (e.key === "Escape") {
            e.preventDefault();
            done(null);
          }
          e.stopPropagation();
        });
        const done = (v) => {
          off();
          box.remove();
          resolve2(v);
        };
      });
    }
    // ---------- toasts / fundido / HUD ----------
    toast(html, cls = "") {
      const t = el("div", { class: "toast " + cls, html });
      this.toasts.append(t);
      setTimeout(() => {
        t.style.transition = "opacity .4s";
        t.style.opacity = 0;
        setTimeout(() => t.remove(), 450);
      }, 3200);
      return t;
    }
    fade(on, ms = 300) {
      return new Promise((r) => {
        this.fadeEl.style.transition = `opacity ${ms}ms`;
        this.fadeEl.style.opacity = on ? 1 : 0;
        setTimeout(r, ms + 20);
      });
    }
    showLocation(name) {
      const old = document.getElementById("hudloc");
      if (old) old.remove();
      const n = el("div", { id: "hudloc", class: "panel flat" }, name);
      this.hud.append(n);
      setTimeout(() => n.remove(), 3300);
    }
    clearHud() {
      this.hud.innerHTML = "";
    }
    // ---------- pantallas ----------
    /**
     * Abre una pantalla completa. build(close, screenEl) debe añadir contenido a `screenEl.body`.
     * Devuelve una promesa que se resuelve con el valor pasado a close(). El cancelar cierra salvo que onAction lo maneje.
     */
    openScreen(title, build, { onAction = null, cancelClose = true, cls = "" } = {}) {
      return new Promise((resolve2) => {
        const head = el("div", { class: "head" }, [el("h2", {}, title), el("div", { class: "x" }, el("button", { class: "btn", onclick: () => close(null) }, "\u2715 Cerrar"))]);
        const body = el("div", { class: "body" });
        const scr = el("div", { class: "screen " + cls }, [head, body]);
        scr.body = body;
        scr.head = head;
        this.root.append(scr);
        const close = (v) => {
          off();
          scr.remove();
          resolve2(v === void 0 ? null : v);
        };
        const off = this.input.push((a, rep) => {
          if (onAction && onAction(a, rep, close) === true) return;
          if (a === "cancel" && cancelClose) {
            this.game.audio.sfx("cancel");
            close(null);
          }
        });
        build(close, scr);
      });
    }
    /** Lista vertical navegable dentro de un contenedor (para pantallas con detalle). */
    listPick(container, items, { onChange, onSelect, index = 0 } = {}) {
      let sel = index;
      const nodes = items.map((it, i) => {
        const n = it.node;
        n.addEventListener("mouseenter", () => set(i));
        n.addEventListener("click", () => {
          set(i);
          onSelect && onSelect(it, i);
        });
        return n;
      });
      const set = (i) => {
        sel = (i + items.length) % items.length;
        nodes.forEach((n, k) => n.classList.toggle("sel", k === sel));
        nodes[sel]?.scrollIntoView({ block: "nearest" });
        onChange && onChange(items[sel], sel);
      };
      set(sel);
      return { get index() {
        return sel;
      }, move: (d) => set(sel + d), set, current: () => items[sel] };
    }
  };

  // src/screens/starter.js
  var STARTERS = [1, 4, 7];
  var BLURB = {
    1: "Paciente y observador. Destaca por su estrategia: drena salud, duerme a sus rivales y espera su momento.",
    4: "Valiente e impulsivo. Es el m\xE1s veloz de los tres y su fuego castiga a quien baja la guardia.",
    7: "Alegre y resistente. Aguanta muchos golpes y devuelve con chorros de agua y burbujas."
  };
  function chooseStarter(g) {
    return new Promise((resolve2) => {
      let sel = 0;
      const cards = [];
      const root = el("div", { class: "screen" }, [el("div", { class: "head" }, el("h2", {}, "Elige a tu primera criatura")), el("div", { class: "body", style: { gap: "16px" } })]);
      const body = root.querySelector(".body");
      STARTERS.forEach((id, i) => {
        const s = getSpecies(id), ab = ABILITIES[s.abilities[0]];
        const start = s.learnset.filter((x) => x[0] <= 5).map((x) => getMove(x[1]));
        const card = el("div", { class: "panel col grow", style: { cursor: "pointer", gap: "6px" } }, [
          el("div", { class: "row", style: { justifyContent: "center" } }, creatureImg(id, 160)),
          el("div", { class: "title center", style: { margin: 0 } }, s.name),
          el("div", { class: "center" }, s.types.map(typeChip)),
          el("div", { class: "small", style: { minHeight: "56px" } }, BLURB[id]),
          el("div", { class: "col", style: { gap: "2px" } }, STAT_KEYS.map((k) => el("div", { class: "stat", style: { gridTemplateColumns: "70px 1fr 28px" } }, [el("span", {}, STAT_NAMES[k]), el("div", { class: "b" }, el("i", { style: { width: Math.min(100, s.base[k] / 0.8) + "%" } })), el("b", {}, String(s.base[k]))]))),
          el("div", { class: "small" }, [el("b", { class: "gold" }, "Habilidad: "), ab ? ab.name : "\u2014"]),
          el("div", { class: "small" }, [el("b", { class: "gold" }, "Movimientos: "), start.map((m) => m.name).join(", ")]),
          el("div", { class: "small dim" }, "Evoluci\xF3n: " + s.family.map((x) => getSpecies(x).name).join(" \u2192 "))
        ]);
        card.addEventListener("mouseenter", () => {
          sel = i;
          hl();
        });
        card.addEventListener("click", () => {
          sel = i;
          hl();
          finish2(true);
        });
        cards.push(card);
        body.append(card);
      });
      const hl = () => cards.forEach((c, i) => {
        c.style.transform = i === sel ? "translateY(-6px)" : "";
        c.style.borderColor = i === sel ? "#fff3b0" : "";
        c.style.boxShadow = i === sel ? "0 0 0 3px #0a0818,0 0 28px rgba(255,220,100,.6)" : "";
      });
      g.ui.root.append(root);
      hl();
      const off = g.input.push((a) => {
        if (a === "left") {
          sel = (sel + 2) % 3;
          hl();
          g.audio.sfx("select");
        } else if (a === "right") {
          sel = (sel + 1) % 3;
          hl();
          g.audio.sfx("select");
        } else if (a === "confirm") finish2(true);
      });
      const finish2 = (ok) => {
        off();
        root.remove();
        resolve2(ok ? STARTERS[sel] : null);
      };
    });
  }

  // src/trainers.js
  init_rng();
  var TRAINERS = {};
  function defineTrainer(id, def) {
    TRAINERS[id] = { id, ai: "basic", iv: 5, reward: 0, ...def };
    return TRAINERS[id];
  }
  function getTrainer(id) {
    const t = TRAINERS[id];
    if (!t) throw new Error("Entrenador desconocido: " + id);
    return t;
  }
  var teamOf = (def, g) => typeof def.team === "function" ? def.team(g) : def.team;
  function buildTeam(def, g = null) {
    const rng = new RNG(hashStr(def.id));
    return teamOf(def, g).map((m) => {
      const iv = Object.fromEntries(STAT_KEYS.map((k) => [k, m.iv ?? def.iv ?? 5]));
      const abilitySlot = m.ab ?? 0;
      return createCreature(m.sp, m.lv, { rng, iv, nature: m.nat || "equilibrado", moves: m.moves, abilitySlot, ot: def.name, friendship: 70 });
    });
  }
  var defaultReward = (def, g = null) => def.reward || Math.max(60, teamOf(def, g)[teamOf(def, g).length - 1].lv * 40);

  // src/data/trainers_data.js
  var rivalStarter = (g) => ({ 1: 4, 4: 7, 7: 1 })[g.count("starter")] || 4;
  var evoStep = (sp, n) => {
    let id = sp;
    for (let i = 0; i < n; i++) {
      const e = { 1: 2, 2: 3, 4: 5, 5: 6, 7: 8, 8: 9 }[id];
      if (e) id = e;
    }
    return id;
  };
  var rivalMon = (g, lv, stage) => ({ sp: evoStep(rivalStarter(g), stage), lv });
  defineTrainer("rival1", {
    name: "Kai",
    cls: "Rival",
    look: look("kai"),
    ai: "smart",
    iv: 3,
    reward: 250,
    team: (g) => [{ ...rivalMon(g, 4, 0), moves: void 0 }],
    intro: "\xA1Eh, {player}! Te estaba esperando. \xA1Mi criatura y yo estamos listos! \xBFEchamos un combate de pr\xE1ctica?",
    win: "\xA1Vaya, qu\xE9 fuerte! Pero la pr\xF3xima vez no me ganar\xE1s. \xA1Voy a cruzar el bosque antes que t\xFA! \xA1Nos vemos en Ciudad Roble!",
    lose: "\xA1Ja! \xA1Te lo dije! Entrena m\xE1s y vuelve a intentarlo."
  });
  defineTrainer("teo", { name: "Teo", cls: "Joven", look: look("nino"), ai: "basic", iv: 2, team: [{ sp: 10, lv: 3 }, { sp: 13, lv: 3 }], reward: 140, intro: "\xA1Eh! \xA1T\xFA! \xA1Mis criaturas y yo queremos combatir!", win: "\xA1Uf! \xA1Eres muy bueno! Me voy a entrenar m\xE1s.", lose: "\xA1Gan\xE9! \xA1Ja ja!", afterWin: "Voy a entrenar en la hierba alta. \xA1Ah\xED hay montones de criaturas!" });
  defineTrainer("mia", { name: "M\xEDa", cls: "Ni\xF1a exploradora", look: look("nina"), ai: "basic", iv: 2, team: [{ sp: 15, lv: 4 }, { sp: 22, lv: 4 }], reward: 190, intro: "\xA1Te he visto al pasar! \xBFAceptas un combate?", win: "\xA1Qu\xE9 bien lo has hecho! Toma, una c\xE1psula de regalo.", afterWin: "Dicen que en el Bosque Umbra viven criaturas muy raras." });

  // src/inventory.js
  init_config();
  var bagCount = (bag, id) => bag[id] || 0;
  var bagHas = (bag, id, n = 1) => (bag[id] || 0) >= n;
  function bagAdd(bag, id, n = 1) {
    getItem(id);
    if (n <= 0) return 0;
    bag[id] = Math.min(999, (bag[id] || 0) + n);
    return n;
  }
  function bagRemove(bag, id, n = 1) {
    if (!bagHas(bag, id, n)) return false;
    bag[id] -= n;
    if (bag[id] <= 0) delete bag[id];
    return true;
  }
  function bagList(bag, pocket = null) {
    const out = [];
    for (const [id, n] of Object.entries(bag)) {
      const it = ITEMS[id];
      if (!it || n <= 0) continue;
      if (pocket && it.pocket !== pocket) continue;
      out.push({ item: it, n });
    }
    out.sort((a, b) => POCKET_ORDER.indexOf(a.item.pocket) - POCKET_ORDER.indexOf(b.item.pocket) || a.item.name.localeCompare(b.item.name, "es"));
    return out;
  }
  var hasKey = (bag, key) => Object.keys(bag).some((id) => ITEMS[id]?.fx.key === key && bag[id] > 0);

  // src/maps/alba.js
  init_rng();
  defineMap("villa_alba", 32, 22, { name: "Villa Alba", title: "Villa Alba", fill: "grass", music: "town", zone: "pueblo", tags: ["pueblo"], climate: "templado", region: "valle", fly: true }, (m) => {
    m.scatter("flowers:y", 8, { rect: [2, 12, 28, 8], on: ["grass"], layer: "ground" });
    m.scatter("flowers", 6, { rect: [2, 12, 28, 8], on: ["grass"], layer: "ground" });
    m.blob(16, 16, 4, 2.6, "water");
    m.blob(16, 16, 5.6, 3.6, "beach", { rough: 0.5, only: ["grass", "flowers", "flowers:y"] });
    m.blob(16, 16, 3.4, 2.1, "water");
    m.path([[2, 10], [31, 10]], "path", 2).path([[5, 18], [9, 18], [9, 12]], "path", 1);
    m.frame("oak", 2, [[30, 9, 2, 5]]);
    m.building(3, 5, 5, 4, { kind: "house", roof: "red", wall: "cream", to: "casa_jugador", tx: "door", key: "casa", name: "Tu casa" });
    m.building(9, 5, 4, 4, { kind: "shop", roof: "blue", wall: "cream", to: "int_alba_tienda", tx: "door", key: "tienda", name: "Tienda" });
    m.building(14, 3, 7, 6, { kind: "lab", roof: "white", wall: "white", to: "int_alba_lab", tx: "door", key: "lab", name: "Laboratorio" });
    m.building(22, 5, 5, 4, { kind: "house", roof: "green", wall: "wood", to: "int_alba_rival", tx: "door", key: "rival", name: "Casa de Kai" });
    m.building(3, 14, 5, 4, { kind: "house", roof: "orange", wall: "sand", to: "int_alba_abuelo", tx: "door", key: "abuelo", name: "Casa de Tom\xE1s" });
    m.fenceRect(20, 13, 9, 6, [[24, 13]]);
    for (const x of [21, 22, 26, 27]) m.put(x, 14, "flowerbed");
    m.put(21, 17, "well");
    m.put(27, 16, "hay");
    m.put(28, 17, "hay");
    m.put(13, 10 - 1, "lamp");
    m.put(21, 10 - 1, "lamp");
    m.sign(15, 9, "LABORATORIO DEL PROF. SAUCE\nInvestigaci\xF3n de la fauna de Aurelia.", { name: "Cartel" });
    m.sign(29, 9, "VILLA ALBA\nDonde empiezan las aventuras.\n\u2192 Ruta 1", { name: "Cartel" });
    m.object(8, 9, "mailbox", { name: "Buz\xF3n", text: "El buz\xF3n est\xE1 vac\xEDo. Hoy no ha llegado ninguna carta." });
    m.tree(11, 14, "oak");
    m.tree(12, 16, "oak");
    m.tree(2, 19, "oak");
    m.tree(18, 20, "oak");
    m.spawn("start", 5, 10, "down").spawn("fly", 17, 10, "down");
    m.connect("e", "ruta1", { offset: 0 });
    m.trigger(29, 10, async (g, ow) => {
      await g.say("Deber\xEDas pasar primero por el laboratorio del Prof. Sauce, \xBFno? Te estaba esperando.");
      await ow.walk(ow.player, "left", 2);
    }, { w: 2, h: 2, show: (g) => !g.flag("starter_chosen") });
    m.npc({ id: "tomas", x: 12, y: 13, dir: "down", look: look("abuelo"), name: "Abuelo Tom\xE1s", move: "wander", range: 1, talk: async (g) => {
      const st = g.questStatus("side_baston");
      if (st === "none") {
        await g.say("Ay, ay... \xBFHas visto mi bast\xF3n? Fui a pasear por la Ruta 1 y lo perd\xED entre la hierba. \xA1Sin \xE9l no puedo ni dar un paso decente!", { speaker: "Abuelo Tom\xE1s" });
        if (await g.yesNo("\xBFQuieres buscar su bast\xF3n por la Ruta 1?")) {
          await g.startQuest("side_baston");
          await g.say("\xA1Gracias, jovenc\xEDsimo! Seguro que est\xE1 bien escondido... \xA1Los objetos ocultos brillan si llevas una lupa!", { speaker: "Abuelo Tom\xE1s" });
        }
      } else if (st === "active" || st === "ready") {
        if (g.hasItem("baston_perdido")) {
          await g.say("\xA1Mi bast\xF3n! \xA1Eres un sol!", { speaker: "Abuelo Tom\xE1s" });
          g.takeItem("baston_perdido");
          g.setFlag("baston_entregado");
          await g.completeQuest("side_baston");
          await g.say("Toma esto. Y recuerda: un entrenador nunca camina sin curar a sus criaturas.", { speaker: "Abuelo Tom\xE1s" });
        } else await g.say("B\xFAscalo por la Ruta 1, entre la hierba. Debe de brillar un poquito.", { speaker: "Abuelo Tom\xE1s" });
      } else await g.say("Mi bast\xF3n y yo te estamos muy agradecidos. \xA1Ahora s\xED que puedo pasear!", { speaker: "Abuelo Tom\xE1s" });
    } });
    m.npc({ id: "lia", x: 24, y: 16, dir: "down", look: look("nina"), name: "L\xEDa", move: "wander", range: 1, text: "Mi abuela dice que las criaturas se cansan igual que nosotros. Si una se queda sin PP en un movimiento, \xA1descanso en un Centro y listo!" });
    m.npc({ id: "pipo", x: 20, y: 11, dir: "right", look: look("nino", { top: 4 }), name: "Pipo", move: "wander", range: 2, text: "En la hierba alta saltan criaturas salvajes. Si no quieres combatir, \xA1rodea! Si quieres capturarlas, primero debil\xEDtalas." });
    m.npc({ id: "rosa_jardin", x: 6, y: 12, dir: "right", look: look("abuela"), name: "Vecina", move: "static", text: "Antes en Villa Alba no pasaba nada. Ahora siempre hay entrenadores... y gente rara con capas oscuras por las rutas. Ten cuidado, \xBFeh?" });
  });
  interior("casa_jugador", 10, 8, { name: "Tu casa", title: "Tu casa", floor: "wood", exit: { to: "villa_alba", spawn: "door_casa" }, noFly: true }, (m, { cx }) => {
    m.put(1, 2, "bed");
    m.put(8, 2, "tv");
    m.put(3, 1, "window_int");
    m.put(6, 1, "window_int");
    m.put(2, 4, "table");
    m.put(1, 5, "plant");
    m.put(8, 5, "bookcase");
    m.rect(4, 3, 3, 3, "rug");
    m.npc({ id: "tia_rosa", x: 6, y: 4, dir: "left", look: look("tia"), name: "T\xEDa Rosa", move: "static", talk: async (g, e, ow) => {
      if (!g.flag("intro_tia")) {
        g.setFlag("intro_tia");
        await g.say("\xA1Buenos d\xEDas, {player}! Has dormido como un tronco. \xA1Hoy es un gran d\xEDa!", { speaker: "T\xEDa Rosa" });
        await g.say("El Prof. Sauce llam\xF3 temprano: quiere verte en su laboratorio, en esta misma Villa Alba. Dice que tiene algo importante para ti.", { speaker: "T\xEDa Rosa" });
        await g.say("Sal por la puerta, sigue el camino hacia la derecha y busca el edificio blanco. \xA1No te olvides de ponerte las pilas!", { speaker: "T\xEDa Rosa" });
        await g.startQuest("main_01");
        return;
      }
      await g.say("Cuando vuelvas cansado, aqu\xED tendr\xE1s tu cama y tu comida caliente. \xBFQuieres que cuide de tus criaturas?", { speaker: "T\xEDa Rosa" });
      if (await g.yesNo("\xBFDescansar y curar a tu equipo?")) {
        g.ui.closeDialog();
        await g.ui.fade(true, 500);
        g.healAll();
        setRespawn(g, "villa_alba", "door_casa");
        await g.wait(500);
        await g.ui.fade(false, 500);
        await g.say("\xA1Ya est\xE1! Descansad bien, que el mundo es grande.", { speaker: "T\xEDa Rosa" });
        if (g.settings.autosave) g.save();
      }
    } });
    m.object(8, 2, null, { name: "Televisi\xF3n", text: 'En la tele hablan de "avistamientos extra\xF1os de gente con capas violetas" en varias rutas. Qu\xE9 raro...' });
    m.object(1, 2, null, { name: "Cama", talk: async (g) => {
      await g.say("Es tu cama. Huele a limpio.");
    } });
  });
  interior("int_alba_lab", 12, 10, { name: "Laboratorio", title: "Laboratorio del Prof. Sauce", floor: "floor", wall: "wallint2", exit: { to: "villa_alba", spawn: "door_lab" }, noFly: true }, (m, { cx }) => {
    for (const x of [1, 2, 3, 8, 9, 10]) m.put(x, 2, "shelf");
    m.put(5, 2, "bookcase");
    m.put(6, 2, "bookcase");
    m.put(0, 2, "pc");
    m.rect(3, 4, 6, 1, "carpet");
    m.put(3, 4, "table");
    m.put(5, 4, "table");
    m.put(7, 4, "table");
    m.entities.push({ kind: "object", x: 3, y: 4, solid: true, free: true, sprite: "ball", name: "C\xE1psula", text: "Una de las tres c\xE1psulas de iniciales. El profesor te dar\xE1 a elegir." }, { kind: "object", x: 5, y: 4, solid: true, free: true, sprite: "ball", name: "C\xE1psula", text: "Una de las tres c\xE1psulas de iniciales. El profesor te dar\xE1 a elegir." }, { kind: "object", x: 7, y: 4, solid: true, free: true, sprite: "ball", name: "C\xE1psula", text: "Una de las tres c\xE1psulas de iniciales. El profesor te dar\xE1 a elegir." });
    m.put(10, 6, "plant");
    m.put(1, 6, "plant");
    m.put(10, 4, "crate");
    m.put(1, 4, "crate");
    m.npc({ id: "sauce", x: 6, y: 6, dir: "down", look: look("sauce"), name: "Prof. Sauce", move: "static", talk: async (g, e, ow) => {
      if (!g.flag("starter_chosen")) {
        await g.sayAll(["\xA1{player}! \xA1Por fin! Soy El\xEDas Sauce, investigador de la fauna de Aurelia.", "Esta regi\xF3n guarda criaturas extraordinarias: bosques que respiran, volcanes que duermen, ruinas que recuerdan... Pero algo est\xE1 cambiando.", "Gente desconocida con capas violeta oscuro ronda por los caminos. Se llaman a s\xED mismos la Orden del Eclipse. No s\xE9 qu\xE9 buscan, pero preguntan mucho por las criaturas antiguas.", "Necesito a alguien que explore la regi\xF3n, registre criaturas en mi Atlas... y averig\xFCe qu\xE9 pasa. \xA1Y ese alguien eres t\xFA!"], { speaker: "Prof. Sauce" });
        await g.say("Pero nadie viaja solo. Aqu\xED tienes tres criaturas j\xF3venes que han sido criadas en este laboratorio. Elige a tu primera compa\xF1era de aventura.", { speaker: "Prof. Sauce" });
        const id = await chooseStarter(g);
        if (!id) {
          await g.say("T\xF3mate tu tiempo. Estar\xE9 aqu\xED cuando est\xE9s listo.", { speaker: "Prof. Sauce" });
          return;
        }
        const s = getSpecies(id);
        if (!await g.yesNo(`\xBFElegir a ${s.name}, la criatura de tipo ${s.types.map((t) => t).join("/")}?`)) {
          await g.say("Pi\xE9nsalo con calma. \xA1Todas son estupendas!", { speaker: "Prof. Sauce" });
          return;
        }
        const c = createCreature(id, 5, { rng: new RNG(Date.now() & 16777215), friendship: 100, nature: ["audaz", "alegre", "sereno"][STARTERS.indexOf(id)], ot: g.playerName });
        c.caught = { map: "int_alba_lab", lv: 5, how: "gift" };
        g.state.counters.starter = id;
        g.state.counters.rival_starter = rivalStarter(g);
        g.audio.sfx("item");
        await g.receiveCreature(c, { how: "gift", quiet: true });
        await g.say(`\xA1${s.name} se ha unido a tu equipo!`);
        if (await g.yesNo(`\xBFQuieres ponerle un mote a ${s.name}?`)) {
          const n = await g.ui.prompt(`Mote para ${s.name}`, "", 12);
          if (n) c.nick = n;
        }
        g.setFlag("starter_chosen");
        await g.sayAll([`\xA1Excelente elecci\xF3n! ${displayName(c)} y t\xFA os llevar\xE9is de maravilla.`, 'Toma, el Atlas de Aurelia: registra autom\xE1ticamente todas las criaturas que veas y captures. Lo encontrar\xE1s en tu men\xFA como "Enciclopedia".'], { speaker: "Prof. Sauce" });
        await g.giveItem("capsula", 5);
        await g.giveItem("pocion", 2);
        await g.giveItem("lupa");
        await g.sayAll(["Para capturar, primero debilita a la criatura salvaje y luego lanza una c\xE1psula desde el men\xFA de combate. \xA1M\xE1s PS perdidos, m\xE1s f\xE1cil es!", "Y si se te cansan las criaturas, tu t\xEDa Rosa y los Centros de Curaci\xF3n las dejar\xE1n como nuevas."], { speaker: "Prof. Sauce" });
        const rs = getSpecies(rivalStarter(g));
        await g.sayAll([`En ese momento... \xA1la puerta se abre de golpe!`], {});
        g.setFlag("kai_en_lab");
        ow.refreshEntities();
        const kai = ow.entity("kai_lab");
        if (kai) {
          await ow.walk(kai, "up", 1);
          ow.faceToward(kai, ow.player.x, ow.player.y);
        }
        await g.sayAll(["\xA1{player}! \xA1Qu\xE9 suerte, ya has elegido! Yo tambi\xE9n me llevo una.", `Esta de aqu\xED: ${rs.name}. Tiene ventaja sobre la tuya, \xA1ja ja!`, "Te espero en la Ruta 1. \xA1Combatiremos para ver qui\xE9n es mejor!"], { speaker: "Kai" });
        if (kai) {
          await ow.walkPath(kai, "down,right");
        }
        g.clearFlag("kai_en_lab");
        g.setFlag("kai_salio");
        ow.refreshEntities();
        await g.sayAll(["Qu\xE9 muchacho tan en\xE9rgico... Bueno, una \xFAltima cosa, {player}.", "Necesito que lleves este paquete al Museo de Ciudad Roble, al otro lado del Bosque Umbra. Es muy fr\xE1gil: \xA1no lo pierdas!"], { speaker: "Prof. Sauce" });
        await g.giveItem("paquete_sauce");
        await g.startQuest("main_03");
        await g.startQuest("main_02");
        await g.startQuest("side_captura1");
        await g.startQuest("side_entrenador1");
        await g.say("\xA1Mucha suerte en tu aventura! Cruza la Ruta 1 siguiendo el camino. \xA1Y vuelve a visitarme!", { speaker: "Prof. Sauce" });
        return;
      }
      await g.say(g.flag("paquete_entregado") ? "Me han dicho que lo has hecho muy bien en Roble. \xA1Sigue as\xED!" : "\xBFA\xFAn por aqu\xED? Recuerda: el paquete es para el Museo de Ciudad Roble, tras el Bosque Umbra.", { speaker: "Prof. Sauce" });
    } });
    m.npc({ id: "ayudante", x: 9, y: 5, dir: "left", look: look("ayudante"), name: "Ayudante", move: "static", text: "Llevamos meses catalogando criaturas. \xA1Cada una nueva que registras me hace saltar de alegr\xEDa!" });
    m.npc({ id: "kai_lab", x: 5, y: 9, dir: "up", look: look("kai"), name: "Kai", move: "static", show: (g) => g.flag("kai_en_lab"), solid: true, text: "..." });
  });
  defineHouse("alba", "rival", { name: "Casa de Kai", npcs: [{ id: "madre_kai", x: 4, y: 4, dir: "down", look: "abuela", name: "Madre de Kai", text: "\xA1Kai sali\xF3 corriendo hace nada! Siempre con prisa. Si lo ves, dile que coma algo." }] });
  defineHouse("alba", "abuelo", { name: "Casa de Tom\xE1s", npcs: [{ id: "gato", x: 6, y: 4, dir: "left", look: "nino", name: "Nieto", text: "El abuelo siempre cuenta que de joven captur\xF3 una criatura legendaria. \xA1Yo no me lo creo! ... \xBFO s\xED?" }] });
  defineShopInterior("alba", "alba", { name: "Tienda de Villa Alba" });
  defineMap("ruta1", 44, 24, {
    name: "Ruta 1",
    title: "Ruta 1",
    fill: "grass",
    music: "route",
    zone: "pradera",
    tags: ["ruta", "pradera"],
    climate: "templado",
    region: "valle",
    encounters: { hierba: { lv: [2, 4], list: [{ sp: 10, w: 40 }, { sp: 13, w: 33 }, { sp: 15, w: 27 }, { sp: 22, w: 6 }, { sp: 109, w: 8 }, { sp: 52, w: 5 }] } }
  }, (m) => {
    for (const [x, y, rx, ry] of [[5, 5, 4, 3], [14, 19, 5, 3], [24, 12, 4, 3], [26, 4, 5, 3], [36, 19, 5, 3], [38, 9, 4, 3], [8, 19, 3, 2]]) m.blob(x, y, rx, ry, "tallgrass");
    m.blob(24, 19, 3.2, 2.2, "water");
    m.blob(24, 19, 4.6, 3.2, "beach", { rough: 0.5, only: ["grass", "tallgrass"] });
    m.blob(24, 19, 2.6, 1.6, "water");
    m.path([[0, 10], [9, 10], [9, 15], [19, 15], [19, 8], [30, 8], [30, 14], [43, 14]], "path", 2);
    m.scatter("flowers", 10, { rect: [2, 2, 40, 20], on: ["grass"], layer: "ground" });
    m.scatter("flowers:b", 6, { rect: [2, 2, 40, 20], on: ["grass"], layer: "ground" });
    m.frame("oak", 2, [[0, 9, 2, 4], [42, 13, 2, 4]]);
    m.forest(2, 2, 40, 20, "oak", 0.22, { on: ["grass"] });
    m.sign(11, 12, "RUTA 1\n\u2190 Villa Alba   Bosque Umbra \u2192\nPrecauci\xF3n: \xA1criaturas salvajes en la hierba alta!");
    m.sign(40, 12, "BOSQUE UMBRA\nSe recomienda llevar pociones.");
    m.item(12, 17, "pocion");
    m.item(32, 6, "capsula", { n: 2 });
    m.item(22, 3, "antidoto");
    m.hidden(21, 5, "baston_perdido", { show: (g) => g.questStatus("side_baston") !== "none" && !g.flag("baston_entregado") });
    m.hidden(6, 3, "pepita");
    m.spawn("start", 2, 10, "right");
    m.connect("w", "villa_alba", { offset: 0 }).connect("e", "bosque_umbra", { offset: 0 });
    m.trainer({ id: "teo", trainer: "teo", x: 15, y: 12, dir: "down", look: look("nino"), name: "Teo", sight: 3 });
    m.trainer({ id: "mia", trainer: "mia", x: 26, y: 5, dir: "down", look: look("nina"), name: "M\xEDa", sight: 3, afterWin: true });
    m.trigger(2, 10, async (g, ow) => {
      ow.busy = true;
      const kai = ow.entity("kai_ruta");
      if (kai) ow.faceToward(kai, ow.player.x, ow.player.y);
      const r = await g.battleTrainer("rival1", { entity: kai });
      if (r.result !== "win") return;
      g.setFlag("rival1_done");
      ow.refreshEntities();
      await g.say("Seguir\xE9 cruzando el bosque. \xA1Alc\xE1nzame si puedes!", { speaker: "Kai" });
      const k2 = ow.entity("kai_ruta");
      if (k2) {
        await ow.walkPath(k2, "right,right,right,right,right,right,right,right");
      }
      g.setFlag("kai_sigue");
      ow.refreshEntities();
    }, { w: 1, h: 2, show: (g) => g.flag("starter_chosen") && !g.flag("rival1_done") });
    m.npc({ id: "kai_ruta", x: 6, y: 10, dir: "left", look: look("kai"), name: "Kai", move: "static", show: (g) => g.flag("starter_chosen") && !g.flag("kai_sigue"), talk: async (g) => {
      await g.say("\xA1Vamos, entrena un poco!", { speaker: "Kai" });
    } });
    m.trigger(40, 14, async (g) => {
      g.setFlag("ruta1_cruzada");
    }, { w: 2, h: 2, once: true });
  });

  // src/quests.js
  var QUESTS = {};
  function defineQuest(id, def) {
    QUESTS[id] = { id, kind: "side", turnIn: false, ...def };
    return QUESTS[id];
  }
  var q = (g, id) => g.state.quests[id];
  var questStatus = (g, id) => q(g, id)?.status || "none";
  function questList(g) {
    return Object.entries(g.state.quests).filter(([id]) => QUESTS[id]).map(([id, s]) => ({ def: QUESTS[id], status: s.status, prog: s.prog }));
  }
  function evaluate(g, def, st, ev, data) {
    let changed = false;
    def.objectives.forEach((o, i) => {
      const n = o.n || 1;
      const cur = st.prog[i] || 0;
      if (cur >= n) return;
      let next = cur;
      if (o.state) next = Math.min(n, Math.max(0, Math.floor(o.state(g))));
      else if (ev && o.ev === ev && (!o.match || o.match(data, g))) next = Math.min(n, cur + 1);
      if (next !== cur) {
        st.prog[i] = next;
        changed = true;
      }
    });
    return changed;
  }
  var allDone = (def, st) => def.objectives.every((o, i) => (st.prog[i] || 0) >= (o.n || 1));
  async function startQuest(g, id, { quiet = false } = {}) {
    const def = QUESTS[id];
    if (!def) throw new Error("Misi\xF3n desconocida: " + id);
    if (q(g, id)) return false;
    g.state.quests[id] = { status: "active", prog: def.objectives.map(() => 0), startedAt: g.state.player.playtime };
    evaluate(g, def, g.state.quests[id], null, null);
    if (!quiet) {
      g.audio.sfx("achievement");
      g.ui.toast(`\u{1F4DC} Nueva misi\xF3n: <b>${def.name}</b>`);
    }
    g.emit("quest_start", { id });
    if (def.onStart) await def.onStart(g);
    checkDone(g, id);
    return true;
  }
  function checkDone(g, id) {
    const def = QUESTS[id], st = q(g, id);
    if (!st || st.status !== "active" || !allDone(def, st)) return;
    if (def.turnIn) {
      st.status = "ready";
      g.audio.sfx("select");
      g.ui.toast(`\u2714 Objetivos cumplidos: <b>${def.name}</b>`);
      g.emit("quest_ready", { id });
    } else queueMicrotask(() => completeQuest(g, id));
  }
  async function completeQuest(g, id) {
    const def = QUESTS[id], st = q(g, id);
    if (!def || !st || st.status === "done") return false;
    if (!allDone(def, st)) return false;
    st.status = "done";
    st.doneAt = g.state.player.playtime;
    const r = def.reward || {};
    g.audio.sfx("achievement");
    g.ui.toast(`\u{1F3C5} Misi\xF3n completada: <b>${def.name}</b>`);
    if (r.money) g.addMoney(r.money);
    if (r.items) for (const [it, n] of Object.entries(r.items)) {
      await g.giveItem(it, n, { quiet: true });
    }
    if (r.xp) {
      for (const c of g.party) if (!c.egg && c.lv < 100) gainXp(c, r.xp);
    }
    if (r.cosmetic) g.unlockCosmetic?.(r.cosmetic);
    g.emit("quest_done", { id, kind: def.kind });
    if (def.onComplete) await def.onComplete(g);
    return true;
  }
  function installQuests(g) {
    g.startQuest = (id, o) => startQuest(g, id, o);
    g.completeQuest = (id) => completeQuest(g, id);
    g.questStatus = (id) => questStatus(g, id);
    g.on((ev, data) => {
      if (!g.state || ev === "quest_start" || ev === "quest_ready" || ev === "quest_done") return;
      for (const [id, st] of Object.entries(g.state.quests)) {
        const def = QUESTS[id];
        if (!def || st.status !== "active") continue;
        const changed = evaluate(g, def, st, ev, data);
        if (changed) {
          const total = def.objectives.length, done = def.objectives.filter((o, i) => (st.prog[i] || 0) >= (o.n || 1)).length;
          if (!allDone(def, st)) g.ui.toast(`\u{1F4DC} ${def.name}: ${done}/${total} objetivos`);
          checkDone(g, id);
        }
      }
    });
  }

  // src/data/quests_data.js
  var flag = (f) => (g) => g.flag(f) ? 1 : 0;
  var caughtN = (g) => Object.keys(g.state.dex.caught).length;
  defineQuest("main_01", { kind: "main", name: "El gran d\xEDa", desc: "El Prof. Sauce te espera en su laboratorio de Villa Alba. \xA1Hoy empieza tu viaje!", objectives: [{ text: "Habla con el Prof. Sauce y elige a tu primera criatura", state: flag("starter_chosen") }], reward: { money: 300, items: { pocion: 2 } } });
  defineQuest("main_02", { kind: "main", name: "Primeros pasos", desc: "{rival} quiere ver de qu\xE9 eres capaz. Cruza la Ruta 1.", objectives: [{ text: "Derrota a {rival} en la Ruta 1", state: flag("rival1_done") }], reward: { money: 200, items: { capsula: 3 } } });
  defineQuest("main_03", { kind: "main", name: "Un paquete para Ciudad Roble", desc: "El Prof. Sauce necesita que entregues un paquete delicado en el Museo de Ciudad Roble, al otro lado del Bosque Umbra.", objectives: [{ text: "Cruza la Ruta 1 y el Bosque Umbra", state: flag("bosque_cruzado") }, { text: "Entrega el paquete en el museo de Ciudad Roble", state: flag("paquete_entregado") }], reward: { money: 600, items: { super_pocion: 3 } } });
  defineQuest("side_baston", { kind: "side", name: "El bast\xF3n del abuelo Tom\xE1s", desc: "Tom\xE1s perdi\xF3 su bast\xF3n paseando por la Ruta 1. Seguro que est\xE1 escondido entre la hierba.", turnIn: true, objectives: [{ text: "Encuentra el bast\xF3n en la Ruta 1", state: (g) => bagCount(g.bag, "baston_perdido") > 0 || g.flag("baston_entregado") ? 1 : 0 }, { text: "Devu\xE9lveselo a Tom\xE1s en Villa Alba", state: flag("baston_entregado") }], reward: { money: 500, items: { caramelo_exp_s: 3 } } });
  defineQuest("side_captura1", { kind: "side", name: "Primera captura", desc: "Debilita a una criatura salvaje y lanza una c\xE1psula para capturarla.", objectives: [{ text: "Captura una criatura salvaje", ev: "capture" }], reward: { money: 300, items: { super_capsula: 2 } } });
  defineQuest("side_entrenador1", { kind: "side", name: "Duelo en la ruta", desc: "Los entrenadores de la Ruta 1 buscan rivales. Demuestra lo que vales.", objectives: [{ text: "Derrota a 2 entrenadores", ev: "defeat", n: 2, match: (d) => !d.gym }], reward: { money: 400, items: { antidoto: 3, pocion: 3 } } });
  defineQuest("side_dex10", { kind: "side", name: "Atlas de Aurelia", desc: "Sauce necesita datos para su Atlas: registra criaturas captur\xE1ndolas.", objectives: [{ text: "Captura 5 especies distintas", state: (g) => Math.min(5, caughtN(g) - 1) }], reward: { money: 800, items: { super_capsula: 5 } } });

  // src/input.js
  var KEYMAP = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    Enter: "confirm",
    Space: "confirm",
    KeyZ: "confirm",
    KeyE: "confirm",
    Escape: "cancel",
    Backspace: "cancel",
    KeyX: "cancel",
    KeyQ: "cancel",
    KeyM: "menu",
    Tab: "menu",
    ShiftLeft: "run",
    ShiftRight: "run",
    KeyC: "run"
  };
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var Input = class {
    constructor() {
      this.held = /* @__PURE__ */ new Set();
      this.order = [];
      this.handlers = [];
      this.enabled = true;
      this.locked = false;
      window.addEventListener("keydown", (e) => this._down(e));
      window.addEventListener("keyup", (e) => this._up(e));
      window.addEventListener("blur", () => {
        this.held.clear();
        this.order = [];
      });
    }
    _down(e) {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab", "Backspace"].includes(e.code)) e.preventDefault();
      if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) && !["Escape", "Enter"].includes(e.code)) return;
      if (!this.held.has(a)) {
        this.held.add(a);
        if (DIRS[a]) {
          this.order = this.order.filter((x) => x !== a);
          this.order.push(a);
        }
        this.press(a, e.repeat);
      } else if (e.repeat && DIRS[a]) this.press(a, true);
    }
    _up(e) {
      const a = KEYMAP[e.code];
      if (!a) return;
      this.held.delete(a);
      this.order = this.order.filter((x) => x !== a);
    }
    /** Pulsación lógica (también la usan los botones táctiles) */
    press(action, repeat = false) {
      if (!this.enabled) return;
      const h = this.handlers[this.handlers.length - 1];
      if (h) h(action, repeat);
    }
    pressVirtual(a, down) {
      if (down) {
        if (!this.held.has(a)) {
          this.held.add(a);
          if (DIRS[a]) {
            this.order = this.order.filter((x) => x !== a);
            this.order.push(a);
          }
          this.press(a, false);
        }
      } else {
        this.held.delete(a);
        this.order = this.order.filter((x) => x !== a);
      }
    }
    /** Dirección mantenida (la última pulsada) */
    dir() {
      for (let i = this.order.length - 1; i >= 0; i--) if (this.held.has(this.order[i])) return this.order[i];
      return null;
    }
    isHeld(a) {
      return this.held.has(a);
    }
    /** Apila un manejador de acciones; devuelve función para retirarlo. */
    push(fn) {
      this.handlers.push(fn);
      return () => {
        const i = this.handlers.lastIndexOf(fn);
        if (i >= 0) this.handlers.splice(i, 1);
      };
    }
  };

  // src/audio.js
  init_rng();
  var midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  var SCALES = { mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10], dorica: [0, 2, 3, 5, 7, 9, 10], lidia: [0, 2, 4, 6, 7, 9, 11], pentatonica: [0, 2, 4, 7, 9], frigia: [0, 1, 3, 5, 7, 8, 10] };
  var TRACKS = {
    title: { bpm: 96, root: 60, scale: "mayor", prog: [0, 4, 5, 3], lead: "triangle", seed: 11, density: 0.7, drums: true },
    town: { bpm: 104, root: 62, scale: "mayor", prog: [0, 3, 4, 0], lead: "square", seed: 21, density: 0.65, drums: false },
    route: { bpm: 118, root: 64, scale: "mayor", prog: [0, 5, 3, 4], lead: "square", seed: 31, density: 0.8, drums: true },
    forest: { bpm: 90, root: 57, scale: "dorica", prog: [0, 3, 0, 4], lead: "triangle", seed: 41, density: 0.5, drums: false },
    cave: { bpm: 72, root: 52, scale: "frigia", prog: [0, 1, 0, 5], lead: "sine", seed: 51, density: 0.4, drums: false },
    sea: { bpm: 100, root: 60, scale: "lidia", prog: [0, 4, 3, 4], lead: "triangle", seed: 61, density: 0.6, drums: false },
    desert: { bpm: 92, root: 58, scale: "frigia", prog: [0, 1, 0, 3], lead: "square", seed: 71, density: 0.6, drums: true },
    snow: { bpm: 80, root: 65, scale: "mayor", prog: [0, 5, 3, 4], lead: "sine", seed: 81, density: 0.5, drums: false },
    volcano: { bpm: 126, root: 55, scale: "menor", prog: [0, 5, 3, 4], lead: "sawtooth", seed: 91, density: 0.8, drums: true },
    swamp: { bpm: 78, root: 53, scale: "menor", prog: [0, 3, 5, 3], lead: "triangle", seed: 101, density: 0.4, drums: false },
    ruins: { bpm: 70, root: 55, scale: "dorica", prog: [0, 4, 1, 4], lead: "sine", seed: 111, density: 0.45, drums: false },
    battle: { bpm: 150, root: 57, scale: "menor", prog: [0, 5, 3, 4], lead: "square", seed: 121, density: 0.95, drums: true },
    trainer: { bpm: 156, root: 59, scale: "dorica", prog: [0, 3, 5, 4], lead: "square", seed: 131, density: 0.95, drums: true },
    gym: { bpm: 160, root: 60, scale: "menor", prog: [0, 6, 5, 4], lead: "sawtooth", seed: 141, density: 1, drums: true },
    legend: { bpm: 138, root: 55, scale: "frigia", prog: [0, 1, 5, 4], lead: "sawtooth", seed: 151, density: 0.9, drums: true },
    league: { bpm: 148, root: 62, scale: "mayor", prog: [0, 4, 5, 3], lead: "square", seed: 161, density: 1, drums: true },
    victory: { bpm: 132, root: 65, scale: "mayor", prog: [0, 3, 4, 0], lead: "square", seed: 171, density: 0.9, drums: true, once: true },
    night: { bpm: 76, root: 57, scale: "dorica", prog: [0, 4, 3, 4], lead: "sine", seed: 181, density: 0.35, drums: false },
    indoor: { bpm: 88, root: 60, scale: "pentatonica", prog: [0, 2, 3, 2], lead: "triangle", seed: 191, density: 0.45, drums: false }
  };
  var Audio = class {
    constructor(settings) {
      this.settings = settings;
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.track = null;
      this.timer = null;
      this.nextTime = 0;
      this.step = 0;
      this.pattern = null;
      this.noise = null;
    }
    _ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain.connect(this.master);
        this.sfxGain.connect(this.master);
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noise = b;
        this.applyVolumes();
        return true;
      } catch {
        this.ctx = null;
        return false;
      }
    }
    /** Debe llamarse tras un gesto del usuario */
    unlock() {
      if (this._ensure() && this.ctx.state === "suspended") this.ctx.resume();
    }
    applyVolumes() {
      if (!this.ctx) return;
      const v = this.settings.volume;
      this.master.gain.value = v.master;
      this.musicGain.gain.value = v.music * 0.55;
      this.sfxGain.gain.value = v.sfx;
    }
    _tone(freq, t, dur, { type = "square", vol = 0.2, slide = 0, dest = null, attack = 5e-3, vib = 0 } = {}) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
      if (vib) {
        const l = this.ctx.createOscillator(), lg = this.ctx.createGain();
        l.frequency.value = 6;
        lg.gain.value = vib;
        l.connect(lg);
        lg.connect(o.frequency);
        l.start(t);
        l.stop(t + dur + 0.05);
      }
      g.gain.setValueAtTime(1e-4, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      o.connect(g);
      g.connect(dest || this.sfxGain);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    _noise(t, dur, { vol = 0.15, freq = 3e3, dest = null, q: q2 = 1 } = {}) {
      const s = this.ctx.createBufferSource();
      s.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq;
      f.Q.value = q2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(dest || this.sfxGain);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.02);
    }
    sfx(name) {
      if (!this._ensure()) return;
      const c = this.ctx, t = c.currentTime + 1e-3;
      const seq = (notes, o = {}) => notes.forEach(([f, d, dt = 0], i) => this._tone(f, t + notes.slice(0, i).reduce((a, n) => a + (n[2] ?? n[1]), 0), d, o));
      switch (name) {
        case "select":
          this._tone(660, t, 0.06, { vol: 0.12 });
          break;
        case "confirm":
          seq([[523, 0.06, 0.06], [784, 0.09]], { vol: 0.14 });
          break;
        case "cancel":
          seq([[440, 0.06, 0.06], [294, 0.1]], { vol: 0.12 });
          break;
        case "error":
          this._tone(160, t, 0.18, { vol: 0.16, type: "sawtooth" });
          break;
        case "step":
          this._noise(t, 0.04, { vol: 0.04, freq: 800 });
          break;
        case "bump":
          this._tone(110, t, 0.06, { vol: 0.1, type: "triangle" });
          break;
        case "door":
          seq([[392, 0.05, 0.05], [523, 0.05, 0.05], [659, 0.1]], { vol: 0.12, type: "triangle" });
          break;
        case "warp":
          this._tone(300, t, 0.35, { vol: 0.14, slide: 700, type: "triangle" });
          break;
        case "encounter":
          seq([[880, 0.05, 0.05], [660, 0.05, 0.05], [880, 0.05, 0.05], [1100, 0.12]], { vol: 0.15, type: "square" });
          this._noise(t, 0.3, { vol: 0.08, freq: 1500 });
          break;
        case "hit":
          this._noise(t, 0.12, { vol: 0.28, freq: 900, q: 0.8 });
          this._tone(160, t, 0.1, { vol: 0.2, type: "square", slide: -80 });
          break;
        case "crit":
          this._noise(t, 0.2, { vol: 0.35, freq: 1500 });
          this._tone(220, t, 0.18, { vol: 0.25, slide: -120, type: "sawtooth" });
          this._tone(880, t + 0.02, 0.08, { vol: 0.15 });
          break;
        case "supereff":
          this._noise(t, 0.18, { vol: 0.3, freq: 1200 });
          this._tone(330, t, 0.15, { vol: 0.2, slide: 330, type: "square" });
          break;
        case "resist":
          this._noise(t, 0.08, { vol: 0.12, freq: 500 });
          this._tone(120, t, 0.1, { vol: 0.12, type: "triangle" });
          break;
        case "buff":
          seq([[440, 0.07, 0.07], [554, 0.07, 0.07], [659, 0.1]], { vol: 0.13, type: "triangle" });
          break;
        case "debuff":
          seq([[659, 0.07, 0.07], [494, 0.07, 0.07], [370, 0.1]], { vol: 0.13, type: "triangle" });
          break;
        case "status":
          this._tone(200, t, 0.25, { vol: 0.14, type: "sawtooth", vib: 20 });
          break;
        case "faint":
          this._tone(440, t, 0.6, { vol: 0.2, slide: -380, type: "triangle" });
          break;
        case "heal":
          seq([[523, 0.08, 0.08], [659, 0.08, 0.08], [784, 0.08, 0.08], [1047, 0.2]], { vol: 0.13, type: "triangle" });
          break;
        case "item":
          seq([[784, 0.07, 0.07], [988, 0.07, 0.07], [1319, 0.15]], { vol: 0.13 });
          break;
        case "coin":
          seq([[988, 0.05, 0.05], [1319, 0.15]], { vol: 0.12 });
          break;
        case "levelup":
          seq([[523, 0.1, 0.1], [659, 0.1, 0.1], [784, 0.1, 0.1], [1047, 0.1, 0.1], [784, 0.08, 0.08], [1047, 0.3]], { vol: 0.15 });
          break;
        case "evolve":
          for (let i = 0; i < 14; i++) this._tone(300 + i * 60, t + i * 0.13, 0.16, { vol: 0.1, type: "triangle" });
          this._tone(1047, t + 1.9, 0.6, { vol: 0.18 });
          break;
        case "throw":
          this._tone(500, t, 0.25, { vol: 0.12, slide: 300, type: "triangle" });
          break;
        case "shake":
          this._tone(300, t, 0.1, { vol: 0.14, type: "square" });
          this._tone(240, t + 0.08, 0.08, { vol: 0.1, type: "square" });
          break;
        case "caught":
          seq([[523, 0.1, 0.1], [659, 0.1, 0.1], [784, 0.1, 0.1], [1047, 0.12, 0.12], [784, 0.08, 0.08], [1047, 0.4]], { vol: 0.16 });
          break;
        case "escape":
          this._tone(700, t, 0.18, { vol: 0.14, slide: -400, type: "sawtooth" });
          break;
        case "flee":
          this._tone(300, t, 0.3, { vol: 0.12, slide: 500, type: "triangle" });
          break;
        case "win":
          seq([[523, 0.12, 0.12], [523, 0.12, 0.12], [523, 0.12, 0.12], [659, 0.2, 0.2], [784, 0.4]], { vol: 0.15 });
          break;
        case "badge":
          seq([[392, 0.14, 0.14], [523, 0.14, 0.14], [659, 0.14, 0.14], [784, 0.14, 0.14], [1047, 0.6]], { vol: 0.17 });
          break;
        case "blip":
          this._tone(440 + Math.random() * 120, t, 0.025, { vol: 0.05, type: "square" });
          break;
        case "menu":
          this._tone(587, t, 0.05, { vol: 0.1 });
          break;
        case "achievement":
          seq([[784, 0.08, 0.08], [988, 0.08, 0.08], [1175, 0.08, 0.08], [1568, 0.3]], { vol: 0.13, type: "triangle" });
          break;
        case "save":
          seq([[659, 0.07, 0.07], [880, 0.07, 0.07], [1047, 0.2]], { vol: 0.12, type: "triangle" });
          break;
        case "sparkle":
          this._tone(1500, t, 0.1, { vol: 0.06, type: "triangle", slide: 700 });
          break;
        case "thunder":
          this._noise(t, 0.8, { vol: 0.35, freq: 220, q: 0.5 });
          break;
        default:
          break;
      }
    }
    /** Grito de criatura: único y determinista por especie. */
    cry(spId, strong = false) {
      if (!this._ensure()) return;
      const s = getSpecies(spId), t = this.ctx.currentTime + 1e-3;
      const r = new RNG(hashStr(s.name));
      const base = Math.max(110, 560 - Math.log2(s.w + 1) * 46) * (strong ? 0.9 : 1);
      const wave = { fuego: "sawtooth", agua: "sine", planta: "triangle", electrico: "square", tierra: "triangle", roca: "square", aire: "triangle", hielo: "sine", lucha: "sawtooth", veneno: "sawtooth", mental: "sine", sombra: "sawtooth", luz: "sine", metal: "square", insecto: "square", dragon: "sawtooth", sonido: "triangle", espiritu: "sine" }[s.types[0]] || "square";
      const n = r.int(2, 4);
      for (let i = 0; i < n; i++) this._tone(base * (0.8 + r.next() * 0.6), t + i * 0.09, 0.14 + r.next() * 0.1, { type: wave, vol: 0.14, slide: (r.next() - 0.5) * base * 0.8, vib: r.chance(0.4) ? 25 : 0 });
      if (s.legendary) this._tone(base / 2, t, 0.6, { type: "sawtooth", vol: 0.08, slide: -40 });
    }
    // ---------- música ----------
    playMusic(name) {
      const tr = TRACKS[name] ? name : "route";
      if (this.track === tr && this.timer) return;
      this.stopMusic();
      this.track = tr;
      if (!this._ensure()) return;
      const T2 = TRACKS[tr];
      const r = new RNG(T2.seed);
      const sc = SCALES[T2.scale];
      const note = (deg, oct = 0) => T2.root + sc[(deg % sc.length + sc.length) % sc.length] + 12 * (Math.floor(deg / sc.length) + oct);
      const pattern = [];
      for (let bar = 0; bar < 8; bar++) {
        const chord = T2.prog[bar % T2.prog.length];
        let deg = chord + r.int(0, 4);
        const lead = [];
        for (let s = 0; s < 8; s++) {
          if (r.next() > T2.density) {
            lead.push(null);
            continue;
          }
          const move = r.pick([-2, -1, -1, 0, 1, 1, 2, 3]);
          deg = Math.max(chord - 2, Math.min(chord + 9, deg + move));
          lead.push(note(deg, 1));
        }
        pattern.push({ chord, lead, bass: [note(chord, -1), note(chord + 4, -1)], pad: [note(chord, 0), note(chord + 2, 0), note(chord + 4, 0)] });
      }
      this.pattern = pattern;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this._schedule(), 120);
      this._schedule();
    }
    _schedule() {
      if (!this.ctx || !this.pattern) return;
      const T2 = TRACKS[this.track];
      const spb = 60 / T2.bpm / 2;
      while (this.nextTime < this.ctx.currentTime + 0.5) {
        const bar = this.pattern[Math.floor(this.step / 8) % this.pattern.length], s = this.step % 8, t = this.nextTime;
        const ln = bar.lead[s];
        if (ln != null) this._tone(midi(ln), t, spb * 1.6, { type: T2.lead, vol: T2.lead === "sine" ? 0.16 : 0.07, dest: this.musicGain, vib: T2.lead === "sine" ? 4 : 0 });
        if (s % 4 === 0) this._tone(midi(bar.bass[s / 4 % 2 | 0]), t, spb * 3.6, { type: "triangle", vol: 0.2, dest: this.musicGain });
        if (s === 0) for (const p of bar.pad) this._tone(midi(p), t, spb * 7.5, { type: "sine", vol: 0.045, dest: this.musicGain, attack: 0.15 });
        if (T2.drums) {
          if (s % 4 === 0) this._tone(110, t, 0.1, { type: "sine", vol: 0.3, slide: -70, dest: this.musicGain });
          if (s % 4 === 2) this._noise(t, 0.08, { vol: 0.1, freq: 2500, dest: this.musicGain });
          if (T2.bpm > 110 && s % 2 === 1) this._noise(t, 0.03, { vol: 0.04, freq: 7e3, dest: this.musicGain });
        }
        this.nextTime += spb;
        this.step++;
        if (T2.once && this.step >= 8 * 4) {
          this.stopMusic();
          return;
        }
      }
    }
    stopMusic() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.pattern = null;
      this.track = null;
    }
    /** Sube/baja brevemente el volumen de la música (para fanfarrias) */
    duck(ms = 1500) {
      if (!this.ctx) return;
      const g = this.musicGain.gain;
      const v = this.settings.volume.music * 0.55;
      g.setTargetAtTime(v * 0.15, this.ctx.currentTime, 0.05);
      setTimeout(() => g.setTargetAtTime(v, this.ctx.currentTime, 0.3), ms);
    }
  };
  var MUSIC_TRACKS = Object.keys(TRACKS);

  // src/save.js
  init_config();

  // src/state.js
  init_config();

  // src/gfx/trainer_gfx.js
  init_color();
  var SKINS = ["#fbd9bf", "#f2c29a", "#d9a273", "#b57a4e", "#8a5a38", "#5e3a24"];
  var HAIR_COLORS = ["#2a1c14", "#5a3820", "#9a6a38", "#d8b060", "#e8e0c8", "#c8453f", "#d86aa8", "#4a6ad8", "#3aa86a", "#8a5ad0"];
  var OUTFIT_COLORS = ["#d84a4a", "#4a7ad8", "#4aa85a", "#e0b83a", "#8a5ad0", "#e8883a", "#3aa8a0", "#f0f0f0", "#3a3a4a", "#d86aa8"];
  var PANTS_COLORS = ["#3a4a78", "#2e2e3e", "#6a5a48", "#4a6a4a", "#8a3a3a", "#d8d0c0", "#5a4a8a", "#2a5a6a"];
  var HAIR_STYLES = [["short", "Corto"], ["long", "Largo"], ["spiky", "Puntas"], ["ponytail", "Coleta"], ["bun", "Mo\xF1o"], ["curly", "Rizos"], ["bob", "Media melena"], ["mohawk", "Cresta"]];
  var OUTFITS = [["jacket", "Chaqueta"], ["tshirt", "Camiseta"], ["hoodie", "Sudadera"], ["dress", "Vestido"], ["overalls", "Peto"], ["coat", "Abrigo largo"], ["uniform", "Uniforme"]];
  var HATS = [["none", "Sin sombrero"], ["cap", "Gorra"], ["beanie", "Gorro"], ["hat", "Sombrero"], ["headband", "Cinta"], ["goggles", "Gafas de aviador"], ["ribbon", "Lazo"], ["crown", "Corona"], ["laurel", "Laurel"], ["tophat", "Chistera"]];
  var STYLES = [["a", "Aventurero/a"], ["b", "Explorador/a"], ["c", "Estratega"]];
  var DEFAULT_LOOK = { skin: 1, hair: "short", hairColor: 1, outfit: "jacket", top: 0, bottom: 0, shoes: "#3a2a22", hat: "none", hatColor: 0, glasses: false, scarf: null, bag: null, style: "a" };
  var cache3 = /* @__PURE__ */ new Map();
  function resolve(look2) {
    const L2 = { ...DEFAULT_LOOK, ...look2 };
    const col = (v, arr) => typeof v === "number" ? arr[v % arr.length] : v;
    return {
      ...L2,
      skinC: col(L2.skin, SKINS),
      hairC: col(L2.hairColor, HAIR_COLORS),
      topC: col(L2.top, OUTFIT_COLORS),
      botC: col(L2.bottom, PANTS_COLORS),
      hatC: col(L2.hatColor, OUTFIT_COLORS),
      scarfC: L2.scarf == null ? null : col(L2.scarf, OUTFIT_COLORS),
      bagC: L2.bag == null ? null : col(L2.bag, OUTFIT_COLORS)
    };
  }
  function trainerCanvas(look2, dir = "down", frame = 0) {
    const key = JSON.stringify(look2) + dir + frame;
    let c = cache3.get(key);
    if (!c) {
      c = draw(resolve(look2), dir, frame);
      cache3.set(key, c);
    }
    return c;
  }
  function draw(L2, dir, frame) {
    const W = 16, H = 24;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d");
    const R = (x, y, w, h, c) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    };
    const P2 = (x, y, c) => R(x, y, 1, 1, c);
    const mirror = dir === "right";
    if (mirror) dir = "left";
    const skin = L2.skinC, skinD = darken(skin, 0.18), hair = L2.hairC, hairD = darken(hair, 0.25), hairL = lighten(hair, 0.2);
    const top = L2.topC, topD = darken(top, 0.22), topL = lighten(top, 0.22), bot = L2.botC, botD = darken(bot, 0.22), shoe = L2.shoes;
    const step = frame === 0 ? 0 : frame === 1 ? 1 : -1;
    const bob = frame === 0 ? 0 : 0;
    const front = dir === "down", back = dir === "up", side = dir === "left";
    const legY = 18, legH = L2.outfit === "dress" ? 3 : 4;
    const dressLegY = L2.outfit === "dress" ? 19 : legY;
    if (front || back) {
      const lh = (s) => legH - (s === 1 ? 1 : 0);
      R(5, dressLegY, 3, lh(step), bot);
      R(8, dressLegY, 3, lh(-step), bot);
      R(5, dressLegY + lh(step) - 0, 3, 2 - (step === 1 ? 0 : 0), shoe);
      R(8, dressLegY + lh(-step), 3, 2, shoe);
      if (L2.outfit === "dress") {
        R(5, 19, 3, 3, skin);
        R(8, 19, 3, 3, skin);
        R(5, 21, 3, 1, shoe);
        R(8, 21, 3, 1, shoe);
      }
      R(5, dressLegY, 1, 1, botD);
    } else {
      const o = step * 2;
      R(6 + o, legY, 3, legH, bot);
      R(7 - o, legY, 3, legH, botD);
      R(5 + o, legY + legH, 4, 2, shoe);
      R(7 - o, legY + legH, 4, 2, darken(shoe, 0.2));
      if (L2.outfit === "dress") {
        R(6 + o, 19, 3, 3, skin);
        R(7 - o, 19, 3, 3, skinD);
      }
    }
    const torsoY = 11 + bob;
    const longCoat = L2.outfit === "coat";
    const bodyBot = L2.outfit === "dress" ? 19 : longCoat ? 20 : 18;
    if (front || back) {
      R(5, torsoY, 6, bodyBot - torsoY, top);
      if (L2.outfit === "dress") {
        R(4, 16, 8, 3, top);
        R(3, 18, 10, 1, topD);
        R(4, 17, 8, 1, topL);
      }
      if (longCoat) {
        R(4, 17, 8, 3, top);
        R(4, 19, 8, 1, topD);
      }
      R(5, torsoY, 6, 1, topL);
      if (L2.outfit === "jacket") {
        if (front) {
          R(7, torsoY + 1, 2, 6, "#f4f0e8");
          R(7, torsoY, 1, 7, topD);
          R(8, torsoY, 1, 7, topD);
          R(7, torsoY + 1, 2, 5, "#f4f0e8");
        }
        R(5, torsoY + 5, 6, 1, topD);
      }
      if (L2.outfit === "hoodie") {
        R(5, torsoY - 1, 6, 2, topL);
        if (front) {
          R(7, torsoY + 2, 1, 3, "#f4f0e8");
          R(8, torsoY + 2, 1, 3, "#f4f0e8");
          R(6, torsoY + 4, 4, 2, topD);
        }
      }
      if (L2.outfit === "overalls") {
        if (front) {
          R(5, torsoY + 2, 6, 5, bot);
          R(5, torsoY, 1, 3, bot);
          R(10, torsoY, 1, 3, bot);
          R(7, torsoY + 3, 2, 2, botD);
        } else R(5, torsoY + 4, 6, 3, bot);
      }
      if (L2.outfit === "uniform") {
        R(5, torsoY + 5, 6, 1, "#d8c060");
        if (front) {
          R(7, torsoY + 1, 2, 3, "#f4f4f4");
          P2(7, torsoY + 2, "#d8453f");
          P2(8, torsoY + 2, "#d8453f");
        }
      }
      if (L2.outfit === "tshirt") {
        R(5, torsoY + 5, 6, 1, topD);
      }
      const armC = L2.outfit === "tshirt" || L2.outfit === "dress" || L2.outfit === "overalls" ? skin : top;
      const aY = torsoY + 1 + (step === 1 ? 0 : 0);
      R(3, aY, 2, 6, armC);
      R(11, aY, 2, 6, armC);
      R(3, aY + 5, 2, 1, skin);
      R(11, aY + 5, 2, 1, skin);
      if (L2.outfit === "jacket" || L2.outfit === "hoodie" || L2.outfit === "coat" || L2.outfit === "uniform") {
        R(3, aY + 4, 2, 1, topD);
        R(11, aY + 4, 2, 1, topD);
      }
    } else {
      R(5, torsoY, 6, bodyBot - torsoY, top);
      R(5, torsoY, 6, 1, topL);
      if (L2.outfit === "dress") {
        R(4, 16, 8, 3, top);
        R(4, 18, 8, 1, topD);
      }
      if (longCoat) {
        R(4, 17, 8, 3, top);
        R(4, 19, 8, 1, topD);
      }
      if (L2.outfit === "overalls") R(6, torsoY + 3, 5, 4, bot);
      if (L2.outfit === "jacket") R(5, torsoY + 5, 6, 1, topD);
      const armC = L2.outfit === "tshirt" || L2.outfit === "dress" || L2.outfit === "overalls" ? skin : top;
      const o = step * 2;
      R(7 + o, torsoY + 1, 3, 6, armC);
      R(7 + o, torsoY + 6, 3, 1, skin);
      R(7 + o, torsoY + 1, 1, 6, darken(armC, 0.12));
    }
    if (L2.bagC) {
      const bc = L2.bagC, bd = darken(bc, 0.25);
      if (back) {
        R(4, torsoY, 8, 7, bc);
        R(4, torsoY + 6, 8, 1, bd);
        R(7, torsoY + 2, 2, 3, bd);
      } else if (side) {
        R(10, torsoY + 1, 3, 6, bc);
        R(10, torsoY + 6, 3, 1, bd);
      } else {
        R(5, torsoY, 1, 6, bd);
        R(10, torsoY, 1, 6, bd);
      }
    }
    if (L2.scarfC) {
      const sc = L2.scarfC;
      R(5, 10, 6, 2, sc);
      R(5, 11, 6, 1, darken(sc, 0.2));
      if (front || side) R(side ? 6 : 8, 12, 2, 3, sc);
    }
    const hy = 3 + bob;
    if (front || back) {
      R(4, hy + 1, 8, 7, skin);
      R(4, hy + 7, 8, 1, skinD);
      R(3, hy + 4, 1, 2, skin);
      R(12, hy + 4, 1, 2, skin);
      R(3, hy + 4, 1, 2, skinD);
    } else {
      R(4, hy + 1, 8, 7, skin);
      R(4, hy + 7, 8, 1, skinD);
      R(11, hy + 5, 1, 1, skinD);
    }
    if (front) {
      P2(6, hy + 4, "#1a1226");
      P2(9, hy + 4, "#1a1226");
      P2(6, hy + 3, "#fff");
      P2(9, hy + 3, "#fff");
      P2(6, hy + 4, "#1a1226");
      P2(9, hy + 4, "#1a1226");
      P2(7, hy + 6, skinD);
      P2(8, hy + 6, skinD);
      P2(5, hy + 5, lighten("#e87a7a", 0.2));
      P2(10, hy + 5, lighten("#e87a7a", 0.2));
    }
    if (side) {
      P2(5, hy + 4, "#1a1226");
      P2(5, hy + 3, "#fff");
      P2(4, hy + 5, skinD);
    }
    if (L2.glasses && !back) {
      const gc = "#2a2a3a";
      if (front) {
        R(5, hy + 3, 3, 3, gc);
        R(8, hy + 3, 3, 3, gc);
        P2(6, hy + 4, "#bfe8ff");
        P2(9, hy + 4, "#bfe8ff");
        P2(6, hy + 3, "#fff");
        P2(9, hy + 3, "#fff");
        P2(8, hy + 4, gc);
        R(7, hy + 4, 2, 1, gc);
      } else {
        R(4, hy + 3, 3, 3, gc);
        P2(5, hy + 4, "#bfe8ff");
        R(7, hy + 4, 4, 1, gc);
      }
    }
    const hs = L2.hair;
    const hairFront = () => {
      R(4, hy, 8, 2, hair);
      R(4, hy + 2, 1, 3, hair);
      R(11, hy + 2, 1, 3, hair);
      R(5, hy + 2, 6, 1, hair);
      P2(5, hy + 3, hair);
      P2(10, hy + 3, hair);
      R(4, hy, 8, 1, hairL);
    };
    const hairBack = () => {
      R(4, hy, 8, 8, hair);
      R(4, hy + 7, 8, 1, hairD);
      R(3, hy + 2, 1, 4, hair);
      R(12, hy + 2, 1, 4, hair);
      R(5, hy + 1, 4, 1, hairL);
    };
    const hairSide = () => {
      R(4, hy, 8, 3, hair);
      R(8, hy + 3, 4, 5, hair);
      R(4, hy + 3, 2, 2, hair);
      R(8, hy + 7, 4, 1, hairD);
      R(4, hy, 8, 1, hairL);
    };
    if (L2.hat !== "cap" || true) {
      if (hs === "bald") {
      } else if (back) hairBack();
      else if (side) hairSide();
      else hairFront();
      if (hs === "long") {
        if (front) {
          R(3, hy + 2, 2, 9, hair);
          R(11, hy + 2, 2, 9, hair);
          R(3, hy + 10, 2, 1, hairD);
          R(11, hy + 10, 2, 1, hairD);
        } else if (back) {
          R(3, hy + 7, 10, 5, hair);
          R(3, hy + 11, 10, 1, hairD);
        } else R(7, hy + 5, 5, 7, hair);
      }
      if (hs === "bob") {
        if (front) {
          R(3, hy + 2, 2, 6, hair);
          R(11, hy + 2, 2, 6, hair);
          R(3, hy + 7, 2, 1, hairD);
          R(11, hy + 7, 2, 1, hairD);
        } else if (back) {
          R(3, hy + 6, 10, 3, hair);
        } else R(7, hy + 5, 5, 4, hair);
      }
      if (hs === "spiky") {
        for (const x of [4, 6, 8, 10]) R(x, hy - 2, 2, 2, hair);
        R(5, hy - 1, 1, 1, hairL);
      }
      if (hs === "ponytail") {
        if (front) {
          R(12, hy + 1, 2, 3, hair);
          R(13, hy + 3, 1, 5, hair);
        } else if (back) {
          R(7, hy + 6, 3, 6, hair);
          R(7, hy + 11, 3, 1, hairD);
        } else {
          R(11, hy + 2, 3, 3, hair);
          R(12, hy + 4, 2, 6, hair);
        }
      }
      if (hs === "bun") {
        R(6, hy - 2, 4, 3, hair);
        R(7, hy - 3, 2, 1, hair);
        P2(6, hy - 2, hairL);
      }
      if (hs === "curly") {
        R(3, hy - 1, 10, 4, hair);
        R(3, hy + 3, 2, 3, hair);
        R(11, hy + 3, 2, 3, hair);
        for (const [x, y] of [[4, hy - 1], [7, hy - 2], [10, hy - 1]]) R(x, y, 2, 1, hairL);
      }
      if (hs === "mohawk") {
        R(7, hy - 3, 2, 4, hair);
        R(7, hy - 3, 1, 3, hairL);
      }
    }
    const hc = L2.hatC, hcD = darken(hc, 0.25), hcL = lighten(hc, 0.25);
    if (L2.hat === "cap") {
      R(4, hy - 1, 8, 3, hc);
      R(4, hy - 1, 8, 1, hcL);
      if (front) R(4, hy + 2, 8, 1, hcD);
      else if (side) R(2, hy + 2, 6, 1, hcD);
      if (side) R(2, hy + 1, 3, 1, hc);
      P2(7, hy, "#f4f0e8");
    } else if (L2.hat === "beanie") {
      R(4, hy - 1, 8, 4, hc);
      R(4, hy - 1, 8, 1, hcL);
      R(4, hy + 2, 8, 1, hcD);
      R(7, hy - 3, 2, 2, hcL);
    } else if (L2.hat === "hat") {
      R(2, hy + 1, 12, 1, hcD);
      R(3, hy, 10, 1, hc);
      R(4, hy - 3, 8, 3, hc);
      R(4, hy - 1, 8, 1, hcD);
      R(4, hy - 3, 8, 1, hcL);
    } else if (L2.hat === "headband") {
      R(4, hy + 1, 8, 1, hc);
      if (front || side) {
        R(11, hy + 1, 2, 2, hc);
      }
    } else if (L2.hat === "goggles") {
      R(4, hy, 8, 1, "#3a3a4a");
      if (!back) {
        R(5, hy - 2, 3, 3, "#5a5a70");
        R(8, hy - 2, 3, 3, "#5a5a70");
        R(6, hy - 1, 1, 1, "#9ae8ff");
        R(9, hy - 1, 1, 1, "#9ae8ff");
      }
    } else if (L2.hat === "ribbon") {
      R(9, hy - 1, 5, 3, hc);
      R(8, hy, 2, 1, hcD);
      P2(11, hy, hcL);
    } else if (L2.hat === "crown") {
      const gold = "#f2c040", gd = "#a8861c";
      R(4, hy - 1, 8, 2, gold);
      for (const x of [4, 7, 10]) R(x, hy - 3, 2, 2, gold);
      P2(5, hy - 1, "#d84a4a");
      P2(8, hy - 1, "#4a7ad8");
      P2(11, hy - 1, "#d84a4a");
      R(4, hy, 8, 1, gd);
    } else if (L2.hat === "laurel") {
      const lf = "#4aa85a", ld = "#2f7a3c";
      R(4, hy, 8, 1, lf);
      R(3, hy + 1, 1, 3, lf);
      R(12, hy + 1, 1, 3, lf);
      P2(4, hy + 1, ld);
      P2(11, hy + 1, ld);
      P2(3, hy + 3, ld);
      P2(12, hy + 3, ld);
    } else if (L2.hat === "tophat") {
      R(2, hy + 1, 12, 1, "#1a1226");
      R(4, hy - 4, 8, 5, "#2a2238");
      R(4, hy - 1, 8, 1, "#d84a4a");
      R(4, hy - 4, 8, 1, "#4a4260");
    }
    const id = g.getImageData(0, 0, W, H);
    const d = id.data;
    const alpha = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4 + 3];
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!alpha(x, y) && (alpha(x - 1, y) || alpha(x + 1, y) || alpha(x, y - 1) || alpha(x, y + 1))) out.push([x, y]);
    g.fillStyle = "#1a1226";
    for (const [x, y] of out) g.fillRect(x, y, 1, 1);
    if (mirror) {
      const m = document.createElement("canvas");
      m.width = W;
      m.height = H;
      const mg = m.getContext("2d");
      mg.translate(W, 0);
      mg.scale(-1, 1);
      mg.drawImage(cv, 0, 0);
      return m;
    }
    return cv;
  }

  // src/state.js
  var START_MAP = "casa_jugador";
  function defaultSettings() {
    return {
      volume: { master: 0.8, music: 0.7, sfx: 0.8 },
      textSpeed: "normal",
      // lento | normal | rapido | instantaneo
      clockMode: "rapido",
      // rapido (1 s = 1 min de juego) | real
      battleAnim: true,
      runToggle: false,
      scale: "auto",
      showClock: true,
      autosave: true,
      lastSlot: 1
    };
  }
  function newState({ name = "Aldo", look: look2 = DEFAULT_LOOK, seed = Date.now() } = {}) {
    return {
      version: GAME.saveVersion,
      createdAt: Date.now(),
      savedAt: 0,
      player: { name, look: { ...look2 }, map: START_MAP, x: 5, y: 4, dir: "down", money: 1500, playtime: 0, steps: 0, surfing: false, biking: false, spawnName: "start" },
      party: [],
      boxes: Array.from({ length: BOX_COUNT }, () => Array(BOX_SIZE).fill(null)),
      boxNames: Array.from({ length: BOX_COUNT }, (_, i) => `Caja ${i + 1}`),
      bag: { pocion: 3, capsula: 5 },
      dex: { seen: {}, caught: {} },
      flags: {},
      counters: {},
      quests: {},
      trainers: {},
      // id -> {beaten:true, rematch:n}
      picked: {},
      // objetos recogidos / cortados
      badges: [],
      // ids de medallas
      achievements: {},
      fastTravel: [],
      clock: { minutes: 8 * 60, days: 0 },
      weather: {},
      // región -> {id, until}
      lastHeal: { map: START_MAP, x: 5, y: 5 },
      daycare: { slots: [null, null], steps: 0, egg: null },
      wardrobe: { unlocked: [] },
      stats: { battles: 0, wins: 0, captures: 0, evolutions: 0, kos: 0, steps: 0, items: 0, tournaments: 0, hatched: 0, trades: 0 },
      tournament: { lastDay: -99, wins: 0 },
      repel: 0,
      rng: seed >>> 0,
      seed: seed >>> 0,
      cosmetic: { ballDesign: "normal", effect: null }
    };
  }

  // src/save.js
  var P = GAME.storagePrefix;
  var slotKey = (n) => `${P}.slot${n}`;
  var settingsKey = `${P}.settings`;
  var store = () => {
    try {
      return window.localStorage;
    } catch {
      return memStore;
    }
  };
  var memStore = { _d: {}, getItem(k) {
    return this._d[k] ?? null;
  }, setItem(k, v) {
    this._d[k] = v;
  }, removeItem(k) {
    delete this._d[k];
  } };
  function isObj(v) {
    return v && typeof v === "object" && !Array.isArray(v);
  }
  function mergeDefaults(def, val) {
    if (!isObj(def) || !isObj(val)) return val === void 0 ? def : val;
    const out = { ...val };
    for (const k of Object.keys(def)) out[k] = k in val ? isObj(def[k]) && isObj(val[k]) ? mergeDefaults(def[k], val[k]) : val[k] : def[k];
    return out;
  }
  var MIGRATIONS = {
    // 1: (s) => { ...; s.version = 2; return s; }
  };
  function migrate(s) {
    let guard = 0;
    while (s.version < GAME.saveVersion && MIGRATIONS[s.version] && guard++ < 50) s = MIGRATIONS[s.version](s);
    if (s.version > GAME.saveVersion) throw new Error("La partida es de una versi\xF3n m\xE1s nueva del juego.");
    s.version = GAME.saveVersion;
    return s;
  }
  function validateState(raw) {
    if (!isObj(raw)) throw new Error("Datos de partida no v\xE1lidos.");
    let s = migrate({ version: 1, ...raw });
    s = mergeDefaults(newState({ name: s.player?.name || "Entrenador", seed: s.seed ?? 1 }), s);
    if (!isObj(s.player) || typeof s.player.map !== "string") throw new Error("Falta la posici\xF3n del jugador.");
    s.player.x = Math.floor(s.player.x) || 0;
    s.player.y = Math.floor(s.player.y) || 0;
    s.party = (Array.isArray(s.party) ? s.party : []).filter((c) => validateCreature(c)).slice(0, 6);
    s.boxes = Array.from({ length: BOX_COUNT }, (_, i) => Array.from({ length: BOX_SIZE }, (_2, j) => {
      const c = s.boxes?.[i]?.[j];
      return c && validateCreature(c) ? c : null;
    }));
    s.bag = Object.fromEntries(Object.entries(s.bag || {}).filter(([id, n]) => ITEMS[id] && Number.isFinite(n) && n > 0).map(([id, n]) => [id, Math.min(999, Math.floor(n))]));
    s.player.money = Math.max(0, Math.min(999999, Math.floor(s.player.money) || 0));
    for (const k of ["seen", "caught"]) s.dex[k] = Object.fromEntries(Object.entries(s.dex[k] || {}).filter(([id]) => SPECIES[id]));
    if (!Array.isArray(s.badges)) s.badges = [];
    return s;
  }
  function summaryOf(s) {
    return { name: s.player.name, playtime: s.player.playtime, badges: s.badges.length, caught: Object.keys(s.dex.caught).length, map: s.player.map, savedAt: s.savedAt, money: s.player.money, party: s.party.map((c) => c.sp).slice(0, 6), look: s.player.look, version: s.version };
  }
  var Save = {
    slots: GAME.slots,
    /** Lista de ranuras con su resumen (o vacías/corruptas). */
    list() {
      const out = [];
      for (let n = 1; n <= GAME.slots; n++) {
        const raw = store().getItem(slotKey(n));
        if (!raw) {
          out.push({ slot: n, empty: true });
          continue;
        }
        try {
          const d = JSON.parse(raw);
          out.push({ slot: n, empty: false, summary: d.summary || summaryOf(d.state) });
        } catch {
          out.push({ slot: n, empty: false, corrupt: true, hasBackup: !!store().getItem(slotKey(n) + ".bak") });
        }
      }
      return out;
    },
    write(n, state) {
      try {
        state.savedAt = Date.now();
        const key = slotKey(n);
        const prev = store().getItem(key);
        const payload = JSON.stringify({ v: GAME.saveVersion, summary: summaryOf(state), state });
        if (prev) {
          try {
            store().setItem(key + ".bak", prev);
          } catch {
          }
        }
        store().setItem(key, payload);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message || String(e) };
      }
    },
    /** Lee y valida; si la principal está dañada intenta la copia de seguridad. */
    read(n) {
      const tryParse = (raw2) => {
        const d = JSON.parse(raw2);
        return validateState(d.state || d);
      };
      const raw = store().getItem(slotKey(n));
      if (!raw) return { ok: false, error: "Ranura vac\xEDa." };
      try {
        return { ok: true, state: tryParse(raw) };
      } catch (e1) {
        const bak = store().getItem(slotKey(n) + ".bak");
        if (bak) {
          try {
            return { ok: true, state: tryParse(bak), recovered: true };
          } catch {
          }
        }
        return { ok: false, error: "La partida est\xE1 da\xF1ada y no se pudo recuperar (" + e1.message + ")." };
      }
    },
    remove(n) {
      store().removeItem(slotKey(n));
      store().removeItem(slotKey(n) + ".bak");
    },
    exists(n) {
      return !!store().getItem(slotKey(n));
    },
    latest() {
      let best = null;
      for (const s of Save.list()) if (!s.empty && !s.corrupt && (!best || (s.summary.savedAt || 0) > (best.summary.savedAt || 0))) best = s;
      return best;
    },
    loadSettings() {
      try {
        const r = JSON.parse(store().getItem(settingsKey));
        return mergeDefaults(defaultSettings(), r || {});
      } catch {
        return defaultSettings();
      }
    },
    saveSettings(s) {
      try {
        store().setItem(settingsKey, JSON.stringify(s));
      } catch {
      }
    }
  };

  // src/game.js
  init_rng();
  init_config();
  var Game = class {
    constructor() {
      this.settings = Save.loadSettings();
      this.canvas = document.getElementById("game");
      this.ctx = this.canvas.getContext("2d");
      this.input = new Input();
      this.audio = new Audio(this.settings);
      this.ui = new UI(this);
      this.state = null;
      this.scene = null;
      this.ow = null;
      this.hooks = [];
      this.slot = this.settings.lastSlot || 1;
      this.last = 0;
      this.running = false;
      this.tTotal = 0;
      this.rng = new RNG(Date.now() & 4294967295);
      this.sessionStart = Date.now();
      const unlock2 = () => this.audio.unlock();
      window.addEventListener("pointerdown", unlock2);
      window.addEventListener("keydown", unlock2);
    }
    start() {
      if (this.running) return;
      this.running = true;
      const loop = (ts) => {
        const dt = Math.min(0.05, (ts - (this.last || ts)) / 1e3);
        this.last = ts;
        this.tTotal += dt;
        try {
          if (this.scene?.update) this.scene.update(dt);
          this.ctx.clearRect(0, 0, VIEW_W, VIEW_H);
          if (this.scene?.render) this.scene.render(this.ctx, dt);
        } catch (e) {
          console.error(e);
          this.reportError(e);
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    reportError(e) {
      if (this._errShown) return;
      this._errShown = true;
      setTimeout(() => this._errShown = false, 4e3);
      this.ui.toast("\u26A0 Error: " + (e.message || e), "");
    }
    setScene(sc) {
      const old = this.scene;
      if (old?.exit) old.exit();
      this.scene = sc;
      if (sc?.enter) sc.enter();
      return old;
    }
    // ---------- estado ----------
    get p() {
      return this.state.player;
    }
    get party() {
      return this.state.party;
    }
    get bag() {
      return this.state.bag;
    }
    get dex() {
      return this.state.dex;
    }
    get badges() {
      return this.state.badges;
    }
    get money() {
      return this.state.player.money;
    }
    get now() {
      const m = this.state.clock.minutes;
      return { hour: Math.floor(m / 60) % 24, min: m % 60, day: Math.floor(m / 1440), minutes: m };
    }
    get isNight() {
      const h = this.now.hour;
      return h >= 20 || h < 6;
    }
    get playerName() {
      return this.state?.player.name || "Entrenador";
    }
    get rivalName() {
      return this.state?.flags.rivalName || "Kai";
    }
    /** Plantilla de texto: {player}, {rival} */
    t(text) {
      return String(text).replace(/\{player\}/g, this.playerName).replace(/\{rival\}/g, this.rivalName);
    }
    flag(k) {
      return !!this.state.flags[k];
    }
    setFlag(k, v = true) {
      const had = this.state.flags[k];
      this.state.flags[k] = v;
      if (!had && v) this.emit("flag", { flag: k });
    }
    clearFlag(k) {
      delete this.state.flags[k];
    }
    count(k) {
      return this.state.counters[k] || 0;
    }
    inc(k, n = 1) {
      this.state.counters[k] = (this.state.counters[k] || 0) + n;
      return this.state.counters[k];
    }
    // ---------- eventos (misiones, logros, estadísticas) ----------
    on(fn) {
      this.hooks.push(fn);
    }
    emit(ev, data = {}) {
      for (const h of this.hooks) {
        try {
          h(ev, data, this);
        } catch (e) {
          console.error("hook", ev, e);
        }
      }
    }
    // ---------- dinero / objetos ----------
    addMoney(n) {
      this.state.player.money = Math.max(0, Math.min(MONEY_MAX, this.state.player.money + Math.floor(n)));
      if (n > 0) this.emit("money", { n });
    }
    spend(n) {
      if (this.money < n) return false;
      this.state.player.money -= Math.floor(n);
      return true;
    }
    hasItem(id, n = 1) {
      return bagHas(this.bag, id, n);
    }
    hasKey(k) {
      return hasKey(this.bag, k);
    }
    async giveItem(id, n = 1, { quiet = false } = {}) {
      const it = getItem(id);
      bagAdd(this.bag, id, n);
      this.state.stats.items += n;
      this.emit("item", { id, n });
      if (!quiet) {
        this.audio.sfx("item");
        await this.say(`\xA1Has obtenido ${n > 1 ? n + " \xD7 " : ""}${it.name}!`);
      }
    }
    takeItem(id, n = 1) {
      const ok = bagRemove(this.bag, id, n);
      if (ok) this.emit("item", { id, n: -n });
      return ok;
    }
    // ---------- criaturas ----------
    registerSeen(spId) {
      if (!this.dex.seen[spId]) {
        this.dex.seen[spId] = 1;
        this.emit("dex_seen", { sp: spId });
      }
    }
    registerCaught(spId) {
      this.registerSeen(spId);
      if (!this.dex.caught[spId]) {
        this.dex.caught[spId] = 1;
        this.emit("dex_caught", { sp: spId, count: Object.keys(this.dex.caught).length });
        return true;
      }
      return false;
    }
    /** Añade una criatura al equipo o, si está lleno, a la primera caja libre. Devuelve 'party' | {box} | null */
    addCreature(c) {
      if (this.party.length < PARTY_MAX) {
        this.party.push(c);
        return "party";
      }
      for (let b = 0; b < BOX_COUNT; b++) for (let i = 0; i < BOX_SIZE; i++) if (!this.state.boxes[b][i]) {
        this.state.boxes[b][i] = c;
        return { box: b, slot: i };
      }
      return null;
    }
    /** Recibir una criatura (captura, regalo, huevo). Registra en la enciclopedia y notifica. */
    async receiveCreature(c, { how = "capture", quiet = false } = {}) {
      c.ot = c.ot || this.playerName;
      c.caught = c.caught || { map: this.p.map, lv: c.lv, how };
      const isNew = !c.egg ? this.registerCaught(c.sp) : false;
      const where = this.addCreature(c);
      if (!where) {
        await this.say("\xA1No queda espacio en el equipo ni en las cajas!");
        return null;
      }
      if (how === "capture") {
        this.state.stats.captures++;
        this.emit("capture", { sp: c.sp, lv: c.lv, creature: c, n: this.state.stats.captures });
      } else this.emit("receive", { sp: c.sp, how });
      if (!quiet) {
        if (where === "party") await this.say(`\xA1${displayName(c)} se ha unido a tu equipo!`);
        else await this.say(`${displayName(c)} ha sido enviado a la ${this.state.boxNames[where.box]}.`);
      }
      return { where, isNew };
    }
    healAll() {
      healParty(this.party);
      this.audio.sfx("heal");
      this.emit("heal");
    }
    firstFighter() {
      return this.party.find((c) => !c.egg && c.hp > 0) || null;
    }
    get levelCap() {
      const n = this.badges.length;
      return this.flag("league_done") ? 100 : [18, 24, 30, 36, 44, 52, 60, 70, 100][n];
    }
    // ---------- diálogos ----------
    say(text, opts) {
      return this.ui.say(this.t(text), opts);
    }
    async sayAll(lines, opts) {
      for (const l of lines) await this.say(l, opts);
    }
    ask(text, options, opts) {
      return this.ui.ask(this.t(text), options, opts);
    }
    yesNo(text, opts) {
      return this.ui.yesNo(this.t(text), opts);
    }
    wait(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }
    // ---------- partidas ----------
    newGame(opts) {
      this.state = newState(opts);
      this.emit("newgame");
      return this.state;
    }
    save(slot = this.slot, { quiet = false } = {}) {
      if (!this.state) return false;
      const r = Save.write(slot, this.state);
      this.settings.lastSlot = slot;
      this.slot = slot;
      Save.saveSettings(this.settings);
      if (!quiet) {
        if (r.ok) {
          this.audio.sfx("save");
          this.ui.toast("\u{1F4BE} Partida guardada (ranura " + slot + ")");
        } else {
          this.audio.sfx("error");
          this.ui.toast("\u26A0 No se pudo guardar: " + r.error);
        }
      }
      return r.ok;
    }
    loadSlot(slot) {
      const r = Save.read(slot);
      if (!r.ok) return r;
      this.state = r.state;
      this.slot = slot;
      this.settings.lastSlot = slot;
      Save.saveSettings(this.settings);
      return r;
    }
    saveSettings() {
      Save.saveSettings(this.settings);
      this.audio.applyVolumes();
    }
  };

  // src/overworld.js
  init_config();
  init_world();
  init_maprender();
  init_tiles();
  init_rng();

  // src/encounters.js
  function minWildLevel(sp) {
    const s = typeof sp === "number" ? getSpecies(sp) : sp;
    if (!s.prev) return 1;
    const prev = SPECIES[s.prev];
    const rule = prev.evo.find((e) => e.to === s.id);
    const lv = rule && rule.lv ? rule.lv : s.stage === 2 ? 20 : 30;
    return Math.max(2, lv);
  }
  var isNight = (hour) => hour >= 20 || hour < 6;
  function buildEncounterList(spec) {
    if (spec.list) return spec.list.map((e) => ({ lv: spec.lv, w: 10, ...e }));
    const [lo, hi] = spec.lv;
    const maxR = spec.maxRarity ? "CURVELM".indexOf(spec.maxRarity) : 4;
    const out = [];
    for (const s of SPECIES_LIST) {
      if (s.legendary) continue;
      if (spec.exclude && spec.exclude.includes(s.id)) continue;
      const inc = spec.include && spec.include.includes(s.id);
      if (!inc && !(spec.zone && s.habitats.includes(spec.zone))) continue;
      if (!inc && "CURVELM".indexOf(s.rarity) > maxR) continue;
      if (!inc && minWildLevel(s) > hi + 1) continue;
      const w = (RARITY[s.rarity].w || 5) * (spec.boost?.[s.id] || 1) * (inc && !spec.zone ? 1 : 1);
      out.push({ sp: s.id, w, lv: [Math.max(lo, minWildLevel(s) > lo ? minWildLevel(s) : lo), hi], time: s.timeOnly, wx: s.weather });
    }
    return out;
  }
  var cacheKey = (spec) => JSON.stringify(spec);
  var LISTS = /* @__PURE__ */ new Map();
  function encounterList(spec) {
    const k = cacheKey(spec);
    if (!LISTS.has(k)) LISTS.set(k, buildEncounterList(spec));
    return LISTS.get(k);
  }
  function rollEncounter(rng, spec, ctx = {}) {
    if (!spec) return null;
    const night = ctx.hour != null ? isNight(ctx.hour) : false;
    let list = encounterList(spec).filter((e) => {
      if (e.time === "n" && !night) return false;
      if (e.time === "d" && night) return false;
      if (e.wx && ctx.weather !== e.wx) return false;
      return true;
    });
    if (!list.length) list = encounterList(spec).filter((e) => !e.time && !e.wx);
    if (!list.length) return null;
    const weighted = list.map((e) => {
      const s = SPECIES[e.sp];
      let w = e.w;
      if (ctx.weather === "lluvia" || ctx.weather === "tormenta") {
        if (s.types.includes("agua") || s.types.includes("electrico")) w *= 2;
      }
      if (ctx.weather === "nieve" && s.types.includes("hielo")) w *= 2.5;
      if (ctx.weather === "calor" && (s.types.includes("fuego") || s.types.includes("tierra"))) w *= 2;
      if (ctx.weather === "niebla" && (s.types.includes("espiritu") || s.types.includes("sombra"))) w *= 2.5;
      if (night && (s.types.includes("sombra") || s.types.includes("espiritu") || s.timeOnly === "n")) w *= 1.8;
      if (!night && s.types.includes("luz")) w *= 1.5;
      return { e, w };
    });
    const pick = rng.weighted(weighted, (x) => x.w).e;
    const lv = rng.int(pick.lv[0], Math.max(pick.lv[0], pick.lv[1]));
    return { sp: pick.sp, lv };
  }
  function makeWild(rng, enc, opts = {}) {
    return createCreature(enc.sp, enc.lv, { rng, ...opts });
  }
  var ENCOUNTER_RATE = { hierba: 0.1, agua: 0.07, cueva: 0.075, pantano: 0.1, arena: 0.06, nieve: 0.08, desierto: 0.09, ruinas: 0.07, volcan: 0.08 };

  // src/weather.js
  init_rng();
  var WEATHER_INFO = {
    soleado: { name: "Soleado", icon: "\u2600", battle: null },
    lluvia: { name: "Lluvia", icon: "\u{1F327}", battle: "lluvia" },
    tormenta: { name: "Tormenta", icon: "\u26C8", battle: "tormenta" },
    niebla: { name: "Niebla", icon: "\u{1F32B}", battle: "niebla" },
    nieve: { name: "Nieve", icon: "\u2744", battle: "granizo" },
    calor: { name: "Calor intenso", icon: "\u{1F525}", battle: "calor" }
  };
  var TABLES = {
    templado: { soleado: 52, lluvia: 22, niebla: 12, tormenta: 9, calor: 5 },
    costero: { soleado: 46, lluvia: 26, niebla: 14, tormenta: 14 },
    desierto: { soleado: 55, calor: 38, niebla: 3, tormenta: 4 },
    nieve: { soleado: 22, nieve: 50, niebla: 20, tormenta: 8 },
    volcan: { soleado: 40, calor: 45, niebla: 10, tormenta: 5 },
    pantano: { niebla: 42, lluvia: 30, soleado: 18, tormenta: 10 },
    montana: { soleado: 38, niebla: 28, lluvia: 18, tormenta: 10, nieve: 6 }
  };
  var BLOCK_MIN = 240;
  var rnd = (seed, key) => hashStr(seed + "|" + key) % 1e5 / 1e5;
  function pickFrom(table, r) {
    const total = Object.values(table).reduce((a, b) => a + b, 0);
    let x = r * total;
    for (const [k, w] of Object.entries(table)) {
      x -= w;
      if (x < 0) return k;
    }
    return Object.keys(table)[0];
  }
  function weatherAt(seed, climate, minutes, depth = 0) {
    const table = TABLES[climate] || TABLES.templado;
    const block = Math.floor(minutes / BLOCK_MIN);
    if (block <= 0) return "soleado";
    if (depth < 4 && rnd(seed + climate, "keep" + block) < 0.5) return weatherAt(seed, climate, (block - 1) * BLOCK_MIN, depth + 1);
    return pickFrom(table, rnd(seed + climate, "w" + block));
  }
  var battleWeather = (id) => id && WEATHER_INFO[id]?.battle || null;

  // src/fx.js
  init_config();
  init_rng();
  function ambientFor(hourF) {
    const stops = [[0, [20, 28, 90, 0.52]], [5, [30, 36, 110, 0.46]], [6.5, [255, 150, 90, 0.2]], [8, [255, 220, 170, 0.04]], [12, [255, 255, 255, 0]], [17, [255, 230, 180, 0.04]], [18.5, [255, 140, 80, 0.22]], [20, [60, 50, 120, 0.4]], [22, [20, 28, 90, 0.5]], [24, [20, 28, 90, 0.52]]];
    for (let i = 0; i < stops.length - 1; i++) {
      const [h0, c0] = stops[i], [h1, c1] = stops[i + 1];
      if (hourF >= h0 && hourF <= h1) {
        const t = (hourF - h0) / (h1 - h0);
        return c0.map((v, k) => v + (c1[k] - v) * t);
      }
    }
    return [255, 255, 255, 0];
  }
  function drawAmbient(ctx, hourF) {
    const [r, g, b, a] = ambientFor(hourF);
    if (a < 0.01) return;
    ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  function drawDarkness(ctx, cx, cy, radius) {
    const g = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
    g.addColorStop(0, "rgba(0,0,10,0)");
    g.addColorStop(0.7, "rgba(0,0,10,.82)");
    g.addColorStop(1, "rgba(0,0,10,.96)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  var WeatherFX = class {
    constructor() {
      this.kind = null;
      this.parts = [];
      this.flash = 0;
      this.t = 0;
      this.rng = new RNG(5);
      this.nextBolt = 4;
      this.fog = [];
    }
    set(kind) {
      if (kind === this.kind) return;
      this.kind = kind;
      this.parts = [];
      this.fog = [];
      const n = kind === "lluvia" ? 140 : kind === "tormenta" ? 260 : kind === "nieve" ? 110 : 0;
      for (let i = 0; i < n; i++) this.parts.push(this._mk(true));
      if (kind === "niebla") for (let i = 0; i < 7; i++) this.fog.push({ x: this.rng.float(-200, VIEW_W), y: this.rng.float(0, VIEW_H - 120), w: this.rng.float(300, 560), h: this.rng.float(90, 170), v: this.rng.float(6, 18) });
    }
    _mk(init) {
      const r = this.rng;
      if (this.kind === "nieve") return { x: r.float(0, VIEW_W), y: init ? r.float(0, VIEW_H) : -6, vx: r.float(-14, 14), vy: r.float(30, 70), s: r.chance(0.3) ? 3 : 2 };
      const storm = this.kind === "tormenta";
      return { x: r.float(-60, VIEW_W), y: init ? r.float(0, VIEW_H) : -20, vx: storm ? -220 : -90, vy: storm ? 880 : 640, s: r.float(8, 16) };
    }
    update(dt, audio) {
      this.t += dt;
      for (const p of this.parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > VIEW_H + 10 || p.x < -80 || p.x > VIEW_W + 40) Object.assign(p, this._mk(false), { x: this.rng.float(-40, VIEW_W + 60) });
      }
      for (const f of this.fog) {
        f.x += f.v * dt;
        if (f.x > VIEW_W + 40) f.x = -f.w;
      }
      if (this.kind === "tormenta") {
        this.nextBolt -= dt;
        if (this.nextBolt <= 0) {
          this.flash = 1;
          this.nextBolt = this.rng.float(5, 14);
          audio && setTimeout(() => audio.sfx("thunder"), 250);
        }
      }
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);
    }
    draw(ctx) {
      if (!this.kind) return;
      if (this.kind === "lluvia" || this.kind === "tormenta") {
        ctx.strokeStyle = "rgba(190,215,255,.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const p of this.parts) {
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.02, p.y + p.s * 1.1);
        }
        ctx.stroke();
        ctx.fillStyle = this.kind === "tormenta" ? "rgba(20,28,60,.32)" : "rgba(30,50,90,.16)";
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      } else if (this.kind === "nieve") {
        ctx.fillStyle = "rgba(255,255,255,.9)";
        for (const p of this.parts) ctx.fillRect(p.x, p.y, p.s, p.s);
        ctx.fillStyle = "rgba(220,235,255,.10)";
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      } else if (this.kind === "niebla") {
        for (const f of this.fog) {
          const g = ctx.createRadialGradient(f.x + f.w / 2, f.y + f.h / 2, 10, f.x + f.w / 2, f.y + f.h / 2, f.w / 2);
          g.addColorStop(0, "rgba(235,240,250,.42)");
          g.addColorStop(1, "rgba(235,240,250,0)");
          ctx.fillStyle = g;
          ctx.fillRect(f.x, f.y - f.h / 2, f.w, f.h * 2);
        }
        ctx.fillStyle = "rgba(225,232,245,.2)";
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      } else if (this.kind === "calor") {
        ctx.fillStyle = "rgba(255,170,60,.10)";
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.strokeStyle = "rgba(255,230,160,.10)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let y = 20; y < VIEW_H; y += 36) {
          ctx.moveTo(0, y);
          for (let x = 0; x <= VIEW_W; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.05 + this.t * 3 + y) * 4);
        }
        ctx.stroke();
      }
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.7})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
    }
  };

  // src/overworld.js
  var TS = TILE * SCALE;
  var SIDE = { up: "n", down: "s", right: "e", left: "w" };
  var WALK = 4.6;
  var RUN = 7.2;
  var BIKE = 10;
  var SURF = 6;
  var Overworld = class {
    constructor(game) {
      this.g = game;
      this.map = null;
      this.mr = null;
      this.ents = [];
      this.time = 0;
      this.busy = true;
      this.cam = { x: 0, y: 0 };
      this.player = null;
      this.fx = new WeatherFX();
      this.weatherId = null;
      this.rng = new RNG(1);
      this.graceSteps = 0;
      this.clockAcc = 0;
      this.playAcc = 0;
      this.lastWeatherCheck = -1;
      this.exclaims = [];
      this.running = false;
      this.lastMenuT = 0;
      this._unsub = null;
    }
    // ---------- ciclo de vida ----------
    enter() {
      this._unsub = this.g.input.push((a, rep) => this.onAction(a, rep));
    }
    exit() {
      if (this._unsub) {
        this._unsub();
        this._unsub = null;
      }
    }
    get state() {
      return this.g.state;
    }
    /** Carga un mapa y coloca al jugador. */
    async loadMap(id, x, y, dir = "down", { announce = true } = {}) {
      const map = getMap(id);
      const g = this.g;
      this.map = map;
      this.mr = getMapRender(map);
      const p = g.p;
      p.map = id;
      p.x = x;
      p.y = y;
      p.dir = dir;
      for (const k of Object.keys(this.state.picked)) {
        const m = /^cut:([^:]+):(\d+),(\d+)$/.exec(k);
        if (m && m[1] === id) {
          const px2 = +m[2], py = +m[3];
          map.obj[py * map.w + px2] = 0;
          this.mr = null;
        }
      }
      if (!this.mr) {
        const { invalidateMapRender: invalidateMapRender2 } = await Promise.resolve().then(() => (init_maprender(), maprender_exports));
        invalidateMapRender2(id);
        this.mr = getMapRender(map);
      }
      this.player = this._makeEntity({ kind: "player", x, y, dir, solid: true, look: p.look, id: "player" });
      this.player.speed = WALK;
      this.refreshEntities();
      this.exclaims = [];
      this.updateWeather(true);
      this.updateCamera(true);
      if (this.state.fastTravel && map.fly && !this.state.fastTravel.includes(id)) {
        this.state.fastTravel.push(id);
        g.emit("fly_unlocked", { map: id });
      }
      this.state.flags["v_" + id] = 1;
      g.emit("visit", { map: id, zone: map.zone, tags: map.tags });
      const music = this._musicFor(map);
      g.audio.playMusic(music);
      if (announce && !map.indoor || announce && map.title) g.ui.showLocation(map.title);
      this.busy = false;
      if (map.onEnter) {
        this.busy = true;
        try {
          await map.onEnter(g, this);
        } finally {
          this.busy = false;
        }
      }
    }
    _musicFor(map) {
      return map.music || "route";
    }
    _makeEntity(def) {
      const e = { def, id: def.id, kind: def.kind, x: def.x, y: def.y, dir: def.dir || "down", look: def.look, solid: def.solid !== false, free: !!def.free, px: def.x * TILE, py: def.y * TILE, move: null, frame: 0, step: 0, name: def.name, creature: def.creature, visible: true, home: { x: def.x, y: def.y }, wanderT: 1 + Math.random() * 2, hidden: !!def.hidden, speed: def.speed || 3 };
      return e;
    }
    /** Reconstruye las entidades visibles según banderas (llamar tras cambios de historia). */
    refreshEntities() {
      const g = this.g, map = this.map;
      const old = new Map(this.ents.map((e) => [e.id, e]));
      this.ents = [];
      map.entities.forEach((def, i) => {
        const id = def.id || `${def.kind}${i}`;
        if (def.show && !def.show(g)) return;
        if (def.kind === "item" && this.state.picked[def.key]) return;
        if (def.hide && def.hide(g)) return;
        const prev = old.get(id);
        if (prev) {
          this.ents.push(prev);
          return;
        }
        const e = this._makeEntity({ ...def, id });
        this.ents.push(e);
      });
    }
    entity(id) {
      return this.ents.find((e) => e.id === id) || (id === "player" ? this.player : null);
    }
    // ---------- consultas ----------
    entityAt(x, y, { ignoreFree = false } = {}) {
      for (const e of this.ents) {
        if (e.x === x && e.y === y) return e;
        if (e.move && e.move.tx === x && e.move.ty === y) return e;
      }
      return null;
    }
    solidEntityAt(x, y) {
      return this.ents.find((e) => e.solid && !e.free && e.kind !== "item" && (e.x === x && e.y === y || e.move && e.move.tx === x && e.move.ty === y));
    }
    waterAt(x, y) {
      return !!groundProps(this.map, x, y).water && !this.map.obj[y * this.map.w + x];
    }
    canEnter(e, x, y, dir) {
      const m = this.map, g = this.g;
      if (!inBounds(m, x, y)) return !!m.connections[SIDE[dir]] && e === this.player;
      if (this.solidEntityAt(x, y)) return false;
      if (e === this.player && this.player.x === x && this.player.y === y) return false;
      const gp = groundProps(m, x, y), op = objProps(m, x, y);
      const water = this.waterAt(x, y);
      if (e === this.player) {
        const surfing = this.state.player.surfing;
        if (water && !surfing) return false;
        if (!water && surfing && (gp.solid || op.solid)) return false;
      } else if (water) return false;
      if (op.climb || gp.climb) return e === this.player && g.hasKey("piolet");
      if (op.cut) return false;
      if (gp.solid || op.solid) return false;
      return true;
    }
    /** Inicia un movimiento de una casilla. Devuelve promesa (resuelta al terminar) o null si está bloqueado. */
    startMove(e, dir, speed = null, force = false) {
      const [dx, dy] = dirVec[dir];
      const nx = e.x + dx, ny = e.y + dy;
      e.dir = dir;
      if (!force && !this.canEnter(e, nx, ny, dir)) return null;
      return new Promise((resolve2) => {
        e.move = { fx: e.x, fy: e.y, tx: nx, ty: ny, t: 0, speed: speed || e.speed, resolve: resolve2 };
      });
    }
    async walk(e, dir, n = 1, speed = null) {
      if (typeof e === "string") e = this.entity(e);
      for (let i = 0; i < n; i++) {
        const p = this.startMove(e, dir, speed, false);
        if (!p) break;
        await p;
      }
    }
    /** Camina por una ruta de direcciones: 'down,down,left' o array */
    async walkPath(e, path, speed = null) {
      if (typeof e === "string") e = this.entity(e);
      for (const d of Array.isArray(path) ? path : path.split(",")) {
        const p = this.startMove(e, d.trim(), speed, false);
        if (p) await p;
      }
    }
    face(e, dir) {
      if (typeof e === "string") e = this.entity(e);
      if (e) e.dir = dir;
    }
    faceToward(e, tx, ty) {
      const dx = tx - e.x, dy = ty - e.y;
      e.dir = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up";
    }
    async exclaim(e, ms = 700) {
      if (typeof e === "string") e = this.entity(e);
      this.exclaims.push({ e, t: ms / 1e3 });
      this.g.audio.sfx("encounter");
      await this.g.wait(ms);
    }
    /** Camina hasta quedar adyacente a (tx,ty) en línea recta */
    async approach(e, tx, ty, speed = 5) {
      for (let guard = 0; guard < 30; guard++) {
        const dx = tx - e.x, dy = ty - e.y;
        if (Math.abs(dx) + Math.abs(dy) <= 1) break;
        const d = Math.abs(dx) >= Math.abs(dy) && dx !== 0 ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up";
        const p = this.startMove(e, d, speed, false);
        if (!p) {
          const alt = d === "left" || d === "right" ? dy > 0 ? "down" : "up" : dx > 0 ? "right" : "left";
          const p2 = dy === 0 && dx === 0 ? null : this.startMove(e, alt, speed, false);
          if (!p2) break;
          await p2;
        } else await p;
      }
      this.faceToward(e, tx, ty);
    }
    // ---------- entrada ----------
    onAction(a) {
      if (this.busy || this.player?.move) return;
      if (a === "confirm") this.interact();
      else if (a === "menu" || a === "cancel") {
        if (performance.now() - this.lastMenuT > 250) this.openMenu();
      }
    }
    async openMenu() {
      if (this.busy) return;
      this.busy = true;
      this.lastMenuT = performance.now();
      try {
        this.g.audio.sfx("menu");
        if (this.g.menu) await this.g.menu.open();
      } finally {
        this.busy = false;
        this.lastMenuT = performance.now();
        this.refreshEntities();
      }
    }
    /** Ejecuta una secuencia asíncrona bloqueando al jugador. */
    async run(fn) {
      const was = this.busy;
      this.busy = true;
      try {
        return await fn();
      } catch (e) {
        console.error(e);
        this.g.reportError(e);
      } finally {
        this.busy = was;
        this.refreshEntities();
      }
    }
    async interact() {
      const p = this.player, [dx, dy] = dirVec[p.dir];
      const tx = p.x + dx, ty = p.y + dy;
      const g = this.g;
      const e = this.ents.find((q2) => q2.x === tx && q2.y === ty && q2.kind !== "item" && q2 !== p) || this.ents.find((q2) => q2.kind === "item" && q2.hidden && q2.x === tx && q2.y === ty);
      if (e) {
        await this.run(async () => {
          if (e.kind === "item") {
            await this.pickItem(e);
            return;
          }
          if (e.kind !== "sign") {
            const was = e.dir;
            this.faceToward(e, p.x, p.y);
            e._was = was;
          }
          g.audio.sfx("select");
          if (e.def.talk) await e.def.talk(g, e, this);
          else if (e.def.text) await g.say(e.def.text, { speaker: e.kind === "sign" ? null : e.def.name });
          if (e.kind === "npc" && e.def.move === "static" && e._was) {
          }
          g.emit("talk", { id: e.id, map: this.map.id });
        });
        return;
      }
      const op = objProps(this.map, tx, ty);
      if (op.cut) {
        await this.run(async () => this.cutBush(tx, ty));
        return;
      }
      if (this.waterAt(tx, ty) && !this.state.player.surfing && g.hasKey("barca")) {
        await this.run(async () => {
          if (await g.yesNo("El agua parece profunda. \xBFQuieres navegar con la barca?")) {
            this.state.player.surfing = true;
            this.g.audio.sfx("warp");
            await this.walk(this.player, p.dir, 1, SURF);
          }
        });
        return;
      }
      if ((op.climb || groundProps(this.map, tx, ty).climb) && !g.hasKey("piolet")) {
        await this.run(async () => g.say("La pared de roca est\xE1 agrietada. Con un piolet podr\xEDas escalarla."));
        return;
      }
      if (op.cut && !g.hasKey("machete")) {
        await this.run(async () => g.say("Hay maleza muy espesa. Necesitar\xEDas algo para cortarla."));
        return;
      }
      const ent = this.ents.find((q2) => q2.kind === "item" && q2.hidden && q2.x === p.x && q2.y === p.y);
      if (ent) await this.run(async () => this.pickItem(ent));
    }
    async cutBush(x, y) {
      const g = this.g;
      if (!g.hasKey("machete")) {
        await g.say("Hay maleza muy espesa. Necesitar\xEDas algo para cortarla.");
        return;
      }
      if (!await g.yesNo("La maleza bloquea el paso. \xBFCortarla con el machete?")) return;
      g.audio.sfx("hit");
      this.map.obj[y * this.map.w + x] = 0;
      this.state.picked[`cut:${this.map.id}:${x},${y}`] = 1;
      const { invalidateMapRender: invalidateMapRender2 } = await Promise.resolve().then(() => (init_maprender(), maprender_exports));
      invalidateMapRender2(this.map.id);
      this.mr = getMapRender(this.map);
      await g.say("\xA1La maleza ha sido cortada!");
    }
    async pickItem(e) {
      const g = this.g, d = e.def;
      this.state.picked[d.key] = 1;
      this.ents = this.ents.filter((q2) => q2 !== e);
      await g.giveItem(d.item, d.n || 1);
      g.emit("pickup", { item: d.item, key: d.key, map: this.map.id });
    }
    // ---------- actualización ----------
    update(dt) {
      this.time += dt;
      const g = this.g;
      if (this.map && !this.map.__noclock) {
        this.playAcc += dt;
        if (this.playAcc >= 1) {
          this.state.player.playtime += Math.floor(this.playAcc);
          this.playAcc %= 1;
        }
        this.clockAcc += dt;
        const secPerMin = g.settings.clockMode === "real" ? 60 : 1;
        if (!this.busy || this.allowClock) {
          while (this.clockAcc >= secPerMin) {
            this.clockAcc -= secPerMin;
            this.state.clock.minutes++;
          }
        }
        if (Math.floor(this.state.clock.minutes / 30) !== this.lastWeatherCheck) {
          this.lastWeatherCheck = Math.floor(this.state.clock.minutes / 30);
          this.updateWeather();
        }
      }
      this.fx.update(dt, g.audio);
      for (const x of this.exclaims) x.t -= dt;
      this.exclaims = this.exclaims.filter((x) => x.t > 0);
      for (const e of [...this.ents, this.player]) if (e && e.move) this.advance(e, dt);
      if (!this.busy && !this.player.move) this.updatePlayerInput(dt);
      this.updateWander(dt);
      this.updateCamera();
    }
    advance(e, dt) {
      const m = e.move;
      m.t += dt * m.speed;
      const t = Math.min(1, m.t);
      e.px = (m.fx + (m.tx - m.fx) * t) * TILE;
      e.py = (m.fy + (m.ty - m.fy) * t) * TILE;
      e.step = (e.step + dt * m.speed * 2) % 2;
      e.frame = t < 1 ? e.step < 1 ? 1 : 2 : 0;
      if (m.t >= 1) {
        e.x = m.tx;
        e.y = m.ty;
        e.px = e.x * TILE;
        e.py = e.y * TILE;
        e.frame = 0;
        const r = m.resolve;
        e.move = null;
        if (e === this.player) {
          const rest = r;
          this.onPlayerStep().then(() => rest());
        } else r();
      }
    }
    updatePlayerInput(dt) {
      const g = this.g, p = this.player, inp = g.input;
      const d = inp.dir();
      if (!d) {
        p.frame = 0;
        this.turnT = 0;
        return;
      }
      if (p.dir !== d) {
        p.dir = d;
        this.turnT = 0.07;
        return;
      }
      if (this.turnT > 0) {
        this.turnT -= dt;
        return;
      }
      const st = this.state.player;
      const run = inp.isHeld("run") !== g.settings.runToggle;
      const speed = st.surfing ? SURF : st.biking ? BIKE : run ? RUN : WALK;
      const [dx, dy] = dirVec[d], nx = p.x + dx, ny = p.y + dy;
      if (!inBounds(this.map, nx, ny)) {
        const c = this.map.connections[SIDE[d]];
        if (c && mapExists(c.map)) this.edgeTransition(SIDE[d]);
        else {
          this.bump();
          if (c && !this._nm) {
            this._nm = 1;
            setTimeout(() => this._nm = 0, 3e3);
            this.g.ui.toast("Esta zona todav\xEDa no est\xE1 abierta.");
          }
        }
        return;
      }
      const promise = this.startMove(p, d, speed);
      if (!promise) {
        this.bump();
        return;
      }
      if (st.surfing && !this.waterAt(nx, ny)) {
        st.surfing = false;
      }
      promise.then(() => {
      });
    }
    bump() {
      if (!this._bumpT || performance.now() - this._bumpT > 350) {
        this._bumpT = performance.now();
        this.g.audio.sfx("bump");
      }
      this.player.frame = 0;
    }
    updateWander(dt) {
      if (this.busy) return;
      for (const e of this.ents) {
        if (e.kind !== "npc" || e.def.move !== "wander" || e.move) continue;
        e.wanderT -= dt;
        if (e.wanderT > 0) continue;
        e.wanderT = 1.2 + Math.random() * 2.5;
        const d = ["up", "down", "left", "right"][Math.floor(Math.random() * 4)];
        const [dx, dy] = dirVec[d];
        const nx = e.x + dx, ny = e.y + dy;
        const r = e.def.range ?? 2;
        e.dir = d;
        if (Math.abs(nx - e.home.x) > r || Math.abs(ny - e.home.y) > r) continue;
        if (this.player.x === nx && this.player.y === ny) continue;
        this.startMove(e, d, 2.2);
      }
    }
    updateCamera(snap = false) {
      const p = this.player;
      if (!p) return;
      const vwArt = VIEW_W / SCALE, vhArt = VIEW_H / SCALE;
      const mw = this.map.w * TILE, mh = this.map.h * TILE;
      let cx = p.px + TILE / 2 - vwArt / 2, cy = p.py + TILE / 2 - vhArt / 2;
      cx = mw <= vwArt ? -(vwArt - mw) / 2 : Math.max(0, Math.min(mw - vwArt, cx));
      cy = mh <= vhArt ? -(vhArt - mh) / 2 : Math.max(0, Math.min(mh - vhArt, cy));
      this.cam.x = Math.round(cx);
      this.cam.y = Math.round(cy);
    }
    updateWeather(force = false) {
      const g = this.g, map = this.map;
      if (!map) return;
      let w = null;
      if (map.weather && !map.indoor) w = weatherAt(this.state.seed, map.climate, this.state.clock.minutes);
      this.weatherId = w;
      this.fx.set(w === "soleado" ? null : w);
      if (force) this.lastWeatherCheck = Math.floor(this.state.clock.minutes / 30);
    }
    get weather() {
      return this.weatherId || "soleado";
    }
    // ---------- eventos de paso ----------
    async onPlayerStep() {
      const g = this.g, p = this.player, st = this.state, m = this.map;
      st.player.x = p.x;
      st.player.y = p.y;
      st.player.steps++;
      st.stats.steps++;
      g.audio.sfx("step");
      this.busy = true;
      try {
        if (st.repel > 0) {
          st.repel--;
          if (st.repel === 0) await g.say("El efecto del repelente se ha agotado.");
        }
        if (st.stats.steps % 128 === 0) {
          for (const c of g.party) if (!c.egg && c.friendship < 255 && c.hp > 0) c.friendship++;
        }
        g.emit("step", { map: m.id });
        if (g.stepHooks) {
          const stop = await g.stepHooks(this);
          if (stop) return;
        }
        if (st.stats.steps % 4 === 0) {
          for (const c of g.party) if (!c.egg && c.status === "envenenado" && c.hp > 1) {
            c.hp--;
          }
        }
        const it = this.ents.find((e) => e.kind === "item" && !e.hidden && e.x === p.x && e.y === p.y);
        if (it) {
          await this.pickItem(it);
        }
        const w = m.warps.get(p.x + "," + p.y);
        if (w && (!w.cond || w.cond(g))) {
          await this.useWarp(w);
          return;
        }
        for (const t of m.triggers) {
          if (p.x >= t.x && p.x < t.x + t.w && p.y >= t.y && p.y < t.y + t.h && (!t.show || t.show(g)) && !(t.once && st.picked[t.key])) {
            if (t.once) st.picked[t.key] = 1;
            await t.fn(g, this);
            this.refreshEntities();
            if (this.map !== m) return;
          }
        }
        if (await this.checkTrainers()) return;
        await this.checkEncounter();
        if (!st.player.surfing && tkey(m.ground[p.y * m.w + p.x]) === "ice" && this.map === m) {
          const pr = this.startMove(p, p.dir, 9.5);
          if (pr) pr.then(() => {
          });
        }
      } catch (e) {
        console.error(e);
        g.reportError(e);
      } finally {
        this.busy = false;
      }
    }
    async checkTrainers() {
      const g = this.g, p = this.player;
      for (const e of this.ents) {
        if (e.kind !== "trainer" || !e.def.trainer) continue;
        if (this.state.trainers[e.def.trainer]?.beaten) continue;
        if (e.def.show && !e.def.show(g)) continue;
        const sight = e.def.sight ?? 4;
        const [dx, dy] = dirVec[e.dir];
        let seen = false;
        for (let i = 1; i <= sight; i++) {
          const x = e.x + dx * i, y = e.y + dy * i;
          if (!inBounds(this.map, x, y) || terrainSolid(this.map, x, y) || this.solidEntityAt(x, y) && !(x === p.x && y === p.y)) break;
          if (x === p.x && y === p.y) {
            seen = true;
            break;
          }
        }
        if (!seen) continue;
        await this.exclaim(e, 650);
        await this.approach(e, p.x, p.y, 5.5);
        this.faceToward(p, e.x, e.y);
        await this.talkTrainer(e);
        return true;
      }
      return false;
    }
    async talkTrainer(e) {
      const g = this.g;
      const d = e.def;
      if (d.talk) {
        await d.talk(g, e, this);
        return;
      }
      await g.battleTrainer(d.trainer, { entity: e });
    }
    async checkEncounter() {
      const g = this.g, p = this.player, m = this.map, st = this.state;
      if (st.repel > 0 && false) return;
      const gp = groundProps(m, p.x, p.y);
      let type = this.waterAt(p.x, p.y) ? "agua" : gp.enc;
      if (!type || !m.enc) return;
      if (m.enc.__off) return;
      let spec = m.enc[type];
      if (!spec && type === "arena") spec = m.enc.hierba;
      if (!spec) return;
      if (this.graceSteps > 0) {
        this.graceSteps--;
        return;
      }
      const rate = (ENCOUNTER_RATE[type] ?? 0.08) * (spec.rate || 1);
      const rng = new RNG(st.rng);
      const roll = rng.next();
      st.rng = rng.state;
      if (roll > rate) return;
      const now = g.now;
      const enc = rollEncounter(rng, spec, { hour: now.hour, weather: this.weatherId });
      st.rng = rng.state;
      if (!enc) return;
      const lead = g.firstFighter();
      if (st.repel > 0 && lead && enc.lv < lead.lv) return;
      const mon = makeWild(rng, enc, { map: m.id });
      st.rng = rng.state;
      this.graceSteps = 3;
      await g.battleWild(mon, { terrain: type, map: m });
    }
    // ---------- warps y transiciones ----------
    async useWarp(w) {
      const g = this.g;
      if (w.sfx) g.audio.sfx(w.sfx);
      else g.audio.sfx("warp");
      if (!mapExists(w.to)) {
        await g.say("(Este lugar a\xFAn no est\xE1 disponible.)");
        return;
      }
      const was = this.busy;
      this.busy = true;
      await g.ui.fade(true, 250);
      this.state.player.surfing = !!w.surf && this.state.player.surfing;
      const dest = typeof w.tx === "string" ? getMap(w.to).spawns[w.tx] : { x: w.tx, y: w.ty, dir: w.dir };
      await this.loadMap(w.to, dest.x, dest.y, dest.dir || w.dir || "down");
      await g.ui.fade(false, 250);
      this.busy = false;
    }
    async edgeTransition(d) {
      const g = this.g, c = this.map.connections[d], p = this.player;
      this.busy = true;
      const dest = getMap(c.map);
      let nx = p.x, ny = p.y;
      if (d === "n") {
        ny = dest.h - 1;
        nx = p.x + (c.offset || 0);
      } else if (d === "s") {
        ny = 0;
        nx = p.x + (c.offset || 0);
      } else if (d === "e") {
        nx = 0;
        ny = p.y + (c.offset || 0);
      } else {
        nx = dest.w - 1;
        ny = p.y + (c.offset || 0);
      }
      nx = Math.max(0, Math.min(dest.w - 1, nx));
      ny = Math.max(0, Math.min(dest.h - 1, ny));
      const free = (x, y) => !terrainSolid(dest, x, y) && !(groundProps(dest, x, y).water && !this.state.player.surfing);
      if (!free(nx, ny)) {
        for (let k = 1; k < 8; k++) {
          for (const s of [1, -1]) {
            const cx = d === "n" || d === "s" ? nx + s * k : nx, cy = d === "e" || d === "w" ? ny + s * k : ny;
            if (inBounds(dest, cx, cy) && free(cx, cy)) {
              nx = cx;
              ny = cy;
              k = 99;
              break;
            }
          }
        }
      }
      await g.ui.fade(true, 160);
      const dir = { n: "up", s: "down", e: "right", w: "left" }[d];
      await this.loadMap(c.map, nx, ny, dir, { announce: true });
      await g.ui.fade(false, 160);
      this.busy = false;
    }
    // ---------- dibujo ----------
    render(ctx) {
      if (!this.map) return;
      const map = this.map, mr = this.mr, cam = this.cam, t = this.time;
      ctx.fillStyle = map.indoor ? "#0a0818" : "#0b1020";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawGroundLayers(ctx, mr, cam.x, cam.y, VIEW_W, VIEW_H, t);
      drawObjectLayers(ctx, mr, cam.x, cam.y, VIEW_W, VIEW_H, t);
      this.drawEntities(ctx);
      drawTopLayer(ctx, mr, cam.x, cam.y, VIEW_W, VIEW_H);
      const hourF = this.state.clock.minutes / 60 % 24;
      if (!map.indoor) drawAmbient(ctx, hourF);
      this.fx.draw(ctx);
      if (map.dark) {
        const p = this.player;
        const sx = (p.px + TILE / 2 - cam.x) * SCALE, sy = (p.py + TILE / 2 - cam.y) * SCALE;
        drawDarkness(ctx, sx, sy, this.g.hasKey("linterna") ? 330 : 190);
      }
      this.drawHud(ctx);
    }
    drawEntities(ctx) {
      const cam = this.cam, lens = this.g.hasKey("lupa");
      const list = [...this.ents.filter((e) => e.kind !== "sign"), this.player].sort((a, b) => a.py - b.py);
      ctx.imageSmoothingEnabled = false;
      for (const e of list) {
        const sx = (e.px - cam.x) * SCALE, sy = (e.py - cam.y) * SCALE;
        if (sx < -TS * 2 || sy < -TS * 2 || sx > VIEW_W + TS || sy > VIEW_H + TS * 2) continue;
        if (e.kind === "gate") {
          const fr = Math.floor(this.time * 2) % 2;
          ctx.drawImage(tileCanvas(e.def.tile, fr), sx, sy, TS, TS);
          continue;
        }
        if (e.kind === "item") {
          if (e.hidden) {
            if (lens && Math.hypot(e.x - this.player.x, e.y - this.player.y) < 4) this.drawSparkle(ctx, sx + TS / 2, sy + TS / 2);
            continue;
          }
          this.drawBall(ctx, sx + TS / 2, sy + TS * 0.7, e);
          continue;
        }
        if (e.def.sprite === "ball") {
          this.drawBall(ctx, sx + TS / 2, sy + TS * 0.62, e);
          continue;
        }
        const feetX = sx + TS / 2, feetY = sy + TS - 4;
        ctx.fillStyle = "rgba(0,0,0,.28)";
        ctx.beginPath();
        ctx.ellipse(feetX, feetY, 15, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        if (e.creature) {
          const c = creatureCanvas(e.creature, e.def.variant);
          const bob = Math.sin(this.time * 2 + e.x) * 2;
          ctx.drawImage(c, feetX - 48 * (e.def.scale || 1) / 2 * 1.2, feetY - 48 * (e.def.scale || 1) * 1.15 + bob, 48 * 1.2 * (e.def.scale || 1), 48 * 1.2 * (e.def.scale || 1));
          continue;
        }
        if (!e.look) continue;
        let oy = 0;
        if (e === this.player) {
          const st = this.state.player;
          if (st.surfing) {
            ctx.fillStyle = "#c8873f";
            ctx.beginPath();
            ctx.ellipse(feetX, feetY - 2, 22, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#e8b070";
            ctx.beginPath();
            ctx.ellipse(feetX, feetY - 5, 18, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            oy = -8;
          } else if (st.biking) {
            ctx.strokeStyle = "#2a2a3a";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(feetX - 12, feetY - 4, 8, 0, 7);
            ctx.arc(feetX + 12, feetY - 4, 8, 0, 7);
            ctx.stroke();
          }
        }
        const cv = trainerCanvas(e.look, e.dir, e.frame);
        ctx.drawImage(cv, Math.round(feetX - 24), Math.round(feetY - 69 + oy), 48, 72);
      }
      for (const x of this.exclaims) {
        const e = x.e;
        const sx = (e.px - cam.x) * SCALE + TS / 2, sy = (e.py - cam.y) * SCALE - 28;
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#d83a3a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(sx - 12, sy - 22, 24, 30, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#d83a3a";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", sx, sy + 2);
      }
    }
    drawBall(ctx, x, y, e) {
      const bob = Math.sin(this.time * 3 + e.x * 2) * 2;
      ctx.fillStyle = "rgba(0,0,0,.3)";
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 10, 4, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#d8453f";
      ctx.beginPath();
      ctx.arc(x, y - 6 + bob, 10, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#f4f0e8";
      ctx.beginPath();
      ctx.arc(x, y - 6 + bob, 10, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = "#2a2a3a";
      ctx.fillRect(x - 10, y - 7 + bob, 20, 3);
      ctx.beginPath();
      ctx.arc(x, y - 6 + bob, 4, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x, y - 6 + bob, 2, 0, 7);
      ctx.fill();
    }
    drawSparkle(ctx, x, y) {
      const a = 0.5 + 0.5 * Math.sin(this.time * 6 + x);
      ctx.fillStyle = `rgba(255,240,150,${a})`;
      ctx.fillRect(x - 2, y - 10, 4, 20);
      ctx.fillRect(x - 10, y - 2, 20, 4);
    }
    drawHud(ctx) {
      const g = this.g;
      if (g.settings.showClock) {
        const n = g.now;
        const w = this.weatherId;
        const info = w ? { soleado: "\u2600", lluvia: "\u{1F327}", tormenta: "\u26C8", niebla: "\u{1F32B}", nieve: "\u2744", calor: "\u{1F525}" }[w] : "";
        const txt = `${info} ${String(n.hour).padStart(2, "0")}:${String(n.min).padStart(2, "0")}`;
        ctx.font = 'bold 15px "Trebuchet MS",sans-serif';
        ctx.textAlign = "right";
        const wd = ctx.measureText(txt).width + 18;
        ctx.fillStyle = "rgba(10,8,24,.65)";
        ctx.beginPath();
        ctx.roundRect(VIEW_W - wd - 12, 10, wd, 26, 8);
        ctx.fill();
        ctx.strokeStyle = "#7a6a2a";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#f4f1ff";
        ctx.fillText(txt, VIEW_W - 21, 29);
      }
      if (this.state.repel > 0) {
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.textAlign = "right";
        ctx.fillText("Repelente: " + this.state.repel, VIEW_W - 14, 52);
      }
    }
  };

  // src/screens/title.js
  init_config();
  init_config();
  init_rng();
  var TITLE_CREATURES = [1, 4, 7, 117, 83, 62, 113, 24];
  var TitleScene = class {
    constructor(game) {
      this.g = game;
      this.t = 0;
      this.root = null;
    }
    enter() {
      this.root = el("div", { class: "layer", id: "titleui" });
      this.g.ui.root.append(this.root);
    }
    exit() {
      this.root?.remove();
    }
    update(dt) {
      this.t += dt;
    }
    render(ctx) {
      const t = this.t;
      let g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, "#1a1650");
      g.addColorStop(0.45, "#6a3a8a");
      g.addColorStop(0.75, "#f08a6a");
      g.addColorStop(1, "#f8d08a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "rgba(255,255,255,.8)";
      for (let i = 0; i < 70; i++) {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i));
        ctx.globalAlpha = tw;
        ctx.fillRect(i * 137 % VIEW_W, i * 59 % 250, 2, 2);
      }
      ctx.globalAlpha = 1;
      const sy = 330 + Math.sin(t * 0.3) * 6;
      ctx.fillStyle = "rgba(255,240,170,.25)";
      ctx.beginPath();
      ctx.arc(480, sy, 160, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#fff2b0";
      ctx.beginPath();
      ctx.arc(480, sy, 90, 0, 7);
      ctx.fill();
      for (const [col, base, amp, f, off] of [["#4a2e6a", 400, 80, 6e-3, 0], ["#3a2258", 440, 60, 9e-3, 2], ["#2a1a44", 480, 40, 0.012, 5]]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, VIEW_H);
        for (let x = 0; x <= VIEW_W; x += 12) ctx.lineTo(x, base - Math.abs(Math.sin(x * f + off)) * amp - Math.sin(x * f * 3 + off) * 10);
        ctx.lineTo(VIEW_W, VIEW_H);
        ctx.fill();
      }
      ctx.fillStyle = "#150e28";
      for (let i = 0; i < 22; i++) {
        const x = i * 46 + 10, h = 50 + i * 37 % 40;
        ctx.beginPath();
        ctx.moveTo(x, VIEW_H);
        ctx.lineTo(x + 18, VIEW_H - h);
        ctx.lineTo(x + 36, VIEW_H);
        ctx.fill();
      }
      TITLE_CREATURES.forEach((sp, i) => {
        const x = 60 + i * 118, y = 330 + Math.sin(t * 1.4 + i * 1.3) * 12 + i % 2 * 22;
        ctx.globalAlpha = 0.95;
        drawCreature(ctx, sp, x, y, i === 3 ? 4 : 2.6, { flip: i % 2 === 0 });
      });
      ctx.globalAlpha = 1;
      for (let i = 0; i < 28; i++) {
        const x = (i * 211 + t * 12 * (i % 3 + 1)) % VIEW_W, y = VIEW_H - (i * 97 + t * 25) % VIEW_H;
        ctx.fillStyle = `rgba(255,240,180,${0.15 + 0.2 * Math.sin(t * 2 + i)})`;
        ctx.fillRect(x, y, 3, 3);
      }
    }
    /** Muestra el menú principal. Devuelve {type:'new'|'load', slot, state?} */
    async show() {
      const g = this.g;
      g.audio.playMusic("title");
      this.root.innerHTML = "";
      const logo = el("div", { style: { position: "absolute", left: 0, right: 0, top: "26px", textAlign: "center" } }, [
        el("div", { style: { fontSize: "66px", fontWeight: 900, letterSpacing: "3px", background: "linear-gradient(180deg,#fff6c0,#f2c040 55%,#c8602a)", WebkitBackgroundClip: "text", color: "transparent", filter: "drop-shadow(0 4px 0 #2a1040) drop-shadow(0 0 18px rgba(255,200,80,.5))" } }, GAME.name.toUpperCase()),
        el("div", { style: { fontSize: "22px", color: "#fff", letterSpacing: "8px", textShadow: "0 2px 0 #2a1040", marginTop: "-4px" } }, GAME.subtitle.toUpperCase())
      ]);
      this.root.append(logo);
      const ver = el("div", { class: "small", style: { position: "absolute", right: "14px", bottom: "8px", color: "rgba(255,255,255,.75)" } }, `v${GAME.version} \xB7 Se ejecuta en tu navegador`);
      this.root.append(ver);
      for (; ; ) {
        const latest = Save.latest();
        const slots = Save.list();
        const hasAny = slots.some((s) => !s.empty);
        const items = [
          { label: "Nueva partida", value: "new" },
          { label: "Continuar", value: "continue", disabled: !latest, hint: latest ? `${latest.summary.name} \xB7 ${fmtTime(latest.summary.playtime)}` : "" },
          { label: "Cargar partida", value: "load", disabled: !hasAny },
          { label: "Seleccionar partida", value: "select" },
          { label: "Opciones", value: "options" },
          { label: "Controles", value: "controls" },
          { label: "Cr\xE9ditos", value: "credits" }
        ];
        const pick = await g.ui.menu(items, { parent: this.root, panel: true, cancel: void 0, style: { position: "absolute", left: "350px", top: "215px", width: "260px", background: "linear-gradient(180deg,rgba(38,37,82,.92),rgba(27,26,56,.92))" } });
        if (pick === "new") {
          const slot = await this.pickSlot("Nueva partida: elige una ranura", { mode: "new" });
          if (slot) return { type: "new", slot };
        } else if (pick === "continue") {
          const r = g.loadSlot(latest.slot);
          if (r.ok) return { type: "load", slot: latest.slot, recovered: r.recovered };
          await g.say(r.error);
        } else if (pick === "load") {
          const slot = await this.pickSlot("Cargar partida", { mode: "load" });
          if (slot) {
            const r = g.loadSlot(slot);
            if (r.ok) return { type: "load", slot, recovered: r.recovered };
            await g.ui.say(r.error);
          }
        } else if (pick === "select") {
          await this.pickSlot("Seleccionar ranura activa", { mode: "select" });
        } else if (pick === "options") await openOptions(g);
        else if (pick === "controls") await openControls(g);
        else if (pick === "credits") await openCredits(g);
      }
    }
    /** Lista de ranuras. mode: new | load | select. Devuelve el nº de ranura elegido (o null). */
    pickSlot(title, { mode }) {
      const g = this.g;
      return new Promise((resolve2) => {
        const redraw = () => {
          wrap.innerHTML = "";
          wrap.append(el("div", { class: "title" }, title));
          const slots = Save.list();
          const nodes = slots.map((s) => {
            const body = s.empty ? el("div", { class: "dim" }, "\u2014 Ranura vac\xEDa \u2014") : s.corrupt ? el("div", { class: "bad" }, "Datos da\xF1ados" + (s.hasBackup ? " (hay copia de seguridad)" : "")) : el("div", { class: "row" }, [el("div", { style: { display: "flex", gap: "2px" } }, s.summary.party.slice(0, 3).map((sp) => creatureImg(sp, 40))), el("div", {}, [el("div", { style: { fontWeight: 700 } }, `${s.summary.name}`), el("div", { class: "small dim" }, `${fmtTime(s.summary.playtime)} \xB7 ${s.summary.badges} medallas \xB7 ${s.summary.caught} capturadas`), el("div", { class: "small dim" }, new Date(s.summary.savedAt || 0).toLocaleString("es-ES"))])]);
            const n = el("div", { class: "card", style: { display: "flex", alignItems: "center", gap: "12px", minHeight: "64px" } }, [el("div", { class: "big gold", style: { width: "28px" } }, String(s.slot)), body, g.slot === s.slot ? el("span", { class: "chip", style: { background: "#3a8a5a", marginLeft: "auto" } }, "Activa") : null]);
            return { node: n, slot: s };
          });
          const list = el("div", { class: "col" }, nodes.map((x) => x.node));
          wrap.append(list);
          const hint = el("div", { class: "small dim", style: { marginTop: "10px" } }, mode === "new" ? "Enter: elegir \xB7 Si la ranura tiene datos, se te pedir\xE1 confirmaci\xF3n." : "Enter: elegir \xB7 Supr / bot\xF3n Borrar: eliminar partida \xB7 Esc: volver");
          wrap.append(hint);
          const del = el("button", { class: "btn", style: { marginTop: "8px" } }, "Borrar ranura");
          wrap.append(del);
          const pick = g.ui.listPick(list, nodes, { index: Math.max(0, g.slot - 1), onSelect: (it) => activate(it.slot) });
          const activate = async (s) => {
            if (mode === "select") {
              g.slot = s.slot;
              g.settings.lastSlot = s.slot;
              g.saveSettings();
              g.ui.toast(`Ranura activa: ${s.slot}`);
              redraw();
              return;
            }
            if (mode === "new") {
              if (!s.empty) {
                off();
                const ok = await g.ui.yesNo(`La ranura ${s.slot} ya contiene una partida. \xBFSobrescribirla al guardar? (La partida actual no se borra hasta que guardes.)`);
                if (!ok) {
                  off = g.input.push(handler);
                  return;
                }
              }
              cleanup();
              resolve2(s.slot);
              return;
            }
            if (s.empty) {
              g.audio.sfx("error");
              return;
            }
            if (s.corrupt && !s.hasBackup) {
              g.audio.sfx("error");
              g.ui.toast("Esa ranura est\xE1 da\xF1ada y no tiene copia de seguridad.");
              return;
            }
            cleanup();
            resolve2(s.slot);
          };
          const doDelete = async () => {
            const s = pick.current().slot;
            if (s.empty) return;
            off();
            const ok = await g.ui.yesNo(`\xBFBorrar definitivamente la ranura ${s.slot}? Esta acci\xF3n no se puede deshacer.`, {});
            if (ok) {
              const ok2 = await g.ui.yesNo("\xBFSeguro? Se perder\xE1 todo el progreso de esa partida.");
              if (ok2) {
                Save.remove(s.slot);
                g.audio.sfx("cancel");
                g.ui.toast("Ranura borrada");
              }
            }
            off = g.input.push(handler);
            redraw();
          };
          del.addEventListener("click", doDelete);
          handler = (a) => {
            if (a === "up") pick.move(-1);
            else if (a === "down") pick.move(1);
            else if (a === "confirm") activate(pick.current().slot);
            else if (a === "cancel") {
              cleanup();
              resolve2(null);
            }
          };
          window.__slotDel = doDelete;
        };
        let handler = null, off = () => {
        };
        const wrap = el("div", { class: "panel", style: { position: "absolute", left: "250px", top: "120px", width: "460px", zIndex: 40, background: "linear-gradient(180deg,rgba(38,37,82,.97),rgba(27,26,56,.97))" } });
        this.root.append(wrap);
        const keyDel = (e) => {
          if (e.key === "Delete" && mode !== "new") window.__slotDel && window.__slotDel();
        };
        window.addEventListener("keydown", keyDel);
        const cleanup = () => {
          off();
          window.removeEventListener("keydown", keyDel);
          wrap.remove();
        };
        redraw();
        off = g.input.push((a) => handler && handler(a));
      });
    }
  };
  function openOptions(g) {
    const s = g.settings;
    return g.ui.openScreen("Opciones", (close, scr) => {
      const slider = (label, get, set) => {
        const out = el("span", { class: "dim", style: { width: "44px", textAlign: "right" } }, Math.round(get() * 100) + "%");
        const r = el("input", { type: "range", min: 0, max: 100, value: Math.round(get() * 100), oninput: (e) => {
          set(+e.target.value / 100);
          out.textContent = e.target.value + "%";
          g.saveSettings();
          if (label !== "M\xFAsica") g.audio.sfx("select");
        } });
        return el("div", { class: "row" }, [el("div", { style: { width: "200px" } }, label), r, out]);
      };
      const select = (label, key, opts) => {
        const sel = el("select", { onchange: (e) => {
          s[key] = e.target.value === "true" ? true : e.target.value === "false" ? false : e.target.value;
          g.saveSettings();
        } }, opts.map(([v, t]) => el("option", { value: String(v), selected: String(s[key]) === String(v) }, t)));
        sel.style.cssText = "font:inherit;font-size:16px;background:#0d0c24;color:#fff;border:2px solid #7a6a2a;border-radius:6px;padding:4px 8px";
        return el("div", { class: "row" }, [el("div", { style: { width: "200px" } }, label), sel]);
      };
      scr.body.append(el("div", { class: "panel col", style: { width: "640px", gap: "12px", margin: "0 auto", alignSelf: "flex-start" } }, [
        el("div", { class: "title" }, "Sonido"),
        slider("Volumen general", () => s.volume.master, (v) => {
          s.volume.master = v;
        }),
        slider("M\xFAsica", () => s.volume.music, (v) => {
          s.volume.music = v;
        }),
        slider("Efectos", () => s.volume.sfx, (v) => {
          s.volume.sfx = v;
        }),
        el("div", { class: "hr" }),
        el("div", { class: "title" }, "Juego"),
        select("Velocidad del texto", "textSpeed", [["lento", "Lenta"], ["normal", "Normal"], ["rapido", "R\xE1pida"], ["instantaneo", "Instant\xE1nea"]]),
        select("Reloj del mundo", "clockMode", [["rapido", "Acelerado (1 s = 1 min)"], ["real", "Tiempo real"]]),
        select("Animaciones de combate", "battleAnim", [[true, "Completas"], [false, "Reducidas"]]),
        select("Correr", "runToggle", [[false, "Mantener Shift/C"], [true, "Siempre corriendo"]]),
        select("Mostrar reloj y clima", "showClock", [[true, "S\xED"], [false, "No"]]),
        select("Guardado autom\xE1tico al curar", "autosave", [[true, "S\xED"], [false, "No"]])
      ]));
    });
  }
  function openControls(g) {
    const rows = [["Moverse", "Flechas / W A S D"], ["Correr", "Mantener Shift o C"], ["Hablar / interactuar / aceptar", "Enter, Espacio, Z o E"], ["Cancelar / retroceder", "Esc, X, Q o Retroceso"], ["Abrir el men\xFA", "Esc, Tab o M"], ["En los men\xFAs", "Flechas para elegir, Enter para confirmar"], ["T\xE1ctil", "En pantallas t\xE1ctiles aparecen botones en pantalla"], ["Rat\xF3n", "Todos los men\xFAs y botones tambi\xE9n funcionan con clic"]];
    return g.ui.openScreen("Controles", (close, scr) => scr.body.append(el("div", { class: "panel", style: { width: "720px", margin: "0 auto", alignSelf: "flex-start" } }, el("table", { class: "t" }, rows.map(([a, b]) => el("tr", {}, [el("td", { class: "gold" }, a), el("td", {}, b)]))))));
  }
  function openCredits(g) {
    return g.ui.openScreen("Cr\xE9ditos", (close, scr) => scr.body.append(el("div", { class: "panel col", style: { width: "720px", margin: "0 auto", alignSelf: "flex-start", lineHeight: 1.5 } }, [
      el("div", { class: "title" }, `${GAME.name} \u2014 ${GAME.subtitle}`),
      el("div", {}, "Dise\xF1o, programaci\xF3n, arte procedural y m\xFAsica sintetizada: generados por c\xF3digo para este proyecto."),
      el("div", {}, "Todas las criaturas, personajes, mapas, movimientos, textos y sonidos son originales. No se utilizan recursos de terceros."),
      el("div", { class: "dim" }, "Tecnolog\xEDa: HTML5 Canvas 2D, JavaScript (m\xF3dulos ES), Web Audio API, localStorage. Sin servidores ni dependencias en ejecuci\xF3n."),
      el("div", { class: "hr" }),
      el("div", { class: "small dim" }, `Versi\xF3n ${GAME.version} \xB7 Regi\xF3n de ${GAME.region}`)
    ])));
  }
  function openCreator(g) {
    return new Promise((resolve2) => {
      const look2 = { ...DEFAULT_LOOK, hat: "none", bag: null, scarf: null };
      let name = "Aldo";
      const presets = { a: { outfit: "jacket", top: 0, bottom: 0, hat: "cap", hatColor: 0, bag: null }, b: { outfit: "hoodie", top: 2, bottom: 3, hat: "none", bag: 3 }, c: { outfit: "coat", top: 8, bottom: 1, hat: "none", glasses: true } };
      const preview = el("canvas", { width: 160, height: 192, style: { width: "320px", height: "384px", imageRendering: "pixelated" } });
      let dirIdx = 0, frameT = 0;
      const dirs = ["down", "right", "up", "left"];
      const pg = preview.getContext("2d");
      pg.imageSmoothingEnabled = false;
      const drawPrev = () => {
        pg.clearRect(0, 0, 160, 192);
        pg.fillStyle = "rgba(0,0,0,.25)";
        pg.beginPath();
        pg.ellipse(80, 176, 40, 10, 0, 0, 7);
        pg.fill();
        pg.drawImage(trainerCanvas(look2, dirs[dirIdx], Math.floor(frameT) % 3), 16, 0, 128, 192);
      };
      const tick = setInterval(() => {
        frameT += 0.2;
        if (Math.floor(frameT * 5) % 40 === 0) dirIdx = (dirIdx + 1) % 4;
        drawPrev();
      }, 100);
      const opts = [
        { k: "style", label: "Estilo", vals: STYLES, apply: (v) => {
          Object.assign(look2, presets[v] || {});
          look2.style = v;
          refreshAll();
        } },
        { k: "skin", label: "Tono de piel", swatch: SKINS },
        { k: "hair", label: "Peinado", vals: HAIR_STYLES },
        { k: "hairColor", label: "Color de pelo", swatch: HAIR_COLORS },
        { k: "outfit", label: "Ropa", vals: OUTFITS },
        { k: "top", label: "Color de ropa", swatch: OUTFIT_COLORS },
        { k: "bottom", label: "Pantal\xF3n", swatch: PANTS_COLORS },
        { k: "hat", label: "Sombrero", vals: HATS },
        { k: "hatColor", label: "Color sombrero", swatch: OUTFIT_COLORS },
        { k: "glasses", label: "Gafas", vals: [[false, "No"], [true, "S\xED"]] },
        { k: "scarf", label: "Bufanda", vals: [[null, "Ninguna"], ...OUTFIT_COLORS.map((c, i) => [i, "Color " + (i + 1)])] },
        { k: "bag", label: "Mochila", vals: [[null, "Ninguna"], ...OUTFIT_COLORS.map((c, i) => [i, "Color " + (i + 1)])] }
      ];
      const rowsEl = [];
      const valueOf = (o) => look2[o.k];
      const curIndex = (o) => {
        if (o.swatch) return Number(look2[o.k]) || 0;
        return Math.max(0, o.vals.findIndex(([v]) => v === look2[o.k]));
      };
      const setIndex = (o, i) => {
        const n = o.swatch ? o.swatch.length : o.vals.length;
        i = (i + n) % n;
        if (o.apply) {
          o.apply(o.vals[i][0]);
        } else look2[o.k] = o.swatch ? i : o.vals[i][0];
        refresh(o);
        drawPrev();
      };
      const refresh = (o) => {
        const r = rowsEl.find((x) => x.o === o);
        if (!r) return;
        const i = curIndex(o);
        r.val.innerHTML = "";
        if (o.swatch) {
          r.val.append(el("span", { style: { display: "inline-block", width: "22px", height: "22px", borderRadius: "5px", background: o.swatch[i], border: "2px solid #fff", verticalAlign: "middle", marginRight: "8px" } }), `${i + 1}/${o.swatch.length}`);
        } else r.val.textContent = o.vals[i][1];
      };
      const refreshAll = () => {
        opts.forEach(refresh);
        drawPrev();
      };
      let sel = 0;
      const list = el("div", { class: "col", style: { gap: "4px" } });
      opts.forEach((o, idx) => {
        const val = el("div", { style: { width: "170px", textAlign: "center" } });
        const row = el("div", { class: "mi", style: { justifyContent: "space-between" } }, [el("span", {}, o.label), el("span", { class: "row", style: { gap: "4px" } }, [el("button", { class: "btn", style: { padding: "0 10px" }, onclick: (e) => {
          e.stopPropagation();
          setIndex(o, curIndex(o) - 1);
          sel = idx;
          hl();
        } }, "\u25C0"), val, el("button", { class: "btn", style: { padding: "0 10px" }, onclick: (e) => {
          e.stopPropagation();
          setIndex(o, curIndex(o) + 1);
          sel = idx;
          hl();
        } }, "\u25B6")])]);
        row.addEventListener("mouseenter", () => {
          sel = idx;
          hl();
        });
        list.append(row);
        rowsEl.push({ o, val, row });
      });
      const hl = () => rowsEl.forEach((r, i) => r.row.classList.toggle("sel", i === sel));
      const nameInp = el("input", { type: "text", maxlength: 10, value: name, oninput: (e) => {
        name = e.target.value;
      }, style: { width: "210px" } });
      const rand = el("button", { class: "btn", onclick: () => {
        const r = new RNG(Date.now() & 65535);
        look2.skin = r.int(0, 5);
        look2.hair = r.pick(HAIR_STYLES)[0];
        look2.hairColor = r.int(0, 9);
        look2.outfit = r.pick(OUTFITS)[0];
        look2.top = r.int(0, 9);
        look2.bottom = r.int(0, 7);
        look2.hat = r.pick(HATS)[0];
        look2.hatColor = r.int(0, 9);
        look2.glasses = r.chance(0.3);
        look2.scarf = r.chance(0.25) ? r.int(0, 9) : null;
        look2.bag = r.chance(0.4) ? r.int(0, 9) : null;
        refreshAll();
        g.audio.sfx("select");
      } }, "\u{1F3B2} Aleatorio");
      const go = el("button", { class: "btn", style: { fontSize: "20px", padding: "8px 22px" }, onclick: () => finish2() }, "\xA1Comenzar la aventura!");
      const back = el("button", { class: "btn", onclick: () => finish2(true) }, "\u2190 Volver");
      const finish2 = (cancel = false) => {
        clearInterval(tick);
        off();
        scr.remove();
        resolve2(cancel ? null : { name: (name || "").trim() || "Aldo", look: { ...look2 } });
      };
      const scr = el("div", { class: "screen" }, [
        el("div", { class: "head" }, el("h2", {}, "Crea a tu entrenador")),
        el("div", { class: "body" }, [
          el("div", { class: "panel col", style: { alignItems: "center", width: "380px" } }, [preview, el("div", { class: "row", style: { marginTop: "8px" } }, [el("span", {}, "Nombre"), nameInp])]),
          el("div", { class: "panel col grow scroll" }, [list, el("div", { class: "row", style: { justifyContent: "space-between", marginTop: "8px" } }, [back, rand, go])])
        ])
      ]);
      g.ui.root.append(scr);
      refreshAll();
      hl();
      const off = g.input.push((a) => {
        if (document.activeElement === nameInp) {
          if (a === "cancel") nameInp.blur();
          return;
        }
        if (a === "up") {
          sel = (sel + opts.length - 1) % opts.length;
          hl();
          g.audio.sfx("select");
        } else if (a === "down") {
          sel = (sel + 1) % opts.length;
          hl();
          g.audio.sfx("select");
        } else if (a === "left") {
          setIndex(opts[sel], curIndex(opts[sel]) - 1);
          g.audio.sfx("select");
        } else if (a === "right") {
          setIndex(opts[sel], curIndex(opts[sel]) + 1);
          g.audio.sfx("select");
        } else if (a === "confirm") finish2();
        else if (a === "cancel") finish2(true);
      });
    });
  }

  // src/screens/creature_view.js
  function creatureCard(c, { size = 56, showHp = true } = {}) {
    if (c.egg) return el("div", { class: "row" }, [creatureImg(c.sp, size), el("div", {}, [el("b", {}, "Huevo"), el("div", { class: "small dim" }, "Algo se mueve dentro...")])]);
    return el("div", { class: "row", style: { width: "100%" } }, [
      creatureImg(c.sp, size, c.variant),
      el("div", { class: "grow" }, [
        el("div", { class: "row", style: { justifyContent: "space-between" } }, [el("b", {}, [displayName(c), statusBadge(c.status), c.variant?.rare ? el("span", { title: "Variocolor", style: { color: "#ffd24a", marginLeft: "4px" } }, "\u2726") : null]), el("span", { class: "gold small" }, "Nv " + c.lv)]),
        showHp ? hpBar(c.hp, c.maxHp) : null,
        showHp ? el("div", { class: "small dim", style: { textAlign: "right" } }, c.hp > 0 ? `${c.hp}/${c.maxHp}` : "Debilitado") : null
      ])
    ]);
  }
  function statRows(c) {
    const s = getSpecies(c.sp);
    const natInfo = NATURES[c.nature];
    return STAT_KEYS.map((k) => {
      const v = c.stats[k];
      const pct = Math.min(100, v / (k === "hp" ? 300 : 200) * 100);
      const mark = natInfo?.up === k ? " \u25B2" : natInfo?.down === k ? " \u25BC" : "";
      return el("div", { class: "stat" }, [el("span", { class: natInfo?.up === k ? "good" : natInfo?.down === k ? "bad" : "" }, STAT_NAMES[k] + mark), el("div", { class: "b" }, el("i", { style: { width: pct + "%" } })), el("b", {}, String(v))]);
    });
  }
  function movesTable(c) {
    return el("table", { class: "t" }, [
      el("tr", {}, ["Movimiento", "Tipo", "Cat.", "Pot.", "Prec.", "PP"].map((h) => el("th", {}, h))),
      ...c.moves.map((m) => {
        const mv = getMove(m.id);
        return el("tr", { title: mv.desc }, [el("td", {}, mv.name), el("td", {}, typeChip(mv.type)), el("td", { class: "dim" }, mv.cat === "fis" ? "F\xEDsico" : mv.cat === "esp" ? "Especial" : "Estado"), el("td", {}, mv.pow || "\u2014"), el("td", {}, mv.acc || "\u2014"), el("td", { class: m.pp === 0 ? "bad" : "" }, `${m.pp}/${m.max}`)]);
      })
    ]);
  }
  function creatureDetail(c) {
    if (c.egg) return el("div", { class: "col center" }, [creatureImg(c.sp, 160), el("div", { class: "title" }, "Huevo"), el("div", { class: "dim" }, `Eclosionar\xE1 tras ${Math.max(0, c.egg.steps)} pasos m\xE1s. Camina para incubarlo.`)]);
    const s = getSpecies(c.sp), ab = ABILITIES[c.ability], nat = NATURES[c.nature];
    const bar = el("div", { class: "xpbar" }, el("i", { style: { width: xpProgress(c) * 100 + "%" } }));
    return el("div", { class: "col", style: { gap: "8px" } }, [
      el("div", { class: "row", style: { alignItems: "flex-start" } }, [
        creatureImg(c.sp, 150, c.variant),
        el("div", { class: "grow col", style: { gap: "4px" } }, [
          el("div", { class: "title", style: { margin: 0 } }, [displayName(c), statusBadge(c.status)]),
          el("div", {}, [...s.types.map(typeChip), el("span", { class: "rar", style: { color: RARITY[s.rarity].color } }, RARITY[s.rarity].name)]),
          el("div", { class: "small dim" }, `N.\xBA ${String(s.id).padStart(3, "0")} ${c.nick ? "\xB7 " + s.name : ""}`),
          el("div", {}, [el("span", { class: "gold" }, `Nv ${c.lv}`), el("span", { class: "dim small" }, c.lv < 100 ? `  \xB7  siguiente nivel: ${xpToNext(c)} exp.` : "  \xB7  nivel m\xE1ximo")]),
          bar,
          el("div", { class: "row small" }, [el("span", { class: "dim" }, "PS"), el("div", { class: "grow" }, hpBar(c.hp, c.maxHp)), el("span", {}, `${c.hp}/${c.maxHp}`)])
        ])
      ]),
      el("div", { class: "card" }, [
        el("div", { class: "small" }, [el("b", { class: "gold" }, "Personalidad: "), `${nat.name} \u2014 ${nat.text}${nat.up ? ` (+${STAT_NAMES[nat.up]}, \u2212${STAT_NAMES[nat.down]})` : ""}`]),
        ab ? el("div", { class: "small", style: { marginTop: "4px" } }, [el("b", { class: "gold" }, "Habilidad: "), `${ab.name} \u2014 ${ab.desc}`]) : null,
        el("div", { class: "small", style: { marginTop: "4px" } }, [el("b", { class: "gold" }, "Amistad: "), "\u2665".repeat(Math.ceil(c.friendship / 51)) + "\u2661".repeat(5 - Math.ceil(c.friendship / 51)), el("span", { class: "dim" }, `  (${c.friendship}/255)`)])
      ]),
      el("div", { class: "col", style: { gap: "3px" } }, statRows(c)),
      movesTable(c),
      el("div", { class: "small dim" }, `Entrenador: ${c.ot || "\u2014"} \xB7 ${c.caught?.how === "gift" ? "Recibida" : c.caught?.how === "egg" ? "Eclosion\xF3" : "Capturada"} en nivel ${c.caught?.lv ?? c.lv} \xB7 Genes: ${Object.values(c.iv).reduce((a, b) => a + b, 0)}/90${c.heldItem ? " \xB7 Objeto: " + getItem(c.heldItem).name : ""}`)
    ]);
  }

  // src/itemuse.js
  init_config();
  function useMedicine(itemId, c, ctx = {}) {
    const it = getItem(itemId), fx = it.fx, name = displayName(c);
    if (c.egg) return { ok: false, msg: "Un huevo no puede usar eso." };
    const alive = c.hp > 0;
    if (fx.revive != null) {
      if (alive) return { ok: false, msg: `${name} no est\xE1 debilitado.` };
      c.hp = Math.max(1, Math.floor(c.maxHp * fx.revive));
      c.status = null;
      return { ok: true, msg: `${name} ha revivido.`, healed: c.hp };
    }
    if (!alive && (fx.heal || fx.healFull || fx.cure || fx.pp || fx.ppAll || fx.xp || fx.lvUp || fx.ev || fx.friend)) return { ok: false, msg: `${name} est\xE1 debilitado.` };
    if (fx.heal || fx.healFull) {
      if (c.hp >= c.maxHp && !(fx.cure && c.status)) return { ok: false, msg: `${name} ya tiene los PS al m\xE1ximo.` };
      const before = c.hp;
      c.hp = fx.healFull ? c.maxHp : Math.min(c.maxHp, c.hp + fx.heal);
      let msg = `${name} recuper\xF3 ${c.hp - before} PS.`;
      if (fx.cure === "all" && c.status) {
        msg += ` Ya no est\xE1 ${STATUS[c.status].name.toLowerCase()}.`;
        c.status = null;
        c.statusTurns = 0;
      }
      return { ok: true, msg, healed: c.hp - before };
    }
    if (fx.cure) {
      if (!c.status || fx.cure !== "all" && c.status !== fx.cure) return { ok: false, msg: "No tendr\xEDa ning\xFAn efecto." };
      const st = STATUS[c.status].name.toLowerCase();
      c.status = null;
      c.statusTurns = 0;
      return { ok: true, msg: `${name} ya no est\xE1 ${st}.` };
    }
    if (ctx.inBattle) return { ok: false, msg: "No se puede usar ahora." };
    if (fx.pp || fx.ppAll) {
      const targets = fx.ppAll ? c.moves : [c.moves[ctx.moveIdx ?? 0]].filter(Boolean);
      let any = false;
      for (const m of targets) {
        const add = Math.min(m.max - m.pp, fx.pp || fx.ppAll);
        if (add > 0) {
          m.pp += add;
          any = true;
        }
      }
      if (!any) return { ok: false, msg: "No tendr\xEDa ning\xFAn efecto." };
      return { ok: true, msg: `Se restauraron los PP de ${name}.` };
    }
    if (fx.xp || fx.lvUp) {
      if (c.lv >= MAX_LEVEL) return { ok: false, msg: `${name} ya est\xE1 en el nivel m\xE1ximo.` };
      const cap = ctx.levelCap ?? MAX_LEVEL;
      if (c.lv >= cap) return { ok: false, msg: `${name} no puede subir m\xE1s hasta que consigas m\xE1s medallas (nivel m\xE1x. ${cap}).` };
      const amount = fx.lvUp ? xpToNext(c) : fx.xp;
      const ups = gainXp(c, amount, cap);
      changeFriendship(c, 2);
      return { ok: true, msg: `${name} gan\xF3 ${amount} puntos de experiencia.`, ups };
    }
    if (fx.ev) {
      const got = addEv(c, fx.ev.stat, fx.ev.n);
      if (!got) return { ok: false, msg: `${name} no puede entrenar m\xE1s ${STAT_NAMES[fx.ev.stat]}.` };
      changeFriendship(c, 3);
      return { ok: true, msg: `${STAT_NAMES[fx.ev.stat]} de ${name} mejor\xF3 (+${got} esfuerzo).` };
    }
    if (fx.friend) {
      if (c.friendship >= 255) return { ok: false, msg: `${name} ya te quiere al m\xE1ximo.` };
      changeFriendship(c, fx.friend);
      return { ok: true, msg: `${name} est\xE1 m\xE1s contento contigo.` };
    }
    return { ok: false, msg: "No se puede usar as\xED." };
  }

  // src/evolution.js
  function findEvolution(c, ctx = {}) {
    if (c.egg) return null;
    const s = getSpecies(c.sp);
    const trigger = ctx.trigger || "level";
    for (const r of s.evo) {
      if (r.item) {
        if (trigger !== "item" || ctx.item !== r.item) continue;
        if (r.lv && c.lv < r.lv) continue;
      } else {
        if (trigger === "item") continue;
        if (r.lv && c.lv < r.lv) continue;
      }
      if (r.friend && c.friendship < 160) continue;
      if (r.time) {
        const night = ctx.isNight ?? (ctx.hour != null && (ctx.hour >= 20 || ctx.hour < 6));
        if (r.time === "noche" && !night) continue;
        if (r.time === "dia" && night) continue;
      }
      if (r.place && !(ctx.tags || []).includes(r.place)) continue;
      if (r.move && !c.moves.some((m) => m.id === r.move)) continue;
      if (r.party && !(ctx.party || []).some((p) => p !== c && !p.egg && getSpecies(p.sp).types.includes(r.party))) continue;
      if (r.wx && ctx.weather !== r.wx) continue;
      return r;
    }
    return null;
  }
  function markEvolution(c, ctx) {
    const r = findEvolution(c, ctx);
    c.pendingEvo = r ? r.to : null;
    return r;
  }
  function evolve(c, toId) {
    const from = getSpecies(c.sp), to = getSpecies(toId);
    const oldName = displayName(c);
    const hadDefaultName = !c.nick;
    const oldAbilitySlot = c.abilitySlot ?? 0;
    c.sp = toId;
    c.ability = to.abilities[Math.min(oldAbilitySlot, to.abilities.length - 1)] || to.abilities[0] || c.ability;
    recalcStats(c, true);
    c.pendingEvo = null;
    const learned = [], pending = [];
    for (const m of learnsAtLevel(toId, c.lv)) {
      const r = learnMove(c, m);
      if (r === "learned") learned.push(m);
      else if (r === "full" && !c.pendingMoves.includes(m)) {
        c.pendingMoves.push(m);
        pending.push(m);
      }
    }
    c.friendship = Math.min(255, c.friendship + 10);
    return { from: from.id, to: toId, oldName, newName: hadDefaultName ? to.name : c.nick, typeChanged: from.types.join() !== to.types.join(), learned, pending };
  }

  // src/screens/menu.js
  init_config();

  // src/gyms.js
  var BADGES = [
    { id: "hoja", name: "Medalla Hoja", city: "Ciudad Roble", icon: "\u{1F343}", color: "#4fb547", type: "planta", cap: 24 },
    { id: "marea", name: "Medalla Marea", city: "Puerto Marea", icon: "\u{1F30A}", color: "#3f8fe8", type: "agua", cap: 30 },
    { id: "chispa", name: "Medalla Chispa", city: "Ciudad D\xEDnamo", icon: "\u26A1", color: "#f2c830", type: "electrico", cap: 36 },
    { id: "cantera", name: "Medalla Cantera", city: "Pico Granito", icon: "\u26F0", color: "#a39a7c", type: "roca", cap: 44 },
    { id: "ascua", name: "Medalla Ascua", city: "Ciudad Brasa", icon: "\u{1F525}", color: "#ef5b2a", type: "fuego", cap: 52 },
    { id: "bruma", name: "Medalla Bruma", city: "Aldea Niebla", icon: "\u2620", color: "#a455c8", type: "veneno", cap: 60 },
    { id: "cristal", name: "Medalla Cristal", city: "Cima Escarcha", icon: "\u2744", color: "#7fd8e6", type: "hielo", cap: 70 },
    { id: "dragon", name: "Medalla Drag\xF3n", city: "Ciudad Arcana", icon: "\u{1F409}", color: "#5a58d8", type: "dragon", cap: 100 }
  ];

  // src/achievements.js
  var ACHIEVEMENTS = {};
  function A2(id, name, desc, prog, reward = {}) {
    ACHIEVEMENTS[id] = { id, name, desc, prog, reward };
  }
  var caughtIds = (g) => Object.keys(g.state.dex.caught).map(Number);
  var lvMax = (g) => Math.max(0, ...[...g.party, ...g.state.boxes.flat().filter(Boolean)].filter((c) => !c.egg).map((c) => c.lv));
  var obtainable = SPECIES_LIST.length;
  A2("primer_contacto", "Primer contacto", "Captura tu primera criatura salvaje.", (g) => [g.state.stats.captures, 1], { money: 300 });
  A2("capturas_10", "Coleccionista novato", "Captura diez criaturas.", (g) => [g.state.stats.captures, 10], { money: 800, items: { super_capsula: 5 } });
  A2("capturas_100", "Cazador incansable", "Captura cien criaturas.", (g) => [g.state.stats.captures, 100], { money: 8e3, items: { ultra_capsula: 10 } });
  A2("dex_50", "Naturalista", "Registra 50 criaturas como capturadas.", (g) => [caughtIds(g).length, 50], { money: 3e3, items: { caramelo_raro: 3 } });
  A2("dex_completa", "Enciclopedista", "Completa la enciclopedia de criaturas.", (g) => [caughtIds(g).length, obtainable], { money: 3e4, items: { caramelo_raro: 10 }, cosmetic: "effect:estrellas" });
  A2("evolucion_1", "Metamorfosis", "Haz evolucionar a una criatura.", (g) => [g.state.stats.evolutions, 1], { money: 500 });
  A2("evoluciones_20", "Maestro de la evoluci\xF3n", "Evoluciona 20 veces a tus criaturas.", (g) => [g.state.stats.evolutions, 20], { money: 4e3, items: { gema_solar: 1 } });
  A2("medalla_1", "Primer gimnasio", "Gana tu primera medalla de gimnasio.", (g) => [g.state.badges.length, 1], { money: 1e3 });
  A2("medallas_8", "Ocho medallas", "Consigue las ocho medallas de Aurelia.", (g) => [g.state.badges.length, 8], { money: 1e4, cosmetic: "hat:crown" });
  A2("historia", "Leyenda de Aurelia", "Completa la historia principal.", (g) => [g.flag("story_done") ? 1 : 0, 1], { money: 15e3, cosmetic: "outfit:uniform" });
  A2("liga", "Campe\xF3n o campeona", "Derrota al campe\xF3n de la Liga.", (g) => [g.flag("league_done") ? 1 : 0, 1], { money: 2e4, items: { caramelo_raro: 5 } });
  A2("legendaria", "Cazador de leyendas", "Captura una criatura legendaria.", (g) => [caughtIds(g).filter((id) => SPECIES[id].rarity === "L").length, 1], { money: 5e3, cosmetic: "effect:aura" });
  A2("legendarias_7", "Guardi\xE1n de las leyendas", "Captura las siete criaturas legendarias.", (g) => [caughtIds(g).filter((id) => SPECIES[id].rarity === "L").length, 7], { money: 25e3 });
  A2("mitica", "Lo imposible", "Captura una criatura m\xEDtica.", (g) => [caughtIds(g).filter((id) => SPECIES[id].rarity === "M").length, 1], { money: 12e3 });
  A2("torneo", "Campe\xF3n de torneo", "Gana un torneo en el Coliseo de Oasis.", (g) => [g.state.stats.tournaments, 1], { money: 3e3, cosmetic: "hat:laurel" });
  A2("explorador", "Trotamundos", "Explora todas las zonas de Aurelia.", (g) => [Object.keys(g.state.flags).filter((k) => k.startsWith("zona_")).length, 15], { money: 6e3, cosmetic: "bag:aventurero" });
  A2("nivel_50", "Veterano", "Lleva a una criatura al nivel 50.", (g) => [lvMax(g), 50], { money: 2500 });
  A2("nivel_100", "Maestro", "Lleva a una criatura al nivel 100.", (g) => [lvMax(g), 100], { money: 2e4, items: { caramelo_raro: 5 } });
  A2("rico", "Fortuna", "Re\xFAne 100.000 \xE1ureos.", (g) => [g.state.player.money, 1e5], { cosmetic: "hat:tophat" });
  A2("entrenadores_20", "Duelista", "Derrota a 20 entrenadores.", (g) => [g.state.stats.wins_trainers || 0, 20], { money: 3500 });
  A2("cria", "Criador", "Haz eclosionar un huevo.", (g) => [g.state.stats.hatched, 1], { money: 800 });
  A2("variocolor", "Destello", "Captura una criatura de color excepcional.", (g) => [[...g.party, ...g.state.boxes.flat().filter(Boolean)].some((c) => c.variant?.rare) ? 1 : 0, 1], { money: 5e3, cosmetic: "effect:destellos" });
  A2("todos_tipos", "Arco iris", "Captura criaturas de los 18 tipos.", (g) => [new Set(caughtIds(g).flatMap((id) => SPECIES[id].types)).size, 18], { money: 6e3 });
  A2("misiones_10", "Manos a la obra", "Completa 10 misiones.", (g) => [Object.values(g.state.quests).filter((x) => x.status === "done").length, 10], { money: 4e3, cosmetic: "scarf:rojo" });
  A2("viajero", "Viajero veloz", "Usa el viaje r\xE1pido por primera vez.", (g) => [g.count("fast_travel_used"), 1], { money: 500 });
  A2("pasos", "Caminante", "Da 10.000 pasos.", (g) => [g.state.stats.steps, 1e4], { money: 1500 });
  A2("amistad", "Mejores amigos", "Lleva la amistad de una criatura al m\xE1ximo.", (g) => [[...g.party].some((c) => c.friendship >= 255) ? 1 : 0, 1], { money: 1200, cosmetic: "glasses:corazon" });
  A2("equipo_50", "Equipo de \xE9lite", "Ten un equipo de seis criaturas de nivel 50 o m\xE1s.", (g) => [g.party.filter((c) => !c.egg && c.lv >= 50).length, 6], { money: 8e3 });
  A2("ocultos_5", "Ojo de lince", "Encuentra 5 objetos ocultos.", (g) => [g.count("hidden_found"), 5], { money: 1500 });
  A2("tormenta", "Bajo la tormenta", "Captura una criatura durante una tormenta.", (g) => [g.flag("capturaste_en_tormenta") ? 1 : 0, 1], { money: 1500, cosmetic: "effect:rayos" });
  function achievementProgress(g, a) {
    const [c, m] = a.prog(g);
    return `${Math.min(c, m)}/${m}`;
  }
  function installAchievements(g) {
    g.on((ev) => {
      if (!g.state) return;
      if (ev === "defeat") g.state.stats.wins_trainers = (g.state.stats.wins_trainers || 0) + 1;
      if (ev === "capture" && g.ow?.weatherId === "tormenta") g.setFlag("capturaste_en_tormenta");
      if (ev === "visit") {
        const z = g.ow?.map?.zone;
        if (z) g.setFlag("zona_" + z);
      }
      for (const a of Object.values(ACHIEVEMENTS)) {
        if (g.state.achievements[a.id]) continue;
        let ok = false;
        try {
          const [c, m] = a.prog(g);
          ok = c >= m;
        } catch {
          ok = false;
        }
        if (ok) unlock(g, a);
      }
    });
  }
  async function unlock(g, a) {
    g.state.achievements[a.id] = { at: g.state.player.playtime };
    g.audio.sfx("achievement");
    g.ui.toast(`\u{1F3C6} Logro: <b>${a.name}</b><br><span class="small dim">${a.desc}</span>`, "ach");
    const r = a.reward || {};
    if (r.money) g.addMoney(r.money);
    if (r.items) {
      for (const [id, n] of Object.entries(r.items)) if (n > 0) await g.giveItem(id, n, { quiet: true });
    }
    if (r.cosmetic) g.unlockCosmetic?.(r.cosmetic);
    g.emit("achievement", { id: a.id });
  }

  // src/screens/dex.js
  var HABITATS = { pradera: "Praderas", bosque: "Bosques", lago: "Lagos", playa: "Playas", mar: "Mar", cueva: "Cuevas", montana: "Monta\xF1as", volcan: "Zona volc\xE1nica", desierto: "Desierto", pantano: "Pantano", isla: "Islas", nieve: "Zona nevada", ruinas: "Ruinas", final: "\xC1rea final" };
  function openDex(g, { onlyView = true } = {}) {
    const st = g.state;
    return g.ui.openScreen("Enciclopedia", (close, scr) => {
      const f = { q: "", type: "", rar: "", hab: "", evo: "", st: "" };
      const seenN = () => Object.keys(st.dex.seen).length, capN = () => Object.keys(st.dex.caught).length;
      const total = SPECIES_LIST.length;
      const prog = el("div", { class: "row", style: { gap: "18px", marginLeft: "auto", marginRight: "14px" } });
      scr.head.insertBefore(prog, scr.head.querySelector(".x"));
      const mkSel = (key, label, opts) => {
        const s = el("select", { onchange: (e) => {
          f[key] = e.target.value;
          render2();
        } }, [el("option", { value: "" }, label), ...opts.map(([v, t]) => el("option", { value: v }, t))]);
        s.style.cssText = "font:inherit;font-size:14px;background:#0d0c24;color:#fff;border:2px solid #7a6a2a;border-radius:6px;padding:3px 6px;max-width:130px";
        return s;
      };
      const q2 = el("input", { type: "text", placeholder: "Buscar por nombre o n.\xBA\u2026", oninput: (e) => {
        f.q = e.target.value.trim().toLowerCase();
        render2();
      } });
      q2.style.cssText = "font-size:15px;padding:4px 8px;width:190px";
      const bar = el("div", { class: "row", style: { flexWrap: "wrap", gap: "6px", marginBottom: "6px" } }, [
        q2,
        mkSel("type", "Tipo", TYPE_IDS.map((t) => [t, TYPES[t].name])),
        mkSel("rar", "Rareza", RARITY_ORDER.map((r) => [r, RARITY[r].name])),
        mkSel("hab", "Regi\xF3n", Object.entries(HABITATS)),
        mkSel("evo", "Evoluci\xF3n", [["1", "Primera fase"], ["2", "Segunda fase"], ["3", "Tercera fase"], ["final", "Totalmente evolucionada"], ["none", "No evoluciona"]]),
        mkSel("st", "Estado", [["caught", "Capturadas"], ["seen", "Vistas"], ["missing", "Pendientes"]])
      ]);
      const listEl = el("div", { class: "col scroll", style: { gap: "2px", flex: 1 } });
      const count = el("div", { class: "small dim" });
      const left = el("div", { class: "col", style: { width: "430px" } }, [bar, count, listEl]);
      const right = el("div", { class: "panel scroll grow" });
      scr.body.append(left, right);
      let sel = 0, rows = [];
      const filtered = () => SPECIES_LIST.filter((s) => {
        const seen = !!st.dex.seen[s.id], caught = !!st.dex.caught[s.id];
        if (f.q && !(seen && s.name.toLowerCase().includes(f.q)) && String(s.id) !== f.q.replace(/^0+/, "") && !String(s.id).padStart(3, "0").includes(f.q)) return false;
        if (f.type && !(seen && s.types.includes(f.type))) return false;
        if (f.rar && !(seen && s.rarity === f.rar)) return false;
        if (f.hab && !(seen && s.habitats.includes(f.hab))) return false;
        if (f.evo) {
          if (!seen) return false;
          if (f.evo === "final" && !(s.finalStage && s.stage > 1)) return false;
          if (f.evo === "none" && !(s.finalStage && s.stage === 1)) return false;
          if (["1", "2", "3"].includes(f.evo) && s.stage !== +f.evo) return false;
        }
        if (f.st === "caught" && !caught) return false;
        if (f.st === "seen" && !(seen && !caught)) return false;
        if (f.st === "missing" && caught) return false;
        return true;
      });
      const render2 = () => {
        prog.innerHTML = "";
        const pct = Math.round(capN() / total * 100);
        prog.append(el("span", {}, ["\u{1F441} Vistas ", el("b", {}, `${seenN()}`)]), el("span", {}, ["\u25D3 Capturadas ", el("b", { class: "good" }, `${capN()}`)]), el("span", {}, ["Completado ", el("b", { class: "gold" }, pct + "%")]));
        rows = filtered();
        if (sel >= rows.length) sel = Math.max(0, rows.length - 1);
        count.textContent = `${rows.length} de ${total} criaturas`;
        listEl.innerHTML = "";
        rows.forEach((s, i) => {
          const seen = !!st.dex.seen[s.id], caught = !!st.dex.caught[s.id];
          const n = el("div", { class: "mi" + (i === sel ? " sel" : ""), style: { padding: "2px 8px" } }, [creatureImg(s.id, 38, null, { silhouette: !seen }), el("span", { class: "dim", style: { width: "44px" } }, "#" + String(s.id).padStart(3, "0")), el("span", { style: { fontWeight: 700 } }, seen ? s.name : "???"), el("span", { class: "hint" }, caught ? "\u25D3" : seen ? "\u{1F441}" : "")]);
          n.addEventListener("click", () => {
            sel = i;
            render2();
          });
          listEl.append(n);
        });
        listEl.children[sel]?.scrollIntoView({ block: "nearest" });
        right.innerHTML = "";
        right.append(rows[sel] ? detail(rows[sel]) : el("div", { class: "dim" }, "Ninguna criatura coincide con los filtros."));
      };
      const detail = (s) => {
        const seen = !!st.dex.seen[s.id], caught = !!st.dex.caught[s.id];
        const head = el("div", { class: "row", style: { alignItems: "flex-start" } }, [creatureImg(s.id, 170, null, { silhouette: !seen }), el("div", { class: "grow col", style: { gap: "4px" } }, [
          el("div", { class: "title", style: { margin: 0 } }, seen ? s.name : "???"),
          el("div", { class: "dim small" }, `N.\xBA ${String(s.id).padStart(3, "0")}`),
          seen ? el("div", {}, s.types.map(typeChip)) : null,
          seen ? el("div", {}, [el("span", { class: "rar", style: { color: RARITY[s.rarity].color } }, RARITY[s.rarity].name)]) : null,
          seen ? el("div", { class: "small" }, `Altura ${s.h.toFixed(1)} m \xB7 Peso ${s.w.toFixed(1)} kg`) : null,
          el("div", { class: "small " + (caught ? "good" : "dim") }, caught ? "\u25D3 Capturada" : seen ? "\u{1F441} Vista (sin capturar)" : "Sin descubrir")
        ])]);
        if (!seen) return el("div", { class: "col" }, [head, el("div", { class: "dim" }, "A\xFAn no has encontrado a esta criatura.")]);
        const nodes = [head, el("div", { class: "hr" }), el("div", {}, s.desc)];
        nodes.push(el("div", { class: "small", style: { marginTop: "6px" } }, [el("b", { class: "gold" }, "H\xE1bitat: "), s.habitats.length ? s.habitats.map((h) => HABITATS[h]).join(", ") : "Especial (se obtiene en eventos, huevos o evoluci\xF3n)"]));
        nodes.push(el("div", { class: "small" }, [el("b", { class: "gold" }, "Comportamiento: "), BEHAVIORS[s.behavior]]));
        if (caught) {
          nodes.push(el("div", { class: "small" }, [el("b", { class: "gold" }, "Tasa de captura: "), `${s.cr}/255`]), el("div", { class: "small" }, [el("b", { class: "gold" }, "Habilidades: "), s.abilities.map((a, i) => (ABILITIES[a]?.name || a) + (i === 2 ? " (oculta)" : "")).join(", ")]));
          nodes.push(el("div", { class: "hr" }), el("div", { class: "col", style: { gap: "3px" } }, STAT_KEYS.map((k) => el("div", { class: "stat" }, [el("span", {}, STAT_NAMES[k]), el("div", { class: "b" }, el("i", { style: { width: Math.min(100, s.base[k] / 160 * 100) + "%" } })), el("b", {}, String(s.base[k]))]))));
          const wk = weaknesses(s.types), rs = resistances(s.types);
          nodes.push(el("div", { class: "small", style: { marginTop: "6px" } }, [el("b", { class: "bad" }, "D\xE9bil a: "), wk.map((w) => TYPES[w.type].name + (w.mult > 2 ? " \xD74" : "")).join(", ") || "\u2014"]), el("div", { class: "small" }, [el("b", { class: "good" }, "Resiste: "), rs.map((w) => TYPES[w.type].name + (w.mult === 0 ? " (inmune)" : "")).join(", ") || "\u2014"]));
          nodes.push(el("div", { class: "small", style: { marginTop: "4px" } }, [el("b", { class: "gold" }, "Aprende: "), s.learnset.filter((x) => x[0] > 1).slice(0, 8).map(([l, m]) => `Nv${l} ${getMove(m).name}`).join(" \xB7 ")]));
        } else nodes.push(el("div", { class: "dim small", style: { marginTop: "6px" } }, "Captura esta criatura para ver sus estad\xEDsticas, habilidades y movimientos."));
        if (s.family.length > 1) {
          const chain = el("div", { class: "row", style: { flexWrap: "wrap", marginTop: "6px" } });
          const walk = (id, first) => {
            const sp = SPECIES[id];
            const known = !!st.dex.seen[id];
            if (!first) chain.append(el("span", { class: "gold" }, "\u2192"));
            chain.append(el("div", { class: "col center", style: { alignItems: "center", cursor: "pointer", opacity: id === s.id ? 1 : 0.9 }, onclick: () => {
              const i = rows.findIndex((r) => r.id === id);
              if (i >= 0) {
                sel = i;
                render2();
              }
            } }, [creatureImg(id, 54, null, { silhouette: !known }), el("span", { class: "small" }, known ? sp.name : "???"), el("span", { class: "small dim" }, evoText(sp))]));
            for (const e of sp.evo) walk(e.to, false);
          };
          walk(s.root, true);
          nodes.push(el("div", { class: "title", style: { marginTop: "8px", fontSize: "16px" } }, "Evoluciones"), chain);
        }
        return el("div", { class: "col" }, nodes);
      };
      const evoText = (sp) => {
        if (!sp.prev) return "Base";
        const r = SPECIES[sp.prev].evo.find((e) => e.to === sp.id);
        if (!r) return "";
        const p = [];
        if (r.lv) p.push("Nv" + r.lv);
        if (r.item) p.push("objeto");
        if (r.friend) p.push("amistad");
        if (r.time) p.push(r.time === "noche" ? "noche" : "d\xEDa");
        if (r.place) p.push(r.place);
        return p.join(" \xB7 ");
      };
      render2();
      scr._dex = { move: (d) => {
        if (rows.length) {
          sel = (sel + d + rows.length) % rows.length;
          render2();
        }
      } };
    }, { onAction: (a) => {
      const ae = document.activeElement;
      if (ae && ["INPUT", "SELECT"].includes(ae.tagName)) {
        if (a === "cancel") {
          ae.blur();
          return true;
        }
        return false;
      }
      const s = [...document.querySelectorAll(".screen")].pop();
      const b = s?._dex;
      if (!b) return false;
      if (a === "up") {
        b.move(-1);
        return true;
      }
      if (a === "down") {
        b.move(1);
        return true;
      }
      return false;
    } });
  }

  // src/screens/worldmap.js
  init_world();
  var NODES = [
    { id: "villa_alba", label: "Villa Alba", x: 0.09, y: 0.7, type: "town", maps: ["villa_alba"], fly: "villa_alba" },
    { id: "ruta1", label: "Ruta 1", x: 0.19, y: 0.66, type: "route", maps: ["ruta1"] },
    { id: "bosque_umbra", label: "Bosque Umbra", x: 0.29, y: 0.58, type: "forest", maps: ["bosque_umbra"] },
    { id: "ciudad_roble", label: "Ciudad Roble", x: 0.39, y: 0.5, type: "city", maps: ["ciudad_roble"], fly: "ciudad_roble", gym: "hoja" },
    { id: "ruta2", label: "Lago Espejo", x: 0.4, y: 0.65, type: "lake", maps: ["ruta2"] },
    { id: "playa_brisa", label: "Playa Brisa", x: 0.27, y: 0.84, type: "beach", maps: ["playa_brisa"] },
    { id: "puerto_marea", label: "Puerto Marea", x: 0.42, y: 0.82, type: "city", maps: ["puerto_marea"], fly: "puerto_marea", gym: "marea" },
    { id: "isla_tormenta", label: "Isla Tormenta", x: 0.56, y: 0.92, type: "island", maps: ["isla_tormenta"] },
    { id: "ruta3", label: "Ruta 3", x: 0.5, y: 0.45, type: "route", maps: ["ruta3"] },
    { id: "cueva_eco", label: "Cueva Eco", x: 0.51, y: 0.33, type: "cave", maps: ["cueva_eco"] },
    { id: "ciudad_dinamo", label: "Ciudad D\xEDnamo", x: 0.61, y: 0.5, type: "city", maps: ["ciudad_dinamo"], fly: "ciudad_dinamo", gym: "chispa" },
    { id: "ruta_granito", label: "Ruta Granito", x: 0.62, y: 0.32, type: "mountain", maps: ["ruta_granito", "mina_granito"] },
    { id: "pico_granito", label: "Pico Granito", x: 0.68, y: 0.19, type: "city", maps: ["pico_granito"], fly: "pico_granito", gym: "cantera" },
    { id: "desierto_ambar", label: "Desierto \xC1mbar", x: 0.74, y: 0.52, type: "desert", maps: ["desierto_ambar"] },
    { id: "oasis_zafiro", label: "Oasis Zafiro", x: 0.83, y: 0.48, type: "city", maps: ["oasis_zafiro"], fly: "oasis_zafiro" },
    { id: "ruta_ceniza", label: "Ruta Ceniza", x: 0.87, y: 0.6, type: "volcano", maps: ["ruta_ceniza"] },
    { id: "ciudad_brasa", label: "Ciudad Brasa", x: 0.9, y: 0.72, type: "city", maps: ["ciudad_brasa", "crater_ignis"], fly: "ciudad_brasa", gym: "ascua" },
    { id: "pantano_niebla", label: "Pantano Niebla", x: 0.62, y: 0.68, type: "swamp", maps: ["pantano_niebla"] },
    { id: "aldea_niebla", label: "Aldea Niebla", x: 0.64, y: 0.82, type: "city", maps: ["aldea_niebla"], fly: "aldea_niebla", gym: "bruma" },
    { id: "ruta_nevada", label: "Ruta Nevada", x: 0.78, y: 0.2, type: "snow", maps: ["ruta_nevada", "cueva_hielo"] },
    { id: "cima_escarcha", label: "Cima Escarcha", x: 0.88, y: 0.12, type: "city", maps: ["cima_escarcha"], fly: "cima_escarcha", gym: "cristal" },
    { id: "ruinas_antiguas", label: "Ruinas Antiguas", x: 0.93, y: 0.3, type: "ruins", maps: ["ruinas_antiguas"] },
    { id: "ciudad_arcana", label: "Ciudad Arcana", x: 0.95, y: 0.42, type: "city", maps: ["ciudad_arcana"], fly: "ciudad_arcana", gym: "dragon" },
    { id: "calzada_victoria", label: "Calzada Victoria", x: 0.8, y: 0.3, type: "route", maps: ["calzada_victoria"] },
    { id: "meseta_aurora", label: "Meseta Aurora", x: 0.72, y: 0.06, type: "league", maps: ["meseta_aurora"], fly: "meseta_aurora" }
  ];
  var EDGES = [
    ["villa_alba", "ruta1"],
    ["ruta1", "bosque_umbra"],
    ["bosque_umbra", "ciudad_roble"],
    ["ciudad_roble", "ruta2"],
    ["ruta2", "puerto_marea"],
    ["puerto_marea", "playa_brisa"],
    ["ciudad_roble", "ruta3"],
    ["ruta3", "cueva_eco"],
    ["ruta3", "ciudad_dinamo"],
    ["ciudad_dinamo", "ruta_granito"],
    ["ruta_granito", "pico_granito"],
    ["ciudad_dinamo", "desierto_ambar"],
    ["desierto_ambar", "oasis_zafiro"],
    ["oasis_zafiro", "ruta_ceniza"],
    ["ruta_ceniza", "ciudad_brasa"],
    ["ciudad_dinamo", "pantano_niebla"],
    ["pantano_niebla", "aldea_niebla"],
    ["pico_granito", "ruta_nevada"],
    ["ruta_nevada", "cima_escarcha"],
    ["cima_escarcha", "ruinas_antiguas"],
    ["ruinas_antiguas", "ciudad_arcana"],
    ["ciudad_arcana", "calzada_victoria"],
    ["calzada_victoria", "meseta_aurora"]
  ];
  var COLORS = { town: "#f2d060", city: "#ff9a5a", route: "#e8e0c0", forest: "#4aa85a", lake: "#5ab8f0", beach: "#f2e2b0", island: "#7ad8c0", cave: "#a09cb0", mountain: "#b8b0a0", desert: "#e8c97e", volcano: "#ef5b2a", swamp: "#7a9a5a", snow: "#e8f4ff", ruins: "#c8b8e0", league: "#ff6aa8" };
  function nodeVisited(g, n) {
    return n.maps.some((m) => g.state.flags["v_" + m]);
  }
  function openWorldMap(g) {
    let result = null;
    return g.ui.openScreen("Mapa de Aurelia", (close, scr) => {
      const W = 880, H = 400;
      const cv = el("canvas", { width: W, height: H, style: { width: W + "px", height: H + "px", borderRadius: "10px", border: "3px solid #f2d060" } });
      const info = el("div", { class: "panel", style: { marginTop: "8px", minHeight: "70px" } }, "Pasa el rat\xF3n por un lugar para ver sus detalles.");
      scr.body.append(el("div", { class: "col", style: { margin: "0 auto" } }, [cv, info]));
      const ctx = cv.getContext("2d");
      const cur = g.ow?.map?.id;
      const curNode = NODES.find((n) => n.maps.includes(cur));
      const canFly = g.hasKey("pase_viaje") && !g.ow?.map?.indoor && !g.ow?.map?.cave && !g.ow?.map?.noFly;
      let hover = null, pick = curNode ? NODES.indexOf(curNode) : 0;
      const draw2 = () => {
        if (!cv.isConnected) {
          clearInterval(timer);
          return;
        }
        let gr = ctx.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, "#2a5a9a");
        gr.addColorStop(1, "#183a6a");
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#4a6a3a";
        ctx.beginPath();
        ctx.moveTo(30, 300);
        ctx.bezierCurveTo(60, 150, 200, 120, 330, 90);
        ctx.bezierCurveTo(480, 40, 700, 20, 820, 50);
        ctx.bezierCurveTo(870, 150, 880, 250, 850, 360);
        ctx.bezierCurveTo(700, 390, 520, 392, 360, 372);
        ctx.bezierCurveTo(200, 380, 80, 360, 30, 300);
        ctx.fill();
        ctx.fillStyle = "#6a8a4a";
        ctx.beginPath();
        ctx.ellipse(300, 230, 160, 90, -0.2, 0, 7);
        ctx.ellipse(620, 170, 150, 80, 0.3, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#c8c0b0";
        ctx.beginPath();
        ctx.ellipse(560, 80, 110, 40, 0, 0, 7);
        ctx.ellipse(700, 70, 120, 38, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#e8c97e";
        ctx.beginPath();
        ctx.ellipse(670, 205, 70, 40, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#7a9a5a";
        ctx.beginPath();
        ctx.ellipse(550, 270, 55, 35, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,240,200,.8)";
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        for (const [a, b] of EDGES) {
          const A3 = NODES.find((n) => n.id === a), B = NODES.find((n) => n.id === b);
          if (!(nodeVisited(g, A3) || nodeVisited(g, B))) continue;
          ctx.beginPath();
          ctx.moveTo(A3.x * W, A3.y * H);
          ctx.lineTo(B.x * W, B.y * H);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        NODES.forEach((n, i) => {
          const vis = nodeVisited(g, n), exists = n.maps.some(mapExists);
          if (!vis && !(n.fly && false)) {
            ctx.fillStyle = "rgba(20,16,50,.55)";
            ctx.beginPath();
            ctx.arc(n.x * W, n.y * H, 5, 0, 7);
            ctx.fill();
            return;
          }
          const r = n.type === "city" || n.type === "town" || n.type === "league" ? 11 : 7;
          ctx.fillStyle = COLORS[n.type] || "#fff";
          ctx.strokeStyle = i === pick ? "#fff" : "#1a1226";
          ctx.lineWidth = i === pick ? 4 : 2;
          ctx.beginPath();
          ctx.arc(n.x * W, n.y * H, r, 0, 7);
          ctx.fill();
          ctx.stroke();
          if (n.gym && g.state.badges.includes(n.gym)) {
            ctx.fillStyle = "#fff";
            ctx.font = "12px sans-serif";
            ctx.fillText("\u2605", n.x * W - 5, n.y * H + 4);
          }
          ctx.font = 'bold 12px "Trebuchet MS",sans-serif';
          ctx.textAlign = "center";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(10,8,24,.9)";
          ctx.strokeText(n.label, n.x * W, n.y * H - r - 4);
          ctx.fillStyle = "#fff";
          ctx.fillText(n.label, n.x * W, n.y * H - r - 4);
          if (canFly && n.fly && g.state.fastTravel.includes(n.fly)) {
            ctx.fillStyle = "#6ad8ff";
            ctx.fillText("\u2708", n.x * W + r + 8, n.y * H + 4);
          }
        });
        if (curNode) {
          const t = performance.now() / 300;
          ctx.strokeStyle = "#ff4a6a";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(curNode.x * W, curNode.y * H, 15 + Math.sin(t) * 2, 0, 7);
          ctx.stroke();
        }
      };
      const timer = setInterval(draw2, 100);
      draw2();
      const describe = (n) => {
        info.innerHTML = "";
        const vis = nodeVisited(g, n);
        if (!vis) {
          info.append(el("div", { class: "dim" }, "??? \u2014 Lugar sin descubrir"));
          return;
        }
        const flyOk = canFly && n.fly && g.state.fastTravel.includes(n.fly) && n.maps.some(mapExists);
        info.append(el("div", { class: "title", style: { marginBottom: "2px" } }, n.label), el("div", { class: "small dim" }, n.gym ? `Gimnasio \xB7 ${g.state.badges.includes(n.gym) ? "Medalla conseguida" : "Medalla pendiente"}` : n.type), flyOk ? el("div", { style: { marginTop: "6px" } }, el("button", { class: "btn", onclick: () => travel(n) }, "\u2708 Viajar aqu\xED")) : el("div", { class: "small dim" }, g.hasKey("pase_viaje") ? n.fly ? "A\xFAn no has visitado su centro de curaci\xF3n." : "No se puede viajar directamente." : "Necesitas el Pase de Viaje para viajar r\xE1pido."));
      };
      const travel = async (n) => {
        const dest = n.fly;
        const m = getMap(dest);
        const sp = m.spawns.fly || m.spawns.start || { x: 1, y: 1, dir: "down" };
        g.inc("fast_travel_used");
        g.emit("fast_travel", { to: dest });
        result = "closeAll";
        close();
        g.audio.sfx("warp");
        g.ow.busy = true;
        await g.ui.fade(true, 350);
        g.state.player.surfing = false;
        g.state.player.biking = false;
        await g.ow.loadMap(dest, sp.x, sp.y, sp.dir || "down");
        await g.ui.fade(false, 350);
        g.ow.busy = false;
      };
      cv.addEventListener("mousemove", (e) => {
        const r = cv.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
        const i = NODES.findIndex((n) => Math.hypot(n.x * W - x, n.y * H - y) < 14);
        if (i >= 0 && i !== pick) {
          pick = i;
          describe(NODES[i]);
        }
      });
      cv.addEventListener("click", () => describe(NODES[pick]));
      if (curNode) describe(curNode);
      scr._wm = { timer, move: (d) => {
        const vis = NODES.map((n, i) => [n, i]).filter(([n]) => nodeVisited(g, n));
        const k = vis.findIndex(([, i]) => i === pick);
        const nx = vis[(k + d + vis.length) % vis.length];
        pick = nx[1];
        describe(nx[0]);
      }, go: () => {
        const n = NODES[pick];
        if (canFly && n.fly && g.state.fastTravel.includes(n.fly) && n.maps.some(mapExists) && nodeVisited(g, n)) travel(n);
      } };
    }, { onAction: (a) => {
      const s = [...document.querySelectorAll(".screen")].pop();
      const b = s?._wm;
      if (!b) return false;
      if (a === "up" || a === "left") {
        b.move(-1);
        return true;
      }
      if (a === "down" || a === "right") {
        b.move(1);
        return true;
      }
      if (a === "confirm") {
        b.go();
        return true;
      }
      return false;
    } }).then((r) => {
      document.querySelectorAll(".screen").forEach(() => {
      });
      return result;
    });
  }

  // src/screens/wardrobe.js
  var COSMETICS = {};
  var C2 = (id, kind, name, o) => {
    COSMETICS[id] = { id, kind, name, ...o };
  };
  for (const [v, n] of HATS) if (!["crown", "laurel", "tophat"].includes(v)) C2("hat:" + v, "hat", n, { start: true, apply: (l) => {
    l.hat = v;
  } });
  for (const [v, n] of OUTFITS) C2("outfit:" + v, "outfit", n, { start: v !== "uniform" && v !== "coat", price: v === "coat" ? 1500 : 0, apply: (l) => {
    l.outfit = v;
  } });
  for (const [v, n] of HAIR_STYLES) C2("hair:" + v, "hair", n, { start: true, apply: (l) => {
    l.hair = v;
  } });
  C2("hat:crown", "hat", "Corona dorada", { apply: (l) => {
    l.hat = "crown";
  }, how: "Logro: Ocho medallas" });
  C2("hat:laurel", "hat", "Corona de laurel", { apply: (l) => {
    l.hat = "laurel";
  }, how: "Logro: Campe\xF3n de torneo" });
  C2("hat:tophat", "hat", "Chistera", { apply: (l) => {
    l.hat = "tophat";
  }, how: "Logro: Fortuna" });
  C2("bag:aventurero", "acc", "Mochila dorada", { apply: (l) => {
    l.bag = "#e0b83a";
  }, how: "Logro: Trotamundos" });
  C2("bag:plata", "acc", "Mochila plateada", { apply: (l) => {
    l.bag = "#b8c4d4";
  }, price: 1200 });
  C2("bag:none", "acc", "Sin mochila", { start: true, apply: (l) => {
    l.bag = null;
  } });
  C2("bag:basica", "acc", "Mochila roja", { start: true, apply: (l) => {
    l.bag = "#d84a4a";
  } });
  C2("scarf:rojo", "acc", "Bufanda roja", { apply: (l) => {
    l.scarf = "#d84a4a";
  }, how: "Logro: Manos a la obra" });
  C2("scarf:azul", "acc", "Bufanda azul", { apply: (l) => {
    l.scarf = "#4a7ad8";
  }, price: 800 });
  C2("scarf:none", "acc", "Sin bufanda", { start: true, apply: (l) => {
    l.scarf = null;
  } });
  C2("glasses:none", "acc", "Sin gafas", { start: true, apply: (l) => {
    l.glasses = false;
  } });
  C2("glasses:normal", "acc", "Gafas", { start: true, apply: (l) => {
    l.glasses = true;
  } });
  C2("glasses:corazon", "acc", "Gafas de coraz\xF3n", { apply: (l) => {
    l.glasses = true;
    l.heartGlasses = true;
  }, how: "Logro: Mejores amigos" });
  C2("effect:none", "effect", "Sin efecto", { start: true, effect: null });
  C2("effect:estrellas", "effect", "Estela de estrellas", { effect: "estrellas", how: "Logro: Enciclopedista" });
  C2("effect:aura", "effect", "Aura luminosa", { effect: "aura", how: "Logro: Cazador de leyendas" });
  C2("effect:destellos", "effect", "Destellos", { effect: "destellos", how: "Logro: Destello" });
  C2("effect:rayos", "effect", "Chispas el\xE9ctricas", { effect: "rayos", how: "Logro: Bajo la tormenta" });
  C2("effect:petalos", "effect", "P\xE9talos al caminar", { effect: "petalos", price: 4e3 });
  C2("ball:normal", "ball", "C\xE1psula cl\xE1sica", { start: true, ball: "normal" });
  C2("ball:estrella", "ball", "C\xE1psula estrellada", { ball: "estrella", price: 3e3 });
  C2("ball:fuego", "ball", "C\xE1psula \xEDgnea", { ball: "fuego", price: 3e3 });
  C2("ball:hielo", "ball", "C\xE1psula helada", { ball: "hielo", price: 3e3 });
  C2("ball:arcoiris", "ball", "C\xE1psula arco\xEDris", { ball: "arcoiris", how: "Logro: Arco iris" });
  var hasCosmetic = (g, id) => COSMETICS[id]?.start || g.state.wardrobe.unlocked.includes(id);
  function unlockCosmetic(g, id) {
    if (!COSMETICS[id] || hasCosmetic(g, id)) return false;
    g.state.wardrobe.unlocked.push(id);
    g.ui.toast(`\u{1F455} Nuevo cosm\xE9tico: <b>${COSMETICS[id].name}</b>`);
    g.emit("cosmetic", { id });
    return true;
  }
  function installCosmetics(g) {
    g.unlockCosmetic = (id) => unlockCosmetic(g, id);
  }
  function openWardrobe(g) {
    const st = g.state, look2 = st.player.look;
    return g.ui.openScreen("Armario", (close, scr) => {
      const KINDS = [["hat", "Sombreros"], ["outfit", "Ropa"], ["hair", "Peinados"], ["acc", "Accesorios"], ["color", "Colores"], ["effect", "Efectos"], ["ball", "C\xE1psulas"]];
      let kind = "hat", sel = 0, dir = 0;
      const dirs = ["down", "right", "up", "left"];
      const preview = el("canvas", { width: 16, height: 24, style: { width: "192px", height: "288px", imageRendering: "pixelated" } });
      const tabs = el("div", { class: "tabs" }), list = el("div", { class: "col scroll", style: { gap: "2px", width: "420px" } }), note = el("div", { class: "small dim", style: { marginTop: "6px", minHeight: "34px" } });
      scr.body.append(el("div", { class: "panel col", style: { alignItems: "center", width: "260px" } }, [preview, el("div", { class: "row" }, [el("button", { class: "btn", onclick: () => {
        dir = (dir + 3) % 4;
        draw2();
      } }, "\u27F2"), el("button", { class: "btn", onclick: () => {
        dir = (dir + 1) % 4;
        draw2();
      } }, "\u27F3")])]), el("div", { class: "col", style: { width: "440px" } }, [tabs, list, note]), el("div", { class: "panel grow col" }, [el("div", { class: "title" }, "Tu estilo"), el("div", { class: "dim small" }, "Los cosm\xE9ticos son opcionales: no hacen falta para progresar. Se consiguen con logros, misiones y en la Boutique de Ciudad D\xEDnamo.")]));
      const draw2 = () => {
        const g2 = preview.getContext("2d");
        g2.clearRect(0, 0, 16, 24);
        g2.drawImage(trainerCanvas(look2, dirs[dir], 0), 0, 0);
      };
      const items = () => {
        if (kind === "color") return [...OUTFIT_COLORS.map((c, i) => ({ id: "top:" + i, name: "Ropa \xB7 color " + (i + 1), swatch: c, set: () => {
          look2.top = i;
        } })), ...PANTS_COLORS.map((c, i) => ({ id: "bot:" + i, name: "Pantal\xF3n \xB7 color " + (i + 1), swatch: c, set: () => {
          look2.bottom = i;
        } })), ...HAIR_COLORS.map((c, i) => ({ id: "hc:" + i, name: "Pelo \xB7 color " + (i + 1), swatch: c, set: () => {
          look2.hairColor = i;
        } })), ...SKINS.map((c, i) => ({ id: "sk:" + i, name: "Piel \xB7 tono " + (i + 1), swatch: c, set: () => {
          look2.skin = i;
        } }))].map((x) => ({ ...x, own: true }));
        return Object.values(COSMETICS).filter((c) => c.kind === kind).map((c) => ({ ...c, own: hasCosmetic(g, c.id) }));
      };
      const equipped = (c) => {
        if (kind === "effect") return (st.cosmetic.effect || null) === (c.effect ?? null);
        if (kind === "ball") return (st.cosmetic.ballDesign || "normal") === c.ball;
        if (kind === "color" || !c.apply) return false;
        const t = { ...look2 };
        c.apply(t);
        return JSON.stringify(t) === JSON.stringify(look2);
      };
      const render2 = () => {
        tabs.innerHTML = "";
        KINDS.forEach(([k, t]) => tabs.append(el("div", { class: "tab" + (k === kind ? " on" : ""), onclick: () => {
          kind = k;
          sel = 0;
          render2();
        } }, t)));
        const its = items();
        if (sel >= its.length) sel = 0;
        list.innerHTML = "";
        its.forEach((c, i) => {
          const row = el("div", { class: "mi" + (i === sel ? " sel" : "") + (c.own ? "" : " off"), style: { opacity: c.own ? 1 : 0.65 } }, [c.swatch ? el("span", { style: { width: "20px", height: "20px", borderRadius: "4px", background: c.swatch, border: "2px solid #fff" } }) : null, el("span", {}, c.name), el("span", { class: "hint" }, equipped(c) ? "\u2714 puesto" : c.own ? "" : c.price ? `\u{1F512} ${fmtMoney(c.price)} (Boutique)` : "\u{1F512} " + (c.how || ""))]);
          row.addEventListener("click", () => {
            sel = i;
            choose(c);
            render2();
          });
          row.addEventListener("mouseenter", () => {
            if (sel !== i) {
              sel = i;
              render2();
            }
          });
          list.append(row);
        });
        const cur = its[sel];
        note.textContent = cur ? cur.own ? "" : cur.price ? `Se vende en la Boutique de Ciudad D\xEDnamo por ${fmtMoney(cur.price)}.` : `Se desbloquea: ${cur.how || ""}` : "";
        draw2();
      };
      const choose = (c) => {
        if (!c.own) {
          g.audio.sfx("error");
          return;
        }
        g.audio.sfx("confirm");
        if (c.set) c.set();
        else if (kind === "effect") st.cosmetic.effect = c.effect;
        else if (kind === "ball") st.cosmetic.ballDesign = c.ball;
        else if (c.apply) c.apply(look2);
        g.state.player.look = look2;
        if (g.ow?.player) g.ow.player.look = look2;
      };
      render2();
      scr._w = { move: (d) => {
        const n = items().length;
        sel = (sel + d + n) % n;
        render2();
      }, tab: (d) => {
        const i = KINDS.findIndex(([k]) => k === kind);
        kind = KINDS[(i + d + KINDS.length) % KINDS.length][0];
        sel = 0;
        render2();
      }, pick: () => {
        choose(items()[sel]);
        render2();
      } };
    }, { onAction: (a) => {
      const s = [...document.querySelectorAll(".screen")].pop();
      const b = s?._w;
      if (!b) return false;
      if (a === "up") {
        b.move(-1);
        return true;
      }
      if (a === "down") {
        b.move(1);
        return true;
      }
      if (a === "left") {
        b.tab(-1);
        return true;
      }
      if (a === "right") {
        b.tab(1);
        return true;
      }
      if (a === "confirm") {
        b.pick();
        return true;
      }
      return false;
    } });
  }

  // src/screens/menu.js
  var GameMenu = class {
    constructor(g) {
      this.g = g;
    }
    async open() {
      const g = this.g;
      for (; ; ) {
        const items = [
          { label: "\u{1F4D6} Enciclopedia", value: "dex", hint: `${Object.keys(g.dex.caught).length}/${Object.keys(SPECIES).length}` },
          { label: "\u{1F43E} Equipo", value: "party" },
          { label: "\u{1F392} Mochila", value: "bag" },
          { label: "\u{1FAAA} Perfil", value: "profile" },
          { label: "\u{1F4DC} Misiones", value: "quests" },
          { label: "\u{1F5FA} Mapa", value: "map" },
          { label: "\u{1F455} Armario", value: "wardrobe" },
          { label: "\u{1F4BE} Guardar", value: "save", disabled: !!g.ow?.map?.noSave },
          { label: "\u2699 Opciones", value: "options" },
          { label: "\u{1F6AA} Salir al t\xEDtulo", value: "quit" }
        ];
        const pick = await g.ui.menu(items, { panel: true, cancel: null, style: { position: "absolute", right: "24px", top: "24px", width: "270px" } });
        if (pick == null) return;
        if (pick === "dex") await openDex(g);
        else if (pick === "party") await openParty(g);
        else if (pick === "bag") {
          const r = await openBag(g);
          if (r === "closeAll") return;
        } else if (pick === "profile") await openProfile(g);
        else if (pick === "quests") await openQuests(g);
        else if (pick === "map") {
          const r = await openWorldMap(g);
          if (r === "closeAll") return;
        } else if (pick === "wardrobe") await openWardrobe(g);
        else if (pick === "save") await openSave(g);
        else if (pick === "options") await openOptions(g);
        else if (pick === "quit") {
          if (await g.yesNo("\xBFSalir al t\xEDtulo? Se perder\xE1 el progreso no guardado.")) {
            g.quitRequested = true;
            return;
          }
        }
      }
    }
  };
  function pickCreature(g, title, { filter = null, hintFn = null } = {}) {
    return new Promise((resolve2) => {
      const items = g.party.map((c, i) => ({ label: `${displayName(c)} Nv${c.lv}`, value: i, icon: creatureImg(c.sp, 34, c.variant), hint: hintFn ? hintFn(c) : c.egg ? "Huevo" : `${c.hp}/${c.maxHp}`, disabled: filter ? !filter(c) : false }));
      const wrap = el("div", { class: "panel", style: { position: "absolute", left: "250px", top: "60px", width: "460px", zIndex: 45 } }, [el("div", { class: "title" }, title)]);
      g.ui.root.append(wrap);
      g.ui.menu(items, { parent: wrap, cancel: null }).then((r) => {
        wrap.remove();
        resolve2(r);
      });
    });
  }
  async function openParty(g) {
    await g.ui.openScreen("Equipo", (close, scr) => {
      const left = el("div", { class: "col", style: { width: "340px", gap: "6px" } }), right = el("div", { class: "panel scroll grow" });
      scr.body.append(left, right);
      let sel = 0, swapFrom = null;
      const render2 = () => {
        left.innerHTML = "";
        g.party.forEach((c, i) => {
          const n = el("div", { class: "card" + (i === sel ? " sel" : ""), style: swapFrom === i ? { outline: "2px dashed #6ad8ff" } : {} }, creatureCard(c, { size: 52 }));
          n.addEventListener("click", () => {
            sel = i;
            render2();
            actions();
          });
          n.addEventListener("mouseenter", () => {
            if (sel !== i) {
              sel = i;
              render2();
            }
          });
          left.append(n);
        });
        right.innerHTML = "";
        if (g.party[sel]) right.append(creatureDetail(g.party[sel]));
      };
      const actions = async () => {
        const c = g.party[sel];
        if (!c) return;
        if (swapFrom != null) {
          const a = swapFrom;
          swapFrom = null;
          if (a !== sel) {
            [g.party[a], g.party[sel]] = [g.party[sel], g.party[a]];
            g.audio.sfx("confirm");
          }
          render2();
          return;
        }
        const items = [{ label: "Cambiar de posici\xF3n", value: "swap" }, { label: "Ordenar movimientos", value: "moves", disabled: !!c.egg }, { label: "Ponerle mote", value: "nick", disabled: !!c.egg }, { label: "Cuidar (ver amistad)", value: "info", disabled: true }, { label: "Liberar", value: "release", disabled: !!c.egg }, { label: "Volver", value: null }].filter((x) => x.value !== "info");
        const pick = await g.ui.menu(items, { panel: true, cancel: null, style: { position: "absolute", left: "360px", top: "120px", width: "240px", zIndex: 50 } });
        if (pick === "swap") {
          swapFrom = sel;
          render2();
          g.ui.toast("Elige la posici\xF3n de destino");
        } else if (pick === "moves") {
          await reorderMoves(g, c);
          render2();
        } else if (pick === "nick") {
          const n = await g.ui.prompt("Mote (vac\xEDo para quitarlo)", c.nick || "", 12);
          if (n !== null) c.nick = n || null;
          render2();
        } else if (pick === "release") {
          const usable = g.party.filter((x) => canFight(x)).length;
          if (g.party.length <= 1 || canFight(c) && usable <= 1) {
            await g.ui.say("No puedes liberar a tu \xFAltima criatura en condiciones de luchar.");
            return;
          }
          if (await g.ui.yesNo(`\xBFLiberar a ${displayName(c)}? No podr\xE1s recuperarla.`)) {
            if (await g.ui.yesNo(`Esta decisi\xF3n es definitiva. \xBFDejar ir a ${displayName(c)}?`)) {
              g.party.splice(sel, 1);
              sel = Math.max(0, sel - 1);
              g.audio.sfx("flee");
              g.emit("release");
            }
          }
          render2();
        }
      };
      render2();
      scr._act = { move: (d) => {
        sel = (sel + d + g.party.length) % g.party.length;
        render2();
      }, confirm: actions };
      scr._onAction = null;
    }, { onAction: (a) => {
      const s = document.querySelector(".screen");
      if (!s?._act) return false;
      if (a === "up") {
        s._act.move(-1);
        return true;
      }
      if (a === "down") {
        s._act.move(1);
        return true;
      }
      if (a === "confirm") {
        s._act.confirm();
        return true;
      }
      return false;
    } });
  }
  async function reorderMoves(g, c) {
    let from = null;
    for (; ; ) {
      const items = c.moves.map((m, i) => ({ label: getMove(m.id).name + (from === i ? "  \u25C0 elegido" : ""), value: i, hint: `${m.pp}/${m.max}` }));
      items.push({ label: "Terminar", value: -1 });
      const r = await g.ui.menu(items, { title: from == null ? "Elige el movimiento a mover" : "Elige con cu\xE1l intercambiarlo", panel: true, cancel: -1, style: { position: "absolute", left: "300px", top: "110px", width: "360px", zIndex: 50 } });
      if (r === -1 || r == null) return;
      if (from == null) from = r;
      else {
        [c.moves[from], c.moves[r]] = [c.moves[r], c.moves[from]];
        from = null;
        g.audio.sfx("confirm");
      }
    }
  }
  async function openBag(g, { inBattle = false } = {}) {
    let result = null;
    await g.ui.openScreen("Mochila", (close, scr) => {
      let pocket = POCKET_ORDER[0], sel = 0, list = [];
      const tabs = el("div", { class: "tabs" }), listEl = el("div", { class: "col scroll", style: { width: "380px", gap: "2px" } }), desc = el("div", { class: "panel grow col" });
      scr.body.append(el("div", { class: "col", style: { width: "400px" } }, [tabs, listEl]), desc);
      const money = el("div", { class: "gold big", style: { marginLeft: "auto", marginRight: "14px" } });
      scr.head.insertBefore(money, scr.head.querySelector(".x"));
      const refresh = () => {
        money.textContent = "\u20B3 " + g.money.toLocaleString("es-ES");
        tabs.innerHTML = "";
        POCKET_ORDER.forEach((p) => {
          const n = bagList(g.bag, p).length;
          tabs.append(el("div", { class: "tab" + (p === pocket ? " on" : ""), onclick: () => {
            pocket = p;
            sel = 0;
            refresh();
          } }, `${POCKETS[p]}${n ? " " + n : ""}`));
        });
        list = bagList(g.bag, pocket);
        if (sel >= list.length) sel = Math.max(0, list.length - 1);
        listEl.innerHTML = "";
        if (!list.length) listEl.append(el("div", { class: "dim", style: { padding: "12px" } }, "Vac\xEDo"));
        list.forEach((x, i) => {
          const n = el("div", { class: "mi" + (i === sel ? " sel" : "") }, [el("span", {}, x.item.name), el("span", { class: "hint" }, x.item.fx.key ? "" : "\xD7" + x.n)]);
          n.addEventListener("click", () => {
            sel = i;
            refresh();
            useSelected();
          });
          n.addEventListener("mouseenter", () => {
            if (sel !== i) {
              sel = i;
              refresh();
            }
          });
          listEl.append(n);
        });
        desc.innerHTML = "";
        const cur = list[sel];
        if (cur) {
          const it = cur.item;
          desc.append(el("div", { class: "title" }, it.name), el("div", {}, it.desc), el("div", { class: "hr" }), el("div", { class: "dim small" }, `Categor\xEDa: ${POCKETS[it.pocket]}${it.price ? ` \xB7 Valor: ${fmtMoney(it.price)}${it.sell ? ` (venta ${fmtMoney(Math.floor(it.price / 2))})` : ""}` : ""}`), el("div", { class: "spacer" }), el("button", { class: "btn", onclick: useSelected }, usable(it) ? "Usar" : it.fx.key ? "Objeto clave" : "No utilizable aqu\xED"));
        } else desc.append(el("div", { class: "dim" }, "No hay objetos en esta categor\xEDa."));
      };
      const usable = (it) => it.use === "field" || it.use === "both" || it.fx.key === "bicicleta";
      const useSelected = async () => {
        const cur = list[sel];
        if (!cur) return;
        const it = cur.item;
        if (it.fx.key === "bicicleta") {
          const st = g.state.player;
          if (g.ow.map.indoor || g.ow.map.cave) {
            await g.ui.say("No puedes usar la bicicleta aqu\xED.");
            return;
          }
          st.biking = !st.biking;
          if (st.biking) st.surfing = false;
          g.audio.sfx("confirm");
          result = "closeAll";
          g.ui.toast(st.biking ? "Subes a la bicicleta" : "Bajas de la bicicleta");
          close();
          return;
        }
        if (!usable(it)) {
          g.audio.sfx("error");
          return;
        }
        const done = await useItemField(g, it);
        if (done === "closeAll") {
          result = "closeAll";
          close();
          return;
        }
        refresh();
      };
      refresh();
      scr._bag = { move: (d) => {
        if (list.length) {
          sel = (sel + d + list.length) % list.length;
          refresh();
        }
      }, tab: (d) => {
        const i = POCKET_ORDER.indexOf(pocket);
        pocket = POCKET_ORDER[(i + d + POCKET_ORDER.length) % POCKET_ORDER.length];
        sel = 0;
        refresh();
      }, use: useSelected };
    }, { onAction: (a) => {
      const s = [...document.querySelectorAll(".screen")].pop();
      const b = s?._bag;
      if (!b) return false;
      if (a === "up") {
        b.move(-1);
        return true;
      }
      if (a === "down") {
        b.move(1);
        return true;
      }
      if (a === "left") {
        b.tab(-1);
        return true;
      }
      if (a === "right") {
        b.tab(1);
        return true;
      }
      if (a === "confirm") {
        b.use();
        return true;
      }
      return false;
    } });
    return result;
  }
  async function useItemField(g, it) {
    const fx = it.fx;
    if (fx.repel) {
      g.state.repel = fx.repel;
      g.takeItem(it.id);
      g.audio.sfx("item");
      await g.ui.say(`Has usado ${it.name}. Los encuentros salvajes se reducir\xE1n durante ${fx.repel} pasos.`);
      return;
    }
    if (fx.escape) {
      if (!g.ow.map.cave) {
        await g.ui.say("Solo puedes usar esto dentro de una cueva.");
        return;
      }
      g.takeItem(it.id);
      const h = g.state.lastHeal;
      await g.ui.say("\xA1Has escapado de la cueva!");
      g.ow.busy = true;
      g.ui.fade(true, 250).then(async () => {
        await g.ow.loadMap(h.map, h.x, h.y, "down");
        await g.ui.fade(false, 250);
        g.ow.busy = false;
      });
      return "closeAll";
    }
    if (fx.tm) {
      const idx2 = await pickCreature(g, `\xBFA qui\xE9n ense\xF1ar ${getMove(fx.tm).name}?`, { filter: (c3) => !c3.egg, hintFn: (c3) => c3.egg ? "" : c3.moves.some((m) => m.id === fx.tm) ? "Ya lo sabe" : canLearnTM(c3.sp, fx.tm) ? "Compatible" : "No compatible" });
      if (idx2 == null) return;
      const c2 = g.party[idx2];
      if (c2.moves.some((m) => m.id === fx.tm)) {
        await g.ui.say(`${displayName(c2)} ya conoce ese movimiento.`);
        return;
      }
      if (!canLearnTM(c2.sp, fx.tm)) {
        await g.ui.say(`${displayName(c2)} no es compatible con ${getMove(fx.tm).name}.`);
        return;
      }
      c2.pendingMoves.push(fx.tm);
      await g.learnMoves(c2);
      return;
    }
    if (fx.evo) {
      const idx2 = await pickCreature(g, `\xBFA qui\xE9n usar ${it.name}?`, { filter: (c3) => !c3.egg });
      if (idx2 == null) return;
      const c2 = g.party[idx2];
      const ctx = { trigger: "item", item: it.id, isNight: g.isNight, tags: g.ow?.map?.tags || [], party: g.party, weather: g.ow?.weatherId };
      const r2 = findEvolution(c2, ctx);
      if (!r2) {
        await g.ui.say("No tendr\xEDa ning\xFAn efecto.");
        return;
      }
      g.takeItem(it.id);
      g.ui.root.querySelectorAll(".screen").forEach((s) => s.style.display = "none");
      await g.evolveNow(c2, r2.to, { allowCancel: true });
      g.ui.root.querySelectorAll(".screen").forEach((s) => s.style.display = "");
      return;
    }
    const idx = await pickCreature(g, `\xBFA qui\xE9n usar ${it.name}?`, { filter: (c2) => !c2.egg });
    if (idx == null) return;
    const c = g.party[idx];
    let moveIdx = 0;
    if (it.fx.pp === 10 || it.fx.pp === 99) {
      const mi = await g.ui.menu(c.moves.map((m, i) => ({ label: getMove(m.id).name, value: i, hint: `${m.pp}/${m.max}` })), { title: "\xBFQu\xE9 movimiento?", panel: true, cancel: null, style: { position: "absolute", left: "300px", top: "110px", width: "340px", zIndex: 60 } });
      if (mi == null) return;
      moveIdx = mi;
    }
    const r = useMedicine(it.id, c, { moveIdx, levelCap: g.levelCap });
    if (!r.ok) {
      g.audio.sfx("error");
      await g.ui.say(r.msg);
      return;
    }
    g.takeItem(it.id);
    g.audio.sfx(it.fx.xp || it.fx.lvUp ? "levelup" : "heal");
    await g.ui.say(r.msg);
    if (r.ups?.length) {
      for (const u of r.ups) await g.ui.say(`\xA1${displayName(c)} subi\xF3 al nivel ${u.lv}!`);
      if (c.pendingMoves.length) await g.learnMoves(c);
      c.pendingEvo = null;
      const evo = findEvolution(c, { trigger: "level", isNight: g.isNight, tags: g.ow?.map?.tags || [], party: g.party, weather: g.ow?.weatherId });
      if (evo) {
        g.ui.root.querySelectorAll(".screen").forEach((s) => s.style.display = "none");
        await g.evolveNow(c, evo.to, { allowCancel: true });
        g.ui.root.querySelectorAll(".screen").forEach((s) => s.style.display = "");
      }
    }
  }
  function openProfile(g) {
    const st = g.state, p = st.player;
    return g.ui.openScreen("Perfil del entrenador", (close, scr) => {
      const cv = el("canvas", { width: 16, height: 24, style: { width: "160px", height: "240px", imageRendering: "pixelated" } });
      const c = cv.getContext("2d");
      c.drawImage(trainerCanvas(p.look, "down", 0), 0, 0);
      const done = questList(g).filter((q2) => q2.status === "done").length;
      const ach = Object.keys(st.achievements).length;
      const chapter = g.state.flags.chapter_name || "Pr\xF3logo";
      const rows = [["Nombre", p.name], ["Tiempo jugado", fmtTime(p.playtime)], ["Dinero", fmtMoney(p.money)], ["Criaturas capturadas", `${Object.keys(st.dex.caught).length} / ${Object.keys(SPECIES).length}`], ["Criaturas vistas", Object.keys(st.dex.seen).length], ["Medallas", `${st.badges.length} / 8`], ["Misiones completadas", done], ["Progreso de la historia", chapter], ["Logros", `${ach} / ${Object.keys(ACHIEVEMENTS).length}`], ["Combates / victorias", `${st.stats.battles} / ${st.stats.wins}`], ["Pasos", st.stats.steps.toLocaleString("es-ES")], ["Evoluciones", st.stats.evolutions]];
      const badges = el("div", { class: "row", style: { flexWrap: "wrap", gap: "8px", marginTop: "6px" } }, BADGES.map((b) => {
        const has = st.badges.includes(b.id);
        return el("div", { title: has ? b.name : "???", style: { width: "46px", height: "46px", borderRadius: "50%", border: "3px solid " + (has ? "#f2d060" : "#44406a"), background: has ? b.color : "#1a1830", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", filter: has ? "none" : "grayscale(1) brightness(.5)" } }, has ? b.icon : "\xB7");
      }));
      const achList = el("div", { class: "col", style: { gap: "3px", maxHeight: "170px", overflow: "auto" } }, Object.values(ACHIEVEMENTS).map((a) => {
        const got = st.achievements[a.id];
        const pr = achievementProgress(g, a);
        return el("div", { class: "small", style: { opacity: got ? 1 : 0.55 } }, [got ? "\u{1F3C6} " : "\u25AB ", el("b", {}, a.name), " \u2014 ", a.desc, !got && pr ? el("span", { class: "dim" }, ` (${pr})`) : null]);
      }));
      scr.body.append(
        el("div", { class: "panel col", style: { alignItems: "center", width: "240px" } }, [cv, el("div", { class: "title" }, p.name), el("div", { class: "row" }, g.party.slice(0, 6).map((m) => creatureImg(m.sp, 34, m.variant)))]),
        el("div", { class: "panel grow col scroll" }, [el("table", { class: "t" }, rows.map(([a, b]) => el("tr", {}, [el("td", { class: "gold" }, a), el("td", {}, String(b))]))), el("div", { class: "title", style: { marginTop: "10px" } }, "Medallas"), badges, el("div", { class: "title", style: { marginTop: "10px" } }, "Logros"), achList])
      );
    });
  }
  function openQuests(g) {
    return g.ui.openScreen("Registro de misiones", (close, scr) => {
      let tab = "active";
      const left = el("div", { class: "col scroll", style: { width: "360px", gap: "4px" } }), right = el("div", { class: "panel grow scroll" }), tabs = el("div", { class: "tabs" });
      scr.body.append(el("div", { class: "col", style: { width: "380px" } }, [tabs, left]), right);
      let sel = 0, list = [];
      const render2 = () => {
        tabs.innerHTML = "";
        [["active", "En curso"], ["done", "Completadas"]].forEach(([k, t]) => tabs.append(el("div", { class: "tab" + (tab === k ? " on" : ""), onclick: () => {
          tab = k;
          sel = 0;
          render2();
        } }, t)));
        list = questList(g).filter((q3) => tab === "active" ? q3.status === "active" || q3.status === "ready" : q3.status === "done");
        list.sort((a, b) => (a.def.kind === "main" ? 0 : 1) - (b.def.kind === "main" ? 0 : 1));
        left.innerHTML = "";
        if (!list.length) left.append(el("div", { class: "dim", style: { padding: "12px" } }, tab === "active" ? "No tienes misiones activas. \xA1Habla con la gente!" : "A\xFAn no has completado ninguna."));
        list.forEach((q3, i) => left.append(el("div", { class: "card" + (i === sel ? " sel" : ""), onclick: () => {
          sel = i;
          render2();
        } }, [el("div", { class: "row" }, [el("span", { class: "chip", style: { background: q3.def.kind === "main" ? "#c8602a" : "#3a7ae0" } }, q3.def.kind === "main" ? "Principal" : "Secundaria"), el("b", {}, q3.def.name)])])));
        right.innerHTML = "";
        const q2 = list[sel];
        if (q2) {
          right.append(el("div", { class: "title" }, q2.def.name), el("div", {}, g.t(q2.def.desc)), el("div", { class: "hr" }), el("div", { class: "col", style: { gap: "4px" } }, q2.def.objectives.map((o, i) => {
            const pr = q2.prog[i] || 0;
            const ok = pr >= (o.n || 1);
            return el("div", { class: ok ? "good" : "" }, `${ok ? "\u2714" : "\u25CB"} ${g.t(o.text)}${(o.n || 1) > 1 ? ` (${Math.min(pr, o.n)}/${o.n})` : ""}`);
          })), el("div", { class: "hr" }), el("div", { class: "small" }, [el("b", { class: "gold" }, "Recompensa: "), rewardText(q2.def.reward)]), q2.status === "ready" ? el("div", { class: "warn", style: { marginTop: "6px" } }, "\xA1Objetivos cumplidos! Vuelve con quien te la encarg\xF3.") : null);
        } else right.append(el("div", { class: "dim" }, "Selecciona una misi\xF3n."));
      };
      render2();
      scr._q = { move: (d) => {
        if (list.length) {
          sel = (sel + d + list.length) % list.length;
          render2();
        }
      }, tab: () => {
        tab = tab === "active" ? "done" : "active";
        sel = 0;
        render2();
      } };
    }, { onAction: (a) => {
      const s = [...document.querySelectorAll(".screen")].pop();
      const b = s?._q;
      if (!b) return false;
      if (a === "up") {
        b.move(-1);
        return true;
      }
      if (a === "down") {
        b.move(1);
        return true;
      }
      if (a === "left" || a === "right") {
        b.tab();
        return true;
      }
      return false;
    } });
  }
  function rewardText(r) {
    if (!r) return "\u2014";
    const parts = [];
    if (r.money) parts.push(fmtMoney(r.money));
    if (r.items) for (const [id, n] of Object.entries(r.items)) parts.push(`${n} \xD7 ${ITEMS[id]?.name || id}`);
    if (r.xp) parts.push(`${r.xp} exp. al equipo`);
    if (r.text) parts.push(r.text);
    return parts.join(", ") || "\u2014";
  }
  async function openSave(g) {
    const slots = Save.list();
    const items = slots.map((s2) => ({ label: `Ranura ${s2.slot}${g.slot === s2.slot ? " (activa)" : ""}`, value: s2.slot, hint: s2.empty ? "vac\xEDa" : s2.corrupt ? "da\xF1ada" : `${s2.summary.name} \xB7 ${fmtTime(s2.summary.playtime)}` }));
    const pick = await g.ui.menu(items, { title: "Guardar partida", panel: true, cancel: null, index: g.slot - 1, style: { position: "absolute", left: "240px", top: "130px", width: "480px", zIndex: 50 } });
    if (pick == null) return;
    const s = slots[pick - 1];
    if (!s.empty && pick !== g.slot) {
      if (!await g.ui.yesNo(`La ranura ${pick} contiene otra partida. \xBFSobrescribirla?`)) return;
    }
    const ok = g.save(pick);
    if (ok) await g.ui.say("\xA1Partida guardada!");
  }

  // src/screens/shop.js
  function openShop(g, shopId) {
    const shop = SHOPS[shopId] || SHOPS.general;
    return g.ui.openScreen(shop.name, (close, scr) => {
      let mode = "buy", sel = 0, qty = 1, list = [];
      const tabs = el("div", { class: "tabs" }), listEl = el("div", { class: "col scroll", style: { gap: "2px", width: "420px" } }), desc = el("div", { class: "panel grow col" });
      const money = el("div", { class: "gold big", style: { marginLeft: "auto", marginRight: "14px" } });
      scr.head.insertBefore(money, scr.head.querySelector(".x"));
      scr.body.append(el("div", { class: "col", style: { width: "440px" } }, [tabs, listEl]), desc);
      const entries = () => mode === "buy" ? shopStock(shopId, g.badges.length).map((id) => ({ id, price: getItem(id).price, item: getItem(id) })) : bagList(g.bag).filter((x) => x.item.sell).map((x) => ({ id: x.item.id, price: Math.floor(x.item.price / 2), item: x.item, n: x.n }));
      const render2 = () => {
        money.textContent = "\u20B3 " + g.money.toLocaleString("es-ES");
        tabs.innerHTML = "";
        [["buy", "Comprar"], ["sell", "Vender"]].forEach(([k, t]) => tabs.append(el("div", { class: "tab" + (mode === k ? " on" : ""), onclick: () => {
          mode = k;
          sel = 0;
          qty = 1;
          render2();
        } }, t)));
        list = entries();
        if (sel >= list.length) sel = Math.max(0, list.length - 1);
        listEl.innerHTML = "";
        if (!list.length) listEl.append(el("div", { class: "dim", style: { padding: "12px" } }, mode === "buy" ? "No hay nada a la venta ahora mismo." : "No tienes objetos vendibles."));
        list.forEach((e, i) => {
          const row = el("div", { class: "mi" + (i === sel ? " sel" : "") + (mode === "buy" && e.price > g.money ? " off" : "") }, [el("span", {}, e.item.name), el("span", { class: "hint" }, `${mode === "sell" ? "\xD7" + e.n + "  " : "tienes " + bagCount(g.bag, e.id) + "  "}${fmtMoney(e.price)}`)]);
          row.addEventListener("click", () => {
            sel = i;
            qty = 1;
            render2();
            doTx();
          });
          row.addEventListener("mouseenter", () => {
            if (sel !== i) {
              sel = i;
              qty = 1;
              render2();
            }
          });
          listEl.append(row);
        });
        desc.innerHTML = "";
        const cur = list[sel];
        if (cur) {
          const max = mode === "buy" ? Math.max(1, Math.min(99 - bagCount(g.bag, cur.id), Math.floor(g.money / Math.max(1, cur.price)) || 1)) : cur.n;
          qty = Math.max(1, Math.min(qty, max));
          desc.append(el("div", { class: "title" }, cur.item.name), el("div", {}, cur.item.desc), el("div", { class: "small dim" }, POCKETS[cur.item.pocket]), el("div", { class: "hr" }), el("div", { class: "row" }, [el("span", {}, "Cantidad:"), el("button", { class: "btn", onclick: () => {
            qty = Math.max(1, qty - 1);
            render2();
          } }, "\u2212"), el("b", { class: "big" }, String(qty)), el("button", { class: "btn", onclick: () => {
            qty = Math.min(max, qty + 1);
            render2();
          } }, "+"), el("button", { class: "btn", onclick: () => {
            qty = Math.min(max, qty + 10);
            render2();
          } }, "+10")]), el("div", { style: { marginTop: "8px" } }, `Total: ${fmtMoney(cur.price * qty)}`), el("div", { class: "spacer" }), el("button", { class: "btn", onclick: doTx }, mode === "buy" ? "Comprar" : "Vender"));
        }
      };
      const doTx = async () => {
        const cur = list[sel];
        if (!cur) return;
        const total = cur.price * qty;
        if (mode === "buy") {
          if (g.money < total) {
            g.audio.sfx("error");
            g.ui.toast("No tienes suficiente dinero.");
            return;
          }
          if (bagCount(g.bag, cur.id) + qty > 99) {
            g.audio.sfx("error");
            g.ui.toast("No puedes llevar m\xE1s de 99.");
            return;
          }
          g.spend(total);
          await g.giveItem(cur.id, qty, { quiet: true });
          g.audio.sfx("coin");
          g.ui.toast(`Compraste ${qty} \xD7 ${cur.item.name}`);
          g.emit("buy", { id: cur.id, n: qty });
        } else {
          if (!await g.ui.yesNo(`\xBFVender ${qty} \xD7 ${cur.item.name} por ${fmtMoney(total)}?`)) return;
          g.takeItem(cur.id, qty);
          g.addMoney(total);
          g.audio.sfx("coin");
          g.ui.toast(`Vendiste ${qty} \xD7 ${cur.item.name}: +${fmtMoney(total)}`);
          g.emit("sell", { id: cur.id, n: qty });
        }
        render2();
      };
      render2();
      scr._s = { move: (d) => {
        if (list.length) {
          sel = (sel + d + list.length) % list.length;
          qty = 1;
          render2();
        }
      }, qty: (d) => {
        qty = Math.max(1, qty + d);
        render2();
      }, tab: () => {
        mode = mode === "buy" ? "sell" : "buy";
        sel = 0;
        qty = 1;
        render2();
      }, tx: doTx };
    }, { onAction: (a) => {
      const s = [...document.querySelectorAll(".screen")].pop();
      const b = s?._s;
      if (!b) return false;
      if (a === "up") {
        b.move(-1);
        return true;
      }
      if (a === "down") {
        b.move(1);
        return true;
      }
      if (a === "left") {
        b.qty(-1);
        return true;
      }
      if (a === "right") {
        b.qty(1);
        return true;
      }
      if (a === "run") {
        b.tab();
        return true;
      }
      if (a === "confirm") {
        b.tx();
        return true;
      }
      return false;
    } });
  }

  // src/screens/pc.js
  init_config();
  var COLS = 6;
  function openPC(g) {
    const st = g.state;
    return g.ui.openScreen("Almacenamiento de criaturas", (close, scr) => {
      let box = 0, area = "box", cur = 0, held = null;
      const partyEl = el("div", { class: "col", style: { gap: "4px", width: "200px" } }), gridEl = el("div", { style: { display: "grid", gridTemplateColumns: `repeat(${COLS},64px)`, gap: "4px" } });
      const boxName = el("div", { class: "title", style: { margin: 0, flex: 1, textAlign: "center", cursor: "pointer" } });
      const nav = el("div", { class: "row" }, [el("button", { class: "btn", onclick: () => chBox(-1) }, "\u25C0"), boxName, el("button", { class: "btn", onclick: () => chBox(1) }, "\u25B6")]);
      const info = el("div", { class: "panel scroll", style: { width: "330px" } }), hint = el("div", { class: "small dim", style: { marginTop: "4px" } }, "Enter: coger/soltar \xB7 Esc: devolver/cerrar \xB7 Tab: caja siguiente \xB7 Shift: caja anterior \xB7 clic en el nombre: renombrar");
      scr.body.append(el("div", { class: "panel col", style: { width: "224px" } }, [el("div", { class: "title", style: { fontSize: "16px" } }, "Equipo"), partyEl]), el("div", { class: "panel col grow", style: { alignItems: "center" } }, [nav, gridEl, hint]), info);
      const chBox = (d) => {
        box = (box + d + BOX_COUNT) % BOX_COUNT;
        g.audio.sfx("select");
        render2();
      };
      boxName.addEventListener("click", async () => {
        const n = await g.ui.prompt("Nombre de la caja", st.boxNames[box], 12);
        if (n) {
          st.boxNames[box] = n;
          render2();
        }
      });
      const slotOf = (a, b, i) => a === "party" ? g.party[i] : st.boxes[b][i];
      const setSlot = (a, b, i, c) => {
        if (a === "party") {
          if (c) g.party[i] = c;
          else g.party.splice(i, 1);
        } else st.boxes[b][i] = c;
      };
      const mk2 = (c, sel, a, i) => {
        const d = el("div", { class: "card" + (sel ? " sel" : ""), style: { width: a === "party" ? "100%" : "64px", height: a === "party" ? "52px" : "64px", padding: "2px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: held && held.from.area === a && held.from.idx === i && (a === "party" || held.from.box === box) ? 0.35 : 1 } });
        if (c) {
          d.append(creatureImg(c.sp, a === "party" ? 44 : 54, c.variant));
          if (a === "party") d.append(el("div", { class: "small" }, [el("b", {}, displayName(c)), el("div", { class: "dim" }, c.egg ? "Huevo" : `Nv${c.lv} \xB7 ${c.hp}/${c.maxHp}`)]));
          else if (c.hp === 0 && !c.egg) d.style.filter = "grayscale(.8)";
        }
        d.addEventListener("mouseenter", () => {
          area = a;
          cur = i;
          render2(false);
        });
        d.addEventListener("click", () => {
          area = a;
          cur = i;
          act();
        });
        return d;
      };
      const render2 = (full = true) => {
        boxName.textContent = `${st.boxNames[box]}  (${st.boxes[box].filter(Boolean).length}/${BOX_SIZE})`;
        partyEl.innerHTML = "";
        for (let i = 0; i < PARTY_MAX; i++) partyEl.append(mk2(g.party[i], area === "party" && cur === i, "party", i));
        gridEl.innerHTML = "";
        for (let i = 0; i < BOX_SIZE; i++) gridEl.append(mk2(st.boxes[box][i], area === "box" && cur === i, "box", i));
        info.innerHTML = "";
        if (held) info.append(el("div", { class: "warn", style: { marginBottom: "6px" } }, `En la mano: ${displayName(held.c)}`));
        const c = slotOf(area, box, cur);
        info.append(c ? creatureDetail(c) : el("div", { class: "dim" }, area === "party" && cur >= g.party.length ? "Hueco libre del equipo" : "Hueco vac\xEDo"));
      };
      const fighters = (excl) => g.party.filter((c, i) => c !== excl && canFight(c)).length;
      const act = async () => {
        const c = slotOf(area, box, cur);
        if (!held) {
          if (!c) return;
          g.audio.sfx("select");
          const items = [{ label: "Coger", value: "pick" }, { label: "Liberar", value: "release", disabled: !!c.egg }, { label: "Cancelar", value: null }];
          const r = await g.ui.menu(items, { panel: true, cancel: null, style: { position: "absolute", left: "420px", top: "200px", width: "200px", zIndex: 60 } });
          if (r === "pick") held = { c, from: { area, box, idx: cur } };
          else if (r === "release") {
            if (area === "party" && (g.party.length <= 1 || canFight(c) && fighters(c) === 0)) {
              await g.ui.say("No puedes liberar a tu \xFAltima criatura en condiciones de luchar.");
            } else if (await g.ui.yesNo(`\xBFLiberar a ${displayName(c)}? No podr\xE1s recuperarla.`) && await g.ui.yesNo("Esta decisi\xF3n es definitiva. \xBFConfirmas?")) {
              setSlot(area, box, cur, null);
              g.audio.sfx("flee");
              g.emit("release");
            }
          }
          render2();
          return;
        }
        const from = held.from, target = slotOf(area, box, cur);
        if (area === "party" && cur >= g.party.length) cur = g.party.length;
        if (area === "party" && g.party.length >= PARTY_MAX && !target) {
          g.audio.sfx("error");
          g.ui.toast("El equipo est\xE1 completo.");
          return;
        }
        const wouldLeaveParty = from.area === "party" && area === "box";
        if (wouldLeaveParty) {
          const remaining = g.party.filter((x) => x !== held.c);
          const after = target && target !== held.c ? [...remaining, target] : remaining;
          if (!after.some((x) => canFight(x))) {
            g.audio.sfx("error");
            g.ui.toast("Tu equipo debe conservar al menos una criatura en condiciones de luchar.");
            return;
          }
        }
        const origC = held.c;
        if (from.area === "party") {
          const i = g.party.indexOf(origC);
          if (area === "party") {
            const j = Math.min(cur, g.party.length - 1);
            [g.party[i], g.party[j]] = [g.party[j], g.party[i]];
          } else {
            if (target) g.party[i] = target;
            else g.party.splice(i, 1);
            st.boxes[box][cur] = origC;
          }
        } else {
          if (area === "party") {
            if (target) {
              g.party[cur] = origC;
              st.boxes[from.box][from.idx] = target;
            } else {
              g.party.push(origC);
              st.boxes[from.box][from.idx] = null;
            }
          } else {
            st.boxes[from.box][from.idx] = target || null;
            st.boxes[box][cur] = origC;
          }
        }
        held = null;
        g.audio.sfx("confirm");
        render2();
      };
      render2();
      scr._pc = {
        move: (a) => {
          if (a === "up") {
            if (cur - (area === "box" ? COLS : 1) >= 0) cur -= area === "box" ? COLS : 1;
          } else if (a === "down") {
            if (area === "box") {
              if (cur + COLS < BOX_SIZE) cur += COLS;
            } else if (cur < PARTY_MAX - 1) cur++;
          } else if (a === "left") {
            if (area === "box") {
              if (cur % COLS === 0) {
                area = "party";
                cur = Math.min(Math.floor(cur / COLS), PARTY_MAX - 1);
              } else cur--;
            }
          } else if (a === "right") {
            if (area === "party") {
              area = "box";
              cur = Math.min(cur, 4) * COLS;
            } else if (cur % COLS < COLS - 1) cur++;
          }
          render2();
        },
        act,
        box: chBox,
        cancel: () => {
          if (held) {
            held = null;
            g.audio.sfx("cancel");
            render2();
            return true;
          }
          return false;
        }
      };
    }, { cancelClose: false, onAction: (a, rep, close) => {
      const s = [...document.querySelectorAll(".screen")].pop();
      const b = s?._pc;
      if (!b) return false;
      if (["up", "down", "left", "right"].includes(a)) {
        b.move(a);
        return true;
      }
      if (a === "confirm") {
        b.act();
        return true;
      }
      if (a === "menu") {
        b.box(1);
        return true;
      }
      if (a === "run") {
        b.box(-1);
        return true;
      }
      if (a === "cancel") {
        if (!b.cancel()) {
          g.audio.sfx("cancel");
          close(null);
        }
        return true;
      }
      return false;
    } });
  }

  // src/battle.js
  init_rng();

  // src/capture.js
  var STATUS_MULT = { dormido: 2, congelado: 2, paralizado: 1.5, quemado: 1.5, envenenado: 1.5 };
  function ballMultiplier(ballId, mon, ctx = {}) {
    const b = getItem(ballId).fx.ball;
    if (!b) throw new Error("No es una c\xE1psula: " + ballId);
    if (b.master) return 255;
    const s = getSpecies(mon.sp);
    switch (b.cond) {
      case "red":
        return s.types.some((t) => t === "agua" || t === "insecto") ? 3.5 : 1;
      case "noche":
        return ctx.isNight || ctx.cave ? 3 : 1;
      case "veloz":
        return (ctx.turn || 1) <= 1 ? 4 : 1;
      case "atlas":
        return ctx.alreadyCaught ? 1 : 3.5;
      default:
        return b.mult;
    }
  }
  function levelModifier(lv) {
    return lv < 20 ? 1 + (20 - lv) / 50 : Math.max(0.6, 1 - (lv - 20) / 200);
  }
  function captureValue(mon, ballId, ctx = {}) {
    const s = getSpecies(mon.sp);
    if (getItem(ballId).fx.ball.master) return 255;
    const hpFactor = (3 * mon.maxHp - 2 * mon.hp) / (3 * mon.maxHp);
    const status = mon.status ? STATUS_MULT[mon.status] || 1 : 1;
    const a = hpFactor * s.cr * ballMultiplier(ballId, mon, ctx) * status * levelModifier(mon.lv);
    return clamp(Math.floor(a), 1, 255);
  }
  function rollCapture(rng, mon, ballId, ctx = {}) {
    const a = captureValue(mon, ballId, ctx);
    if (a >= 255) return { caught: true, shakes: 3, a };
    const p = Math.pow(a / 255, 0.25);
    let shakes = 0;
    for (let i = 0; i < 4; i++) {
      if (rng.next() < p) {
        if (i < 3) shakes++;
        else return { caught: true, shakes: 3, a };
      } else return { caught: false, shakes, a };
    }
    return { caught: false, shakes, a };
  }

  // src/damage.js
  var stageMult = (s) => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
  var accMult = (s) => s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
  var CRIT_CHANCE = [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2];
  function freshVolatile() {
    return {
      stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 },
      confuse: 0,
      flinch: false,
      protect: false,
      protectN: 0,
      charging: null,
      recharge: false,
      leech: false,
      shield: 0,
      shieldTurns: 0,
      lastMove: null,
      turnsOut: 0
    };
  }
  var abilityOf = (mon) => mon.ability ? ABILITIES[mon.ability] || null : null;
  var typesOf = (mon) => getSpecies(mon.sp).types;
  var SAND_IMMUNE = ["roca", "tierra", "metal"];
  function weatherImmune(mon, weatherId) {
    const t = typesOf(mon), ab = abilityOf(mon);
    if (ab?.sandImmune && weatherId === "arena") return true;
    if (weatherId === "arena") return t.some((x) => SAND_IMMUNE.includes(x));
    if (weatherId === "granizo") return t.includes("hielo");
    return true;
  }
  function effStat(mon, v, stat, weather, opts = {}) {
    let val = mon.stats[stat];
    let st = v.stages[stat] || 0;
    if (opts.ignoreStages) st = 0;
    val *= stageMult(st);
    const ab = abilityOf(mon);
    if (stat === "spe") {
      if (mon.status === "paralizado") val *= 0.5;
      if (ab?.weatherSpeed && weather && ab.weatherSpeed[weather.id]) val *= ab.weatherSpeed[weather.id];
    }
    if (stat === "atk" && mon.status === "quemado") val *= 0.5;
    if (stat === "spd" && weather?.id === "arena" && typesOf(mon).includes("roca")) val *= 1.5;
    return Math.max(1, Math.floor(val));
  }
  function typeMult(moveType, defMon) {
    let m = effectiveness(moveType, typesOf(defMon));
    const ab = abilityOf(defMon);
    if (ab?.immuneType === moveType) m = 0;
    if (ab?.absorb && ab.absorb.type === moveType) m = 0;
    return m;
  }
  function powerMult(atkMon, move, weather) {
    let m = 1;
    const ab = abilityOf(atkMon);
    if (ab?.boost && ab.boost.type === move.type && (!ab.boost.pinch || atkMon.hp <= atkMon.maxHp / 3)) m *= ab.boost.mult;
    if (ab?.atkMult && move.cat === "fis") m *= ab.atkMult;
    if (weather) {
      const w = weather.id;
      if (w === "soleado") {
        if (move.type === "fuego") m *= 1.5;
        if (move.type === "agua") m *= 0.5;
      } else if (w === "lluvia") {
        if (move.type === "agua") m *= 1.5;
        if (move.type === "fuego") m *= 0.5;
      } else if (w === "tormenta") {
        if (move.type === "agua") m *= 1.3;
        if (move.type === "electrico") m *= 1.25;
        if (move.type === "fuego") m *= 0.6;
      } else if (w === "calor") {
        if (move.type === "fuego") m *= 1.25;
        if (move.type === "hielo") m *= 0.75;
        if (move.type === "agua") m *= 0.9;
      } else if (w === "niebla") {
        if (move.type === "espiritu" || move.type === "sombra") m *= 1.15;
      }
    }
    return m;
  }
  function calcDamage(p) {
    const { atk, atkV, def, defV, move, weather } = p;
    const eff = typeMult(move.type, def);
    if (eff === 0) return { dmg: 0, eff: 0, stab: 1, crit: false };
    if (move.fx?.fixed) {
      const d = move.fx.fixed === "lvl" ? atk.lv : move.fx.fixed;
      return { dmg: Math.max(1, d), eff, stab: 1, crit: false };
    }
    const physical = move.cat === "fis";
    const aStat = physical ? "atk" : "spa", dStat = physical ? "def" : "spd";
    const crit = !!p.crit;
    const A3 = effStat(atk, atkV, aStat, weather, { ignoreStages: crit && (atkV.stages[aStat] || 0) < 0 });
    const D = effStat(def, defV, dStat, weather, { ignoreStages: crit && (defV.stages[dStat] || 0) > 0 });
    const power = Math.max(1, move.pow * powerMult(atk, move, weather));
    let dmg = Math.floor(Math.floor((Math.floor(2 * atk.lv / 5) + 2) * power * A3 / D) / 50) + 2;
    if (crit) dmg = Math.floor(dmg * 1.5);
    const stabOn = typesOf(atk).includes(move.type);
    const stab = stabOn ? abilityOf(atk)?.adaptable ? 2 : 1.5 : 1;
    dmg = Math.floor(dmg * stab);
    dmg = Math.floor(dmg * eff);
    const dab = abilityOf(def);
    if (dab?.resist && dab.resist[move.type]) dmg = Math.floor(dmg * dab.resist[move.type]);
    if (dab?.physRed && physical) dmg = Math.floor(dmg * dab.physRed);
    if (p.barrier && !crit) dmg = Math.floor(dmg * 0.5);
    if (!p.skipRoll) dmg = Math.floor(dmg * (p.roll ?? 1));
    if (weather?.id === "arena" && typesOf(def).includes("roca") && !physical) dmg = Math.floor(dmg / 1.5);
    return { dmg: Math.max(1, dmg), eff, stab, crit };
  }
  function moveAccuracy(move, atkMon, atkV, defV, weather) {
    if (!move.acc || move.fx?.bypass) return 0;
    let acc = move.acc;
    if (move.id === "ventisca" && weather?.id === "granizo") return 0;
    const ab = abilityOf(atkMon);
    if (ab?.accMult) acc *= ab.accMult;
    acc *= accMult((atkV.stages.acc || 0) - (defV.stages.eva || 0));
    if (weather?.id === "niebla") acc *= 0.85;
    return Math.min(100, Math.max(1, acc));
  }
  var STRUGGLE = { id: "forcejeo", name: "Forcejeo", type: "lucha", cat: "fis", pow: 50, acc: 0, pp: 1, fx: { recoil: 0.25 }, pri: 0, desc: "Se usa cuando no quedan PP.", struggle: true };
  function targetsFoe(move) {
    if (move.cat !== "est") return true;
    const f = move.fx;
    if (f.st || f.leech || f.confuse) return true;
    if (f.stat && f.stat.some((s) => s[0] === "foe")) return true;
    return false;
  }

  // src/ai.js
  var STATUS_BLOCK = { quemado: ["fuego"], paralizado: ["electrico"], congelado: ["hielo"], envenenado: ["veneno", "metal"], dormido: [] };
  function sideInfo(battle, si) {
    const me = battle.sides[si], foeS = battle.sides[1 - si];
    return { me, foeS, mon: me.party[me.idx], foe: foeS.party[foeS.idx] };
  }
  function expectedHits(move) {
    return move.fx.multi ? (move.fx.multi[0] + move.fx.multi[1]) / 2 : 1;
  }
  function expectedDamage(battle, si, move) {
    const { me, foeS, mon, foe } = sideInfo(battle, si);
    if (move.cat === "est") return 0;
    const r = calcDamage({ atk: mon, atkV: me.v, def: foe, defV: foeS.v, move, weather: battle.weather, crit: false, roll: 0.925, barrier: foeS.barrier[move.cat] > 0 });
    return r.dmg * expectedHits(move);
  }
  function scoreMoves(battle, si) {
    const { me, foeS, mon, foe } = sideInfo(battle, si);
    const out = [];
    const foeAb = abilityOf(foe);
    mon.moves.forEach((slot, idx) => {
      if (slot.pp <= 0) return;
      const move = getMove(slot.id);
      let score = 0, dmg = 0, kills = false;
      const hpFrac = mon.hp / mon.maxHp;
      if (move.cat !== "est") {
        const eff = typeMult(move.type, foe);
        if (eff === 0) {
          out.push({ idx, move, score: -200, dmg: 0, kills: false });
          return;
        }
        dmg = expectedDamage(battle, si, move);
        kills = dmg >= foe.hp;
        const acc = move.acc ? Math.min(1, move.acc / 100) : 1;
        score = Math.min(dmg, foe.hp) / foe.maxHp * 100 * acc;
        if (kills) score += 60 + (move.pri > 0 ? 25 : 0);
        if (move.fx.st && !foe.status && !STATUS_BLOCK[move.fx.st[0]]?.some((t) => typesOf(foe).includes(t))) score += move.fx.st[1] / 100 * 10;
        if (move.fx.recoil && hpFrac < 0.3) score -= 18;
        if (move.fx.recharge) score -= 12;
        if (move.fx.charge) score -= 10;
        if (move.fx.drain && hpFrac < 0.6) score += 10;
        if (move.fx.stat?.some((s) => s[0] === "self" && s[2] < 0)) score -= 6;
      } else {
        const f = move.fx;
        score = 4;
        if (f.st) {
          const blocked = foe.status || STATUS_BLOCK[f.st[0]]?.some((t) => typesOf(foe).includes(t)) || f.st[0] === "dormido" && foeAb?.noStatus || foeAb?.noStatus === "all";
          score = blocked ? -60 : 40 * ((move.acc || 100) / 100) + (f.st[0] === "dormido" ? 8 : 0);
        }
        if (f.heal || f.rest) score = hpFrac < 0.45 ? 70 : hpFrac < 0.7 ? 20 : -40;
        if (f.stat) {
          let v = 0;
          for (const [who, stat, n] of f.stat) {
            if (who === "self") {
              const cur = me.v.stages[stat] || 0;
              v += cur >= 2 ? -25 : n > 0 ? 22 + n * 4 : -10;
            } else {
              const cur = foeS.v.stages[stat] || 0;
              v += cur <= -2 ? -25 : 15;
            }
          }
          if (hpFrac < 0.35) v -= 20;
          score = v;
        }
        if (f.weather) score = battle.weather?.id === f.weather ? -50 : 28;
        if (f.barrier) {
          const b = f.barrier === "ambos" ? me.barrier.fis + me.barrier.esp : me.barrier[f.barrier];
          score = b > 0 ? -60 : 24;
        }
        if (f.shield) score = me.v.shield > 0 ? -60 : 30;
        if (f.leech) score = foeS.v.leech || typesOf(foe).includes("planta") ? -60 : 30;
        if (f.confuse) score = foeS.v.confuse > 0 ? -50 : 18;
        if (f.protect) score = me.v.protectN > 0 ? -50 : -5;
        if (f.clear) score = 0;
        if (f.cure) score = mon.status ? 40 : -50;
      }
      out.push({ idx, move, score, dmg, kills });
    });
    return out;
  }
  function matchup(cand, foe) {
    let best = 1;
    for (const t of typesOf(foe)) {
      for (const ct of typesOf(cand)) {
      }
    }
    let threat = 0;
    for (const t of typesOf(foe)) threat = Math.max(threat, typeMult(t, cand));
    let offense = 0;
    for (const t of typesOf(cand)) offense = Math.max(offense, typeMult(t, foe));
    return Math.log2(Math.max(0.25, offense)) - Math.log2(Math.max(0.25, threat || 0.25)) + (cand.hp / cand.maxHp - 0.5) * 0.6 + best * 0;
  }
  function bestSwitch(battle, si) {
    const { me, mon, foe } = sideInfo(battle, si);
    let best = null, bestV = -Infinity;
    me.party.forEach((p, i) => {
      if (i === me.idx || p.hp <= 0 || p.egg) return;
      const v = matchup(p, foe);
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    });
    return { idx: best, value: bestV, current: matchup(mon, foe) };
  }
  function chooseReplacement(battle, si) {
    const { me } = sideInfo(battle, si);
    const alive = me.party.map((p, i) => ({ p, i })).filter((x) => x.p.hp > 0 && !x.p.egg && x.i !== me.idx);
    if (!alive.length) return null;
    if (si === 1 && battle.ai === "basic") return alive[0].i;
    const foe = battle.sides[1 - si].party[battle.sides[1 - si].idx];
    alive.sort((a, b) => matchup(b.p, foe) - matchup(a.p, foe));
    return alive[0].i;
  }
  function chooseAction(battle, si) {
    const { me, mon, foe } = sideInfo(battle, si);
    const rng = battle.rng;
    const level = si === 1 ? battle.wild ? "wild" : battle.ai : "basic";
    if (level === "wild") {
      const beh = getSpecies(mon.sp).behavior;
      if (beh === "timido" && mon.hp / mon.maxHp < 0.3 && rng.chance(0.35)) return { type: "flee" };
      if (beh === "dormilon" && rng.chance(0.2)) return { type: "idle", text: "est\xE1 remoloneando." };
    }
    if ((level === "smart" || level === "ace") && battle.foeItems) {
      const heal = ["hiper_pocion", "super_pocion", "pocion"].find((id) => (battle.foeItems[id] || 0) > 0);
      if (heal && mon.hp / mon.maxHp < 0.3 && rng.chance(level === "ace" ? 0.7 : 0.4)) {
        const scores2 = scoreMoves(battle, si);
        if (!scores2.some((s) => s.kills)) return { type: "item", id: heal, target: me.idx };
      }
    }
    if ((level === "smart" || level === "ace") && me.v.turnsOut >= 1 && !me.v.charging) {
      const alt = bestSwitch(battle, si);
      if (alt.idx != null && alt.value - alt.current > 1.4 && rng.chance(level === "ace" ? 0.55 : 0.3)) {
        const kills = scoreMoves(battle, si).some((s) => s.kills);
        if (!kills) return { type: "switch", idx: alt.idx };
      }
    }
    const scores = scoreMoves(battle, si);
    if (!scores.length) return { type: "move", idx: -1 };
    const noise = level === "wild" || level === "basic" ? 0.45 : level === "smart" ? 0.12 : 0.04;
    let best = null, bestV = -Infinity;
    for (const s of scores) {
      let v = s.score * (1 + (rng.next() * 2 - 1) * noise);
      if (level === "wild") {
        const beh = getSpecies(mon.sp).behavior;
        if (beh === "agresivo" && s.move.cat !== "est") v += 8;
      }
      if (v > bestV) {
        bestV = v;
        best = s;
      }
    }
    return { type: "move", idx: best.idx };
  }

  // src/battle.js
  var STAT_LABEL = { atk: "El Ataque", def: "La Defensa", spa: "El Ataque Esp.", spd: "La Defensa Esp.", spe: "La Velocidad", acc: "La precisi\xF3n", eva: "La evasi\xF3n" };
  var STATUS_TEXT = {
    quemado: "ha sido quemado",
    envenenado: "ha sido envenenado",
    paralizado: "ha sido paralizado",
    dormido: "se ha dormido",
    congelado: "ha sido congelado"
  };
  var STATUS_IMMUNE_TYPES = { quemado: ["fuego"], paralizado: ["electrico"], congelado: ["hielo"], envenenado: ["veneno", "metal"] };
  var WEATHER_TEXT = {
    soleado: ["El sol brilla con fuerza.", "El sol se debilita."],
    lluvia: ["Empieza a llover.", "La lluvia cesa."],
    tormenta: ["Estalla una tormenta.", "La tormenta amaina."],
    arena: ["Se levanta una tormenta de arena.", "La tormenta de arena se calma."],
    granizo: ["Empieza a granizar.", "El granizo cesa."],
    niebla: ["La niebla lo cubre todo.", "La niebla se disipa."],
    calor: ["Un calor sofocante lo invade todo.", "El calor remite."]
  };
  var Battle = class {
    /**
     * o: { seed|rng, player:{name,party,bag}, foe:{name,party,wild,trainer,ai,items}, weather, env:{isNight,cave,tags,alreadyCaught,weatherName},
     *      canFlee, canCapture, expShare, levelCap, xpBonus }
     */
    constructor(o) {
      this.rng = o.rng || new RNG(o.seed ?? 1);
      this.seed = o.seed ?? null;
      const mk2 = (d, isPlayer) => ({
        name: d.name,
        party: d.party,
        idx: 0,
        isPlayer,
        v: freshVolatile(),
        barrier: { fis: 0, esp: 0 },
        partic: /* @__PURE__ */ new Set(),
        trainer: d.trainer || null
      });
      this.sides = [mk2(o.player, true), mk2(o.foe, false)];
      this.wild = !!o.foe.wild;
      this.trainer = o.foe.trainer || null;
      this.ai = o.foe.ai || "basic";
      this.foeItems = { ...o.foe.items || {} };
      this.bag = o.player.bag || {};
      this.canFlee = o.canFlee ?? this.wild;
      this.canCapture = o.canCapture ?? this.wild;
      this.weather = o.weather ? { id: o.weather, turns: Infinity } : null;
      this.env = o.env || {};
      this.expShare = !!o.expShare;
      this.levelCap = o.levelCap ?? 100;
      this.xpBonus = o.xpBonus ?? 1;
      this.turnNo = 0;
      this.fleeAttempts = 0;
      this.result = null;
      this.awaiting = null;
      this.captured = null;
      this.events = [];
      this.stats = { dealt: 0, taken: 0, kos: 0, xp: 0, evolveReady: [], defeated: [] };
      this.started = false;
    }
    // ---------- utilidades ----------
    active(si) {
      const s = this.sides[si];
      return s.party[s.idx];
    }
    label(si) {
      const m = this.active(si);
      const n = displayName(m);
      if (si === 0) return n;
      return this.wild ? `${n} salvaje` : `${n} rival`;
    }
    nameOf(si, mon) {
      const n = displayName(mon);
      return si === 0 ? n : this.wild ? `${n} salvaje` : `${n} rival`;
    }
    _emit(e) {
      this.events.push(e);
      return e;
    }
    _msg(text) {
      return this._emit({ t: "msg", text });
    }
    _hpEvt(si, extra = {}) {
      const m = this.active(si);
      return { side: si, hp: m.hp, maxHp: m.maxHp, ...extra };
    }
    _snap(si) {
      const m = this.active(si);
      return { side: si, idx: this.sides[si].idx, sp: m.sp, name: displayName(m), lv: m.lv, hp: m.hp, maxHp: m.maxHp, status: m.status, variant: m.variant, uid: m.uid };
    }
    anyAlive(si) {
      return this.sides[si].party.some((p) => canFight(p));
    }
    firstAlive(si) {
      return this.sides[si].party.findIndex((p) => canFight(p));
    }
    // ---------- inicio ----------
    start() {
      if (this.started) return [];
      this.started = true;
      this.events = [];
      for (const si of [0, 1]) this.sides[si].idx = Math.max(0, this.firstAlive(si));
      this.sides[0].partic.add(this.sides[0].idx);
      if (this.weather) this._emit({ t: "weather", id: this.weather.id, ambient: true });
      if (this.wild) this._msg(`\xA1Ha aparecido ${this.nameOf(1, this.active(1))}!`);
      else this._msg(`\xA1${this.sides[1].name} te desaf\xEDa a un combate!`);
      this._emit({ t: "send", ...this._snap(1), first: true });
      this._emit({ t: "send", ...this._snap(0), first: true });
      const order = this._speedOrder();
      for (const si of order) this._enter(si);
      return this.events;
    }
    _speedOrder() {
      const sp = [0, 1].map((si) => effStat(this.active(si), this.sides[si].v, "spe", this.weather));
      if (sp[0] === sp[1]) return this.rng.chance(0.5) ? [0, 1] : [1, 0];
      return sp[0] > sp[1] ? [0, 1] : [1, 0];
    }
    _enter(si) {
      const mon = this.active(si), ab = abilityOf(mon);
      if (!ab?.enter) return;
      if (ab.enter.weather) {
        if (this.weather?.id !== ab.enter.weather) {
          this._emit({ t: "ability", side: si, name: ab.name });
          this._setWeather(ab.enter.weather, 5);
        }
      } else if (ab.enter.stat) {
        this._emit({ t: "ability", side: si, name: ab.name });
        const [who, stat, n] = ab.enter.stat;
        this._changeStat(who === "foe" ? 1 - si : si, stat, n, si);
      }
    }
    _setWeather(id, turns) {
      this.weather = { id, turns };
      this._emit({ t: "weather", id });
      this._msg(WEATHER_TEXT[id]?.[0] || "Cambia el clima.");
    }
    // ---------- turno ----------
    /** Procesa un turno. action: {type:'move',idx}|{type:'switch',idx}|{type:'item',id,target}|{type:'capture',ball}|{type:'flee'} */
    turn(action) {
      if (this.result) return { ok: false, msg: "El combate ha terminado.", events: [] };
      if (this.awaiting) return { ok: false, msg: "Debes elegir una criatura.", events: [] };
      const bad = this._validate(action);
      if (bad) return { ok: false, msg: bad, events: [] };
      this.events = [];
      this.turnNo++;
      const pa = this.sides[0].v.charging ? { type: "move", forced: true } : action;
      let fa;
      if (this.sides[1].v.charging) fa = { type: "move", forced: true };
      else fa = chooseAction(this, 1);
      const acts = [{ si: 0, a: pa }, { si: 1, a: fa }];
      const phase = (x) => x.a.type === "move" ? 1 : 0;
      const prio = (x) => {
        if (x.a.type !== "move") return 0;
        const v = this.sides[x.si].v, mon = this.active(x.si);
        const mv = v.charging ? getMove(v.charging) : x.a.idx >= 0 && mon.moves[x.a.idx] ? getMove(mon.moves[x.a.idx].id) : STRUGGLE;
        return mv.pri || 0;
      };
      const spd = (x) => effStat(this.active(x.si), this.sides[x.si].v, "spe", this.weather);
      const tieBreak = this.rng.next();
      acts.sort((x, y) => phase(x) - phase(y) || prio(y) - prio(x) || spd(y) - spd(x) || (x.si === 0 ? tieBreak < 0.5 ? -1 : 1 : tieBreak < 0.5 ? 1 : -1));
      for (const x of acts) {
        if (this.result) break;
        const mon = this.active(x.si);
        if (!canFight(mon)) continue;
        this._act(x.si, x.a);
      }
      if (!this.result) this._endTurn();
      if (!this.result) this._resolveFaints();
      for (const si of [0, 1]) if (this.sides[si].party[this.sides[si].idx]) this.sides[si].v.turnsOut++;
      return { ok: true, events: this.events };
    }
    _validate(a) {
      const me = this.sides[0], mon = this.active(0);
      if (!a || !a.type) return "Acci\xF3n no v\xE1lida.";
      if (a.type === "move") {
        if (me.v.charging) return null;
        if (a.idx === -1) return mon.moves.every((m2) => m2.pp <= 0) ? null : "A\xFAn tienes movimientos.";
        const m = mon.moves[a.idx];
        if (!m) return "Movimiento no v\xE1lido.";
        if (m.pp <= 0) return "No quedan PP para ese movimiento.";
      } else if (a.type === "switch") {
        const p = me.party[a.idx];
        if (!p || !canFight(p)) return "Esa criatura no puede combatir.";
        if (a.idx === me.idx) return "Esa criatura ya est\xE1 en combate.";
      } else if (a.type === "item") {
        if (!bagHas(this.bag, a.id)) return "No te queda ese objeto.";
        const it = getItem(a.id);
        if (it.use !== "both" && it.use !== "battle") return "No se puede usar en combate.";
        const t = me.party[a.target ?? me.idx];
        if (!t) return "Objetivo no v\xE1lido.";
        if (it.fx.ball) return "Usa la opci\xF3n de captura.";
      } else if (a.type === "capture") {
        if (!this.canCapture) return this.wild ? "No se puede capturar." : "\xA1No puedes capturar a la criatura de otro entrenador!";
        if (!bagHas(this.bag, a.ball)) return "No te quedan de esas c\xE1psulas.";
        if (!getItem(a.ball).fx.ball) return "Eso no es una c\xE1psula.";
      } else if (a.type === "flee") {
        if (!this.canFlee) return this.wild ? "\xA1No puedes huir!" : "\xA1No puedes huir de un combate contra un entrenador!";
      } else return "Acci\xF3n no v\xE1lida.";
      return null;
    }
    _act(si, a) {
      switch (a.type) {
        case "move":
          return this._useMove(si, a);
        case "switch":
          return this._doSwitch(si, a.idx, false);
        case "item":
          return this._useItem(si, a);
        case "capture":
          return this._capture(a.ball);
        case "flee":
          return si === 0 ? this._flee() : this._foeFlee();
        case "idle":
          return this._msg(`${this.label(si)} ${a.text || "no hace nada."}`);
        default:
          return null;
      }
    }
    // ---------- cambio / objetos / huida / captura ----------
    _doSwitch(si, idx, forced) {
      const s = this.sides[si];
      const out = this.active(si);
      if (!forced) this._msg(si === 0 ? `\xA1Vuelve, ${displayName(out)}!` : `${s.name} retira a ${displayName(out)}.`);
      s.idx = idx;
      s.v = freshVolatile();
      if (si === 0) s.partic.add(idx);
      else this.sides[0].partic = /* @__PURE__ */ new Set([this.sides[0].idx]);
      this._emit({ t: "send", ...this._snap(si) });
      this._msg(si === 0 ? `\xA1Adelante, ${displayName(this.active(0))}!` : `${s.name} env\xEDa a ${displayName(this.active(1))}.`);
      this._enter(si);
    }
    _useItem(si, a) {
      if (si === 0) {
        const target = this.sides[0].party[a.target ?? this.sides[0].idx];
        const r = useMedicine(a.id, target, { inBattle: true });
        if (!r.ok) {
          this._msg(r.msg + " (turno perdido)");
          return;
        }
        bagRemove(this.bag, a.id);
        this._msg(`Usaste ${getItem(a.id).name}.`);
        const isActive = this.sides[0].party.indexOf(target) === this.sides[0].idx;
        this._emit({ t: "heal", side: 0, hp: target.hp, maxHp: target.maxHp, amount: r.healed || 0, active: isActive, revive: getItem(a.id).fx.revive != null });
        this._msg(r.msg);
        if (isActive) this._emit({ t: "statusClear", side: 0, status: target.status });
      } else {
        const mon = this.sides[1].party[a.target ?? this.sides[1].idx];
        const it = getItem(a.id);
        const r = useMedicine(a.id, mon, { inBattle: true });
        if (r.ok) {
          this.foeItems[a.id]--;
          this._msg(`${this.sides[1].name} usa ${it.name}.`);
          this._emit({ t: "heal", side: 1, hp: mon.hp, maxHp: mon.maxHp, amount: r.healed || 0, active: true });
        }
      }
    }
    _flee() {
      const me = effStat(this.active(0), this.sides[0].v, "spe", this.weather);
      const foe = effStat(this.active(1), this.sides[1].v, "spe", this.weather);
      this.fleeAttempts++;
      const f = Math.floor(me * 128 / Math.max(1, foe)) + 30 * (this.fleeAttempts - 1);
      const ok = f >= 256 || this.rng.int(0, 255) < f;
      this._emit({ t: "flee", success: ok });
      if (ok) {
        this._msg("\xA1Escapaste sin problemas!");
        this._finish("fled");
      } else this._msg("\xA1No puedes escapar!");
    }
    _foeFlee() {
      this._msg(`\xA1${this.label(1)} ha huido!`);
      this._emit({ t: "flee", success: true, side: 1 });
      this._finish("foefled");
    }
    _capture(ballId) {
      bagRemove(this.bag, ballId);
      const foe = this.active(1);
      const ball = getItem(ballId);
      this._msg(`\xA1Lanzaste una ${ball.name}!`);
      const r = rollCapture(this.rng, foe, ballId, { turn: this.turnNo, isNight: this.env.isNight, cave: this.env.cave, alreadyCaught: this.env.alreadyCaught });
      this._emit({ t: "capture", ball: ballId, shakes: r.shakes, success: r.caught, name: displayName(foe) });
      if (r.caught) {
        this._msg(`\xA1Has capturado a ${displayName(foe)}!`);
        this.captured = foe;
        foe.ball = ballId;
        this._finish("captured");
      } else {
        this._msg(["\xA1Se ha escapado enseguida!", "\xA1Parec\xEDa que lo ten\xEDas!", "\xA1Casi lo consigues!", "\xA1Estuvo cerca!"][r.shakes] || "\xA1Se ha escapado!");
      }
    }
    // ---------- movimientos ----------
    _canAct(si) {
      const mon = this.active(si), v = this.sides[si].v, n = this.label(si);
      if (mon.status === "dormido") {
        if (mon.statusTurns > 0) {
          mon.statusTurns--;
          this._msg(`${n} est\xE1 profundamente dormido.`);
          this._emit({ t: "sleepSkip", side: si });
          return false;
        }
        mon.status = null;
        this._emit({ t: "statusClear", side: si });
        this._msg(`\xA1${n} se despert\xF3!`);
      }
      if (mon.status === "congelado") {
        if (this.rng.chance(0.2)) {
          mon.status = null;
          this._emit({ t: "statusClear", side: si });
          this._msg(`\xA1${n} se descongel\xF3!`);
        } else {
          this._msg(`${n} est\xE1 congelado y no puede moverse.`);
          return false;
        }
      }
      if (v.flinch) {
        v.flinch = false;
        this._msg(`\xA1${n} se amedrent\xF3 y no pudo moverse!`);
        return false;
      }
      if (mon.status === "paralizado" && this.rng.chance(0.25)) {
        this._msg(`\xA1${n} est\xE1 paralizado! \xA1No puede moverse!`);
        this._emit({ t: "paraSkip", side: si });
        return false;
      }
      if (v.confuse > 0) {
        v.confuse--;
        if (v.confuse === 0) this._msg(`${n} ya no est\xE1 confuso.`);
        else {
          this._msg(`${n} est\xE1 confuso.`);
          if (this.rng.chance(0.33)) {
            const self = calcDamage({ atk: mon, atkV: v, def: mon, defV: v, move: { type: "lucha", cat: "fis", pow: 40, fx: {} }, weather: this.weather, crit: false, roll: this.rng.float(0.85, 1), skipRoll: false });
            this._msg("\xA1Se hiri\xF3 a s\xED mismo en su confusi\xF3n!");
            this._damage(si, Math.max(1, Math.floor(self.dmg / 1.5)), { self: true });
            return false;
          }
        }
      }
      return true;
    }
    _useMove(si, a) {
      const me = this.sides[si], foeSide = 1 - si;
      const mon = this.active(si), v = me.v;
      if (v.recharge) {
        v.recharge = false;
        this._msg(`${this.label(si)} debe descansar.`);
        return;
      }
      let move, second = false;
      if (v.charging) {
        move = getMove(v.charging);
        v.charging = null;
        second = true;
      }
      if (!this._canAct(si)) {
        if (!second) {
        }
        return;
      }
      if (!move) {
        if (a.idx === -1 || !mon.moves[a.idx]) move = STRUGGLE;
        else {
          const slot = mon.moves[a.idx];
          if (slot.pp <= 0) move = STRUGGLE;
          else {
            slot.pp--;
            move = getMove(slot.id);
          }
        }
      }
      v.lastMove = move.id;
      this._emit({ t: "move", side: si, move: move.id, name: move.name, type: move.type, cat: move.cat, text: `\xA1${this.label(si)} us\xF3 ${move.name}!`, self: !targetsFoe(move) });
      if (move.fx.charge && !second && !(move.id === "rayo_clorofila" && this.weather?.id === "soleado")) {
        v.charging = move.id;
        this._msg(`\xA1${this.label(si)} acumula energ\xEDa!`);
        return;
      }
      if (!targetsFoe(move)) {
        this._selfMove(si, move);
        return;
      }
      const dmon = this.active(foeSide), dv = this.sides[foeSide].v;
      if (dv.protect) {
        this._msg(`\xA1${this.label(foeSide)} se protegi\xF3!`);
        this._emit({ t: "protect", side: foeSide });
        if (move.fx.recharge) v.recharge = false;
        return;
      }
      const acc = moveAccuracy(move, mon, v, dv, this.weather);
      if (acc > 0 && this.rng.next() * 100 >= acc) {
        this._emit({ t: "miss", side: foeSide });
        this._msg(`\xA1${this.label(si)} fall\xF3 el ataque!`);
        return;
      }
      if (move.cat === "est") {
        this._statusMoveEffects(si, move);
        return;
      }
      const eff = typeMult(move.type, dmon);
      if (eff === 0) {
        const ab = abilityOf(dmon);
        if (ab?.absorb && ab.absorb.type === move.type) {
          this._emit({ t: "ability", side: foeSide, name: ab.name });
          const heal = Math.floor(dmon.maxHp * ab.absorb.heal);
          this._heal(foeSide, heal);
          this._msg(`${this.label(foeSide)} absorbi\xF3 el ataque.`);
        } else this._msg(`No afecta a ${this.label(foeSide)}...`);
        this._emit({ t: "noEffect", side: foeSide });
        return;
      }
      const hits = move.fx.multi ? this._multiHits(move.fx.multi) : 1;
      let total = 0, count = 0, anyCrit = false, lastEff = 1;
      for (let h = 0; h < hits; h++) {
        if (!canFight(this.active(foeSide)) || !canFight(this.active(si))) break;
        const critStage = clamp((move.fx.crit || 0) + (abilityOf(mon)?.critBoost || 0), 0, 4);
        const crit = this.rng.next() < CRIT_CHANCE[critStage];
        const roll = 0.85 + this.rng.next() * 0.15;
        const r = calcDamage({
          atk: mon,
          atkV: v,
          def: dmon,
          defV: dv,
          move,
          weather: this.weather,
          crit,
          roll,
          barrier: this.sides[foeSide].barrier[move.cat === "fis" ? "fis" : "esp"] > 0 || this.sides[foeSide].barrier.ambos > 0
        });
        lastEff = r.eff;
        anyCrit = anyCrit || crit;
        const dealt = this._damage(foeSide, r.dmg, { from: si, move, crit, eff: r.eff, last: h === hits - 1 || !move.fx.multi });
        total += dealt;
        count++;
        if (move.fx.multi === void 0 || h === hits - 1) {
          if (crit) this._msg("\xA1Golpe cr\xEDtico!");
        }
        if (move.cat === "fis" && dealt > 0) this._contact(si, foeSide);
      }
      if (move.fx.multi) this._msg(`\xA1Golpe\xF3 ${count} ${count === 1 ? "vez" : "veces"}!`);
      if (lastEff > 1) this._msg(lastEff >= 4 ? "\xA1Es ultra eficaz!" : "\xA1Es muy eficaz!");
      else if (lastEff < 1) this._msg("No es muy eficaz...");
      if (total > 0) {
        if (move.fx.drain && canFight(this.active(si))) {
          this._heal(si, Math.max(1, Math.floor(total * move.fx.drain)));
          this._msg(`${this.label(si)} absorbi\xF3 energ\xEDa.`);
        }
        if (move.fx.recoil) {
          const rd = move.struggle ? Math.max(1, Math.floor(mon.maxHp / 4)) : Math.max(1, Math.floor(total * move.fx.recoil));
          this._damage(si, rd, { recoil: true });
          this._msg(`\xA1${this.label(si)} sufre el retroceso!`);
        }
      }
      if (canFight(this.active(foeSide))) this._secondary(si, foeSide, move);
      if (move.fx.recharge && canFight(this.active(si))) v.recharge = true;
      this._checkFaint(foeSide);
      this._checkFaint(si);
    }
    _multiHits([a, b]) {
      if (a === 2 && b === 5) {
        const r = this.rng.next();
        return r < 0.35 ? 2 : r < 0.7 ? 3 : r < 0.85 ? 4 : 5;
      }
      return this.rng.int(a, b);
    }
    /** Aplica daño a una criatura. Devuelve el daño realmente infligido. */
    _damage(si, amount, o = {}) {
      const mon = this.active(si), v = this.sides[si].v;
      let dealt = amount, absorbed = 0;
      if (v.shield > 0 && !o.recoil && !o.self && !o.weather) {
        absorbed = Math.min(v.shield, dealt);
        v.shield -= absorbed;
        dealt -= absorbed;
        if (v.shield <= 0) {
          v.shieldTurns = 0;
        }
      }
      if (dealt >= mon.hp && mon.hp === mon.maxHp && abilityOf(mon)?.sturdy && !o.recoil && !o.weather) {
        dealt = mon.hp - 1;
        this._emit({ t: "ability", side: si, name: abilityOf(mon).name });
      }
      dealt = Math.min(dealt, mon.hp);
      mon.hp -= dealt;
      if (o.from === 0) this.stats.dealt += dealt;
      if (si === 0) this.stats.taken += dealt;
      this._emit({ t: "dmg", side: si, amount: dealt, shield: absorbed, hp: mon.hp, maxHp: mon.maxHp, crit: !!o.crit, eff: o.eff ?? 1, move: o.move?.id, from: o.from, last: o.last !== false });
      if (absorbed && !dealt) this._msg(`\xA1El escudo de ${this.label(si)} absorbi\xF3 el golpe!`);
      return dealt + absorbed;
    }
    _heal(si, amount) {
      const mon = this.active(si);
      const add = Math.min(amount, mon.maxHp - mon.hp);
      if (add <= 0) return 0;
      mon.hp += add;
      this._emit({ t: "heal", side: si, amount: add, hp: mon.hp, maxHp: mon.maxHp, active: true });
      return add;
    }
    _contact(si, foeSide) {
      const dab = abilityOf(this.active(foeSide));
      if (!dab?.contact || !canFight(this.active(si))) return;
      if (dab.contact.dmg) {
        this._emit({ t: "ability", side: foeSide, name: dab.name });
        this._damage(si, Math.max(1, Math.floor(this.active(si).maxHp * dab.contact.dmg)), { recoil: true });
      } else if (dab.contact.st && this.rng.chance(dab.contact.st[1] / 100)) {
        this._emit({ t: "ability", side: foeSide, name: dab.name });
        this._inflict(si, dab.contact.st[0], foeSide);
      }
    }
    _secondary(si, foeSide, move) {
      const f = move.fx;
      if (f.st && canFight(this.active(foeSide)) && this.rng.next() * 100 < f.st[1]) this._inflict(foeSide, f.st[0], si);
      if (f.flinch && this.rng.next() * 100 < f.flinch && canFight(this.active(foeSide))) this.sides[foeSide].v.flinch = true;
      if (f.confuse && this.rng.next() * 100 < f.confuse && canFight(this.active(foeSide))) this._confuse(foeSide);
      if (f.stat) for (const [who, stat, n, ch] of f.stat) {
        if (this.rng.next() * 100 >= ch) continue;
        const target = who === "self" ? si : foeSide;
        if (canFight(this.active(target))) this._changeStat(target, stat, n, si);
      }
      if (f.cure && this.active(si).status) {
        this.active(si).status = null;
        this._emit({ t: "statusClear", side: si });
        this._msg(`${this.label(si)} se cur\xF3.`);
      }
    }
    _selfMove(si, move) {
      const f = move.fx, mon = this.active(si), v = this.sides[si].v;
      if (f.heal) {
        let frac = f.heal;
        if (move.id === "fotosintesis") {
          const w = this.weather?.id;
          frac = w === "soleado" || w === "calor" ? 0.66 : w === "lluvia" || w === "granizo" || w === "arena" || w === "tormenta" ? 0.25 : 0.5;
        }
        if (mon.hp >= mon.maxHp) {
          this._msg(`\xA1${this.label(si)} ya tiene los PS al m\xE1ximo!`);
          return;
        }
        this._heal(si, Math.max(1, Math.floor(mon.maxHp * frac)));
        this._msg(`${this.label(si)} recuper\xF3 salud.`);
      }
      if (f.rest) {
        if (mon.hp >= mon.maxHp && !mon.status) {
          this._msg("\xA1Pero no tuvo efecto!");
          return;
        }
        mon.hp = mon.maxHp;
        mon.status = "dormido";
        mon.statusTurns = 2;
        this._emit({ t: "heal", side: si, amount: 0, hp: mon.hp, maxHp: mon.maxHp, active: true });
        this._emit({ t: "status", side: si, status: "dormido" });
        this._msg(`${this.label(si)} se durmi\xF3 y recuper\xF3 toda su salud.`);
      }
      if (f.stat) {
        for (const [who, stat, n, ch] of f.stat) if (this.rng.next() * 100 < ch) this._changeStat(who === "self" ? si : 1 - si, stat, n, si);
      }
      if (f.weather) {
        if (this.weather?.id === f.weather && this.weather.turns !== Infinity) {
          this._msg("\xA1Pero no tuvo efecto!");
        } else this._setWeather(f.weather, 5);
      }
      if (f.barrier) {
        const key = f.barrier;
        const sb = this.sides[si].barrier;
        if ((key === "ambos" ? sb.ambos : sb[key]) > 0) {
          this._msg("\xA1Pero no tuvo efecto!");
          return;
        }
        sb[key] = 5;
        this._emit({ t: "barrier", side: si, kind: key, on: true });
        this._msg(key === "fis" ? "Una pantalla protege del da\xF1o f\xEDsico." : key === "esp" ? "Una pantalla protege del da\xF1o especial." : "Un velo de luz protege al equipo.");
      }
      if (f.shield) {
        if (v.shield > 0) {
          this._msg("\xA1Pero no tuvo efecto!");
          return;
        }
        v.shield = Math.max(1, Math.floor(mon.maxHp * f.shield));
        v.shieldTurns = 3;
        this._emit({ t: "shield", side: si, amount: v.shield, on: true });
        this._msg(`${this.label(si)} se cubre con un escudo.`);
      }
      if (f.protect) {
        const chance = v.protectN === 0 ? 1 : v.protectN === 1 ? 1 / 3 : 1 / 9;
        if (this.rng.next() < chance) {
          v.protect = true;
          v.protectN++;
          this._msg(`${this.label(si)} se protege.`);
        } else {
          v.protectN = 0;
          this._msg("\xA1Pero fall\xF3!");
        }
      }
      if (f.clear) {
        for (const s of [0, 1]) for (const k of Object.keys(this.sides[s].v.stages)) this.sides[s].v.stages[k] = 0;
        this._emit({ t: "stagesClear" });
        this._msg("\xA1Todos los cambios de estad\xEDsticas desaparecieron!");
      }
      if (f.cure) {
        if (mon.status) {
          mon.status = null;
          this._emit({ t: "statusClear", side: si });
          this._msg(`${this.label(si)} se cur\xF3.`);
        }
      }
    }
    _statusMoveEffects(si, move) {
      const foeSide = 1 - si, f = move.fx;
      if (f.st) this._inflict(foeSide, f.st[0], si, true);
      if (f.leech) {
        const t = this.active(foeSide);
        if (typesOf(t).includes("planta")) this._msg(`No afecta a ${this.label(foeSide)}...`);
        else if (this.sides[foeSide].v.leech !== false && this.sides[foeSide].v.leech) this._msg("\xA1Pero no tuvo efecto!");
        else {
          this.sides[foeSide].v.leech = true;
          this._emit({ t: "leech", side: foeSide });
          this._msg(`\xA1${this.label(foeSide)} fue sembrado!`);
        }
      }
      if (f.confuse) this._confuse(foeSide, true);
      if (f.stat) {
        for (const [who, stat, n, ch] of f.stat) if (this.rng.next() * 100 < ch) this._changeStat(who === "self" ? si : foeSide, stat, n, si);
      }
    }
    _confuse(si, announce) {
      const v = this.sides[si].v;
      if (v.confuse > 0) {
        if (announce) this._msg("\xA1Pero no tuvo efecto!");
        return;
      }
      v.confuse = this.rng.int(3, 5);
      this._emit({ t: "confuse", side: si });
      this._msg(`\xA1${this.label(si)} est\xE1 confuso!`);
    }
    _inflict(si, status, source, announceFail = false) {
      const mon = this.active(si), ab = abilityOf(mon);
      const fail = (t) => {
        if (announceFail) this._msg(t);
        return false;
      };
      if (!canFight(mon)) return false;
      if (mon.status) return fail("\xA1Pero no tuvo efecto!");
      if ((STATUS_IMMUNE_TYPES[status] || []).some((t) => typesOf(mon).includes(t))) return fail(`No afecta a ${this.label(si)}...`);
      if (ab?.noStatus === "all" || Array.isArray(ab?.noStatus) && ab.noStatus.includes(status)) {
        this._emit({ t: "ability", side: si, name: ab.name });
        return fail(`${this.label(si)} no puede padecer ese estado.`);
      }
      if (status === "congelado" && (this.weather?.id === "soleado" || this.weather?.id === "calor")) return fail("\xA1Pero no tuvo efecto!");
      mon.status = status;
      mon.statusTurns = status === "dormido" ? this.rng.int(1, 3) : 0;
      this._emit({ t: "status", side: si, status });
      this._msg(`\xA1${this.label(si)} ${STATUS_TEXT[status]}!`);
      return true;
    }
    _changeStat(si, stat, n, source) {
      const mon = this.active(si), v = this.sides[si].v, ab = abilityOf(mon);
      if (!canFight(mon)) return;
      if (n < 0 && source !== si && ab?.noDrop) {
        this._emit({ t: "ability", side: si, name: ab.name });
        this._msg(`${STAT_LABEL[stat]} de ${this.label(si)} no puede bajar.`);
        return;
      }
      const cur = v.stages[stat];
      const next = clamp(cur + n, -6, 6);
      if (next === cur) {
        this._msg(`${STAT_LABEL[stat]} de ${this.label(si)} no puede ${n > 0 ? "subir" : "bajar"} m\xE1s.`);
        return;
      }
      v.stages[stat] = next;
      this._emit({ t: "stat", side: si, stat, n: next - cur, stage: next });
      const mag = Math.abs(n);
      this._msg(`${STAT_LABEL[stat]} de ${this.label(si)} ${n > 0 ? "subi\xF3" : "baj\xF3"}${mag >= 3 ? " much\xEDsimo" : mag === 2 ? " mucho" : ""}.`);
    }
    // ---------- fin de turno ----------
    _endTurn() {
      const order = this._speedOrder();
      if (this.weather) {
        const w = this.weather;
        if (w.id === "arena" || w.id === "granizo") {
          for (const si of order) {
            const m = this.active(si);
            if (!canFight(m) || weatherImmune(m, w.id)) continue;
            this._damage(si, Math.max(1, Math.floor(m.maxHp / 16)), { weather: true });
            this._msg(`${this.label(si)} sufre ${w.id === "arena" ? "la tormenta de arena" : "el granizo"}.`);
            this._checkFaint(si);
          }
        }
        if (w.turns !== Infinity) {
          w.turns--;
          if (w.turns <= 0) {
            this._msg(WEATHER_TEXT[w.id]?.[1] || "El clima se calma.");
            this._emit({ t: "weather", id: null });
            this.weather = null;
          }
        }
      }
      for (const si of order) {
        const m = this.active(si), v = this.sides[si].v;
        if (!canFight(m)) continue;
        if (m.status === "quemado") {
          this._damage(si, Math.max(1, Math.floor(m.maxHp / 16)), { weather: true });
          this._msg(`${this.label(si)} sufre por la quemadura.`);
        } else if (m.status === "envenenado") {
          this._damage(si, Math.max(1, Math.floor(m.maxHp / 8)), { weather: true });
          this._msg(`${this.label(si)} sufre por el veneno.`);
        }
        this._checkFaint(si);
        if (!canFight(m)) continue;
        if (v.leech) {
          const d = Math.max(1, Math.floor(m.maxHp / 8));
          this._damage(si, d, { weather: true });
          this._msg(`La semilla drena la salud de ${this.label(si)}.`);
          if (canFight(this.active(1 - si))) this._heal(1 - si, d);
          this._checkFaint(si);
          if (!canFight(m)) continue;
        }
        const ab = abilityOf(m);
        if (ab?.regen && m.hp < m.maxHp) {
          this._emit({ t: "ability", side: si, name: ab.name });
          this._heal(si, Math.max(1, Math.floor(m.maxHp * ab.regen)));
        }
        if (ab?.cleanse && m.status && this.rng.chance(ab.cleanse)) {
          this._emit({ t: "ability", side: si, name: ab.name });
          m.status = null;
          this._emit({ t: "statusClear", side: si });
          this._msg(`${this.label(si)} se cur\xF3.`);
        }
        if (v.shield > 0 && --v.shieldTurns <= 0) {
          v.shield = 0;
          this._emit({ t: "shield", side: si, on: false });
          this._msg(`El escudo de ${this.label(si)} se desvaneci\xF3.`);
        }
        v.flinch = false;
        if (!v.protect) v.protectN = 0;
        else v.protect = false;
      }
      for (const si of [0, 1]) {
        const b = this.sides[si].barrier;
        for (const k of ["fis", "esp", "ambos"]) {
          if (b[k] > 0 && --b[k] === 0) {
            this._emit({ t: "barrier", side: si, kind: k, on: false });
            this._msg("Una pantalla protectora se disip\xF3.");
          }
        }
      }
    }
    // ---------- derrotas ----------
    _checkFaint(si) {
      const mon = this.active(si);
      if (mon.hp > 0 || mon._fainted) return;
      mon._fainted = true;
      mon.status = null;
      mon.statusTurns = 0;
      this._emit({ t: "faint", side: si, name: displayName(mon) });
      this._msg(`\xA1${this.nameOf(si, mon)} se debilit\xF3!`);
      this.sides[si].v = freshVolatile();
      if (si === 1) {
        this.stats.kos++;
        this.stats.defeated.push(mon.sp);
        this._awardXp(mon);
        const ab = abilityOf(this.active(0));
        if (ab?.onKo && canFight(this.active(0))) {
          this._emit({ t: "ability", side: 0, name: ab.name });
          this._changeStat(0, ab.onKo.stat[0], ab.onKo.stat[1], 0);
        }
      } else {
        mon.kos = mon.kos || 0;
        changeFriendship(mon, -1);
      }
    }
    _awardXp(foe) {
      const p = this.sides[0];
      const evoCtx = { trigger: "level", isNight: this.env.isNight, tags: this.env.tags || [], weather: this.env.weatherName, party: p.party, hour: this.env.hour };
      const parts = [...p.partic].filter((i) => p.party[i] && canFight(p.party[i]));
      if (!parts.length) return;
      const trainer = !this.wild;
      const yield_ = evYield(foe);
      const share = new Set(parts);
      const recipients = [];
      for (const i of parts) recipients.push({ i, f: 1 });
      if (this.expShare) p.party.forEach((m, i) => {
        if (!share.has(i) && canFight(m)) recipients.push({ i, f: 0.5 });
      });
      for (const { i, f } of recipients) {
        const m = p.party[i];
        if (m.lv >= 100) continue;
        let amount = battleXp(foe, { trainer, participants: parts.length, ownLv: m.lv });
        amount = Math.max(1, Math.floor(amount * f * this.xpBonus));
        this.stats.xp += amount;
        const ups = gainXp(m, amount, this.levelCap);
        this._emit({ t: "xp", idx: i, amount, name: displayName(m), pct: 0, active: i === p.idx, lv: m.lv });
        this._msg(`${displayName(m)} gan\xF3 ${amount} puntos de experiencia.`);
        for (const u of ups) {
          this._emit({ t: "levelup", idx: i, name: displayName(m), lv: u.lv, gains: u.gains, learned: u.learned, pending: u.pending, stats: { ...m.stats }, active: i === p.idx, hp: i === p.idx ? m.hp : null, maxHp: m.maxHp });
          this._msg(`\xA1${displayName(m)} subi\xF3 al nivel ${u.lv}!`);
          for (const mv of u.learned) this._msg(`\xA1${displayName(m)} aprendi\xF3 ${getMove(mv).name}!`);
        }
        if (ups.length) {
          const r = markEvolution(m, evoCtx);
          if (r) this.stats.evolveReady.push(m.uid);
        }
        if (f === 1) addEv(m, yield_.stat, yield_.n);
        changeFriendship(m, 1);
      }
    }
    _resolveFaints() {
      if (!this.anyAlive(1)) {
        this._finish("win");
        return;
      }
      if (!this.anyAlive(0)) {
        this._finish("lose");
        return;
      }
      if (!canFight(this.active(1))) {
        const next = chooseReplacement(this, 1);
        const idx = next != null ? next : this.firstAlive(1);
        this.sides[0].partic = /* @__PURE__ */ new Set([this.sides[0].idx]);
        this._doSwitch(1, idx, true);
      }
      if (!canFight(this.active(0))) {
        this.awaiting = "switch";
        this._emit({ t: "needSwitch" });
      }
    }
    /** El jugador elige sustituto tras caer su criatura activa. */
    forceSwitch(idx) {
      if (this.awaiting !== "switch") return { ok: false, msg: "No hace falta cambiar.", events: [] };
      const p = this.sides[0].party[idx];
      if (!p || !canFight(p)) return { ok: false, msg: "Esa criatura no puede combatir.", events: [] };
      this.events = [];
      this.awaiting = null;
      this._doSwitch(0, idx, true);
      return { ok: true, events: this.events };
    }
    _finish(result) {
      if (this.result) return;
      this.result = result;
      if (result === "win") {
        this._msg(this.wild ? "\xA1Has ganado el combate!" : `\xA1Has derrotado a ${this.sides[1].name}!`);
      } else if (result === "lose") {
        this._msg("\xA1Te has quedado sin criaturas en condiciones de luchar!");
      }
      this._emit({ t: "end", result });
    }
    /** Resumen para el juego (dinero, captura, etc.). */
    summary() {
      return { result: this.result, captured: this.captured, trainer: this.trainer, turns: this.turnNo, stats: this.stats, evolveReady: this.stats.evolveReady };
    }
  };

  // src/battle_ui.js
  init_config();
  var BALL_COLORS = { capsula: ["#d8453f", "#f4f0e8"], super_capsula: ["#3a7ae0", "#f4f0e8"], ultra_capsula: ["#2a2a3a", "#f2c030"], capsula_red: ["#e8603a", "#ffd0a0"], capsula_noche: ["#1a1a2a", "#6a5ad0"], capsula_veloz: ["#3ab870", "#f4f0e8"], capsula_atlas: ["#8a5ad0", "#f0e8ff"], capsula_maestra: ["#a03ad0", "#ff9ad8"] };
  var BG = {
    hierba: { sky: ["#7ec8f4", "#d4f0ff"], ground: ["#6bc46d", "#3d8f48"], plat: "#5aa85c", deco: "clouds" },
    agua: { sky: ["#6ab8ec", "#cfeaff"], ground: ["#3f90e6", "#2c63c0"], plat: "#4a9ae8", deco: "waves" },
    cueva: { sky: ["#2a2638", "#4a4660"], ground: ["#5a5662", "#3a3644"], plat: "#4a4658", deco: "stalac" },
    nieve: { sky: ["#a8c8e8", "#eef6ff"], ground: ["#f3f8ff", "#cfdcf0"], plat: "#e4eefa", deco: "snow" },
    desierto: { sky: ["#f4c878", "#ffe8b8"], ground: ["#e8c97e", "#c8a85a"], plat: "#d9b86a", deco: "sun" },
    arena: { sky: ["#8ed0f0", "#ffe8c0"], ground: ["#f3e4b2", "#d9c58a"], plat: "#e8d59c", deco: "waves" },
    pantano: { sky: ["#6a8a6a", "#a8c0a0"], ground: ["#5e7a4a", "#3e5a30"], plat: "#4e6a3e", deco: "fog" },
    volcan: { sky: ["#4a1a1a", "#c8502a"], ground: ["#4a3a3a", "#2a1c1c"], plat: "#5a4040", deco: "embers" },
    ruinas: { sky: ["#9a94b8", "#d8d0e8"], ground: ["#b5ad98", "#8f8872"], plat: "#a8a08a", deco: "clouds" },
    interior: { sky: ["#3a3668", "#5a5698"], ground: ["#8a6a4a", "#5a4030"], plat: "#7a5a3c", deco: "lights" },
    liga: { sky: ["#1a1a3a", "#3a2a6a"], ground: ["#2a2a4a", "#14142a"], plat: "#3a3a6a", deco: "lights" }
  };
  var FXCOL = { fuego: ["#ff6a1f", "#ffd24a", "#fff2a0"], agua: ["#3f90e6", "#9ad0ff", "#e0f4ff"], planta: ["#3fa656", "#8ee07a", "#e8ffd0"], electrico: ["#ffe24a", "#fff8a0", "#ffffff"], tierra: ["#a8783c", "#d8b070", "#6a4a24"], roca: ["#8a857a", "#b8b0a0", "#5c5850"], aire: ["#d8e8ff", "#ffffff", "#a8c8f0"], hielo: ["#8ae0ff", "#e0f8ff", "#ffffff"], lucha: ["#ff7a5a", "#ffd0a0", "#ffffff"], veneno: ["#a455c8", "#d89af0", "#7ae060"], mental: ["#f0609a", "#ffb0d0", "#e0a0ff"], sombra: ["#5a4a7a", "#262038", "#9a88c0"], luz: ["#fff2a0", "#ffffff", "#ffd870"], metal: ["#c0ccd8", "#ffffff", "#8a98a8"], insecto: ["#9ac02a", "#e0e060", "#4e6a10"], dragon: ["#5a58d8", "#c05ae0", "#9a9af0"], sonido: ["#e07ac0", "#5ad0c8", "#ffffff"], espiritu: ["#7a78c8", "#bcbaf0", "#68e8c8"] };
  var BattleScene = class {
    /** cfg: {terrain, trainerLook, trainerName, music, weatherName, isGym} */
    constructor(game, battle, cfg = {}) {
      this.g = game;
      this.b = battle;
      this.cfg = cfg;
      this.t = 0;
      this.parts = [];
      this.flashAll = 0;
      this.wipe = 0;
      this.shakeScreen = 0;
      this.spr = [this._blank(), this._blank()];
      this.hpShown = [0, 0];
      this.hpMax = [1, 1];
      this.hpTarget = [0, 0];
      this.xpShown = 0;
      this.weatherLabel = null;
      this.banners = [];
      this.bg = BG[cfg.terrain] || BG.hierba;
      this.trainerSpr = null;
      this.ballAnim = null;
      this.waiters = [];
      this.root = null;
      this.done = null;
    }
    _blank() {
      return { sp: null, variant: null, x: 0, y: 0, scale: 4, ox: 0, oy: 0, a: 0, flash: 0, shake: 0, sink: 0, bobT: Math.random() * 6, hidden: true, tint: null, scaleMul: 1 };
    }
    enter() {
      const g = this.g;
      this.root = el("div", { class: "layer", id: "battleui" });
      g.ui.root.append(this.root);
      this.foeBox = el("div", { class: "panel flat", style: { position: "absolute", left: "28px", top: "26px", width: "340px", padding: "8px 14px" } });
      this.myBox = el("div", { class: "panel flat", style: { position: "absolute", right: "26px", top: "292px", width: "360px", padding: "8px 14px" } });
      this.textBox = el("div", { class: "panel", style: { position: "absolute", left: "20px", right: "20px", bottom: "14px", height: "104px", fontSize: "21px", lineHeight: "1.35" } });
      this.textEl = el("div", { style: { whiteSpace: "pre-wrap" } });
      this.textBox.append(this.textEl);
      this.wxEl = el("div", { class: "panel flat small", style: { position: "absolute", left: "28px", top: "112px", padding: "2px 10px", display: "none" } });
      this.root.append(this.foeBox, this.myBox, this.wxEl, this.textBox);
      this.foeBox.style.display = this.myBox.style.display = "none";
    }
    exit() {
      if (this.root) {
        this.root.remove();
        this.root = null;
      }
    }
    // ---------- bucle visual ----------
    update(dt) {
      this.t += dt;
      for (const s of this.spr) {
        s.bobT += dt;
        if (s.shake > 0) s.shake = Math.max(0, s.shake - dt);
        if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 4);
      }
      if (this.flashAll > 0) this.flashAll = Math.max(0, this.flashAll - dt * 3);
      if (this.shakeScreen > 0) this.shakeScreen = Math.max(0, this.shakeScreen - dt);
      for (const si of [0, 1]) {
        const d = this.hpTarget[si] - this.hpShown[si];
        if (Math.abs(d) > 0.01) {
          const sp = Math.max(this.hpMax[si] * 0.9, 20) * dt;
          this.hpShown[si] += Math.sign(d) * Math.min(Math.abs(d), sp);
          this._renderHp(si);
        }
      }
      for (const p of this.parts) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.g || 0) * dt;
        if (p.spin) p.rot += p.spin * dt;
      }
      this.parts = this.parts.filter((p) => p.life > 0);
      this.banners = this.banners.filter((b) => (b.t -= dt) > 0);
      for (const w of this.waiters.slice()) {
        w.t -= dt;
        if (w.t <= 0) {
          this.waiters.splice(this.waiters.indexOf(w), 1);
          w.res();
        }
      }
    }
    sleep(ms) {
      return new Promise((res) => this.waiters.push({ t: ms / 1e3, res }));
    }
    render(ctx) {
      const sh = this.shakeScreen > 0 ? (Math.random() - 0.5) * 10 : 0;
      ctx.save();
      ctx.translate(sh, sh * 0.6);
      this.drawBg(ctx);
      this.platform(ctx, 690, 238, 150, 34);
      this.platform(ctx, 262, 418, 195, 42);
      if (this.trainerSpr) {
        const t = this.trainerSpr;
        ctx.save();
        ctx.globalAlpha = t.a;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(trainerCanvas(t.look, "down", 0), t.x - 8 * 8, t.y - 24 * 8, 16 * 8, 24 * 8);
        ctx.restore();
      }
      this.drawSprite(ctx, 1);
      this.drawSprite(ctx, 0);
      if (this.ballAnim) this.drawBallAnim(ctx);
      for (const p of this.parts) this.drawPart(ctx, p);
      ctx.restore();
      if (this.flashAll > 0) {
        ctx.fillStyle = `rgba(255,255,255,${this.flashAll})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      if (this.wipe > 0) {
        ctx.fillStyle = "#000";
        const n = 12;
        for (let i = 0; i < n; i++) {
          const w = VIEW_W * this.wipe;
          if (i % 2) ctx.fillRect(VIEW_W - w, i * VIEW_H / n, w, VIEW_H / n + 1);
          else ctx.fillRect(0, i * VIEW_H / n, w, VIEW_H / n + 1);
        }
      }
      let by = 130;
      for (const b of this.banners) {
        ctx.globalAlpha = Math.min(1, b.t * 2);
        ctx.fillStyle = "rgba(20,16,50,.85)";
        ctx.strokeStyle = "#f2d060";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(b.side === 1 ? 28 : VIEW_W - 330, b.side === 1 ? 130 : 262, 300, 26, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(b.text, (b.side === 1 ? 28 : VIEW_W - 330) + 12, (b.side === 1 ? 130 : 262) + 18);
        ctx.globalAlpha = 1;
        by += 30;
      }
    }
    platform(ctx, x, y, rx, ry) {
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.beginPath();
      ctx.ellipse(x, y + 8, rx, ry, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = this.bg.plat;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.18)";
      ctx.beginPath();
      ctx.ellipse(x - 6, y - 5, rx * 0.8, ry * 0.65, 0, 0, 7);
      ctx.fill();
    }
    drawBg(ctx) {
      const b = this.bg, t = this.t;
      let g = ctx.createLinearGradient(0, 0, 0, 300);
      g.addColorStop(0, b.sky[0]);
      g.addColorStop(1, b.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, 300);
      g = ctx.createLinearGradient(0, 270, 0, VIEW_H);
      g.addColorStop(0, b.ground[0]);
      g.addColorStop(1, b.ground[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 270, VIEW_W, VIEW_H - 270);
      if (b.deco === "clouds") {
        ctx.fillStyle = "rgba(255,255,255,.7)";
        for (let i = 0; i < 5; i++) {
          const x = (i * 230 + t * 8) % 1100 - 120;
          ctx.beginPath();
          ctx.ellipse(x, 60 + i % 3 * 38, 70, 20, 0, 0, 7);
          ctx.ellipse(x + 40, 52 + i % 3 * 38, 45, 18, 0, 0, 7);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(60,140,90,.5)";
        for (const [hx, hw] of [[120, 260], [520, 340], [880, 240]]) {
          ctx.beginPath();
          ctx.ellipse(hx, 272, hw, 70, 0, Math.PI, 0);
          ctx.fill();
        }
      } else if (b.deco === "waves") {
        ctx.strokeStyle = "rgba(255,255,255,.45)";
        ctx.lineWidth = 2;
        for (let r = 0; r < 6; r++) {
          ctx.beginPath();
          for (let x = 0; x <= VIEW_W; x += 12) ctx.lineTo(x, 300 + r * 30 + Math.sin(x * 0.04 + t * 2 + r) * 4);
          ctx.stroke();
        }
      } else if (b.deco === "stalac") {
        ctx.fillStyle = "#26222e";
        for (let i = 0; i < 16; i++) {
          const x = i * 64 + i * 37 % 30, h = 40 + i * 53 % 70;
          ctx.beginPath();
          ctx.moveTo(x - 22, 0);
          ctx.lineTo(x + 22, 0);
          ctx.lineTo(x, h);
          ctx.fill();
        }
      } else if (b.deco === "snow") {
        ctx.fillStyle = "rgba(255,255,255,.9)";
        for (let i = 0; i < 60; i++) {
          const x = (i * 97 + t * 20 * (i % 3 + 1)) % VIEW_W, y = (i * 53 + t * 40) % 300;
          ctx.fillRect(x, y, 3, 3);
        }
        ctx.fillStyle = "rgba(200,220,245,.8)";
        for (const [hx, hw] of [[160, 300], [640, 360]]) {
          ctx.beginPath();
          ctx.ellipse(hx, 276, hw, 80, 0, Math.PI, 0);
          ctx.fill();
        }
      } else if (b.deco === "sun") {
        ctx.fillStyle = "rgba(255,240,170,.8)";
        ctx.beginPath();
        ctx.arc(780, 90, 54, 0, 7);
        ctx.fill();
        ctx.fillStyle = "rgba(200,150,80,.6)";
        for (const [hx, hw] of [[200, 320], [700, 380]]) {
          ctx.beginPath();
          ctx.ellipse(hx, 276, hw, 56, 0, Math.PI, 0);
          ctx.fill();
        }
      } else if (b.deco === "fog") {
        ctx.fillStyle = "rgba(220,230,210,.25)";
        for (let i = 0; i < 4; i++) {
          const x = (i * 300 + t * 14) % 1300 - 200;
          ctx.beginPath();
          ctx.ellipse(x, 220 + i * 18, 260, 36, 0, 0, 7);
          ctx.fill();
        }
      } else if (b.deco === "embers") {
        ctx.fillStyle = "#ffa24a";
        for (let i = 0; i < 40; i++) {
          const x = i * 71 % VIEW_W, y = 300 - (i * 43 + t * 40 * (i % 3 + 1)) % 300;
          ctx.fillRect(x, y, 3, 3);
        }
      } else if (b.deco === "lights") {
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = `rgba(255,${200 + i * 5},120,${0.18 + 0.1 * Math.sin(t * 2 + i)})`;
          ctx.beginPath();
          ctx.arc(60 + i * 110, 40 + i % 2 * 22, 26, 0, 7);
          ctx.fill();
        }
      }
      if (this.cfg.night) {
        ctx.fillStyle = "rgba(20,28,90,.38)";
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      if (this.b.weather) {
        const w = this.b.weather.id;
        if (w === "lluvia" || w === "tormenta") {
          ctx.strokeStyle = "rgba(190,215,255,.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 90; i++) {
            const x = (i * 83 + t * 300) % (VIEW_W + 60) - 30, y = (i * 47 + t * 700) % VIEW_H;
            ctx.moveTo(x, y);
            ctx.lineTo(x - 5, y + 14);
          }
          ctx.stroke();
        } else if (w === "granizo") {
          ctx.fillStyle = "rgba(255,255,255,.9)";
          for (let i = 0; i < 70; i++) ctx.fillRect((i * 83 + t * 40) % VIEW_W, (i * 47 + t * 160) % VIEW_H, 3, 3);
        } else if (w === "arena") {
          ctx.fillStyle = "rgba(210,170,100,.28)";
          ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        } else if (w === "niebla") {
          ctx.fillStyle = "rgba(225,232,245,.3)";
          ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        } else if (w === "soleado" || w === "calor") {
          ctx.fillStyle = "rgba(255,220,120,.12)";
          ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        }
      }
    }
    drawSprite(ctx, si) {
      const s = this.spr[si];
      if (s.hidden || !s.sp) return;
      const scale = s.scale * s.scaleMul;
      const bob = Math.sin(s.bobT * 2.4) * 3;
      let sx = s.x + s.ox, sy = s.y + s.oy + bob + s.sink;
      if (s.shake > 0) sx += Math.sin(s.shake * 70) * 9;
      const w = SPR * scale;
      ctx.save();
      ctx.globalAlpha = s.a;
      ctx.imageSmoothingEnabled = false;
      const cv = creatureCanvas(s.sp, s.variant);
      ctx.translate(sx, sy);
      if (si === 0) {
        ctx.scale(-1, 1);
      }
      if (s.sink) ctx.beginPath(), ctx.rect(-w, -w, w * 2, w - -s.sink + 8), ctx.clip();
      ctx.drawImage(cv, -w / 2, -w + 6, w, w);
      if (s.flash > 0 || s.tint) {
        const tmp = this._tmp || (this._tmp = document.createElement("canvas"));
        tmp.width = tmp.height = SPR;
        const tg = tmp.getContext("2d");
        tg.clearRect(0, 0, SPR, SPR);
        tg.drawImage(cv, 0, 0);
        tg.globalCompositeOperation = "source-atop";
        tg.fillStyle = s.tint || "#fff";
        tg.globalAlpha = s.tint ? 0.55 : Math.min(1, s.flash);
        tg.fillRect(0, 0, SPR, SPR);
        tg.globalCompositeOperation = "source-over";
        ctx.drawImage(tmp, -w / 2, -w + 6, w, w);
      }
      ctx.restore();
    }
    drawPart(ctx, p) {
      const a = Math.max(0, Math.min(1, p.life / (p.max || 0.5)));
      ctx.save();
      ctx.globalAlpha = a * (p.alpha ?? 1);
      ctx.fillStyle = p.col;
      ctx.strokeStyle = p.col;
      if (p.shape === "ring") {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 3), 0, 7);
        ctx.stroke();
      } else if (p.shape === "line") {
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.06, p.y + p.vy * 0.06);
        ctx.stroke();
      } else if (p.shape === "zig") {
        ctx.lineWidth = 5;
        ctx.beginPath();
        let x = p.x, y = p.y - 80;
        ctx.moveTo(x, y);
        for (let i = 0; i < 6; i++) {
          x += i % 2 ? 14 : -14;
          y += 24;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (p.shape === "leaf") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size / 2.4, 0, 0, 7);
        ctx.fill();
      } else if (p.shape === "star") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? p.size * 0.4 : p.size;
          ctx.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r);
        }
        ctx.fill();
      } else if (p.shape === "arrow") {
        ctx.translate(p.x, p.y);
        ctx.beginPath();
        const d = p.dir || -1;
        ctx.moveTo(0, d * 12);
        ctx.lineTo(-9, -d * 4);
        ctx.lineTo(9, -d * 4);
        ctx.fill();
      } else if (p.shape === "beam") {
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    }
    drawBallAnim(ctx) {
      const b = this.ballAnim;
      const [c1, c2] = BALL_COLORS[b.ball] || BALL_COLORS.capsula;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot || 0);
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.arc(0, 0, 18, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = "#1a1226";
      ctx.fillRect(-18, -2, 36, 4);
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, 7);
      ctx.fill();
      ctx.fillStyle = b.glow ? "#fff2a0" : "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#1a1226";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, 7);
      ctx.stroke();
      ctx.restore();
    }
    // ---------- efectos de partículas ----------
    addPart(o) {
      this.parts.push({ life: 0.6, max: 0.6, col: "#fff", size: 4, vx: 0, vy: 0, shape: "dot", rot: 0, ...o });
    }
    spriteCenter(si) {
      const s = this.spr[si];
      return [s.x + s.ox, s.y + s.oy - SPR * s.scale * 0.5];
    }
    /** Efecto visual de un movimiento. Devuelve la duración (ms). */
    moveFx(type, cat, fromSide, selfTarget) {
      const cols = FXCOL[type] || FXCOL.lucha;
      const to = this.spriteCenter(selfTarget ? fromSide : 1 - fromSide), from = this.spriteCenter(fromSide);
      const R = Math.random, add = (o) => this.addPart(o);
      if (selfTarget) {
        for (let i = 0; i < 12; i++) add({ x: to[0] + (R() - 0.5) * 120, y: to[1] + 50 + R() * 40, vy: -120 - R() * 80, col: cols[i % 3], size: 4 + R() * 3, life: 0.9, max: 0.9 });
        return 700;
      }
      const dx = to[0] - from[0], dy = to[1] - from[1];
      const proj = (n, shape, size, spread = 14) => {
        for (let i = 0; i < n; i++) {
          const d = 0.35;
          add({ x: from[0], y: from[1], vx: dx / d + (R() - 0.5) * spread * 4, vy: dy / d + (R() - 0.5) * spread * 4, col: cols[i % 3], size: size + R() * 3, life: d + 0.05 + i * 0.01, max: 0.45, shape, rot: R() * 6, spin: (R() - 0.5) * 10 });
        }
      };
      const burst = (n, shape = "dot", size = 5, sp = 220, g = 0) => {
        for (let i = 0; i < n; i++) {
          const a = R() * 6.28, v = sp * (0.4 + R() * 0.8);
          add({ x: to[0], y: to[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, col: cols[i % 3], size: size + R() * 3, life: 0.5 + R() * 0.3, max: 0.7, shape, g, rot: R() * 6, spin: (R() - 0.5) * 12 });
        }
      };
      switch (type) {
        case "fuego":
          for (let i = 0; i < 20; i++) add({ x: from[0] + dx * (i / 20), y: from[1] + dy * (i / 20), vy: -60, col: cols[i % 3], size: 9 + R() * 6, life: 0.4 + i * 0.03, max: 0.8 });
          burst(22, "dot", 6, 160, -120);
          return 800;
        case "agua":
          proj(16, "dot", 5);
          setTimeout(() => burst(18, "dot", 5, 200, 600), 350);
          return 900;
        case "planta":
          proj(12, "leaf", 9);
          setTimeout(() => burst(10, "leaf", 8, 150, 120), 350);
          return 900;
        case "electrico":
          for (let i = 0; i < 3; i++) setTimeout(() => add({ x: to[0] + (R() - 0.5) * 60, y: to[1], col: cols[i % 2], shape: "zig", life: 0.22, max: 0.22 }), i * 150);
          this.flashAll = 0.4;
          burst(12, "star", 6, 200);
          return 800;
        case "tierra":
        case "roca":
          for (let i = 0; i < 10; i++) add({ x: to[0] + (R() - 0.5) * 140, y: to[1] - 220 - R() * 100, vy: 520, col: cols[i % 3], size: 8 + R() * 6, life: 0.6, max: 0.6 });
          setTimeout(() => {
            burst(14, "dot", 6, 220, 500);
            this.shakeScreen = 0.25;
          }, 450);
          return 950;
        case "aire":
          for (let i = 0; i < 16; i++) add({ x: from[0], y: from[1] + (R() - 0.5) * 80, vx: dx / 0.4, vy: dy / 0.4 + (R() - 0.5) * 100, col: cols[i % 3], size: 3, shape: "line", life: 0.45, max: 0.45 });
          setTimeout(() => burst(10, "dot", 4, 240), 380);
          return 800;
        case "hielo":
          burst(16, "star", 8, 140);
          for (let i = 0; i < 12; i++) add({ x: to[0] + (R() - 0.5) * 120, y: to[1] - 120, vy: 140, col: cols[i % 3], size: 6, shape: "star", life: 0.8, max: 0.8, spin: 5 });
          return 900;
        case "lucha":
          add({ x: to[0], y: to[1], col: cols[0], shape: "star", size: 50, life: 0.35, max: 0.35 });
          burst(12, "star", 7, 260);
          this.shakeScreen = 0.15;
          return 600;
        case "veneno":
          for (let i = 0; i < 14; i++) add({ x: to[0] + (R() - 0.5) * 90, y: to[1] + 50, vy: -90 - R() * 60, col: cols[i % 3], size: 6 + R() * 6, life: 0.9, max: 0.9 });
          return 800;
        case "mental":
          for (let i = 0; i < 3; i++) setTimeout(() => add({ x: to[0], y: to[1], col: cols[i % 3], shape: "ring", size: 20, life: 0.6, max: 0.6 }), i * 160);
          return 800;
        case "sombra":
          for (let i = 0; i < 18; i++) add({ x: to[0] + (R() - 0.5) * 140, y: to[1] + (R() - 0.5) * 140, vx: (R() - 0.5) * 60, vy: -30, col: cols[i % 3], size: 10 + R() * 12, life: 0.9, max: 0.9, alpha: 0.7 });
          return 850;
        case "luz":
          for (let i = 0; i < 6; i++) add({ x: to[0] + (i - 3) * 22, y: to[1] - 200, x2: to[0] + (i - 3) * 22, y2: to[1] + 90, col: cols[i % 3], shape: "beam", size: 10, life: 0.5, max: 0.5 });
          this.flashAll = 0.3;
          burst(10, "star", 6, 160);
          return 800;
        case "metal":
          for (let i = 0; i < 3; i++) setTimeout(() => add({ x: to[0] - 60 + i * 20, y: to[1] - 70, x2: to[0] + 60 + i * 20, y2: to[1] + 70, col: cols[i % 2], shape: "beam", size: 7, life: 0.25, max: 0.25 }), i * 120);
          burst(10, "star", 5, 220);
          return 750;
        case "insecto":
          proj(18, "dot", 3, 40);
          burst(10, "dot", 3, 100);
          return 800;
        case "dragon":
          for (let i = 0; i < 24; i++) {
            const a = i * 0.5;
            add({ x: to[0] + Math.cos(a) * i * 3, y: to[1] + Math.sin(a) * i * 3, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, col: cols[i % 3], size: 8, life: 0.4 + i * 0.03, max: 0.9 });
          }
          this.shakeScreen = 0.2;
          return 900;
        case "sonido":
          for (let i = 0; i < 4; i++) setTimeout(() => add({ x: from[0], y: from[1], vx: dx / 0.4, vy: dy / 0.4, col: cols[i % 3], shape: "ring", size: 14, life: 0.5, max: 0.5 }), i * 120);
          return 850;
        case "espiritu":
          for (let i = 0; i < 14; i++) add({ x: to[0] + (R() - 0.5) * 100, y: to[1] + 60, vx: (R() - 0.5) * 40, vy: -100 - R() * 60, col: cols[i % 3], size: 6 + R() * 5, life: 1, max: 1, alpha: 0.8 });
          return 900;
        default:
          burst(14, "star", 6, 220);
          return 650;
      }
    }
    // ---------- cajas de información ----------
    _renderBox(si, snap) {
      const box = si === 0 ? this.myBox : this.foeBox;
      const g = this.g;
      if (!snap) return;
      const mon = this.b.sides[si].party[snap.idx];
      box.style.display = "";
      box.innerHTML = "";
      const caught = si === 1 && this.b.wild && g.dex.caught[snap.sp];
      const types = getSpecies(snap.sp).types.map(typeChip);
      const nameRow = el("div", { class: "row", style: { justifyContent: "space-between" } }, [el("div", { style: { fontWeight: 700, fontSize: "19px" } }, [snap.name, statusBadge(snap.status), caught ? el("span", { title: "Ya capturada", style: { marginLeft: "6px", fontSize: "13px", color: "#f2d060" } }, "\u25D3") : null]), el("div", { class: "gold", style: { fontWeight: 700 } }, "Nv " + snap.lv)]);
      box.append(nameRow, el("div", { style: { margin: "2px 0" } }, types));
      this.hpEls = this.hpEls || [];
      const bar = el("div", { class: "hpbar" }, el("i"));
      const txt = el("div", { class: "small dim", style: { textAlign: "right" } });
      box.append(bar);
      if (si === 0) {
        box.append(txt);
        const xp = el("div", { class: "xpbar", style: { marginTop: "4px" } }, el("i"));
        box.append(xp);
        this.xpEl = xp.firstChild;
        this.xpEl.style.width = xpProgress(mon) * 100 + "%";
      }
      this.hpEls[si] = { bar, txt };
      this.hpMax[si] = snap.maxHp;
      this.hpShown[si] = snap.hp;
      this.hpTarget[si] = snap.hp;
      this._renderHp(si);
    }
    _renderHp(si) {
      const e = this.hpEls?.[si];
      if (!e) return;
      const p = clamp(this.hpShown[si] / this.hpMax[si], 0, 1);
      e.bar.className = "hpbar " + (p <= 0.2 ? "low" : p <= 0.5 ? "mid" : "");
      e.bar.firstChild.style.width = p * 100 + "%";
      e.bar.firstChild.style.transition = "none";
      if (si === 0) e.txt.textContent = `${Math.ceil(this.hpShown[si])} / ${this.hpMax[si]}`;
    }
    _refreshBadge(si) {
      const snap = { ...this._snapOf(si) };
      this._renderBox(si, snap);
    }
    _snapOf(si) {
      const m = this.b.active(si);
      return { side: si, idx: this.b.sides[si].idx, sp: m.sp, name: displayName(m), lv: m.lv, hp: m.hp, maxHp: m.maxHp, status: m.status };
    }
    // ---------- texto ----------
    async say(text, { wait = true, hold = 0 } = {}) {
      const g = this.g;
      this.textEl.textContent = "";
      const speed = g.ui.speed;
      let i = 0;
      const full = g.t(text);
      let skip = false;
      const off = g.input.push((a) => {
        if (a === "confirm" || a === "cancel") skip = true;
      });
      const click = () => skip = true;
      this.textBox.addEventListener("click", click);
      while (i < full.length) {
        if (skip) {
          i = full.length;
        } else i += Math.max(1, Math.round(speed / 30));
        this.textEl.textContent = full.slice(0, i);
        await this.sleep(33);
      }
      this.textEl.textContent = full;
      if (wait) {
        skip = false;
        const ms = hold || (g.settings.textSpeed === "instantaneo" ? 250 : 520 + Math.min(900, full.length * 12));
        let t = 0;
        while (t < ms && !skip) {
          await this.sleep(40);
          t += 40;
        }
      }
      off();
      this.textBox.removeEventListener("click", click);
    }
    async confirmWait() {
      return new Promise((res) => {
        const off = this.g.input.push((a) => {
          if (a === "confirm" || a === "cancel") {
            off();
            res();
          }
        });
      });
    }
    // ---------- reproducción de eventos ----------
    async play(events) {
      const g = this.g, au = g.audio;
      for (const e of events) {
        switch (e.t) {
          case "msg":
            await this.say(e.text);
            break;
          case "move": {
            this.currentMove = e;
            await this.say(e.text, { hold: 250 });
            const s = this.spr[e.side];
            const dir = e.side === 0 ? 1 : -1;
            if (!e.self && e.cat !== "est") {
              s.ox = 0;
              for (let k = 0; k < 6; k++) {
                s.ox = dir * (k < 3 ? k * 14 : (6 - k) * 14);
                await this.sleep(22);
              }
              s.ox = 0;
            }
            const ms = this.moveFx(e.type, e.cat, e.side, e.self);
            await this.sleep(Math.min(ms, g.settings.battleAnim ? ms : 150));
            break;
          }
          case "dmg": {
            const s = this.spr[e.side];
            if (e.amount > 0 || e.shield) {
              s.flash = 1;
              s.shake = 0.3;
              au.sfx(e.crit ? "crit" : e.eff > 1 ? "supereff" : e.eff < 1 && e.eff > 0 ? "resist" : "hit");
            }
            this.hpMax[e.side] = e.maxHp;
            this.hpTarget[e.side] = e.hp;
            await this.sleep(Math.min(900, 250 + Math.abs(this.hpShown[e.side] - e.hp) / e.maxHp * 900));
            break;
          }
          case "heal":
            if (e.active !== false) {
              this.hpMax[e.side] = e.maxHp;
              this.hpTarget[e.side] = e.hp;
              au.sfx("heal");
              for (let i = 0; i < 8; i++) {
                const c = this.spriteCenter(e.side);
                this.addPart({ x: c[0] + (Math.random() - 0.5) * 90, y: c[1] + 40, vy: -90, col: "#8ff0a0", size: 5, life: 0.8, max: 0.8 });
              }
              await this.sleep(500);
            }
            break;
          case "status":
            au.sfx("status");
            this._refreshBadge(e.side);
            {
              const c = this.spriteCenter(e.side);
              for (let i = 0; i < 6; i++) this.addPart({ x: c[0] + (Math.random() - 0.5) * 80, y: c[1], vy: -60, col: STATUS[e.status].color, size: 6, life: 0.7, max: 0.7 });
            }
            await this.sleep(350);
            break;
          case "statusClear":
            this._refreshBadge(e.side);
            break;
          case "confuse":
            au.sfx("status");
            {
              const c = this.spriteCenter(e.side);
              for (let i = 0; i < 5; i++) this.addPart({ x: c[0] + Math.cos(i * 1.26) * 40, y: c[1] - 80 + Math.sin(i * 1.26) * 10, col: "#ffe24a", shape: "star", size: 8, life: 0.9, max: 0.9, spin: 6 });
            }
            await this.sleep(400);
            break;
          case "stat": {
            au.sfx(e.n > 0 ? "buff" : "debuff");
            const c = this.spriteCenter(e.side);
            for (let i = 0; i < 6; i++) this.addPart({ x: c[0] + (i - 3) * 22, y: c[1] + (e.n > 0 ? 40 : -40), vy: e.n > 0 ? -90 : 90, shape: "arrow", dir: e.n > 0 ? -1 : 1, col: e.n > 0 ? "#8ff0a0" : "#ff8a9a", life: 0.9, max: 0.9 });
            await this.sleep(450);
            break;
          }
          case "miss":
            au.sfx("cancel");
            break;
          case "protect":
          case "barrier":
          case "shield":
            au.sfx("buff");
            break;
          case "ability":
            this.banners.push({ side: e.side, text: "\u2726 " + e.name, t: 1.4 });
            au.sfx("select");
            break;
          case "weather":
            this.weatherLabel = e.id;
            this._renderWeather();
            break;
          case "send":
            await this.onSend(e);
            break;
          case "faint": {
            const s = this.spr[e.side];
            au.sfx("faint");
            for (let k = 0; k <= 10; k++) {
              s.sink = k * 22;
              s.a = 1 - k / 10;
              await this.sleep(45);
            }
            s.hidden = true;
            s.sink = 0;
            s.a = 1;
            break;
          }
          case "xp":
            if (e.active) {
              const m = this.b.sides[0].party[this.b.sides[0].idx];
              this.xpEl && (this.xpEl.style.transition = "width .7s linear", this.xpEl.style.width = xpProgress(m) * 100 + "%");
            }
            break;
          case "levelup":
            await this.onLevelUp(e);
            break;
          case "capture":
            await this.onCapture(e);
            break;
          case "flee":
            if (e.success) {
              au.sfx("flee");
              const s = this.spr[e.side === 1 ? 1 : 0];
              for (let k = 0; k < 10; k++) {
                s.ox += e.side === 1 ? 40 : -40;
                s.a = 1 - k / 10;
                await this.sleep(35);
              }
              s.hidden = true;
            } else au.sfx("error");
            break;
          case "needSwitch":
            break;
          case "noEffect":
            au.sfx("resist");
            break;
          default:
            break;
        }
      }
    }
    _renderWeather() {
      const id = this.weatherLabel;
      if (!id) {
        this.wxEl.style.display = "none";
        return;
      }
      const names = { soleado: "\u2600 Sol intenso", lluvia: "\u{1F327} Lluvia", tormenta: "\u26C8 Tormenta", arena: "\u{1F32A} Tormenta de arena", granizo: "\u2744 Granizo", niebla: "\u{1F32B} Niebla", calor: "\u{1F525} Calor sofocante" };
      this.wxEl.style.display = "";
      this.wxEl.textContent = names[id] || id;
    }
    async onSend(e) {
      const s = this.spr[e.side], g = this.g;
      s.sp = e.sp;
      s.variant = e.variant;
      s.hidden = false;
      s.sink = 0;
      s.a = 1;
      s.ox = 0;
      if (e.first && e.side === 1 && this.b.wild) {
      }
      if (e.side === 1) {
        this.b.sides[0].partic;
        g.registerSeen(e.sp);
      }
      this._renderBox(e.side, { ...e, idx: e.idx });
      s.scaleMul = 0.2;
      s.flash = 1;
      g.audio.sfx("throw");
      for (let k = 1; k <= 8; k++) {
        s.scaleMul = 0.2 + k / 8 * 0.8;
        await this.sleep(28);
      }
      s.scaleMul = 1;
      g.audio.cry(e.sp, getSpecies(e.sp).legendary);
      await this.sleep(300);
    }
    async onLevelUp(e) {
      const g = this.g;
      g.audio.sfx("levelup");
      if (e.active) {
        this.hpMax[0] = e.maxHp;
        this.hpTarget[0] = e.hp;
      }
      await this.say(`\xA1${e.name} subi\xF3 al nivel ${e.lv}!`, { wait: false });
      const panel = el("div", { class: "panel", style: { position: "absolute", right: "30px", top: "110px", width: "260px", zIndex: 5 } }, [
        el("div", { class: "title", style: { fontSize: "18px" } }, `${e.name} Nv ${e.lv}`),
        ...STAT_KEYS.map((k) => el("div", { class: "stat", style: { gridTemplateColumns: "90px 1fr 50px" } }, [el("span", { class: "dim" }, STAT_NAMES[k]), el("span", { class: "good" }, "+" + (e.gains[k] || 0)), el("b", {}, String(e.stats[k]))]))
      ]);
      this.root.append(panel);
      await this.sleep(600);
      await this.confirmWait();
      panel.remove();
    }
    async onCapture(e) {
      const g = this.g, foe = this.spr[1];
      const [c1] = [0];
      const start = [200, 380], end = this.spriteCenter(1);
      this.ballAnim = { ball: e.ball, x: start[0], y: start[1], rot: 0 };
      g.audio.sfx("throw");
      const dur = 650;
      const t0 = this.t;
      while (this.t - t0 < dur / 1e3) {
        const k = (this.t - t0) / (dur / 1e3);
        this.ballAnim.x = start[0] + (end[0] - start[0]) * k;
        this.ballAnim.y = start[1] + (end[1] - start[1]) * k - Math.sin(k * Math.PI) * 170;
        this.ballAnim.rot = k * 14;
        await this.sleep(16);
      }
      this.flashAll = 0.5;
      g.audio.sfx("select");
      for (let k = 0; k <= 8; k++) {
        foe.scaleMul = 1 - k / 8 * 0.9;
        foe.a = 1 - k / 8;
        foe.tint = "#ffffff";
        await this.sleep(30);
      }
      foe.hidden = true;
      foe.tint = null;
      const gy = 262;
      while (this.ballAnim.y < gy) {
        this.ballAnim.y += 18;
        this.ballAnim.x = end[0];
        await this.sleep(16);
      }
      this.ballAnim.y = gy;
      await this.sleep(400);
      for (let i = 0; i < e.shakes; i++) {
        g.audio.sfx("shake");
        for (let k = 0; k < 12; k++) {
          this.ballAnim.rot = Math.sin(k / 12 * Math.PI * 2) * 0.5;
          await this.sleep(30);
        }
        this.ballAnim.rot = 0;
        await this.sleep(480);
      }
      if (e.success) {
        this.ballAnim.glow = true;
        g.audio.sfx("caught");
        g.audio.duck(1800);
        for (let i = 0; i < 22; i++) this.addPart({ x: this.ballAnim.x, y: this.ballAnim.y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 260, col: ["#fff2a0", "#fff", "#ffd24a"][i % 3], shape: "star", size: 8, life: 0.9, max: 0.9, spin: 5, g: 300 });
        await this.sleep(900);
      } else {
        g.audio.sfx("escape");
        this.flashAll = 0.5;
        this.ballAnim = null;
        foe.hidden = false;
        foe.a = 1;
        foe.scaleMul = 1;
        foe.tint = null;
        await this.sleep(300);
      }
    }
    // ---------- menús de acción ----------
    async chooseAction() {
      const g = this.g, b = this.b, me = b.active(0);
      this.textEl.textContent = g.t(`\xBFQu\xE9 har\xE1 ${displayName(me)}?`);
      const items = [{ label: "\u2694 Luchar", value: "fight" }];
      if (b.canCapture) items.push({ label: "\u25D3 Capturar", value: "capture" });
      items.push({ label: "\u{1F392} Mochila", value: "bag" }, { label: "\u{1F43E} Equipo", value: "party" }, { label: "\u{1F3C3} Huir", value: "flee" });
      for (; ; ) {
        const pick = await g.ui.menu(items, { parent: this.textBox, panel: true, cols: 3, cancel: void 0, style: { right: "12px", top: "10px", bottom: "10px", left: "46%", gridTemplateColumns: "repeat(3,1fr)", display: "grid", gap: "4px 8px", minWidth: "0", maxHeight: "none", padding: "4px 6px" } });
        if (pick === "fight") {
          const a = await this.chooseMove();
          if (a) return a;
        } else if (pick === "capture") {
          const a = await this.chooseBall();
          if (a) return a;
        } else if (pick === "bag") {
          const a = await this.chooseItem();
          if (a) return a;
        } else if (pick === "party") {
          const a = await this.chooseSwitch(false);
          if (a) return a;
        } else if (pick === "flee") {
          if (!b.canFlee) {
            g.audio.sfx("error");
            await this.say(b.wild ? "\xA1No puedes huir!" : "\xA1No puedes huir de un combate contra un entrenador!", { hold: 400 });
            this.textEl.textContent = g.t(`\xBFQu\xE9 har\xE1 ${displayName(me)}?`);
            continue;
          }
          return { type: "flee" };
        }
      }
    }
    async chooseMove() {
      const g = this.g, b = this.b, me = b.active(0), foe = b.active(1);
      const known = g.dex.caught[foe.sp];
      const foeTypes = getSpecies(foe.sp).types;
      const infoEl = el("div", { class: "small", style: { position: "absolute", left: "16px", top: "12px", width: "44%" } });
      this.textBox.append(infoEl);
      this.textEl.textContent = "";
      const allOut = me.moves.every((m) => m.pp <= 0);
      const items = me.moves.map((m, i) => {
        const mv = getMove(m.id);
        return { label: mv.name, value: i, disabled: m.pp <= 0, hint: `${m.pp}/${m.max}`, icon: el("span", { class: "chip", style: { background: TYPES[mv.type].color, padding: "0 6px" } }, TYPES[mv.type].name.slice(0, 3)) };
      });
      if (allOut) items.push({ label: "Forcejeo", value: -1 });
      const show = (it) => {
        if (!it) return;
        const mv = it.value >= 0 ? getMove(me.moves[it.value].id) : null;
        if (!mv) {
          infoEl.textContent = "Sin PP: atacas desesperadamente.";
          return;
        }
        const eff = mv.cat !== "est" && known ? effectiveness(mv.type, foeTypes) : null;
        infoEl.innerHTML = "";
        infoEl.append(el("div", {}, [typeChip(mv.type), el("span", { class: "dim" }, ` ${mv.cat === "fis" ? "F\xEDsico" : mv.cat === "esp" ? "Especial" : "Estado"} \xB7 Pot ${mv.pow || "\u2014"} \xB7 Prec ${mv.acc || "\u2014"}`)]), el("div", { class: "dim", style: { marginTop: "4px" } }, mv.desc), eff != null && eff !== 1 ? el("div", { class: eff > 1 ? "good" : "bad", style: { fontWeight: 700 } }, effectLabel(eff)) : null);
      };
      const r = await g.ui.menu(items, { parent: this.textBox, panel: true, cols: 2, cancel: null, onChange: show, style: { right: "12px", top: "10px", bottom: "10px", left: "48%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px", minWidth: "0", maxHeight: "none", padding: "4px 6px" } });
      infoEl.remove();
      if (r === null) return null;
      return { type: "move", idx: r };
    }
    async chooseBall() {
      const g = this.g, list = bagList(g.bag, "capturas");
      if (!list.length) {
        await this.say("\xA1No te quedan c\xE1psulas!", { hold: 400 });
        this.textEl.textContent = "";
        return null;
      }
      const foe = this.b.active(1);
      const items = list.map(({ item, n }) => ({ label: item.name, value: item.id, hint: "\xD7" + n }));
      this.textEl.textContent = "";
      const infoEl = el("div", { class: "small", style: { position: "absolute", left: "16px", top: "12px", width: "44%" } });
      this.textBox.append(infoEl);
      const r = await g.ui.menu(items, { parent: this.textBox, panel: true, cancel: null, onChange: (it) => {
        if (!it) return;
        const d = getItem(it.value);
        infoEl.textContent = d.desc;
      }, style: { right: "12px", top: "6px", bottom: "6px", left: "48%", minWidth: "0", maxHeight: "none", padding: "4px 6px", overflow: "auto" } });
      infoEl.remove();
      if (!r) return null;
      return { type: "capture", ball: r };
    }
    async chooseItem() {
      const g = this.g;
      const list = bagList(g.bag).filter(({ item }) => (item.use === "both" || item.use === "battle") && !item.fx.ball);
      if (!list.length) {
        await this.say("No tienes objetos utilizables en combate.", { hold: 400 });
        this.textEl.textContent = "";
        return null;
      }
      const items = list.map(({ item, n }) => ({ label: item.name, value: item.id, hint: "\xD7" + n }));
      this.textEl.textContent = "";
      const infoEl = el("div", { class: "small", style: { position: "absolute", left: "16px", top: "12px", width: "44%" } });
      this.textBox.append(infoEl);
      const r = await g.ui.menu(items, { parent: this.textBox, panel: true, cancel: null, onChange: (it) => {
        if (it) infoEl.textContent = getItem(it.value).desc;
      }, style: { right: "12px", top: "6px", bottom: "6px", left: "48%", minWidth: "0", maxHeight: "none", padding: "4px 6px", overflow: "auto" } });
      infoEl.remove();
      if (!r) return null;
      const tgt = await this.pickPartyMember(`\xBFA qui\xE9n usar ${getItem(r).name}?`);
      if (tgt == null) return null;
      return { type: "item", id: r, target: tgt };
    }
    /** Selector de miembro del equipo (pantalla propia). Devuelve índice o null. */
    pickPartyMember(title, { allowFainted = true, disabledFn = null } = {}) {
      const g = this.g, party = this.b.sides[0].party;
      return new Promise((resolve2) => {
        const items = party.map((c, i) => ({ label: `${displayName(c)}  Nv${c.lv}`, value: i, hint: c.hp > 0 ? `${c.hp}/${c.maxHp}` : "Debilitado", disabled: disabledFn ? disabledFn(c, i) : false, icon: creatureImg(c.sp, 30, c.variant) }));
        const wrap = el("div", { class: "panel", style: { position: "absolute", left: "240px", top: "60px", width: "480px", zIndex: 8 } }, [el("div", { class: "title" }, title)]);
        this.root.append(wrap);
        g.ui.menu(items, { parent: wrap, cancel: null }).then((r) => {
          wrap.remove();
          resolve2(r);
        });
      });
    }
    async chooseSwitch(forced) {
      const b = this.b, g = this.g;
      const r = await this.pickPartyMember(forced ? "Elige a tu siguiente criatura" : "Cambiar de criatura", { disabledFn: (c, i) => !canFight(c) || i === b.sides[0].idx });
      if (r == null) return null;
      return { type: "switch", idx: r };
    }
    // ---------- flujo principal ----------
    async intro() {
      const g = this.g, b = this.b;
      g.audio.sfx("encounter");
      this.wipe = 1;
      for (let k = 10; k >= 0; k--) {
        this.wipe = k / 10;
        await this.sleep(40);
      }
      this.spr[1].x = 690;
      this.spr[1].y = 238;
      this.spr[1].scale = 4;
      this.spr[0].x = 262;
      this.spr[0].y = 418;
      this.spr[0].scale = 5;
      if (b.wild) {
        const e = b.active(1);
        this.spr[1].sp = e.sp;
        this.spr[1].variant = e.variant;
        this.spr[1].hidden = false;
        this.spr[1].a = 1;
        this.spr[1].scaleMul = 0.3;
        for (let k = 1; k <= 8; k++) {
          this.spr[1].scaleMul = 0.3 + k / 8 * 0.7;
          this.spr[1].ox = (8 - k) * 30;
          await this.sleep(30);
        }
        this.spr[1].ox = 0;
      } else if (this.cfg.trainerLook) {
        this.trainerSpr = { look: this.cfg.trainerLook, x: 690, y: 258, a: 0 };
        for (let k = 0; k <= 8; k++) {
          this.trainerSpr.a = k / 8;
          await this.sleep(35);
        }
      }
    }
    async run() {
      const g = this.g, b = this.b;
      g.audio.playMusic(this.cfg.music || (b.wild ? getSpecies(b.active(1).sp).legendary ? "legend" : "battle" : this.cfg.isGym ? "gym" : "trainer"));
      await this.intro();
      let ev = b.start();
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i];
        if (e.t === "send" && e.side === 1 && e.first && !b.wild) {
          if (this.trainerSpr) {
            await this.say(`\xA1${b.sides[1].name} te desaf\xEDa!`, { hold: 500 });
            for (let k = 8; k >= 0; k--) {
              this.trainerSpr.a = k / 8;
              this.trainerSpr.x += 18;
              await this.sleep(30);
            }
            this.trainerSpr = null;
          }
          await this.say(`\xA1${b.sides[1].name} env\xEDa a ${e.name}!`, { hold: 400 });
          await this.onSend(e);
        } else if (e.t === "msg" && !b.wild && /desafía/.test(e.text)) continue;
        else if (e.t === "send" && e.side === 1 && b.wild) {
          this._renderBox(1, e);
          g.registerSeen(e.sp);
          g.audio.cry(e.sp, getSpecies(e.sp).legendary);
          await this.sleep(150);
        } else if (e.t === "send" && e.side === 0) {
          await this.say(`\xA1Adelante, ${e.name}!`, { hold: 350 });
          await this.onSend(e);
        } else await this.play([e]);
      }
      let guard = 0;
      while (!b.result && guard++ < 500) {
        if (b.awaiting === "switch") {
          let a = null;
          while (!a) a = await this.chooseSwitch(true);
          const r2 = b.forceSwitch(a.idx);
          await this.play(r2.events);
          continue;
        }
        const action = await this.chooseAction();
        const r = b.turn(action);
        if (!r.ok) {
          await this.say(r.msg, { hold: 500 });
          continue;
        }
        await this.play(r.events);
      }
      await this.finish();
      return b.summary();
    }
    async finish() {
      const g = this.g, b = this.b;
      if (b.result === "win") {
        g.audio.playMusic(b.wild ? "route" : "victory");
        if (!b.wild) {
          g.audio.sfx("win");
          await this.sleep(500);
        }
      }
      await this.sleep(300);
      this.wipe = 0;
      for (let k = 0; k <= 10; k++) {
        this.wipe = k / 10;
        await this.sleep(30);
      }
    }
  };

  // src/evolution_ui.js
  init_config();
  var EvolutionScene = class {
    constructor(g, mon, toId, { allowCancel = true } = {}) {
      this.g = g;
      this.mon = mon;
      this.toId = toId;
      this.allowCancel = allowCancel;
      this.t = 0;
      this.phase = "intro";
      this.cancelled = false;
      this.rings = [];
      this.blend = 0;
      this.flash = 0;
      this.root = null;
      this.textEl = null;
    }
    enter() {
      this.root = el("div", { class: "layer" });
      this.g.ui.root.append(this.root);
      this.textBox = el("div", { class: "panel", style: { position: "absolute", left: "20px", right: "20px", bottom: "14px", height: "90px", fontSize: "21px" } });
      this.textEl = el("div");
      this.textBox.append(this.textEl);
      this.root.append(this.textBox);
    }
    exit() {
      this.root?.remove();
    }
    update(dt) {
      this.t += dt;
      for (const r of this.rings) r.t += dt;
      this.rings = this.rings.filter((r) => r.t < 1.4);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.5);
    }
    render(ctx) {
      const g = ctx.createRadialGradient(480, 270, 20, 480, 270, 520);
      g.addColorStop(0, "#2a2a7a");
      g.addColorStop(1, "#07061a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "rgba(255,255,255,.5)";
      for (let i = 0; i < 50; i++) ctx.fillRect(i * 193 % VIEW_W, (i * 71 + this.t * 20 * (i % 3 + 1)) % VIEW_H, 2, 2);
      for (const r of this.rings) {
        ctx.strokeStyle = `rgba(190,220,255,${1 - r.t / 1.4})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(480, 230, 40 + r.t * 260, 0, 7);
        ctx.stroke();
      }
      const size = 6 * SPR;
      const x = 480 - size / 2, y = 250 - size;
      ctx.imageSmoothingEnabled = false;
      const a = creatureCanvas(this.mon.sp, this.mon.variant), b = creatureCanvas(this.toId, this.mon.variant);
      if (this.phase === "intro") ctx.drawImage(a, x, y, size, size);
      else if (this.phase === "morph") {
        const k = Math.floor(this.t * (4 + this.t * 3)) % 2;
        const sa = silhouetteCanvas(this.mon.sp, "#ffffff"), sb = silhouetteCanvas(this.toId, "#ffffff");
        const s = this.blend;
        const sc = 1 + Math.sin(this.t * 10) * 0.04;
        ctx.save();
        ctx.translate(480, 250 - size / 2);
        ctx.scale(sc, sc);
        ctx.translate(-480, -(250 - size / 2));
        ctx.globalAlpha = 1 - s;
        ctx.drawImage(sa, x, y, size, size);
        ctx.globalAlpha = s;
        ctx.drawImage(sb, x, y, size, size);
        ctx.restore();
      } else ctx.drawImage(b, x, y, size, size);
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${this.flash})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
    }
    async run() {
      const g = this.g, name = displayName(this.mon);
      g.audio.playMusic("victory");
      this.textEl.textContent = `\xBFQu\xE9? \xA1${name} est\xE1 evolucionando!`;
      let cancelled = false;
      const off = g.input.push((a) => {
        if (a === "cancel" && this.allowCancel && this.phase === "morph") cancelled = true;
      });
      await g.wait(1400);
      this.phase = "morph";
      this.t = 0;
      this.textEl.textContent = this.allowCancel ? "(Pulsa X para cancelar la evoluci\xF3n)" : "";
      g.audio.sfx("evolve");
      const dur = 4200;
      const t0 = performance.now();
      let ringT = 0;
      while (performance.now() - t0 < dur) {
        const k = (performance.now() - t0) / dur;
        this.blend = k < 0.5 ? 0 : (k - 0.5) * 2 > 1 ? 1 : (k - 0.5) * 2;
        ringT += 16;
        if (ringT > 500) {
          ringT = 0;
          this.rings.push({ t: 0 });
        }
        if (cancelled) {
          if (await g.yesNo(`\xBFQuieres detener la evoluci\xF3n de ${name}?`)) {
            off();
            this.phase = "intro";
            return false;
          }
          cancelled = false;
        }
        await g.wait(16);
      }
      off();
      this.flash = 1;
      this.phase = "done";
      g.audio.sfx("levelup");
      this.textEl.textContent = "";
      await g.wait(900);
      return true;
    }
  };

  // src/flows.js
  init_rng();
  var TERRAIN_BY_ZONE = { pradera: "hierba", bosque: "hierba", lago: "agua", playa: "arena", mar: "agua", cueva: "cueva", montana: "cueva", volcan: "volcan", desierto: "desierto", pantano: "pantano", isla: "arena", nieve: "nieve", ruinas: "ruinas", final: "liga", ciudad: "hierba" };
  function terrainFor(map, tile) {
    if (map.bg) return map.bg;
    if (map.indoor) return "interior";
    if (["agua", "cueva", "nieve", "desierto", "arena", "pantano", "ruinas", "volcan"].includes(tile)) return tile;
    return TERRAIN_BY_ZONE[map.zone] || "hierba";
  }
  function installFlows(game) {
    const g = game;
    g.battleWild = async (mon, { terrain = "hierba", map = null, music = null, canFlee = true, onWin = null } = {}) => {
      const ow = g.ow;
      const m = map || ow.map;
      g.registerSeen(mon.sp);
      return runBattle(g, { foe: { name: "Salvaje", party: [mon], wild: true }, terrain: terrainFor(m, terrain), music, canFlee, onWin });
    };
    g.battleTrainer = async (id, opts = {}) => {
      const def = getTrainer(id);
      if (g.state.trainers[id]?.beaten && !opts.rematch) {
        if (def.afterWin) await g.say(def.afterWin, { speaker: def.name });
        return { result: "win", again: true };
      }
      const ow = g.ow;
      if (def.intro) await g.say(def.intro, { speaker: def.name });
      const team = buildTeam(def, g);
      const sum = await runBattle(g, { foe: { name: def.name, party: team, wild: false, trainer: def, ai: def.ai, items: def.items }, terrain: terrainFor(ow.map, null), trainerLook: def.look, isGym: !!def.gym, music: def.music, canFlee: false, trainerDef: def, rematch: !!opts.rematch });
      if (sum.result === "win") {
        if (def.win) await g.say(def.win, { speaker: def.name });
        if (def.afterBattle) await def.afterBattle(g, def);
      } else if (sum.result === "lose" && def.lose) {
      }
      return sum;
    };
    g.battleCustom = (cfg) => runBattle(g, cfg);
    g.learnMoves = (mon) => learnMoveFlow(g, mon);
    g.checkEvolutions = (opts) => evolutionFlow(g, opts);
    g.evolveNow = (mon, to, opts) => doEvolution(g, mon, to, opts);
  }
  async function runBattle(g, cfg) {
    const ow = g.ow, st = g.state;
    const party = g.party;
    if (!g.firstFighter()) {
      await g.say("No tienes criaturas en condiciones de luchar.");
      return { result: "none" };
    }
    g.audio.stopMusic();
    const now = g.now;
    const weatherName = ow?.weatherId || null;
    const battle = new Battle({
      seed: g.rng.next() * 4294967296 >>> 0,
      player: { name: g.playerName, party, bag: g.bag },
      foe: cfg.foe,
      weather: battleWeather(weatherName),
      canFlee: cfg.canFlee ?? cfg.foe.wild,
      canCapture: cfg.foe.wild && !cfg.noCapture,
      expShare: g.hasKey("repartir_exp"),
      xpBonus: g.hasKey("amuleto_exp") ? 1.2 : 1,
      levelCap: 100,
      env: { isNight: g.isNight, hour: now.hour, tags: ow?.map?.tags || [], cave: !!ow?.map?.cave, weatherName, alreadyCaught: !!(cfg.foe.wild && g.dex.caught[cfg.foe.party[0].sp]) }
    });
    for (const c of party) delete c._fainted;
    for (const c of cfg.foe.party) delete c._fainted;
    const scene = new BattleScene(g, battle, { terrain: cfg.terrain, trainerLook: cfg.trainerLook, music: cfg.music, isGym: cfg.isGym, night: g.isNight && !ow?.map?.indoor });
    const prev = g.scene;
    g.scene = scene;
    scene.enter();
    const wasBusy = ow?.busy;
    if (ow) ow.busy = true;
    let sum;
    try {
      sum = await scene.run();
    } catch (e) {
      console.error(e);
      g.reportError(e);
      sum = battle.summary();
    }
    scene.exit();
    g.scene = prev;
    if (ow) ow.busy = wasBusy ?? false;
    st.stats.battles++;
    g.emit("battle_end", { result: sum.result, wild: battle.wild });
    for (const sp of battle.stats.defeated) g.emit("ko", { sp, wild: battle.wild });
    st.stats.kos += battle.stats.kos;
    if (ow?.map) g.audio.playMusic(ow._musicFor(ow.map));
    if (sum.result === "captured" && sum.captured) {
      const c = sum.captured;
      const fresh = !g.dex.caught[c.sp];
      c.caught = { map: ow.map.id, lv: c.lv, how: "capture", night: g.isNight };
      const r = await g.receiveCreature(c, { how: "capture", quiet: true });
      if (r) {
        await g.say(`\xA1${displayName(c)} fue registrado en la enciclopedia!`.replace("fue registrado", fresh ? "fue registrado" : "ya estaba registrado"));
        if (r.where === "party") await g.say(`\xA1${displayName(c)} se ha unido a tu equipo!`);
        else await g.say(`${displayName(c)} fue enviado a la ${st.boxNames[r.where.box]}.`);
        if (await g.yesNo(`\xBFQuieres ponerle un mote a ${displayName(c)}?`)) {
          const n = await g.ui.prompt(`Mote para ${getSpecies(c.sp).name}`, "", 12);
          if (n) {
            c.nick = n;
          }
        }
      }
    }
    if (sum.result === "win" && cfg.trainerDef) {
      const def = cfg.trainerDef;
      if (!cfg.rematch) st.trainers[def.id] = { beaten: true, day: g.now.day };
      else st.trainers[def.id] = { ...st.trainers[def.id] || {}, beaten: true, rematchDone: (st.trainers[def.id]?.rematchDone || 0) + 1, day: g.now.day };
      const reward = cfg.rematch ? Math.floor(defaultReward(def, g) * 0.5) : defaultReward(def, g);
      if (reward) {
        g.addMoney(reward);
        g.audio.sfx("coin");
        await g.say(`\xA1Has ganado ${reward} \xE1ureos por derrotar a ${def.name}!`);
      }
      st.stats.wins++;
      g.emit("defeat", { trainer: def.id, cls: def.cls, gym: !!def.gym, rematch: !!cfg.rematch });
    }
    if (sum.result === "win" && battle.wild) {
      st.stats.wins++;
    }
    for (const c of party) if (c.pendingMoves?.length) await learnMoveFlow(g, c);
    if (sum.result !== "lose") await evolutionFlow(g, { trigger: "level" });
    if (sum.result === "lose") await blackout(g, cfg);
    return sum;
  }
  async function blackout(g, cfg = {}) {
    const st = g.state;
    const loss = Math.floor(st.player.money * 0.1);
    await g.say(`${g.playerName} se ha quedado sin criaturas en condiciones de luchar...`);
    if (cfg.trainerDef?.lose) await g.say(cfg.trainerDef.lose, { speaker: cfg.trainerDef.name });
    if (loss > 0) {
      g.state.player.money -= loss;
      await g.say(`Has perdido ${loss} \xE1ureos en la huida.`);
    }
    await g.ui.fade(true, 500);
    healParty(g.party);
    g.state.player.surfing = false;
    const h = st.lastHeal;
    await g.ow.loadMap(h.map, h.x, h.y, "down", { announce: true });
    await g.ui.fade(false, 500);
    await g.say("Tus criaturas han sido curadas. \xA1Vuelve a intentarlo cuando est\xE9s listo!");
    g.emit("blackout");
  }
  async function learnMoveFlow(g, mon) {
    while (mon.pendingMoves.length) {
      const mid = mon.pendingMoves.shift();
      const mv = getMove(mid);
      if (mon.moves.some((m) => m.id === mid)) continue;
      if (mon.moves.length < 4) {
        learnMove(mon, mid);
        await g.say(`\xA1${displayName(mon)} aprendi\xF3 ${mv.name}!`);
        continue;
      }
      if (!await g.yesNo(`${displayName(mon)} quiere aprender ${mv.name} (${mv.type}, pot. ${mv.pow || "\u2014"}), pero ya conoce 4 movimientos. \xBFOlvidar uno para aprenderlo?`)) {
        await g.say(`${displayName(mon)} no aprendi\xF3 ${mv.name}.`);
        continue;
      }
      const items = mon.moves.map((m, i) => ({ label: getMove(m.id).name, value: i, hint: `${getMove(m.id).type} \xB7 ${m.pp}/${m.max}` }));
      const r = await g.ui.menu(items, { title: `\xBFQu\xE9 movimiento olvidar? (nuevo: ${mv.name})`, panel: true, cancel: null, style: { position: "absolute", left: "280px", top: "120px", width: "400px", zIndex: 60 } });
      if (r == null) {
        await g.say(`${displayName(mon)} no aprendi\xF3 ${mv.name}.`);
        continue;
      }
      const old = getMove(mon.moves[r].id).name;
      learnMove(mon, mid, r);
      await g.say(`${displayName(mon)} olvid\xF3 ${old} y aprendi\xF3 ${mv.name}.`);
    }
  }
  async function evolutionFlow(g, { trigger = "level", item = null } = {}) {
    const ctx = { trigger, item, isNight: g.isNight, hour: g.now.hour, tags: g.ow?.map?.tags || [], weather: g.ow?.weatherId, party: g.party };
    for (const c of g.party) {
      if (c.egg) continue;
      const r = c.pendingEvo ? { to: c.pendingEvo } : null;
      const rule = r ? findEvolution(c, ctx) : null;
      if (rule) await doEvolution(g, c, rule.to, { allowCancel: true });
      else c.pendingEvo = null;
    }
  }
  async function doEvolution(g, mon, toId, { allowCancel = true } = {}) {
    const scene = new EvolutionScene(g, mon, toId, { allowCancel });
    const prev = g.scene;
    g.scene = scene;
    scene.enter();
    const ok = await scene.run();
    scene.exit();
    g.scene = prev;
    if (!ok) {
      mon.pendingEvo = null;
      await g.say(`\xA1${displayName(mon)} no ha evolucionado!`);
      mon.noEvoUntil = g.state.stats.steps + 200;
      return false;
    }
    const info = evolve(mon, toId);
    g.registerCaught(toId);
    g.state.stats.evolutions++;
    g.emit("evolve", { from: info.from, to: toId, creature: mon });
    await g.say(`\xA1Enhorabuena! \xA1${info.oldName} ha evolucionado en ${getSpecies(toId).name}!`);
    if (info.learned.length) for (const m of info.learned) await g.say(`\xA1${displayName(mon)} aprendi\xF3 ${getMove(m).name}!`);
    if (mon.pendingMoves.length) await learnMoveFlow(g, mon);
    if (g.ow?.map) g.audio.playMusic(g.ow._musicFor(g.ow.map));
    return true;
  }

  // src/main.js
  init_world();
  init_world();
  async function boot() {
    const g = new Game();
    window.__game = g;
    window.__au = { Creatures: creatures_exports, Species: species_exports, World: world_exports, Save };
    installFlows(g);
    installQuests(g);
    installAchievements(g);
    installCosmetics(g);
    g.menu = new GameMenu(g);
    g.openShop = (id) => openShop(g, id);
    g.openPC = () => openPC(g);
    g.start();
    const boot2 = document.getElementById("boot");
    if (boot2) boot2.remove();
    setupTouch(g);
    window.addEventListener("beforeunload", () => {
      try {
        if (g.state && g.settings.autosave && g.state.__dirty) g.save(g.slot, { quiet: true });
      } catch {
      }
    });
    for (; ; ) {
      g.state = null;
      g.quitRequested = false;
      g.ow = null;
      g.audio.stopMusic();
      const title = new TitleScene(g);
      g.setScene(title);
      const choice = await title.show();
      const ow = new Overworld(g);
      g.ow = ow;
      g.ui.clearHud();
      if (choice.type === "new") {
        const cfg = await openCreator(g);
        if (!cfg) continue;
        g.slot = choice.slot;
        g.settings.lastSlot = choice.slot;
        g.saveSettings();
        g.newGame({ name: cfg.name, look: cfg.look, seed: Math.random() * 4294967296 >>> 0 });
        g.setScene(ow);
        await g.ui.fade(true, 10);
        await ow.loadMap(START_MAP, 5, 4, "right", { announce: false });
        await g.ui.fade(false, 600);
        const rosa = ow.entity("tia_rosa");
        if (rosa) await ow.run(() => rosa.def.talk(g, rosa, ow));
      } else {
        g.setScene(ow);
        const s = g.state;
        const id = mapExists(s.player.map) ? s.player.map : "villa_alba";
        const pos = id === s.player.map ? { x: s.player.x, y: s.player.y, dir: s.player.dir } : { x: 5, y: 10, dir: "down" };
        await g.ui.fade(true, 10);
        await ow.loadMap(id, pos.x, pos.y, pos.dir || "down", { announce: true });
        await g.ui.fade(false, 500);
        if (choice.recovered) g.ui.toast("\u26A0 La partida principal estaba da\xF1ada: se recuper\xF3 la copia de seguridad.");
      }
      await new Promise((res) => {
        const iv = setInterval(() => {
          if (g.quitRequested) {
            clearInterval(iv);
            res();
          }
        }, 150);
      });
      await g.ui.fade(true, 300);
      g.ui.clearHud();
      document.querySelectorAll(".screen,#dialog").forEach((n) => n.remove());
      ow.exit();
      await g.ui.fade(false, 10);
    }
  }
  function setupTouch(g) {
    const touch = document.getElementById("touch");
    if (!touch) return;
    const isTouch = "ontouchstart" in window || window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;
    touch.hidden = false;
    touch.querySelectorAll("button").forEach((b) => {
      const a = b.dataset.a;
      const down = (e) => {
        e.preventDefault();
        g.audio.unlock();
        g.input.pressVirtual(a, true);
        if (!["up", "down", "left", "right"].includes(a)) setTimeout(() => g.input.pressVirtual(a, false), 80);
      };
      const up = (e) => {
        e.preventDefault();
        if (["up", "down", "left", "right"].includes(a)) g.input.pressVirtual(a, false);
      };
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointerleave", up);
      b.addEventListener("pointercancel", up);
    });
  }
  window.addEventListener("error", (e) => {
    const b = document.getElementById("boot");
    if (b) b.textContent = "Error al iniciar: " + e.message;
  });
  boot().catch((e) => {
    console.error(e);
    const b = document.getElementById("boot");
    if (b) b.textContent = "Error al iniciar: " + e.message;
  });
})();
//# sourceMappingURL=game.js.map
