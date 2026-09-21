import { AnimatePresence, motion } from 'framer-motion'
import { TrophyIcon } from './Achievements'
import type { AchievementToast } from '../game/useGameEngine'

interface AchievementToastsProps {
  toasts: AchievementToast[]
  onDismiss: (key: number) => void
}

export function AchievementToasts({ toasts, onDismiss }: AchievementToastsProps) {
  return (
    <div className="achievement-toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map(({ key, achievement }) => (
          <motion.div
            key={key}
            className="achievement-toast"
            role="status"
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={() => onDismiss(key)}
          >
            <span className="achievement-toast__icon" aria-hidden="true">
              <TrophyIcon />
            </span>
            <span className="achievement-toast__text">
              <span className="achievement-toast__label">Achievement unlocked</span>
              <span className="achievement-toast__name">{achievement.title}</span>
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
