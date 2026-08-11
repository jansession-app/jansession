import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { jamRoutes } from '../navigation'

export function JamOverviewLink({ jamId, jamName }: { jamId: string; jamName: string }) {
  return <Link className="back-link jam-overview-link" to={jamRoutes(jamId).overview}><ArrowLeft size={18} aria-hidden="true" /> {jamName}</Link>
}
