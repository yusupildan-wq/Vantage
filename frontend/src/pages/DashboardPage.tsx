import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

interface FeatureCardProps {
  index: string
  title: string
  description: string
  detail: string
  accentColor: string
  accentGlow: string
  topLine: string
  icon: React.ReactNode
  onClick: () => void
}

function FeatureCard({ index, title, description, detail, accentColor, accentGlow, topLine, icon, onClick }: FeatureCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${hovered ? accentColor + '40' : 'var(--border)'}`,
        boxShadow: hovered ? `0 0 40px ${accentGlow}` : 'none',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px transition-opacity duration-300"
        style={{
          background: topLine,
          opacity: hovered ? 1 : 0.4,
        }}
      />

      {/* Large watermark number */}
      <div
        className="absolute top-5 right-6 font-display font-bold select-none pointer-events-none leading-none"
        style={{
          fontSize: '7rem',
          color: hovered ? accentColor : 'var(--border-bright)',
          opacity: hovered ? 0.12 : 0.07,
          transition: 'color 0.3s, opacity 0.3s',
        }}
      >
        {index}
      </div>

      <div className="p-8 md:p-10 flex flex-col h-full">
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-8 transition-all duration-300"
          style={{
            backgroundColor: hovered ? accentColor + '18' : 'var(--bg-elevated)',
            border: `1px solid ${hovered ? accentColor + '35' : 'var(--border-mid)'}`,
          }}
        >
          {icon}
        </div>

        {/* Title */}
        <h2
          className="font-display text-2xl font-semibold mb-3 transition-colors duration-200"
          style={{ color: hovered ? '#ffffff' : 'var(--text-primary)' }}
        >
          {title}
        </h2>

        {/* Description */}
        <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
        <p className="text-xs leading-relaxed mb-10" style={{ color: 'var(--text-muted)' }}>
          {detail}
        </p>

        {/* CTA */}
        <div className="mt-auto flex items-center gap-2 text-sm font-semibold transition-all duration-200" style={{ color: accentColor }}>
          Launch
          <svg
            className="w-4 h-4 transition-transform duration-200"
            style={{ transform: hovered ? 'translateX(4px)' : 'translateX(0)' }}
            fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(91,95,199,0.07) 0%, transparent 70%)' }}
          />
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(129,140,248,0.45), transparent)' }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-2xl animate-fade-in">
            <p
              className="text-xs font-semibold tracking-[0.3em] uppercase mb-5"
              style={{ color: 'var(--accent-bright)' }}
            >
              Power Platform · Dataverse
            </p>
            <h1
              className="font-display font-semibold leading-[1.04] mb-6 text-gradient"
              style={{ fontSize: 'clamp(2.8rem, 5vw, 4.8rem)' }}
            >
              Active Layer<br />Auditor
            </h1>
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)', maxWidth: '480px' }}>
              Precision tooling for Power Platform engineers. Select a feature below to get started.
            </p>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <main className="max-w-7xl mx-auto px-6 py-14">
        <p
          className="text-xs font-semibold tracking-[0.25em] uppercase mb-8"
          style={{ color: 'var(--text-muted)' }}
        >
          Features
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 animate-slide-up">

          <FeatureCard
            index="01"
            title="Active Layer Scanner"
            description="Identify active-layer customizations across your Dataverse environment."
            detail="Scans all components and flags anything sitting in the active layer that could cause issues during solution export."
            accentColor="var(--accent-bright)"
            accentGlow="rgba(91,95,199,0.12)"
            topLine="linear-gradient(90deg, transparent, rgba(129,140,248,0.6), transparent)"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ color: 'var(--accent-bright)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
              </svg>
            }
            onClick={() => navigate('/scan')}
          />

          <FeatureCard
            index="02"
            title="Option Set Guard"
            description="Compare and protect critical option set values in your environment."
            detail="Validates that protected option set values match the expected configuration and restores any that have drifted."
            accentColor="#f59e0b"
            accentGlow="rgba(245,158,11,0.1)"
            topLine="linear-gradient(90deg, transparent, rgba(245,158,11,0.55), transparent)"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ color: '#f59e0b' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            }
            onClick={() => navigate('/optionsets')}
          />

          <FeatureCard
            index="03"
            title="Deployment Readiness Checker"
            description="Validate your environment is fully prepared before a Greymatter deployment."
            detail="Runs 6 automated checks across active layers, flows, solutions, env vars, connections, and option sets — generating a single pass/fail report."
            accentColor="#4ade80"
            accentGlow="rgba(34,197,94,0.08)"
            topLine="linear-gradient(90deg, transparent, rgba(74,222,128,0.55), transparent)"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ color: '#4ade80' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            onClick={() => navigate('/readiness')}
          />

          <FeatureCard
            index="04"
            title="Environment Comparison"
            description="Diff two Dataverse environments side by side to detect configuration drift."
            detail="Compares solutions, environment variables, connection references, and cloud flows — highlighting what's different, missing, or extra between environments."
            accentColor="#c084fc"
            accentGlow="rgba(192,132,252,0.08)"
            topLine="linear-gradient(90deg, transparent, rgba(192,132,252,0.55), transparent)"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ color: '#c084fc' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            }
            onClick={() => navigate('/comparison')}
          />

          <FeatureCard
            index="05"
            title="Cloud Flow Monitor"
            description="See every cloud flow's health at a glance — without clicking through Power Apps."
            detail="Flow health, silent trigger detection, environment comparison, and connection reference blast-radius map — all in one place."
            accentColor="#60a5fa"
            accentGlow="rgba(96,165,250,0.08)"
            topLine="linear-gradient(90deg, transparent, rgba(96,165,250,0.55), transparent)"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ color: '#60a5fa' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            }
            onClick={() => navigate('/flows')}
          />
        </div>
      </main>
    </>
  )
}
