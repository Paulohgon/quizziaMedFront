import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, formatDuration, SECONDS_PER_QUESTION, type ExamProgress, type Question } from '../api'
import { ExamRunner } from '../components/ExamRunner'
import { Button, Card, ErrorMessage, Icon, Spinner } from '../components/ui'

/** Todas as questões da prova, na ordem do caderno (a API pagina de 100 em 100). */
async function loadAllQuestions(examId: string): Promise<Question[]> {
  const all: Question[] = []
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ exam_id: examId, include_annulled: 'true', page_size: '100', page: String(page) })
    const data = await api.questions(params)
    all.push(...data.items)
    if (all.length >= data.total || !data.items.length) return all
  }
}

export function ProvaPage() {
  const { examId = '' } = useParams()
  const navigate = useNavigate()
  // undefined = ainda não começou; null = do zero; senão, retoma o progresso salvo.
  const [started, setStarted] = useState<ExamProgress | null | undefined>(undefined)
  // Sem cache: o progresso muda ao sair da prova e precisa vir fresco ao voltar.
  const progress = useQuery({
    queryKey: ['progress', examId],
    queryFn: () => api.progress(Number(examId)),
    gcTime: 0,
  })
  const saved = progress.data
  const { data: exams } = useQuery({ queryKey: ['exams'], queryFn: api.exams })
  const { data: questions, error, isLoading } = useQuery({
    queryKey: ['prova', examId],
    queryFn: () => loadAllQuestions(examId),
    staleTime: Infinity,
  })
  const restart = useMutation({
    mutationFn: () => api.clearProgress(Number(examId)),
    onSuccess: () => setStarted(null),
  })
  const exam = exams?.find((e) => String(e.id) === examId)
  const title = exam ? `${exam.institution} ${exam.exam_year}${exam.exam_variant ? ` · ${exam.exam_variant}` : ''}` : 'Prova'

  if (isLoading || progress.isLoading) return <Spinner label="Carregando a prova…" />
  if (error || progress.error) return <ErrorMessage error={error ?? progress.error} />
  if (!questions?.length) return <ErrorMessage error="Prova sem questões." />

  const limit = questions.length * SECONDS_PER_QUESTION

  if (started !== undefined) {
    return (
      <ExamRunner
        title={title}
        questions={questions}
        kind="prova"
        examId={Number(examId)}
        timeLimitS={limit}
        initialProgress={started}
        onExit={() => navigate('/provas')}
      />
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link to="/provas" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-ink-1">
        <Icon name="arrowLeft" className="size-4" /> Provas
      </Link>
      <Card className="p-8 text-center">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Prova completa cronometrada</p>
        <h1 className="mt-2 text-3xl font-extrabold">{title}</h1>
        <p className="mt-1 text-sm text-ink-3">{exam?.exam_name}</p>
        <dl className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-ink-3">Questões</dt>
            <dd className="text-lg font-semibold">{questions.length}</dd>
          </div>
          <div className="rounded-xl bg-canvas p-3">
            <dt className="text-xs text-ink-3">Tempo</dt>
            <dd className="text-lg font-semibold">{formatDuration(limit)}</dd>
          </div>
        </dl>
        <ul className="mx-auto mt-6 max-w-sm space-y-1.5 text-left text-sm text-ink-2">
          <li>• Ritmo de prova: cerca de 3 minutos por questão.</li>
          <li>• A correção só aparece quando você entregar.</li>
          <li>• Quando o tempo acabar, a prova é entregue automaticamente.</li>
          <li>• As respostas contam no seu desempenho e na revisão espaçada.</li>
        </ul>
        {saved ? (
          <div className="mt-8 space-y-2">
            <p className="text-sm text-ink-2">
              Você parou na questão {Math.min(saved.current, questions.length - 1) + 1}, com {Object.keys(saved.answers).length} de{' '}
              {questions.length} respondidas e {formatDuration(limit - saved.elapsed_ms / 1000)} restantes.
            </p>
            <Button onClick={() => setStarted(saved)} className="w-full py-3">
              Continuar de onde parei
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              disabled={restart.isPending}
              onClick={() => {
                if (confirm('Descartar o progresso salvo e recomeçar do zero?')) restart.mutate()
              }}
            >
              Recomeçar do zero
            </Button>
            {restart.error && <ErrorMessage error={restart.error} />}
          </div>
        ) : (
          <Button onClick={() => setStarted(null)} className="mt-8 w-full py-3">
            Começar prova
          </Button>
        )}
      </Card>
    </div>
  )
}
