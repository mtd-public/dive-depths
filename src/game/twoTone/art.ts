/**
 * art.ts — the two-tone ("Downwell-style") sprite set, authored in code.
 *
 * Unlike pixelArt.ts, frames here hold palette *indices*, not colors: every
 * pixel is one of five inks (clear, bg, fg, accent, accent2 — see
 * palettes.ts), so one sprite set renders in any palette with a lookup.
 *
 * Style rules for this set:
 *  - silhouettes first: every sprite gets a 1px bg-colored moat so it cuts
 *    cleanly into whatever it overlaps, the way Downwell sprites do
 *  - tone is line hatching and ordered dither, never a blend: shadow sides
 *    get every-other-row bg hatch, deep shadow goes solid bg
 *  - fg is the player's hardware and the world's line art; accent is
 *    danger (every enemy is an accent mass engraved with bg); accent2 is
 *    water and tech (bubbles, glass, the laser, pickups)
 *  - no role is load-bearing on its own: palettes that collapse roles
 *    (Blackout draws accent in fg) still read by silhouette + engraving
 */

export const CLEAR = 0
export const INK = 1 // bg
export const FG = 2
export const ACC = 3
export const ACC2 = 4
export type Ink = 0 | 1 | 2 | 3 | 4

export interface IFrame {
  w: number
  h: number
  px: Uint8Array
}

export interface IAnim {
  frames: IFrame[]
  fps: number
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function iblank(w: number, h: number): IFrame {
  return { w, h, px: new Uint8Array(w * h) }
}

export function iput(f: IFrame, x: number, y: number, c: Ink): void {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return
  f.px[y * f.w + x] = c
}

export function iget(f: IFrame, x: number, y: number): Ink {
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return CLEAR
  return f.px[y * f.w + x] as Ink
}

const LEG: Record<string, Ink> = { '.': CLEAR, k: INK, w: FG, r: ACC, b: ACC2 }

/** Hand-authored map: '.' clear, k bg-ink, w fg, r accent, b accent2. */
export function imap(rows: string[]): IFrame {
  const f = iblank(rows[0].length, rows.length)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = LEG[row[x]]
      if (c === undefined) throw new Error(`twoTone: unknown map char '${row[x]}'`)
      f.px[y * f.w + x] = c
    }
  })
  return f
}

export function iblit(dst: IFrame, src: IFrame, ox: number, oy: number): void {
  ox = Math.round(ox)
  oy = Math.round(oy)
  for (let y = 0; y < src.h; y++) {
    const dy = oy + y
    if (dy < 0 || dy >= dst.h) continue
    for (let x = 0; x < src.w; x++) {
      const c = src.px[y * src.w + x]
      if (!c) continue
      const dx = ox + x
      if (dx < 0 || dx >= dst.w) continue
      dst.px[dy * dst.w + dx] = c
    }
  }
}

export function iclone(f: IFrame): IFrame {
  return { w: f.w, h: f.h, px: new Uint8Array(f.px) }
}

export function imirrorX(f: IFrame): IFrame {
  const o = iblank(f.w, f.h)
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) o.px[y * f.w + (f.w - 1 - x)] = f.px[y * f.w + x]
  return o
}

export function irot90(f: IFrame): IFrame {
  const o = iblank(f.h, f.w)
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) o.px[x * o.w + (o.w - 1 - y)] = f.px[y * f.w + x]
  return o
}

/** Grow the frame by `n` px on every side, adding a bg-ink moat of width n. */
export function withMoat(f: IFrame, n = 1, c: Ink = INK): IFrame {
  let cur = iblank(f.w + n * 2, f.h + n * 2)
  iblit(cur, f, n, n)
  for (let i = 0; i < n; i++) {
    const next = iclone(cur)
    for (let y = 0; y < cur.h; y++) {
      for (let x = 0; x < cur.w; x++) {
        if (cur.px[y * cur.w + x]) continue
        if (iget(cur, x - 1, y) || iget(cur, x + 1, y) || iget(cur, x, y - 1) || iget(cur, x, y + 1))
          next.px[y * cur.w + x] = c
      }
    }
    cur = next
  }
  return cur
}

/** Outline every opaque shape in place: clear pixels touching it become c. */
export function ring(f: IFrame, c: Ink): IFrame {
  const o = iclone(f)
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      if (f.px[y * f.w + x]) continue
      if (iget(f, x - 1, y) || iget(f, x + 1, y) || iget(f, x, y - 1) || iget(f, x, y + 1))
        o.px[y * f.w + x] = c
    }
  }
  return o
}

/** Deterministic hash noise in [0, 1). */
export function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Ordered-dither test: true on roughly `level` (0..1) of pixels. */
export function dith(x: number, y: number, level: number): boolean {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < level
}

/**
 * 4-neighbor chamfer distance from each opaque pixel to the nearest clear
 * one (0 = on the silhouette edge). Clear pixels read -1.
 */
export function edgeDist(f: IFrame): Int16Array {
  const { w, h } = f
  const d = new Int16Array(w * h)
  const BIG = 9999
  for (let i = 0; i < w * h; i++) d[i] = f.px[i] ? BIG : -1
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : d[y * w + x])
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (d[i] < 0) continue
      d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1)
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (d[i] < 0) continue
      d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1)
    }
  return d
}

/** Paint every pixel for which `inside` is true with the painter's ink. */
function fillShape(
  f: IFrame,
  inside: (x: number, y: number) => boolean,
  paint: (x: number, y: number, d: number) => Ink,
): void {
  const mask = iblank(f.w, f.h)
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (inside(x, y)) mask.px[y * f.w + x] = 1
  const d = edgeDist(mask)
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) {
      const i = y * f.w + x
      if (!mask.px[i]) continue
      const c = paint(x, y, d[i])
      if (c) f.px[i] = c
    }
}

interface BodyOpts {
  cx: number
  cy: number
  rx: number
  ry: number
  /** light direction the lit side faces (default: from upper-left) */
  lx?: number
  ly?: number
  hatch?: number // shade level where line hatching starts
  solid?: number // shade level where it goes solid ink
  rim?: boolean // fg rim light on the lit edge
}

/**
 * The house shader: a mass of `base` with an fg rim on its lit edge,
 * every-other-row ink hatching across its shadow side, and solid ink in
 * the deepest shadow. `d` is the pixel's distance in from the silhouette.
 */
