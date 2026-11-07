import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, pct, type ExamSummary } from '../api'
import { Badge, Button, Card, ErrorMessage, Icon, PageHeader, Spinner } from '../components/ui'

export function ExamsPage() {
  const { data: exams, error, isLoading } = useQuery({ queryKey: ['exams'], queryFn: api.exams })

  const byInstitution = new Map<string, ExamSummary[]>()
  for (const e of exams ?? []) byInstitution.set(e.institution, [...(byInstitution.get(e.institution) ?? []), e])

  return (
    <div>
      <PageHeader title="Provas" subtitle="Provas de residência no banco, com o seu progresso em cada uma." />
      {isLoading && <Spinner />}
      {error && <ErrorMessage error={error} />}

      <div className="space-y-8">
        {[...byInstitution].map(([institution, list]) => (
          <section key={institution}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              {institution}
              <Badge>
                {list[0].region}
                {list[0].state && ` · ${list[0].state}`}
              </Badge>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((e) => (
                <ExamCard key={e.id} exam={e} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function ExamCard({ exam: e }: { exam: ExamSummary }) {
  const valid = e.question_count - e.annulled_count
  const progress = pct(e.answered_count, e.question_count)
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-3xl font-extrabold text-ink-1">{e.exam_year}</p>
          <p className="text-xs text-ink-3">{[e.board, e.exam_variant, e.access_type].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {e.answered_count > 0 && <Badge tone="good">{pct(e.correct_count, e.answered_count)}% de acerto</Badge>}
          {e.source_type === 'third_party' && (
            <span title="Texto e gabarito obtidos de compilação da Medway (sem cópia oficial disponível)">
              <Badge>via Medway</Badge>
            </span>
          )}
        </div>
      </div>

      <dl className="mt-4 flex gap-4 text-sm">
        <div>
          <dt className="text-xs text-ink-3">Questões</dt>
          <dd className="font-semibold">{valid}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Anuladas</dt>
          <dd className="font-semibold">{e.annulled_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Feitas</dt>
          <dd className="font-semibold">{e.answered_count}</dd>
        </div>
      </dl>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" title={`${progress}% respondida`}>
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-5 flex flex-1 items-end justify-between gap-2">
        <Link to={`/estudar?exam_id=${e.id}`} className="flex-1">
          <Button className="w-full">{e.answered_count ? 'Continuar' : 'Estudar'}</Button>
        </Link>
        <Link to={`/prova/${e.id}`} title="Fazer a prova inteira com cronômetro, como no dia">
          <Button variant="secondary" className="px-3">
            <Icon name="timer" className="size-4" /> Prova
          </Button>
        </Link>
        <a
          href={e.source_url}
          target="_blank"
          rel="noreferrer"
          title={e.source_type === 'official' ? 'Caderno oficial (PDF)' : 'Caderno (PDF da Medway)'}
          className="rounded-xl border border-line p-2.5 text-ink-3 hover:bg-canvas hover:text-ink-1"
        >
          <Icon name="external" className="size-4" />
        </a>
      </div>
    </Card>
  )
}
