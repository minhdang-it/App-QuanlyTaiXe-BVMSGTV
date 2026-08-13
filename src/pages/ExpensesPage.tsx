import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { EXPENSE_LABELS } from '../lib/constants'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { ImagePreview } from '../components/ImagePreview'
import { Modal } from '../components/Modal'
import type { ExpenseReviewAction, ExpenseStatus } from '../types/models'
import { consumeNavigationFocus } from '../lib/focusNavigation'

type ExpenseFilter = 'all' | ExpenseStatus

export function ExpensesPage() {
  const { user } = useAuth()
  const { data, reviewExpense } = useData()
  const [filter, setFilter] = useState<ExpenseFilter>('all')
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const role = user!.profile.role

  useEffect(() => {
    const focusId = consumeNavigationFocus('expenses')
    if (!focusId || !data.expenses.some((item) => item.id === focusId)) return
    setFilter('all')
    setSelectedExpenseId(focusId)
  }, [data.expenses])

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
        <td>{item.receipt_url ? <ImagePreview compact src={item.receipt_url} alt={`Hóa đơn ${EXPENSE_LABELS[item.type]} ${formatCurrency(item.amount)}`} /> : '—'}</td>
        <td>
          <StatusBadge status={item.status} />
          {item.director_reviewed_at && <small>BGĐ: {formatDateTime(item.director_reviewed_at)}</small>}
          {item.accountant_reviewed_at && <small>Kế toán: {formatDateTime(item.accountant_reviewed_at)}</small>}
          {item.paid_at && <small>Chi trả: {formatDateTime(item.paid_at)}</small>}
          {item.rejection_reason && <small>Lý do: {item.rejection_reason}</small>}
        </td>
        <td><div className="row-actions"><button className="secondary-button compact" onClick={() => setSelectedExpenseId(item.id)}>Chi tiết</button>{actionButtons(item)}</div></td>
      </tr>
    })}</tbody></table></div> : <EmptyState icon="🧾" title="Không có chi phí phù hợp" />}</section>

    {selectedExpenseId && (() => {
      const item = data.expenses.find((expense) => expense.id === selectedExpenseId)
      if (!item) return null
      const vehicle = data.vehicles.find((vehicleItem) => vehicleItem.id === item.vehicle_id)
      const driver = data.profiles.find((profile) => profile.id === item.driver_id)
      const director = data.profiles.find((profile) => profile.id === item.director_reviewer_id)
      const accountant = data.profiles.find((profile) => profile.id === item.accountant_reviewer_id)
      return <Modal title={`Chi tiết chi phí · ${EXPENSE_LABELS[item.type]}`} onClose={() => setSelectedExpenseId(null)} wide>
        <div className="expense-detail-modal">
          <div className="expense-detail-summary"><div><span>{EXPENSE_LABELS[item.type]}</span><strong>{formatCurrency(item.amount)}</strong></div><StatusBadge status={item.status} /></div>
          <div className="detail-grid">
            <div><span>Xe</span><strong>{vehicle?.plate_number ?? '—'}</strong></div>
            <div><span>Tài xế</span><strong>{driver?.full_name ?? '—'}</strong></div>
            <div><span>Ngày chi phí</span><strong>{formatDateTime(item.expense_date)}</strong></div>
            <div><span>Ngày gửi</span><strong>{formatDateTime(item.created_at)}</strong></div>
            {item.type === 'fuel' && <><div><span>Số lít</span><strong>{item.fuel_liters ? `${item.fuel_liters} lít` : '—'}</strong></div><div><span>Đơn giá</span><strong>{item.fuel_unit_price ? formatCurrency(item.fuel_unit_price) : '—'}</strong></div></>}
          </div>
          <div className="note-box"><strong>Nội dung</strong><p>{item.description || 'Không có ghi chú.'}</p></div>
          <section className="trip-detail-section"><h3>Hóa đơn / chứng từ</h3>{item.receipt_url ? <ImagePreview src={item.receipt_url} alt={`Hóa đơn ${EXPENSE_LABELS[item.type]}`} /> : <p className="muted-copy">Không có ảnh hóa đơn.</p>}</section>
          <section className="trip-detail-section"><h3>Lịch sử duyệt</h3><div className="compact-record-list">
            <div><span>Ban Giám đốc</span><strong>{item.director_reviewed_at ? formatDateTime(item.director_reviewed_at) : 'Chưa duyệt'}</strong><small>{director?.full_name ?? ''}</small></div>
            <div><span>Kế toán</span><strong>{item.accountant_reviewed_at ? formatDateTime(item.accountant_reviewed_at) : 'Chưa duyệt'}</strong><small>{accountant?.full_name ?? ''}</small></div>
            <div><span>Chi trả</span><strong>{item.paid_at ? formatDateTime(item.paid_at) : 'Chưa chi trả'}</strong></div>
          </div>{item.rejection_reason && <div className="rejection-box"><strong>Lý do từ chối:</strong> {item.rejection_reason}</div>}</section>
          <div className="form-actions"><button className="secondary-button" onClick={() => setSelectedExpenseId(null)}>Đóng</button>{actionButtons(item)}</div>
        </div>
      </Modal>
    })()}
  </>
}
