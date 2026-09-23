/**
 * sheets.ts — DOM-free layouts for the two-tone concept boards: the
 * labeled sprite sheet, palette cards, and index → RGBA conversion. Used
 * by both the concepts page and the node-side PNG export script.
 */
import {
  ACC,
  ACC2,
  FG,
  buildChain,
  buildGem,
  buildPip,
  buildMiniSub,
  buildTentacleArm,
  drawText,
  iblank,
  iblit,
  imirrorX,
  iput,
  textWidth,
  withMoat,
  type IFrame,
  type TwoToneSprites,
} from './art'
import { paletteLut, type TwoTonePalette } from './palettes'

export function toRgba(f: IFrame, pal: TwoTonePalette, scale = 1): Uint8ClampedArray<ArrayBuffer> {
  const lut = paletteLut(pal)
  const W = f.w * scale
  const out = new Uint8ClampedArray(W * f.h * scale * 4)
  for (let y = 0; y < f.h * scale; y++) {
    const sy = (y / scale) | 0
    for (let x = 0; x < W; x++) {
      const c = f.px[sy * f.w + ((x / scale) | 0)]
      const o = (y * W + x) * 4
      // clear pixels render as bg: sheets are always composited on water
      const li = (c || 1) * 4
      out[o] = lut[li]
      out[o + 1] = lut[li + 1]
      out[o + 2] = lut[li + 2]
      out[o + 3] = 255
    }
  }
  return out
}

interface SheetItem {
  label: string
  frames: IFrame[]
}

/**
 * Every sprite and every animation frame, left to right in rows, with a
 * caption above each strip — the Downwell sprite-sheet look.
 */
export function buildSpriteSheet(sprites: TwoToneSprites, width = 512): IFrame {
  const items: SheetItem[] = []
  const add = (label: string, name: string) => items.push({ label, frames: sprites[name].frames })
  add('PLAYER SUB', 'playerIdle')
  add('BANK L', 'playerBankL')
  add('BANK R', 'playerBankR')
  add('TORPEDO', 'torpedo')
  add('ENEMY SUB', 'enemySub')
  add('FIRE', 'enemySubFire')
  add('TRACER', 'tracer')
  add('FROGMAN', 'frogman')
  add('RED FISH', 'redFish')
  add('ANGLER', 'angler')
  add('SQUID', 'squid')
  add('MINE', 'mine')
  add('SHRAPNEL', 'shrapnel')
  const moored = sprites.mine.frames.map((m, i) => {
    const f = iblank(46, 24)
    iblit(f, buildChain(28, 3), 0, 8)
    iblit(f, m, 26, 1 + i * 2)
    return f
  })
  items.push({ label: 'MOORED MINE', frames: moored })
  add('SHOTGUN', 'pod_shotgun')
  add('LASER', 'pod_laser')
  add('HEALTH', 'pod_health')
  add('EXTRA LIFE', 'pod_extraLife')
  add('BUBBLES', 'bubbles')
  items.push({ label: 'HUD', frames: [buildPip(true), buildPip(false), buildGem()] })
  add('BLAST S', 'explosionS')
  add('BLAST M', 'explosionM')
  add('BLAST L', 'explosionL')
  items.push({
    label: 'TENTACLE WALL',
    frames: [buildTentacleArm(120, 44, 3), imirrorX(buildTentacleArm(96, 40, 8))],
  })
  items.push({ label: 'THE WARDEN', frames: sprites.bossWarden.frames.slice(0, 2) })
  items.push({ label: 'THE KRACKEN', frames: sprites.bossKracken.frames.slice(1, 3) })

  // flow layout
  const pad = 6
  const gap = 3
  const placed: { x: number; y: number; item: SheetItem }[] = []
  let x = pad
  let y = pad + 12
  let rowH = 0
  for (const item of items) {
    const w = Math.max(
      textWidth(item.label) + 2,
      item.frames.reduce((s, f) => s + f.w + gap, -gap),
    )
    const h = 8 + Math.max(...item.frames.map((f) => f.h))
    if (x + w > width - pad) {
      x = pad
      y += rowH + 8
      rowH = 0
    }
    placed.push({ x, y, item })
    x += w + 10
    rowH = Math.max(rowH, h)
  }
  const sheet = iblank(width, y + rowH + pad)
  drawText(sheet, 'DIVE DEPTHS - TWO-TONE SPRITE SET', pad, pad, FG, { bold: true })
  for (const { x: px, y: py, item } of placed) {
    drawText(sheet, item.label, px, py, ACC2)
    let fx = px
    for (const f of item.frames) {
      iblit(sheet, f, fx, py + 8)
      fx += f.w + gap
    }
  }
  return sheet
}

/**
 * A palette card in the style of Downwell's palette select: index + name,
 * a little vignette (sub, pickup, blast), then the fg/accent/accent2
 * swatches — drawn in the card's own palette, so it's rendered per-palette.
 */
export function buildPaletteCard(index: number, name: string): IFrame {
  const f = iblank(180, 44)
  for (let x = 0; x < f.w; x++) {
    iput(f, x, 0, FG)
    iput(f, x, f.h - 1, FG)
  }
  for (let y = 0; y < f.h; y++) {
    iput(f, 0, y, FG)
    iput(f, f.w - 1, y, FG)
  }
  drawText(f, `${index}.${name}`, 4, 4, FG, { bold: true })
  iblit(f, buildMiniSub(), 6, 13)
  iblit(f, buildGem(), 24, 16)
  const heart = withMoat(
    (() => {
      const h = iblank(7, 6)
      const rows = ['.r.r.', 'rwrrr', 'rrrrr', '.rrr.', '..r..']
      rows.forEach((r, yy) => [...r].forEach((ch, xx) => ch === 'r' ? iput(h, xx + 1, yy, ACC) : ch === 'w' ? iput(h, xx + 1, yy, FG) : 0))
      return h
    })(),
  )
  iblit(f, heart, 24, 26)
  // a strip of bubbles
  for (const [bx, by] of [[38, 18], [41, 24], [37, 30], [40, 36]] as const) iput(f, bx, by, ACC2)
  // swatches
  const sw: [number, number][] = [
    [FG, 58],
    [ACC, 98],
    [ACC2, 138],
  ]
  for (const [c, sx] of sw) {
    for (let yy = 14; yy < 40; yy++) for (let xx = sx; xx < sx + 32; xx++) iput(f, xx, yy, c as 2 | 3 | 4)
  }
  return f
}
