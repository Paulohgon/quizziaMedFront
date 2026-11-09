import { useMutation, useQueryClient } from '@tanstack/react-query'
import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
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
  /** Modo prática: mostra "Pular" ao lado de "Confirmar resposta". */
  onSkip?: () => void
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
  onSkip,
  children,
}: Props) {
  const queryClient = useQueryClient()
  const [choice, setChoice] = useState<Letter | null>(null)
  const [zoomed, setZoomed] = useState<string | null>(null)
  // O componente é recriado a cada questão (key), então o relógio começa quando ela aparece.
  const clock = useStopwatch()
  const [timeSpentMs, setTimeSpentMs] = useState<number | null>(null)
  // Trava síncrona: Enter e toque no mesmo instante (antes de re-renderizar) enviariam a resposta duas vezes.
  const submitted = useRef(false)

  const answer = useMutation({
    mutationFn: (letter: Letter) => {
      clock.pause()
      const spent = clock.read()
      setTimeSpentMs(spent)
      return api.answer(question.id, letter, spent)
    },
    onError: () => {
      submitted.current = false
      clock.resume()
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

  function submit(letter: Letter) {
    if (submitted.current) return
    submitted.current = true
    answer.mutate(letter)
  }

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
        submit(choice)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-[18px]">
        <header className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line px-5 py-4 sm:px-7">
          <span className="font-display text-[15px] font-bold text-ink-1">{label ?? `Questão ${question.question_number}`}</span>
          <span className="text-[13px] text-ink-3">
            {exam.institution} · {exam.exam_year}
            {exam.exam_variant && ` · ${exam.exam_variant}`}
            {` · ${exam.state ?? exam.region}`}
            {label && ` · questão ${question.question_number}`}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {question.specialty ? (
              <Badge>
                {question.specialty}
                {question.subspecialty && ` › ${question.subspecialty}`}
              </Badge>
            ) : (
              <Badge tone="warn">Área a classificar</Badge>
            )}
            {question.annulled && <Badge tone="bad">Anulada</Badge>}
            {mode === 'practice' && !revealed && <Stopwatch clock={clock} />}
            {mode !== 'exam' && <FavoriteButton question={question} />}
          </span>
        </header>

        <div className="px-5 py-7 sm:px-7">
          {question.my_answer && mode === 'practice' && !revealed && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-1.5 text-xs font-medium text-warn">
              <Icon name="retry" className="size-3.5" />
              Você já tentou esta questão {question.my_answer.attempts}× — o gabarito fica escondido até você responder.
            </p>
          )}

          <p className="text-base leading-[1.75] whitespace-pre-line text-ink-1">{question.statement}</p>

          {question.images.length > 0 && (
            <div className={`mt-5 grid gap-3 ${imageOptions ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'}`}>
              {question.images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setZoomed(src)}
                  aria-label={`Ampliar figura ${i + 1}`}
                  className="group relative overflow-hidden rounded-xl border border-line bg-white"
                >
                  <img
                    src={src}
                    alt={`Figura ${i + 1} da questão`}
                    loading="lazy"
                    className={`mx-auto object-contain ${imageOptions ? 'max-h-[520px]' : 'max-h-72 sm:max-h-56'}`}
                  />
                  <span className="absolute right-2 bottom-2 rounded-lg bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
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
              let bubble = 'border-line-2 text-ink-2'
              if (isKey) {
                tone = 'border-good/50 bg-good-soft'
                bubble = 'border-good bg-good text-on-good'
              } else if (isWrong) {
                tone = 'border-bad/50 bg-bad-soft'
                bubble = 'border-bad bg-bad text-on-bad'
              } else if (isChosen) {
                tone = 'border-brand-600 bg-brand-50 ring-[0.5px] ring-brand-600'
                bubble = 'border-brand-600 bg-brand-600 text-on-brand'
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
                  className={`flex w-full items-start gap-3.5 rounded-xl border px-4 py-3.5 text-left text-[15px] leading-[1.55] transition disabled:cursor-default ${tone}`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] text-xs font-bold transition ${bubble}`}
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
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <p className="hidden text-xs text-ink-3 sm:block">
                Atalhos: <Kbd>A</Kbd>–<Kbd>E</Kbd> escolher · <Kbd>Enter</Kbd> confirmar
              </p>
              <div className="flex w-full gap-2 sm:w-auto">
                {onSkip && (
                  <Button variant="secondary" onClick={onSkip} className="h-11 px-[18px] text-ink-2">
                    Pular
                  </Button>
                )}
                <Button
                  disabled={!choice || answer.isPending}
                  onClick={() => choice && submit(choice)}
                  className="h-11 flex-1 px-[22px] sm:flex-none"
                >
                  {answer.isPending ? 'Corrigindo…' : 'Confirmar resposta'}
                  {!answer.isPending && <Icon name="arrowRight" className="size-4" />}
                </Button>
              </div>
              {answer.isPaused && (
                <p className="w-full text-sm text-warn">Sem internet. Sua resposta será enviada assim que a conexão voltar.</p>
              )}
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

      {zoomed && <ZoomDialog src={zoomed} onClose={() => setZoomed(null)} />}
    </div>
  )
})

/**
 * Figura ampliada. Num celular em pé, figuras largas (ECG, tabelas) ficariam pequenas demais
 * encaixadas na largura: abrem maiores, com rolagem para arrastar e ver o resto.
 */
function ZoomDialog({ src, onClose }: { src: string; onClose: () => void }) {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Imagem ampliada"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 overflow-auto bg-black/85 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar imagem"
        className="fixed top-3 right-3 z-10 grid size-11 place-items-center rounded-full bg-black/70 text-white"
      >
        <Icon name="x" className="size-5" />
      </button>
      <div onClick={(e) => e.target === e.currentTarget && onClose()} className="flex min-h-full min-w-max items-center justify-center">
        <img
          src={src}
          alt="Imagem ampliada"
          onLoad={(e) => {
            const img = e.currentTarget
            setWide(img.naturalWidth > img.naturalHeight * 1.3 && window.innerWidth < window.innerHeight)
          }}
          style={wide ? { width: '220vw', maxWidth: 'none' } : undefined}
          className={`rounded-xl bg-white shadow-2xl ${wide ? '' : 'max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]'}`}
        />
      </div>
      {wide && (
        <p className="pointer-events-none fixed inset-x-0 bottom-4 text-center text-xs text-white/80">
          Arraste para ver a figura inteira · toque fora para fechar
        </p>
      )}
    </div>
  )
}

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
      <div className="flex items-center gap-3.5 rounded-2xl bg-surface-2 px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink-2">
          <Icon name="info" />
        </span>
        <div>
          <p className="text-[15px] font-bold">Questão anulada pela banca</p>
          <p className="mt-0.5 text-[13px] text-ink-2">Ela não conta como acerto nem como erro no seu desempenho.</p>
        </div>
      </div>
    )
  } else if (isCorrect) {
    banner = (
      <div className="flex items-center gap-3.5 rounded-2xl bg-good-soft px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-good text-on-good">
          <Icon name="check" className="size-[18px]" />
        </span>
        <div>
          <p className="text-[15px] font-bold text-good">Resposta correta</p>
          <p className="mt-0.5 text-[13px] text-ink-2">Gabarito oficial: alternativa {correct}.</p>
        </div>
      </div>
    )
  } else {
    banner = (
      <div className="flex items-center gap-3.5 rounded-2xl bg-bad-soft px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bad text-on-bad">
          <Icon name="x" className="size-[18px]" />
        </span>
        <div>
          <p className="text-[15px] font-bold text-bad">Resposta incorreta</p>
          <p className="mt-0.5 text-[13px] text-ink-2">
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
            <span className={`inline-flex items-center gap-1.5 ${timeSpentMs / 1000 > SECONDS_PER_QUESTION ? 'text-warn' : ''}`}>
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
        <section className="rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.06em] text-brand-700 uppercase">
            <Icon name="book" className="size-[15px]" /> Comentário da banca
          </p>
          <p className={`text-sm leading-[1.7] text-ink-2 ${long && !expanded ? 'line-clamp-6' : ''}`}>{explanation}</p>
          {long && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-sm font-semibold text-brand-700">
              {expanded ? 'Mostrar menos' : 'Ler comentário completo'}
            </button>
          )}
        </section>
      )}
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[5px] border border-line-2 px-1.5 font-sans">{children}</kbd>
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
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold tabular-nums transition hover:ring-1 hover:ring-line-2 ${
        slow && !clock.paused ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-ink-2'
      }`}
    >
      <Icon name={clock.paused ? 'play' : 'pause'} filled className="size-3" />
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
      className={`grid size-10 place-items-center rounded-lg transition hover:bg-surface-2 ${favorite ? 'text-warn' : 'text-ink-3 hover:text-ink-1'}`}
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
        className="inline-flex min-h-10 items-center gap-2 px-1 text-sm font-medium text-ink-3 hover:text-ink-1"
      >
        <Icon name="pencil" className="size-4" /> Adicionar anotação
      </button>
    )
  }

  if (!editing) {
    return (
      <Card className="px-5 py-4 sm:px-6">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-warn uppercase">
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
      <label className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-warn uppercase">
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
        <Button disabled={save.isPending} onClick={() => save.mutate({ note: text }, { onSuccess: () => setEditing(false) })}>
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </Card>
  )
}
