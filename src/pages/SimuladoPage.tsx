import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { api, formatDuration, newKey, SECONDS_PER_QUESTION, type ExamProgress } from '../api'
import { AttemptHistory } from '../components/AttemptHistory'
import { ExamRunner } from '../components/ExamRunner'
import { FilterPanel } from '../components/FilterPanel'
import { clearSimulado, loadSimulado, startSimulado, type SavedSimulado } from '../examSession'
import { Button, Card, ErrorMessage, PageHeader } from '../components/ui'

const SIZES = [
  { n: 10, hint: 'rápido' },
  { n: 20, hint: '' },
  { n: 50, hint: '' },
  { n: 100, hint: 'AMRIGS, ENARE, SUS-SP' },
  { n: 120, hint: 'FUVEST' },
]
const MAX_SIZE = 150

export function SimuladoPage() {
  const [filters, setFilters] = useState(new URLSearchParams())
  const [size, setSize] = useState(20)
  const [onlyNew, setOnlyNew] = useState(true)
  const [timed, setTimed] = useState(true)
  const [run, setRun] = useState<(SavedSimulado & { progress: ExamProgress | null }) | null>(null)
  // Simulado interrompido no meio, salvo no navegador.
  const [pending, setPending] = useState(loadSimulado)

  const start = useMutation({
    mutationFn: () => {
      const params = new URLSearchParams(filters)
      params.set('random', 'true')
      params.set('page_size', String(size))
      if (onlyNew) params.set('status', 'unanswered')
      return api.questions(params)
    },
    onSuccess: (data) => {
      if (!data.items.length) return
      const saved = { questions: data.items, timeLimitS: timed ? data.items.length * SECONDS_PER_QUESTION : null, key: newKey() }
      startSimulado(saved)
      setRun({ ...saved, progress: null })
    },
  })

  if (run) {
    return (
      <ExamRunner
        title={`Simulado · ${run.questions.length} questões`}
        questions={run.questions}
        kind="simulado"
        timeLimitS={run.timeLimitS}
        initialProgress={run.progress}
        attemptKey={run.key}
        onExit={() => {
          setRun(null)
          setPending(loadSimulado())
        }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Simulado" subtitle="Questões sorteadas, sem correção até o final — como no dia da prova." />
      {pending && (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold">Simulado em andamento · {pending.questions.length} questões</p>
            <p className="text-sm text-ink-3">
              {Object.keys(pending.progress?.answers ?? {}).length} respondidas ·{' '}
              {pending.timeLimitS != null
                ? `${formatDuration(pending.timeLimitS - (pending.progress?.elapsed_ms ?? 0) / 1000)} restantes`
                : `${formatDuration((pending.progress?.elapsed_ms ?? 0) / 1000)} decorridos`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (!confirm('Descartar o simulado em andamento?')) return
                clearSimulado()
                setPending(null)
              }}
            >
              Descartar
            </Button>
            <Button onClick={() => setRun(pending)}>Continuar de onde parei</Button>
          </div>
        </Card>
      )}
      <Card className="space-y-6 p-5 sm:p-7">
        <FilterPanel params={filters} onChange={setFilters} />
        <div className="space-y-4 border-t border-line pt-5">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Quantidade</p>
            <div className="flex flex-wrap items-stretch gap-2">
              {SIZES.map(({ n, hint }) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSize(n)}
                  aria-label={`${n} questões${hint ? ` (${hint})` : ''}`}
                  aria-pressed={size === n}
                  className={`flex flex-col items-center justify-center rounded-xl border px-5 py-2 text-sm font-semibold ${
                    size === n ? 'border-brand-600 bg-brand-600 text-on-brand' : 'border-line hover:bg-canvas'
                  }`}
                >
                  {n}
                  {hint && (
                    <span className={`text-[11px] font-medium ${size === n ? 'text-on-brand/80' : 'text-ink-3'}`}>{hint}</span>
                  )}
                </button>
              ))}
              <label className="flex items-center gap-2 rounded-xl border border-line px-3 text-sm text-ink-2">
                Outra:
                <input
                  type="number"
                  min={1}
                  max={MAX_SIZE}
                  value={size}
                  onChange={(e) => setSize(Math.max(1, Math.min(MAX_SIZE, Number(e.target.value) || 1)))}
                  className="w-16 rounded-lg border border-line px-2 py-1"
                  aria-label="Quantidade de questões"
                />
              </label>
            </div>
            {size >= 100 && (
              <p className="mt-2 text-xs text-ink-3">
                Tamanho de prova real. Reserve {formatDuration(size * SECONDS_PER_QUESTION)} se for cronometrar.
              </p>
            )}
          </div>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} className="size-5 accent-brand-600" />
            Só questões que eu ainda não respondi
          </label>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} className="size-5 accent-brand-600" />
            Cronometrar no ritmo de prova ({formatDuration(size * SECONDS_PER_QUESTION)} para {size} questões)
          </label>
        </div>
        <Button
          onClick={() => {
            if (pending && !confirm('Começar um novo simulado descarta o que está em andamento. Continuar?')) return
            start.mutate()
          }}
          disabled={start.isPending} className="w-full py-3">
          {start.isPending ? 'Sorteando…' : 'Começar simulado'}
        </Button>
        {start.data?.items.length === 0 && <p className="text-center text-sm text-ink-3">Nenhuma questão com esses filtros.</p>}
        {start.error && <ErrorMessage error={start.error} />}
      </Card>
      <AttemptHistory />
    </div>
  )
}
