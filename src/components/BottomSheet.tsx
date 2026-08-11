import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/LanguageContext'

type BottomSheetProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function BottomSheet({ open, title, onClose, children, footer }: BottomSheetProps) {
  const reduceMotion = useReducedMotion()
  const titleId = useId()
  const { t } = useI18n()

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  return createPortal(
    <AnimatePresence>
      {open && <>
        <motion.div
          className="sheet-backdrop"
          aria-hidden="true"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16 }}
        />
        <motion.section
          className="bottom-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: '105%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: '105%' }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38, mass: 0.82 }}
        >
          <span className="sheet-handle" aria-hidden="true" />
          <header><h2 id={titleId}>{title}</h2><button type="button" aria-label={t('common.close')} onClick={onClose}><X size={19} /></button></header>
          <div className="sheet-content">{children}</div>
          {footer && <footer>{footer}</footer>}
        </motion.section>
      </>}
    </AnimatePresence>,
    document.body,
  )
}
