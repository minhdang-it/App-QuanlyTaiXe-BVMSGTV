import { useData } from '../context/DataContext'

export function NetworkBanner() {
  const { online, pending } = useData()
  if (online && pending === 0) return null
  return (
    <div className={`network-banner ${online ? 'syncing' : 'offline'}`}>
      {online ? `Đang chờ đồng bộ ${pending} thao tác` : `Mất mạng — dữ liệu mới sẽ được lưu tạm${pending ? ` (${pending})` : ''}`}
    </div>
  )
}
