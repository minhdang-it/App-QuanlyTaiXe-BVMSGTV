import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { INCIDENT_LABELS } from '../lib/constants'
import { formatDateTime } from '../lib/utils'
import { StatusBadge } from '../components/StatusBadge'
import { consumeNavigationFocus } from '../lib/focusNavigation'

export function IncidentsPage() {
  const { user } = useAuth()
  const { data, updateIncident } = useData()
  const [filter, setFilter] = useState<'open' | 'pending_director' | 'handling' | 'resolved' | 'all'>('open')
  const [message, setMessage] = useState<string | null>(null)
  const [focusedIncidentId, setFocusedIncidentId] = useState<string | null>(null)
  const role = user!.profile.role
  const canDirectorReview = role === 'director' || role === 'admin'
  const canFleetHandle = role === 'fleet' || role === 'admin'

  useEffect(() => {
    const focusId = consumeNavigationFocus('incidents')
    if (!focusId || !data.incidents.some((item) => item.id === focusId)) return
    setFilter('all')
    setFocusedIncidentId(focusId)
    window.setTimeout(() => document.getElementById(`incident-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
    window.setTimeout(() => setFocusedIncidentId((current) => current === focusId ? null : current), 4000)
  }, [data.incidents])

  const incidents = data.incidents.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'open') return !['resolved', 'rejected'].includes(item.status)
    return item.status === filter
  })

  async function approve(itemId: string) {
    try {
      await updateIncident(itemId, {
        status: 'reported',
        director_reviewer_id: user!.id,
        director_reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      setMessage('Ban Giám đốc đã duyệt xử lý sự cố. Hành chính đội xe có thể tiếp nhận.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  async function reject(itemId: string) {
    const reason = window.prompt('Lý do không duyệt xử lý sự cố:')?.trim()
    if (!reason) return
    try {
      await updateIncident(itemId, {
        status: 'rejected',
        director_reviewer_id: user!.id,
        director_reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      setMessage('Ban Giám đốc đã từ chối yêu cầu xử lý sự cố.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  return <>
    {message && <div className="inline-message">{message}<button onClick={() => setMessage(null)}>✕</button></div>}
    <section className="approval-workflow-banner">
      <div><span className="eyebrow">QUY TRÌNH SỰ CỐ</span><h2>Tài xế báo sự cố → Ban Giám đốc duyệt → Hành chính đội xe xử lý</h2></div>
    </section>
    <section className="toolbar"><div className="filter-tabs">
      <button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>Đang mở</button>
      <button className={filter === 'pending_director' ? 'active' : ''} onClick={() => setFilter('pending_director')}>Chờ BGĐ</button>
      <button className={filter === 'handling' ? 'active' : ''} onClick={() => setFilter('handling')}>Đang xử lý</button>
      <button className={filter === 'resolved' ? 'active' : ''} onClick={() => setFilter('resolved')}>Đã xử lý</button>
      <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tất cả</button>
    </div></section>
    <section className="incident-grid">{incidents.map((item) => {
      const vehicle = data.vehicles.find((v) => v.id === item.vehicle_id)
      const driver = data.profiles.find((p) => p.id === item.driver_id)
      const director = data.profiles.find((p) => p.id === item.director_reviewer_id)
      return <article id={`incident-${item.id}`} className={`incident-card severity-${item.severity} ${focusedIncidentId === item.id ? 'record-focus-pulse' : ''}`} key={item.id}>
        <div className="incident-card-head"><span className="severity-chip">{item.severity === 'critical' ? 'KHẨN CẤP' : item.severity === 'high' ? 'NGHIÊM TRỌNG' : item.severity === 'medium' ? 'CẦN KIỂM TRA' : 'NHẸ'}</span><StatusBadge status={item.status} /></div>
        <h2>{INCIDENT_LABELS[item.type]}</h2><p>{item.description || 'Không có mô tả'}</p>
        <div className="incident-info"><span>🚘 {vehicle?.plate_number}</span><span>👤 {driver?.full_name}</span><span>🕒 {formatDateTime(item.created_at)}</span></div>
        <div className="media-links">{item.image_url && <a href={item.image_url} target="_blank" rel="noreferrer">📷 Xem ảnh</a>}{item.audio_url && <a href={item.audio_url} target="_blank" rel="noreferrer">🎙 Nghe ghi âm</a>}{item.lat && item.lng && <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer">📍 Xem vị trí</a>}</div>
        {item.director_reviewed_at && <small>BGĐ xử lý: {formatDateTime(item.director_reviewed_at)}{director ? ` · ${director.full_name}` : ''}</small>}
        {item.rejection_reason && <div className="rejection-box"><strong>Lý do từ chối:</strong> {item.rejection_reason}</div>}
        <div className="incident-actions">
          {item.status === 'pending_director' && canDirectorReview && <><button className="approve-button" onClick={() => void approve(item.id)}>BGĐ duyệt</button><button className="reject-button" onClick={() => void reject(item.id)}>Từ chối</button></>}
          {item.status === 'reported' && canFleetHandle && <button className="primary-button compact" onClick={() => void updateIncident(item.id, { status: 'handling', handler_id: user!.id })}>Tiếp nhận xử lý</button>}
          {item.status === 'handling' && canFleetHandle && <button className="secondary-button compact" onClick={() => { const resolution = prompt('Nội dung xử lý sự cố:'); if (resolution) void updateIncident(item.id, { status: 'resolved', resolution, resolved_at: new Date().toISOString() }) }}>Đánh dấu đã xử lý</button>}
        </div>
        {item.resolution && <div className="resolution-box"><strong>Đã xử lý:</strong> {item.resolution}</div>}
      </article>
    })}</section>
  </>
}
