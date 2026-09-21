import { AnimatePresence, motion } from 'framer-motion'
import type { GamePhase } from '../game/types'

interface GameOverlayProps {
  phase: GamePhase
  score: number
  best: number
  onStart: () => void
  onResume: () => void
  onNewGame: () => void
}

export function GameOverlay({ phase, score, best, onStart, onResume, onNewGame }: GameOverlayProps) {
  const visible = phase === 'ready' || phase === 'paused' || phase === 'over' || phase === 'won'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {phase === 'ready' ? (
            <motion.div
              className="title-screen"
              initial={{ y: 16, scale: 0.94, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 16, scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <h1 className="title-screen__logo">Dive Depths</h1>
              <button type="button" className="btn btn--primary" onClick={onStart}>
                Start diving
              </button>
            </motion.div>
          ) : (
            <motion.div
              className="overlay__card"
              initial={{ y: 16, scale: 0.94, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 16, scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              {phase === 'paused' && (
                <>
                  <h2>Paused</h2>
                  <button type="button" className="btn btn--primary" onClick={onResume}>
                    Resume
                  </button>
                </>
              )}
              {phase === 'over' && (
                <>
                  <h2>Hull breached</h2>
                  <p>
                    Score: {score.toLocaleString()}
                    {score >= best && score > 0 ? ' — new best!' : ` · Best: ${best.toLocaleString()}`}
                  </p>
                  <button type="button" className="btn btn--primary" onClick={onNewGame}>
                    Dive again
                  </button>
                </>
              )}
              {phase === 'won' && (
                <>
                  <h2>The Kracken falls!</h2>
                  <p>
                    Score: {score.toLocaleString()}
                    {score >= best && score > 0 ? ' — new best!' : ` · Best: ${best.toLocaleString()}`}
                  </p>
                  <button type="button" className="btn btn--primary" onClick={onNewGame}>
                    Dive again
                  </button>
                </>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
