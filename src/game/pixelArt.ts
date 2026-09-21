/**
 * pixelArt.ts — the "In the Hunt"-style sprite set, authored in code.
 *
 * Every sprite is produced as a raw RGBA pixel buffer (`Frame`) from
 * hand-placed pixel maps and small parametric generators, constrained to
 * the master palette from REVAMP_IN_THE_HUNT.md. No DOM or three.js
 * dependency — frames convert to canvases via `frameToCanvas` in the
 * browser, or can be PNG-encoded in node for previews.
 *
 * Style rules enforced here (see the revamp doc):
 *  - dark navy outlines, never pure black, never anti-aliased
 *  - 2–3 stepped shading tones + checker dithering, no gradients
 *  - saturation is information: fire ramp / warning red / lamp glow only
 *    on danger and pickups; player hardware in blue steel, enemy in
 *    olive drab and rust
 */

export interface Frame {
  w: number
  h: number
  data: Uint8ClampedArray
}

export interface SpriteAnim {
  frames: Frame[]
  fps: number
  loop: boolean
}

/** Master palette — hex values from the revamp concept doc. */
export const PALETTE: Record<string, string> = {
  outline: '#0c1014',
  steelDark: '#39424c',
  steelMid: '#5a6670',
  steelLight: '#8a97a0',
  steelBright: '#c2ccd2',
  oliveDark: '#2e3a26',
  oliveMid: '#4a5a34',
  oliveLight: '#6e7d46',
  olivePale: '#93a05b',
  rustDark: '#4a2d1c',
  rustMid: '#7a4a26',
  rustLight: '#a8703a',
  fireFlash: '#fff8d0',
  fireYellow: '#ffd23e',
  fireOrange: '#ff8c1a',
  fireDeep: '#c93a12',
  smokeDark: '#16161c',
  smokeMid: '#2c2c34',
  smokeLight: '#4a4a54',
  warnRed: '#d8302a',
  warnBright: '#ff5a4a',
  glowAqua: '#aef2e0',
  glowWarm: '#ffe9a0',
  bubble: '#cfeef2',
  wetsuit: '#1c2830',
}

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/**
 * One character per palette entry, used by the hand-authored string maps.
 * '.' is transparent.
 */
const LEGEND: Record<string, RGB> = {
  o: hexToRgb(PALETTE.outline),
  d: hexToRgb(PALETTE.steelDark),
  s: hexToRgb(PALETTE.steelMid),
  S: hexToRgb(PALETTE.steelLight),
  w: hexToRgb(PALETTE.steelBright),
  k: hexToRgb(PALETTE.oliveDark),
  v: hexToRgb(PALETTE.oliveMid),
  V: hexToRgb(PALETTE.oliveLight),
  L: hexToRgb(PALETTE.olivePale),
  r: hexToRgb(PALETTE.rustDark),
  R: hexToRgb(PALETTE.rustMid),
  U: hexToRgb(PALETTE.rustLight),
  f: hexToRgb(PALETTE.fireFlash),
  y: hexToRgb(PALETTE.fireYellow),
  O: hexToRgb(PALETTE.fireOrange),
  C: hexToRgb(PALETTE.fireDeep),
  m: hexToRgb(PALETTE.smokeDark),
  M: hexToRgb(PALETTE.smokeMid),
  N: hexToRgb(PALETTE.smokeLight),
  e: hexToRgb(PALETTE.warnRed),
  E: hexToRgb(PALETTE.warnBright),
  g: hexToRgb(PALETTE.glowAqua),
  G: hexToRgb(PALETTE.glowWarm),
  b: hexToRgb(PALETTE.bubble),
  t: hexToRgb(PALETTE.wetsuit),
}

// ---------------------------------------------------------------------------
// Frame primitives
// ---------------------------------------------------------------------------

export function blank(w: number, h: number): Frame {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) }
}

