import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatDuration, pct, SECONDS_PER_QUESTION, type Stats, type StatsGroup } from '../api'
import { AttemptHistory } from '../components/AttemptHistory'
import { Button, Card, EmptyState, ErrorMessage, PageHeader, Spinner } from '../components/ui'

export function StatsPage() {
  const { data, error, isLoading } = useQuery({ queryKey: ['stats'], queryFn: api.stats })

  if (isLoading) return <Spinner />
  if (error) return <ErrorMessage error={error} />
  if (!data) return null

  if (data.answered === 0) {
    return (
      <div>
        <PageHeader title="Desempenho" />
        <EmptyState icon="chart" title="Seu desempenho aparece aqui">
          <p>Responda algumas questões para ver acertos por área, por prova e sua evolução.</p>
          <Link to="/estudar" className="mt-5 inline-block">
            <Button>Começar a estudar</Button>
          </Link>
        </EmptyState>
      </div>
    )
  }

  const scored = data.correct + data.wrong
  return (
    <div className="space-y-6">
      <PageHeader title="Desempenho" subtitle="Considera a sua resposta mais recente em cada questão. Anuladas contam em “Feitas”, mas não entram no percentual." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Taxa de acerto" value={`${pct(data.correct, scored)}%`} hint={`${data.correct} de ${scored} questões`} />
        <Kpi label="Respondidas" value={data.answered} hint={`${pct(data.answered, data.total_questions)}% do banco`} />
        <Kpi label="Para refazer" value={data.wrong} hint="última resposta errada" link={data.wrong ? '/refazer' : undefined} />
        <Kpi
          label="Tempo médio"
          value={data.avg_time_s != null ? formatDuration(data.avg_time_s) : '—'}
          hint={
            data.avg_time_s == null
              ? `${data.attempts} tentativas`
              : data.avg_time_s > SECONDS_PER_QUESTION
                ? 'acima do ritmo de prova (~3 min)'
                : 'dentro do ritmo de prova (~3 min)'
          }
        />
      </div>

      <Card className="p-5 sm:p-6">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-bold">Progresso no banco</h2>
          <span className="text-sm text-ink-3">
            {data.answered} / {data.total_questions}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct(data.answered, data.total_questions)}%` }} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 sm:p-6 lg:col-span-3">
          <h2 className="font-bold">Acerto por grande área</h2>
          <p className="mb-5 text-sm text-ink-3">Percentual de acerto entre as questões respondidas.</p>
          <AccuracyBars groups={data.by_specialty} />
        </Card>
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <h2 className="font-bold">Últimos 30 dias</h2>
          <p className="mb-5 text-sm text-ink-3">Questões respondidas por dia.</p>
          <ActivityChart days={data.last_30_days} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GroupTable title="Por prova" groups={data.by_exam} />
        <GroupTable title="Por região" groups={data.by_region} />
      </div>

      <AttemptHistory />
    </div>
  )
}

function Kpi({ label, value, hint, link }: { label: string; value: string | number; hint: string; link?: string }) {
  const body = (
    <Card className={`h-full p-4 sm:p-5 ${link ? 'transition hover:border-brand-300' : ''}`}>
      <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold text-ink-1 tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-ink-3">{hint}</p>
    </Card>
  )
  return link ? <Link to={link}>{body}</Link> : body
}

/** Barras horizontais de série única: trilho neutro + preenchimento na cor da marca. */
function AccuracyBars({ groups }: { groups: StatsGroup[] }) {
  const rows = groups
    .map((g) => ({ ...g, scored: g.correct + g.wrong }))
    .filter((g) => g.scored > 0)
    .sort((a, b) => pct(b.correct, b.scored) - pct(a.correct, a.scored))
  if (rows.length === 0) return <p className="text-sm text-ink-3">Sem questões corrigidas ainda.</p>
  return (
    <ul className="space-y-4">
      {rows.map((g) => {
        const value = pct(g.correct, g.scored)
        return (
          <li key={g.label} title={`${g.label}: ${value}% (${g.correct} acertos em ${g.scored})`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-ink-1">{g.label}</span>
              <span className="shrink-0 text-ink-2 tabular-nums">
                <strong className="text-ink-1">{value}%</strong>{' '}
                <span className="text-xs text-ink-3">
                  {g.correct}/{g.scored}
                  {g.avg_time_s != null && (
                    <span className={g.avg_time_s > SECONDS_PER_QUESTION ? 'text-warn' : ''}>
                      {' '}
                      · {formatDuration(g.avg_time_s)}/questão
                    </span>
                  )}
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-line">
              <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.max(value, 1)}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

/** Colunas por dia (30 dias, incluindo os sem atividade), com tooltip ao passar o mouse. */
function ActivityChart({ days }: { days: Stats['last_30_days'] }) {
  const [hover, setHover] = useState<number | null>(null)
  const byDay = new Map(days.map((d) => [d.day, d]))
  const today = new Date()
  const series = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29 + i)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const d = byDay.get(key)
    return { date, attempts: d?.attempts ?? 0, correct: d?.correct ?? 0 }
  })
  const max = Math.max(1, ...series.map((d) => d.attempts))
  const total = series.reduce((n, d) => n + d.attempts, 0)
  const active = hover !== null ? series[hover] : null

  return (
    <div>
      <div className="mb-3 h-10 text-sm">
        {active ? (
          <>
            <p className="font-semibold text-ink-1">{dayFmt.format(active.date)}</p>
            <p className="text-ink-3">
              {active.attempts} {active.attempts === 1 ? 'resposta' : 'respostas'} · {active.correct} certas
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-ink-1">{total} respostas</p>
            <p className="text-ink-3">passe o mouse sobre um dia</p>
          </>
        )}
      </div>
      <div className="flex h-32 items-end gap-[2px] border-b border-line" onMouseLeave={() => setHover(null)}>
        {series.map((d, i) => (
          <div
            key={i}
            className="flex h-full flex-1 cursor-default items-end"
            onMouseEnter={() => setHover(i)}
            aria-label={`${dayFmt.format(d.date)}: ${d.attempts} respostas`}
          >
            <div
              className={`w-full rounded-t-[4px] transition-colors ${
                d.attempts === 0 ? 'bg-transparent' : hover === i ? 'bg-brand-700' : 'bg-brand-400'
              }`}
              style={{ height: `${(d.attempts / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-3">
        <span>{dayFmt.format(series[0].date)}</span>
        <span>hoje</span>
      </div>
    </div>
  )
}

function GroupTable({ title, groups }: { title: string; groups: StatsGroup[] }) {
  return (
    <Card className="overflow-hidden">
      <h2 className="px-5 pt-5 pb-3 font-bold sm:px-6">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-line bg-canvas text-left text-xs tracking-wide text-ink-3 uppercase">
            <th className="px-5 py-2 font-semibold sm:px-6">Nome</th>
            <th className="px-3 py-2 text-right font-semibold">Feitas</th>
            <th className="px-3 py-2 text-right font-semibold">Acertos</th>
            <th className="px-5 py-2 text-right font-semibold sm:px-6">%</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.label} className="border-b border-line last:border-0">
              <td className="px-5 py-2.5 font-medium sm:px-6">{g.label}</td>
              <td className="px-3 py-2.5 text-right text-ink-2 tabular-nums">{g.answered}</td>
              <td className="px-3 py-2.5 text-right text-ink-2 tabular-nums">{g.correct}</td>
              <td className="px-5 py-2.5 text-right font-semibold tabular-nums sm:px-6">
                {pct(g.correct, g.correct + g.wrong)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
