const labels: Record<string, string> = {
  assigned: 'Đã giao', accepted: 'Đã nhận', ready: 'Sẵn sàng', active: 'Đang chạy', completed: 'Hoàn thành', cancelled: 'Đã hủy',
  available: 'Đang trống', in_use: 'Đang chạy', maintenance: 'Đang sửa', out_of_service: 'Ngừng dùng',
  pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', paid: 'Đã thanh toán',
  reported: 'Mới báo', handling: 'Đang xử lý', resolved: 'Đã xử lý',
  scheduled: 'Đã lên lịch', in_progress: 'Đang thực hiện',
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>
}
