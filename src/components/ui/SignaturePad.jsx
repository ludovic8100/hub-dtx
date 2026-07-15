import { useRef, useEffect, useState } from 'react'

// Cadre de signature dessinée (souris + tactile). Appelle onChange(dataURL PNG) ou onChange('') si vide.
export default function SignaturePad({ width = 460, height = 160, penColor = '#0f172a', onChange }) {
  const cvRef = useRef(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const last = useRef(null)
  const [vide, setVide] = useState(true)

  useEffect(() => {
    const cv = cvRef.current
    if (!cv) return
    const ratio = window.devicePixelRatio || 1
    cv.width = width * ratio
    cv.height = height * ratio
    cv.style.width = width + 'px'
    cv.style.height = height + 'px'
    const ctx = cv.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = penColor
  }, [width, height, penColor])

  const pos = (e) => {
    const cv = cvRef.current
    const r = cv.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return { x: src.clientX - r.left, y: src.clientY - r.top }
  }
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e) }
  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = cvRef.current.getContext('2d')
    const p = pos(e)
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    last.current = p
    if (!dirty.current) { dirty.current = true; setVide(false) }
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    if (onChange) onChange(dirty.current ? cvRef.current.toDataURL('image/png') : '')
  }
  const clear = () => {
    const cv = cvRef.current, ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, cv.width, cv.height)
    dirty.current = false
    setVide(true)
    if (onChange) onChange('')
  }

  return (
    <div>
      <canvas ref={cvRef}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        style={{ border: '1px dashed #cbd5e1', borderRadius: 10, background: '#fff', touchAction: 'none', cursor: 'crosshair', display: 'block', maxWidth: '100%' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontSize: 11.5, color: vide ? '#94a3b8' : '#16a34a', fontWeight: vide ? 400 : 700 }}>{vide ? 'Signez dans le cadre' : '✓ Signé'}</span>
        <button type="button" onClick={clear} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: '4px 12px', fontSize: 12.5, cursor: 'pointer', color: '#475569' }}>Effacer</button>
      </div>
    </div>
  )
}
