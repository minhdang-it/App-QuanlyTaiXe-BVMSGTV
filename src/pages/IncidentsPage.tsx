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
  const [filter, setFilter] = useState<'open' | 'pending_fleet' | 'pending_director' | 'handling' | 'resolved' | 'all'>('open')
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

  async function submitToDirector(itemId: string) {
    try {
      await updateIncident(itemId, { status: 'pending_director', handler_id: user!.id })
      setMessage('Hành chính đã kiểm tra và trình Ban Giám đốc duyệt sửa/xử lý sự cố.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  async function approve(itemId: string) {
    try {
      await updateIncident(itemId, {
        status: 'reported',
        director_reviewer_id: user!.id,
        director_reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      setMessage('Ban Giám đốc đã duyệt. Tài xế sẽ nhận thông báo ĐƯỢC PHÉP SỬA và Hành chính có thể tiếp nhận xử lý.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  async function reject(itemId: string) {
    const reason = window.prompt('Lý do không duyệt sửa/xử lý sự cố:')?.trim()
    if (!reason) return
    try {
      await updateIncident(itemId, {
        status: 'rejected',
        director_reviewer_id: user!.id,
        director_reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      setMessage('Ban Giám đốc không duyệt. Tài xế sẽ nhận thông báo CHƯA ĐƯỢC PHÉP SỬA kèm lý do.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  return <>
    {message && <div className="inline-message">{message}<button onClick={() => setMessage(null)}>✕</button></div>}
    <section className="approval-workflow-banner incident-workflow-v2">
      <div><span className="eyebrow">QUY TRÌNH SỰ CỐ / SỬA CHỮA</span><h2>Tài xế → Hành chính → Ban Giám đốc → Thông báo lại tài xế → Hành chính xử lý</h2><p>Xe chỉ chuyển sang bước sửa/xử lý sau khi Ban Giám đốc duyệt. Kết quả duyệt được gửi trực tiếp về tài khoản tài xế.</p></div>
    </section>
    <section className="toolbar incident-filter-toolbar"><div className="filter-tabs incident-filter-tabs">
      <button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>Đang mở</button>
      <button className={filter === 'pending_fleet' ? 'active' : ''} onClick={() => setFilter('pending_fleet')}>Chờ Hành chính</button>
      <button className={filter === 'pending_director' ? 'active' : ''} onClick={() => setFilter('pending_director')}>Chờ BGĐ</button>
      <button className={filter === 'handling' ? 'active' : ''} onClick={() => setFilter('handling')}>Đang sửa</button>
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
        {item.status === 'reported' && <div className="incident-decision approved"><strong>✓ BGĐ ĐÃ DUYỆT SỬA</strong><span>Tài xế đã được thông báo có thể đưa xe vào sửa/xử lý.</span></div>}
        {item.status === 'rejected' && <div className="incident-decision rejected"><strong>✕ CHƯA ĐƯỢC PHÉP SỬA</strong><span>{item.rejection_reason || 'Ban Giám đốc không duyệt yêu cầu sửa/xử lý.'}</span></div>}
        {item.director_reviewed_at && <small>BGĐ xử lý: {formatDateTime(item.director_reviewed_at)}{director ? ` · ${director.full_name}` : ''}</small>}
        <div className="incident-actions">
          {item.status === 'pending_fleet' && canFleetHandle && <button className="approve-button" onClick={() => void submitToDirector(item.id)}>Hành chính trình BGĐ</button>}
          {item.status === 'pending_director' && canDirectorReview && <><button className="approve-button" onClick={() => void approve(item.id)}>BGĐ duyệt sửa</button><button className="reject-button" onClick={() => void reject(item.id)}>Không duyệt</button></>}
          {item.status === 'reported' && canFleetHandle && <button className="primary-button compact" onClick={() => void updateIncident(item.id, { status: 'handling', handler_id: user!.id })}>Bắt đầu sửa / xử lý</button>}
          {item.status === 'handling' && canFleetHandle && <button className="secondary-button compact" onClick={() => { const resolution = window.prompt('Nội dung xử lý sự cố:'); if (resolution) void updateIncident(item.id, { status: 'resolved', resolution, resolved_at: new Date().toISOString() }) }}>Đánh dấu đã xử lý</button>}
        </div>
        {item.resolution && <div className="resolution-box"><strong>Đã xử lý:</strong> {item.resolution}</div>}
      </article>
    })}</section>
  </>
}
