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

/**
 * Master palette — hex values from the revamp concept doc, darkened and
 * extended for the second art pass: mid/base tones pull down so the
 * bright rim-light and danger colors carry more contrast, and a handful
 * of grime/moss/rust-bloom tones give hulls a weathered, lived-in read
 * without breaking the "2–3 stepped tones, no gradients" rule (they're
 * extra *steps*, applied as dither/speckle, never blends).
 */
export const PALETTE: Record<string, string> = {
  outline: '#0c1014',
  steelDark: '#2c333a',
  steelMid: '#454f58',
  steelLight: '#717f88',
  steelBright: '#c2ccd2',
  steelShadow: '#181d21',
  oliveDark: '#232c1d',
  oliveMid: '#3a4728',
  oliveLight: '#5c6a3a',
  olivePale: '#93a05b',
  oliveShadow: '#141a10',
  rustDark: '#3c2416',
  rustMid: '#6a3f20',
  rustLight: '#a8703a',
  rustBloom: '#552d14',
  mossDark: '#293420',
  mossLight: '#4f5f34',
  fireFlash: '#fff8d0',
  fireYellow: '#ffd23e',
  fireOrange: '#ff8c1a',
  fireDeep: '#c93a12',
  smokeDark: '#121218',
  smokeMid: '#26262e',
  smokeLight: '#454550',
  warnRed: '#d8302a',
  warnBright: '#ff5a4a',
  glowAqua: '#aef2e0',
  glowWarm: '#ffe9a0',
  bubble: '#cfeef2',
  wetsuit: '#161f26',
  chain: '#8a97a0',
  squidDark: '#3a5568',
  squidLight: '#bfe4ee',
  krakenHide: '#7a2c0a',
  krakenPlate: '#c65a12',
  krakenPlateLight: '#ff9a3d',
}

/**
 * Water background ramps, four bands each, surface-light to depth-dark.
 * These are the scene-clear colors a renderer paints behind everything;
 * sprites are tuned to read against all four.
 */
export interface WaterPalette {
  label: string
  bands: [string, string, string, string]
}

export const WATER_PALETTES: Record<'blue' | 'green' | 'purple' | 'red', WaterPalette> = {
  blue: { label: 'Abyssal Blue', bands: ['#1b5352', '#133a40', '#10333a', '#0d242b'] },
  green: { label: 'Kelp Green', bands: ['#215c3d', '#17462e', '#113522', '#0b2318'] },
  purple: { label: 'Drowned Violet', bands: ['#443157', '#332343', '#251933', '#170f22'] },
  red: { label: 'Vent Crimson', bands: ['#4f2326', '#3c1a1e', '#2a1216', '#180a0d'] },
}

/** The water changes every 5000 leagues, cycling green → blue → purple → red. */
export const WATER_CYCLE_LEAGUES = 5000
export const WATER_ORDER: (keyof typeof WATER_PALETTES)[] = ['green', 'blue', 'purple', 'red']

/**
 * The water a boss fight floods the board with, echoing that boss's own
 * hide/plate palette (smoky gunmetal for the Warden, magma rust for the
 * Kracken) so its whole lair reads as its domain, not just its silhouette.
 */
export const BOSS_TINTS: Record<'warden' | 'kracken', WaterPalette> = {
  warden: { label: 'The Warden', bands: ['#454550', '#26262e', '#181d21', '#121218'] },
  kracken: { label: 'The Kracken', bands: ['#ff9a3d', '#c65a12', '#7a2c0a', '#3a1206'] },
}