function put(f: Frame, x: number, y: number, c: RGB, a = 255): void {
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return
  const i = (y * f.w + x) * 4
  f.data[i] = c[0]
  f.data[i + 1] = c[1]
  f.data[i + 2] = c[2]
  f.data[i + 3] = a
}

function getAlpha(f: Frame, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return 0
  return f.data[(y * f.w + x) * 4 + 3]
}

/** Parse a hand-authored string map into a frame. Rows must be equal length. */
export function parseMap(rows: string[]): Frame {
  const w = rows[0].length
  const f = blank(w, rows.length)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.') continue
      const c = LEGEND[ch]
      if (!c) throw new Error(`pixelArt: unknown legend char '${ch}'`)
      put(f, x, y, c)
    }
  })
  return f
}

/** Copy src onto dst at (ox, oy); transparent src pixels leave dst alone. */
export function blit(dst: Frame, src: Frame, ox: number, oy: number): void {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4
      if (src.data[si + 3] === 0) continue
      const dx = ox + x
      const dy = oy + y
      if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue
      const di = (dy * dst.w + dx) * 4
      dst.data[di] = src.data[si]
      dst.data[di + 1] = src.data[si + 1]
      dst.data[di + 2] = src.data[si + 2]
      dst.data[di + 3] = src.data[si + 3]
    }
  }
}

export function clone(f: Frame): Frame {
  return { w: f.w, h: f.h, data: new Uint8ClampedArray(f.data) }
}

export function mirrorX(f: Frame): Frame {
  const out = blank(f.w, f.h)
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const si = (y * f.w + x) * 4
      const di = (y * f.w + (f.w - 1 - x)) * 4
      out.data[di] = f.data[si]
      out.data[di + 1] = f.data[si + 1]
      out.data[di + 2] = f.data[si + 2]
      out.data[di + 3] = f.data[si + 3]
    }
  }
  return out
}

function rot90(f: Frame): Frame {
  const out = blank(f.h, f.w)
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const si = (y * f.w + x) * 4
      const di = (x * out.w + (out.w - 1 - y)) * 4
      out.data[di] = f.data[si]
      out.data[di + 1] = f.data[si + 1]
      out.data[di + 2] = f.data[si + 2]
      out.data[di + 3] = f.data[si + 3]
    }
  }
  return out
}

/**
 * Horizontal shear for banking poses: rows shift sideways by up to
 * `maxShift`, growing from the anchor row toward the far end, so a
 * nose-down hull leans without redrawing it.
 */
function shear(f: Frame, maxShift: number, anchorY = 6): Frame {
  const out = blank(f.w, f.h)
  for (let y = 0; y < f.h; y++) {
    const p = Math.max(0, y - anchorY) / Math.max(1, f.h - 1 - anchorY)
    const shift = Math.round(maxShift * p)
    for (let x = 0; x < f.w; x++) {
      const si = (y * f.w + x) * 4
      if (f.data[si + 3] === 0) continue
      const dx = x + shift
      if (dx < 0 || dx >= f.w) continue
      const di = (y * f.w + dx) * 4
      out.data[di] = f.data[si]
      out.data[di + 1] = f.data[si + 1]
      out.data[di + 2] = f.data[si + 2]
      out.data[di + 3] = f.data[si + 3]
    }
  }
  return out
}

/** Deterministic hash noise in [0, 1) for dither/speckle. */
function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// ---------------------------------------------------------------------------
// Parametric hull generator (player + enemy submarines)
// ---------------------------------------------------------------------------

interface HullPalette {
  outline: RGB
  dark: RGB
  mid: RGB
  light: RGB
  spine: RGB
}

/**
 * Build a symmetric top-down hull. `edge(y)` returns the left-edge column
 * for hull rows (null = no hull on that row); shading steps from outline
 * → dark → mid → light toward the spine, with seam rows and rivet
 * highlights along the plating.
 */
