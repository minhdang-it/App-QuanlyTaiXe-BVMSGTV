import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/utils'

interface GpsSummary {
  trip_id: string
  vehicle_id: string
  started_at: string | null
  ended_at: string | null
  start_lat: number | null
  start_lng: number | null
  start_gps_at: string | null
  end_lat: number | null
  end_lng: number | null
  end_gps_at: string | null
  max_speed_kph: number | null
  max_speed_lat: number | null
  max_speed_lng: number | null
  max_speed_gps_at: string | null
  sample_count: number
  outlier_count: number
}
interface GpsSample {
  id: number
  gps_at: string
  latitude: number
  longitude: number
  speed_kph: number | null
}

function geoUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat.toFixed(6)},${lng.toFixed(6)}`)}`
}
function textDate(value: string | null): string { return value ? formatDateTime(value) : 'Chưa có dữ liệu' }
function LocationLine({ lat, lng, time, title }: { lat: number | null; lng: number | null; time: string | null; title: string }) {
  const valid = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
  return <div className="trip-gps-data-row">
    <span>{title}</span>
    <strong>{valid ? <a href={geoUrl(lat, lng)} target="_blank" rel="noopener noreferrer">{lat.toFixed(6)}, {lng.toFixed(6)} ↗</a> : 'Chưa có tọa độ xác thực'}</strong>
    <small>{textDate(time)}</small>
  </div>
}

export function TripGpsHistory({ vehicleId, plateNumber }: { vehicleId: string; plateNumber: string }) {
  const [records, setRecords] = useState<GpsSummary[]>([])
  const [samples, setSamples] = useState<GpsSample[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pointsLoading, setPointsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase) { setError('Chưa cấu hình Supabase.'); setLoading(false); return }
      setLoading(true)
      const { data, error: dbError } = await supabase.from('trip_gps_summaries')
        .select('trip_id,vehicle_id,started_at,ended_at,start_lat,start_lng,start_gps_at,end_lat,end_lng,end_gps_at,max_speed_kph,max_speed_lat,max_speed_lng,max_speed_gps_at,sample_count,outlier_count')
        .eq('vehicle_id', vehicleId).order('started_at', { ascending: false }).limit(20)
      if (cancelled) return
      if (dbError) setError('Không tải được nhật ký GPS. Kiểm tra migration v2.11.13 và quyền tài khoản.')
      else { setError(''); setRecords((data || []) as GpsSummary[]) }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [vehicleId])

  async function togglePoints(tripId: string) {
    if (tripId === expandedId) { setExpandedId(null); return }
    setExpandedId(tripId)
    setPointsLoading(true)
    setSamples([])
    if (!supabase) { setPointsLoading(false); return }
    const { data, error: err } = await supabase.from('trip_gps_samples')
      .select('id,gps_at,latitude,longitude,speed_kph')
      .eq('trip_id', tripId).order('gps_at', { ascending: false }).limit(150)
    if (err) setError('Không tải được danh sách mẫu GPS. Kiểm tra quyền xem của tài khoản.')
    else setSamples((data || []) as GpsSample[])
    setPointsLoading(false)
  }

  return <section className="trip-gps-history" aria-label={`Nhật ký GPS xe ${plateNumber}`}>
    <div className="trip-gps-intro">Dữ liệu do server ghi từ Navicom, không lấy GPS điện thoại tài xế. Thời gian theo định dạng DD/MM/YYYY HH:mm.</div>
    {loading && <p>Đang tải hành trình xe {plateNumber}...</p>}
    {error && <p className="trip-gps-error" role="alert">{error}</p>}
    {!loading && !error && records.length === 0 && <p className="trip-gps-empty">Chưa có nhật ký GPS. Các chuyến mới sẽ xuất hiện sau khi cài dịch vụ collector trên Ubuntu và có GPS hợp lệ.</p>}
    {records.map((record) => <article className="trip-gps-trip" key={record.trip_id}>
      <header className="trip-gps-trip-head"><div><strong>Chuyến {textDate(record.started_at)}</strong><small>{record.ended_at ? `Kết thúc ${textDate(record.ended_at)}` : 'Đang thực hiện'}</small></div><span>{record.sample_count} mẫu GPS</span></header>
      <div className="trip-gps-positions">
        <LocationLine title="Điểm bắt đầu" lat={record.start_lat} lng={record.start_lng} time={record.start_gps_at} />
        <LocationLine title="Điểm kết thúc" lat={record.end_lat} lng={record.end_lng} time={record.end_gps_at} />
        <div className="trip-gps-data-row trip-gps-maximum"><span>Tốc độ cao nhất ghi nhận</span><strong>{record.max_speed_kph == null ? 'Chưa có' : `${Number(record.max_speed_kph).toLocaleString('vi-VN')} km/h`}</strong>
          {record.max_speed_lat != null && record.max_speed_lng != null && <a href={geoUrl(record.max_speed_lat, record.max_speed_lng)} target="_blank" rel="noopener noreferrer">Vị trí {record.max_speed_lat.toFixed(6)}, {record.max_speed_lng.toFixed(6)} ↗</a>}
          <small>{textDate(record.max_speed_gps_at)}</small>
        </div>
      </div>
      {record.outlier_count > 0 && <p className="trip-gps-warning">Có {record.outlier_count} mẫu tốc độ trên 160 km/h. Đây là dữ liệu Navicom thô, cần đối chiếu trước khi kết luận.</p>}
      <button className="trip-gps-toggle" type="button" onClick={() => void togglePoints(record.trip_id)}>{expandedId === record.trip_id ? 'Thu gọn điểm GPS' : 'Xem các điểm GPS đã lưu'}</button>
      {expandedId === record.trip_id && <div className="trip-gps-samples">
        {pointsLoading ? <p>Đang tải điểm GPS...</p> : samples.length ? <>
          <p>Hiển thị tối đa 150 mẫu gần nhất của chuyến (toàn bộ mẫu vẫn lưu trên server).</p>
          {samples.map((p) => <div key={p.id} className="trip-gps-sample"><span>{formatDateTime(p.gps_at)}</span><strong>{p.speed_kph != null ? `${Number(p.speed_kph)} km/h` : '—'}</strong><a href={geoUrl(p.latitude, p.longitude)} target="_blank" rel="noopener noreferrer">Mở tọa độ ↗</a></div>)}
        </> : <p>Chưa có mẫu GPS chi tiết.</p>}
      </div>}
    </article>)}
    <p className="trip-gps-disclaimer">Vị trí đầu/cuối chỉ xác thực khi có mẫu GPS nằm trong 90 giây sau lúc bắt đầu hoặc 90 giây trước lúc kết thúc. Tốc độ là số liệu thiết bị Navicom ghi nhận, không tự động kết luận vi phạm giới hạn tốc độ đường bộ.</p>
  </section>
}