export function waterAt(leagues: number): WaterPalette {
  const i = Math.floor(Math.max(0, leagues) / WATER_CYCLE_LEAGUES) % WATER_ORDER.length
  return WATER_PALETTES[WATER_ORDER[i]]
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
  x: hexToRgb(PALETTE.steelShadow),
  k: hexToRgb(PALETTE.oliveDark),
  v: hexToRgb(PALETTE.oliveMid),
  V: hexToRgb(PALETTE.oliveLight),
  L: hexToRgb(PALETTE.olivePale),
  X: hexToRgb(PALETTE.oliveShadow),
  r: hexToRgb(PALETTE.rustDark),
  R: hexToRgb(PALETTE.rustMid),
  U: hexToRgb(PALETTE.rustLight),
  p: hexToRgb(PALETTE.rustBloom),
  a: hexToRgb(PALETTE.mossDark),
  A: hexToRgb(PALETTE.mossLight),
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
  c: hexToRgb(PALETTE.chain),
  q: hexToRgb(PALETTE.squidDark),
  Q: hexToRgb(PALETTE.squidLight),
  h: hexToRgb(PALETTE.krakenHide),
  H: hexToRgb(PALETTE.krakenPlate),
  i: hexToRgb(PALETTE.krakenPlateLight),
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
  shadow: RGB // deep inner-hull shadow, one step out from the outline
  dark: RGB
  mid: RGB
  light: RGB
  spine: RGB
  wear: RGB // moss/rust speckle scattered across the plating
}

/**
 * Build a symmetric top-down hull. `edge(y)` returns the left-edge column
 * for hull rows (null = no hull on that row); shading steps from outline
 * → shadow → dark → mid → light toward the spine, with seam rows, rivet
 * highlights, and hashed weathering speckle (moss/rust patches) worked
 * into the plating so nothing reads as clean-off-the-line.
 */
