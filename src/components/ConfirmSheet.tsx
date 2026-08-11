import type { ReactNode } from 'react'
import { BottomSheet } from './BottomSheet'
import { useI18n } from '../i18n/LanguageContext'

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
  const { t } = useI18n()
  return (
    <BottomSheet
      open={open}
      title={title}
      onClose={pending ? () => undefined : onClose}
      footer={<div className="sheet-actions"><button type="button" className="sheet-cancel-action" disabled={pending} onClick={onClose}>{t('common.cancel')}</button><button type="button" className={danger ? 'sheet-confirm-action danger' : 'sheet-confirm-action'} disabled={pending} onClick={onConfirm}>{pending ? t('common.wait') : confirmLabel}</button></div>}
    >
      {description && <div className="sheet-description">{description}</div>}
    </BottomSheet>
  )
}