function hullTopDown(
  w: number,
  h: number,
  edge: (y: number) => number | null,
  pal: HullPalette,
  seamRows: number[],
): Frame {
  const f = blank(w, h)
  const cx = w / 2
  for (let y = 0; y < h; y++) {
    const e = edge(y)
    if (e === null) continue
    for (let x = e; x < cx; x++) {
      const din = x - e
      const above = edge(y - 1)
      const below = edge(y + 1)
      const capped = above === null || below === null
      let c: RGB
      if (din === 0 || capped) c = pal.outline
      else if (din <= 1) c = pal.dark
      else {
        const span = cx - e
        const p = din / span
        if (p > 0.82) c = pal.spine
        else if (p > 0.5) c = pal.light
        else c = pal.mid
        // checker dither at band boundaries keeps the stepping chunky
        if (p > 0.46 && p <= 0.5 && (x + y) % 2 === 0) c = pal.light
        if (p > 0.78 && p <= 0.82 && (x + y) % 2 === 0) c = pal.spine
      }
      if (seamRows.includes(y) && din > 0 && !capped) {
        c = din % 5 === 2 ? pal.light : pal.dark
      }
      put(f, x, y, c)
      put(f, w - 1 - x, y, c)
    }
  }
  // rivets: single bright pixels just inside the outline, spaced down the hull
  for (let y = 2; y < h - 2; y += 4) {
    const e = edge(y)
    if (e === null || edge(y - 1) === null || edge(y + 1) === null) continue
    put(f, e + 2, y, pal.spine)
    put(f, w - 3 - e, y, pal.spine)
  }
  return f
}

