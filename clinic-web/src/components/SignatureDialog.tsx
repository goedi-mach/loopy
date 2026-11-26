import { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'

// A pop-up pad for drawing a signature with a finger, stylus or mouse.
// The pad has the same shape as the signature box on the rabies certificate (25:4),
// so the signature isn't squashed or stretched when it's printed there.

interface Props {
  title: string
  onSave: (png: Blob) => void
  onCancel: () => void
}

export default function SignatureDialog({ title, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [empty, setEmpty] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Draw at the screen's full resolution so the signature stays sharp
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    canvas.getContext('2d')?.scale(ratio, ratio)
    const pad = new SignaturePad(canvas, { penColor: '#000000', minWidth: 1.2, maxWidth: 3 })
    pad.addEventListener('endStroke', () => setEmpty(pad.isEmpty()))
    padRef.current = pad
    return () => pad.off()
  }, [])

  function clear() {
    padRef.current?.clear()
    setEmpty(true)
  }

  // A transparent PNG, so the certificate's lines show through around the ink
  function save() {
    const canvas = canvasRef.current
    if (!canvas || padRef.current?.isEmpty()) return
    canvas.toBlob((blob) => {
      if (blob) onSave(blob)
      else setError('The signature could not be saved. Please try again.')
    }, 'image/png')
  }

  return (
    <div className="sh-modal-overlay">
      <div className="sh-modal" style={{ maxWidth: 640 }}>
        <div className="sh-modal-title">✍️ {title}</div>
        <div className="sh-modal-sub">Sign inside the box. It will appear on rabies certificates.</div>
        <canvas
          ref={canvasRef}
          className="sig-canvas"
          style={{ height: 'auto', aspectRatio: '25 / 4', border: '1.5px dashed var(--border)', background: 'white' }}
        />
        {error && <div className="warning-bar" style={{ marginTop: '0.75rem' }}>{error}</div>}
        <div className="sh-modal-actions">
          <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-outline" disabled={empty} onClick={clear}>Clear</button>
          <button type="button" className="btn-primary" disabled={empty} onClick={save}>Save Signature</button>
        </div>
      </div>
    </div>
  )
}
