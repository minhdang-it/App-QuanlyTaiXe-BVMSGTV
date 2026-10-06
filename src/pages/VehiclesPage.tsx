import { useState } from 'react'
import { Icon } from '../components/Icon'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { VEHICLE_STATUS_LABELS } from '../lib/constants'
import { daysUntil, formatDate } from '../lib/utils'
import type { Vehicle, VehicleStatus } from '../types/models'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { VietnamDateInput } from '../components/VietnamDateInput'
import { NavicomMonitor } from '../components/NavicomMonitor'
import { fetchNavicomAccountVehicles, type NavicomAccountVehicle } from '../lib/navicom'

export function VehiclesPage() {
  const { data } = useData()
  const { user } = useAuth()
  const canManage = ['dispatcher', 'fleet', 'admin'].includes(user!.profile.role)
  const [selected, setSelected] = useState<Vehicle | null>(null)
  const [creating, setCreating] = useState(false)
  const [assigning, setAssigning] = useState<Vehicle | null>(null)

  return <>
    <section className="toolbar">
      <div>
        <strong>{data.vehicles.length} xe trong hệ thống</strong>
        <p className="toolbar-note">Theo dõi kilomet, giấy tờ, hình ảnh xe và tình trạng sử dụng trên giao diện tối ưu cho điện thoại.</p>
      </div>
      {canManage && <button className="primary-button" onClick={() => setCreating(true)}><Icon name="plus" size={16} />Thêm xe</button>}
    </section>

    {data.vehicles.length ? <section className="vehicle-grid">{data.vehicles.map((vehicle) => {
      const driver = data.profiles.find((p) => p.id === vehicle.regular_driver_id)
      const regDays = daysUntil(vehicle.registration_expiry)
      const insuranceDays = daysUntil(vehicle.insurance_expiry)
      const roadFeeDays = daysUntil(vehicle.road_fee_expiry)
      const oilDays = daysUntil(vehicle.next_oil_change_date)
      const fuelNorm = vehicle.fuel_norm_l_per_100km ? `${vehicle.fuel_norm_l_per_100km} L/100km` : '—'

      return <article className="vehicle-card" key={vehicle.id} onClick={() => setSelected(vehicle)}>
        <div className="vehicle-photo">
          {vehicle.image_url
            ? <img src={vehicle.image_url} alt={vehicle.plate_number} />
            : <div className="vehicle-photo-placeholder"><Icon name="vehicle" size={40} strokeWidth={1.4} /><small>Chưa có ảnh xe</small></div>}
          <div className="vehicle-photo-overlay" />
          <div className="vehicle-photo-top">
            <span className="vehicle-chip">{vehicle.seats} chỗ</span>
            <StatusBadge status={vehicle.status} />
          </div>
          <div className="vehicle-photo-bottom">
            <h2 className="plate">{vehicle.plate_number}</h2>
            <p>{vehicle.vehicle_name}</p>
          </div>
        </div>

        <div className="vehicle-body">
          <div className="vehicle-subline">{vehicle.vehicle_type || 'Chưa cập nhật loại xe'}</div>

          <div className="vehicle-km vehicle-km-compact">
            <div>
              <span>KM hiện tại</span>
              <strong>{vehicle.odometer.toLocaleString('vi-VN')}</strong>
            </div>
            <div className="vehicle-km-side">
              <span>Định mức</span>
              <strong>{fuelNorm}</strong>
            </div>
          </div>

          <div className="vehicle-meta-grid">
            <div className="vehicle-meta-card">
              <span>Đăng kiểm</span>
              <strong className={regDays !== null && regDays <= 30 ? 'warning-text' : ''}>{formatDate(vehicle.registration_expiry)}</strong>
            </div>
            <div className="vehicle-meta-card">
              <span>Bảo hiểm TNDS</span>
              <strong className={insuranceDays !== null && insuranceDays <= 30 ? 'warning-text' : ''}>{formatDate(vehicle.insurance_expiry)}</strong>
            </div>
            <div className="vehicle-meta-card">
              <span>Phí đường bộ</span>
              <strong className={roadFeeDays !== null && roadFeeDays <= 30 ? 'warning-text' : ''}>{formatDate(vehicle.road_fee_expiry)}</strong>
            </div>
            <div className="vehicle-meta-card">
              <span>Thay nhớt kế tiếp</span>
              <strong className={oilDays !== null && oilDays <= 30 ? 'warning-text' : ''}>{formatDate(vehicle.next_oil_change_date)}</strong>
            </div>
          </div>

          <div className="vehicle-driver-row">
            <div className="vehicle-driver">
              <span><Icon name="user" size={16} /></span>
              <div>
                <small>Tài xế thường xuyên</small>
                <strong>{driver?.full_name ?? 'Chưa gán tài xế'}</strong>
              </div>
            </div>
            <div className="vehicle-card-actions">
              {canManage && <button
                type="button"
                className="vehicle-assign-button"
                onClick={(event) => {
                  event.stopPropagation()
                  setAssigning(vehicle)
                }}
              >
                {driver ? 'Đổi tài xế' : 'Gán tài xế'}
              </button>}
              <span className="vehicle-open-link">Xem hồ sơ<Icon name="chevron-right" size={14} /></span>
            </div>
          </div>
        </div>
      </article>
    })}</section> : <EmptyState icon="vehicle" title="Chưa có hồ sơ xe" />}

    {selected && <VehicleDetail vehicle={selected} canManage={canManage} onClose={() => setSelected(null)} />}
    {creating && <VehicleForm onClose={() => setCreating(false)} />}
    {assigning && <AssignDriverModal vehicle={assigning} onClose={() => setAssigning(null)} />}
  </>
}

