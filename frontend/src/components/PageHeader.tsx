import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface Props {
  step: string
  title: string
  subtitle: string
  backTo?: string
  rightSlot?: React.ReactNode
}

export default function PageHeader({ step, title, subtitle, backTo, rightSlot }: Props) {
  const navigate = useNavigate()
  return (
    <div className="flex items-start justify-between mb-8 gap-4">
      <div className="w-20 flex-shrink-0">
        {backTo && (
          <button onClick={() => navigate(backTo)}
            className="btn-ghost flex items-center gap-1 mt-1">
            <ArrowLeft size={15} />
            <span>Back</span>
          </button>
        )}
      </div>
      <div className="text-center flex-1">
        <p className="step-number-badge mb-2">{step}</p>
        <h2 className="font-serif italic text-3xl text-ocean-100 mb-1">{title}</h2>
        <p className="text-sm text-ocean-300 opacity-70">{subtitle}</p>
      </div>
      <div className="w-20 flex-shrink-0 flex justify-end">{rightSlot}</div>
    </div>
  )
}