function hullTopDown(
  w: number,
  h: number,
  edge: (y: number) => number | null,
  pal: HullPalette,
  seamRows: number[],
  wearSeed = 401,
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
      else if (din === 1) c = pal.shadow
      else if (din === 2) c = pal.dark
      else {
        const span = cx - e
        const p = din / span
        if (p > 0.82) c = pal.spine
        else if (p > 0.5) c = pal.light
        else c = pal.mid
        // checker dither at band boundaries keeps the stepping chunky
        if (p > 0.46 && p <= 0.5 && (x + y) % 2 === 0) c = pal.light
        if (p > 0.78 && p <= 0.82 && (x + y) % 2 === 0) c = pal.spine
        // weathering speckle: sparse moss/rust freckling across open plating
        if (p > 0.16 && p < 0.92 && hash(x, y, wearSeed) > 0.945) c = pal.wear
      }
      if (seamRows.includes(y) && din > 0 && !capped) {
        c = din % 5 === 2 ? pal.light : pal.shadow
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
  shadow: LEGEND.x,
  dark: LEGEND.d,
  mid: LEGEND.s,
  light: LEGEND.S,
  spine: LEGEND.w,
  wear: LEGEND.a,
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

  // moss creep and rust weeps along the seams — even the player's boat has
  // done hard time down here
  const streaks: [number, number, number, boolean][] = [
    [6, 22, 4, false],
    [7, 14, 3, true],
    [5, 32, 3, false],
  ]
  for (const [sx, sy, len, moss] of streaks) {
    for (let i = 0; i < len; i++) {
      const c = moss ? (i === 0 ? LEGEND.A : LEGEND.a) : i === 0 ? LEGEND.U : LEGEND.R
      put(f, sx, sy + i, c)
      put(f, 31 - sx, sy + i, c)
    }
  }

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
  shadow: LEGEND.X,
  dark: LEGEND.k,
  mid: LEGEND.v,
  light: LEGEND.V,
  spine: LEGEND.L,
  wear: LEGEND.p,
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
// Red fish — 22×14, facing left, holds its row and patrols side to side
// ---------------------------------------------------------------------------

function redFishHalfH(x: number): number {
  if (x < 3 || x > 16) return 0
  if (x <= 8) return Math.round(1.5 + (x - 3) * 0.75)
  if (x <= 11) return 5
  return Math.round(5 - (x - 11) * 1.1)
}

function redFishMap(tailWag: number): Frame {
  const f = blank(22, 14)
  const cy = 7
  for (let x = 3; x <= 16; x++) {
    const hh = redFishHalfH(x)
    for (let y = cy - hh; y <= cy + hh; y++) {
      const edge = y === cy - hh || y === cy + hh || redFishHalfH(x - 1) === 0 || redFishHalfH(x + 1) === 0
      let c: RGB
      if (edge) c = LEGEND.o
      else if (y > cy + hh - 2) c = LEGEND.r // darker belly shadow
      else if (y < cy - hh + 2) c = LEGEND.E // bright dorsal ridge
      else c = hash(x, y, 13) > 0.86 ? LEGEND.E : LEGEND.e
      put(f, x, y, c)
    }
  }
  // gill mark
  put(f, 8, cy - 1, LEGEND.o)
  put(f, 8, cy, LEGEND.o)
  put(f, 8, cy + 1, LEGEND.o)
  // dorsal fin riding the back
  put(f, 9, cy - redFishHalfH(9) - 1, LEGEND.o)
  put(f, 10, cy - redFishHalfH(10) - 2, LEGEND.C)
  put(f, 11, cy - redFishHalfH(11) - 1, LEGEND.o)
  // tail fin — two lobes that swap which leads for the wag
  const lobe = tailWag === 0 ? -1 : 1
  blit(f, parseMap(['oo.', '.Co', 'oCo', '.Co', 'oo.']), 16, cy - 2 + lobe)
  // eye
  put(f, 6, cy - 1, LEGEND.o)
  put(f, 6, cy, LEGEND.w)
  return f
}

export function buildRedFish(): Frame[] {
  return [redFishMap(0), redFishMap(1), redFishMap(0)]
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
// Squid — 20×28, mantle up top with trailing tentacles, holds its column
// and bobs up/down instead of wandering side to side. Pale ghost-white and
// ice blue, so it reads as a different kind of threat from the olive drones.
// ---------------------------------------------------------------------------

function squidHalfW(y: number): number {
  if (y < 0 || y > 11) return 0
  if (y <= 2) return 2 + y
  if (y <= 7) return 5
  return Math.round(5 - (y - 7) * 1.4)
}

function squidMap(pulse: boolean, tentaclePhase: number): Frame {
  const f = blank(20, 28)
  const cx = 10
  // mantle: pale ghost-white crown fading to ice blue, deep blue at the rim
  for (let y = 0; y <= 11; y++) {
    const half = squidHalfW(y) + (pulse ? 1 : 0)
    if (half <= 0) continue
    for (let x = cx - half; x <= cx + half; x++) {
      const edge = x === cx - half || x === cx + half || y === 11
      let c: RGB
      if (edge) c = LEGEND.o
      else if (y < 3) c = LEGEND.b
      else c = hash(x, y, 41) > 0.86 ? LEGEND.b : LEGEND.Q
      put(f, x, y, c)
    }
  }
  // small triangular fins either side, roughly mid-mantle
  const finY = 5
  const finHalf = squidHalfW(finY)
  blit(f, parseMap(['o.', 'Qo', 'o.']), cx - finHalf - 2, finY - 1)
  blit(f, mirrorX(parseMap(['o.', 'oQ', 'o.'])), cx + finHalf, finY - 1)
  // eyes: dark socket, glowing aqua core
  put(f, cx - 3, 4, LEGEND.o)
  put(f, cx - 3, 5, LEGEND.g)
  put(f, cx + 2, 4, LEGEND.o)
  put(f, cx + 2, 5, LEGEND.g)
  // tentacles: several wavy pale strands trailing down from the mantle base
  const count = 5
  for (let i = 0; i < count; i++) {
    const baseX = cx - 6 + i * 3
    const len = 13 + (i % 3) * 2
    for (let j = 0; j < len; j++) {
      const y = 11 + j
      if (y >= f.h) break
      const wave = Math.sin(j * 0.5 + i * 1.3 + tentaclePhase) * 1.6
      const x = Math.round(baseX + wave)
      put(f, x, y, j % 4 === 0 ? LEGEND.b : LEGEND.Q)
      put(f, x + 1, y, LEGEND.q)
    }
  }
  return f
}

export function buildSquid(): Frame[] {
  return [squidMap(false, 0), squidMap(true, 1.6), squidMap(false, 3.2)]
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
        if (y > cy + 2 && hash(x, y, 31) > 0.8) c = LEGEND.r
        if (y > cy + 1 && hash(x, y, 47) > 0.92) c = LEGEND.a
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
// Mooring chain — tethers a wall-mounted mine back to its anchor bolt
// ---------------------------------------------------------------------------

/** One link, alternating flat/edge-on like a real chain does. */
function chainLink(edgeOn: boolean, seed: number): Frame {
  const f = blank(8, 8)
  const rusty = hash(seed, 0, 71) > 0.6
  const ring = rusty ? LEGEND.R : LEGEND.c
  if (edgeOn) {
    for (let y = 1; y < 7; y++) put(f, 3, y, y === 1 || y === 6 ? LEGEND.o : ring)
    for (let y = 2; y < 6; y++) put(f, 4, y, ring)
  } else {
    for (let x = 1; x < 7; x++) {
      for (let y = 2; y < 6; y++) {
        const edge = x === 1 || x === 6 || y === 2 || y === 5
        put(f, x, y, edge ? LEGEND.o : ring)
      }
    }
    put(f, 2, 3, LEGEND.w)
  }
  return f
}

/** A horizontal mooring line of interlocking links, `length` px long. */
export function buildChain(length: number, seed: number): Frame {
  const f = blank(Math.max(8, length), 8)
  let x = 0
  let i = 0
  while (x < f.w) {
    blit(f, chainLink(i % 2 === 1, seed + i), x, 0)
    x += 5
    i++
  }
  return f
}

// ---------------------------------------------------------------------------
// Bosses — the Warden (drowned dreadnought) and the Kracken variant
// ---------------------------------------------------------------------------

interface BossParams {
  w: number
  h: number
  tentacles: number
  hide: RGB // deep body mass
  plate: RGB // armored plating
  plateLight: RGB // plate highlight / rim light
  accent1: RGB // scarring / crack color, dark
  accent2: RGB // scarring / crack color, bright
  eyeCore: RGB
  eyeBright: RGB
  eyeHalo: RGB
  sucker: RGB
  glowCracks: boolean // Kracken: magma-lit seams across the hide
  chains: boolean // Warden: salvage chains across the hull
  seed: number
}

const WARDEN: BossParams = {
  w: 224,
  h: 96,
  tentacles: 6,
  hide: LEGEND.m,
  plate: LEGEND.M,
  plateLight: LEGEND.N,
  accent1: LEGEND.r,
  accent2: LEGEND.R,
  eyeCore: LEGEND.e,
  eyeBright: LEGEND.E,
  eyeHalo: LEGEND.e,
  sucker: LEGEND.N,
  glowCracks: false,
  chains: true,
  seed: 101,
}

const KRACKEN: BossParams = {
  w: 240,
  h: 120,
  tentacles: 16,
  // its own burnt-orange body palette, not the general rust family other
  // wear/scarring uses elsewhere — keeps the Kracken reading orange, not
  // muddy brown, the way its accents and eyes always have
  hide: LEGEND.h,
  plate: LEGEND.H,
  plateLight: LEGEND.i,
  accent1: LEGEND.C,
  accent2: LEGEND.y,
  eyeCore: LEGEND.O,
  eyeBright: LEGEND.y,
  eyeHalo: LEGEND.C,
  sucker: LEGEND.i,
  glowCracks: true,
  chains: false,
  seed: 202,
}

/** Body crest line: a broad arc, high in the middle, drooping at the edges. */
function bossCrest(p: BossParams, x: number): number {
  const cx = p.w / 2
  const arc = ((x - cx) / cx) ** 2 // 0 center → 1 edges
  const wob = Math.floor(hash(x >> 3, 0, p.seed) * 5) // chunky ridge steps
  return Math.round(p.h * 0.3 + arc * p.h * 0.34 + wob)
}

function drawTentacle(
  f: Frame,
  p: BossParams,
  baseX: number,
  topY: number,
  len: number,
  phase: number,
  sway: number,
): void {
  for (let i = 0; i < len; i++) {
    const y = topY + len - 1 - i // grow upward from the mass
    const t = i / len
    const x = Math.round(baseX + Math.sin(i * 0.22 + phase + sway) * (3 + t * 5))
    const half = Math.max(1, Math.round(3.4 * (1 - t)))
    for (let dx = -half; dx <= half; dx++) {
      const edge = dx === -half || dx === half
      put(f, x + dx, y, edge ? LEGEND.o : (dx + y) % 3 === 0 ? p.plate : p.hide)
    }
    put(f, x, y - 1, i === len - 1 ? LEGEND.o : f.data[((y - 1) * f.w + x) * 4 + 3] ? p.hide : LEGEND.o)
    // suckers up the limb's face
    if (i % 5 === 2 && half > 1) put(f, x, y, p.sucker)
  }
}

function bossFrame(p: BossParams, jaw: number, sway: number, eyesBright: boolean): Frame {
  const f = blank(p.w, p.h)
  const cx = p.w / 2

  // tentacles first, trailing up from behind the mass
  for (let i = 0; i < p.tentacles; i++) {
    const spread = (i + 0.5) / p.tentacles
    const baseX = Math.round(8 + spread * (p.w - 16))
    // keep the center clear so limbs frame the mouth rather than cover it
    const off = Math.abs(spread - 0.5) < 0.18 ? (spread < 0.5 ? -26 : 26) : 0
    const topY = bossCrest(p, baseX + off) + 4
    const len = Math.round(topY * (0.55 + hash(i, 1, p.seed) * 0.4))
    drawTentacle(f, p, baseX + off, topY - len, len, i * 1.7, sway)
  }

  // the mass: chunky plated hide from the crest down
  for (let x = 0; x < p.w; x++) {
    const top = bossCrest(p, x)
    for (let y = top; y < p.h; y++) {
      const d = y - top
      let c: RGB
      if (d === 0) c = LEGEND.o
      else if (d === 1) c = p.plateLight // rim light along the whole crest
      else if (d < 10) c = hash(x, y, p.seed + 2) > 0.78 ? p.hide : p.plate
      else if (d < 16) c = (x + y) % 2 === 0 ? p.plate : p.hide // dither band
      else c = hash(x, y, p.seed + 3) > 0.85 ? p.plate : p.hide
      put(f, x, y, c)
    }
  }
  // plate seams with rivets, like a hull that was once a ship
  for (let sx = 14; sx < p.w - 8; sx += 22) {
    const top = bossCrest(p, sx) + 2
    for (let y = top; y < p.h - 2; y++) {
      if (hash(sx, y, p.seed + 4) > 0.92) continue // corroded gaps
      put(f, sx + ((y >> 3) % 2), y, LEGEND.o)
      if (y % 6 === 3) put(f, sx + ((y >> 3) % 2) + 1, y, p.plateLight)
    }
  }
  // scarring: rust streaks on the Warden, glowing magma seams on the Kracken
  for (let i = 0; i < p.w / 9; i++) {
    const sx = Math.round(hash(i, 7, p.seed) * (p.w - 16) + 8)
    const sy = bossCrest(p, sx) + 5 + Math.round(hash(i, 8, p.seed) * (p.h * 0.3))
    const len = p.glowCracks ? 6 + Math.round(hash(i, 9, p.seed) * 6) : 3 + Math.round(hash(i, 9, p.seed) * 5)
    for (let j = 0; j < len; j++) {
      const gx = sx + (p.glowCracks ? j : Math.round(Math.sin(j) * 1))
      const gy = sy + (p.glowCracks ? Math.round(Math.sin(j * 1.1 + i) * 2) : j)
      put(f, gx, gy, p.glowCracks ? (j % 3 === 2 ? p.accent1 : p.accent2) : j % 2 === 0 ? p.accent2 : p.accent1)
      if (p.glowCracks && j % 4 === 1) put(f, gx, gy + 1, p.accent1) // ember bleed
    }
  }

  // the mouth: a huge toothed gape in the middle of the mass
  const mouthRx = Math.round(p.w * 0.26)
  const mouthRy = Math.round(3 + jaw * (p.h * 0.17))
  const mouthCy = Math.round(p.h * 0.6)
  for (let y = -mouthRy; y <= mouthRy; y++) {
    const span = Math.floor(mouthRx * Math.sqrt(Math.max(0, 1 - (y / mouthRy) ** 2)))
    for (let x = -span; x <= span; x++) {
      const edge = Math.abs(x) >= span - 1 || Math.abs(y) >= mouthRy - 1
      put(
        f,
        cx + x,
        mouthCy + y,
        edge ? LEGEND.o : hash(x, y, p.seed + 5) > 0.94 ? LEGEND.M : LEGEND.m,
      )
    }
  }
  // gun-deck teeth: two staggered rows biting into the gape
  const toothH = Math.min(5, mouthRy - 1)
  if (toothH > 1) {
    for (let tx = -mouthRx + 6; tx <= mouthRx - 6; tx += 8) {
      const span = Math.floor(mouthRy * 0.9)
      for (let ty = 0; ty < toothH; ty++) {
        const half = Math.max(0, Math.round(2 * (1 - ty / toothH)))
        for (let dx = -half; dx <= half; dx++) {
          // upper row points down, lower row (offset) points up
          put(f, cx + tx + dx, mouthCy - span + ty, ty === 0 ? LEGEND.S : LEGEND.w)
          put(f, cx + tx + 4 + dx, mouthCy + span - ty, ty === 0 ? LEGEND.S : LEGEND.w)
        }
      }
    }
  }

  // searchlight eyes out near the edges — big enough to be the threat's face
  for (const ex of [Math.round(p.w * 0.15), Math.round(p.w * 0.85)]) {
    const ey = bossCrest(p, ex) + 12
    const r = 7
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dy)
        if (d > r) continue
        let c: RGB
        if (d > r - 1.2) c = LEGEND.o
        else if (d > r - 2.4) c = p.hide // dark socket ring seats the lamp
        else if (d < 2.2) c = eyesBright ? LEGEND.f : p.eyeBright
        else if (d < 4.2) c = p.eyeBright
        else c = p.eyeCore
        put(f, ex + dx, ey + dy, c)
      }
    }
    if (eyesBright) {
      // halo ticks — a lamp, not a sprite glow
      for (const [hx, hy] of [
        [-r - 2, 0],
        [r + 2, 0],
        [0, -r - 2],
        [0, r + 2],
      ] as const)
        put(f, ex + hx, ey + hy, p.eyeHalo)
    }
  }

  // salvage chains sagging across the Warden's hull
  if (p.chains) {
    for (const [x0, x1] of [
      [18, 74],
      [150, 206],
    ] as const) {
      for (let x = x0; x <= x1; x += 2) {
        const t = (x - x0) / (x1 - x0)
        const y = bossCrest(p, x) + 6 + Math.round(Math.sin(t * Math.PI) * 7)
        put(f, x, y, x % 4 === 0 ? LEGEND.S : LEGEND.N)
        put(f, x, y + 1, LEGEND.o)
        if (x % 8 === 0) put(f, x, y - 1, LEGEND.w) // glint
      }
    }
  }
  return f
}

export function buildBoss(variant: 'warden' | 'kracken'): Frame[] {
  const p = variant === 'warden' ? WARDEN : KRACKEN
  // jaw chews, tentacles sway, eyes pulse on the open beats
  const jaws = [0.35, 0.7, 1, 0.7]
  return jaws.map((jaw, i) => bossFrame(p, jaw, (i * Math.PI) / 2, i === 2))
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
// Power-up supply pods — stenciled crates on a float line
// ---------------------------------------------------------------------------

const POD_GLYPHS: Record<string, string[]> = {
  S: ['.###', '#...', '.##.', '...#', '###.'],
  L: ['#...', '#...', '#...', '#...', '####'],
  '+': ['..#..', '..#..', '#####', '..#..', '..#..'],
  '*': ['..#..', '#####', '.###.', '.#.#.', '#...#'],
}

function podMap(glyph: string, tint: RGB, blink: boolean): Frame {
  const f = blank(20, 20)
  // riveted crate shell
  for (let y = 2; y < 18; y++) {
    for (let x = 2; x < 18; x++) {
      const edge = y === 2 || y === 17 || x === 2 || x === 17
      let c: RGB = edge ? LEGEND.o : LEGEND.s
      if (!edge && (y === 3 || x === 3)) c = LEGEND.S
      if (!edge && (y === 16 || x === 16)) c = LEGEND.d
      put(f, x, y, c)
    }
  }
  for (const [rx, ry] of [
    [4, 4],
    [15, 4],
    [4, 15],
    [15, 15],
  ] as const)
    put(f, rx, ry, LEGEND.w)
  // stencil panel
  for (let y = 6; y < 14; y++)
    for (let x = 5; x < 15; x++) put(f, x, y, blink ? LEGEND.m : LEGEND.M)
  // glyph, centered on the panel
  const rows = POD_GLYPHS[glyph]
  const gw = rows[0].length
  const gx = Math.floor((20 - gw) / 2)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') put(f, gx + x, 7 + y, tint)
    }
  })
  // float-line lamp on top
  put(f, 9, 0, blink ? LEGEND.G : LEGEND.y)
  put(f, 10, 0, blink ? LEGEND.G : LEGEND.y)
  put(f, 9, 1, LEGEND.o)
  put(f, 10, 1, LEGEND.o)
  return f
}