function AssignDriverModal({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { data, updateVehicle } = useData()
  const drivers = data.profiles
    .filter((profile) => profile.role === 'driver' && (profile.active || profile.id === vehicle.regular_driver_id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
  const [driverId, setDriverId] = useState(vehicle.regular_driver_id ?? '')
  const [saving, setSaving] = useState(false)
  return <Modal title={`Gán tài xế cho xe ${vehicle.plate_number}`} onClose={onClose}>
    <form className="assign-driver-form" onSubmit={async (event) => {
      event.preventDefault()
      setSaving(true)
      try {
        await updateVehicle(vehicle.id, { regular_driver_id: driverId || null })
        onClose()
      } finally {
        setSaving(false)
      }
    }}>
      <div className="assign-driver-vehicle">
        <span><Icon name="vehicle" size={20} /></span>
        <div><strong className="plate">{vehicle.plate_number}</strong><small>{vehicle.vehicle_name} · {vehicle.vehicle_type}</small></div>
      </div>
      <label>Tài xế thường xuyên
        <select value={driverId} onChange={(event) => setDriverId(event.target.value)}>
          <option value="">— Chưa gán tài xế —</option>
          {drivers.map((driver) => <option key={driver.id} value={driver.id}>
            {driver.full_name}{driver.phone ? ` · ${driver.phone}` : ''}
          </option>)}
        </select>
      </label>
      {!drivers.length && <p className="assign-driver-empty">Chưa có tài khoản nào mang vai trò Tài xế. Hãy tạo tài khoản tài xế trước trong mục Tài khoản.</p>}
      <p className="assign-driver-note">Tài xế thường xuyên là người phụ trách mặc định của xe. Khi tạo chuyến, Điều phối vẫn có thể chọn một tài xế khác.</p>
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={onClose}>Hủy</button>
        <button className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu tài xế'}</button>
      </div>
    </form>
  </Modal>
}

function VehicleDetail({ vehicle, canManage, onClose }: { vehicle: Vehicle; canManage: boolean; onClose: () => void }) {
  const { data, updateVehicle } = useData()
  const [editing, setEditing] = useState(false)
  const history = data.trips.filter((t) => t.vehicle_id === vehicle.id && t.status === 'completed')
  const expenses = data.expenses.filter((e) => e.vehicle_id === vehicle.id)
  const maintenances = data.maintenances.filter((m) => m.vehicle_id === vehicle.id)

  return (
    <Modal title={`Hồ sơ xe ${vehicle.plate_number}`} onClose={onClose} wide>
      {editing
        ? <VehicleFields
            initial={vehicle}
            submitLabel="Lưu thay đổi"
            onCancel={() => setEditing(false)}
            onSubmit={async (values) => {
              await updateVehicle(vehicle.id, values)
              setEditing(false)
              onClose()
            }}
          />
        : <>
            <div className="vehicle-detail-header vehicle-detail-hero">
              <div className="vehicle-detail-media">
                {vehicle.image_url
                  ? <img src={vehicle.image_url} alt={vehicle.plate_number} />
                  : <div className="large-vehicle-icon"><Icon name="vehicle" size={44} strokeWidth={1.4} /></div>}
              </div>
              <div>
                <h2>{vehicle.vehicle_name}</h2>
                <p>{vehicle.plate_number} · {vehicle.vehicle_type} · {vehicle.seats} chỗ</p>
                <StatusBadge status={vehicle.status} />
              </div>
              {canManage && <button className="secondary-button" onClick={() => setEditing(true)}>Chỉnh sửa</button>}
            </div>

            <div className="detail-grid">
              <div><span>Kilomet hiện tại</span><strong>{vehicle.odometer.toLocaleString('vi-VN')} km</strong></div>
              <div><span>Định mức nhiên liệu</span><strong>{vehicle.fuel_norm_l_per_100km ?? '—'} L/100km</strong></div>
              <div><span>Đăng kiểm</span><strong>{formatDate(vehicle.registration_expiry)}</strong></div>
              <div><span>Bảo hiểm TNDS</span><strong>{formatDate(vehicle.insurance_expiry)}</strong></div>
              <div><span>Phí sử dụng đường bộ</span><strong>{formatDate(vehicle.road_fee_expiry)}</strong></div>
              <div><span>Thay nhớt gần nhất</span><strong>{formatDate(vehicle.last_oil_change_date)}{vehicle.last_oil_change_odometer ? ` · ${vehicle.last_oil_change_odometer.toLocaleString('vi-VN')} km` : ''}</strong></div>
              <div><span>Thay nhớt kế tiếp</span><strong>{formatDate(vehicle.next_oil_change_date)}{vehicle.next_oil_change_odometer ? ` · ${vehicle.next_oil_change_odometer.toLocaleString('vi-VN')} km` : ''}</strong></div>
              <div><span>Bảo dưỡng kế tiếp</span><strong>{formatDate(vehicle.next_maintenance_date)}</strong></div>
              <div><span>Mốc KM bảo dưỡng</span><strong>{vehicle.next_maintenance_odometer?.toLocaleString('vi-VN') ?? '—'}</strong></div>
            </div>

            <section className="vehicle-navicom-section">
              <div className="section-title-row"><h3>Camera & GPS Navicom</h3><span className={`navicom-link-chip ${vehicle.navicom_enabled ? 'enabled' : ''}`}>{vehicle.navicom_enabled ? 'Đã liên kết' : 'Chưa liên kết'}</span></div>
              <NavicomMonitor vehicle={vehicle} />
            </section>

            <div className="mini-stats">
              <div><strong>{history.length}</strong><span>Chuyến hoàn thành</span></div>
              <div><strong>{expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('vi-VN')}đ</strong><span>Tổng chi phí ghi nhận</span></div>
              <div><strong>{maintenances.length}</strong><span>Lần bảo dưỡng/sửa chữa</span></div>
            </div>

            {vehicle.notes && <div className="note-box"><strong>Ghi chú</strong><p>{vehicle.notes}</p></div>}
          </>}
    </Modal>
  )
}

function VehicleForm({ onClose }: { onClose: () => void }) {
  const { createVehicle } = useData()
  return <Modal title="Thêm hồ sơ xe" onClose={onClose} wide><VehicleFields submitLabel="THÊM XE" onCancel={onClose} onSubmit={async (values) => { await createVehicle(values); onClose() }} /></Modal>
}

function VehicleFields({ initial, onSubmit, onCancel, submitLabel }: { initial?: Vehicle; onSubmit: (values: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>) => Promise<void>; onCancel: () => void; submitLabel: string }) {
  const { data } = useData()
  const drivers = data.profiles
    .filter((profile) => profile.role === 'driver' && (profile.active || profile.id === initial?.regular_driver_id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
  const [form, setForm] = useState({
    plate_number: initial?.plate_number ?? '', vehicle_name: initial?.vehicle_name ?? '', vehicle_type: initial?.vehicle_type ?? 'Xe 7 chỗ', seats: String(initial?.seats ?? 7),
    status: initial?.status ?? 'available' as VehicleStatus, odometer: String(initial?.odometer ?? 0), image_url: initial?.image_url ?? '', regular_driver_id: initial?.regular_driver_id ?? '',
    registration_expiry: initial?.registration_expiry ?? '', insurance_expiry: initial?.insurance_expiry ?? '', road_fee_expiry: initial?.road_fee_expiry ?? '',
    last_oil_change_date: initial?.last_oil_change_date ?? '', last_oil_change_odometer: String(initial?.last_oil_change_odometer ?? ''), next_oil_change_date: initial?.next_oil_change_date ?? '', next_oil_change_odometer: String(initial?.next_oil_change_odometer ?? ''), next_maintenance_date: initial?.next_maintenance_date ?? '',
    next_maintenance_odometer: String(initial?.next_maintenance_odometer ?? ''), fuel_norm_l_per_100km: String(initial?.fuel_norm_l_per_100km ?? ''),
    navicom_enabled: Boolean(initial?.navicom_enabled), navicom_device_id: initial?.navicom_device_id ?? '', navicom_channel_count: '2', navicom_notes: initial?.navicom_notes ?? '',
    notes: initial?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [navicomVehicles, setNavicomVehicles] = useState<NavicomAccountVehicle[]>([])
  const [navicomLoading, setNavicomLoading] = useState(false)
  const [navicomError, setNavicomError] = useState<string | null>(null)

  async function loadNavicomVehicles() {
    setNavicomLoading(true)
    setNavicomError(null)
    try {
      const result = await fetchNavicomAccountVehicles()
      setNavicomVehicles(result.vehicles ?? [])
      if (!(result.vehicles ?? []).length) setNavicomError('Tài khoản Navicom chưa trả về danh sách xe qua API.')
    } catch (error) {
      setNavicomError(error instanceof Error ? error.message : String(error))
    } finally {
      setNavicomLoading(false)
    }
  }

  function selectNavicomVehicle(deviceId: string) {
    const selected = navicomVehicles.find((item) => item.device_id === deviceId)
    setForm((current) => ({
      ...current,
      navicom_enabled: Boolean(deviceId),
      navicom_device_id: deviceId,
      navicom_channel_count: '2',
      navicom_notes: selected ? [selected.plate_number, selected.vehicle_name].filter(Boolean).join(' · ') : current.navicom_notes,
    }))
  }

  return <form className="form-grid" onSubmit={async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSubmit({
        ...form,
        image_url: form.image_url || null,
        regular_driver_id: form.regular_driver_id || null,
        seats: Number(form.seats),
        odometer: Number(form.odometer),
        next_maintenance_odometer: form.next_maintenance_odometer ? Number(form.next_maintenance_odometer) : null,
        fuel_norm_l_per_100km: form.fuel_norm_l_per_100km ? Number(form.fuel_norm_l_per_100km) : null,
        registration_expiry: form.registration_expiry || null,
        insurance_expiry: form.insurance_expiry || null,
        road_fee_expiry: form.road_fee_expiry || null,
        last_oil_change_date: form.last_oil_change_date || null,
        last_oil_change_odometer: form.last_oil_change_odometer ? Number(form.last_oil_change_odometer) : null,
        next_oil_change_date: form.next_oil_change_date || null,
        next_oil_change_odometer: form.next_oil_change_odometer ? Number(form.next_oil_change_odometer) : null,
        next_maintenance_date: form.next_maintenance_date || null,
        navicom_enabled: form.navicom_enabled,
        navicom_device_id: form.navicom_device_id.trim() || null,
        navicom_channel_count: form.navicom_enabled ? 2 : null,
        navicom_notes: form.navicom_notes.trim() || null,
      })
    } finally {
      setSaving(false)
    }
  }}>
    <label>Biển số<input value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value.toUpperCase() })} required /></label>
    <label>Tên xe<input value={form.vehicle_name} onChange={(e) => setForm({ ...form, vehicle_name: e.target.value })} placeholder="Toyota Innova" required /></label>
    <label>Loại xe<input value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} /></label>
    <label>Số chỗ<input type="number" min="1" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></label>
    <label>Trạng thái<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as VehicleStatus })}>{(Object.keys(VEHICLE_STATUS_LABELS) as VehicleStatus[]).map((key) => <option key={key} value={key}>{VEHICLE_STATUS_LABELS[key]}</option>)}</select></label>
    <label>KM hiện tại<input type="number" min="0" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} /></label>
    <label>Tài xế thường xuyên<select value={form.regular_driver_id ?? ''} onChange={(e) => setForm({ ...form, regular_driver_id: e.target.value })}><option value="">— Chưa gán tài xế —</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.full_name} · {driver.phone}</option>)}</select></label>
    <label>Hạn đăng kiểm<VietnamDateInput value={form.registration_expiry} onChange={(value) => setForm({ ...form, registration_expiry: value })} /></label>
    <label>Hạn bảo hiểm TNDS<VietnamDateInput value={form.insurance_expiry} onChange={(value) => setForm({ ...form, insurance_expiry: value })} /></label>
    <label>Hạn phí sử dụng đường bộ<VietnamDateInput value={form.road_fee_expiry} onChange={(value) => setForm({ ...form, road_fee_expiry: value })} /></label>
    <label>Ngày thay nhớt gần nhất<VietnamDateInput value={form.last_oil_change_date} onChange={(value) => setForm({ ...form, last_oil_change_date: value })} /></label>
    <label>KM thay nhớt gần nhất<input type="number" min="0" value={form.last_oil_change_odometer} onChange={(e) => setForm({ ...form, last_oil_change_odometer: e.target.value })} /></label>
    <label>Ngày thay nhớt kế tiếp<VietnamDateInput value={form.next_oil_change_date} onChange={(value) => setForm({ ...form, next_oil_change_date: value })} /></label>
    <label>Mốc KM thay nhớt kế tiếp<input type="number" min="0" value={form.next_oil_change_odometer} onChange={(e) => setForm({ ...form, next_oil_change_odometer: e.target.value })} /></label>
    <label>Ngày bảo dưỡng kế tiếp<VietnamDateInput value={form.next_maintenance_date} onChange={(value) => setForm({ ...form, next_maintenance_date: value })} /></label>
    <label>Mốc KM bảo dưỡng<input type="number" min="0" value={form.next_maintenance_odometer} onChange={(e) => setForm({ ...form, next_maintenance_odometer: e.target.value })} /></label>
    <label>Định mức L/100km<input type="number" min="0" step="0.1" value={form.fuel_norm_l_per_100km} onChange={(e) => setForm({ ...form, fuel_norm_l_per_100km: e.target.value })} /></label>
    <div className="form-section-title span-2"><strong>Tích hợp Navicom</strong><small>Tài khoản Navicom hiện có 2 xe; mỗi xe cố định 2 kênh: Camera trước và Camera cabin.</small></div>
    <label className="navicom-toggle-field"><span>Kích hoạt Navicom</span><input type="checkbox" checked={form.navicom_enabled} onChange={(e) => setForm({ ...form, navicom_enabled: e.target.checked, navicom_channel_count: '2' })} /></label>
    <div className="navicom-account-picker">
      <button type="button" className="secondary-button compact" onClick={() => void loadNavicomVehicles()} disabled={navicomLoading}>{navicomLoading ? 'Đang lấy xe...' : 'Lấy 2 xe từ tài khoản Navicom'}</button>
      {navicomVehicles.length > 0 && <select value={form.navicom_device_id} onChange={(e) => selectNavicomVehicle(e.target.value)}><option value="">— Chọn xe Navicom —</option>{navicomVehicles.map((item) => <option key={item.key} value={item.device_id ?? ''}>{item.plate_number || item.vehicle_name || 'Xe Navicom'} · {item.device_id || 'Chưa có Device ID'}</option>)}</select>}
      {navicomError && <small className="danger-text">{navicomError}</small>}
    </div>
    <label>Mã thiết bị / IMEI<input value={form.navicom_device_id} onChange={(e) => setForm({ ...form, navicom_device_id: e.target.value.trimStart(), navicom_channel_count: '2' })} placeholder="Device ID / IMEI" /></label>
    <label>Số kênh camera<input type="number" value="2" readOnly /><small>Camera trước + Camera cabin</small></label>
    <label>Ghi chú Navicom<input value={form.navicom_notes} onChange={(e) => setForm({ ...form, navicom_notes: e.target.value })} placeholder="Tên xe trên CMS, ghi chú thiết bị..." /></label>
    <label className="span-2">Ảnh xe (URL)<input value={form.image_url ?? ''} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://.../xe.jpg" /></label>
    {form.image_url && <div className="image-url-preview span-2"><img src={form.image_url} alt="Xem trước ảnh xe" /><span>Xem trước ảnh xe</span></div>}
    <label className="span-2">Ghi chú<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
    <div className="form-actions span-2"><button type="button" className="secondary-button" onClick={onCancel}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : submitLabel}</button></div>
  </form>
}
