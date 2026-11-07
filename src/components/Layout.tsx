import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api, pct, type Summary } from '../api'
import { useAuth } from '../auth'
import { Button, Icon, type IconName } from './ui'

interface NavItem {
  to: string
  label: string
  short: string
  icon: IconName
  /** Aparece na barra inferior do celular (os demais ficam em "Mais"). */
  mobile?: boolean
}

const LINKS: NavItem[] = [
  { to: '/estudar', label: 'Estudar', short: 'Estudar', icon: 'study', mobile: true },
  { to: '/revisao', label: 'Revisão do dia', short: 'Revisão', icon: 'calendar', mobile: true },
  { to: '/refazer', label: 'Refazer erradas', short: 'Refazer', icon: 'retry' },
  { to: '/caderno', label: 'Favoritas e notas', short: 'Caderno', icon: 'star', mobile: true },
  { to: '/respondidas', label: 'Respondidas', short: 'Histórico', icon: 'list' },
  { to: '/desempenho', label: 'Desempenho', short: 'Desempenho', icon: 'chart', mobile: true },
  { to: '/provas', label: 'Provas', short: 'Provas', icon: 'exams' },
  { to: '/simulado', label: 'Simulado', short: 'Simulado', icon: 'timer' },
]

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-ink-1">
      <span className="grid size-8 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
        <Icon name="sparkle" className="size-4" />
      </span>
      medingo
    </span>
  )
}

function ReviewCount({ summary }: { summary?: Summary }) {
  if (!summary?.reviews_due) return null
  return (
    <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
      {summary.reviews_due}
    </span>
  )
}

/** Meta de questões do dia + sequência de dias estudando. */
function GoalWidget({ summary }: { summary: Summary }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [goal, setGoal] = useState(summary.daily_goal)
  const save = useMutation({
    mutationFn: (daily_goal: number) => api.updateMe({ daily_goal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      setEditing(false)
    },
  })
  const done = summary.today_answered >= summary.daily_goal

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Meta de hoje</p>
        <span
          title={`Melhor sequência: ${summary.best_streak_days} dia(s)`}
          className={`inline-flex items-center gap-1 text-xs font-bold ${
            summary.studied_today ? 'text-orange-600' : 'text-ink-3'
          }`}
        >
          <Icon name="flame" filled={summary.studied_today} className="size-4" />
          {summary.streak_days} {summary.streak_days === 1 ? 'dia' : 'dias'}
        </span>
      </div>
      <p className="mt-1 text-sm">
        <strong className="font-display text-lg">{summary.today_answered}</strong>
        <span className="text-ink-3"> / {summary.daily_goal} questões</span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-all ${done ? 'bg-good' : 'bg-brand-500'}`}
          style={{ width: `${Math.min(100, pct(summary.today_answered, summary.daily_goal))}%` }}
        />
      </div>
      {!summary.studied_today && summary.streak_days > 0 && (
        <p className="mt-1.5 text-[11px] text-orange-700">Responda uma questão hoje para manter a sequência.</p>
      )}
      {editing ? (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate(goal)
          }}
        >
          <input
            type="number"
            min={1}
            max={500}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="w-20 rounded-lg border border-line px-2 py-1 text-sm"
            aria-label="Questões por dia"
          />
          <Button type="submit" className="px-3 py-1 text-xs" disabled={save.isPending}>
            Salvar
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1.5 text-[11px] font-semibold text-ink-3 hover:text-ink-1"
        >
          {done ? 'Meta batida! Ajustar meta' : 'Ajustar meta'}
        </button>
      )}
    </div>
  )
}

export function Layout() {
  const { user, logout } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: api.summary, refetchInterval: 5 * 60_000 })
  const initials = user?.name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Barra lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-2 hover:bg-ink-1/5'
                }`
              }
            >
              <Icon name={l.icon} />
              {l.label}
              {l.to === '/revisao' && <ReviewCount summary={summary} />}
            </NavLink>
          ))}
        </nav>
        {summary && (
          <div className="mb-3">
            <GoalWidget key={summary.daily_goal} summary={summary} />
          </div>
        )}
        <div className="flex items-center gap-3 rounded-xl border border-line p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-ink-3">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sair"
            className="rounded-lg p-1.5 text-ink-3 hover:bg-ink-1/5 hover:text-ink-1"
          >
            <Icon name="logout" className="size-4" />
          </button>
        </div>
      </aside>

      {/* Barra superior (celular) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        {summary && (
          <span className="flex items-center gap-3 text-xs font-semibold">
            <span className={summary.today_answered >= summary.daily_goal ? 'text-good' : 'text-ink-2'}>
              {summary.today_answered}/{summary.daily_goal} hoje
            </span>
            <span className={`inline-flex items-center gap-1 ${summary.studied_today ? 'text-orange-600' : 'text-ink-3'}`}>
              <Icon name="flame" filled={summary.studied_today} className="size-4" />
              {summary.streak_days}
            </span>
          </span>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
        <Outlet />
      </main>

      {/* Navegação inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {LINKS.filter((l) => l.mobile).map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isActive ? 'text-brand-700' : 'text-ink-3'}`
            }
          >
            <Icon name={l.icon} className="size-5" />
            {l.short}
            {l.to === '/revisao' && !!summary?.reviews_due && (
              <span className="absolute top-1 right-[calc(50%-18px)] grid min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">
                {summary.reviews_due}
              </span>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-ink-3"
        >
          <Icon name="more" className="size-5" />
          Mais
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <button type="button" aria-label="Fechar" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-ink-1/30" />
          <div className="relative w-full rounded-t-2xl bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            {summary && (
              <div className="mb-3">
                <GoalWidget key={summary.daily_goal} summary={summary} />
              </div>
            )}
            <nav className="grid gap-1">
              {LINKS.filter((l) => !l.mobile).map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-ink-2 hover:bg-ink-1/5"
                >
                  <Icon name={l.icon} />
                  {l.label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-bad hover:bg-bad-soft"
              >
                <Icon name="logout" /> Sair
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
