import { useState } from 'react'

// ── Backend URL helpers ───────────────────────────────────────────────────────

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL?.trim()

function getBackendHttpUrl(): string {
  if (rawBackendUrl) {
    return rawBackendUrl.endsWith('/') ? rawBackendUrl.slice(0, -1) : rawBackendUrl
  }
  const protocol = window.location.protocol
  const hostname = window.location.hostname || 'localhost'
  return `${protocol}//${hostname}:8000`
}

const backendUrl = getBackendHttpUrl()

// ── Types ─────────────────────────────────────────────────────────────────────

interface ObjectRelationship {
  object_a: string
  object_b: string
  unsafe_distance: number
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Settings() {
  return (
    <main className="settings-shell">
      <header className="settings-header">
        <h1>Settings</h1>
        <p className="settings-subtitle">
          Configure safety rules and object relationships used by Cardle Guard.
        </p>
      </header>

      <div className="settings-sections">
        <CustomRulesSection />
        <RelationMapSection />
        <ManualRelationshipSection />
      </div>
    </main>
  )
}

// ── Custom Rules (Special Instructions) ──────────────────────────────────────

function CustomRulesSection() {
  const [instruction, setInstruction] = useState('')
  const [submitted, setSubmitted] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = instruction.trim()
    if (!trimmed) return

    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch(`${backendUrl}/instructions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: trimmed }),
      })

      if (!res.ok) throw new Error(`Server returned ${res.status}`)

      setSubmitted((prev) => [trimmed, ...prev])
      setInstruction('')
      setStatus('success')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <section className="settings-card">
      <div className="settings-card-header">
        <span className="settings-card-icon">📋</span>
        <div>
          <h2 className="settings-card-title">Custom Rules</h2>
          <p className="settings-card-desc">
            Add plain-language safety instructions that the AI will follow during analysis (e.g. "Alert if the baby is uncovered for more than 30 seconds").
          </p>
        </div>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <textarea
          className="settings-textarea"
          placeholder="Enter a safety instruction…"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          disabled={status === 'loading'}
        />
        <div className="settings-form-footer">
          <button
            className="primary-button settings-submit-btn"
            type="submit"
            disabled={status === 'loading' || !instruction.trim()}
          >
            {status === 'loading' ? 'Saving…' : 'Save instruction'}
          </button>
          {status === 'success' && <span className="settings-feedback success">✓ Saved</span>}
          {status === 'error' && <span className="settings-feedback error">✗ {errorMsg}</span>}
        </div>
      </form>

      {submitted.length > 0 && (
        <ul className="settings-list">
          {submitted.map((item, i) => (
            <li key={i} className="settings-list-item">
              <span className="settings-list-bullet">›</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── AI Relation Map ───────────────────────────────────────────────────────────

function RelationMapSection() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [results, setResults] = useState<ObjectRelationship[]>([])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return

    setStatus('loading')
    setErrorMsg('')
    setResults([])

    try {
      const res = await fetch(`${backendUrl}/relation-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trimmed),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { detail?: string }).detail ?? `Server returned ${res.status}`)
      }

      const data = (await res.json()) as { relationships: ObjectRelationship[] }
      setResults(data.relationships)
      setText('')
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <section className="settings-card">
      <div className="settings-card-header">
        <span className="settings-card-icon">🤖</span>
        <div>
          <h2 className="settings-card-title">AI Relationship Generator</h2>
          <p className="settings-card-desc">
            Describe your environment or safety concerns in plain text and the AI will
            extract object safety relationships automatically (e.g. "There is a dog near the crib. Knives should never be near the baby.").
          </p>
        </div>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <textarea
          className="settings-textarea"
          placeholder="Describe your environment or safety rules…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          disabled={status === 'loading'}
        />
        <div className="settings-form-footer">
          <button
            className="primary-button settings-submit-btn"
            type="submit"
            disabled={status === 'loading' || !text.trim()}
          >
            {status === 'loading' ? 'Generating…' : 'Generate relationships'}
          </button>
          {status === 'error' && <span className="settings-feedback error">✗ {errorMsg}</span>}
        </div>
      </form>

      {status === 'success' && results.length > 0 && (
        <div className="settings-results">
          <p className="rel-heading">Generated relationships ({results.length})</p>
          <RelationshipTable relationships={results} />
        </div>
      )}

      {status === 'success' && results.length === 0 && (
        <p className="settings-feedback success" style={{ marginTop: 12 }}>
          ✓ Saved — no relationships were extracted from that text.
        </p>
      )}
    </section>
  )
}

