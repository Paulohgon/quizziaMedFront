import { useMutation, useQueryClient } from '@tanstack/react-query'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, formatDuration, newKey, pct, type AnswerResult, type ExamProgress, type Letter, type Question } from '../api'
import { clearSimulado, saveSimuladoProgress } from '../examSession'
import { useStopwatch, useTick } from '../stopwatch'
import { QuestionView } from './QuestionView'
import { Button, Card, ErrorMessage, Icon } from './ui'

type Answers = Record<number, Letter>

interface Props {
  title: string
  questions: Question[]
  kind: 'prova' | 'simulado'
  examId?: number
  /** Tempo total em segundos; null = sem cronômetro. */
  timeLimitS: number | null
  /** Progresso salvo de uma tentativa interrompida, para continuar de onde parou. */
  initialProgress?: ExamProgress | null
  /** Chave da entrega (idempotência); sem ela, uma nova por tela de prova. */
  attemptKey?: string
  onExit: () => void
}

const CONFLICT = 'Esta prova mudou em outra aba ou dispositivo (ou já foi entregue). Recarregue para continuar de onde ela está.'

interface Outcome {
  results: Record<number, AnswerResult>
  durationS: number
  timedOut: boolean
}

/**
 * Executa um simulado ou prova completa: navegação entre questões, cronômetro
 * regressivo (entrega automática ao zerar), pausa e tempo gasto por questão.
 * O progresso fica salvo até entregar (prova no servidor, simulado no
 * navegador). As respostas só são corrigidas e gravadas ao entregar.
 */
