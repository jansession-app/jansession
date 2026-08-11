import { jamRoutes } from '../navigation'
import { BackControl } from './BackControl'
import { useI18n } from '../i18n/LanguageContext'

export function JamOverviewLink({ jamId, jamName }: { jamId: string; jamName: string }) {
  const { t } = useI18n()
  return <BackControl to={jamRoutes(jamId).overview} label={t('navigation.backToJam', { jamName })} />
}
