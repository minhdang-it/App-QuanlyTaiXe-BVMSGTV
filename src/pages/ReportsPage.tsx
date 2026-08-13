import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { VietnamDateInput } from '../components/VietnamDateInput'
import { EXPENSE_LABELS, PURPOSE_LABELS } from '../lib/constants'
import { formatCurrency, formatDate, todayKey } from '../lib/utils'
import type { AppData, Expense, ExpenseType, Trip, TripPurpose, Vehicle } from '../types/models'

type PeriodMode = 'day' | 'week' | 'month' | 'year' | 'custom'
type DateRange = { start: Date; end: Date; startKey: string; endKey: string; label: string }
type PurposeReport = { key: TripPurpose; label: string; trips: number; cost: number; distance: number }
type VehicleReport = { vehicle: Vehicle; trips: number; cost: number; distance: number; costPerKm: number; fuelLiters: number; actualFuelRate: number; incidents: number; overFuelNorm: boolean }
type DriverReport = { id: string; name: string; trips: number; distance: number; cost: number; incidents: number }
type DestinationReport = { name: string; count: number }
type ExpenseTypeReport = { key: ExpenseType; label: string; total: number }
type TrendItem = { key: string; label: string; trips: number; distance: number; cost: number }
type InsightItem = { icon: string; title: string; detail: string; tone: 'good' | 'warning' | 'danger' | 'info' }
type VehicleTcoReport = {
  vehicle: Vehicle
  directCost: number
  maintenanceCost: number
  tco: number
  distance: number
  tcoPerKm: number
  share: number
}
type ForecastMonth = { key: string; label: string; actual: number; normalized: number; partial: boolean }
type ExecutiveReport = {
  directCost: number
  maintenanceCost: number
  tcoTotal: number
  tcoPerKm: number
  vehicleTco: VehicleTcoReport[]
  forecastMonths: ForecastMonth[]
  forecastNextMonth: number
  forecastLabel: string
  forecastConfidence: 'Cao' | 'Trung bình' | 'Thấp'
  periodBudget: number
  budgetUsagePct: number
  budgetVariance: number
  topConcentration: number
  narratives: Array<{ title: string; detail: string; tone: 'good' | 'warning' | 'danger' | 'info' }>
}

type ReportData = {
  trips: Trip[]
  expenses: Expense[]
  incidents: AppData['incidents']
  maintenances: AppData['maintenances']
  purpose: PurposeReport[]
  vehicles: VehicleReport[]
  drivers: DriverReport[]
  destinations: DestinationReport[]
  expenseTypes: ExpenseTypeReport[]
  trend: TrendItem[]
  insights: InsightItem[]
  totalCost: number
  totalDistance: number
  totalFuelLiters: number
  costPerKm: number
  seriousIncidents: number
  maintenanceCost: number
  odometerCoverage: number
  completedRate: number
  maxExpenseType: number
  tripIds: Set<string>
}

const PERIOD_LABELS: Record<PeriodMode, string> = {
  day: 'Ngày',
  week: 'Tuần',
  month: 'Tháng',
  year: 'Năm',
  custom: 'Từ ngày – đến ngày',
}

function dateKey(date: Date) {
  return todayKey(date)
}

function localDate(key: string) {
  const date = new Date(`${key}T00:00:00`)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function endOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function startOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function resolveRange(mode: PeriodMode, anchor: string, customFrom: string, customTo: string): DateRange {
  const anchorDate = localDate(anchor)
  let start = startOfDay(anchorDate)
  let end = endOfDay(anchorDate)

  if (mode === 'week') {
    const mondayOffset = (anchorDate.getDay() + 6) % 7
    start = startOfDay(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - mondayOffset))
    end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6))
  } else if (mode === 'month') {
    start = startOfDay(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1))
    end = endOfDay(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0))
  } else if (mode === 'year') {
    start = startOfDay(new Date(anchorDate.getFullYear(), 0, 1))
    end = endOfDay(new Date(anchorDate.getFullYear(), 11, 31))
  } else if (mode === 'custom') {
    const from = localDate(customFrom || anchor)
    const to = localDate(customTo || customFrom || anchor)
    start = startOfDay(from <= to ? from : to)
    end = endOfDay(from <= to ? to : from)
  }

  const startKey = dateKey(start)
  const endKey = dateKey(end)
  const label = startKey === endKey ? formatDate(startKey) : `${formatDate(startKey)} – ${formatDate(endKey)}`
  return { start, end, startKey, endKey, label }
}

function previousRange(range: DateRange): DateRange {
  const length = range.end.getTime() - range.start.getTime() + 1
  const end = new Date(range.start.getTime() - 1)
  const start = new Date(end.getTime() - length + 1)
  const startKey = dateKey(start)
  const endKey = dateKey(end)
  return { start, end, startKey, endKey, label: `${formatDate(startKey)} – ${formatDate(endKey)}` }
}

function inRange(value: string | null | undefined, range: DateRange) {
  if (!value) return false
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time >= range.start.getTime() && time <= range.end.getTime()
}

function pctChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0
  return ((current - previous) / previous) * 100
}

function deltaLabel(current: number, previous: number, lowerIsBetter = false) {
  if (!previous && !current) return { text: 'Không đổi', tone: 'neutral' }
  const delta = pctChange(current, previous)
  const positive = delta > 0
  const good = lowerIsBetter ? !positive : positive
  return {
    text: `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% so kỳ trước`,
    tone: Math.abs(delta) < 0.1 ? 'neutral' : good ? 'good' : 'bad',
  }
}

