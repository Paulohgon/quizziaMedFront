import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, pct, type AnswerResult } from '../api'
import { FilterBar } from '../components/FilterPanel'
import { QuestionView } from '../components/QuestionView'
import { Button, Card, EmptyState, ErrorMessage, Icon, Spinner } from '../components/ui'

const BATCH = 20

interface Props {
  status: 'unanswered' | 'wrong' | 'review'
}

const COPY: Record<Props['status'], { title: string; subtitle?: string; emptyTitle: string; empty: string }> = {
  unanswered: {
    title: 'Estudar',
    emptyTitle: 'Você respondeu todas as questões destes filtros',
    empty: 'Mude os filtros para continuar, ou revise o que errou em “Refazer erradas”.',
  },
  review: {
    title: 'Revisão do dia',
    subtitle:
      'Revisão espaçada: cada questão errada volta em 1, 3, 7 e 15 dias. Acertou duas vezes seguidas, ela sai da fila.',
    emptyTitle: 'Nenhuma revisão pendente hoje',
    empty:
      'Quando você errar uma questão, ela volta para cá no dia certo. Enquanto isso, continue estudando questões novas.',
  },
  wrong: {
    title: 'Refazer erradas',
    subtitle: 'Questões cuja última resposta foi errada. O gabarito fica escondido até você responder de novo.',
    emptyTitle: 'Nenhuma questão errada por aqui',
    empty: 'Quando você errar uma questão, ela aparece aqui para tentar de novo. Acertou? Ela sai da lista.',
  },
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

/** Ex.: "Sábado, 7 de novembro". */
function today() {
  const s = dateFmt.format(new Date())
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function StudyPage({ status }: Props) {
  const [params, setParams] = useSearchParams()
  const [round, setRound] = useState(0)
  // A posição pertence a uma combinação filtros+rodada: mudou o filtro, volta para o início.
  const [pos, setPos] = useState({ key: '', index: 0 })
  const [session, setSession] = useState({ answered: 0, correct: 0 })
  const random = params.get('ordem') === 'aleatoria'
  const copy = COPY[status]

  const apiParams = new URLSearchParams(params)
  apiParams.delete('ordem')
  apiParams.set('status', status)
  apiParams.set('page_size', String(BATCH))
  if (random) apiParams.set('random', 'true')

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ['study', status, apiParams.toString(), round],
    queryFn: () => api.questions(apiParams),
    // Fixo enquanto a página está aberta; ao sair, descarta o bloco para que, ao voltar,
    // venha um novo sem as questões já respondidas.
    staleTime: Infinity,
    gcTime: 0,
  })

  const posKey = `${params.toString()}#${round}`
  const index = pos.key === posKey ? pos.index : 0

  const items = data?.items ?? []
  const question = items[index]
  const finishedBatch = data && index >= items.length && items.length > 0

  function onAnswered(result: AnswerResult) {
    if (result.is_correct === null) return
    setSession((s) => ({
      answered: s.answered + 1,
      correct: s.correct + (result.is_correct ? 1 : 0),
    }))
  }

  function next() {
    setPos({ key: posKey, index: index + 1 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function newRound() {
    setRound((r) => r + 1)
  }

  const randomToggle = (
    <label className="flex min-h-10 cursor-pointer items-center gap-2 px-1 text-[13px] text-ink-2">
      <input
        type="checkbox"
        checked={random}
        onChange={(e) => {
          const nextParams = new URLSearchParams(params)
          if (e.target.checked) nextParams.set('ordem', 'aleatoria')
          else nextParams.delete('ordem')
          setParams(nextParams)
        }}
        className="size-5 accent-brand-600"
      />
      Ordem aleatória
    </label>
  )

  return (
    <div className="mx-auto max-w-[860px]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-3">{today()}</p>
          <h1 className="text-[26px] leading-tight font-extrabold text-ink-1 sm:text-[32px]">{copy.title}</h1>
          {copy.subtitle && <p className="mt-1 max-w-xl text-sm text-ink-3">{copy.subtitle}</p>}
        </div>
        {session.answered > 0 && (
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Nesta sessão</p>
            <p className="mt-0.5 text-sm font-bold">
              {session.correct}/{session.answered}{' '}
              <span className="font-medium text-good">· {pct(session.correct, session.answered)}%</span>
            </p>
          </div>
        )}
      </header>

      <FilterBar params={params} onChange={setParams} trailing={randomToggle} />

      {data && data.total > 0 && (
        <div className="mb-5 space-y-2">
          <div className="flex flex-wrap justify-between gap-2 text-[13px] text-ink-3">
            <span>
              <strong className="font-semibold text-ink-1">{data.total.toLocaleString('pt-BR')}</strong>{' '}
              {status === 'wrong'
                ? 'para refazer'
                : status === 'review'
                  ? data.total === 1
                    ? 'revisão para hoje'
                    : 'revisões para hoje'
                  : data.total === 1
                    ? 'questão restante'
                    : 'questões restantes'}
            </span>
            {question && (
              <span>
                {Math.min(index + 1, items.length)} de {items.length} nesta rodada
              </span>
            )}
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${(Math.min(index, items.length) / items.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {(isLoading || (isFetching && !question)) && <Spinner label="Buscando questões…" />}
      {error && <ErrorMessage error={error} />}

      {data && items.length === 0 && !isFetching && (
        <EmptyState icon={status === 'unanswered' ? 'sparkle' : 'check'} title={copy.emptyTitle}>
          <p>{copy.empty}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to="/desempenho">
              <Button variant="secondary">Ver meu desempenho</Button>
            </Link>
            {status !== 'wrong' && (
              <Link to={status === 'review' ? '/estudar' : '/refazer'}>
                <Button>{status === 'review' ? 'Estudar questões novas' : 'Refazer erradas'}</Button>
              </Link>
            )}
          </div>
        </EmptyState>
      )}

      {question && (
        <QuestionView
          key={`${round}-${question.id}`}
          question={question}
          mode="practice"
          onAnswered={onAnswered}
          onSkip={next}
        >
          <div className="flex justify-end">
            <Button onClick={next} className="px-6">
              Próxima questão <Icon name="arrowRight" className="size-4" />
            </Button>
          </div>
        </QuestionView>
      )}

      {finishedBatch && (
        <Card className="px-6 py-10 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <Icon name="check" className="size-6" />
          </div>
          <h2 className="text-xl font-bold">Rodada concluída</h2>
          <p className="mt-1 text-sm text-ink-3">
            {status === 'wrong'
              ? 'As que você acertou saíram da lista. Quer tentar de novo as que ainda estão erradas?'
              : status === 'review'
                ? 'As revisões respondidas foram reagendadas. Veja se ainda há outras vencidas.'
                : 'Bora para a próxima leva de questões?'}
          </p>
          <Button onClick={newRound} className="mt-5">
            {status === 'unanswered' ? 'Continuar estudando' : 'Nova rodada'}
          </Button>
        </Card>
      )}
    </div>
  )
}
