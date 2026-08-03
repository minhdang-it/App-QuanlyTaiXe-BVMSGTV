import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { EXPENSE_LABELS, PURPOSE_LABELS } from '../lib/constants'
import { formatCurrency } from '../lib/utils'
import type { ExpenseType, TripPurpose } from '../types/models'

export function ReportsPage() {
  const { data } = useData()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  const report = useMemo(() => {
    const trips = data.trips.filter((trip) => trip.status === 'completed' && (trip.ended_at ?? trip.scheduled_start).slice(0, 7) === month)
    const expenses = data.expenses.filter((expense) => expense.expense_date.slice(0, 7) === month && expense.status !== 'rejected')
    const purpose = (Object.keys(PURPOSE_LABELS) as TripPurpose[]).map((key) => {
      const purposeTrips = trips.filter((trip) => trip.purpose === key)
      const ids = new Set(purposeTrips.map((trip) => trip.id))
      const cost = expenses.filter((expense) => expense.trip_id && ids.has(expense.trip_id)).reduce((sum, expense) => sum + expense.amount, 0)
      const distance = purposeTrips.reduce((sum, trip) => sum + Math.max(0, (trip.end_odometer ?? 0) - (trip.start_odometer ?? 0)), 0)
      return { key, label: PURPOSE_LABELS[key], trips: purposeTrips.length, cost, distance }
    }).filter((item) => item.trips || item.cost)
    const vehicles = data.vehicles.map((vehicle) => {
      const vehicleTrips = trips.filter((trip) => trip.vehicle_id === vehicle.id)
      const cost = expenses.filter((expense) => expense.vehicle_id === vehicle.id).reduce((sum, expense) => sum + expense.amount, 0)
      const distance = vehicleTrips.reduce((sum, trip) => sum + Math.max(0, (trip.end_odometer ?? 0) - (trip.start_odometer ?? 0)), 0)
      const fuelLiters = expenses.filter((expense) => expense.vehicle_id === vehicle.id && expense.type === 'fuel').reduce((sum, expense) => sum + (expense.fuel_liters ?? 0), 0)
      const actualFuelRate = distance && fuelLiters ? fuelLiters / distance * 100 : 0
      return { vehicle, trips: vehicleTrips.length, cost, distance, costPerKm: distance ? cost / distance : 0, fuelLiters, actualFuelRate }
    }).filter((item) => item.trips || item.cost)
    const expenseTypes = (Object.keys(EXPENSE_LABELS) as ExpenseType[]).map((key) => ({ key, label: EXPENSE_LABELS[key], total: expenses.filter((e) => e.type === key).reduce((sum, e) => sum + e.amount, 0) })).filter((item) => item.total)
    return { trips, expenses, purpose, vehicles, expenseTypes, totalCost: expenses.reduce((sum, e) => sum + e.amount, 0), totalDistance: trips.reduce((sum, t) => sum + Math.max(0, (t.end_odometer ?? 0) - (t.start_odometer ?? 0)), 0) }
  }, [data, month])

  function exportCsv() {
    const rows = [['Tháng', month], ['Tổng chuyến', String(report.trips.length)], ['Tổng km', String(report.totalDistance)], ['Tổng chi phí', String(report.totalCost)], [], ['Loại chuyến', 'Số chuyến', 'Km', 'Chi phí']]
    report.purpose.forEach((item) => rows.push([item.label, String(item.trips), String(item.distance), String(item.cost)]))
    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `Dieu-phoi-xe-BVMSGTV-Bao-cao-${month}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const maxCost = Math.max(...report.expenseTypes.map((item) => item.total), 1)

  return <>
    <section className="toolbar"><label className="month-filter">Tháng báo cáo<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label><button className="secondary-button" onClick={exportCsv}>⇩ XUẤT CSV</button></section>
    <section className="report-kpis"><article><span>Tổng chuyến hoàn thành</span><strong>{report.trips.length}</strong></article><article><span>Tổng kilomet</span><strong>{report.totalDistance.toLocaleString('vi-VN')} km</strong></article><article><span>Tổng chi phí</span><strong>{formatCurrency(report.totalCost)}</strong></article><article><span>Chi phí trung bình/km</span><strong>{report.totalDistance ? formatCurrency(report.totalCost / report.totalDistance) : '—'}</strong></article></section>
    <div className="reports-layout">
      <section className="panel"><div className="panel-header"><div><h2>Chi phí theo loại</h2><p>Cơ cấu chi phí trong tháng</p></div></div><div className="bar-chart">{report.expenseTypes.length ? report.expenseTypes.map((item) => <div className="bar-row" key={item.key}><div className="bar-label"><span>{item.label}</span><strong>{formatCurrency(item.total)}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(4, item.total / maxCost * 100)}%` }} /></div></div>) : <p className="muted">Chưa có chi phí trong tháng.</p>}</div></section>
      <section className="panel"><div className="panel-header"><div><h2>Hiệu quả theo loại chuyến</h2><p>Phân tích chi phí phục vụ hoạt động bệnh viện</p></div></div><div className="table-wrap"><table><thead><tr><th>Loại chuyến</th><th>Chuyến</th><th>Km</th><th>Chi phí</th><th>Chi phí/chuyến</th></tr></thead><tbody>{report.purpose.map((item) => <tr key={item.key}><td><strong>{item.label}</strong></td><td>{item.trips}</td><td>{item.distance.toLocaleString('vi-VN')}</td><td>{formatCurrency(item.cost)}</td><td>{item.trips ? formatCurrency(item.cost / item.trips) : '—'}</td></tr>)}</tbody></table></div></section>
      <section className="panel span-full"><div className="panel-header"><div><h2>Hiệu quả từng xe</h2><p>So sánh số chuyến, kilomet và chi phí vận hành</p></div></div><div className="table-wrap"><table><thead><tr><th>Xe</th><th>Số chuyến</th><th>Km vận hành</th><th>Chi phí</th><th>Chi phí/km</th><th>Tiêu hao thực tế</th></tr></thead><tbody>{report.vehicles.map((item) => <tr key={item.vehicle.id}><td><strong>{item.vehicle.plate_number}</strong><small>{item.vehicle.vehicle_name}</small></td><td>{item.trips}</td><td>{item.distance.toLocaleString('vi-VN')}</td><td>{formatCurrency(item.cost)}</td><td>{item.costPerKm ? formatCurrency(item.costPerKm) : '—'}</td><td><strong className={item.vehicle.fuel_norm_l_per_100km && item.actualFuelRate > item.vehicle.fuel_norm_l_per_100km * 1.2 ? 'danger-text' : ''}>{item.actualFuelRate ? `${item.actualFuelRate.toFixed(1)} L/100km` : '—'}</strong><small>Định mức: {item.vehicle.fuel_norm_l_per_100km ?? '—'}</small></td></tr>)}</tbody></table></div></section>
    </div>
  </>
}
