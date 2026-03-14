import { useEffect, useRef } from 'react'

export default function OceanBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    container.innerHTML = ''
    for (let i = 0; i < 18; i++) {
      const b = document.createElement('div')
      const size = Math.random() * 22 + 5
      const dur = Math.random() * 14 + 8
      const delay = Math.random() * 12
      b.style.cssText = `
        position:absolute;width:${size}px;height:${size}px;border-radius:50%;
        background:rgba(255,255,255,0.65);border:1px solid rgba(255,255,255,0.9);
        left:${Math.random() * 100}%;
        animation:floatUp ${dur}s linear ${delay}s infinite;
      `
      container.appendChild(b)
    }
  }, [])

  return (
    <>
      <div className="fixed inset-0 z-0" style={{
        background: `
          radial-gradient(ellipse 80% 60% at 50% 100%, rgba(68, 150, 163, 0.65) 0%, transparent 70%),
          radial-gradient(ellipse 60% 40% at 0% 10%, rgba(187, 151, 193, 0.75) 0%, transparent 60%),
          radial-gradient(ellipse 70% 55% at 100% 0%, rgba(119, 189, 155, 0.85) 0%, transparent 65%)
        `,
      }} />
      <div ref={ref} className="fixed inset-0 z-0 pointer-events-none" />
      <svg className="fixed bottom-0 left-0 z-0 pointer-events-none opacity-[0.12] animate-waveMove"
        style={{ width: '200%', height: '130px' }} viewBox="0 0 1440 130" preserveAspectRatio="none">
        <path d="M0,65 C180,15 360,115 540,65 C720,15 900,115 1080,65 C1260,15 1350,85 1440,65 L1440,130 L0,130 Z" fill="#6C99BF" />
      </svg>
      <svg className="fixed bottom-0 left-0 z-0 pointer-events-none opacity-[0.09] animate-waveMoveSlow"
        style={{ width: '200%', height: '110px' }} viewBox="0 0 1440 110" preserveAspectRatio="none">
        <path d="M0,55 C200,100 400,10 600,55 C800,100 1000,10 1200,55 C1320,80 1380,30 1440,55 L1440,110 L0,110 Z" fill="#f9d1ff" />
      </svg>
    </>
  )
}
