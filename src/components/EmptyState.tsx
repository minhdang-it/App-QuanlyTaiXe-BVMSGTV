export function EmptyState({ icon = '📭', title, description }: { icon?: string; title: string; description?: string }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3>{description && <p>{description}</p>}</div>
}
