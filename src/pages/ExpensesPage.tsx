import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { EXPENSE_LABELS } from '../lib/constants'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { ImagePreview } from '../components/ImagePreview'
import { Modal } from '../components/Modal'
import type { Expense, ExpenseReviewAction, ExpenseStatus } from '../types/models'
import { consumeNavigationFocus } from '../lib/focusNavigation'

type ExpenseFilter = 'all' | ExpenseStatus

const filters: Array<{ value: ExpenseFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending_fleet', label: 'Chờ Hành chính' },
  { value: 'pending_accountant', label: 'KT kiểm tra' },
  { value: 'pending_director', label: 'Chờ BGĐ' },
  { value: 'pending_accountant_final', label: 'KT xác nhận' },
  { value: 'approved', label: 'Chờ chi trả' },
  { value: 'paid', label: 'Đã chi trả' },
  { value: 'rejected', label: 'Từ chối' },
]

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
    () => data.expenses
      .filter((expense) => filter === 'all' || expense.status === filter)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [data.expenses, filter],
  )
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const counts = useMemo(() => ({
    fleet: data.expenses.filter((item) => item.status === 'pending_fleet').length,
    accountantPre: data.expenses.filter((item) => item.status === 'pending_accountant').length,
    director: data.expenses.filter((item) => item.status === 'pending_director').length,
    accountantFinal: data.expenses.filter((item) => item.status === 'pending_accountant_final').length,
    payment: data.expenses.filter((item) => item.status === 'approved').length,
    paid: data.expenses.filter((item) => item.status === 'paid').length,
  }), [data.expenses])

  async function review(id: string, action: ExpenseReviewAction) {
    const reason = action === 'reject' ? window.prompt('Lý do từ chối chi phí:')?.trim() ?? '' : undefined
    if (action === 'reject' && !reason) return
    setBusyId(id)
    try {
      await reviewExpense(id, action, reason)
      const messages: Record<ExpenseReviewAction, string> = {
        fleet_approve: 'Hành chính đã duyệt. Chi phí đã chuyển Kế toán kiểm tra chứng từ.',
        accountant_precheck: 'Kế toán đã kiểm tra. Chi phí đã chuyển Ban Giám đốc duyệt.',
        director_approve: 'Ban Giám đốc đã duyệt. Chi phí đã chuyển lại Kế toán xác nhận.',
        accountant_final_approve: 'Kế toán đã xác nhận. Khoản chi đã đủ điều kiện chi trả.',
        mark_paid: 'Kế toán đã xác nhận chi trả. Quy trình hoàn tất.',
        reject: 'Đã từ chối chi phí và lưu lý do.',
      }
      setMessage(messages[action])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái chi phí.')
    } finally {
      setBusyId(null)
    }
  }

  function actionButtons(item: Expense) {
    const isAdmin = role === 'admin'
    const rejectButton = <button className="reject-button" disabled={busyId === item.id} onClick={() => void review(item.id, 'reject')}>Từ chối</button>
    if (item.status === 'pending_fleet' && (role === 'fleet' || isAdmin)) return <><button className="approve-button" disabled={busyId === item.id} onClick={() => void review(item.id, 'fleet_approve')}>Hành chính duyệt</button>{rejectButton}</>
    if (item.status === 'pending_accountant' && (role === 'accountant' || isAdmin)) return <><button className="approve-button" disabled={busyId === item.id} onClick={() => void review(item.id, 'accountant_precheck')}>KT kiểm tra xong</button>{rejectButton}</>
    if (item.status === 'pending_director' && (role === 'director' || isAdmin)) return <><button className="approve-button" disabled={busyId === item.id} onClick={() => void review(item.id, 'director_approve')}>BGĐ duyệt</button>{rejectButton}</>
    if (item.status === 'pending_accountant_final' && (role === 'accountant' || isAdmin)) return <><button className="approve-button" disabled={busyId === item.id} onClick={() => void review(item.id, 'accountant_final_approve')}>KT xác nhận</button>{rejectButton}</>
    if (item.status === 'approved' && (role === 'accountant' || isAdmin)) return <button className="approve-button" disabled={busyId === item.id} onClick={() => void review(item.id, 'mark_paid')}>Xác nhận đã chi</button>
    return null
  }

  return <>
    {message && <div className="inline-message">{message}<button onClick={() => setMessage(null)}>✕</button></div>}

    <section className="expense-workflow-panel expense-workflow-panel-v2">
      <div className="expense-workflow-heading"><div><span>QUY TRÌNH DUYỆT CHI PHÍ</span><h2>Hành chính → Kế toán → Ban Giám đốc → Kế toán → Chi trả</h2><p>Tài xế gửi chứng từ một lần, hệ thống chuyển đúng người ở từng bước và lưu đầy đủ lịch sử duyệt.</p></div><strong>{formatCurrency(total)}</strong></div>
      <div className="expense-workflow-steps expense-workflow-steps-six">
        <WorkflowStep number={1} title="Hành chính duyệt" count={counts.fleet} note="Kiểm tra phát sinh" />
        <WorkflowArrow />
        <WorkflowStep number={2} title="Kế toán kiểm tra" count={counts.accountantPre} note="Đối chiếu chứng từ" />
        <WorkflowArrow />
        <WorkflowStep number={3} title="Ban Giám đốc duyệt" count={counts.director} note="Phê duyệt khoản chi" />
        <WorkflowArrow />
        <WorkflowStep number={4} title="Kế toán xác nhận" count={counts.accountantFinal} note="Chốt điều kiện chi" />
        <WorkflowArrow />
        <WorkflowStep number={5} title="Được phép chi" count={counts.payment} note="Chờ thực hiện chi" />
        <WorkflowArrow />
        <WorkflowStep number={6} title="Đã chi trả" count={counts.paid} note="Hoàn tất" />
      </div>
    </section>

    <section className="expense-summary compact-expense-summary expense-summary-six">
      <article><span>Tổng theo bộ lọc</span><strong>{formatCurrency(total)}</strong></article>
      <article><span>Chờ Hành chính</span><strong>{counts.fleet}</strong></article>
      <article><span>KT kiểm tra</span><strong>{counts.accountantPre}</strong></article>
      <article><span>Chờ BGĐ</span><strong>{counts.director}</strong></article>
      <article><span>KT xác nhận</span><strong>{counts.accountantFinal}</strong></article>
      <article><span>Chờ chi trả</span><strong>{counts.payment}</strong></article>
    </section>

    <section className="toolbar"><div className="filter-tabs expense-filter-tabs">{filters.map((item) => <button key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div></section>

    <section className="panel">{expenses.length ? <div className="table-wrap"><table><thead><tr><th>Ngày gửi</th><th>Xe / Tài xế</th><th>Loại chi phí</th><th>Số tiền</th><th>Hóa đơn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{expenses.map((item) => {
      const vehicle = data.vehicles.find((vehicleItem) => vehicleItem.id === item.vehicle_id)
      const driver = data.profiles.find((profile) => profile.id === item.driver_id)
      return <tr key={item.id}>
        <td>{formatDateTime(item.created_at)}</td>
        <td><strong>{vehicle?.plate_number ?? '—'}</strong><small>{driver?.full_name ?? '—'}</small></td>
        <td><strong>{EXPENSE_LABELS[item.type]}</strong><small>{item.type === 'fuel' && item.fuel_liters ? `${item.fuel_liters} lít · ` : ''}{item.description}</small></td>
        <td className="money-cell">{formatCurrency(item.amount)}</td>
        <td>{item.receipt_url ? <ImagePreview compact src={item.receipt_url} alt={`Hóa đơn ${EXPENSE_LABELS[item.type]} ${formatCurrency(item.amount)}`} /> : '—'}</td>
        <td><StatusBadge status={item.status} />{item.rejection_reason && <small className="danger-copy">Lý do: {item.rejection_reason}</small>}</td>
        <td><div className="row-actions"><button className="secondary-button compact" onClick={() => setSelectedExpenseId(item.id)}>Chi tiết</button>{actionButtons(item)}</div></td>
      </tr>
    })}</tbody></table></div> : <EmptyState icon="🧾" title="Không có chi phí phù hợp" />}</section>

    {selectedExpenseId && (() => {
      const item = data.expenses.find((expense) => expense.id === selectedExpenseId)
      if (!item) return null
      const vehicle = data.vehicles.find((vehicleItem) => vehicleItem.id === item.vehicle_id)
      const driver = data.profiles.find((profile) => profile.id === item.driver_id)
      const fleet = data.profiles.find((profile) => profile.id === item.fleet_reviewer_id)
      const preAccountant = data.profiles.find((profile) => profile.id === item.precheck_accountant_reviewer_id)
      const director = data.profiles.find((profile) => profile.id === item.director_reviewer_id)
      const finalAccountant = data.profiles.find((profile) => profile.id === item.accountant_reviewer_id)
      const paidBy = data.profiles.find((profile) => profile.id === item.paid_by)
      return <Modal title={`Chi tiết chi phí · ${EXPENSE_LABELS[item.type]}`} onClose={() => setSelectedExpenseId(null)} wide><div className="expense-detail-modal">
        <div className="expense-detail-summary"><div><span>{EXPENSE_LABELS[item.type]}</span><strong>{formatCurrency(item.amount)}</strong></div><StatusBadge status={item.status} /></div>
        <div className="detail-grid"><div><span>Xe</span><strong>{vehicle?.plate_number ?? '—'}</strong></div><div><span>Tài xế</span><strong>{driver?.full_name ?? '—'}</strong></div><div><span>Ngày chi phí</span><strong>{formatDateTime(item.expense_date)}</strong></div><div><span>Ngày gửi</span><strong>{formatDateTime(item.created_at)}</strong></div>{item.type === 'fuel' && <><div><span>Số lít</span><strong>{item.fuel_liters ? `${item.fuel_liters} lít` : '—'}</strong></div><div><span>Đơn giá</span><strong>{item.fuel_unit_price ? formatCurrency(item.fuel_unit_price) : '—'}</strong></div></>}</div>
        <div className="note-box"><strong>Nội dung</strong><p>{item.description || 'Không có ghi chú.'}</p></div>
        <section className="trip-detail-section"><h3>Hóa đơn / chứng từ</h3>{item.receipt_url ? <ImagePreview src={item.receipt_url} alt={`Hóa đơn ${EXPENSE_LABELS[item.type]}`} /> : <p className="muted-copy">Không có ảnh hóa đơn.</p>}</section>
        <section className="trip-detail-section"><h3>Lịch sử duyệt</h3><div className="compact-record-list expense-approval-history">
          <ApprovalHistory label="1. Hành chính" time={item.fleet_reviewed_at} name={fleet?.full_name} />
          <ApprovalHistory label="2. Kế toán kiểm tra" time={item.precheck_accountant_reviewed_at} name={preAccountant?.full_name} />
          <ApprovalHistory label="3. Ban Giám đốc" time={item.director_reviewed_at} name={director?.full_name} />
          <ApprovalHistory label="4. Kế toán xác nhận" time={item.accountant_reviewed_at} name={finalAccountant?.full_name} />
          <ApprovalHistory label="5. Chi trả" time={item.paid_at} name={paidBy?.full_name} />
        </div>{item.rejection_reason && <div className="rejection-box"><strong>Lý do từ chối:</strong> {item.rejection_reason}</div>}</section>
        <div className="form-actions"><button className="secondary-button" onClick={() => setSelectedExpenseId(null)}>Đóng</button>{actionButtons(item)}</div>
      </div></Modal>
    })()}
  </>
}

function WorkflowStep({ number, title, count, note }: { number: number; title: string; count: number; note: string }) {
  return <article className={count ? 'has-items' : ''}><b>{number}</b><div><strong>{title}</strong><small>{count} khoản đang chờ · {note}</small></div></article>
}

function WorkflowArrow() { return <span className="expense-workflow-arrow">→</span> }

function ApprovalHistory({ label, time, name }: { label: string; time?: string | null; name?: string | null }) {
  return <div><span>{label}</span><strong>{time ? formatDateTime(time) : 'Chưa xử lý'}</strong><small>{name ?? ''}</small></div>
}