/** Piecewise-linear edge profile from [row, leftEdgeCol] control points. */
function edgeProfile(points: [number, number][]): (y: number) => number | null {
  return (y: number) => {
    if (y < points[0][0] || y > points[points.length - 1][0]) return null
    for (let i = 1; i < points.length; i++) {
      const [y0, x0] = points[i - 1]
      const [y1, x1] = points[i]
      if (y <= y1) {
        const t = (y - y0) / Math.max(1, y1 - y0)
        return Math.round(x0 + (x1 - x0) * t)
      }
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// Player submarine — 32×48, nose down
// ---------------------------------------------------------------------------

const STEEL: HullPalette = {
  outline: LEGEND.o,
  dark: LEGEND.d,
  mid: LEGEND.s,
  light: LEGEND.S,
  spine: LEGEND.w,
}

/**
 * Twin shrouded prop nacelles at the stern (top): boxy housings with the
 * blade pattern swapping inside for the spin frames.
 */
function playerProps(frame: number): Frame {
  const blades = frame === 0 ? ['dSdd', 'ddSd'] : ['ddSd', 'dSdd']
  const nacelle = (b: string[]) =>
    parseMap(['oooo', `o${b[0].slice(0, 2)}o`, `o${b[1].slice(0, 2)}o`, 'oooo', '.ss.'])
  const f = blank(16, 5)
  blit(f, nacelle([blades[0], blades[1]]), 1, 0)
  blit(f, nacelle([blades[1], blades[0]]), 11, 0)
  // cross-brace between the nacelles
  for (let x = 5; x < 11; x++) put(f, x, 2, x % 2 === 0 ? LEGEND.d : LEGEND.o)
  return f
}

const PLAYER_WING_L = parseMap([
  'ooooo.',
  'oCOsso',
  'oCOsdo',
  'ooooo.',
])

function buildPlayerBase(): Frame {
  // long parallel sides and a blunt nose — chunky, not egg-shaped
  const edge = edgeProfile([
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
  const f = hullTopDown(32, 48, edge, STEEL, [13, 21, 31, 37])

  // stern prop nacelles
  blit(f, playerProps(0), 8, 0)

  // conning tower: raised plate with a glass cockpit dome and a pilot
  blit(
    f,
    parseMap([
      '.oooooo.',
      'odssssdo',
      'osoggoso',
      'osgwggso'.replace('w', 'b'),
      'osgttgso',
      'osoggoso',
      'odssssdo',
      '.oooooo.',
    ]),
    12,
    15,
  )

  // dive planes with the orange leading edge
  blit(f, PLAYER_WING_L, 0, 26)
  blit(f, mirrorX(PLAYER_WING_L), 26, 26)

  // hazard chevron band above the nose, pointing "down" toward the fight
  for (let y = 33; y <= 35; y++) {
    const e = edge(y)
    if (e === null) continue
    for (let x = e + 1; x < 31 - e; x++) {
      const v = (x + (35 - y) * 2) % 8
      put(f, x, y, v < 4 ? LEGEND.O : LEGEND.m)
    }
  }

  // twin torpedo ports on the nose plate
  const port = parseMap(['oooo', 'ommo', 'ommo', 'oooo'])
  blit(f, port, 8, 38)
  blit(f, port, 20, 38)

  // nose headlight lamp
  blit(f, parseMap(['.GGGG.', 'oGffGo'.replace(/f/g, 'G')]), 13, 44)
  return f
}

export function buildPlayerSub(): { idle: Frame[]; bankL: Frame[]; bankR: Frame[] } {
  const base = buildPlayerBase()
  const altProp = clone(base)
  // clear the prop region on the alternate frame, then stamp frame B
  for (let y = 0; y < 5; y++)
    for (let x = 8; x < 24; x++) put(altProp, x, y, LEGEND.o, 0)
  blit(altProp, playerProps(1), 8, 0)

  const idle = [base, altProp]
  return {
    idle,
    bankL: idle.map((fr) => shear(fr, -3)),
    bankR: idle.map((fr) => shear(fr, 3)),
  }
}

// ---------------------------------------------------------------------------
// Enemy submarine — 24×36, nose up, olive drab
// ---------------------------------------------------------------------------

const OLIVE: HullPalette = {
  outline: LEGEND.o,
  dark: LEGEND.k,
  mid: LEGEND.v,
  light: LEGEND.V,
  spine: LEGEND.L,
}

function buildEnemyBase(lampBright: boolean): Frame {
  const edge = edgeProfile([
    [1, 10],
    [4, 7],
    [8, 5],
    [12, 3],
    [26, 3],
    [30, 4],
    [33, 6],
    [35, 9],
  ])
  const f = hullTopDown(24, 36, edge, OLIVE, [10, 18, 26])

  // twin bow torpedo tubes
  blit(f, parseMap(['oo.oo', 'omomo'.replace('omo', 'o.o'), 'omomo', 'oo.oo']), 9, 1)
  put(f, 10, 2, LEGEND.m)
  put(f, 12, 2, LEGEND.m)

  // rust streaks trailing from plating seams — the hull has seen service
  const streaks: [number, number, number][] = [
    [5, 11, 4],
    [18, 19, 5],
    [7, 27, 3],
    [16, 8, 3],
  ]
  for (const [sx, sy, len] of streaks) {
    for (let i = 0; i < len; i++) put(f, sx, sy + i, i === 0 ? LEGEND.R : LEGEND.r)
  }

  // low conning tower with the red running lamp
  blit(
    f,
    parseMap([
      '.oooo.',
      'okvvko',
      lampBright ? 'ovEEvo' : 'oveevo',
      'okvvko',
      '.oooo.',
    ]),
    9,
    13,
  )
  if (lampBright) {
    // 1px warm halo around a lit lamp — the only "glow" a sprite gets
    put(f, 11, 14, LEGEND.E)
    put(f, 12, 14, LEGEND.E)
  }

  // stern prop
  blit(f, parseMap(['.oo..oo.', 'okvookvo'.replace('O', 'o'), '..oooo..']), 8, 32)
  return f
}

export function buildEnemySub(): { run: Frame[]; fire: Frame } {
  const a = buildEnemyBase(false)
  const b = buildEnemyBase(true)
  const fire = clone(b)
  // muzzle flash out of the bow tube
  blit(
    fire,
    parseMap(['...ff...', '..fyyf..', '.oyOOyo.', '..oCCo..']),
    8,
    0,
  )
  return { run: [a, b], fire }
}

// ---------------------------------------------------------------------------
// Frogman squad diver — 26×16, facing left, replaces the reef fish
// ---------------------------------------------------------------------------

function frogmanMap(kick: number, prop: number): Frame {
  const f = blank(26, 16)

  // propulsion sled: outlined steel plate with an orange nose stripe
  blit(
    f,
    parseMap([
      'oooooooooooooo',
      'oOSSSSSSSSSSdo',
      'oOssssssssssdo',
      'oOddddddddsddo'.replace('sd', 'dd'),
      '.oooooooooooo.',
    ]),
    2,
    9,
  )
  // sled prop + wash at the stern (right), flickering
  const wash = prop === 0 ? ['.oso', 'os.b', '.oso'] : ['.os.', 'o.sb', '.os.']
  blit(f, parseMap(wash), 16, 10)
  put(f, 21, 10 + (prop === 0 ? 0 : 2), LEGEND.b)

  // diver: hooded head + aqua mask, prone wetsuit body, kick fins —
  // one coherent map per pose so nothing floats out of alignment
  const diverA = [
    '..ooo.....................',
    '.oggto....................',
    'ogbggto............oMMo...',
    'ogggtto...........oMMo....',
    '.oottttttttttttttttMo.....',
    '..otttMttttMttttto.o......',
    '...ooottttttttttoo........',
    '......oooooooooo..........',
  ]
  const diverB = [
    '..ooo.....................',
    '.oggto....................',
    'ogbggto...................',
    'ogggtto...................',
    '.oottttttttttttttttoo.....',
    '..otttMttttMttttttMMo.....',
    '...ooottttttttttoooMMo....',
    '......oooooooooo...oMo....',
  ]
  blit(f, parseMap(kick === 0 ? diverA : diverB), 0, 1)

  // steel air tank riding on the diver's back
  blit(f, parseMap(['oooooo', 'sSSSdo', 'oooooo']), 8, 2)

  // exhaled bubbles ahead of the mask
  put(f, 0, 1 + kick, LEGEND.b)
  put(f, 2, 0, LEGEND.b)
  return f
}

export function buildFrogman(): Frame[] {
  return [frogmanMap(0, 0), frogmanMap(0, 1), frogmanMap(1, 0), frogmanMap(1, 1)]
}

// ---------------------------------------------------------------------------
// Angler drone — 32×24, facing left, replaces the deep monster
// ---------------------------------------------------------------------------

function anglerMap(jawOpen: boolean, lureBright: boolean): Frame {
  const f = blank(32, 22)
  const cy = 11

  // body: front col 5 → tail root col 25, bulbous at the head end
  const halfH = (x: number): number => {
    if (x < 5 || x > 25) return 0
    if (x <= 12) return Math.round(2.5 + (x - 5) * 0.55)
    if (x <= 18) return 6
    return Math.round(6 - (x - 18) * 0.6)
  }
  for (let x = 5; x <= 25; x++) {
    const hh = halfH(x)
    for (let y = cy - hh; y <= cy + hh; y++) {
      const edge =
        y === cy - hh || y === cy + hh || halfH(x - 1) === 0 || halfH(x + 1) === 0
      let c: RGB
      if (edge) c = LEGEND.o
      else if (y > cy + hh - 3) c = (x + y) % 2 === 0 ? LEGEND.L : LEGEND.V // pale belly
      else if (y < cy - hh + 3) c = LEGEND.k // dark back
      else c = hash(x, y, 5) > 0.82 ? LEGEND.k : LEGEND.v // mottled flank
      put(f, x, y, c)
    }
  }
  // rust scarring on the armored flank plates
  for (const [rx, ry] of [
    [14, 9],
    [15, 9],
    [15, 10],
    [20, 12],
    [21, 12],
  ] as const) {
    put(f, rx, ry, hash(rx, ry, 9) > 0.5 ? LEGEND.R : LEGEND.r)
  }

  // dorsal spines
  for (const sx of [12, 15, 18, 21]) {
    const topY = cy - halfH(sx)
    put(f, sx, topY - 1, LEGEND.o)
    put(f, sx, topY - 2, LEGEND.V)
    put(f, sx + 1, topY - 1, LEGEND.o)
  }

  // tail fin, two lobes
  blit(
    f,
    parseMap([
      '...oo.',
      '..oVVo',
      '.oVVo.',
      'oVVo..',
      '.oVVo.',
      '..oVVo',
      '...oo.',
    ]),
    25,
    8,
  )

  // pectoral fin flap on the flank
  blit(f, parseMap(['oo..', 'oVVo', '.oVo']), 13, 14)

  // eye: warning red, always lit
  put(f, 10, 8, LEGEND.o)
  put(f, 11, 8, LEGEND.o)
  put(f, 10, 9, LEGEND.e)
  put(f, 11, 9, LEGEND.E)

  // mouth: closed seam or gaping carve with teeth
  if (!jawOpen) {
    for (let x = 5; x <= 11; x++) {
      const y = 13 + ((x / 2) | 0) % 2
      put(f, x, y, LEGEND.o)
      if (x % 2 === 0) put(f, x, y - 1, LEGEND.w) // tooth tips over the seam
    }
  } else {
    // carve the gape
    for (let x = 4; x <= 11; x++) {
      const depth = Math.min(3, 11 - x)
      for (let d = -depth; d <= depth; d++) put(f, x, 13 + d, LEGEND.m)
    }
    // teeth along both edges of the gape
    for (let x = 5; x <= 10; x += 2) {
      put(f, x, 11, LEGEND.w)
      put(f, x + 1, 15, LEGEND.w)
    }
    // lower jaw outline
    for (let x = 4; x <= 11; x++) put(f, x, 16, LEGEND.o)
    put(f, 3, 13, LEGEND.o)
  }

  // lure: stalk arcing from the forehead out over the jaw, lamp at the tip
  const stalk: [number, number][] = [
    [8, 4],
    [7, 3],
    [6, 2],
    [5, 2],
    [4, 3],
  ]
  for (const [sx, sy] of stalk) put(f, sx, sy, LEGEND.o)
  const lamp = lureBright ? LEGEND.f : LEGEND.G
  put(f, 3, 4, lamp)
  put(f, 2, 4, lamp)
  put(f, 3, 5, lamp)
  put(f, 2, 5, lureBright ? LEGEND.G : LEGEND.y)
  if (lureBright) {
    // 1px aqua halo — the brightest thing in a dark zone
    for (const [hx, hy] of [
      [1, 4],
      [4, 5],
      [2, 3],
      [3, 6],
    ] as const)
      put(f, hx, hy, LEGEND.g)
  }
  return f
}

export function buildAngler(): Frame[] {
  return [
    anglerMap(false, false),
    anglerMap(false, true),
    anglerMap(true, true),
    anglerMap(true, false),
  ]
}

// ---------------------------------------------------------------------------
// Contact mine — 16×16, horned sphere, blinking fuse lamp
// ---------------------------------------------------------------------------

function mineMap(lampBright: boolean): Frame {
  const f = blank(18, 18)
  const cx = 8.5
  const cy = 8.5
  const r = 5.6
  // chunky horns first, so the shell outline overlaps their bases
  const horns: [number, number][] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [0.71, 0.71],
    [-0.71, 0.71],
    [0.71, -0.71],
    [-0.71, -0.71],
  ]
  for (const [hx, hy] of horns) {
    const px = [-hy, hx] // perpendicular, for horn width
    for (let i = 0; i < 4; i++) {
      const bx = cx + hx * (r + i * 0.9)
      const by = cy + hy * (r + i * 0.9)
      const wdt = i < 2 ? 1 : 0
      for (let s = -wdt; s <= wdt; s++) {
        const x = Math.round(bx + px[0] * s)
        const y = Math.round(by + px[1] * s)
        put(f, x, y, i >= 2 ? LEGEND.U : s === 0 ? LEGEND.R : LEGEND.o)
      }
    }
  }
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d > r) continue
      let c: RGB
      if (d > r - 1.1) c = LEGEND.o
      else {
        // light from upper-left, stepped, with rust creeping up the lower shell
        const l = (cx - x) * 0.6 + (cy - y) * 0.8
        if (l > 2.6) c = LEGEND.S
        else if (l > -0.8) c = LEGEND.s
        else c = LEGEND.d
        if (l > -1.2 && l <= -0.8 && (x + y) % 2 === 0) c = LEGEND.s
        if (y > cy + 2 && hash(x, y, 31) > 0.85) c = LEGEND.r
      }
      put(f, x, y, c)
    }
  }
  put(f, 6, 6, LEGEND.w) // glint
  // fuse lamp
  const lamp = lampBright ? LEGEND.E : LEGEND.e
  put(f, 8, 8, lamp)
  put(f, 9, 8, lamp)
  put(f, 8, 9, lamp)
  put(f, 9, 9, lamp)
  if (lampBright) put(f, 9, 8, LEGEND.f)
  return f
}

export function buildMine(): Frame[] {
  return [mineMap(false), mineMap(true)]
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

/** Player torpedo — 8×16, nose down, steel body with a deep-orange warhead. */
export function buildTorpedo(): Frame[] {
  const tailA = ['.o....o.', '.oo..oo.']
  const tailB = ['...oo...', '.oo..oo.']
  const body = [
    '..oddo..',
    '.odssSo.',
    '.odssSo.',
    '.odsySo.',
    '.odssSo.',
    '.odssSo.',
    '.odssSo.',
    '.odssSo.',
    '.oCCCCo.',
    '.oCOOCo.',
    '.oCOOCo.',
    '..oOOo..',
    '...oo...',
    '........',
  ]
  return [parseMap([...tailA, ...body]), parseMap([...tailB, ...body])]
}

/** Enemy tracer shell — 6×10, hot head up (it climbs toward the player). */
export function buildTracer(): Frame[] {
  const a = parseMap([
    '..oo..',
    '.offo.',
    '.oEEo.',
    '.oEEo.',
    '.oeeo.',
    '.oeeo.',
    '..ee..',
    '..Ce..',
    '...C..',
    '......',
  ])
  const b = parseMap([
    '..oo..',
    '.offo.',
    '.oEEo.',
    '.oEEo.',
    '.oeeo.',
    '.oeeo.',
    '..eC..',
    '.eC...',
    '..C...',
    '......',
  ])
  return [a, b]
}

/** Mine shrapnel — a tumbling hull shard with a heat-glowing torn edge. */
export function buildShrapnel(): Frame[] {
  const base = parseMap([
    '.......',
    '..oo...',
    '.osso..',
    '.osOo..',
    '..oOC..',
    '...C...',
    '.......',
  ])
  const frames: Frame[] = [base]
  for (let i = 0; i < 3; i++) frames.push(rot90(frames[i]))
  return frames
}

/** Wake / ambience bubbles, three sizes. */
export function buildBubbles(): Frame[] {
  return [
    parseMap(['b.', '.b']),
    parseMap(['.b.', 'b.b', '.b.']),
    parseMap(['.bb.', 'b..b', 'b..b', '.bb.']),
  ]
}

// ---------------------------------------------------------------------------
// Explosions — the centerpiece FX, procedural In the Hunt fireballs
// ---------------------------------------------------------------------------

/**
 * White-hot flash → orange fireball → rolling smoke ring. Chunky bands
 * with checker dithering at every boundary, dark outline only once the
 * smoke phase begins, spark speckle around the early frames.
 */
export function buildExplosion(size: number, frames: number, seed: number): Frame[] {
  const out: Frame[] = []
  const half = size / 2
  for (let i = 0; i < frames; i++) {
    const t = i / (frames - 1)
    const f = blank(size, size)
    const grow = 1 - (1 - Math.min(1, t * 1.5)) ** 2
    const rOut = half * (0.3 + 0.68 * grow)
    const rIn = t < 0.45 ? 0 : half * (t - 0.45) * 1.5
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = (hash(x, y, seed + i * 7) - 0.5) * (half * 0.34)
        const d = Math.hypot(x - half + 0.5, y - half + 0.5) + n
        if (d > rOut) {
          // spark speckle just outside the fireball, early frames only
          if (t < 0.4 && d < rOut * 1.45 && hash(x, y, seed + 91 + i) > 0.93) {
            put(f, x, y, hash(x, y, seed + 17) > 0.5 ? LEGEND.f : LEGEND.y)
          }
          continue
        }
        if (d < rIn) {
          // hollowed smoke interior
          if (hash(x, y, seed + 3 + i) > 0.8) put(f, x, y, LEGEND.M)
          continue
        }
        const p = d / rOut
        const dith = (x + y) % 2 === 0 ? 0.045 : -0.045
        const q = p + dith
        let c: RGB
        if (t < 0.22) {
          c = q < 0.5 ? LEGEND.f : q < 0.85 ? LEGEND.y : LEGEND.O
        } else if (t < 0.5) {
          c = q < 0.3 ? LEGEND.f : q < 0.58 ? LEGEND.y : q < 0.85 ? LEGEND.O : LEGEND.C
        } else if (t < 0.75) {
          c = q < 0.3 ? LEGEND.y : q < 0.6 ? LEGEND.O : q < 0.85 ? LEGEND.C : LEGEND.M
        } else {
          c = q < 0.35 ? LEGEND.C : q < 0.7 ? LEGEND.N : LEGEND.M
        }
        put(f, x, y, c)
      }
    }
    // dark outline on the smoke phase
    if (t >= 0.5) {
      const o = clone(f)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (getAlpha(o, x, y) === 0) continue
          const edge =
            getAlpha(o, x - 1, y) === 0 ||
            getAlpha(o, x + 1, y) === 0 ||
            getAlpha(o, x, y - 1) === 0 ||
            getAlpha(o, x, y + 1) === 0
          if (edge) put(f, x, y, LEGEND.o)
        }
      }
    }
    out.push(f)
  }
  return out
}

