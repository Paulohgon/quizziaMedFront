import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { Logo } from '../components/Layout'
import { Button, Icon } from '../components/ui'

const FEATURES = [
  'Questões oficiais da FUVEST e da AMRIGS, com gabarito definitivo',
  'Comentários da banca para centenas de questões',
  'Refaça só o que errou, sem ver a resposta antes',
  'Desempenho por área, por prova e por região',
]

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

  const input =
    'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-3 focus:border-brand-400 focus:ring-4 focus:ring-brand-100'

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-center gap-2 font-display text-xl font-extrabold">
          <span className="grid size-8 place-items-center rounded-xl bg-white/15">
            <Icon name="sparkle" className="size-4" />
          </span>
          medingo
        </div>
        <div className="relative my-auto max-w-md">
          <h1 className="font-display text-4xl leading-tight font-extrabold">
            Treine com provas reais de residência médica.
          </h1>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-brand-50">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-400/30">
                  <Icon name="check" className="size-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {verifying ? (
            <VerifyStep
              email={verifying}
              onVerify={(code) => verifyEmail(verifying, code)}
              onBack={() => setVerifying(null)}
            />
          ) : (
            <>
              <h2 className="text-2xl font-extrabold">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
              <p className="mt-1 text-sm text-ink-3">
                {mode === 'login' ? 'Bom te ver de novo.' : 'Leva menos de um minuto.'}
              </p>

              <form onSubmit={submit} className="mt-8 space-y-4">
                {mode === 'register' && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Nome</span>
                    <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="name" />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">E-mail</span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={input}
                    autoComplete="email"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Senha</span>
                  <input
                    required
                    type="password"
                    minLength={mode === 'register' ? 6 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={input}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  {mode === 'register' && <span className="mt-1 block text-xs text-ink-3">Mínimo de 6 caracteres.</span>}
                </label>
                {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
                <Button type="submit" disabled={pending} className="w-full py-3">
                  {pending ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-ink-3">
                {mode === 'login' ? (
                  <>
                    Ainda não tem conta?{' '}
                    <Link to="/cadastro" state={location.state} className="font-semibold text-brand-700 hover:underline">
                      Cadastre-se
                    </Link>
                  </>
                ) : (
                  <>
                    Já tem conta?{' '}
                    <Link to="/entrar" state={location.state} className="font-semibold text-brand-700 hover:underline">
                      Entrar
                    </Link>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
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
    <>
      <h2 className="text-2xl font-extrabold">Confirme seu e-mail</h2>
      <p className="mt-1 text-sm text-ink-3">
        Enviamos um código de 6 dígitos para <span className="font-semibold text-ink-1">{email}</span>. Confira também a
        caixa de spam.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Código</span>
          <input
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-center font-mono text-2xl tracking-[0.5em] outline-none placeholder:text-ink-3 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            placeholder="000000"
          />
        </label>
        {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        {notice && !error && <p className="text-sm text-ink-3">{notice}</p>}
        <Button type="submit" disabled={pending || code.length !== 6} className="w-full py-3">
          {pending ? 'Aguarde…' : 'Confirmar'}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
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
    </>
  )
}
