import { Icon, iconFromEmoji } from './Icon'

export function EmptyState({ icon = 'inbox', title, description }: { icon?: string; title: string; description?: string }) {
  return <div className="empty-state">
    <span className="empty-icon"><Icon name={iconFromEmoji(icon)} size={22} /></span>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
  </div>
}
