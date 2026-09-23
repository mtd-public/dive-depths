import { useCallback, useEffect, useState } from 'react'
import { TWO_TONE_PALETTES, paletteById } from '../game/twoTone/palettes'

export type ArtStyle = 'classic' | 'twotone'

export interface ArtSettings {
  art: ArtStyle
  /** Two-tone palette id (see twoTone/palettes.ts). */
  palette: string
  /** Two-tone only: step to the next palette every depth zone. */
  zoneCycle: boolean
}

const STORAGE_KEY = 'dive-depths.art'
const DEFAULTS: ArtSettings = { art: 'classic', palette: 'abyss', zoneCycle: false }

/** Saved settings, with ?art=twotone&palette=<id>&zones=1 overriding them
 *  so a shared link opens straight into a given look. */
function load(): ArtSettings {
  let saved: Partial<ArtSettings> = {}
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    /* no storage — defaults */
  }
  const params = new URLSearchParams(window.location.search)
  const art = params.get('art') ?? saved.art
  return {
    art: art === 'twotone' ? 'twotone' : 'classic',
    palette: paletteById(params.get('palette') ?? saved.palette ?? DEFAULTS.palette).id,
    zoneCycle: params.has('zones') ? params.get('zones') === '1' : (saved.zoneCycle ?? DEFAULTS.zoneCycle),
  }
}

export function useArtSettings() {
  const [settings, setSettings] = useState<ArtSettings>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      /* storage is a convenience only */
    }
  }, [settings])

  const update = useCallback((patch: Partial<ArtSettings>) => setSettings((s) => ({ ...s, ...patch })), [])

  const cyclePalette = useCallback((dir: 1 | -1) => {
    setSettings((s) => {
      const i = TWO_TONE_PALETTES.findIndex((p) => p.id === s.palette)
      const next = TWO_TONE_PALETTES[(i + dir + TWO_TONE_PALETTES.length) % TWO_TONE_PALETTES.length]
      return { ...s, palette: next.id, zoneCycle: false }
    })
  }, [])

  // C / Shift+C cycles two-tone palettes (P is already pause)
  useEffect(() => {
    if (settings.art !== 'twotone') return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'c' || e.key === 'C') cyclePalette(e.shiftKey ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings.art, cyclePalette])

  return { settings, update, cyclePalette }
}
