import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { Logo, LogoMark } from '../components/Layout'
import { Button, Icon } from '../components/ui'

const FEATURES = [
  'Questões oficiais da FUVEST e da AMRIGS, com gabarito definitivo',
  'Comentários da banca para centenas de questões',
  'Refaça só o que errou, sem ver a resposta antes',
  'Desempenho por área, por prova e por região',
]

const INPUT =
  'h-[46px] w-full rounded-xl border border-line-2 bg-surface px-3.5 text-[15px] font-normal text-ink-1 outline-none placeholder:text-ink-3 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15'
const LABEL = 'flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register, verifyEmail } = useAuth()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // E-mail aguardando o código de confirmação (depois do cadastro ou de um login não confirmado).
  const [verifying, setVerifying] = useState<string | null>(null)

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/estudar'
    return <Navigate to={from} replace />
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      if (mode === 'login') await login(email, password)
      else setVerifying(await register(name, email, password))
    } catch (err) {
      // 403 no login = senha certa, e-mail ainda não confirmado (a API já enviou um código novo).
      if (err instanceof ApiError && err.status === 403) setVerifying(email)
      else setError(err instanceof Error ? err.message : 'Algo deu errado')
    } finally {
      setPending(false)
    }
  }

  const tab = (active: boolean) =>
    `grid h-10 place-items-center rounded-[9px] text-sm font-semibold transition ${
      active ? 'bg-surface text-ink-1 shadow-sm' : 'text-ink-3 hover:text-ink-1'
    }`

  return (
    <div className="flex min-h-screen bg-canvas">
      <section className="hidden flex-1 flex-col gap-12 border-r border-panel-line bg-panel px-16 py-14 text-panel-ink lg:flex">
        <span className="inline-flex items-center gap-3 font-display text-2xl tracking-tight">
          <LogoMark tone="panel" className="size-11" />
          <span>
            <span className="font-extrabold text-white">Quizzia</span>{' '}
            <span className="font-semibold text-panel-accent">Med</span>
          </span>
        </span>

        <div className="mt-auto flex max-w-[460px] flex-col gap-7">
          <h1 className="text-[40px] leading-[1.15] font-extrabold tracking-[-0.03em] text-white">
            Treine para a residência com questões de prova de verdade.
          </h1>
          <ul className="flex flex-col gap-3.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[15px] leading-normal">
                <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-panel-accent/15 text-panel-accent">
                  <Icon name="check" className="size-[13px]" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[13px] text-panel-muted">Feito para quem estuda para a residência médica.</p>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-14">
        <div className="flex w-full max-w-[400px] flex-col gap-7">
          <div className="lg:hidden">
            <Logo />
          </div>

          {verifying ? (
            <VerifyStep
              email={verifying}
              onVerify={(code) => verifyEmail(verifying, code, password)}
              onBack={() => setVerifying(null)}
            />
          ) : (
            <>
              <nav aria-label="Entrar ou criar conta" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
                <Link to="/entrar" state={location.state} aria-current={mode === 'login' ? 'page' : undefined} className={tab(mode === 'login')}>
                  Entrar
                </Link>
                <Link
                  to="/cadastro"
                  state={location.state}
                  aria-current={mode === 'register' ? 'page' : undefined}
                  className={tab(mode === 'register')}
                >
                  Criar conta
                </Link>
              </nav>

              <div>
                <h2 className="text-[28px] font-extrabold">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
                <p className="mt-1.5 text-[15px] text-ink-3">
                  {mode === 'login' ? 'Bom te ver de novo.' : 'Leva menos de um minuto.'}
                </p>
              </div>

              <form onSubmit={submit} className="flex flex-col gap-4">
                {mode === 'register' && (
                  <label className={LABEL}>
                    Nome
                    <input
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={INPUT}
                      placeholder="Seu nome"
                      autoComplete="name"
                    />
                  </label>
                )}
                <label className={LABEL}>
                  E-mail
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={INPUT}
                    placeholder="voce@email.com"
                    autoComplete="email"
                  />
                </label>
                <label className={LABEL}>
                  Senha
                  <input
                    required
                    type="password"
                    minLength={mode === 'register' ? 6 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={INPUT}
                    placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  {mode === 'register' && <span className="text-xs font-normal text-ink-3">Mínimo de 6 caracteres.</span>}
                </label>
                {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
                <Button type="submit" disabled={pending} className="mt-2 h-12 w-full text-[15px]">
                  {pending ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

const RESEND_SECONDS = 60

function VerifyStep({
  email,
  onVerify,
  onBack,
}: {
  email: string
  onVerify: (code: string) => Promise<void>
  onBack: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Segundos até liberar o reenvio (a API ignora reenvios dentro desse intervalo).
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      await onVerify(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado')
      setPending(false)
    }
  }

  async function resend() {
    setError(null)
    try {
      await api.resendCode(email)
      setCode('')
      setNotice('Enviamos um novo código.')
      setCooldown(RESEND_SECONDS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado')
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="text-[28px] font-extrabold">Confirme seu e-mail</h2>
        <p className="mt-1.5 text-[15px] text-ink-3">
          Enviamos um código de 6 dígitos para <span className="font-semibold text-ink-1">{email}</span>. Confira
          também a caixa de spam.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className={LABEL}>
          Código
          <input
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className={`${INPUT} h-14 text-center font-mono text-2xl tracking-[0.5em]`}
            placeholder="000000"
          />
        </label>
        {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        {notice && !error && <p className="text-sm text-ink-3">{notice}</p>}
        <Button type="submit" disabled={pending || code.length !== 6} className="mt-2 h-12 w-full text-[15px]">
          {pending ? 'Aguarde…' : 'Confirmar'}
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="text-ink-3 hover:underline">
          Voltar
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="font-semibold text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-ink-3 disabled:no-underline"
        >
          {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'}
        </button>
      </div>
    </div>
  )
}
