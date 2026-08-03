import { buildOdometerOcrImage } from './image'

export interface OdometerOcrResult {
  value: number | null
  confidence: number
  rawText: string
  candidates: number[]
}

type ProgressCallback = (progress: number, status: string) => void

let currentProgress: ProgressCallback = () => undefined
let workerPromise: Promise<import('tesseract.js').Worker> | null = null
let recognitionQueue: Promise<void> = Promise.resolve()

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: (message) => {
          const progress = typeof message.progress === 'number' ? message.progress : 0
          currentProgress(progress, String(message.status ?? 'Đang đọc ảnh'))
        },
      })
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      })
      return worker
    })()
  }
  return await workerPromise
}

function findCandidates(text: string) {
  const candidates = new Set<number>()
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    for (const match of line.matchAll(/\d{3,8}/g)) candidates.add(Number(match[0]))
    const compact = line.replace(/\D/g, '')
    if (compact.length >= 3 && compact.length <= 8) candidates.add(Number(compact))
  }
  const allCompact = text.replace(/\D/g, '')
  if (allCompact.length >= 3 && allCompact.length <= 8) candidates.add(Number(allCompact))
  return [...candidates].filter((value) => Number.isSafeInteger(value) && value >= 0)
}

function scoreCandidate(value: number, baseline: number) {
  const digits = String(value).length
  let score = 0
  if (digits >= 5 && digits <= 7) score += 45
  else if (digits === 4 || digits === 8) score += 25
  else score += 5

  if (baseline > 0) {
    const difference = value - baseline
    if (difference >= -50 && difference <= 3000) score += 80
    else if (difference >= -500 && difference <= 15_000) score += 35
    score -= Math.min(40, Math.abs(difference) / 500)
  }
  return score
}

export async function readOdometerFromImage(file: File, baseline = 0, onProgress?: ProgressCallback): Promise<OdometerOcrResult> {
  let resolveTurn: () => void = () => undefined
  const previous = recognitionQueue
  recognitionQueue = new Promise<void>((resolve) => { resolveTurn = resolve })
  await previous
  currentProgress = onProgress ?? (() => undefined)
  try {
    currentProgress(0.03, 'Đang tối ưu ảnh cụm đồng hồ')
    const image = await buildOdometerOcrImage(file)
    const worker = await getWorker()
    const result = await worker.recognize(image)
    const rawText = result.data.text ?? ''
    const candidates = findCandidates(rawText)
    const sorted = [...candidates].sort((a, b) => scoreCandidate(b, baseline) - scoreCandidate(a, baseline))
    return {
      value: sorted[0] ?? null,
      confidence: Math.max(0, Math.min(100, Number(result.data.confidence ?? 0))),
      rawText,
      candidates: sorted,
    }
  } finally {
    currentProgress = () => undefined
    resolveTurn()
  }
}
