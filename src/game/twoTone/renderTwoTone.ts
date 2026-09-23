/**
 * renderTwoTone.ts — browser front end for the two-tone scene. Same
 * interface as Render2D (constructor, resize, update, dispose), so
 * GameCanvas can swap renderers behind a flag without touching physics.
 *
 * The scene draws palette indices; this just maps them through the active
 * palette into one ImageData per frame. Swapping palettes is a LUT swap.
 */
import type { World } from '../physics'
import type { GamePhase } from '../types'
import { TWO_TONE_PALETTES, paletteById, paletteLut, type TwoTonePalette } from './palettes'
import { RH, RW, TwoToneScene, type SceneOptions } from './scene'

export interface RenderTwoToneOptions extends SceneOptions {
  palette?: string
  /** Step through the palette list every zone (5000 leagues) as you dive. */
  zoneCycle?: boolean
}

export class RenderTwoTone {
  readonly scene: TwoToneScene
  private ctx: CanvasRenderingContext2D
  private image: ImageData
  private lut: Uint8ClampedArray
  palette: TwoTonePalette
  zoneCycle: boolean

  constructor(canvas: HTMLCanvasElement, opts: RenderTwoToneOptions = {}) {
    canvas.width = RW
    canvas.height = RH
    this.ctx = canvas.getContext('2d')!
    this.image = this.ctx.createImageData(RW, RH)
    this.scene = new TwoToneScene(opts)
    this.palette = paletteById(opts.palette ?? 'abyss')
    this.lut = paletteLut(this.palette)
    this.zoneCycle = opts.zoneCycle ?? false
  }

  setPalette(id: string): void {
    this.palette = paletteById(id)
    this.lut = paletteLut(this.palette)
  }

  /** Advance to the next palette in the list; returns its id. */
  cyclePalette(dir = 1): string {
    const i = TWO_TONE_PALETTES.indexOf(this.palette)
    const next = TWO_TONE_PALETTES[(i + dir + TWO_TONE_PALETTES.length) % TWO_TONE_PALETTES.length]
    this.setPalette(next.id)
    return next.id
  }

  resize(_w: number, _h: number): void {}

  dispose(): void {}

  update(world: World, phase: GamePhase, dt: number, t: number): void {
    if (this.zoneCycle) {
      const zone = TwoToneScene.zoneOf(world) % TWO_TONE_PALETTES.length
      if (TWO_TONE_PALETTES[zone] !== this.palette) this.setPalette(TWO_TONE_PALETTES[zone].id)
    }
    this.scene.update(world, phase, dt, t)
    this.present()
  }

  /** Push the scene's index buffer to the canvas through the palette. */
  present(): void {
    const src = this.scene.frame.px
    const dst = this.image.data
    const lut = this.lut
    for (let i = 0, o = 0; i < src.length; i++, o += 4) {
      const l = (src[i] || 1) * 4
      dst[o] = lut[l]
      dst[o + 1] = lut[l + 1]
      dst[o + 2] = lut[l + 2]
      dst[o + 3] = 255
    }
    this.ctx.putImageData(this.image, 0, 0)
  }
}