// ---------------------------------------------------------------------------
// Full sprite set
// ---------------------------------------------------------------------------

export interface SpriteSet {
  [name: string]: SpriteAnim
}

export function buildAllSprites(): SpriteSet {
  const player = buildPlayerSub()
  const enemySub = buildEnemySub()
  return {
    playerIdle: { frames: player.idle, fps: 10, loop: true },
    playerBankL: { frames: player.bankL, fps: 10, loop: true },
    playerBankR: { frames: player.bankR, fps: 10, loop: true },
    torpedo: { frames: buildTorpedo(), fps: 14, loop: true },
    tracer: { frames: buildTracer(), fps: 14, loop: true },
    shrapnel: { frames: buildShrapnel(), fps: 10, loop: true },
    frogman: { frames: buildFrogman(), fps: 7, loop: true },
    angler: { frames: buildAngler(), fps: 5, loop: true },
    enemySub: { frames: enemySub.run, fps: 5, loop: true },
    enemySubFire: { frames: [enemySub.fire], fps: 1, loop: false },
    mine: { frames: buildMine(), fps: 3, loop: true },
    explosionS: { frames: buildExplosion(16, 6, 11), fps: 15, loop: false },
    explosionM: { frames: buildExplosion(32, 8, 23), fps: 15, loop: false },
    explosionL: { frames: buildExplosion(48, 12, 37), fps: 15, loop: false },
    bubbles: { frames: buildBubbles(), fps: 0, loop: false },
  }
}

// ---------------------------------------------------------------------------
// Browser helper
// ---------------------------------------------------------------------------

/** Convert a frame to a 1× canvas for drawImage-based rendering. */
export function frameToCanvas(f: Frame): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = f.w
  c.height = f.h
  const ctx = c.getContext('2d')!
  ctx.putImageData(new ImageData(new Uint8ClampedArray(f.data), f.w, f.h), 0, 0)
  return c
}
