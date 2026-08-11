import { jamRoutes } from '../navigation'
import { BackControl } from './BackControl'

export function JamOverviewLink({ jamId, jamName }: { jamId: string; jamName: string }) {
  return <BackControl to={jamRoutes(jamId).overview} label={`Torna a ${jamName}`} />
}
