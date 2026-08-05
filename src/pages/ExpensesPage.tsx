import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { EXPENSE_LABELS } from '../lib/constants'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import type { ExpenseReviewAction, ExpenseStatus } from '../types/models'

type ExpenseFilter = 'all' | ExpenseStatus

export function ExpensesPage() {
  const { user } = useAuth()
  const { data, reviewExpense } = useData()
  const [filter, setFilter] = useState<ExpenseFilter>('all')
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const role = user!.profile.role

  const expenses = useMemo(
    () => data.expenses.filter((expense) => filter === 'all' || expense.status === filter),
    [data.expenses, filter],
  )
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  const counts = useMemo(() => ({
    director: data.expenses.filter((expense) => expense.status === 'pending_director').length,
    accountant: data.expenses.filter((expense) => expense.status === 'pending_accountant').length,
    payment: data.expenses.filter((expense) => expense.status === 'approved').length,
    paid: data.expenses.filter((expense) => expense.status === 'paid').length,
  }), [data.expenses])

  async function review(id: string, action: ExpenseReviewAction) {
    const reason = action === 'reject' ? prompt('Lý do từ chối chi phí:')?.trim() ?? '' : undefined
    if (action === 'reject' && !reason) return

    setBusyId(id)
    try {
      await reviewExpense(id, action, reason)
      setMessage(
        action === 'director_approve'
          ? 'Ban Giám đốc đã duyệt. Chi phí đã chuyển sang Kế toán.'
          : action === 'accountant_approve'
            ? 'Kế toán đã duyệt. Chi phí đang chờ chi trả.'
            : action === 'mark_paid'
              ? 'Đã xác nhận chi trả.'
              : 'Đã từ chối chi phí.',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái chi phí.')
    } finally {
      setBusyId(null)
    }
  }

  function actionButtons(item: (typeof data.expenses)[number]) {
    const isAdmin = role === 'admin'
    if (item.status === 'pending_director' && (role === 'director' || isAdmin)) {
      return <>
        <button className="approve-button" disabled={busyId === item.id} onClick={() => void review(item.id, 'director_approve')}>BGĐ duyệt</button>
        <button className="reject-button" disabled={busyId === item.id} onClick={() => void review(item.id, 'reject')}>Từ chối</button>
      </>
    }
    if (item.status === 'pending_accountant' && (role === 'accountant' || isAdmin)) {
      return <>
        <button className="approve-button" disabled={busyId === item.id} onClick={() => void review(item.id, 'accountant_approve')}>Kế toán duyệt</button>
        <button className="reject-button" disabled={busyId === item.id} onClick={() => void review(item.id, 'reject')}>Từ chối</button>
      </>
    }
    if (item.status === 'approved' && (role === 'accountant' || isAdmin)) {
      return <button className="secondary-button compact" disabled={busyId === item.id} onClick={() => void review(item.id, 'mark_paid')}>Xác nhận đã chi</button>
    }
    return null
  }

  return <>
    {message && <div className="inline-message">{message}<button onClick={() => setMessage(null)}>✕</button></div>}

    <section className="expense-workflow-panel">
      <div className="expense-workflow-heading">
        <div>
          <span>QUY TRÌNH DUYỆT CHI PHÍ</span>
          <h2>Ban Giám đốc → Kế toán → Chi trả</h2>
        </div>
        <strong>{formatCurrency(total)}</strong>
      </div>
      <div className="expense-workflow-steps">
        <article className={counts.director ? 'has-items' : ''}><b>1</b><div><strong>Ban Giám đốc duyệt</strong><small>{counts.director} khoản đang chờ</small></div></article>
        <span>→</span>
        <article className={counts.accountant ? 'has-items' : ''}><b>2</b><div><strong>Kế toán duyệt</strong><small>{counts.accountant} khoản đang chờ</small></div></article>
        <span>→</span>
        <article className={counts.payment ? 'has-items' : ''}><b>3</b><div><strong>Được phép chi</strong><small>{counts.payment} khoản chờ chi trả</small></div></article>
        <span>→</span>
        <article><b>4</b><div><strong>Đã chi trả</strong><small>{counts.paid} khoản hoàn tất</small></div></article>
      </div>
    </section>

    <section className="expense-summary compact-expense-summary">
      <article><span>Tổng theo bộ lọc</span><strong>{formatCurrency(total)}</strong></article>
      <article><span>Chờ Ban Giám đốc</span><strong>{counts.director}</strong></article>
      <article><span>Chờ Kế toán</span><strong>{counts.accountant}</strong></article>
      <article><span>Chờ chi trả</span><strong>{counts.payment}</strong></article>
    </section>

    <section className="toolbar">
      <div className="filter-tabs expense-filter-tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tất cả</button>
        <button className={filter === 'pending_director' ? 'active' : ''} onClick={() => setFilter('pending_director')}>Chờ BGĐ</button>
        <button className={filter === 'pending_accountant' ? 'active' : ''} onClick={() => setFilter('pending_accountant')}>Chờ Kế toán</button>
        <button className={filter === 'approved' ? 'active' : ''} onClick={() => setFilter('approved')}>Chờ chi trả</button>
        <button className={filter === 'paid' ? 'active' : ''} onClick={() => setFilter('paid')}>Đã chi trả</button>
        <button className={filter === 'rejected' ? 'active' : ''} onClick={() => setFilter('rejected')}>Từ chối</button>
      </div>
    </section>

    <section className="panel">{expenses.length ? <div className="table-wrap"><table><thead><tr><th>Ngày gửi</th><th>Xe / Tài xế</th><th>Loại chi phí</th><th>Số tiền</th><th>Hóa đơn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{expenses.map((item) => {
      const vehicle = data.vehicles.find((vehicleItem) => vehicleItem.id === item.vehicle_id)
      const driver = data.profiles.find((profile) => profile.id === item.driver_id)
      return <tr key={item.id}>
        <td>{formatDateTime(item.created_at)}</td>
        <td><strong>{vehicle?.plate_number}</strong><small>{driver?.full_name}</small></td>
        <td><strong>{EXPENSE_LABELS[item.type]}</strong><small>{item.type === 'fuel' && item.fuel_liters ? `${item.fuel_liters} lít · ` : ''}{item.description}</small></td>
        <td className="money-cell">{formatCurrency(item.amount)}</td>
        <td>{item.receipt_url ? <a href={item.receipt_url} target="_blank" rel="noreferrer" className="receipt-link">Xem ảnh</a> : '—'}</td>
        <td>
          <StatusBadge status={item.status} />
          {item.director_reviewed_at && <small>BGĐ: {formatDateTime(item.director_reviewed_at)}</small>}
          {item.accountant_reviewed_at && <small>Kế toán: {formatDateTime(item.accountant_reviewed_at)}</small>}
          {item.paid_at && <small>Chi trả: {formatDateTime(item.paid_at)}</small>}
          {item.rejection_reason && <small>Lý do: {item.rejection_reason}</small>}
        </td>
        <td><div className="row-actions">{actionButtons(item)}</div></td>
      </tr>
    })}</tbody></table></div> : <EmptyState icon="🧾" title="Không có chi phí phù hợp" />}</section>
  </>
}
