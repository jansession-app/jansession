import { BottomSheet } from './BottomSheet'
import type { GeocodeCandidate } from '../discover/types'

type PlaceCandidateSheetProps = {
  open: boolean
  title: string
  candidates: GeocodeCandidate[]
  onClose: () => void
  onSelect: (candidate: GeocodeCandidate) => void
}

export function PlaceCandidateSheet({ open, title, candidates, onClose, onSelect }: PlaceCandidateSheetProps) {
  return <BottomSheet open={open} title={title} onClose={onClose}>
    <div className="place-candidate-list">
      {candidates.map((candidate) => <button key={candidate.candidateId} type="button" onClick={() => onSelect(candidate)}>{candidate.displayName}</button>)}
    </div>
  </BottomSheet>
}
