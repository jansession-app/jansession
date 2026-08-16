import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { INSTRUMENTS } from '../domain/types'
import { displayInstrument } from '../domain/songStatus'
import { useI18n } from '../i18n/LanguageContext'

export function WantedInstrumentsField({ value, onChange, disabled = false }: {
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}) {
  const [customInstrument, setCustomInstrument] = useState('')
  const { t } = useI18n()
  const toggle = (instrument: string) => {
    onChange(value.includes(instrument) ? value.filter((item) => item !== instrument) : [...value, instrument])
  }
  const addCustom = () => {
    const instrument = customInstrument.trim()
    if (!instrument || value.includes(instrument)) return
    onChange([...value, instrument])
    setCustomInstrument('')
  }
  const custom = value.filter((instrument) => !INSTRUMENTS.includes(instrument as (typeof INSTRUMENTS)[number]))

  return (
    <fieldset className="wanted-instruments-field" disabled={disabled}>
      <legend>{t('discover.wanted')}</legend>
      <div className="instrument-picker">
        {INSTRUMENTS.map((instrument) => <button key={instrument} type="button" className={value.includes(instrument) ? 'active' : ''} onClick={() => toggle(instrument)}>{displayInstrument(instrument, t)}</button>)}
      </div>
      {custom.length > 0 && <div className="wanted-custom-list">{custom.map((instrument) => <button key={instrument} type="button" onClick={() => toggle(instrument)}>{instrument}<X size={14} aria-hidden="true" /></button>)}</div>}
      {!disabled && <div className="wanted-custom-input"><input maxLength={50} value={customInstrument} onChange={(event) => setCustomInstrument(event.target.value)} placeholder={t('discover.addInstrumentPlaceholder')} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustom() } }} /><button className="secondary-button" type="button" disabled={!customInstrument.trim()} onClick={addCustom}><Plus size={16} aria-hidden="true" /> {t('discover.add')}</button></div>}
    </fieldset>
  )
}
