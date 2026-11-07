import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Cronômetro pausável: conta só o tempo em que está rodando. Não re-renderiza
 * sozinho — quem exibe o tempo usa `useTick`.
 */
export function useStopwatch(initialMs = 0) {
  // Tempo acumulado até a última pausa e início do trecho atual (null = pausado).
  const base = useRef(initialMs)
  const since = useRef<number | null>(Date.now())
  const [paused, setPaused] = useState(false)

  const read = useCallback(() => base.current + (since.current != null ? Date.now() - since.current : 0), [])

  const pause = useCallback(() => {
    if (since.current == null) return
    base.current = read()
    since.current = null
    setPaused(true)
  }, [read])

  const resume = useCallback(() => {
    if (since.current != null) return
    since.current = Date.now()
    setPaused(false)
  }, [])

  // Objeto estável (só muda ao pausar/retomar), para poder ser prop de componentes memo.
  return useMemo(() => ({ read, paused, pause, resume, toggle: paused ? resume : pause }), [read, paused, pause, resume])
}

/** Re-renderiza o componente a cada segundo enquanto `on`. */
export function useTick(on: boolean) {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setN((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [on])
}
