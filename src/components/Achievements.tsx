import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ACHIEVEMENTS, type AchievementId } from '../game/achievements'

interface AchievementsProps {
  unlocked: Set<AchievementId>
}

/** A plain trophy glyph, not an emoji — keeps the topbar's icon language
 *  (the `?` help trigger is a character too) consistent across platforms.
 *  Exported so the unlock toast can reuse the exact same mark. */
export function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 3h12v2h2.5a1 1 0 0 1 1 1v1c0 2.5-1.8 4.6-4.2 5v.1c-.4 2.3-2.2 4.1-4.3 4.6V19h3v2H8v-2h3v-2.3c-2.1-.5-3.9-2.3-4.3-4.6V12C4.3 11.6 2.5 9.5 2.5 7V6a1 1 0 0 1 1-1H6V3Zm0 4H4.5v0c0 1.5.9 2.8 2.3 3.3A8.6 8.6 0 0 1 6 8V7Zm12 0v1c0 .5-.05.9-.1 1.3 1.4-.5 2.3-1.8 2.3-3.3V7H18Z"
      />
    </svg>
  )
}

export function Achievements({ unlocked }: AchievementsProps) {
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

  return (
    <div className="achievements" ref={rootRef}>
      <button
        type="button"
        className="achievements__trigger"
        aria-label="Achievements"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <TrophyIcon />
        <span className="achievements__count">
          {unlocked.size}/{ACHIEVEMENTS.length}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="achievements__panel"
            role="dialog"
            aria-label="Achievements"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <span className="achievements__title">Achievements</span>
            <ul className="achievements__list">
              {ACHIEVEMENTS.map((achievement) => {
                const done = unlocked.has(achievement.id)
                return (
                  <li key={achievement.id} className={`achievements__item${done ? ' achievements__item--done' : ''}`}>
                    <span className="achievements__badge" aria-hidden="true">
                      {done ? <TrophyIcon /> : null}
                    </span>
                    <span className="achievements__text">
                      <span className="achievements__name">{achievement.title}</span>
                      <span className="achievements__desc">{achievement.description}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
