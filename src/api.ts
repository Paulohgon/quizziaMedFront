export type Letter = 'A' | 'B' | 'C' | 'D' | 'E'

export interface Exam {
  id: number
  institution: string
  board: string | null
  exam_name: string
  exam_year: number
  edition: string | null
  state: string | null
  region: string
  access_type: string | null
  exam_variant: string | null
  source_url: string
  answer_key_url: string | null
  /** official = site da banca; third_party = compilação de terceiros (Medway). */
  source_type: 'official' | 'third_party'
}

export interface ExamSummary extends Exam {
  question_count: number
  annulled_count: number
  classified_count: number
  answered_count: number
  correct_count: number
}

export interface Option {
  letter: Letter
  text: string
  is_image: boolean
}

export interface MyAnswer {
  chosen: Letter
  is_correct: boolean | null
  answered_at: string
  attempts: number
}

export interface ReviewState {
  due_at: string
  mastered: boolean
}

export interface Question {
  id: number
  question_number: number
  statement: string
  options: Option[]
  /** Só vem preenchido com reveal=true em questão já respondida. */
  correct_answer: Letter | null
  explanation: string | null
  annulled: boolean
  page: number | null
  specialty: string | null
  subspecialty: string | null
  topic: string | null
  subtopic: string | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  classification_status: 'pending' | 'ai' | 'reviewed' | 'official'
  images: string[]
  tags: string[]
  exam: Exam
  my_answer: MyAnswer | null
  favorite: boolean
  note: string | null
  /** Situação na fila de revisão espaçada (null = nunca errou). */
  review: ReviewState | null
}

export interface QuestionPage {
  total: number
  page: number
  page_size: number
  items: Question[]
}

export interface AnswerResult {
  chosen: Letter
  is_correct: boolean | null
  correct_answer: Letter | null
  annulled: boolean
  explanation: string | null
  review: ReviewState | null
}

export interface FacetValue {
  value: string | number
  count: number
}

export interface Filters {
  specialties: FacetValue[]
  subspecialties: (FacetValue & { specialty: string })[]
  regions: FacetValue[]
  states: FacetValue[]
  years: FacetValue[]
  institutions: FacetValue[]
}

export interface User {
  id: number
  email: string
  name: string
  daily_goal: number
  created_at: string
}

export interface AuthResponse {
  access_token: string
  user: User
}

/** Resposta do cadastro: a conta só libera o login depois de confirmar o código enviado por e-mail. */
export interface VerificationPending {
  email: string
  detail: string
}

export interface StatsGroup {
  label: string
  answered: number
  correct: number
  wrong: number
  avg_time_s: number | null
}

export interface Stats {
  total_questions: number
  answered: number
  correct: number
  wrong: number
  attempts: number
  avg_time_s: number | null
  by_specialty: StatsGroup[]
  by_exam: StatsGroup[]
  by_region: StatsGroup[]
  last_30_days: { day: string; attempts: number; correct: number }[]
}

export interface Summary {
  daily_goal: number
  today_answered: number
  streak_days: number
  best_streak_days: number
  studied_today: boolean
  reviews_due: number
}

export interface Attempt {
  id: number
  kind: 'prova' | 'simulado'
  exam_id: number | null
  exam_label: string | null
  total: number
  answered: number
  correct: number
  annulled: number
  time_limit_s: number | null
  duration_s: number
  finished_at: string
}

/** Entrega de prova/simulado: todas as respostas numa requisição; o servidor corrige. */
export interface AttemptIn {
  kind: 'prova' | 'simulado'
  exam_id: number | null
  /** Todas as questões da tentativa, respondidas ou não. */
  question_ids: number[]
  answers: { question_id: number; chosen: Letter; time_spent_ms: number | null }[]
  time_limit_s: number | null
  duration_s: number
}

export interface AttemptResult {
  attempt: Attempt
  /** Correção de cada questão respondida, por id. */
  results: Record<number, AnswerResult>
}

/** Prova/simulado em andamento. Tempos em ms; o tempo fora da prova e as pausas não contam. */
export interface ExamProgress {
  answers: Record<number, Letter>
  current: number
  elapsed_ms: number
  time_per_question: Record<number, number>
}

export type QuestionStatus = 'all' | 'unanswered' | 'answered' | 'correct' | 'wrong' | 'review'

/** Parâmetros de filtro aceitos por GET /api/questions (multivalorados viram parâmetros repetidos). */
export const FILTER_KEYS = ['specialty', 'subspecialty', 'region', 'state', 'year', 'institution', 'exam_id'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]

const TOKEN_KEY = 'medingo.token'

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* armazenamento indisponível: a sessão dura até recarregar a página */
    }
  },
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Chamado quando a API responde 401 (token expirado/inválido). */
let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

async function request<T>(path: string, init: RequestInit = {}, params?: URLSearchParams): Promise<T> {
  const url = params && params.size ? `${path}?${params}` : path
  const headers = new Headers(init.headers)
  const token = tokenStore.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body) headers.set('Content-Type', 'application/json')

  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized()
    const body = await res.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : `Erro ${res.status}`
    throw new ApiError(res.status, detail)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<VerificationPending>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  verifyEmail: (email: string, code: string) =>
    request<AuthResponse>('/api/auth/verify', { method: 'POST', body: JSON.stringify({ email, code }) }),
  resendCode: (email: string) =>
    request<void>('/api/auth/resend-code', { method: 'POST', body: JSON.stringify({ email }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<User>('/api/auth/me'),

  filters: () => request<Filters>('/api/filters'),
  exams: () => request<ExamSummary[]>('/api/exams'),
  questions: (params: URLSearchParams) => request<QuestionPage>('/api/questions', {}, params),
  question: (id: number, reveal = false) => request<Question>(`/api/questions/${id}${reveal ? '?reveal=true' : ''}`),
  answer: (id: number, chosen: Letter, timeSpentMs?: number) =>
    request<AnswerResult>(`/api/questions/${id}/answers`, {
      method: 'POST',
      body: JSON.stringify({ chosen, time_spent_ms: timeSpentMs == null ? null : Math.min(Math.round(timeSpentMs), 3_600_000) }),
    }),
  saveNote: (id: number, data: { favorite?: boolean; note?: string | null }) =>
    request<{ favorite: boolean; note: string | null }>(`/api/questions/${id}/note`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  stats: () => request<Stats>('/api/me/stats'),
  summary: () => request<Summary>('/api/me/summary'),
  updateMe: (data: { daily_goal: number }) => request<User>('/api/me', { method: 'PATCH', body: JSON.stringify(data) }),
  attempts: () => request<Attempt[]>('/api/me/attempts'),
  submitAttempt: (data: AttemptIn) =>
    request<AttemptResult>('/api/me/attempts', { method: 'POST', body: JSON.stringify(data) }),
  progress: (examId: number) => request<ExamProgress | null>(`/api/me/progress/${examId}`),
  /** `keepalive` deixa a requisição terminar mesmo com a aba fechando. */
  saveProgress: (examId: number, data: ExamProgress, keepalive = false) =>
    request<ExamProgress>(`/api/me/progress/${examId}`, { method: 'PUT', body: JSON.stringify(data), keepalive }),
  clearProgress: (examId: number) => request<void>(`/api/me/progress/${examId}`, { method: 'DELETE' }),
}

export function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0
}

/** "2:05" ou "1:02:05". */
export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** Ritmo de prova: cerca de 3 minutos por questão (ex.: AMRIGS, 100 questões em 5 horas). */
export const SECONDS_PER_QUESTION = 180
