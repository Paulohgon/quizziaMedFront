import { useMutation, useQueryClient } from '@tanstack/react-query'
import { memo, useEffect, useState, type ReactNode } from 'react'
import { api, formatDuration, SECONDS_PER_QUESTION, type AnswerResult, type Letter, type Question } from '../api'
import { useStopwatch, useTick } from '../stopwatch'
import { Badge, Button, Card, Icon } from './ui'

type Mode =
  /** Escolhe, confirma e vê a correção na hora. */
  | 'practice'
  /** Simulado: só escolhe; a correção vem no final. */
  | 'exam'
  /** Mostra a resposta dada e o gabarito (questão já respondida, com reveal). */
  | 'review'

interface Props {
  question: Question
  mode: Mode
  /** Rótulo do cabeçalho (ex.: "3 de 20"). */
  label?: string
  /** Modo simulado: resposta controlada pelo pai. */
  selected?: Letter | null
  onSelect?: (letter: Letter) => void
  /** Modo revisão: resultado a exibir (por padrão, o da última tentativa). */
  review?: { chosen: Letter | null; correct: Letter | null; isCorrect: boolean | null }
  onAnswered?: (result: AnswerResult) => void
  /** Ações exibidas depois da correção (ex.: "Próxima questão"). */
  children?: ReactNode
}

