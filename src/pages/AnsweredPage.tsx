import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Question } from '../api'
import { FilterBar } from '../components/FilterPanel'
import { Pagination } from '../components/Pagination'
import { QuestionView } from '../components/QuestionView'
import { Badge, Button, Card, EmptyState, ErrorMessage, Icon, PageHeader, Spinner } from '../components/ui'

const PAGE_SIZE = 15

const TABS = [
  { value: 'answered', label: 'Todas' },
  { value: 'correct', label: 'Acertei' },
  { value: 'wrong', label: 'Errei' },
] as const

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function AnsweredPage() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState<number | null>(null)
  const tab = (params.get('status') as (typeof TABS)[number]['value']) ?? 'answered'
  const page = Number(params.get('page') ?? 1)

  const apiParams = new URLSearchParams(params)
  apiParams.set('status', tab)
  apiParams.set('reveal', 'true')
  apiParams.set('include_annulled', 'true')
  apiParams.set('page_size', String(PAGE_SIZE))

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ['answered', apiParams.toString()],
    queryFn: () => api.questions(apiParams),
    placeholderData: keepPreviousData,
  })

  function setTab(value: string) {
    const next = new URLSearchParams(params)
    if (value === 'answered') next.delete('status')
    else next.set('status', value)
    next.delete('page')
    setParams(next)
    setOpen(null)
  }

  return (
    <div>
      <PageHeader title="Respondidas" subtitle="Tudo o que você já respondeu, com a sua resposta e o gabarito oficial." />

      <div className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1 shadow-card" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`min-h-10 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.value ? 'bg-brand-600 text-on-brand shadow-sm' : 'text-ink-2 hover:bg-ink-1/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FilterBar params={params} onChange={setParams} />

      {isLoading && <Spinner />}
      {error && <ErrorMessage error={error} />}

      {data?.items.length === 0 && (
        <EmptyState icon="list" title="Nada por aqui ainda">
          <p>As questões que você responder aparecem nesta lista.</p>
          <Link to="/estudar" className="mt-5 inline-block">
            <Button>Começar a estudar</Button>
          </Link>
        </EmptyState>
      )}

      {data && data.total > 0 && (
        <p className="mb-3 text-sm text-ink-3">
          <strong className="text-ink-1">{data.total}</strong> {data.total === 1 ? 'questão' : 'questões'}
        </p>
      )}

      <div className={`space-y-3 ${isFetching && !isLoading ? 'opacity-60' : ''}`}>
        {data?.items.map((q) =>
          open === q.id ? (
            <div key={q.id} className="space-y-2">
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-ink-1"
              >
                <Icon name="arrowLeft" className="size-4" /> Fechar
              </button>
              <QuestionView
                question={q}
                mode="review"
                review={{
                  chosen: q.my_answer?.chosen ?? null,
                  correct: q.correct_answer,
                  isCorrect: q.my_answer?.is_correct ?? null,
                }}
              />
            </div>
          ) : (
            <AnsweredRow key={q.id} question={q} onOpen={() => setOpen(q.id)} />
          ),
        )}
      </div>

      {data && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          onPage={(p) => {
            const next = new URLSearchParams(params)
            next.set('page', String(p))
            setParams(next)
            setOpen(null)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}
    </div>
  )
}

function AnsweredRow({ question: q, onOpen }: { question: Question; onOpen: () => void }) {
  const a = q.my_answer!
  const state = a.is_correct === null ? 'annulled' : a.is_correct ? 'good' : 'bad'
  return (
    <Card className="transition hover:border-brand-200">
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-4 p-4 text-left sm:p-5">
        <span
          className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${
            state === 'good' ? 'bg-good-soft text-good' : state === 'bad' ? 'bg-bad-soft text-bad' : 'bg-ink-1/5 text-ink-3'
          }`}
          title={state === 'good' ? 'Acertou' : state === 'bad' ? 'Errou' : 'Anulada'}
        >
          <Icon name={state === 'good' ? 'check' : state === 'bad' ? 'x' : 'info'} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
            <span className="font-semibold text-ink-2">
              {q.exam.institution} {q.exam.exam_year} · Q{q.question_number}
            </span>
            {q.specialty && <Badge tone="brand">{q.specialty}</Badge>}
            <span>{dateFmt.format(new Date(a.answered_at))}</span>
            {a.attempts > 1 && <span>· {a.attempts} tentativas</span>}
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-1">{q.statement}</p>
        </div>
        <div className="hidden shrink-0 text-right text-xs sm:block">
          <p className="text-ink-3">
            Sua: <strong className={state === 'bad' ? 'text-bad' : 'text-ink-1'}>{a.chosen}</strong>
          </p>
          <p className="text-ink-3">
            Gabarito: <strong className="text-good">{q.correct_answer ?? '—'}</strong>
          </p>
        </div>
      </button>
    </Card>
  )
}
