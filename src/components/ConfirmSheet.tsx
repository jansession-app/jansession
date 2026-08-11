import type { ReactNode } from 'react'
import { BottomSheet } from './BottomSheet'

type ConfirmSheetProps = {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel: string
  pending?: boolean
  danger?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmSheet({ open, title, description, confirmLabel, pending = false, danger = false, onClose, onConfirm }: ConfirmSheetProps) {
  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={pending ? () => undefined : onClose}
      footer={<div className="sheet-actions"><button type="button" className="sheet-cancel-action" disabled={pending} onClick={onClose}>Annulla</button><button type="button" className={danger ? 'sheet-confirm-action danger' : 'sheet-confirm-action'} disabled={pending} onClick={onConfirm}>{pending ? 'Attendi…' : confirmLabel}</button></div>}
    >
      {description && <div className="sheet-description">{description}</div>}
    </BottomSheet>
  )
}