function bodyPaint(base: Ink, o: BodyOpts): (x: number, y: number, d: number) => Ink {
  const lx = o.lx ?? -0.55
  const ly = o.ly ?? -0.83
  const hatch = o.hatch ?? 0.3
  const solid = o.solid ?? 0.78
  return (x, y, d) => {
    const u = (x - o.cx) / o.rx
    const v = (y - o.cy) / o.ry
    const lit = u * lx + v * ly
    if (d === 0) return o.rim !== false && lit > 0.25 ? FG : base
    if (-lit > solid) return (x + y) % 3 === 0 ? base : INK
    if (-lit > hatch) return y % 2 === 0 ? INK : base
    return base
  }
}

function ellipse(cx: number, cy: number, rx: number, ry: number) {
  return (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
}

function line(f: IFrame, x0: number, y0: number, x1: number, y1: number, c: Ink): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) iput(f, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c)
}

function rect(f: IFrame, x: number, y: number, w: number, h: number, c: Ink): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) iput(f, xx, yy, c)
}

/** Piecewise-linear edge profile from [row, leftEdgeCol] control points. */
function edgeProfile(points: [number, number][]): (y: number) => number | null {
  return (y) => {
    if (y < points[0][0] || y > points[points.length - 1][0]) return null
    for (let i = 1; i < points.length; i++) {
      const [y0, x0] = points[i - 1]
      const [y1, x1] = points[i]
      if (y <= y1) return Math.round(x0 + (x1 - x0) * ((y - y0) / Math.max(1, y1 - y0)))
    }
    return null
  }
}

/** Horizontal shear for banking poses (rows below `anchorY` lean). */
function shear(f: IFrame, maxShift: number, anchorY = 6): IFrame {
  const o = iblank(f.w, f.h)
  for (let y = 0; y < f.h; y++) {
    const p = Math.max(0, y - anchorY) / Math.max(1, f.h - 1 - anchorY)
    const s = Math.round(maxShift * p)
    for (let x = 0; x < f.w; x++) {
      const c = f.px[y * f.w + x]
      if (c) iput(o, x + s, y, c as Ink)
    }
  }
  return o
}

// ---------------------------------------------------------------------------
// Pixel font — chunky 5px caps, Downwell-style
// ---------------------------------------------------------------------------

