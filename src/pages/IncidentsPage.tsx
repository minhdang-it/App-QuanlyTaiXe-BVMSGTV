import { useState } from 'react'
import { useData } from '../context/DataContext'
import { INCIDENT_LABELS } from '../lib/constants'
import { formatDateTime } from '../lib/utils'
import type { IncidentStatus } from '../types/models'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'

export function IncidentsPage() {
  const { data, updateIncident } = useData()
  const [filter, setFilter] = useState('open')
  const incidents = data.incidents.filter((item) => filter === 'all' || (filter === 'open' ? item.status !== 'resolved' : item.status === filter))

  return <>
    <section className="toolbar"><div className="filter-tabs"><button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>Đang mở</button><button className={filter === 'resolved' ? 'active' : ''} onClick={() => setFilter('resolved')}>Đã xử lý</button><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tất cả</button></div></section>
    <section className="incident-grid">{incidents.length ? incidents.map((item) => {
      const vehicle = data.vehicles.find((v) => v.id === item.vehicle_id)
      const driver = data.profiles.find((p) => p.id === item.driver_id)
      return <article className={`incident-card severity-${item.severity}`} key={item.id}><div className="incident-card-head"><span className="severity-chip">{item.severity === 'critical' ? 'KHẨN CẤP' : item.severity === 'high' ? 'NGHIÊM TRỌNG' : item.severity === 'medium' ? 'CẦN KIỂM TRA' : 'NHẸ'}</span><StatusBadge status={item.status} /></div><h2>{INCIDENT_LABELS[item.type]}</h2><p>{item.description || 'Không có mô tả'}</p><div className="incident-info"><span>🚘 {vehicle?.plate_number}</span><span>👤 {driver?.full_name}</span><span>🕒 {formatDateTime(item.created_at)}</span></div><div className="media-links">{item.image_url && <a href={item.image_url} target="_blank" rel="noreferrer">📷 Xem ảnh</a>}{item.audio_url && <a href={item.audio_url} target="_blank" rel="noreferrer">🎙 Nghe ghi âm</a>}{item.lat && item.lng && <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer">📍 Xem vị trí</a>}</div><div className="incident-actions">{item.status === 'reported' && <button className="primary-button compact" onClick={() => void updateIncident(item.id, { status: 'handling' })}>Tiếp nhận</button>}{item.status !== 'resolved' && <button className="secondary-button compact" onClick={() => { const resolution = prompt('Nội dung xử lý sự cố:'); if (resolution) void updateIncident(item.id, { status: 'resolved', resolution, resolved_at: new Date().toISOString() }) }}>Đánh dấu đã xử lý</button>}</div>{item.resolution && <div className="resolution-box"><strong>Đã xử lý:</strong> {item.resolution}</div>}</article>
    }) : <EmptyState icon="✅" title="Không có sự cố đang mở" description="Các báo cáo từ tài xế sẽ xuất hiện tại đây." />}</section>
  </>
}