export function ExamRunner({ title, questions, kind, examId, timeLimitS, initialProgress, attemptKey, onExit }: Props) {
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<Answers>(initialProgress?.answers ?? {})
  const [current, setCurrent] = useState(Math.min(initialProgress?.current ?? 0, questions.length - 1))
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // Tempo ativo de prova (ms): não conta pausas nem o tempo fora da página.
  const clock = useStopwatch(initialProgress?.elapsed_ms ?? 0)
  // Tempo acumulado em cada questão (ms), somado ao sair dela.
  const timePerQuestion = useRef<Record<number, number>>({ ...initialProgress?.time_per_question })
  const viewStart = useRef(initialProgress?.elapsed_ms ?? 0)
  // Já entregou (ou está entregando): não há mais progresso a salvar.
  const delivered = useRef(false)
  // Questão atual também em ref, para os callbacks abaixo não mudarem a cada navegação.
  const currentRef = useRef(current)
  currentRef.current = current
  // Prova: revisão do progresso no servidor que esta aba conhece. As gravações vão em fila
  // (uma por vez, cada uma com a rev devolvida pela anterior); se outra aba gravou ou a prova
  // já foi entregue, o servidor responde 409 e esta aba para e pede para recarregar.
  const rev = useRef<string | null>(initialProgress?.rev ?? null)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const saving = useRef(false)
  const clientKey = useRef(attemptKey ?? newKey())
  // A pessoa fez algo nesta aba (navegou ou respondeu)? Só abrir e sair não grava nada:
  // senão uma aba aberta à toa "tomaria" a prova de outra aba em uso.
  const touched = useRef(false)
  const startElapsed = useRef(initialProgress?.elapsed_ms ?? 0)
  const readClock = clock.read
  // Mensagem de conflito (outra aba mudou a prova, ou esta entrega já tinha sido feita).
  const [conflict, setConflict] = useState<string | null>(null)
  const conflictRef = useRef(false)
  const markConflict = useCallback((message: string) => {
    conflictRef.current = true
    setConflict(message)
  }, [])
  // Só o <ExamClock> re-renderiza a cada segundo; esta tela só quando algo muda de fato.

  const leaveQuestion = useCallback(() => {
    const id = questions[currentRef.current]?.id
    const t = clock.read()
    if (id != null) timePerQuestion.current[id] = (timePerQuestion.current[id] ?? 0) + (t - viewStart.current)
    viewStart.current = t
  }, [questions, clock])

  const finish = useMutation({
    mutationFn: async (timedOut: boolean) => {
      delivered.current = true
      clock.pause()
      leaveQuestion()
      const durationS = Math.round(clock.read() / 1000)
      // Espera a última gravação do progresso terminar (a entrega confere a rev dela).
      await saveQueue.current
      if (conflictRef.current) throw new ApiError(409, 'Esta prova mudou em outra aba.')
      // Uma requisição só: o servidor corrige e grava tudo de uma vez.
      const { results } = await api.submitAttempt({
        kind,
        exam_id: examId ?? null,
        question_ids: questions.map((q) => q.id),
        answers: questions
          .filter((q) => answers[q.id])
          .map((q) => {
            const ms = timePerQuestion.current[q.id]
            return { question_id: q.id, chosen: answers[q.id], time_spent_ms: ms == null ? null : Math.min(Math.round(ms), 3_600_000) }
          }),
        time_limit_s: timeLimitS,
        duration_s: durationS,
        progress_rev: kind === 'prova' ? rev.current : null,
        client_key: clientKey.current,
      })
      return { results, durationS, timedOut }
    },
    onError: (error) => {
      delivered.current = false
      if (error instanceof ApiError && error.status === 409) {
        // Simulado já entregue (a resposta tinha se perdido): não há mais o que continuar.
        if (kind === 'simulado') clearSimulado()
        markConflict(kind === 'simulado' ? 'Este simulado já tinha sido entregue. O resultado está no histórico de tentativas.' : CONFLICT)
      } else clock.resume()
    },
    onSuccess: (out) => {
      // O servidor já apaga o progresso da prova ao gravar a tentativa.
      if (kind === 'simulado') clearSimulado()
      setOutcome(out)
      for (const key of ['stats', 'exams', 'summary', 'attempts', 'progress']) queryClient.invalidateQueries({ queryKey: [key] })
      window.scrollTo({ top: 0 })
    },
  })

  // Entrega automática quando o tempo acaba (`mutate` é estável).
  const { mutate: deliver } = finish
  const onTimeUp = useCallback(() => {
    if (!delivered.current) deliver(true)
  }, [deliver])

  /** Ponto atual da prova, incluindo o tempo já gasto na questão aberta. */
  function snapshot(): ExamProgress {
    const t = clock.read()
    const id = questions[current]?.id
    const perQuestion = { ...timePerQuestion.current }
    if (id != null) perQuestion[id] = (perQuestion[id] ?? 0) + (t - viewStart.current)
    for (const k in perQuestion) perQuestion[k] = Math.round(perQuestion[k])
    return { answers, current, elapsed_ms: Math.round(t), time_per_question: perQuestion }
  }
  const latest = useRef(snapshot)
  latest.current = snapshot

  // Simulado: salva no navegador a cada mudança e a cada segundo (sem re-renderizar).
  useEffect(() => {
    if (kind !== 'simulado' || outcome) return
    const save = () => {
      if (!delivered.current) saveSimuladoProgress(latest.current())
    }
    save()
    const id = setInterval(save, 1000)
    return () => clearInterval(id)
  }, [kind, outcome, answers, current])

  /** Prova: grava o progresso no servidor, em fila (ver `rev`). */
  const saveProgress = useCallback(() => {
    if (kind !== 'prova' || examId == null) return
    saveQueue.current = saveQueue.current.then(async () => {
      if (delivered.current || conflictRef.current) return
      saving.current = true
      try {
        const saved = await api.saveProgress(examId, { ...latest.current(), rev: rev.current })
        rev.current = saved.rev ?? null
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) markConflict(CONFLICT)
      } finally {
        saving.current = false
      }
    })
  }, [kind, examId, markConflict])

  // Prova: salva no servidor quando uma resposta muda...
  const initialAnswers = useRef(answers)
  useEffect(() => {
    if (answers !== initialAnswers.current) saveProgress()
  }, [answers, saveProgress])

  // ...e ao sair dela (trocar de página ou fechar a aba), para guardar a questão e o tempo.
  // Ao fechar a aba não dá para esperar a fila: envia direto (keepalive). Se uma gravação
  // ainda estiver em andamento, a dela já leva as respostas; esta só perderia a posição.
  useEffect(() => {
    if (kind !== 'prova' || examId == null) return
    const leave = () => {
      if (delivered.current || conflictRef.current || saving.current) return
      // Sem ação e menos de 5 s nesta aba: nada a guardar.
      if (!touched.current && readClock() - startElapsed.current < 5000) return
      const progress = latest.current()
      if (rev.current == null && !Object.keys(progress.answers).length && !progress.current) return
      api.saveProgress(examId, { ...progress, rev: rev.current }, true).then(
        (saved) => (rev.current = saved.rev ?? null),
        () => {},
      )
    }
    window.addEventListener('pagehide', leave)
    return () => {
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [kind, examId, readClock])

  // Durante a prova, esconde a navegação inferior do celular (evita sair sem querer).
  useEffect(() => {
    if (outcome) return
    document.body.dataset.exam = '1'
    return () => {
      delete document.body.dataset.exam
    }
  }, [outcome])

  const goTo = useCallback(
    (index: number) => {
      touched.current = true
      leaveQuestion()
      setCurrent(index)
      window.scrollTo({ top: 0 })
    },
    [leaveQuestion],
  )

  const q = questions[current]
  const qid = q.id
  const select = useCallback(
    (letter: Letter) => {
      if (conflictRef.current) return
      touched.current = true
      setAnswers((a) => ({ ...a, [qid]: letter }))
    },
    [qid],
  )

  if (outcome) {
    return <Result title={title} questions={questions} answers={answers} outcome={outcome} timeLimitS={timeLimitS} onExit={onExit} />
  }

  const answered = Object.keys(answers).length

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="sticky top-[61px] z-20 -mx-4 flex items-center justify-between gap-2 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur sm:gap-3 sm:py-3 lg:top-0">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onExit}
            title="Sair (o progresso fica salvo para continuar depois)"
            aria-label="Sair da prova (o progresso fica salvo)"
            className="-ml-2 grid size-10 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink-1"
          >
            <Icon name="arrowLeft" className="size-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold sm:text-lg" title={title}>
              {title}
            </h1>
            <p className="truncate text-xs text-ink-3">
              {answered} de {questions.length} respondidas
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ExamClock clock={clock} timeLimitS={timeLimitS} disabled={finish.isPending} onTimeUp={onTimeUp} />
          <Button
            variant="secondary"
            disabled={finish.isPending || conflict != null}
            onClick={() => {
              if (answered === questions.length || confirm('Ainda há questões sem resposta. Entregar mesmo assim?')) finish.mutate(false)
            }}
          >
            {finish.isPending ? 'Corrigindo…' : 'Entregar'}
          </Button>
        </div>
      </div>
      {conflict ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          <span>{conflict}</span>
          {kind === 'prova' ? (
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Recarregar
            </Button>
          ) : (
            <Button variant="secondary" onClick={onExit}>
              Voltar
            </Button>
          )}
        </div>
      ) : (
        finish.error && <ErrorMessage error={finish.error} />
      )}
      {finish.isPaused && (
        <p role="status" className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          Sem internet. A entrega será enviada assim que a conexão voltar — não feche esta página.
        </p>
      )}

      <QuestionGrid questions={questions} answers={answers} current={current} onGo={goTo} />

      <QuestionView
        key={q.id}
        question={q}
        mode="exam"
        label={`${current + 1} de ${questions.length}`}
        selected={answers[q.id] ?? null}
        onSelect={select}
      />

      <div className="flex justify-between">
        <Button variant="secondary" disabled={current === 0} onClick={() => goTo(current - 1)}>
          <Icon name="arrowLeft" className="size-4" /> Anterior
        </Button>
        <Button disabled={current === questions.length - 1} onClick={() => goTo(current + 1)}>
          Próxima <Icon name="arrowRight" className="size-4" />
        </Button>
      </div>
    </div>
  )
}

