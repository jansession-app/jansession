import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={26} aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}
