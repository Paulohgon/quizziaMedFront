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
  { value: 'favoritas', label: 'Favoritas', icon: 'star' as const },
  { value: 'anotacoes', label: 'Anotações', icon: 'pencil' as const },
]

export function NotebookPage() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState<number | null>(null)
  const tab = params.get('aba') === 'anotacoes' ? 'anotacoes' : 'favoritas'
  const page = Number(params.get('page') ?? 1)

  const apiParams = new URLSearchParams(params)
  apiParams.delete('aba')
  apiParams.set(tab === 'favoritas' ? 'favorite' : 'has_note', 'true')
  apiParams.set('reveal', 'true')
  apiParams.set('include_annulled', 'true')
  apiParams.set('page_size', String(PAGE_SIZE))

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ['notebook', apiParams.toString()],
    queryFn: () => api.questions(apiParams),
    placeholderData: keepPreviousData,
  })

  function setTab(value: string) {
    const next = new URLSearchParams(params)
    next.set('aba', value)
    next.delete('page')
    setParams(next)
    setOpen(null)
  }

  return (
    <div>
      <PageHeader title="Favoritas e notas" subtitle="As questões que você marcou com estrela e as suas anotações." />

      <div className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1 shadow-card" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.value ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-2 hover:bg-ink-1/5'
            }`}
          >
            <Icon name={t.icon} className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      <FilterBar params={params} onChange={setParams} />

      {isLoading && <Spinner />}
      {error && <ErrorMessage error={error} />}

      {data?.items.length === 0 && (
        <EmptyState icon={tab === 'favoritas' ? 'star' : 'pencil'} title={tab === 'favoritas' ? 'Nenhuma favorita ainda' : 'Nenhuma anotação ainda'}>
          <p>
            {tab === 'favoritas'
              ? 'Toque na estrela no topo de qualquer questão para guardá-la aqui.'
              : 'Depois de responder uma questão, use “Adicionar anotação” para registrar o que aprendeu.'}
          </p>
          <Link to="/estudar" className="mt-5 inline-block">
            <Button>Ir estudar</Button>
          </Link>
        </EmptyState>
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
              {q.my_answer ? (
                <QuestionView
                  question={q}
                  mode="review"
                  review={{ chosen: q.my_answer.chosen, correct: q.correct_answer, isCorrect: q.my_answer.is_correct }}
                />
              ) : (
                <QuestionView question={q} mode="practice" />
              )}
            </div>
          ) : (
            <NotebookRow key={q.id} question={q} showNote={tab === 'anotacoes'} onOpen={() => setOpen(q.id)} />
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

function NotebookRow({ question: q, showNote, onOpen }: { question: Question; showNote: boolean; onOpen: () => void }) {
  return (
    <Card className="transition hover:border-brand-200">
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-4 p-4 text-left sm:p-5">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-500">
          <Icon name={showNote ? 'pencil' : 'star'} filled={!showNote} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
            <span className="font-semibold text-ink-2">
              {q.exam.institution} {q.exam.exam_year} · Q{q.question_number}
            </span>
            {q.specialty && <Badge tone="brand">{q.specialty}</Badge>}
            {q.my_answer ? (
              <Badge tone={q.my_answer.is_correct ? 'good' : q.my_answer.is_correct === false ? 'bad' : 'neutral'}>
                {q.my_answer.is_correct ? 'Acertou' : q.my_answer.is_correct === false ? 'Errou' : 'Anulada'}
              </Badge>
            ) : (
              <Badge>Não respondida</Badge>
            )}
          </div>
          {showNote && q.note ? (
            <p className="mt-1.5 line-clamp-2 text-sm text-ink-1 italic">“{q.note}”</p>
          ) : (
            <p className="mt-1.5 line-clamp-2 text-sm text-ink-1">{q.statement}</p>
          )}
        </div>
      </button>
    </Card>
  )
}
