import { Button, Icon } from './ui'

interface Props {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages === 1) return null
  return (
    <nav className="flex items-center justify-center gap-3 py-6" aria-label="Paginação">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <Icon name="arrowLeft" className="size-4" /> Anterior
      </Button>
      <span className="text-sm text-ink-3">
        Página <strong className="text-ink-1">{page}</strong> de {pages}
      </span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Próxima <Icon name="arrowRight" className="size-4" />
      </Button>
    </nav>
  )
}