const GLYPHS: Record<string, string[]> = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  B: ['###.', '#..#', '###.', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '###.', '#...', '####'],
  F: ['####', '#...', '###.', '#...', '#...'],
  G: ['.###', '#...', '#.##', '#..#', '.###'],
  H: ['#..#', '#..#', '####', '#..#', '#..#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..##', '...#', '...#', '#..#', '.##.'],
  K: ['#..#', '#.#.', '##..', '#.#.', '#..#'],
  L: ['#...', '#...', '#...', '#...', '####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  P: ['###.', '#..#', '###.', '#...', '#...'],
  Q: ['.##.', '#..#', '#..#', '#.#.', '.#.#'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  S: ['.###', '#...', '.##.', '...#', '###.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#..#', '#..#', '#..#', '#..#', '.##.'],
  V: ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#..#', '#..#', '.##.', '#..#', '#..#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
  Z: ['####', '...#', '.##.', '#...', '####'],
  '0': ['.##.', '#.##', '##.#', '#..#', '.##.'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###.', '...#', '.##.', '#...', '####'],
  '3': ['###.', '...#', '.##.', '...#', '###.'],
  '4': ['#..#', '#..#', '####', '...#', '...#'],
  '5': ['####', '#...', '###.', '...#', '###.'],
  '6': ['.##.', '#...', '###.', '#..#', '.##.'],
  '7': ['####', '...#', '..#.', '.#..', '.#..'],
  '8': ['.##.', '#..#', '.##.', '#..#', '.##.'],
  '9': ['.##.', '#..#', '.###', '...#', '.##.'],
  '.': ['.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '#', '#'],
  ':': ['.', '#', '.', '#', '.'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '/': ['...#', '..#.', '.##.', '.#..', '#...'],
  '!': ['#', '#', '#', '.', '#'],
  '?': ['###.', '...#', '.##.', '....', '.#..'],
  "'": ['#', '#', '.', '.', '.'],
  x: ['...', '#.#', '.#.', '#.#', '...'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'],
  ' ': ['..', '..', '..', '..', '..'],
}

export interface TextOpts {
  scale?: number
  bold?: boolean
}

export function textWidth(s: string, o: TextOpts = {}): number {
  const scale = o.scale ?? 1
  let w = 0
  for (const raw of s) {
    const g = GLYPHS[raw === '×' ? 'x' : raw.toUpperCase()] ?? GLYPHS['?']
    w += (g[0].length + 1 + (o.bold ? 1 : 0)) * scale
  }
  return Math.max(0, w - scale)
}

/** Draw caps text; returns the width drawn. '×' draws a small times sign. */
export function drawText(f: IFrame, s: string, x: number, y: number, c: Ink, o: TextOpts = {}): number {
  const scale = o.scale ?? 1
  let cx = Math.round(x)
  for (const raw of s) {
    const ch = raw === '×' ? 'x' : raw.toUpperCase()
    const g = GLYPHS[ch] ?? GLYPHS['?']
    for (let gy = 0; gy < g.length; gy++)
      for (let gx = 0; gx < g[gy].length; gx++) {
        if (g[gy][gx] !== '#') continue
        for (let b = 0; b <= (o.bold ? 1 : 0); b++)
          rect(f, cx + (gx + b) * scale, Math.round(y) + gy * scale, scale, scale, c)
      }
    cx += (g[0].length + 1 + (o.bold ? 1 : 0)) * scale
  }
  return cx - Math.round(x) - scale
}

/** Text as its own sprite, with a bg moat so it reads over anything. */
export function textSprite(s: string, c: Ink, o: TextOpts = {}): IFrame {
  const scale = o.scale ?? 1
  const f = iblank(textWidth(s, o) + 2, 5 * scale + 2)
  drawText(f, s, 1, 1, c, o)
  return withMoat(f)
}

/**
 * Title logotype: accent-filled chunky letters, an fg highlight on each
 * stroke's top row, bg hatch across the lower third, then an fg outline
 * and a bg moat — the Downwell logo treatment.
 */
export function buildLogo(s: string, scale = 4): IFrame {
  const pad = 3
  const inner = iblank(textWidth(s, { scale, bold: true }) + pad * 2, 5 * scale + pad * 2)
  drawText(inner, s, pad, pad, ACC, { scale, bold: true })
  const top = pad
  const bottom = pad + 5 * scale
  for (let y = 0; y < inner.h; y++)
    for (let x = 0; x < inner.w; x++) {
      if (inner.px[y * inner.w + x] !== ACC) continue
      if (!iget(inner, x, y - 1)) inner.px[y * inner.w + x] = FG
      else if ((y - top) / (bottom - top) > 0.62 && y % 2 === 0) inner.px[y * inner.w + x] = INK
    }
  // drop shadow: an accent2 echo one step down-right, behind the outline
  const shadow = iblank(inner.w + 2, inner.h + 2)
  for (let y = 0; y < inner.h; y++)
    for (let x = 0; x < inner.w; x++) if (inner.px[y * inner.w + x]) iput(shadow, x + 2, y + 2, dith(x, y, 0.5) ? ACC2 : INK)
  const out = iblank(inner.w + 2, inner.h + 2)
  iblit(out, shadow, 0, 0)
  const outlined = ring(inner, FG)
  iblit(out, outlined, 0, 0)
  return withMoat(out)
}

// ---------------------------------------------------------------------------
// Player submarine — 32×48 (34×50 with moat), nose down
// ---------------------------------------------------------------------------

const PLAYER_EDGE = edgeProfile([
  [5, 11],
  [8, 8],
  [11, 6],
  [14, 5],
  [17, 4],
  [38, 4],
  [41, 5],
  [43, 7],
  [45, 9],
  [46, 11],
  [47, 13],
])

function playerBase(propFrame: number): IFrame {
  const f = iblank(32, 48)
  const edge = PLAYER_EDGE
  const seams = [13, 21, 31, 37]
  for (let y = 0; y < 48; y++) {
    const e = edge(y)
    if (e === null) continue
    const capped = edge(y - 1) === null || edge(y + 1) === null
    const right = 31 - e
    for (let x = e; x <= right; x++) {
      const xl = x - e
      const xr = right - x
      const p = xl / Math.max(1, right - e)
      let c: Ink
      if (capped || xl === 0 || xr === 0) c = FG
      else if (xl === 1 || xr === 1) c = INK // engraved double outline
      else if (p > 0.8) c = y % 2 === 0 ? INK : (x + y) % 4 === 1 ? FG : INK
      else if (p > 0.58) c = y % 2 === 0 ? INK : FG
      else c = FG
      if (seams.includes(y) && xl > 1 && xr > 1) c = INK
      // keel line down the spine
      if ((x === 15 || x === 16) && y > 23 && y < 32 && x === 16) c = INK
      iput(f, x, y, c)
    }
  }
  // rivets punched into the lit plating
  for (let y = 16; y < 37; y += 4) {
    const e = edge(y)
    if (e !== null && !seams.includes(y)) iput(f, e + 3, y, INK)
  }

  // stern prop nacelles: fg housings, accent blades that swap each frame
  for (const nx of [9, 19]) {
    rect(f, nx, 0, 4, 5, FG)
    rect(f, nx + 1, 1, 2, 3, INK)
    const a = propFrame === 0
    iput(f, nx + 1, a ? 1 : 3, ACC)
    iput(f, nx + 2, a ? 3 : 1, ACC)
    iput(f, nx + (a ? 1 : 2), 2, ACC)
  }
  line(f, 13, 2, 18, 2, FG)
  line(f, 13, 3, 18, 3, INK)

  // conning tower: bg well with an accent2 glass dome and a glint
  const tower = imap([
    '.wwwwww.',
    'wkkkkkkw',
    'wkbbbbkw',
    'wkbwbbkw',
    'wkbbbbkw',
    'wkbbbkkw',
    'wkkkkkkw',
    '.wwwwww.',
  ])
  iblit(f, tower, 12, 14)

  // dive planes — the player's accent, like Downwell's red gunboots
  const plane = imap(['wwwww.', 'wrrrkw', 'wrrkkw', 'wwwww.'])
  iblit(f, plane, 0, 26)
  iblit(f, imirrorX(plane), 26, 26)

  // hazard chevrons above the nose, pointing down toward the fight
  for (let y = 33; y <= 35; y++) {
    const e = edge(y)!
    for (let x = e + 2; x <= 29 - e; x++) {
      const v = (Math.abs(x - 15.5) + (y - 33) * -1 + 40) % 6
      iput(f, x, y, v < 3 ? ACC : INK)
    }
  }

  // twin torpedo ports: dark bores with a hot accent charge inside
  for (const px of [9, 19]) {
    rect(f, px, 38, 4, 4, INK)
    iput(f, px + 1, 40, ACC)
    iput(f, px + 2, 40, ACC)
  }
  // nose headlamp
  rect(f, 13, 44, 6, 2, FG)
  iput(f, 15, 44, ACC2)
  iput(f, 16, 44, ACC2)
  return f
}

export function buildPlayerSub(): { idle: IFrame[]; bankL: IFrame[]; bankR: IFrame[] } {
  const raw = [playerBase(0), playerBase(1)]
  return {
    idle: raw.map((r) => withMoat(r)),
    bankL: raw.map((r) => withMoat(shear(r, -3))),
    bankR: raw.map((r) => withMoat(shear(r, 3))),
  }
}

// ---------------------------------------------------------------------------
// Enemy submarine — 24×36, nose up, an accent hull engraved in bg
// ---------------------------------------------------------------------------

const ENEMY_EDGE = edgeProfile([
  [1, 10],
  [4, 7],
  [8, 5],
  [12, 3],
  [26, 3],
  [30, 4],
  [33, 6],
  [35, 9],
])

function enemySubBase(lamp: boolean): IFrame {
  const f = iblank(24, 38)
  const edge = ENEMY_EDGE
  const seams = [10, 18, 26]
  for (let y = 0; y < 38; y++) {
    const e = edge(y)
    if (e === null) continue
    const capped = edge(y - 1) === null || edge(y + 1) === null
    const right = 23 - e
    for (let x = e; x <= right; x++) {
      const xl = x - e
      const xr = right - x
      const p = xl / Math.max(1, right - e)
      let c: Ink
      if (capped) c = ACC
      else if (xl === 0) c = FG // rim light on the lit flank
      else if (xr === 0) c = ACC
      else if (p > 0.74) c = (x + y) % 3 === 0 ? ACC : INK
      else if (p > 0.5) c = y % 2 === 0 ? INK : ACC
      else c = ACC
      if (seams.includes(y) && xl > 0 && xr > 0) c = INK
      iput(f, x, y, c)
    }
  }
  for (let y = 13; y < 31; y += 4) {
    const e = edge(y)
    if (e !== null && !seams.includes(y)) iput(f, e + 2, y, FG)
  }
  // bow tubes
  rect(f, 9, 1, 2, 3, INK)
  rect(f, 13, 1, 2, 3, INK)
  // conning tower with the running lamp
  const tower = imap(['.kkkk.', 'kkrrkk', lamp ? 'krwwrk' : 'krkkrk', 'kkrrkk', '.kkkk.'])
  iblit(f, tower, 9, 13)
  // stern screw
  iblit(f, imap(['w.ww.w', '.wkkw.', '..ww..']), 9, 35)
  return f
}

export function buildEnemySub(): { run: IFrame[]; fire: IFrame } {
  const a = enemySubBase(false)
  const b = enemySubBase(true)
  const fire = iclone(b)
  const flashed = iblank(24, 44)
  iblit(flashed, fire, 0, 6)
  iblit(flashed, imap(['...w..w...', '..wrw.rw..', '.wrrwwrrw.', '..wkrrkw..', '...wkkw...']), 7, 0)
  const pad = (fr: IFrame) => {
    const o = iblank(24, 44)
    iblit(o, fr, 0, 6)
    return withMoat(o)
  }
  return { run: [pad(a), pad(b)], fire: withMoat(flashed) }
}

// ---------------------------------------------------------------------------
// Frogman — 26×16, facing left: accent wetsuit, fg mask and sled
// ---------------------------------------------------------------------------

function frogmanFrame(kick: number, prop: number): IFrame {
  const f = iblank(28, 17)
  // sled under the diver
  rect(f, 2, 11, 15, 4, FG)
  rect(f, 3, 12, 13, 2, INK)
  rect(f, 3, 12, 2, 2, ACC)
  for (let x = 7; x < 15; x += 3) iput(f, x, 12, FG)
  // sled screw + wash
  const blades = prop === 0 ? [[17, 11], [18, 13], [17, 14]] : [[18, 11], [17, 12], [18, 14]]
  for (const [bx, by] of blades) iput(f, bx, by, FG)
  iput(f, 20 + prop, 12, ACC2)
  iput(f, 22 - prop, 14, ACC2)
  iput(f, 24, 12 + prop, ACC2)

  // body: prone accent mass, hatched along the belly
  fillShape(f, ellipse(12.5, 7, 8.6, 2.8), bodyPaint(ACC, { cx: 12.5, cy: 7, rx: 8.6, ry: 2.8, lx: 0, ly: -1, hatch: 0.25 }))
  // legs + fins
  const k = kick === 0 ? -1 : 1
  line(f, 20, 6, 24, 6 + k, ACC)
  line(f, 20, 8, 24, 8 - k, ACC)
  iblit(f, imap(['ww.', 'wkw', '.ww']), 24, 5 + k - 1)
  iblit(f, imap(['.ww', 'wkw', 'ww.']), 24, 7 - k)
  // air tank on the back
  rect(f, 8, 2, 8, 3, FG)
  rect(f, 9, 3, 6, 1, INK)
  iput(f, 16, 3, INK)
  // head + mask
  fillShape(f, ellipse(4.5, 6, 3.6, 3.4), bodyPaint(ACC, { cx: 4.5, cy: 6, rx: 3.6, ry: 3.4, lx: -0.3, ly: -0.9 }))
  iblit(f, imap(['www.', 'wkkw', 'wkbw', 'www.']), 1, 5)
  // arm on the sled grip
  line(f, 7, 9, 5, 11, ACC)
  // exhaled bubbles
  iput(f, 1, 2 - kick, ACC2)
  iput(f, 3, 0, ACC2)
  return withMoat(f)
}

export function buildFrogman(): IFrame[] {
  return [frogmanFrame(0, 0), frogmanFrame(0, 1), frogmanFrame(1, 0), frogmanFrame(1, 1)]
}

// ---------------------------------------------------------------------------
// Red fish — 22×14, facing left: solid accent, tiger-banded in bg
// ---------------------------------------------------------------------------

function redFishHalfH(x: number): number {
  if (x < 3 || x > 16) return 0
  if (x <= 8) return Math.round(1.5 + (x - 3) * 0.75)
  if (x <= 11) return 5
  return Math.round(5 - (x - 11) * 1.1)
}

function redFishFrame(wag: number): IFrame {
  const f = iblank(22, 14)
  const cy = 7
  for (let x = 3; x <= 16; x++) {
    const hh = redFishHalfH(x)
    for (let y = cy - hh; y <= cy + hh; y++) {
      let c: Ink = ACC
      if (y === cy - hh && x > 4) c = FG // dorsal rim light
      else if (y >= cy + hh - 1 && y % 2 === 0) c = INK // belly hatch
      if ((x === 10 || x === 13) && y > cy - hh && y < cy + hh - 1) c = INK // tiger bands
      iput(f, x, y, c)
    }
  }
  // gill slash
  line(f, 7, cy - 2, 8, cy + 1, INK)
  // dorsal spike
  iput(f, 10, cy - 6, FG)
  iput(f, 11, cy - 7, FG)
  iput(f, 11, cy - 6, ACC)
  // tail
  const lobe = wag === 0 ? -1 : 1
  iblit(f, imap(['rr.', '.rr', 'kr.', '.rr', 'rr.']), 17, cy - 2 + lobe)
  // eye: fg with a bg pupil; mouth notch
  rect(f, 5, cy - 2, 2, 2, FG)
  iput(f, 5, cy - 1, INK)
  iput(f, 3, cy + 1, INK)
  iput(f, 4, cy + 1, INK)
  return withMoat(f)
}

export function buildRedFish(): IFrame[] {
  return [redFishFrame(0), redFishFrame(1), redFishFrame(0)]
}

// ---------------------------------------------------------------------------
// Angler — 32×22, facing left: a bg-dark body drawn in fg line work, the
// only enemy that's mostly shadow; accent eye and gullet, fg teeth + lure
// ---------------------------------------------------------------------------

function anglerFrame(jawOpen: boolean, lureBright: boolean): IFrame {
  const f = iblank(34, 24)
  const cy = 12
  const halfH = (x: number): number => {
    if (x < 6 || x > 26) return 0
    if (x <= 13) return Math.round(2.5 + (x - 6) * 0.55)
    if (x <= 19) return 6
    return Math.round(6 - (x - 19) * 0.6)
  }
  for (let x = 6; x <= 26; x++) {
    const hh = halfH(x)
    for (let y = cy - hh; y <= cy + hh; y++) {
      const edge = y === cy - hh || y === cy + hh || halfH(x - 1) === 0 || halfH(x + 1) === 0
      let c: Ink = INK
      if (edge) c = FG
      else if (y <= cy - hh + 2) c = (x + y) % 2 === 0 ? FG : INK // lit back, dithered
      else if (y > cy + hh - 3) c = y % 2 === 0 ? ACC : INK // accent belly hatch
      iput(f, x, y, c)
    }
  }
  // flank scars
  line(f, 16, 10, 18, 12, FG)
  line(f, 20, 9, 21, 11, FG)
  // dorsal spines
  for (const sx of [13, 16, 19, 22]) {
    const top = cy - halfH(sx)
    iput(f, sx, top - 1, FG)
    iput(f, sx + 1, top - 2, FG)
  }
  // tail
  iblit(f, imap(['...ww.', '..wkkw', '.wkkw.', 'wkkw..', '.wkkw.', '..wkkw', '...ww.']), 26, 9)
  // pectoral fin
  iblit(f, imap(['rr..', 'rkrr', '.rrr']), 14, 15)
  // eye: accent socket with a fg glint
  rect(f, 10, 9, 3, 2, ACC)
  iput(f, 11, 9, FG)
  if (!jawOpen) {
    for (let x = 6; x <= 12; x++) {
      const y = 14 + (((x / 2) | 0) % 2)
      iput(f, x, y, FG)
      if (x % 2 === 0) iput(f, x, y - 1, FG)
    }
  } else {
    for (let x = 4; x <= 12; x++) {
      const dep = Math.min(3, 12 - x)
      for (let d = -dep; d <= dep; d++) iput(f, x, 14 + d, Math.abs(d) < 2 && x > 7 ? ACC : INK)
    }
    for (let x = 5; x <= 11; x += 2) {
      iput(f, x, 12, FG)
      iput(f, x + 1, 16, FG)
    }
    line(f, 4, 17, 12, 17, FG)
  }
  // lure stalk + lamp
  for (const [sx, sy] of [[9, 5], [8, 4], [7, 3], [6, 3], [5, 4]] as const) iput(f, sx, sy, FG)
  rect(f, 3, 5, 2, 2, lureBright ? FG : ACC2)
  if (lureBright) for (const [hx, hy] of [[2, 4], [5, 7], [1, 6], [4, 8], [2, 8], [0, 5]] as const) iput(f, hx, hy, ACC2)
  return withMoat(f)
}

export function buildAngler(): IFrame[] {
  return [anglerFrame(false, false), anglerFrame(false, true), anglerFrame(true, true), anglerFrame(true, false)]
}

// ---------------------------------------------------------------------------
// Squid — 20×28: a fg ghost with bg-socket accent eyes (Downwell's jellies)
// ---------------------------------------------------------------------------

function squidFrame(pulse: boolean, phase: number): IFrame {
  const f = iblank(22, 30)
  const cx = 11
  const half = (y: number) => {
    if (y < 1 || y > 12) return 0
    if (y <= 3) return 2 + (y - 1)
    if (y <= 8) return 5
    return Math.round(5 - (y - 8) * 1.3)
  }
  // tentacles first so the mantle overlaps their roots
  for (let i = 0; i < 5; i++) {
    const bx = cx - 6 + i * 3
    const len = 13 + (i % 3) * 2
    for (let j = 0; j < len; j++) {
      const y = 12 + j
      const x = Math.round(bx + Math.sin(j * 0.5 + i * 1.3 + phase) * 1.6)
      iput(f, x, y, j > len - 3 && j % 2 === 0 ? ACC2 : FG)
      iput(f, x + 1, y, INK)
    }
  }
  for (let y = 1; y <= 12; y++) {
    const h = half(y) + (pulse ? 1 : 0)
    if (h <= 0) continue
    for (let x = cx - h; x <= cx + h; x++) {
      const p = (x - (cx - h)) / Math.max(1, 2 * h)
      let c: Ink = FG
      if (p > 0.72 && x !== cx + h && y % 2 === 0) c = INK
      if (y === 12) c = x % 2 === 0 ? FG : INK // frilled rim
      iput(f, x, y, c)
    }
  }
  // fins
  iblit(f, imap(['w.', 'ww', 'w.']), cx - half(5) - (pulse ? 3 : 2), 4)
  iblit(f, imap(['.w', 'ww', '.w']), cx + half(5) + (pulse ? 2 : 1), 4)
  // eyes: bg sockets, accent irises
  for (const ex of [cx - 3, cx + 2]) {
    rect(f, ex, 5, 2, 3, INK)
    iput(f, ex, 6, ACC)
  }
  // accent spots down the mantle
  iput(f, cx, 2, ACC)
  iput(f, cx - 1, 9, ACC)
  iput(f, cx + 2, 10, ACC)
  return withMoat(f)
}

export function buildSquid(): IFrame[] {
  return [squidFrame(false, 0), squidFrame(true, 1.6), squidFrame(false, 3.2)]
}

// ---------------------------------------------------------------------------
// Contact mine — 18×18 spiked accent shell, blinking fg fuse
// ---------------------------------------------------------------------------

function mineFrame(bright: boolean): IFrame {
  const f = iblank(20, 20)
  const cx = 9.5
  const cy = 9.5
  const r = 5.6
  const dirs: [number, number][] = [
    [1, 0], [0, 1], [-1, 0], [0, -1],
    [0.71, 0.71], [-0.71, 0.71], [0.71, -0.71], [-0.71, -0.71],
  ]
  for (const [hx, hy] of dirs) {
    for (let i = 0; i < 4; i++) {
      const bx = cx + hx * (r + i * 0.95)
      const by = cy + hy * (r + i * 0.95)
      iput(f, bx, by, i >= 2 ? FG : INK)
      if (i < 2) iput(f, bx - hy, by + hx, INK)
    }
  }
  fillShape(f, ellipse(cx, cy, r, r), bodyPaint(ACC, { cx, cy, rx: r, ry: r, hatch: 0.15, solid: 0.6 }))
  iput(f, 7, 7, FG)
  iput(f, 8, 7, FG)
  iput(f, 7, 8, FG)
  rect(f, 9, 9, 2, 2, bright ? FG : INK)
  if (bright) {
    for (const [lx, ly] of [[9, 8], [10, 11], [8, 10], [11, 9]] as const) iput(f, lx, ly, INK)
  }
  return withMoat(f)
}

export function buildMine(): IFrame[] {
  return [mineFrame(false), mineFrame(true)]
}

/** A horizontal mooring chain `length` px long, fg links engraved in bg. */
export function buildChain(length: number, seed: number): IFrame {
  const f = iblank(Math.max(8, length), 8)
  for (let x = 0, i = 0; x < f.w; x += 5, i++) {
    if ((i + seed) % 2 === 1) {
      rect(f, x + 3, 2, 2, 4, FG)
      iput(f, x + 3, 1, INK)
    } else {
      rect(f, x + 1, 2, 6, 4, FG)
      rect(f, x + 2, 3, 4, 2, INK)
    }
  }
  return f
}

// ---------------------------------------------------------------------------
// Tentacle wall — an accent limb with fg sucker rings and a spined crest
// ---------------------------------------------------------------------------

export function buildTentacleArm(length: number, thickness: number, seed: number): IFrame {
  const f = iblank(length, thickness)
  const cy = thickness / 2
  const centers: number[] = []
  const halves: number[] = []
  for (let x = 0; x < length; x++) {
    const t = x / length
    const half = Math.max(1.5, (thickness / 2 - 4) * (1 - t * 0.84))
    const yc = cy + Math.sin(x * 0.09 + seed) * (thickness * 0.12) * t
    centers.push(yc)
    halves.push(half)
    for (let y = 0; y < thickness; y++) {
      const d = y - yc
      if (Math.abs(d) > half) continue
      const s = d / half // -1 top .. 1 underside
      let c: Ink = ACC
      if (s < -0.86) c = FG
      else if (s > 0.62) c = (x + y) % 3 === 0 ? ACC : INK
      else if (s > 0.2) c = y % 2 === 0 ? INK : ACC
      iput(f, x, y, c)
    }
  }
  // crest spines
  for (let x = 6; x < length - 6; x += 9) {
    const top = Math.round(centers[x] - halves[x])
    const tall = Math.max(1, Math.round(halves[x] * 0.35))
    for (let i = 1; i <= tall; i++) iput(f, x + Math.floor(i / 2), top - i, FG)
  }
  // sucker rings along the underside
  for (let x = 5; x < length - 4; x += 8) {
    if (halves[x] < 4) continue
    const sy = Math.round(centers[x] + halves[x] * 0.55)
    iblit(f, imap(['.w.', 'wkw', '.w.']), x - 1, sy - 1)
  }
  return f
}

// ---------------------------------------------------------------------------
// Bosses — the Warden (bg dreadnought in fg engraving) and the Kracken
// (a Downwell-red mass crowned with fg thorns)
// ---------------------------------------------------------------------------

interface BossStyle {
  w: number
  h: number
  tentacles: number
  kind: 'warden' | 'kracken'
  seed: number
}

const WARDEN: BossStyle = { w: 224, h: 96, tentacles: 6, kind: 'warden', seed: 101 }
const KRACKEN: BossStyle = { w: 240, h: 120, tentacles: 16, kind: 'kracken', seed: 202 }

function bossCrest(p: BossStyle, x: number): number {
  const cx = p.w / 2
  const arc = ((x - cx) / cx) ** 2
  const wob = Math.floor(hash(x >> 3, 0, p.seed) * 5)
  return Math.round(p.h * 0.3 + arc * p.h * 0.34 + wob)
}

function bossTentacle(f: IFrame, p: BossStyle, baseX: number, topY: number, len: number, phase: number, sway: number) {
  const body: Ink = p.kind === 'kracken' ? ACC : INK
  for (let i = 0; i < len; i++) {
    const y = topY + len - 1 - i
    const t = i / len
    const x = Math.round(baseX + Math.sin(i * 0.22 + phase + sway) * (3 + t * 5))
    const half = Math.max(1, Math.round(3.6 * (1 - t)))
    for (let dx = -half; dx <= half; dx++) {
      let c: Ink = body
      if (dx === -half) c = FG
      else if (dx === half) c = p.kind === 'kracken' ? INK : FG
      else if (p.kind === 'kracken' && dx > 0 && y % 2 === 0) c = INK
      iput(f, x + dx, y, c)
    }
    if (i === len - 1) iput(f, x, y - 1, FG)
    if (i % 6 === 3 && half > 1) iput(f, x, y, p.kind === 'kracken' ? FG : ACC)
  }
}

function bossFrame(p: BossStyle, jaw: number, sway: number, eyesBright: boolean): IFrame {
  const f = iblank(p.w, p.h)
  const cx = p.w / 2
  const kr = p.kind === 'kracken'

  for (let i = 0; i < p.tentacles; i++) {
    const spread = (i + 0.5) / p.tentacles
    const baseX = Math.round(8 + spread * (p.w - 16))
    const off = Math.abs(spread - 0.5) < 0.18 ? (spread < 0.5 ? -26 : 26) : 0
    const topY = bossCrest(p, baseX + off) + 4
    const len = Math.round(topY * (0.55 + hash(i, 1, p.seed) * 0.4))
    bossTentacle(f, p, baseX + off, topY - len, len, i * 1.7, sway)
  }

  // the mass
  for (let x = 0; x < p.w; x++) {
    const top = bossCrest(p, x)
    for (let y = top; y < p.h; y++) {
      const d = y - top
      const depth = (y - top) / Math.max(1, p.h - top)
      let c: Ink
      if (kr) {
        if (d === 0) c = FG
        else if (d === 1) c = INK
        else if (depth > 0.55) c = y % 2 === 0 ? INK : dith(x, y, 1 - (depth - 0.55) * 1.6) ? ACC : INK
        else c = ACC
      } else {
        // the Warden: bg-dark hull engraved with fg lines that thin with depth
        if (d === 0) c = FG
        else if (d === 1) c = INK
        else if (d === 2) c = FG
        else c = y % 3 === 0 && dith(x, y, 0.85 - depth * 1.1) ? FG : INK
      }
      iput(f, x, y, c)
    }
  }
  // Kracken crown of thorns along the crest
  if (kr) {
    for (let x = 6; x < p.w - 6; x += 7) {
      const top = bossCrest(p, x)
      const tall = 2 + Math.round(hash(x, 3, p.seed) * 4)
      for (let i = 1; i <= tall; i++) {
        iput(f, x - Math.floor(i / 3), top - i, FG)
        if (i < tall - 1) iput(f, x + 1 - Math.floor(i / 3), top - i, INK)
      }
    }
  }
  // hull plate seams (Warden) / glowing fg cracks (Kracken)
  if (!kr) {
    for (let sx = 14; sx < p.w - 8; sx += 22) {
      const top = bossCrest(p, sx) + 4
      for (let y = top; y < p.h - 2; y++) {
        if (hash(sx, y, p.seed + 4) > 0.9) continue
        iput(f, sx + ((y >> 3) % 2), y, FG)
        if (y % 6 === 3) iput(f, sx + ((y >> 3) % 2) + 2, y, ACC)
      }
    }
  } else {
    for (let i = 0; i < p.w / 9; i++) {
      const sx = Math.round(hash(i, 7, p.seed) * (p.w - 16) + 8)
      const sy = bossCrest(p, sx) + 6 + Math.round(hash(i, 8, p.seed) * p.h * 0.28)
      const len = 5 + Math.round(hash(i, 9, p.seed) * 7)
      for (let j = 0; j < len; j++) {
        const gx = sx + j
        const gy = sy + Math.round(Math.sin(j * 1.1 + i) * 1.5)
        iput(f, gx, gy, INK)
        if (j % 3 === 1) iput(f, gx, gy - 1, FG)
      }
    }
  }

  // the mouth: a bg gape with an accent gullet and fg teeth
  const mouthRx = Math.round(p.w * 0.26)
  const mouthRy = Math.round(3 + jaw * (p.h * 0.17))
  const mouthCy = Math.round(p.h * 0.6)
  for (let y = -mouthRy; y <= mouthRy; y++) {
    const span = Math.floor(mouthRx * Math.sqrt(Math.max(0, 1 - (y / mouthRy) ** 2)))
    for (let x = -span; x <= span; x++) {
      const edge = Math.abs(x) >= span - 1 || Math.abs(y) >= mouthRy - 1
      const g = Math.hypot(x / mouthRx, y / mouthRy)
      let c: Ink = INK
      if (edge) c = kr ? INK : FG
      else if (g < 0.5 && dith(x + 64, y + 64, (0.5 - g) * 2.6)) c = ACC
      iput(f, cx + x, mouthCy + y, c)
    }
  }
  const toothH = Math.min(6, mouthRy - 1)
  if (toothH > 1) {
    for (let tx = -mouthRx + 6; tx <= mouthRx - 6; tx += 8) {
      const span = Math.floor(mouthRy * 0.9)
      for (let ty = 0; ty < toothH; ty++) {
        const half = Math.max(0, Math.round(2 * (1 - ty / toothH)))
        for (let dx = -half; dx <= half; dx++) {
          iput(f, cx + tx + dx, mouthCy - span + ty, dx === half ? INK : FG)
          iput(f, cx + tx + 4 + dx, mouthCy + span - ty, dx === half ? INK : FG)
        }
      }
    }
  }

  // eyes
  for (const ex of [Math.round(p.w * 0.15), Math.round(p.w * 0.85)]) {
    const ey = bossCrest(p, ex) + 13
    const r = 7
    for (let dy = -r - 1; dy <= r + 1; dy++)
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        const d = Math.hypot(dx, dy)
        if (d > r + 1) continue
        let c: Ink
        if (d > r) c = INK
        else if (d > r - 1.3) c = FG
        else if (d > r - 2.5) c = INK
        else if (kr) c = Math.abs(dx) < 2 && Math.abs(dy) < r - 3 ? INK : eyesBright ? FG : ACC // slit pupil
        else c = d < 2.2 ? (eyesBright ? FG : ACC) : d < 4 ? ACC : (dx + dy) % 2 === 0 ? ACC : INK
        iput(f, ex + dx, ey + dy, c)
      }
    if (eyesBright) {
      for (const [hx, hy] of [[-r - 3, 0], [r + 3, 0], [0, -r - 3], [-r - 1, -r - 1], [r + 1, -r - 1]] as const)
        iput(f, ex + hx, ey + hy, FG)
    }
  }

  // salvage chains across the Warden's hull
  if (!kr) {
    for (const [x0, x1] of [[18, 74], [150, 206]] as const) {
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / (x1 - x0)
        const y = bossCrest(p, x) + 7 + Math.round(Math.sin(t * Math.PI) * 7)
        if (x % 4 === 0) {
          rect(f, x, y - 1, 3, 3, FG)
          iput(f, x + 1, y, INK)
        } else if (x % 4 === 2) iput(f, x, y, ACC)
      }
    }
  }
  return f
}

export function buildBoss(variant: 'warden' | 'kracken'): IFrame[] {
  const p = variant === 'warden' ? WARDEN : KRACKEN
  const jaws = [0.35, 0.7, 1, 0.7]
  return jaws.map((jaw, i) => bossFrame(p, jaw, (i * Math.PI) / 2, i === 2))
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

/** Player torpedo — fg capsule, bg seam, accent warhead; nose down. */
export function buildTorpedo(): IFrame[] {
  const body = [
    '..wkkw..',
    '.wwkkww.',
    '.wwkkww.',
    '.wwkwwk.',
    '.wwkwwk.',
    '.wwkwwk.',
    '.wwkwwk.',
    '.kkkkkk.',
    '.rrrrrk.',
    '.rrrrrk.',
    '..rrrk..',
    '...rk...',
  ]
  return [
    withMoat(imap(['w......w', 'ww.bb.ww', ...body])),
    withMoat(imap(['.w....w.', 'ww.b..ww', ...body])),
  ]
}

/** Enemy tracer — an accent slug with a fg-hot head, climbing up. */
export function buildTracer(): IFrame[] {
  return [
    withMoat(imap(['.ww.', 'wwww', 'rwwr', 'rrrk', 'rrrk', '.rk.', '.r..', '..r.'])),
    withMoat(imap(['.ww.', 'wwww', 'rwwr', 'rrrk', 'rrrk', '.rk.', '..r.', '.r..'])),
  ]
}

/** Mine shrapnel — a tumbling accent shard with a fg edge. */
export function buildShrapnel(): IFrame[] {
  const base = imap(['.......', '..ww...', '.wrrk..', '.wrrk..', '..rk...', '...k...', '.......'])
  const frames = [base]
  for (let i = 0; i < 3; i++) frames.push(irot90(frames[i]))
  return frames.map((f) => withMoat(f))
}

/** Bubbles, four sizes: accent2 rings, the biggest with a fg glint. */
export function buildBubbles(): IFrame[] {
  return [
    imap(['b']),
    imap(['.b.', 'b.b', '.b.']),
    imap(['.bb.', 'b..b', 'b..b', '.bb.']),
    imap(['.bbb.', 'bw..b', 'b...b', 'b...b', '.bbb.']),
  ]
}

// ---------------------------------------------------------------------------
// Pickups — an icon floating in an accent2 bubble
// ---------------------------------------------------------------------------

export type PodKind = 'shotgun' | 'laser' | 'health' | 'extraLife'

const POD_ICONS: Record<PodKind, string[]> = {
  shotgun: [
    'w...w...w',
    '.w..w..w.',
    '.w..w..w.',
    '..w.w.w..',
    '.rrrrrrr.',
    '..rrrrk..',
    '...rrk...',
    '....k....',
    '.........',
  ],
  laser: [
    '....bbbb.',
    '...bbbw..',
    '..bbbw...',
    '.bbbbbbb.',
    '....bbw..',
    '...bbw...',
    '..bbw....',
    '.bw......',
    '.........',
  ],
  health: [
    '.........',
    '.rr...rr.',
    'rwrr.rrrr',
    'rwrrrrrrk',
    'rrrrrrrrk',
    '.rrrrrrk.',
    '..rrrrk..',
    '...rrk...',
    '....k....',
  ],
  extraLife: [
    '....w....',
    '...www...',
    'wwwwrwwww',
    '.wwrrrww.',
    '..wwrww..',
    '..wwkww..',
    '.www.www.',
    '.ww...ww.',
    '.........',
  ],
}

function podFrame(kind: PodKind, blink: boolean): IFrame {
  const f = iblank(20, 20)
  const c = 9.5
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 20; x++) {
      const d = Math.hypot(x - c, y - c)
      if (d > 9.3) continue
      if (d > 8.2) iput(f, x, y, blink ? FG : ACC2)
      else iput(f, x, y, INK)
    }
  // glint arc on the upper-left of the bubble
  for (const [gx, gy] of [[4, 6], [4, 5], [5, 4], [6, 4], [5, 5]] as const) iput(f, gx + (blink ? 1 : 0), gy, FG)
  iblit(f, imap(POD_ICONS[kind]), 6, 6)
  return withMoat(f)
}

export function buildPods(): Record<PodKind, IFrame[]> {
  const out = {} as Record<PodKind, IFrame[]>
  for (const k of Object.keys(POD_ICONS) as PodKind[]) out[k] = [podFrame(k, false), podFrame(k, true)]
  return out
}

// ---------------------------------------------------------------------------
// Explosions — Downwell bursts: fg flash → bg-cored accent ring flung
// with debris → a dithered, fading halo
// ---------------------------------------------------------------------------

export function buildExplosion(size: number, frames: number, seed: number): IFrame[] {
  const out: IFrame[] = []
  const half = size / 2
  const debris = Array.from({ length: Math.round(size / 3) }, (_, i) => ({
    a: hash(i, 0, seed) * Math.PI * 2,
    s: 0.6 + hash(i, 1, seed) * 0.7,
    c: (hash(i, 2, seed) > 0.4 ? ACC : FG) as Ink,
  }))
  for (let i = 0; i < frames; i++) {
    const t = i / (frames - 1)
    const f = iblank(size, size)
    const grow = 1 - (1 - Math.min(1, t * 1.6)) ** 2
    const rOut = half * (0.3 + 0.62 * grow)
    const thick = Math.max(1, rOut * (0.9 - t) * 0.7)
    const rIn = t < 0.12 ? -1 : rOut - thick
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const ang = Math.atan2(y - half + 0.5, x - half + 0.5)
        const n = (hash(Math.floor((ang + 4) * 3), i, seed) - 0.5) * half * 0.18
        const d = Math.hypot(x - half + 0.5, y - half + 0.5) + n
        if (d > rOut || d < rIn) continue
        let c: Ink
        if (t < 0.12) c = FG
        else if (t < 0.3) c = d > rOut - 1.2 ? ACC : FG
        else if (t < 0.7) c = d > rOut - 1.2 ? FG : ACC
        else c = dith(x, y, 1.4 - t * 1.3) ? (d > rOut - 1.5 ? FG : ACC) : CLEAR
        // radial cuts keep the ring chunky
        if (t >= 0.3 && hash(Math.floor((ang + 4) * 5), 9, seed) > 0.78) c = INK
        if (c) iput(f, x, y, c)
      }
    if (t >= 0.2) {
      for (const p of debris) {
        const rr = rOut * (1.05 + p.s * t * 0.6)
        if (rr > half - 1) continue
        const x = half + Math.cos(p.a) * rr
        const y = half + Math.sin(p.a) * rr
        const big = t < 0.6 && p.s > 1
        iput(f, x, y, p.c)
        if (big) iput(f, x + 1, y, p.c)
      }
    }
    out.push(f)
  }
  return out
}

// ---------------------------------------------------------------------------
// HUD bits
// ---------------------------------------------------------------------------

/** One hull pip for the lives meter — full (accent) or spent (outline). */
export function buildPip(full: boolean): IFrame {
  return full ? imap(['wrrk', 'rrrk', 'rrrk', 'kkkk']) : imap(['rrr.', 'r..k', 'r..k', '.kk.'])
}

/** A tiny top-down sub for palette cards and menus. */
export function buildMiniSub(): IFrame {
  return withMoat(
    imap([
      '..ww...ww..',
      '..rw...wr..',
      '.wwwwwwwww.',
      '.wkwwwwwkw.',
      '.wkwbbbwkw.',
      '.wkwbwbwkw.',
      '.wkwbbbwkw.',
      'rwkwwwwwkwr',
      'rwkkkkkkkwr',
      '.wkrrkrrkw.',
      '.wkkkkkkkw.',
      '.wkwwwwwkw.',
      '..wkwwwkw..',
      '...wkbkw...',
      '....www....',
    ]),
  )
}

/** The score "gem": a faceted accent pearl. */
export function buildGem(): IFrame {
  return withMoat(imap(['.rrr.', 'rwrrk', 'rrrrk', '.rrk.', '..k..']))
}

// ---------------------------------------------------------------------------
// Full set
// ---------------------------------------------------------------------------

export interface TwoToneSprites {
  [name: string]: IAnim
}

export function buildTwoToneSprites(): TwoToneSprites {
  const player = buildPlayerSub()
  const enemySub = buildEnemySub()
  const pods = buildPods()
  return {
    playerIdle: { frames: player.idle, fps: 10 },
    playerBankL: { frames: player.bankL, fps: 10 },
    playerBankR: { frames: player.bankR, fps: 10 },
    torpedo: { frames: buildTorpedo(), fps: 14 },
    tracer: { frames: buildTracer(), fps: 14 },
    shrapnel: { frames: buildShrapnel(), fps: 10 },
    frogman: { frames: buildFrogman(), fps: 7 },
    redFish: { frames: buildRedFish(), fps: 6 },
    angler: { frames: buildAngler(), fps: 5 },
    squid: { frames: buildSquid(), fps: 4 },
    enemySub: { frames: enemySub.run, fps: 5 },
    enemySubFire: { frames: [enemySub.fire], fps: 1 },
    mine: { frames: buildMine(), fps: 3 },
    bossWarden: { frames: buildBoss('warden'), fps: 4 },
    bossKracken: { frames: buildBoss('kracken'), fps: 4 },
    explosionS: { frames: buildExplosion(16, 6, 11), fps: 15 },
    explosionM: { frames: buildExplosion(32, 8, 23), fps: 15 },
    explosionL: { frames: buildExplosion(48, 12, 37), fps: 15 },
    bubbles: { frames: buildBubbles(), fps: 0 },
    pod_shotgun: { frames: pods.shotgun, fps: 3 },
    pod_laser: { frames: pods.laser, fps: 3 },
    pod_health: { frames: pods.health, fps: 3 },
    pod_extraLife: { frames: pods.extraLife, fps: 3 },
  }
}