// ── Manual Relationship Entry ─────────────────────────────────────────────────

function ManualRelationshipSection() {
  const emptyRow = (): ObjectRelationship => ({ object_a: '', object_b: '', unsafe_distance: 50 })

  const [rows, setRows] = useState<ObjectRelationship[]>([emptyRow()])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [saved, setSaved] = useState<ObjectRelationship[]>([])

  function updateRow(index: number, field: keyof ObjectRelationship, value: string | number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const valid = rows.filter((r) => r.object_a.trim() && r.object_b.trim())
    if (valid.length === 0) return

    setStatus('loading')
    setErrorMsg('')

    // We submit them as a relation-map "text" string so the backend validates and saves them.
    // We build a synthetic description so the AI echoes them back directly.
    const description = valid
      .map((r) => `${r.object_a} must stay at least ${r.unsafe_distance} pixels away from ${r.object_b}`)
      .join('. ')

    try {
      const res = await fetch(`${backendUrl}/relation-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(description),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { detail?: string }).detail ?? `Server returned ${res.status}`)
      }

      setSaved((prev) => [...valid, ...prev])
      setRows([emptyRow()])
      setStatus('success')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  const hasValidRows = rows.some((r) => r.object_a.trim() && r.object_b.trim())

  return (
    <section className="settings-card">
      <div className="settings-card-header">
        <span className="settings-card-icon">🔗</span>
        <div>
          <h2 className="settings-card-title">Manual Relationships</h2>
          <p className="settings-card-desc">
            Directly define which objects should never be within a certain distance of each other.
            Unsafe distance is in pixels.
          </p>
        </div>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="rel-editor">
          <div className="rel-editor-header">
            <span>Object A</span>
            <span>Object B</span>
            <span>Unsafe distance (px)</span>
            <span />
          </div>

          {rows.map((row, i) => (
            <div key={i} className="rel-editor-row">
              <input
                className="settings-input"
                placeholder="e.g. baby"
                value={row.object_a}
                onChange={(e) => updateRow(i, 'object_a', e.target.value)}
                disabled={status === 'loading'}
              />
              <input
                className="settings-input"
                placeholder="e.g. knife"
                value={row.object_b}
                onChange={(e) => updateRow(i, 'object_b', e.target.value)}
                disabled={status === 'loading'}
              />
              <input
                className="settings-input"
                type="number"
                min={20}
                max={500}
                value={row.unsafe_distance}
                onChange={(e) => updateRow(i, 'unsafe_distance', Number(e.target.value))}
                disabled={status === 'loading'}
              />
              <button
                type="button"
                className="rel-remove-btn"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1 || status === 'loading'}
                aria-label="Remove row"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            className="secondary-button rel-add-btn"
            onClick={addRow}
            disabled={status === 'loading'}
          >
            + Add row
          </button>
        </div>

        <div className="settings-form-footer">
          <button
            className="primary-button settings-submit-btn"
            type="submit"
            disabled={status === 'loading' || !hasValidRows}
          >
            {status === 'loading' ? 'Saving…' : 'Save relationships'}
          </button>
          {status === 'success' && <span className="settings-feedback success">✓ Saved</span>}
          {status === 'error' && <span className="settings-feedback error">✗ {errorMsg}</span>}
        </div>
      </form>

      {saved.length > 0 && (
        <div className="settings-results">
          <p className="rel-heading">Saved this session ({saved.length})</p>
          <RelationshipTable relationships={saved} />
        </div>
      )}
    </section>
  )
}

// ── Shared relationship table ─────────────────────────────────────────────────

function RelationshipTable({ relationships }: { relationships: ObjectRelationship[] }) {
  return (
    <table className="rel-table">
      <thead>
        <tr>
          <th>Object A</th>
          <th>Object B</th>
          <th>Unsafe distance (px)</th>
        </tr>
      </thead>
      <tbody>
        {relationships.map((r, i) => (
          <tr key={i}>
            <td>{r.object_a}</td>
            <td>{r.object_b}</td>
            <td>{r.unsafe_distance}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
