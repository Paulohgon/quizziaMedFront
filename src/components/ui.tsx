import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** Ícones de traço (estilo Lucide), 24×24. */
const ICONS = {
  study: 'M2 6.5 12 2l10 4.5-10 4.5L2 6.5Z M6 8.8V14c0 1.7 2.7 3 6 3s6-1.3 6-3V8.8 M22 6.5V12',
  retry: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  chart: 'M3 3v18h18 M7 16v-5 M12 16V8 M17 16v-3',
  exams: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z M14 2v6h6 M8 13h8 M8 17h5',
  timer: 'M10 2h4 M12 14l3-3 M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  filter: 'M22 3H2l8 9.5V19l4 2v-8.5L22 3Z',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18 M6 6l12 12',
  arrowRight: 'M5 12h14 M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5 M11 18l-6-6 6-6',
  external: 'M15 3h6v6 M10 14 21 3 M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 16v-4 M12 8h.01',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M21 21l-4.3-4.3',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  sparkle: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z',
  zoom: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M21 21l-4.3-4.3 M11 8v6 M8 11h6',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z',
  pencil: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z',
  flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.3 1.6 1.5 2.7 2.5 2.7Z',
  pause: 'M10 4H6v16h4V4Z M18 4h-4v16h4V4Z',
  play: 'M6 3l14 9-14 9V3Z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 6v6l4 2',
  calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, className = 'size-5', filled = false }: { name: IconName; className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name].split(' M').map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-brand-600/50',
  secondary: 'border border-line bg-surface text-ink-1 hover:bg-canvas disabled:opacity-50',
  ghost: 'text-ink-2 hover:bg-ink-1/5 disabled:opacity-40',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface shadow-card ${className}`}>{children}</div>
}

type Tone = 'neutral' | 'brand' | 'warn' | 'good' | 'bad'

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-1/5 text-ink-2',
  brand: 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
  warn: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  good: 'bg-good-soft text-good',
  bad: 'bg-bad-soft text-bad',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-3" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      {label}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: IconName
  title: string
  children?: ReactNode
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon name={icon} className="size-6" />
      </div>
      <h2 className="text-lg font-bold text-ink-1">{title}</h2>
      {children && <div className="mt-2 max-w-md text-sm text-ink-3">{children}</div>}
    </Card>
  )
}

export function ErrorMessage({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-bad/20 bg-bad-soft p-4 text-sm text-bad">
      Não foi possível carregar os dados. {error instanceof Error ? error.message : String(error)}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-1 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