/**
 * Cronômetro da prova (clique para pausar). É o único trecho que re-renderiza a
 * cada segundo; avisa `onTimeUp` uma vez quando o tempo acaba.
 */
const ExamClock = memo(function ExamClock({
  clock,
  timeLimitS,
  disabled,
  onTimeUp,
}: {
  clock: ReturnType<typeof useStopwatch>
  timeLimitS: number | null
  disabled: boolean
  onTimeUp: () => void
}) {
  useTick(!clock.paused)
  const elapsedS = clock.read() / 1000
  const remainingS = timeLimitS != null ? timeLimitS - elapsedS : null
  const timeUp = remainingS != null && remainingS <= 0
  const fired = useRef(false)
  useEffect(() => {
    if (timeUp && !fired.current) {
      fired.current = true
      onTimeUp()
    }
  }, [timeUp, onTimeUp])

  const lowTime = remainingS != null && remainingS < 15 * 60
  const label = clock.paused ? 'Voltar a contar o tempo' : 'Parar de contar o tempo'
  return (
    <button
      type="button"
      onClick={clock.toggle}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 font-display text-base font-bold tabular-nums transition sm:px-3 sm:text-lg ${
        clock.paused
          ? 'bg-warn-soft text-warn ring-1 ring-warn/20'
          : lowTime
            ? 'bg-bad-soft text-bad'
            : 'bg-surface text-ink-1 ring-1 ring-line hover:ring-brand-300'
      }`}
    >
      <Icon name={clock.paused ? 'play' : 'pause'} className="size-4" />
      {formatDuration(remainingS ?? elapsedS)}
      {clock.paused && <span className="font-sans text-xs font-semibold">pausado</span>}
    </button>
  )
})

/**
 * Grade de navegação (até 150 botões): só re-renderiza ao responder ou trocar de questão.
 * No celular, provas grandes ocupariam mais de uma tela: a grade fica recolhida atrás de um botão.
 */
const QuestionGrid = memo(function QuestionGrid({
  questions,
  answers,
  current,
  onGo,
}: {
  questions: Question[]
  answers: Answers
  current: number
  onGo: (index: number) => void
}) {
  const [open, setOpen] = useState(false)
  const collapsible = questions.length > 20
  const answered = questions.filter((q) => answers[q.id]).length
  return (
    <div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-11 w-full items-center justify-between rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink-2 lg:hidden"
        >
          <span>
            Questão {current + 1} de {questions.length} · {answered} respondidas
          </span>
          <span className="inline-flex items-center gap-1 text-brand-700">
            {open ? 'Fechar mapa' : 'Ver todas'}
            <Icon name="arrowRight" className={`size-4 transition ${open ? '-rotate-90' : 'rotate-90'}`} />
          </span>
        </button>
      )}
      <div className={`flex-wrap gap-1.5 ${collapsible ? (open ? 'mt-3 flex' : 'hidden lg:flex') : 'flex'}`}>
        {questions.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onGo(i)
              setOpen(false)
            }}
            aria-label={`Questão ${i + 1}${answers[item.id] ? ', respondida' : ''}`}
            aria-current={i === current ? 'step' : undefined}
            className={`size-10 rounded-lg text-xs font-bold transition lg:size-9 ${
              i === current
                ? 'bg-brand-600 text-on-brand'
                : answers[item.id]
                  ? 'bg-brand-100 text-brand-800'
                  : 'bg-surface text-ink-3 ring-1 ring-line hover:ring-brand-300'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
})

function Result({
  title,
  questions,
  answers,
  outcome,
  timeLimitS,
  onExit,
}: {
  title: string
  questions: Question[]
  answers: Answers
  outcome: Outcome
  timeLimitS: number | null
  onExit: () => void
}) {
  const { results, durationS, timedOut } = outcome
  const scored = questions.filter((q) => !q.annulled)
  const correct = scored.filter((q) => results[q.id]?.is_correct).length
  const answered = Object.keys(results).length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-8 text-center">
        <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{title}</p>
        {timedOut && <p className="mt-2 text-sm font-semibold text-bad">O tempo acabou — a prova foi entregue automaticamente.</p>}
        <p className="mt-2 font-display text-6xl font-extrabold text-ink-1">{pct(correct, scored.length)}%</p>
        <p className="mt-1 text-ink-3">
          {correct} de {scored.length} questões válidas corretas
        </p>
        <dl className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-ink-3">Respondidas</dt>
            <dd className="font-semibold">
              {answered}/{questions.length}
            </dd>
          </div>
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-ink-3">Tempo</dt>
            <dd className="font-semibold">
              {formatDuration(durationS)}
              {timeLimitS && <span className="text-ink-3"> / {formatDuration(timeLimitS)}</span>}
            </dd>
          </div>
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-ink-3">Média/questão</dt>
            <dd className="font-semibold">{formatDuration(durationS / questions.length)}</dd>
          </div>
        </dl>
        <Button onClick={onExit} className="mt-6">
          Voltar
        </Button>
      </Card>

      <h2 className="text-lg font-bold">Correção</h2>
      <div className="space-y-6">
        {questions.map((q, i) => {
          const r = results[q.id]
          return (
            <QuestionView
              key={q.id}
              question={{ ...q, explanation: r?.explanation ?? null }}
              mode="review"
              label={`${i + 1} de ${questions.length}`}
              review={{ chosen: answers[q.id] ?? null, correct: r?.correct_answer ?? null, isCorrect: r ? r.is_correct : false }}
            />
          )
        })}
      </div>
    </div>
  )
}
