import type { ExamProgress, Question } from './api'

/**
 * Simulado em andamento guardado no navegador, para continuar de onde parou ao
 * sair no meio. Como ele é sorteado, as próprias questões também ficam salvas.
 * (A prova completa guarda o progresso no servidor: api.saveProgress.)
 */
export interface SavedSimulado {
  questions: Question[]
  timeLimitS: number | null
  /** Chave da entrega (ver AttemptIn.client_key); salva junto para valer também depois de recarregar. */
  key?: string
}

const SIMULADO_KEY = 'medingo:simulado'
const PROGRESS_KEY = 'medingo:progresso:simulado'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sem armazenamento (aba anônima, cota cheia): o simulado segue, só não retoma.
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // idem
  }
}

export const saveSimuladoProgress = (progress: ExamProgress) => write(PROGRESS_KEY, progress)

export function clearSimulado() {
  remove(PROGRESS_KEY)
  remove(SIMULADO_KEY)
}

export function loadSimulado(): (SavedSimulado & { progress: ExamProgress | null }) | null {
  const saved = read<SavedSimulado>(SIMULADO_KEY)
  return saved?.questions?.length ? { ...saved, progress: read<ExamProgress>(PROGRESS_KEY) } : null
}

export function startSimulado(saved: SavedSimulado) {
  clearSimulado()
  write(SIMULADO_KEY, saved)
}
