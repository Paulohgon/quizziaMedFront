import { useQuery } from '@tanstack/react-query'
import { api, formatDuration, pct } from '../api'
import { Badge, Card } from './ui'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Últimas provas completas e simulados entregues. */
export function AttemptHistory() {
  const { data } = useQuery({ queryKey: ['attempts'], queryFn: api.attempts })
  if (!data?.length) return null
  return (
    <Card className="overflow-hidden">
      <h2 className="px-5 pt-5 pb-3 font-bold sm:px-6">Provas e simulados feitos</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-line bg-canvas text-left text-xs tracking-wide text-ink-3 uppercase">
            <th className="px-5 py-2 font-semibold sm:px-6">Quando</th>
            <th className="px-3 py-2 font-semibold">Tipo</th>
            <th className="px-3 py-2 text-right font-semibold">Acerto</th>
            <th className="px-5 py-2 text-right font-semibold sm:px-6">Tempo</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.id} className="border-b border-line last:border-0">
              <td className="px-5 py-2.5 text-ink-2 sm:px-6">{dateFmt.format(new Date(a.finished_at))}</td>
              <td className="px-3 py-2.5">
                {a.kind === 'prova' ? <Badge tone="brand">{a.exam_label ?? 'Prova'}</Badge> : <Badge>Simulado · {a.total}</Badge>}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                {pct(a.correct, a.total - a.annulled)}%{' '}
                <span className="text-xs font-normal text-ink-3">
                  {a.correct}/{a.total - a.annulled}
                </span>
              </td>
              <td className="px-5 py-2.5 text-right text-ink-2 tabular-nums sm:px-6">
                {formatDuration(a.duration_s)}
                {a.time_limit_s && <span className="text-xs text-ink-3"> / {formatDuration(a.time_limit_s)}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
