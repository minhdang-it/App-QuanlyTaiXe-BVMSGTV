import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { EXPENSE_LABELS } from '../lib/constants'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'

export function ExpensesPage() {
  const { user } = useAuth()
  const { data, reviewExpense } = useData()
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState<string | null>(null)
  const canReview = ['accountant', 'admin'].includes(user!.profile.role)
  const expenses = useMemo(() => data.expenses.filter((e) => filter === 'all' || e.status === filter), [data.expenses, filter])
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  async function review(id: string, status: 'approved' | 'rejected' | 'paid') {
    const reason = status === 'rejected' ? prompt('Lý do từ chối chi phí:') ?? '' : undefined
    if (status === 'rejected' && !reason) return
    await reviewExpense(id, status, reason)
    setMessage(status === 'approved' ? 'Đã duyệt chi phí.' : status === 'paid' ? 'Đã đánh dấu thanh toán.' : 'Đã từ chối chi phí.')
  }

  return <>
    {message && <div className="inline-message">{message}<button onClick={() => setMessage(null)}>✕</button></div>}
    <section className="expense-summary"><article><span>Tổng theo bộ lọc</span><strong>{formatCurrency(total)}</strong></article><article><span>Chờ duyệt</span><strong>{data.expenses.filter((e) => e.status === 'pending').length}</strong></article><article><span>Đã duyệt</span><strong>{data.expenses.filter((e) => e.status === 'approved').length}</strong></article></section>
    <section className="toolbar"><div className="filter-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tất cả</button><button className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>Chờ duyệt</button><button className={filter === 'approved' ? 'active' : ''} onClick={() => setFilter('approved')}>Đã duyệt</button><button className={filter === 'rejected' ? 'active' : ''} onClick={() => setFilter('rejected')}>Từ chối</button></div></section>
    <section className="panel">{expenses.length ? <div className="table-wrap"><table><thead><tr><th>Ngày gửi</th><th>Xe / Tài xế</th><th>Loại chi phí</th><th>Số tiền</th><th>Hóa đơn</th><th>Trạng thái</th><th></th></tr></thead><tbody>{expenses.map((item) => {
      const vehicle = data.vehicles.find((v) => v.id === item.vehicle_id)
      const driver = data.profiles.find((p) => p.id === item.driver_id)
      return <tr key={item.id}><td>{formatDateTime(item.created_at)}</td><td><strong>{vehicle?.plate_number}</strong><small>{driver?.full_name}</small></td><td><strong>{EXPENSE_LABELS[item.type]}</strong><small>{item.type === 'fuel' && item.fuel_liters ? `${item.fuel_liters} lít · ` : ''}{item.description}</small></td><td className="money-cell">{formatCurrency(item.amount)}</td><td>{item.receipt_url ? <a href={item.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">Xem ảnh</a> : '—'}</td><td><StatusBadge status={item.status} />{item.rejection_reason && <small>{item.rejection_reason}</small>}</td><td>{canReview && <div className="row-actions">{item.status === 'pending' && <><button className="approve-button" onClick={() => void review(item.id, 'approved')}>Duyệt</button><button className="reject-button" onClick={() => void review(item.id, 'rejected')}>Từ chối</button></>}{item.status === 'approved' && <button className="secondary-button compact" onClick={() => void review(item.id, 'paid')}>Đã chi</button>}</div>}</td></tr>
    })}</tbody></table></div> : <EmptyState icon="🧾" title="Không có chi phí phù hợp" />}</section>
  </>
}
