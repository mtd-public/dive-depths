import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { TWO_TONE_PALETTES } from '../game/twoTone/palettes'
import type { ArtSettings, ArtStyle } from '../hooks/useArtSettings'

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['←', '→'], label: 'Steer (or A / D)' },
  { keys: ['Swipe board'], label: 'Steer left/right' },
  { keys: ['Space', '↑'], label: 'Fire missile' },
  { keys: ['Tap board'], label: 'Fire missile' },
  { keys: ['P'], label: 'Pause / resume' },
  { keys: ['C'], label: 'Next palette (two-tone)' },
]

const ART_STYLES: Array<{ id: ArtStyle; label: string }> = [
  { id: 'classic', label: 'Classic' },
  { id: 'twotone', label: 'Two-tone' },
]

interface OptionsMenuProps {
  art: ArtSettings
  onChange: (patch: Partial<ArtSettings>) => void
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7 7 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.5.42l-.36 2.54a7 7 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.48a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.7 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.8a.5.5 0 0 0 .5-.42l.36-2.54a7 7 0 0 0 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  )
}

export function OptionsMenu({ art, onChange }: OptionsMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const twoTone = art.art === 'twotone'

  return (
    <div className="options" ref={rootRef}>
      <button
        type="button"
        className="options__trigger"
        aria-label="Options"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <GearIcon />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="options__panel"
            role="dialog"
            aria-label="Options"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <section className="options__section">
              <span className="options__title" id="options-art">
                Art style
              </span>
              <div className="options__segmented" role="radiogroup" aria-labelledby="options-art">
                {ART_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    role="radio"
                    aria-checked={art.art === style.id}
                    className="options__segment"
                    onClick={() => onChange({ art: style.id })}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </section>

            {twoTone && (
              <section className="options__section">
                <span className="options__title" id="options-palette">
                  Palette
                </span>
                <div className="options__palettes" role="radiogroup" aria-labelledby="options-palette">
                  {TWO_TONE_PALETTES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={art.palette === p.id}
                      className="options__palette"
                      title={p.name}
                      aria-label={p.name}
                      style={{ background: p.bg }}
                      onClick={() => onChange({ palette: p.id, zoneCycle: false })}
                    >
                      <span style={{ background: p.fg }} />
                      <span style={{ background: p.accent }} />
                      <span style={{ background: p.accent2 }} />
                    </button>
                  ))}
                </div>
                <span className="options__current">
                  {TWO_TONE_PALETTES.find((p) => p.id === art.palette)?.name}
                </span>
                <label className="options__check">
                  <input
                    id="options-zone-cycle"
                    type="checkbox"
                    checked={art.zoneCycle}
                    onChange={(e) => onChange({ zoneCycle: e.target.checked })}
                  />
                  Change palette every 5,000 leagues
                </label>
              </section>
            )}

            <section className="options__section">
              <span className="options__title">Controls</span>
              <ul className="options__list">
                {SHORTCUTS.map((shortcut) => (
                  <li key={shortcut.label} className="options__row">
                    <span className="options__keys">
                      {shortcut.keys.map((key) => (
                        <kbd key={key} className="options__key">
                          {key}
                        </kbd>
                      ))}
                    </span>
                    <span className="options__label">{shortcut.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
