import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={19} aria-hidden="true" /></span>
      <span><h3>{title}</h3>{body && <p>{body}</p>}</span>
    </div>
  )
}
