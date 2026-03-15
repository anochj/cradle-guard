import { useState } from 'react'
import { motion } from 'framer-motion'
import { ListChecks, Bot, Link2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'

const rawBackendUrl = ((import.meta as any).env?.VITE_BACKEND_URL ?? (import.meta as any).env?.VITE_API_URL)?.trim()

function getBackendHttpUrl(): string {
  if (rawBackendUrl) {
    return rawBackendUrl.endsWith('/') ? rawBackendUrl.slice(0, -1) : rawBackendUrl
  }

  const protocol = window.location.protocol
  const hostname = window.location.hostname || 'localhost'
  return `${protocol}//${hostname}:8000`
}

const backendUrl = getBackendHttpUrl()

interface ObjectRelationship {
  object_a: string
  object_b: string
  unsafe_distance: number
}

export default function Settings() {
  return (
    <div className="relative z-10 min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          step="Settings"
          title="Safety Configuration"
          subtitle="Configure instructions and object relationships used by Cardle Guard."
          backTo="/"
        />

        <div className="grid grid-cols-1 gap-6">
          <CustomRulesSection />
          <RelationMapSection />
          <ManualRelationshipSection />
        </div>
      </div>
    </div>
  )
}

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
    <motion.section
      className="glass-card p-5 flex flex-col gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
    >
      <div className="flex items-start gap-3">
        <ListChecks size={18} color="rgba(29,78,216,0.75)" />
        <div>
          <h3 className="text-ocean-100 font-medium text-base">Custom Rules</h3>
          <p className="text-sm text-ocean-300 opacity-60 mt-1 leading-relaxed">
            Add plain-language safety instructions for analysis (for example: "Alert if the baby is uncovered for more than 30 seconds").
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <textarea
          className="input-ocean min-h-[100px] resize-y"
          placeholder="Enter a safety instruction…"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={status === 'loading'}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn-ocean" type="submit" disabled={status === 'loading' || !instruction.trim()}>
            {status === 'loading' ? 'Saving…' : 'Save instruction'}
          </button>
          {status === 'success' && <span className="text-xs" style={{ color: '#1d9e75' }}>✓ Saved</span>}
          {status === 'error' && <span className="text-xs" style={{ color: '#dc5050' }}>✗ {errorMsg}</span>}
        </div>
      </form>

      {submitted.length > 0 && (
        <div className="flex flex-col gap-2 pt-3 border-t" style={{ borderColor: 'rgba(100,170,210,0.1)' }}>
          {submitted.map((item, i) => (
            <p key={i} className="text-xs text-ocean-200 opacity-75 leading-relaxed">• {item}</p>
          ))}
        </div>
      )}
    </motion.section>
  )
}

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
    <motion.section
      className="glass-card p-5 flex flex-col gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
    >
      <div className="flex items-start gap-3">
        <Bot size={18} color="rgba(29,78,216,0.75)" />
        <div>
          <h3 className="text-ocean-100 font-medium text-base">AI Relationship Generator</h3>
          <p className="text-sm text-ocean-300 opacity-60 mt-1 leading-relaxed">
            Describe the environment and generate safety relationships automatically.
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <textarea
          className="input-ocean min-h-[120px] resize-y"
          placeholder="Describe your environment or safety concerns…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={status === 'loading'}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn-ocean" type="submit" disabled={status === 'loading' || !text.trim()}>
            {status === 'loading' ? 'Generating…' : 'Generate relationships'}
          </button>
          {status === 'error' && <span className="text-xs" style={{ color: '#dc5050' }}>✗ {errorMsg}</span>}
        </div>
      </form>

      {status === 'success' && results.length > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: 'rgba(100,170,210,0.1)' }}>
          <p className="text-xs text-ocean-300 opacity-60 uppercase tracking-[0.12em] mb-2">
            Generated relationships ({results.length})
          </p>
          <RelationshipTable relationships={results} />
        </div>
      )}

      {status === 'success' && results.length === 0 && (
        <p className="text-xs" style={{ color: '#1d9e75' }}>
          ✓ Saved — no relationships were extracted from that text.
        </p>
      )}
    </motion.section>
  )
}

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
    <motion.section
      className="glass-card p-5 flex flex-col gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
    >
      <div className="flex items-start gap-3">
        <Link2 size={18} color="rgba(29,78,216,0.75)" />
        <div>
          <h3 className="text-ocean-100 font-medium text-base">Manual Relationships</h3>
          <p className="text-sm text-ocean-300 opacity-60 mt-1 leading-relaxed">
            Define objects and unsafe distances directly. Distance is measured in pixels.
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_1fr_170px_38px] gap-2 text-[11px] uppercase tracking-[0.1em] text-ocean-300 opacity-55 px-1">
            <span>Object A</span>
            <span>Object B</span>
            <span>Unsafe distance (px)</span>
            <span />
          </div>

          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_170px_38px] gap-2">
              <input
                className="input-ocean"
                placeholder="e.g. baby"
                value={row.object_a}
                onChange={(e) => updateRow(i, 'object_a', e.target.value)}
                disabled={status === 'loading'}
              />
              <input
                className="input-ocean"
                placeholder="e.g. knife"
                value={row.object_b}
                onChange={(e) => updateRow(i, 'object_b', e.target.value)}
                disabled={status === 'loading'}
              />
              <input
                className="input-ocean"
                type="number"
                min={20}
                max={500}
                value={row.unsafe_distance}
                onChange={(e) => updateRow(i, 'unsafe_distance', Number(e.target.value))}
                disabled={status === 'loading'}
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1 || status === 'loading'}
                className="btn-outline px-0 py-0 justify-center"
                aria-label="Remove row"
              >
                ✕
              </button>
            </div>
          ))}

          <button type="button" className="btn-outline w-fit" onClick={addRow} disabled={status === 'loading'}>
            + Add row
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn-ocean" type="submit" disabled={status === 'loading' || !hasValidRows}>
            {status === 'loading' ? 'Saving…' : 'Save relationships'}
          </button>
          {status === 'success' && <span className="text-xs" style={{ color: '#1d9e75' }}>✓ Saved</span>}
          {status === 'error' && <span className="text-xs" style={{ color: '#dc5050' }}>✗ {errorMsg}</span>}
        </div>
      </form>

      {saved.length > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: 'rgba(100,170,210,0.1)' }}>
          <p className="text-xs text-ocean-300 opacity-60 uppercase tracking-[0.12em] mb-2">
            Saved this session ({saved.length})
          </p>
          <RelationshipTable relationships={saved} />
        </div>
      )}
    </motion.section>
  )
}

function RelationshipTable({ relationships }: { relationships: ObjectRelationship[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'rgba(100,170,210,0.16)' }}>
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(10,26,46,0.45)' }}>
            <th className="text-left px-3 py-2 text-ocean-300 opacity-70 uppercase tracking-[0.1em]">Object A</th>
            <th className="text-left px-3 py-2 text-ocean-300 opacity-70 uppercase tracking-[0.1em]">Object B</th>
            <th className="text-left px-3 py-2 text-ocean-300 opacity-70 uppercase tracking-[0.1em]">Unsafe distance (px)</th>
          </tr>
        </thead>
        <tbody>
          {relationships.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid rgba(100,170,210,0.12)' }}>
              <td className="px-3 py-2 text-ocean-100">{r.object_a}</td>
              <td className="px-3 py-2 text-ocean-100">{r.object_b}</td>
              <td className="px-3 py-2 text-ocean-100">{r.unsafe_distance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