export function ReportsPage() {
  const { data } = useData()
  const { user } = useAuth()
  const canViewExecutiveReport = user?.profile.role === 'director' || user?.profile.role === 'admin'
  const [mode, setMode] = useState<PeriodMode>('month')
  const [anchor, setAnchor] = useState(todayKey())
  const [customFrom, setCustomFrom] = useState(todayKey())
  const [customTo, setCustomTo] = useState(todayKey())
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const saved = Number(window.localStorage.getItem('bvmsgtv-fleet-monthly-budget') ?? 0)
    return Number.isFinite(saved) && saved > 0 ? saved : 0
  })

  const range = useMemo(() => resolveRange(mode, anchor, customFrom, customTo), [mode, anchor, customFrom, customTo])
  const previous = useMemo(() => previousRange(range), [range])

  const report = useMemo(() => buildReport(data, range), [data, range])
  const previousReport = useMemo(() => buildReport(data, previous), [data, previous])
  const executive = useMemo(() => buildExecutiveReport(data, range, report, previousReport, monthlyBudget), [data, range, report, previousReport, monthlyBudget])

  const comparisons = [
    { label: 'Chuyến hoàn thành', value: report.trips.length.toLocaleString('vi-VN'), delta: deltaLabel(report.trips.length, previousReport.trips.length) },
    { label: 'Km vận hành', value: `${report.totalDistance.toLocaleString('vi-VN')} km`, delta: deltaLabel(report.totalDistance, previousReport.totalDistance) },
    { label: 'Tổng chi phí', value: formatCurrency(report.totalCost), delta: deltaLabel(report.totalCost, previousReport.totalCost, true) },
    { label: 'Chi phí/km', value: report.costPerKm ? formatCurrency(report.costPerKm) : '—', delta: deltaLabel(report.costPerKm, previousReport.costPerKm, true) },
  ]

  function updateMonthlyBudget(value: string) {
    const parsed = Math.max(0, Number(value.replace(/[^0-9]/g, '')) || 0)
    setMonthlyBudget(parsed)
    if (typeof window !== 'undefined') {
      if (parsed) window.localStorage.setItem('bvmsgtv-fleet-monthly-budget', String(parsed))
      else window.localStorage.removeItem('bvmsgtv-fleet-monthly-budget')
    }
  }

  function movePeriod(direction: -1 | 1) {
    if (mode === 'custom') return
    const date = localDate(anchor)
    if (mode === 'day') date.setDate(date.getDate() + direction)
    if (mode === 'week') date.setDate(date.getDate() + direction * 7)
    if (mode === 'month') date.setMonth(date.getMonth() + direction)
    if (mode === 'year') date.setFullYear(date.getFullYear() + direction)
    setAnchor(dateKey(date))
  }

  function selectMode(next: PeriodMode) {
    setMode(next)
    if (next === 'custom') {
      setCustomFrom(range.startKey)
      setCustomTo(range.endKey)
    }
  }

  function exportCsv() {
    const rows: Array<Array<string | number>> = [
      ['BỆNH VIỆN MẮT SÀI GÒN TRÀ VINH'],
      ['BÁO CÁO ĐIỀU PHỐI XE NÂNG CAO'],
      ['Kỳ báo cáo', range.label],
      ['Loại kỳ', PERIOD_LABELS[mode]],
      [],
      ['CHỈ SỐ TỔNG QUAN'],
      ['Tổng chuyến hoàn thành', report.trips.length],
      ['Tổng km', report.totalDistance],
      ['Tổng chi phí', report.totalCost],
      ['Chi phí/km', Math.round(report.costPerKm)],
      ['Xăng tiêu thụ (lít)', report.totalFuelLiters.toFixed(1)],
      ['Sự cố', report.incidents.length],
      ['Sự cố nghiêm trọng', report.seriousIncidents],
      ['Chi phí bảo dưỡng', report.maintenanceCost],
      ['Tỷ lệ đủ KM đầu/cuối', `${report.odometerCoverage.toFixed(1)}%`],
      [],
      ['THEO LOẠI CHUYẾN'],
      ['Loại chuyến', 'Số chuyến', 'Km', 'Chi phí', 'Chi phí/chuyến'],
    ]
    if (canViewExecutiveReport) {
      rows.push(
        [],
        ['BÁO CÁO BAN GIÁM ĐỐC'],
        ['Chi phí trực tiếp', executive.directCost],
        ['Chi phí bảo dưỡng bổ sung', executive.maintenanceCost],
        ['Tổng chi phí vận hành', executive.tcoTotal],
        ['Chi phí vận hành/km', Math.round(executive.tcoPerKm)],
        ['Dự báo tháng kế tiếp', Math.round(executive.forecastNextMonth)],
        ['Độ tin cậy dự báo', executive.forecastConfidence],
        ['Ngân sách tham chiếu kỳ', Math.round(executive.periodBudget)],
        ['Chênh lệch so ngân sách', Math.round(executive.budgetVariance)],
        [],
        ['CHI PHÍ VẬN HÀNH TỪNG XE'],
        ['Xe', 'Chi phí trực tiếp', 'Bảo dưỡng', 'Tổng chi phí vận hành', 'Km', 'Chi phí vận hành/km', 'Tỷ trọng chi phí'],
        ...executive.vehicleTco.map((item) => [item.vehicle.plate_number, item.directCost, item.maintenanceCost, item.tco, item.distance, Math.round(item.tcoPerKm), `${item.share.toFixed(1)}%`]),
      )
    }

    report.purpose.forEach((item) => rows.push([item.label, item.trips, item.distance, item.cost, item.trips ? Math.round(item.cost / item.trips) : 0]))
    rows.push([], ['HIỆU QUẢ TỪNG XE'], ['Xe', 'Số chuyến', 'Km', 'Chi phí', 'Chi phí/km', 'Lít xăng', 'L/100km'])
    report.vehicles.forEach((item) => rows.push([item.vehicle.plate_number, item.trips, item.distance, item.cost, Math.round(item.costPerKm), item.fuelLiters.toFixed(1), item.actualFuelRate.toFixed(1)]))
    rows.push([], ['HIỆU QUẢ TÀI XẾ'], ['Tài xế', 'Số chuyến', 'Km', 'Chi phí', 'Sự cố'])
    report.drivers.forEach((item) => rows.push([item.name, item.trips, item.distance, item.cost, item.incidents]))
    rows.push([], ['ĐIỂM ĐẾN NHIỀU NHẤT'], ['Điểm đến', 'Số chuyến'])
    report.destinations.forEach((item) => rows.push([item.name, item.count]))

    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchorEl = document.createElement('a')
    anchorEl.href = url
    anchorEl.download = `Bao-cao-dieu-phoi-xe-${range.startKey}-${range.endKey}.csv`
    anchorEl.click()
    URL.revokeObjectURL(url)
  }

  function copySummary() {
    const topVehicle = report.vehicles[0]
    const text = [
      `BÁO CÁO ĐIỀU PHỐI XE – ${range.label}`,
      `Chuyến hoàn thành: ${report.trips.length}`,
      `Tổng km: ${report.totalDistance.toLocaleString('vi-VN')} km`,
      `Tổng chi phí trực tiếp: ${formatCurrency(report.totalCost)}`,
      ...(canViewExecutiveReport ? [
        `Tổng chi phí vận hành: ${formatCurrency(executive.tcoTotal)}`,
        `Chi phí vận hành/km: ${executive.tcoPerKm ? formatCurrency(executive.tcoPerKm) : '—'}`,
        `Dự báo ${executive.forecastLabel}: ${executive.forecastNextMonth ? formatCurrency(executive.forecastNextMonth) : 'Chưa đủ dữ liệu'}`,
      ] : []),
      `Sự cố: ${report.incidents.length} (${report.seriousIncidents} nghiêm trọng)`,
      topVehicle ? `Xe vận hành nhiều nhất: ${topVehicle.vehicle.plate_number} – ${topVehicle.trips} chuyến` : '',
    ].filter(Boolean).join('\n')
    navigator.clipboard?.writeText(text).catch(() => undefined)
  }

  const maxTrendCost = Math.max(...report.trend.map((item) => item.cost), 1)

  return <>
    <section className="report-filter-card">
      <div className="report-filter-heading">
        <div><span>BÁO CÁO VẬN HÀNH</span><h2>Phân tích vận hành đội xe</h2><p>Chọn kỳ báo cáo để xem hiệu quả vận hành, chi phí và các điểm cần chú ý.</p></div>
        <div className="report-export-actions"><button className="secondary-button compact" onClick={copySummary}>⧉ Sao chép</button><button className="secondary-button compact" onClick={() => window.print()}>⎙ In / PDF</button><button className="primary-button compact" onClick={exportCsv}>⇩ CSV</button></div>
      </div>
      <div className="report-period-tabs">{(Object.keys(PERIOD_LABELS) as PeriodMode[]).map((item) => <button type="button" className={mode === item ? 'active' : ''} key={item} onClick={() => selectMode(item)}>{PERIOD_LABELS[item]}</button>)}</div>
      {mode === 'custom' ? <div className="report-date-controls custom"><label>Từ ngày<VietnamDateInput value={customFrom} onChange={setCustomFrom} /></label><label>Đến ngày<VietnamDateInput value={customTo} onChange={setCustomTo} /></label></div> : <div className="report-date-controls"><button type="button" className="report-period-arrow" onClick={() => movePeriod(-1)} aria-label="Kỳ trước">‹</button><label>Mốc thời gian<VietnamDateInput value={anchor} onChange={setAnchor} /></label><button type="button" className="report-period-arrow" onClick={() => movePeriod(1)} aria-label="Kỳ sau">›</button><button type="button" className="report-today-button" onClick={() => setAnchor(todayKey())}>Hôm nay</button></div>}
      <div className="report-range-strip"><span>Kỳ đang xem</span><strong>{range.label}</strong><small>Kỳ so sánh: {previous.label}</small></div>
    </section>

    <section className="report-kpis report-kpis-advanced">
      <article><span>Chuyến hoàn thành</span><strong>{report.trips.length}</strong><small>{report.completedRate.toFixed(0)}% chuyến trong kỳ đã hoàn tất</small></article>
      <article><span>Tổng kilomet</span><strong>{report.totalDistance.toLocaleString('vi-VN')} km</strong><small>{report.odometerCoverage.toFixed(0)}% chuyến có đủ KM đầu/cuối</small></article>
      <article><span>Tổng chi phí đã chi</span><strong>{formatCurrency(report.totalCost)}</strong><small>{report.expenses.length} chứng từ đã thanh toán</small></article>
      <article><span>Chi phí trung bình/km</span><strong>{report.costPerKm ? formatCurrency(report.costPerKm) : '—'}</strong><small>{report.totalFuelLiters ? `${report.totalFuelLiters.toFixed(1)} lít nhiên liệu` : 'Chưa có dữ liệu nhiên liệu'}</small></article>
    </section>

    <section className="report-comparison-panel">
      <div className="panel-header"><div><h2>So sánh với kỳ trước</h2><p>Nhận biết xu hướng tăng/giảm để điều hành nhanh hơn.</p></div></div>
      <div className="report-comparison-grid">{comparisons.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small className={item.delta.tone}>{item.delta.text}</small></article>)}</div>
    </section>

    {canViewExecutiveReport && <>
    <section className="executive-report-shell">
      <div className="executive-report-header">
        <div><span>BÁO CÁO BAN GIÁM ĐỐC</span><h2>Chi phí vận hành, dự báo & khuyến nghị điều hành</h2><p>Tóm tắt quản trị từ dữ liệu thực tế. Dự báo sử dụng trung bình có trọng số 3 tháng gần nhất, không gọi API AI.</p></div>
        <label className="executive-budget-field"><span>Ngân sách tháng tham chiếu</span><div><input inputMode="numeric" value={monthlyBudget || ''} onChange={(event) => updateMonthlyBudget(event.target.value)} placeholder="Ví dụ 25.000.000" /><b>đ</b></div><small>Lưu trên thiết bị này để thử nghiệm.</small></label>
      </div>

      <div className="executive-kpi-grid">
        <article><span>Tổng chi phí vận hành trong kỳ</span><strong>{formatCurrency(executive.tcoTotal)}</strong><small>Gồm chi phí đã thanh toán và chi phí bảo dưỡng chưa trùng chứng từ.</small></article>
        <article><span>Chi phí vận hành trên mỗi km</span><strong>{executive.tcoPerKm ? formatCurrency(executive.tcoPerKm) : '—'}</strong><small>Tính trên {report.totalDistance.toLocaleString('vi-VN')} km có đủ dữ liệu để đối soát.</small></article>
        <article className="forecast"><span>Dự báo {executive.forecastLabel}</span><strong>{executive.forecastNextMonth ? formatCurrency(executive.forecastNextMonth) : 'Chưa đủ dữ liệu'}</strong><small>Độ tin cậy: {executive.forecastConfidence}.</small></article>
        <article className={executive.periodBudget && executive.budgetVariance > 0 ? 'budget over' : 'budget'}><span>So với ngân sách tham chiếu</span><strong>{executive.periodBudget ? `${executive.budgetVariance > 0 ? '+' : ''}${formatCurrency(executive.budgetVariance)}` : 'Chưa thiết lập'}</strong><small>{executive.periodBudget ? `Đã sử dụng ${executive.budgetUsagePct.toFixed(0)}% ngân sách quy đổi cho kỳ.` : 'Nhập ngân sách tháng để theo dõi vượt/tiết kiệm.'}</small></article>
      </div>

      {executive.periodBudget > 0 && <div className="executive-budget-progress"><div><span>Tiến độ sử dụng ngân sách</span><strong>{executive.budgetUsagePct.toFixed(1)}%</strong></div><div className="executive-budget-track"><i style={{ width: `${Math.min(100, executive.budgetUsagePct)}%` }} /></div><small>{formatCurrency(executive.tcoTotal)} / {formatCurrency(executive.periodBudget)}</small></div>}

      <div className="executive-report-grid">
        <section className="executive-card"><div className="executive-card-heading"><div><span>NHẬN XÉT QUẢN TRỊ TỰ ĐỘNG</span><h3>Những điểm Ban Giám đốc cần chú ý</h3></div><b>{executive.narratives.length} ý</b></div><div className="executive-narratives">{executive.narratives.map((item) => <article className={item.tone} key={item.title}><strong>{item.title}</strong><p>{item.detail}</p></article>)}</div></section>

        <section className="executive-card"><div className="executive-card-heading"><div><span>DỰ BÁO CHI PHÍ</span><h3>3 tháng gần nhất → tháng kế tiếp</h3></div></div><div className="executive-forecast-list">{executive.forecastMonths.map((item) => <div key={item.key}><div><strong>{item.label}</strong><span>{item.partial ? 'Quy đổi đủ tháng' : 'Thực tế'}</span></div><b>{formatCurrency(item.normalized)}</b></div>)}<div className="forecast-next"><div><strong>{executive.forecastLabel}</strong><span>Dự báo</span></div><b>{executive.forecastNextMonth ? formatCurrency(executive.forecastNextMonth) : '—'}</b></div></div></section>
      </div>

      <section className="executive-tco-card"><div className="panel-header"><div><h2>Chi phí vận hành theo từng xe</h2><p>Tổng hợp chi phí trực tiếp và bảo dưỡng sau khi loại các trường hợp có khả năng nhập trùng chứng từ sửa chữa.</p></div><span className="count-pill">{executive.vehicleTco.length} xe</span></div><div className="table-wrap report-desktop-table"><table><thead><tr><th>Xe</th><th>Chi phí trực tiếp</th><th>Bảo dưỡng</th><th>Tổng chi phí vận hành</th><th>Km</th><th>Chi phí/km</th><th>Tỷ trọng</th></tr></thead><tbody>{executive.vehicleTco.map((item) => <tr key={item.vehicle.id}><td><strong>{item.vehicle.plate_number}</strong><small>{item.vehicle.vehicle_name}</small></td><td>{formatCurrency(item.directCost)}</td><td>{formatCurrency(item.maintenanceCost)}</td><td><strong>{formatCurrency(item.tco)}</strong></td><td>{item.distance.toLocaleString('vi-VN')}</td><td>{item.tcoPerKm ? formatCurrency(item.tcoPerKm) : '—'}</td><td>{item.share.toFixed(1)}%</td></tr>)}</tbody></table></div><div className="report-mobile-cards executive-mobile-tco">{executive.vehicleTco.map((item) => <article key={item.vehicle.id}><div className="report-card-title"><strong>{item.vehicle.plate_number}</strong><span>{item.share.toFixed(0)}% chi phí</span></div><small>{item.vehicle.vehicle_name}</small><div className="report-card-metrics"><span><b>{formatCurrency(item.tco)}</b>tổng chi phí</span><span><b>{item.distance.toLocaleString('vi-VN')} km</b>quãng đường</span><span><b>{item.tcoPerKm ? formatCurrency(item.tcoPerKm) : '—'}</b>/km</span><span><b>{formatCurrency(item.maintenanceCost)}</b>bảo dưỡng</span></div></article>)}</div></section>
    </section>
    </>}

    <div className="reports-layout advanced-reports-layout">
      <section className="panel report-insight-panel"><div className="panel-header"><div><h2>Điểm cần chú ý</h2><p>Tự động rút ra từ dữ liệu trong kỳ.</p></div><span className="count-pill">{report.insights.length}</span></div><div className="report-insight-list">{report.insights.map((item) => <div className={`report-insight ${item.tone}`} key={item.title}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></div>)}</div></section>

      <section className="panel"><div className="panel-header"><div><h2>Xu hướng vận hành</h2><p>Chi phí và số chuyến theo thời gian trong kỳ.</p></div></div><div className="report-trend-list">{report.trend.length ? report.trend.map((item) => <div className="report-trend-row" key={item.key}><div className="report-trend-label"><strong>{item.label}</strong><span>{item.trips} chuyến · {item.distance.toLocaleString('vi-VN')} km</span></div><div className="report-trend-track"><div style={{ width: `${Math.max(item.cost ? 6 : 0, item.cost / maxTrendCost * 100)}%` }} /></div><strong>{formatCurrency(item.cost)}</strong></div>) : <p className="muted">Chưa có dữ liệu trong kỳ.</p>}</div></section>

      <section className="panel"><div className="panel-header"><div><h2>Cơ cấu chi phí</h2><p>Khoản nào đang chiếm tỷ trọng lớn nhất.</p></div></div><div className="bar-chart">{report.expenseTypes.length ? report.expenseTypes.map((item) => <div className="bar-row" key={item.key}><div className="bar-label"><span>{item.label}</span><strong>{formatCurrency(item.total)}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(4, item.total / Math.max(report.maxExpenseType, 1) * 100)}%` }} /></div></div>) : <p className="muted">Chưa có chi phí đã thanh toán trong kỳ.</p>}</div></section>

      <section className="panel"><div className="panel-header"><div><h2>Điểm đến nhiều nhất</h2><p>Những khu vực/đơn vị phát sinh nhu cầu xe cao.</p></div></div><div className="report-ranking-list">{report.destinations.length ? report.destinations.map((item, index) => <div key={item.name}><span>{index + 1}</span><strong>{item.name}</strong><em>{item.count} chuyến</em></div>) : <p className="muted">Chưa có chuyến hoàn thành.</p>}</div></section>

      <section className="panel span-full"><div className="panel-header"><div><h2>Hiệu quả theo loại chuyến</h2><p>So sánh số chuyến, km và chi phí phục vụ từng hoạt động.</p></div></div><div className="table-wrap report-desktop-table"><table><thead><tr><th>Loại chuyến</th><th>Chuyến</th><th>Km</th><th>Chi phí</th><th>Chi phí/chuyến</th><th>Chi phí/km</th></tr></thead><tbody>{report.purpose.map((item) => <tr key={item.key}><td><strong>{item.label}</strong></td><td>{item.trips}</td><td>{item.distance.toLocaleString('vi-VN')}</td><td>{formatCurrency(item.cost)}</td><td>{item.trips ? formatCurrency(item.cost / item.trips) : '—'}</td><td>{item.distance ? formatCurrency(item.cost / item.distance) : '—'}</td></tr>)}</tbody></table></div><div className="report-mobile-cards">{report.purpose.map((item) => <article key={item.key}><strong>{item.label}</strong><div><span>{item.trips} chuyến</span><span>{item.distance.toLocaleString('vi-VN')} km</span></div><small>{formatCurrency(item.cost)} · {item.trips ? `${formatCurrency(item.cost / item.trips)}/chuyến` : '—'}</small></article>)}</div></section>

      <section className="panel span-full"><div className="panel-header"><div><h2>Hiệu quả từng xe</h2><p>Xếp hạng theo mức độ sử dụng, chi phí và tiêu hao nhiên liệu.</p></div></div><div className="table-wrap report-desktop-table"><table><thead><tr><th>Xe</th><th>Chuyến</th><th>Km</th><th>Chi phí</th><th>Chi phí/km</th><th>Tiêu hao thực tế</th><th>Sự cố</th></tr></thead><tbody>{report.vehicles.map((item) => <tr key={item.vehicle.id}><td><strong>{item.vehicle.plate_number}</strong><small>{item.vehicle.vehicle_name}</small></td><td>{item.trips}</td><td>{item.distance.toLocaleString('vi-VN')}</td><td>{formatCurrency(item.cost)}</td><td>{item.costPerKm ? formatCurrency(item.costPerKm) : '—'}</td><td><strong className={item.overFuelNorm ? 'danger-text' : ''}>{item.actualFuelRate ? `${item.actualFuelRate.toFixed(1)} L/100km` : '—'}</strong><small>Định mức: {item.vehicle.fuel_norm_l_per_100km ?? '—'}</small></td><td>{item.incidents}</td></tr>)}</tbody></table></div><div className="report-mobile-cards vehicle">{report.vehicles.map((item) => <article key={item.vehicle.id}><div className="report-card-title"><strong>{item.vehicle.plate_number}</strong><span>{item.trips} chuyến</span></div><small>{item.vehicle.vehicle_name}</small><div className="report-card-metrics"><span><b>{item.distance.toLocaleString('vi-VN')}</b> km</span><span><b>{formatCurrency(item.cost)}</b> chi phí</span><span><b>{item.costPerKm ? formatCurrency(item.costPerKm) : '—'}</b> /km</span><span><b className={item.overFuelNorm ? 'danger-text' : ''}>{item.actualFuelRate ? `${item.actualFuelRate.toFixed(1)} L` : '—'}</b> /100km</span></div></article>)}</div></section>

      <section className="panel span-full"><div className="panel-header"><div><h2>Hiệu quả tài xế</h2><p>Tổng hợp số chuyến, km, chi phí và sự cố theo tài xế.</p></div></div><div className="table-wrap report-desktop-table"><table><thead><tr><th>Tài xế</th><th>Chuyến</th><th>Km</th><th>Chi phí</th><th>Sự cố</th></tr></thead><tbody>{report.drivers.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.trips}</td><td>{item.distance.toLocaleString('vi-VN')}</td><td>{formatCurrency(item.cost)}</td><td><strong className={item.incidents ? 'warning-text' : ''}>{item.incidents}</strong></td></tr>)}</tbody></table></div><div className="report-mobile-cards">{report.drivers.map((item) => <article key={item.id}><div className="report-card-title"><strong>{item.name}</strong><span>{item.trips} chuyến</span></div><div className="report-card-metrics"><span><b>{item.distance.toLocaleString('vi-VN')}</b> km</span><span><b>{formatCurrency(item.cost)}</b> chi phí</span><span><b>{item.incidents}</b> sự cố</span></div></article>)}</div></section>
    </div>
  </>
}

function buildReport(data: AppData, range: DateRange): ReportData {
  const allTripsInRange = data.trips.filter((trip) => inRange(trip.ended_at ?? trip.scheduled_start, range))
  const trips = allTripsInRange.filter((trip) => trip.status === 'completed')
  const expenses = data.expenses.filter((expense) => inRange(expense.expense_date, range) && expense.status === 'paid')
  const incidents = data.incidents.filter((incident) => inRange(incident.created_at, range))
  const maintenances = data.maintenances.filter((item) => item.status === 'completed' && inRange(item.completed_date ?? item.scheduled_date ?? item.updated_at, range))

  const tripIds = new Set(trips.map((trip) => trip.id))
  const totalDistance = trips.reduce((sum, trip) => sum + Math.max(0, (trip.end_odometer ?? 0) - (trip.start_odometer ?? 0)), 0)
  const totalCost = expenses.reduce((sum, item) => sum + item.amount, 0)
  const totalFuelLiters = expenses.filter((item) => item.type === 'fuel').reduce((sum, item) => sum + (item.fuel_liters ?? 0), 0)
  const costPerKm = totalDistance ? totalCost / totalDistance : 0
  const seriousIncidents = incidents.filter((item) => item.severity === 'high' || item.severity === 'critical').length
  const maintenanceCost = maintenances.reduce((sum, item) => sum + (item.cost ?? 0), 0)
  const odometerCovered = trips.filter((trip) => trip.start_odometer != null && trip.end_odometer != null && trip.end_odometer >= trip.start_odometer).length
  const odometerCoverage = trips.length ? odometerCovered / trips.length * 100 : 0
  const completedRate = allTripsInRange.length ? trips.length / allTripsInRange.length * 100 : 0

  const purpose = (Object.keys(PURPOSE_LABELS) as TripPurpose[]).map((key) => {
    const purposeTrips = trips.filter((trip) => trip.purpose === key)
    const ids = new Set(purposeTrips.map((trip) => trip.id))
    const cost = expenses.filter((expense) => expense.trip_id && ids.has(expense.trip_id)).reduce((sum, expense) => sum + expense.amount, 0)
    const distance = purposeTrips.reduce((sum, trip) => sum + Math.max(0, (trip.end_odometer ?? 0) - (trip.start_odometer ?? 0)), 0)
    return { key, label: PURPOSE_LABELS[key], trips: purposeTrips.length, cost, distance }
  }).filter((item) => item.trips || item.cost).sort((a, b) => b.trips - a.trips || b.cost - a.cost)

  const vehicles = data.vehicles.map((vehicle) => {
    const vehicleTrips = trips.filter((trip) => trip.vehicle_id === vehicle.id)
    const vehicleTripIds = new Set(vehicleTrips.map((trip) => trip.id))
    const vehicleExpenses = expenses.filter((expense) => expense.vehicle_id === vehicle.id || (expense.trip_id && vehicleTripIds.has(expense.trip_id)))
    const cost = vehicleExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    const distance = vehicleTrips.reduce((sum, trip) => sum + Math.max(0, (trip.end_odometer ?? 0) - (trip.start_odometer ?? 0)), 0)
    const fuelLiters = vehicleExpenses.filter((expense) => expense.type === 'fuel').reduce((sum, expense) => sum + (expense.fuel_liters ?? 0), 0)
    const actualFuelRate = distance && fuelLiters ? fuelLiters / distance * 100 : 0
    const vehicleIncidents = incidents.filter((item) => item.vehicle_id === vehicle.id).length
    const overFuelNorm = Boolean(vehicle.fuel_norm_l_per_100km && actualFuelRate > vehicle.fuel_norm_l_per_100km * 1.2)
    return { vehicle, trips: vehicleTrips.length, cost, distance, costPerKm: distance ? cost / distance : 0, fuelLiters, actualFuelRate, incidents: vehicleIncidents, overFuelNorm }
  }).filter((item) => item.trips || item.cost || item.incidents).sort((a, b) => b.trips - a.trips || b.distance - a.distance)

  const drivers = data.profiles.filter((profile) => profile.role === 'driver' && profile.active).map((driver) => {
    const driverTrips = trips.filter((trip) => trip.driver_id === driver.id)
    const ids = new Set(driverTrips.map((trip) => trip.id))
    const driverExpenses = expenses.filter((expense) => expense.driver_id === driver.id || (expense.trip_id && ids.has(expense.trip_id)))
    return {
      id: driver.id,
      name: driver.full_name,
      trips: driverTrips.length,
      distance: driverTrips.reduce((sum, trip) => sum + Math.max(0, (trip.end_odometer ?? 0) - (trip.start_odometer ?? 0)), 0),
      cost: driverExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      incidents: incidents.filter((incident) => incident.driver_id === driver.id).length,
    }
  }).filter((item) => item.trips || item.cost || item.incidents).sort((a, b) => b.trips - a.trips || b.distance - a.distance)

  const destinationMap = new Map<string, number>()
  trips.forEach((trip) => destinationMap.set(trip.destination.trim() || 'Chưa rõ điểm đến', (destinationMap.get(trip.destination.trim() || 'Chưa rõ điểm đến') ?? 0) + 1))
  const destinations = [...destinationMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8)

  const expenseTypes = (Object.keys(EXPENSE_LABELS) as ExpenseType[]).map((key) => ({ key, label: EXPENSE_LABELS[key], total: expenses.filter((e) => e.type === key).reduce((sum, e) => sum + e.amount, 0) })).filter((item) => item.total).sort((a, b) => b.total - a.total)
  const maxExpenseType = Math.max(...expenseTypes.map((item) => item.total), 0)

  const trend = buildTrend(trips, expenses, range)
  const insights = buildInsights({ trips, vehicles, destinations, expenseTypes, incidents, seriousIncidents, totalCost, totalDistance, costPerKm, odometerCoverage, maintenanceCost })

  return { trips, expenses, incidents, maintenances, purpose, vehicles, drivers, destinations, expenseTypes, trend, insights, totalCost, totalDistance, totalFuelLiters, costPerKm, seriousIncidents, maintenanceCost, odometerCoverage, completedRate, maxExpenseType, tripIds }
}


function dayDistance(a: string, b: string) {
  const left = new Date(a).getTime()
  const right = new Date(b).getTime()
  if (!Number.isFinite(left) || !Number.isFinite(right)) return Number.POSITIVE_INFINITY
  return Math.abs(left - right) / 86_400_000
}

function maintenanceCostWithoutLikelyDuplicate(data: AppData, range: DateRange, vehicleId?: string) {
  const repairExpenses = data.expenses.filter((expense) => expense.status === 'paid' && expense.type === 'repair' && inRange(expense.expense_date, range) && (!vehicleId || expense.vehicle_id === vehicleId))
  return data.maintenances
    .filter((item) => item.status === 'completed' && inRange(item.completed_date ?? item.scheduled_date ?? item.updated_at, range) && (!vehicleId || item.vehicle_id === vehicleId))
    .reduce((sum, item) => {
      const cost = item.cost ?? 0
      if (!cost) return sum
      const date = item.completed_date ?? item.scheduled_date ?? item.updated_at
      const duplicated = repairExpenses.some((expense) => expense.vehicle_id === item.vehicle_id && Math.abs(expense.amount - cost) < 1 && dayDistance(expense.expense_date, date) <= 3)
      return sum + (duplicated ? 0 : cost)
    }, 0)
}

function monthRangeFrom(date: Date, offset = 0): DateRange {
  const start = startOfDay(new Date(date.getFullYear(), date.getMonth() + offset, 1))
  const end = endOfDay(new Date(date.getFullYear(), date.getMonth() + offset + 1, 0))
  const startKey = dateKey(start)
  const endKey = dateKey(end)
  return { start, end, startKey, endKey, label: `${formatDate(startKey)} – ${formatDate(endKey)}` }
}

function managementCostForRange(data: AppData, range: DateRange, vehicleId?: string) {
  const direct = data.expenses
    .filter((expense) => expense.status === 'paid' && inRange(expense.expense_date, range) && (!vehicleId || expense.vehicle_id === vehicleId))
    .reduce((sum, expense) => sum + expense.amount, 0)
  const maintenance = maintenanceCostWithoutLikelyDuplicate(data, range, vehicleId)
  return { direct, maintenance, total: direct + maintenance }
}

function buildExecutiveReport(data: AppData, range: DateRange, report: ReportData, previousReport: ReportData, monthlyBudget: number): ExecutiveReport {
  const management = managementCostForRange(data, range)
  const totalDistance = report.totalDistance
  const vehicleTcoRaw = data.vehicles.map((vehicle) => {
    const costs = managementCostForRange(data, range, vehicle.id)
    const distance = report.trips.filter((trip) => trip.vehicle_id === vehicle.id).reduce((sum, trip) => sum + Math.max(0, (trip.end_odometer ?? 0) - (trip.start_odometer ?? 0)), 0)
    return { vehicle, directCost: costs.direct, maintenanceCost: costs.maintenance, tco: costs.total, distance, tcoPerKm: distance ? costs.total / distance : 0, share: 0 }
  }).filter((item) => item.tco || item.distance)
  const vehicleTco = vehicleTcoRaw.map((item) => ({ ...item, share: management.total ? item.tco / management.total * 100 : 0 })).sort((a, b) => b.tco - a.tco || b.distance - a.distance)

  const baseMonth = new Date(range.end)
  const now = new Date()
  const forecastMonths: ForecastMonth[] = [-2, -1, 0].map((offset) => {
    const monthRange = monthRangeFrom(baseMonth, offset)
    const monthCosts = managementCostForRange(data, monthRange)
    const monthStart = monthRange.start
    const monthEnd = monthRange.end
    const isCurrentCalendarMonth = monthStart.getFullYear() === now.getFullYear() && monthStart.getMonth() === now.getMonth()
    const partial = isCurrentCalendarMonth && now < monthEnd
    const daysInMonth = monthEnd.getDate()
    const elapsedDays = partial ? Math.max(1, Math.min(daysInMonth, now.getDate())) : daysInMonth
    const normalized = partial ? monthCosts.total / elapsedDays * daysInMonth : monthCosts.total
    return {
      key: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      label: `Tháng ${String(monthStart.getMonth() + 1).padStart(2, '0')}/${monthStart.getFullYear()}`,
      actual: monthCosts.total,
      normalized,
      partial,
    }
  })
  const usable = forecastMonths.filter((item) => item.normalized > 0)
  const weights = [0.2, 0.3, 0.5]
  let weightedTotal = 0
  let weightTotal = 0
  forecastMonths.forEach((item, index) => {
    if (item.normalized > 0) { weightedTotal += item.normalized * weights[index]; weightTotal += weights[index] }
  })
  const forecastNextMonth = weightTotal ? weightedTotal / weightTotal : 0
  const nextMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1)
  const forecastLabel = `tháng ${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}`
  const forecastConfidence: ExecutiveReport['forecastConfidence'] = usable.length >= 3 ? 'Cao' : usable.length === 2 ? 'Trung bình' : 'Thấp'

  const inclusiveDays = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1)
  const periodBudget = monthlyBudget > 0 ? monthlyBudget * inclusiveDays / 30.4375 : 0
  const budgetUsagePct = periodBudget ? management.total / periodBudget * 100 : 0
  const budgetVariance = periodBudget ? management.total - periodBudget : 0
  const topConcentration = vehicleTco[0]?.share ?? 0

  const narratives: ExecutiveReport['narratives'] = []
  const previousManagement = previousReport.totalCost + previousReport.maintenanceCost
  if (previousManagement > 0 || management.total > 0) {
    const change = pctChange(management.total, previousManagement)
    narratives.push({
      title: change > 5 ? 'Tổng chi phí vận hành đang tăng' : change < -5 ? 'Tổng chi phí vận hành đang giảm' : 'Chi phí vận hành tương đối ổn định',
      detail: `Tổng chi phí vận hành là ${formatCurrency(management.total)}, ${change >= 0 ? 'tăng' : 'giảm'} ${Math.abs(change).toFixed(1)}% so với kỳ trước.`,
      tone: change > 15 ? 'warning' : change < -5 ? 'good' : 'info',
    })
  }
  if (vehicleTco[0]) narratives.push({
    title: `Xe ${vehicleTco[0].vehicle.plate_number} có chi phí vận hành cao nhất`,
    detail: `${formatCurrency(vehicleTco[0].tco)} · chiếm ${vehicleTco[0].share.toFixed(0)}% tổng chi phí vận hành của toàn đội trong kỳ${vehicleTco[0].tcoPerKm ? ` · bình quân ${formatCurrency(vehicleTco[0].tcoPerKm)}/km` : ''}.`,
    tone: vehicleTco[0].share > 55 ? 'warning' : 'info',
  })
  const fuelRisk = report.vehicles.filter((item) => item.overFuelNorm)
  if (fuelRisk.length) narratives.push({ title: 'Cần kiểm tra tiêu hao nhiên liệu', detail: `${fuelRisk.length} xe đang có mức L/100km cao hơn 120% định mức khai báo. Ưu tiên đối soát lốp, tải xe, lịch bảo dưỡng và chứng từ nhiên liệu.`, tone: 'warning' })
  if (report.seriousIncidents) narratives.push({ title: 'Rủi ro vận hành cần theo dõi', detail: `Có ${report.seriousIncidents} sự cố mức cao/nghiêm trọng trong kỳ. Nên rà lại nguyên nhân gốc và lịch bảo dưỡng của xe liên quan.`, tone: 'danger' })
  if (periodBudget) narratives.push({
    title: budgetVariance > 0 ? 'Đang vượt ngân sách tham chiếu' : 'Chi phí đang trong ngân sách tham chiếu',
    detail: `${budgetVariance > 0 ? 'Vượt' : 'Tiết kiệm'} ${formatCurrency(Math.abs(budgetVariance))}; mức sử dụng tương đương ${budgetUsagePct.toFixed(0)}% ngân sách quy đổi theo số ngày của kỳ.`,
    tone: budgetVariance > 0 ? 'danger' : 'good',
  })
  if (forecastNextMonth) narratives.push({ title: `Dự báo ${forecastLabel}`, detail: `Khoảng ${formatCurrency(forecastNextMonth)} theo trung bình có trọng số của 3 tháng gần nhất. Đây là dự báo quản trị tham khảo, không phải cam kết ngân sách.`, tone: 'info' })
  if (report.odometerCoverage < 90 && report.trips.length) narratives.push({ title: 'Chất lượng dữ liệu KM ảnh hưởng độ chính xác', detail: `Mới ${report.odometerCoverage.toFixed(0)}% chuyến hoàn thành có đủ KM đầu/cuối; chi phí vận hành/km và phân tích hiệu quả sẽ chính xác hơn khi tỷ lệ này đạt trên 90%.`, tone: 'warning' })
  if (!narratives.length) narratives.push({ title: 'Chưa đủ dữ liệu để kết luận', detail: 'Tiếp tục ghi nhận chuyến, kilomet, chi phí và bảo dưỡng để hệ thống tạo nhận xét quản trị đáng tin cậy hơn.', tone: 'info' })

  return {
    directCost: management.direct,
    maintenanceCost: management.maintenance,
    tcoTotal: management.total,
    tcoPerKm: totalDistance ? management.total / totalDistance : 0,
    vehicleTco,
    forecastMonths,
    forecastNextMonth,
    forecastLabel,
    forecastConfidence,
    periodBudget,
    budgetUsagePct,
    budgetVariance,
    topConcentration,
    narratives: narratives.slice(0, 6),
  }
}

function buildTrend(trips: Trip[], expenses: Expense[], range: DateRange): TrendItem[] {
  const days = Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / 86_400_000))
  const mode = days <= 31 ? 'day' : days <= 180 ? 'week' : 'month'
  const buckets = new Map<string, { key: string; label: string; trips: number; distance: number; cost: number }>()

  function bucketFor(value: string) {
    const date = new Date(value)
    if (mode === 'day') return { key: dateKey(date), label: formatDate(dateKey(date)) }
    if (mode === 'week') {
      const offset = (date.getDay() + 6) % 7
      const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset)
      return { key: dateKey(monday), label: `Tuần ${formatDate(dateKey(monday))}` }
    }
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    return { key, label: `Tháng ${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}` }
  }

  trips.forEach((trip) => {
    const point = bucketFor(trip.ended_at ?? trip.scheduled_start)
    const item = buckets.get(point.key) ?? { ...point, trips: 0, distance: 0, cost: 0 }
    item.trips += 1
    item.distance += Math.max(0, (trip.end_odometer ?? 0) - (trip.start_odometer ?? 0))
    buckets.set(point.key, item)
  })
  expenses.forEach((expense) => {
    const point = bucketFor(expense.expense_date)
    const item = buckets.get(point.key) ?? { ...point, trips: 0, distance: 0, cost: 0 }
    item.cost += expense.amount
    buckets.set(point.key, item)
  })
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-16)
}

function buildInsights(input: {
  trips: Trip[]
  vehicles: VehicleReport[]
  destinations: DestinationReport[]
  expenseTypes: ExpenseTypeReport[]
  incidents: AppData['incidents']
  seriousIncidents: number
  totalCost: number
  totalDistance: number
  costPerKm: number
  odometerCoverage: number
  maintenanceCost: number
}): InsightItem[] {
  const items: InsightItem[] = []
  const busiest = input.vehicles[0]
  if (busiest) items.push({ icon: '🚐', title: `Xe hoạt động nhiều: ${busiest.vehicle.plate_number}`, detail: `${busiest.trips} chuyến · ${busiest.distance.toLocaleString('vi-VN')} km trong kỳ.`, tone: 'info' })
  const topDestination = input.destinations[0]
  if (topDestination) items.push({ icon: '📍', title: `Điểm đến phát sinh nhiều nhất`, detail: `${topDestination.name}: ${topDestination.count} chuyến.`, tone: 'info' })
  const topExpense = input.expenseTypes[0]
  if (topExpense && input.totalCost) items.push({ icon: '💰', title: `Chi phí lớn nhất: ${topExpense.label}`, detail: `${formatCurrency(topExpense.total)} · chiếm ${(topExpense.total / input.totalCost * 100).toFixed(0)}% tổng chi phí.`, tone: topExpense.total / input.totalCost > .6 ? 'warning' : 'info' })
  const highFuel = input.vehicles.filter((item) => item.overFuelNorm)
  if (highFuel.length) items.push({ icon: '⛽', title: `${highFuel.length} xe tiêu hao vượt định mức`, detail: highFuel.map((item) => `${item.vehicle.plate_number}: ${item.actualFuelRate.toFixed(1)} L/100km`).join(' · '), tone: 'warning' })
  if (input.seriousIncidents) items.push({ icon: '⚠️', title: `${input.seriousIncidents} sự cố nghiêm trọng`, detail: 'Cần xem lại nguyên nhân, xử lý và lịch bảo dưỡng liên quan.', tone: 'danger' })
  if (input.odometerCoverage < 90 && input.trips.length) items.push({ icon: '🧾', title: 'Dữ liệu kilomet chưa đầy đủ', detail: `Chỉ ${input.odometerCoverage.toFixed(0)}% chuyến hoàn thành có đủ KM đầu và KM cuối.`, tone: 'warning' })
  if (!items.length) items.push({ icon: '✅', title: 'Vận hành trong kỳ đang ổn định', detail: 'Chưa phát hiện điểm bất thường nổi bật từ dữ liệu hiện có.', tone: 'good' })
  return items.slice(0, 6)
}