export type PodKind = 'shotgun' | 'laser' | 'health' | 'extraLife'

export function buildPods(): Record<PodKind, Frame[]> {
  const spec: Record<PodKind, [string, RGB]> = {
    shotgun: ['S', LEGEND.O],
    laser: ['L', LEGEND.g],
    health: ['+', LEGEND.E],
    extraLife: ['*', LEGEND.y],
  }
  const out = {} as Record<PodKind, Frame[]>
  for (const kind of Object.keys(spec) as PodKind[]) {
    const [glyph, tint] = spec[kind]
    out[kind] = [podMap(glyph, tint, false), podMap(glyph, tint, true)]
  }
  return out
}

// ---------------------------------------------------------------------------
// Tentacle wall hazard — a horizontal limb reaching in from one side
// ---------------------------------------------------------------------------

/**
 * Built facing right (rooted at x=0, tapered tip at x=length-1); mirror
 * for the right wall. Thickness tapers along the reach, suckers dot the
 * underside, and the silhouette waves so it reads alive, not terrain.
 */
export function buildTentacleArm(length: number, thickness: number, seed: number): Frame {
  const f = blank(length, thickness)
  const cy = thickness / 2
  for (let x = 0; x < length; x++) {
    const t = x / length
    const half = Math.max(1.5, (thickness / 2 - 2) * (1 - t * 0.82))
    const wave = Math.sin(x * 0.09 + seed) * (thickness * 0.12) * t
    const yc = cy + wave
    for (let y = 0; y < thickness; y++) {
      const d = Math.abs(y - yc)
      if (d > half) continue
      let c: RGB
      if (d > half - 1.2) c = LEGEND.o
      else if (y < yc - half * 0.4) c = LEGEND.M // lit top edge
      else c = hash(x, y, seed) > 0.88 ? LEGEND.M : LEGEND.m
      put(f, x, y, c)
    }
    // suckers along the underside
    if (x % 7 === 3 && half > 3) put(f, x, Math.round(yc + half - 2), LEGEND.N)
  }
  return f
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
    redFish: { frames: buildRedFish(), fps: 6, loop: true },
    angler: { frames: buildAngler(), fps: 5, loop: true },
    squid: { frames: buildSquid(), fps: 4, loop: true },
    enemySub: { frames: enemySub.run, fps: 5, loop: true },
    enemySubFire: { frames: [enemySub.fire], fps: 1, loop: false },
    mine: { frames: buildMine(), fps: 3, loop: true },
    bossWarden: { frames: buildBoss('warden'), fps: 4, loop: true },
    bossKracken: { frames: buildBoss('kracken'), fps: 4, loop: true },
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
