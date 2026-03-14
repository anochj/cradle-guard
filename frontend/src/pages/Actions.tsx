import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { RefreshCw, Plus, Trash2, ArrowRight, Sparkles, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { generateDangerousActions } from '../api/gemini'

export default function Actions() {
  const navigate = useNavigate()
  const { apiKey, hazards, actions, setActions, toggleAction, addCustomAction, removeAction } = useApp()
  const [generating, setGenerating] = useState(false)
  const [customInput, setCustomInput] = useState('')

  const generated = actions.filter(a => a.source === 'generated')
  const custom = actions.filter(a => a.source === 'custom')

  const handleGenerate = async () => {
    if (!apiKey) { toast.error('Add your Gemini API key in Room Setup first.'); return }
    if (hazards.length === 0) { toast.error('Scan a room first to detect hazards.'); return }
    setGenerating(true)
    try {
      const result = await generateDangerousActions(hazards, apiKey)
      const existing = actions.filter(a => a.source === 'custom')
      setActions([...result, ...existing])
      toast.success(`Generated ${result.length} dangerous actions!`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const handleAdd = () => {
    const trimmed = customInput.trim()
    if (!trimmed) return
    addCustomAction(trimmed)
    setCustomInput('')
    toast.success('Custom alert added!')
  }

  const enabledCount = actions.filter(a => a.enabled).length

  return (
    <div className="relative z-10 min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          step="Step 02"
          title="Dangerous Actions"
          subtitle="Review AI-generated risks and add your own. Toggle any off to ignore them."
          backTo="/setup"
          rightSlot={
            actions.length > 0 && (
              <button onClick={() => navigate('/alerts')} className="btn-ocean text-xs">
                Next <ArrowRight size={13} />
              </button>
            )
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generated actions */}
          <motion.div
            className="glass-card p-5 flex flex-col gap-4"
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} color="rgba(160,210,235,0.6)" />
                <h3 className="text-ocean-100 font-medium text-sm tracking-wide">Generated from scan</h3>
              </div>
              <button onClick={handleGenerate} disabled={generating}
                className="btn-ghost flex items-center gap-1.5 text-xs">
                <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
                {generating ? 'Generating…' : generated.length > 0 ? 'Regenerate' : 'Generate'}
              </button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto min-h-[280px] max-h-[420px]">
              <AnimatePresence>
                {generated.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 gap-3">
                    <Sparkles size={36} color="rgba(100,180,220,0.15)" />
                    <p className="text-sm text-ocean-300 opacity-40 text-center leading-relaxed">
                      {hazards.length === 0
                        ? 'Complete Room Setup first,\nthen generate risks here.'
                        : 'Click Generate to create\nAI-powered risk scenarios.'}
                    </p>
                    {hazards.length > 0 && (
                      <button onClick={handleGenerate} disabled={generating} className="btn-ocean text-xs mt-2">
                        <Sparkles size={13} />
                        {generating ? 'Generating…' : 'Generate Now'}
                      </button>
                    )}
                  </div>
                ) : (
                  generated.map((action, i) => (
                    <motion.div
                      key={action.id}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm"
                      style={{
                        background: 'rgba(10,26,46,0.5)',
                        border: '1px solid rgba(100,170,210,0.1)',
                        opacity: action.enabled ? 1 : 0.45,
                      }}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: action.enabled ? 1 : 0.45, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <button onClick={() => toggleAction(action.id)} className="flex-shrink-0">
                        {action.enabled
                          ? <ToggleRight size={20} color="rgba(74,159,197,0.8)" />
                          : <ToggleLeft size={20} color="rgba(100,170,210,0.3)" />}
                      </button>
                      <span className="flex-1 text-ocean-100 text-xs leading-relaxed">{action.text}</span>
                      <button onClick={() => removeAction(action.id)} className="btn-ghost p-1 opacity-40 hover:opacity-100">
                        <Trash2 size={12} />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Custom actions */}
          <motion.div
            className="glass-card p-5 flex flex-col gap-4"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil size={14} color="rgba(160,210,235,0.6)" />
                <h3 className="text-ocean-100 font-medium text-sm tracking-wide">Your custom alerts</h3>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(100,170,210,0.1)', color: 'rgba(160,210,235,0.7)', border: '1px solid rgba(100,170,210,0.15)' }}>
                {custom.length} added
              </span>
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                className="input-ocean flex-1"
                placeholder="e.g. baby touches the lamp…"
                value={customInput}
                maxLength={120}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              />
              <button onClick={handleAdd} disabled={!customInput.trim()}
                className="btn-ocean px-4 flex-shrink-0">
                <Plus size={15} />
                Add
              </button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto min-h-[200px] max-h-[340px]">
              <AnimatePresence>
                {custom.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 gap-2">
                    <Pencil size={32} color="rgba(100,180,220,0.15)" />
                    <p className="text-sm text-ocean-300 opacity-40 text-center leading-relaxed">
                      No custom alerts yet.<br />Add situations you're worried about.
                    </p>
                  </div>
                ) : (
                  custom.map((action) => (
                    <motion.div
                      key={action.id}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm"
                      style={{
                        background: 'rgba(26,84,128,0.15)',
                        border: '1px solid rgba(74,159,197,0.15)',
                        opacity: action.enabled ? 1 : 0.45,
                      }}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: action.enabled ? 1 : 0.45, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <button onClick={() => toggleAction(action.id)} className="flex-shrink-0">
                        {action.enabled
                          ? <ToggleRight size={20} color="rgba(74,159,197,0.8)" />
                          : <ToggleLeft size={20} color="rgba(100,170,210,0.3)" />}
                      </button>
                      <span className="flex-1 text-ocean-100 text-xs leading-relaxed">{action.text}</span>
                      <button onClick={() => removeAction(action.id)} className="btn-ghost p-1 opacity-40 hover:opacity-100">
                        <Trash2 size={12} />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {actions.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'rgba(100,170,210,0.1)' }}>
                <p className="text-xs text-ocean-300 opacity-50">
                  {enabledCount} of {actions.length} actions enabled for monitoring
                </p>
                <button onClick={() => navigate('/alerts')} className="btn-ocean w-full justify-center">
                  Continue to Alert Settings <ArrowRight size={14} />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
