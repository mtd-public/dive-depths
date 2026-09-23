/**
 * palettes.ts — swappable four-color palettes for the two-tone art set.
 *
 * Every two-tone sprite and every pixel of the board is authored against
 * four *roles*, never against colors, so a palette swap recolors the whole
 * game at once (the Downwell trick):
 *
 *   bg      — the water, and the "ink" every sprite is engraved with
 *   fg      — line art, hull plating, rock, marine snow, text
 *   accent  — danger: enemies, hazards, the player's hull pips
 *   accent2 — water & tech: bubbles, glass, the laser, pickups
 *
 * Some palettes deliberately collapse roles (Blackout draws accent and
 * accent2 in fg; Signal uses bg for accent2) — the sprites are drawn so
 * silhouettes still read when that happens.
 */

export interface TwoTonePalette {
  id: string
  name: string
  bg: string
  fg: string
  accent: string
  accent2: string
}

export const TWO_TONE_PALETTES: TwoTonePalette[] = [
  { id: 'abyss', name: 'ABYSS', bg: '#000000', fg: '#ffffff', accent: '#ff1f2d', accent2: '#1f7bff' },
  { id: 'kelp', name: 'KELP', bg: '#050b06', fg: '#f4f8ea', accent: '#71b53a', accent2: '#2a8ad9' },
  { id: 'sonar', name: 'SONAR', bg: '#00121a', fg: '#e8fbff', accent: '#1fe0c4', accent2: '#1f6bff' },
  { id: 'dmg', name: 'DMG-01', bg: '#1f2a17', fg: '#b6c48a', accent: '#8a9b5e', accent2: '#5a6b3e' },
  { id: 'vbeam', name: 'V-BEAM', bg: '#000000', fg: '#ff2020', accent: '#9a0808', accent2: '#ff6e6e' },
  { id: 'shallows', name: 'SHALLOWS', bg: '#1d44a8', fg: '#ffffff', accent: '#ff7a6a', accent2: '#58b8ff' },
  { id: 'chart', name: 'SEA CHART', bg: '#a9bb72', fg: '#fbf2d8', accent: '#e8416d', accent2: '#c6e36b' },
  { id: 'reactor', name: 'REACTOR', bg: '#0b2a0b', fg: '#d8f6c6', accent: '#9de35e', accent2: '#000000' },
  { id: 'barnacle', name: 'BARNACLE', bg: '#521631', fg: '#ffffff', accent: '#58a84a', accent2: '#ffb37c' },
  { id: 'silt', name: 'SILT', bg: '#000000', fg: '#ffffff', accent: '#7a7a7a', accent2: '#bdbdbd' },
  { id: 'blackout', name: 'BLACKOUT', bg: '#000000', fg: '#ffffff', accent: '#ffffff', accent2: '#ffffff' },
  { id: 'hadal', name: 'HADAL', bg: '#520c24', fg: '#ebdcad', accent: '#ee4058', accent2: '#1f8cff' },
  { id: 'negative', name: 'NEGATIVE', bg: '#f2f0ea', fg: '#0a0a0a', accent: '#0a0a0a', accent2: '#8a8a8a' },
  { id: 'anemone', name: 'ANEMONE', bg: '#3a1a2c', fg: '#5ac8f5', accent: '#9a70c8', accent2: '#c2ae9c' },
  { id: 'biolume', name: 'BIOLUME', bg: '#06182e', fg: '#fff6f6', accent: '#d8001e', accent2: '#4a66d8' },
  { id: 'iceberg', name: 'ICEBERG', bg: '#05243a', fg: '#ffe0a8', accent: '#a8dcff', accent2: '#1f8eff' },
  { id: 'wreck', name: 'WRECK', bg: '#3c2610', fg: '#82eb9e', accent: '#4a88ff', accent2: '#40b8ff' },
  { id: 'flare', name: 'FLARE', bg: '#000000', fg: '#ff1c1c', accent: '#ffffff', accent2: '#ffa4a4' },
  { id: 'lagoon', name: 'LAGOON', bg: '#5d5b70', fg: '#cfe6b8', accent: '#9296ec', accent2: '#56b2ea' },
  { id: 'trench', name: 'TRENCH', bg: '#02052c', fg: '#8a8446', accent: '#3a6a3a', accent2: '#1f8aff' },
  { id: 'polar', name: 'POLAR', bg: '#3d6f8d', fg: '#dcfcff', accent: '#62fcff', accent2: '#000000' },
  { id: 'brass', name: 'BRASS', bg: '#3a2412', fg: '#cf6e3e', accent: '#ea9552', accent2: '#dc8c2a' },
  { id: 'squall', name: 'SQUALL', bg: '#9c9c9c', fg: '#3f3f3f', accent: '#c83a3a', accent2: '#5a80a6' },
  { id: 'reef', name: 'REEF', bg: '#0b3a2a', fg: '#ffcaa2', accent: '#b03e58', accent2: '#5a9c3c' },
  { id: 'dusk', name: 'DUSK', bg: '#1c2a4c', fg: '#dcefdc', accent: '#e2527e', accent2: '#7c88cc' },
  { id: 'neon', name: 'NEON', bg: '#ffffff', fg: '#e01ad0', accent: '#2cc44a', accent2: '#0e0e0e' },
]

export type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/**
 * RGBA lookup for an index buffer: slot 0 is transparent, then bg, fg,
 * accent, accent2 — the same order as the ink constants in art.ts.
 */
export function paletteLut(p: TwoTonePalette): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(5 * 4)
  ;[p.bg, p.bg, p.fg, p.accent, p.accent2].forEach((hex, i) => {
    const [r, g, b] = hexToRgb(hex)
    lut[i * 4] = r
    lut[i * 4 + 1] = g
    lut[i * 4 + 2] = b
    lut[i * 4 + 3] = i === 0 ? 0 : 255
  })
  return lut
}

export function paletteById(id: string): TwoTonePalette {
  return TWO_TONE_PALETTES.find((p) => p.id === id) ?? TWO_TONE_PALETTES[0]
}
