import { useEffect, useRef, useState } from 'react'

export function AudioRecorder({ onChange }: { onChange: (file: File | null) => void }) {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  async function start() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Trình duyệt này chưa hỗ trợ ghi âm trực tiếp.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const mime = (recorder.mimeType || 'audio/webm').split(';')[0]
        const blob = new Blob(chunksRef.current, { type: mime })
        const extension = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
        const file = new File([blob], `su-co-${Date.now()}.${extension}`, { type: mime })
        if (audioUrl) URL.revokeObjectURL(audioUrl)
        setAudioUrl(URL.createObjectURL(blob))
        onChange(file)
        stream.getTracks().forEach((track) => track.stop())
      }
      recorder.start(500)
      setSeconds(0)
      setRecording(true)
      timerRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    } catch {
      setError('Không mở được microphone. Hãy cấp quyền microphone cho website.')
    }
  }

  function stop() {
    recorderRef.current?.stop()
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    setRecording(false)
  }

  function clear() {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setSeconds(0)
    onChange(null)
  }

  return <div className="audio-recorder"><div><strong>🎙 Ghi âm mô tả</strong><small>Không bắt buộc</small></div>{recording ? <button type="button" className="record-stop" onClick={stop}>■ DỪNG · {seconds}s</button> : <button type="button" className="record-start" onClick={() => void start()}>{audioUrl ? 'GHI LẠI' : 'BẮT ĐẦU GHI'}</button>}{audioUrl && !recording && <div className="audio-result"><audio controls src={audioUrl} /><button type="button" onClick={clear}>Xóa</button></div>}{error && <p>{error}</p>}</div>
}
