import { useState } from 'react'
import { useData } from '../context/DataContext'

export function NetworkBanner() {
  const { online, pending, syncNow } = useData()
  const [syncing, setSyncing] = useState(false)
  if (online && pending === 0) return null

  async function sync() {
    if (!online || syncing) return
    setSyncing(true)
    try { await syncNow() } finally { setSyncing(false) }
  }

  return (
    <div className={`network-banner ${online ? 'syncing' : 'offline'}`}>
      <span>{online ? `${syncing ? 'Đang đồng bộ' : 'Chờ đồng bộ'} ${pending} thao tác` : `Mất mạng — dữ liệu mới sẽ được lưu tạm${pending ? ` (${pending})` : ''}`}</span>
      {online && pending > 0 && <button type="button" onClick={() => void sync()} disabled={syncing}>{syncing ? 'Đang gửi...' : 'Đồng bộ ngay'}</button>}
    </div>
  )
}
