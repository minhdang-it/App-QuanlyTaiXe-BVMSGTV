const url = 'http://127.0.0.1:3020/health'
try {
  const response = await fetch(url)
  const text = await response.text()
  console.log(`HTTP ${response.status}`)
  console.log(text)
  if (!response.ok) process.exit(1)
} catch (error) {
  console.error('[LOI] Khong ket noi duoc Navicom Gateway tai ' + url)
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
