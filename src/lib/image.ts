export interface ImageOptimizeOptions {
  maxDimension?: number
  quality?: number
  maxBytes?: number
}

async function decodeImage(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      // Một số trình duyệt không giải mã được HEIC/HEIF bằng createImageBitmap.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return { source: image, width: image.naturalWidth, height: image.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Không thể xử lý ảnh chụp.')), type, quality)
  })
}

export async function optimizeCapturedImage(file: File, options: ImageOptimizeOptions = {}): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  const maxDimension = options.maxDimension ?? 1600
  const quality = options.quality ?? 0.76
  const maxBytes = options.maxBytes ?? 1_500_000

  try {
    const decoded = await decodeImage(file)
    const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height))
    const width = Math.max(1, Math.round(decoded.width * scale))
    const height = Math.max(1, Math.round(decoded.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Thiết bị không hỗ trợ xử lý ảnh.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(decoded.source, 0, 0, width, height)
    decoded.close?.()

    let currentQuality = quality
    let blob = await canvasToBlob(canvas, 'image/jpeg', currentQuality)
    while (blob.size > maxBytes && currentQuality > 0.48) {
      currentQuality -= 0.08
      blob = await canvasToBlob(canvas, 'image/jpeg', currentQuality)
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'anh-chup'
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    // Nếu trình duyệt không giải mã được định dạng ảnh, vẫn giữ tệp gốc để người dùng có thể gửi.
    return file
  }
}

export async function buildOdometerOcrImage(file: File): Promise<Blob> {
  const decoded = await decodeImage(file)
  const maxWidth = 1800
  const scale = Math.min(2, maxWidth / Math.max(1, decoded.width))
  const width = Math.max(1, Math.round(decoded.width * scale))
  const height = Math.max(1, Math.round(decoded.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Thiết bị không hỗ trợ xử lý ảnh OCR.')
  context.drawImage(decoded.source, 0, 0, width, height)
  decoded.close?.()

  const image = context.getImageData(0, 0, width, height)
  const values: number[] = []
  let total = 0
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.round(image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114)
    total += value
    if ((i / 4) % 20 === 0) values.push(value)
  }
  values.sort((a, b) => a - b)
  const low = values[Math.floor(values.length * 0.08)] ?? 0
  const high = values[Math.floor(values.length * 0.92)] ?? 255
  const mean = total / Math.max(1, image.data.length / 4)
  const invert = mean < 115
  const range = Math.max(30, high - low)

  for (let i = 0; i < image.data.length; i += 4) {
    let value = Math.round(image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114)
    value = Math.max(0, Math.min(255, ((value - low) * 255) / range))
    if (invert) value = 255 - value
    // Tăng tương phản nhưng vẫn giữ các nét của màn hình LCD/LED.
    value = value < 72 ? 0 : value > 196 ? 255 : Math.round((value - 72) * (255 / 124))
    image.data[i] = value
    image.data[i + 1] = value
    image.data[i + 2] = value
    image.data[i + 3] = 255
  }
  context.putImageData(image, 0, 0)
  return await canvasToBlob(canvas, 'image/png', 1)
}
