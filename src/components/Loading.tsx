export function Loading({ label = 'Đang tải dữ liệu...' }: { label?: string }) {
  return <div className="loading-state"><div className="spinner" /><p>{label}</p></div>
}
