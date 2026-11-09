import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { api, type FacetValue, type Filters } from '../api'
import { Button, Icon } from './ui'

type SectionKey = 'specialty' | 'subspecialty' | 'region' | 'state' | 'year' | 'institution'

const SECTIONS: { key: SectionKey; title: string; facet: keyof Filters }[] = [
  { key: 'specialty', title: 'Grande área', facet: 'specialties' },
  { key: 'subspecialty', title: 'Subespecialidade', facet: 'subspecialties' },
  { key: 'region', title: 'Região', facet: 'regions' },
  { key: 'state', title: 'Estado', facet: 'states' },
  { key: 'institution', title: 'Instituição', facet: 'institutions' },
  { key: 'year', title: 'Ano', facet: 'years' },
]

/** Parâmetros que a barra de filtros controla (o resto, como status/page, é da página). */
const OWN_KEYS = [...SECTIONS.map((s) => s.key), 'q', 'exam_id']


interface Props {
  params: URLSearchParams
  onChange: (params: URLSearchParams) => void
}

/** Barra com busca, botão de filtros e os filtros ativos como chips removíveis. */
export function FilterBar({ params, onChange, trailing }: Props & { trailing?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const { data: exams } = useQuery({ queryKey: ['exams'], queryFn: api.exams, enabled: params.has('exam_id') })
  useEffect(() => setSearch(params.get('q') ?? ''), [params])

  function update(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params)
    mutate(next)
    next.delete('page')
    onChange(next)
  }

  const chips: { key: string; value: string; label: string }[] = []
  for (const s of SECTIONS) for (const v of params.getAll(s.key)) chips.push({ key: s.key, value: v, label: v })
  const examId = params.get('exam_id')
  if (examId) {
    const exam = exams?.find((e) => String(e.id) === examId)
    chips.push({ key: 'exam_id', value: examId, label: exam ? `Prova: ${exam.institution} ${exam.exam_year}` : 'Prova selecionada' })
  }
  const q = params.get('q')
  if (q) chips.push({ key: 'q', value: q, label: `“${q}”` })

  const active = OWN_KEYS.reduce((n, k) => n + params.getAll(k).length, 0)

  return (
    <div className="mb-5 space-y-3">
      <div className="flex gap-2">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            update((next) => (search.trim() ? next.set('q', search.trim()) : next.delete('q')))
          }}
        >
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no enunciado"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pr-3 pl-10 text-sm shadow-card outline-none placeholder:text-ink-3 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
        </form>
        <Button variant="secondary" onClick={() => setOpen(true)} className="shrink-0 shadow-card">
          <Icon name="filter" className="size-4" />
          Filtros
          {active > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[11px] text-on-brand">{active}</span>
          )}
        </Button>
      </div>

      {(chips.length > 0 || trailing) && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={`${c.key}:${c.value}`}
              type="button"
              onClick={() =>
                update((next) => {
                  const rest = next.getAll(c.key).filter((v) => v !== c.value)
                  next.delete(c.key)
                  rest.forEach((v) => next.append(c.key, v))
                })
              }
              aria-label={`Remover filtro ${c.label}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 pr-2.5 pl-3.5 text-[13px] font-semibold text-brand-800 hover:bg-brand-100"
            >
              {c.label}
              <Icon name="x" className="size-[13px]" />
            </button>
          ))}
          {chips.length > 0 && (
            <button
              type="button"
              onClick={() => update((next) => OWN_KEYS.forEach((k) => next.delete(k)))}
              className="text-xs font-semibold text-ink-3 hover:text-ink-1"
            >
              Limpar tudo
            </button>
          )}
          {trailing && <div className="ml-auto">{trailing}</div>}
        </div>
      )}

      {open && <FilterDrawer params={params} onChange={onChange} onClose={() => setOpen(false)} />}
    </div>
  )
}

function FilterDrawer({ params, onChange, onClose }: Props & { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fechar filtros" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative flex h-full w-full max-w-sm flex-col bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">Filtros</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-ink-1/5">
            <Icon name="x" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <FilterPanel params={params} onChange={onChange} />
        </div>
        <div className="border-t border-line p-4">
          <Button onClick={onClose} className="w-full">
            Ver questões
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Lista de checkboxes por faceta (usada na gaveta e na configuração do simulado). */
export function FilterPanel({ params, onChange }: Props) {
  const { data: filters, isLoading } = useQuery({ queryKey: ['filters'], queryFn: api.filters })

  function toggle(key: SectionKey, value: string) {
    const next = new URLSearchParams(params)
    const values = next.getAll(key)
    next.delete(key)
    const updated = values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
    updated.forEach((v) => next.append(key, v))
    next.delete('page')
    onChange(next)
  }

  if (isLoading || !filters) return <p className="text-sm text-ink-3">Carregando filtros…</p>

  const selectedSpecialties = params.getAll('specialty')
  return (
    <div className="space-y-6">
      {SECTIONS.map(({ key, title, facet }) => {
        let values: FacetValue[] = filters[facet]
        if (key === 'subspecialty' && selectedSpecialties.length) {
          values = filters.subspecialties.filter((s) => selectedSpecialties.includes(s.specialty))
        }
        if (values.length === 0) return null
        return (
          <fieldset key={key}>
            <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">{title}</legend>
            <div className="flex flex-wrap gap-2">
              {values.map((v) => {
                const value = String(v.value)
                const checked = params.getAll(key).includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggle(key, value)}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                      checked
                        ? 'border-brand-600 bg-brand-600 text-on-brand'
                        : 'border-line bg-surface text-ink-2 hover:border-brand-300'
                    }`}
                  >
                    {checked && <Icon name="check" className="size-3.5" />}
                    {value}
                    <span className={`text-xs ${checked ? 'text-on-brand/70' : 'text-ink-3'}`}>{v.count}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
