/**
 * Renders the two-tone concept boards to PNGs in docs/two-tone/.
 *
 *   npm run concepts:two-tone
 *
 * Everything draws through the same DOM-free code the in-browser concepts
 * page and the two-tone renderer use, so these images are exactly the
 * pixels the game would show.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildTwoToneSprites } from '../src/game/twoTone/art'
import { TWO_TONE_PALETTES, hexToRgb, paletteById, type TwoTonePalette } from '../src/game/twoTone/palettes'
import { TwoToneScene } from '../src/game/twoTone/scene'
import { buildPaletteCard, buildSpriteSheet, toRgba } from '../src/game/twoTone/sheets'
import { SHOTS, renderShot } from '../src/game/twoTone/shots'
import type { IFrame } from '../src/game/twoTone/art'
import { encodePng } from './png'

const out = process.argv[2] ?? 'docs/two-tone'
mkdirSync(out, { recursive: true })

/** A plain RGBA canvas for compositing differently-paletted tiles. */
class Rgba {
  data: Uint8ClampedArray
  constructor(
    public w: number,
    public h: number,
    fill = '#101014',
  ) {
    this.data = new Uint8ClampedArray(w * h * 4)
    const [r, g, b] = hexToRgb(fill)
    for (let i = 0; i < w * h; i++) this.data.set([r, g, b, 255], i * 4)
  }
  put(f: IFrame, pal: TwoTonePalette, ox: number, oy: number, scale = 1) {
    const src = toRgba(f, pal, scale)
    const sw = f.w * scale
    const sh = f.h * scale
    for (let y = 0; y < sh; y++) {
      const dy = oy + y
      if (dy < 0 || dy >= this.h) continue
      for (let x = 0; x < sw; x++) {
        const dx = ox + x
        if (dx < 0 || dx >= this.w) continue
        this.data.set(src.subarray((y * sw + x) * 4, (y * sw + x) * 4 + 4), (dy * this.w + dx) * 4)
      }
    }
  }
  save(name: string) {
    writeFileSync(`${out}/${name}.png`, encodePng(this.w, this.h, this.data))
  }
}

const abyss = paletteById('abyss')
const sprites = buildTwoToneSprites()

// 1. the full sprite sheet, default palette, 2×
const sheet = buildSpriteSheet(sprites)
const sheetImg = new Rgba(sheet.w * 2, sheet.h * 2)
sheetImg.put(sheet, abyss, 0, 0, 2)
sheetImg.save('sprite-sheet')

// 2. each staged shot at 2×, and a contact strip of all six
const scene = new TwoToneScene({ hud: true })
const strip = new Rgba(6 * 256 + 7 * 8, 512 + 16)
SHOTS.forEach((s, i) => {
  const f = renderShot(scene, s.id)
  const img = new Rgba(512, 1024)
  img.put(f, abyss, 0, 0, 2)
  img.save(`shot-${s.id}`)
  strip.put(f, abyss, 8 + i * 264, 8)
})
strip.save('shots-strip')

// 3. the palette select: one card per palette, two columns (Downwell's layout)
const cards = new Rgba(2 * 180 + 3 * 6, 13 * 44 + 14 * 6)
TWO_TONE_PALETTES.forEach((p, i) => {
  cards.put(buildPaletteCard(i, p.name), p, 6 + (i % 2) * 186, 6 + Math.floor(i / 2) * 50)
})
const cardsBig = new Rgba(cards.w * 2, cards.h * 2)
for (let y = 0; y < cardsBig.h; y++)
  for (let x = 0; x < cardsBig.w; x++)
    cardsBig.data.set(cards.data.subarray(((y >> 1) * cards.w + (x >> 1)) * 4, ((y >> 1) * cards.w + (x >> 1)) * 4 + 4), (y * cardsBig.w + x) * 4)
cardsBig.save('palettes')

// 4. the same gameplay frame in every palette (the gameboard swap)
const descent = renderShot(scene, 'descent')
const crop = { y: 0, h: 400 }
const cols = 7
const tileW = 256
const grid = new Rgba(cols * (tileW + 6) + 6, Math.ceil(TWO_TONE_PALETTES.length / cols) * (crop.h + 6) + 6)
TWO_TONE_PALETTES.forEach((p, i) => {
  const f: IFrame = { w: 256, h: crop.h, px: descent.px.slice(crop.y * 256, (crop.y + crop.h) * 256) }
  grid.put(f, p, 6 + (i % cols) * (tileW + 6), 6 + Math.floor(i / cols) * (crop.h + 6))
})
grid.save('board-all-palettes')

// 5. the sprite sheet in a handful of palettes
for (const id of ['kelp', 'dmg', 'negative', 'hadal', 'biolume', 'neon']) {
  const img = new Rgba(sheet.w * 2, sheet.h * 2)
  img.put(sheet, paletteById(id), 0, 0, 2)
  img.save(`sprite-sheet-${id}`)
}
console.log(`wrote ${out}`)