const LETTER_KEYS: Record<string, Letter> = { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' }

/** Memo: na prova, só re-renderiza quando a questão ou a resposta marcada mudam. */
export const QuestionView = memo(function QuestionView({
  question,
  mode,
  label,
  selected,
  onSelect,
  review,
  onAnswered,
  children,
}: Props) {
  const queryClient = useQueryClient()
  const [choice, setChoice] = useState<Letter | null>(null)
  const [zoomed, setZoomed] = useState<string | null>(null)
  // O componente é recriado a cada questão (key), então o relógio começa quando ela aparece.
  const clock = useStopwatch()
  const [timeSpentMs, setTimeSpentMs] = useState<number | null>(null)

  const answer = useMutation({
    mutationFn: (letter: Letter) => {
      clock.pause()
      const spent = clock.read()
      setTimeSpentMs(spent)
      return api.answer(question.id, letter, spent)
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      onAnswered?.(result)
    },
  })
  const result = answer.data

  const chosen = mode === 'exam' ? (selected ?? null) : mode === 'review' ? (review?.chosen ?? null) : choice
  const correct = mode === 'review' ? (review?.correct ?? null) : (result?.correct_answer ?? null)
  const revealed = mode === 'review' || !!result
  const locked = revealed || answer.isPending
  const imageOptions = question.options.some((o) => o.is_image)
  const { exam } = question

  function pick(letter: Letter) {
    if (mode === 'exam') onSelect?.(letter)
    else if (mode === 'practice' && !locked) setChoice(letter)
  }

  useEffect(() => {
    if (mode === 'review') return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const letter = LETTER_KEYS[e.key.toLowerCase()]
      if (letter && question.options.some((o) => o.letter === letter)) {
        e.preventDefault()
        pick(letter)
      } else if (e.key === 'Enter' && mode === 'practice' && choice && !locked) {
        e.preventDefault()
        answer.mutate(choice)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <header className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/60 px-5 py-3 sm:px-7">
          <span className="font-display text-sm font-bold text-ink-1">{label ?? `Questão ${question.question_number}`}</span>
          <span className="text-xs text-ink-3">
            {exam.institution} {exam.exam_year}
            {exam.exam_variant && ` · ${exam.exam_variant}`}
            {label && ` · questão ${question.question_number}`}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {mode === 'practice' && !revealed && <Stopwatch clock={clock} />}
            <Badge>
              {exam.region}
              {exam.state && ` · ${exam.state}`}
            </Badge>
            {question.specialty ? (
              <Badge tone="brand">
                {question.specialty}
                {question.subspecialty && ` › ${question.subspecialty}`}
              </Badge>
            ) : (
              <Badge tone="warn">Área a classificar</Badge>
            )}
            {question.annulled && <Badge tone="bad">Anulada</Badge>}
            {mode !== 'exam' && <FavoriteButton question={question} />}
          </span>
        </header>

        <div className="px-5 py-6 sm:px-7">
          {question.my_answer && mode === 'practice' && !revealed && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              <Icon name="retry" className="size-3.5" />
              Você já tentou esta questão {question.my_answer.attempts}× — o gabarito fica escondido até você responder.
            </p>
          )}

          <p className="text-[15.5px] leading-7 whitespace-pre-line text-ink-1">{question.statement}</p>

          {question.images.length > 0 && (
            <div className={`mt-5 grid gap-3 ${imageOptions ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
              {question.images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setZoomed(src)}
                  className="group relative overflow-hidden rounded-xl border border-line bg-white"
                >
                  <img
                    src={src}
                    alt={`Figura ${i + 1} da questão`}
                    loading="lazy"
                    className={`mx-auto object-contain ${imageOptions ? 'max-h-[520px]' : 'max-h-56'}`}
                  />
                  <span className="absolute right-2 bottom-2 rounded-lg bg-ink-1/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100">
                    <Icon name="zoom" className="size-4" />
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-2.5" role="radiogroup" aria-label="Alternativas">
            {question.options.map((opt) => {
              const isChosen = chosen === opt.letter
              const isKey = revealed && correct === opt.letter
              const isWrong = revealed && isChosen && !isKey && !question.annulled
              let tone = 'border-line bg-surface hover:border-brand-300 hover:bg-brand-50/40'
              let bubble = 'border-line text-ink-2 bg-surface'
              if (isKey) {
                tone = 'border-good/40 bg-good-soft'
                bubble = 'border-good bg-good text-white'
              } else if (isWrong) {
                tone = 'border-bad/40 bg-bad-soft'
                bubble = 'border-bad bg-bad text-white'
              } else if (isChosen) {
                tone = 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                bubble = 'border-brand-600 bg-brand-600 text-white'
              } else if (revealed) {
                tone = 'border-line bg-surface opacity-60'
              }

              return (
                <button
                  key={opt.letter}
                  type="button"
                  role="radio"
                  aria-checked={isChosen}
                  disabled={mode === 'review' || (mode === 'practice' && locked)}
                  onClick={() => pick(opt.letter)}
                  className={`flex w-full items-start gap-3.5 rounded-xl border px-4 py-3.5 text-left text-[15px] leading-6 transition disabled:cursor-default ${tone}`}
                >
                  <span
                    className={`mt-px grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold transition ${bubble}`}
                  >
                    {isKey ? <Icon name="check" className="size-4" /> : isWrong ? <Icon name="x" className="size-4" /> : opt.letter}
                  </span>
                  <span className={opt.is_image ? 'pt-0.5 text-ink-3 italic' : 'pt-0.5'}>
                    {opt.is_image ? `Alternativa ${opt.letter} — veja a figura acima` : opt.text}
                  </span>
                </button>
              )
            })}
          </div>

          {mode === 'practice' && !revealed && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="hidden text-xs text-ink-3 sm:block">
                Atalhos: <kbd className="rounded border border-line px-1">A</kbd>–<kbd className="rounded border border-line px-1">E</kbd>{' '}
                para escolher, <kbd className="rounded border border-line px-1">Enter</kbd> para confirmar
              </p>
              <Button disabled={!choice || answer.isPending} onClick={() => choice && answer.mutate(choice)} className="w-full sm:w-auto">
                {answer.isPending ? 'Corrigindo…' : 'Confirmar resposta'}
              </Button>
              {answer.error && <p className="w-full text-sm text-bad">{answer.error.message}</p>}
            </div>
          )}
        </div>
      </Card>

      {revealed && mode !== 'exam' && (
        <Feedback
          annulled={question.annulled}
          isCorrect={mode === 'review' ? (review?.isCorrect ?? null) : (result?.is_correct ?? null)}
          chosen={chosen}
          correct={correct}
          explanation={mode === 'review' ? question.explanation : (result?.explanation ?? null)}
          timeSpentMs={mode === 'practice' ? timeSpentMs : null}
          review={mode === 'practice' ? (result?.review ?? null) : null}
        />
      )}

      {revealed && mode !== 'exam' && <NoteEditor question={question} />}

      {revealed && children}

      {zoomed && (
        <div
          role="dialog"
          aria-label="Imagem ampliada"
          onClick={() => setZoomed(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-ink-1/80 p-4 backdrop-blur-sm"
        >
          <img src={zoomed} alt="Imagem ampliada" className="max-h-full max-w-full rounded-xl bg-white shadow-2xl" />
        </div>
      )}
    </div>
  )
})

function Feedback({
  annulled,
  isCorrect,
  chosen,
  correct,
  explanation,
  timeSpentMs,
  review,
}: {
  annulled: boolean
  isCorrect: boolean | null
  chosen: Letter | null
  correct: Letter | null
  explanation: string | null
  timeSpentMs: number | null
  review: AnswerResult['review']
}) {
  const [expanded, setExpanded] = useState(false)
  const long = (explanation?.length ?? 0) > 600

  let banner
  if (annulled || isCorrect === null) {
    banner = (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
        <span className="grid size-9 place-items-center rounded-full bg-ink-1/5 text-ink-2">
          <Icon name="info" />
        </span>
        <div>
          <p className="font-semibold">Questão anulada pela banca</p>
          <p className="text-sm text-ink-3">Ela não conta como acerto nem como erro no seu desempenho.</p>
        </div>
      </div>
    )
  } else if (isCorrect) {
    banner = (
      <div className="flex items-center gap-3 rounded-2xl border border-good/20 bg-good-soft px-5 py-4">
        <span className="grid size-9 place-items-center rounded-full bg-good text-white">
          <Icon name="check" />
        </span>
        <div>
          <p className="font-semibold text-good">Resposta correta!</p>
          <p className="text-sm text-ink-2">Gabarito oficial: alternativa {correct}.</p>
        </div>
      </div>
    )
  } else {
    banner = (
      <div className="flex items-center gap-3 rounded-2xl border border-bad/20 bg-bad-soft px-5 py-4">
        <span className="grid size-9 place-items-center rounded-full bg-bad text-white">
          <Icon name="x" />
        </span>
        <div>
          <p className="font-semibold text-bad">Resposta incorreta</p>
          <p className="text-sm text-ink-2">
            {chosen ? `Você marcou ${chosen}.` : 'Você deixou em branco.'}{' '}
            {correct ? `Gabarito oficial: alternativa ${correct}.` : 'Responda a questão para ver o gabarito.'}
          </p>
        </div>
      </div>
    )
  }

  const reviewText = review
    ? review.mastered
      ? 'Dominada: saiu da revisão espaçada.'
      : `Volta para revisão ${relativeDay(review.due_at)}.`
    : null

  return (
    <div className="space-y-3">
      {banner}
      {(timeSpentMs != null || reviewText) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-ink-3">
          {timeSpentMs != null && (
            <span className={`inline-flex items-center gap-1.5 ${timeSpentMs / 1000 > SECONDS_PER_QUESTION ? 'text-amber-700' : ''}`}>
              <Icon name="clock" className="size-3.5" />
              Você levou {formatDuration(timeSpentMs / 1000)}
              {timeSpentMs / 1000 > SECONDS_PER_QUESTION && ' (acima do ritmo de prova, ~3 min)'}
            </span>
          )}
          {reviewText && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" className="size-3.5" />
              {reviewText}
            </span>
          )}
        </div>
      )}
      {explanation && (
        <Card className="px-5 py-4 sm:px-6">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-700 uppercase">
            <Icon name="book" className="size-4" /> Comentário da banca
          </p>
          <p className={`text-sm leading-6 text-ink-2 ${long && !expanded ? 'line-clamp-6' : ''}`}>{explanation}</p>
          {long && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-sm font-semibold text-brand-700">
              {expanded ? 'Mostrar menos' : 'Ler comentário completo'}
            </button>
          )}
        </Card>
      )}
    </div>
  )
}

const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

function relativeDay(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'amanhã'
  return `em ${days} dias (${dayFmt.format(new Date(iso))})`
}

/** Relógio da questão (clique para pausar); fica âmbar acima do ritmo de prova (~3 min por questão). */
function Stopwatch({ clock }: { clock: ReturnType<typeof useStopwatch> }) {
  useTick(!clock.paused)
  const seconds = clock.read() / 1000
  const slow = seconds > SECONDS_PER_QUESTION
  const label = clock.paused ? 'Voltar a contar o tempo' : 'Parar de contar o tempo (ritmo de prova: ~3 min)'
  return (
    <button
      type="button"
      onClick={clock.toggle}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums transition hover:ring-1 hover:ring-line ${
        clock.paused ? 'bg-ink-1/5 text-ink-2' : slow ? 'bg-amber-50 text-amber-800' : 'text-ink-3'
      }`}
    >
      <Icon name={clock.paused ? 'play' : 'pause'} className="size-3.5" />
      {formatDuration(seconds)}
      {clock.paused && ' · pausado'}
    </button>
  )
}

function useNoteMutation(question: Question) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { favorite?: boolean; note?: string | null }) => api.saveNote(question.id, data),
    onSuccess: (saved) => {
      // Atualiza o objeto em memória para a tela refletir sem recarregar a lista.
      question.favorite = saved.favorite
      question.note = saved.note
      queryClient.invalidateQueries({ queryKey: ['notebook'] })
    },
  })
}

function FavoriteButton({ question }: { question: Question }) {
  const [favorite, setFavorite] = useState(question.favorite)
  const save = useNoteMutation(question)
  return (
    <button
      type="button"
      onClick={() => {
        setFavorite(!favorite)
        save.mutate({ favorite: !favorite }, { onError: () => setFavorite(favorite) })
      }}
      aria-pressed={favorite}
      title={favorite ? 'Remover das favoritas' : 'Favoritar para rever depois'}
      className={`rounded-lg p-1 transition ${favorite ? 'text-amber-500' : 'text-ink-3 hover:text-ink-1'}`}
    >
      <Icon name="star" filled={favorite} className="size-5" />
    </button>
  )
}

function NoteEditor({ question }: { question: Question }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(question.note ?? '')
  const save = useNoteMutation(question)

  if (!editing && !question.note) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-2 px-1 text-sm font-medium text-ink-3 hover:text-ink-1"
      >
        <Icon name="pencil" className="size-4" /> Adicionar anotação
      </button>
    )
  }

  if (!editing) {
    return (
      <Card className="px-5 py-4 sm:px-6">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-amber-700 uppercase">
            <Icon name="pencil" className="size-4" /> Minha anotação
          </p>
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-ink-3 hover:text-ink-1">
            Editar
          </button>
        </div>
        <p className="text-sm leading-6 whitespace-pre-line text-ink-2">{question.note}</p>
      </Card>
    )
  }

  return (
    <Card className="px-5 py-4 sm:px-6">
      <label className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-amber-700 uppercase">
        <Icon name="pencil" className="size-4" /> Minha anotação
      </label>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={5000}
        rows={3}
        placeholder="Ex.: confundi com Kawasaki — lembrar que…"
        className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
        <Button
          disabled={save.isPending}
          onClick={() => save.mutate({ note: text }, { onSuccess: () => setEditing(false) })}
        >
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </Card>
  )
}
