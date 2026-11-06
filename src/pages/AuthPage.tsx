import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { AlertCircle, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, AppApiError } from '@/lib/api/client'
import { queryClient, queryKeys } from '@/lib/query'
import { reconnectRealtimeNow } from '@/lib/realtime'
import { sessionStore } from '@/lib/session'

export function AuthPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { redirect?: string }

  const isRegister = location.pathname === '/register'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const redirectTo = search.redirect && search.redirect.startsWith('/') ? search.redirect : '/'

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (isRegister && name.trim().length < 2) {
      errors.name = 'Informe um nome de usuário com ao menos 2 caracteres.'
    }
    if (!email.trim() || !email.includes('@')) {
      errors.email = 'Informe um endereço de e-mail válido.'
    }
    if (password.length < 6) {
      errors.password = 'A senha deve ter pelo menos 6 caracteres.'
    }
    if (isRegister && password !== passwordConfirmation) {
      errors.passwordConfirmation = 'A confirmação de senha não confere.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return

    setIsSubmitting(true)
    const guestCartId = sessionStore.getGuestCartId()

    try {
      const cleanName = name.trim()
      const generatedUsername = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .slice(0, 20) || 'colecionador'

      const session = isRegister
        ? await api.register(
            {
              name: cleanName,
              username: generatedUsername,
              email: email.trim(),
              password,
            },
            guestCartId,
          )
        : await api.login(
            {
              email: email.trim(),
              password,
            },
            guestCartId,
          )

      sessionStore.setSession(session)
      sessionStore.rotateGuestCartId()
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      await queryClient.refetchQueries({ queryKey: queryKeys.cart(session.user.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites(session.user.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets(session.user.id) })
      reconnectRealtimeNow()

      toast.success(
        isRegister
          ? `Conta criada com sucesso! Bem-vindo(a), ${session.user.name}.`
          : `Bem-vindo(a) de volta, ${session.user.name}!`,
      )

      navigate({ to: redirectTo })
    } catch (err) {
      if (err instanceof AppApiError) {
        if (err.fields) {
          setFieldErrors((prev) => ({ ...prev, ...err.fields }))
        }
        setFormError(err.message)
      } else {
        setFormError('Não foi possível autenticar no momento. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const fillDemoCredentials = () => {
    setEmail('ana@nft.test')
    setPassword('Senha@123')
    setFieldErrors({})
    setFormError(null)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div
        data-testid={isRegister ? 'register-card' : 'login-card'}
        className="relative w-full max-w-[500px] rounded-[6px] bg-[#241612] border border-[#3F2319] overflow-hidden shadow-2xl"
      >
        <div className="p-6 sm:p-10 space-y-6">
          <Link
            to="/"
            aria-label="Fechar janela de autenticação"
            className="absolute top-4 right-4 p-1.5 text-[#CFB28C] hover:text-[#F5F1EB] transition-colors"
          >
            <X className="w-4 h-4" />
          </Link>

          <div className="flex items-center justify-center gap-4 text-xl font-medium">
            <Link
              to="/login"
              search={search.redirect ? { redirect: search.redirect } : undefined}
              data-testid="switch-to-login"
              className={
                !isRegister
                  ? 'text-[#E89B55] font-bold'
                  : 'text-[#F5F1EB] hover:text-[#E89B55] transition-colors'
              }
            >
              Entrar
            </Link>
            <span className="text-[#CFB28C]">|</span>
            <Link
              to="/register"
              search={search.redirect ? { redirect: search.redirect } : undefined}
              data-testid="switch-to-register"
              className={
                isRegister
                  ? 'text-[#E89B55] font-bold'
                  : 'text-[#F5F1EB] hover:text-[#E89B55] transition-colors'
              }
            >
              Criar conta
            </Link>
          </div>

          <p className="text-xs sm:text-sm text-[#CFB28C] text-center">
            {isRegister
              ? 'Digite seu e-mail e crie uma senha para começar a colecionar.'
              : 'Digite seu e-mail e senha para entrar na sua conta Kurio.'}
          </p>

          {formError && (
            <div
              role="alert"
              data-testid="auth-error-alert"
              className="rounded-[5px] bg-[#38220F] border border-[#F0805F] p-3 flex items-start gap-2.5 text-xs text-[#F5F1EB]"
            >
              <AlertCircle className="w-4 h-4 text-[#F0805F] shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {isRegister && (
              <div className="space-y-1">
                <label htmlFor="auth-name" className="sr-only">
                  Nome de usuário
                </label>
                <input
                  id="auth-name"
                  data-testid="auth-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome de usuário"
                  className="w-full h-10 px-3.5 rounded-[5px] bg-[#140D0A] border border-[#55321F] text-sm text-[#F5F1EB] placeholder-[#B39463] focus:border-[#D28A4C] focus:outline-none"
                />
                {fieldErrors.name && (
                  <p data-testid="auth-name-error" className="text-xs text-[#F0805F]">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="auth-email" className="sr-only">
                E-mail
              </label>
              <input
                id="auth-email"
                data-testid="auth-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegister ? 'Digite seu endereço de e-mail' : 'ana@nft.test'}
                className="w-full h-10 px-3.5 rounded-[5px] bg-[#140D0A] border border-[#55321F] text-sm text-[#F5F1EB] placeholder-[#B39463] focus:border-[#D28A4C] focus:outline-none"
              />
              {fieldErrors.email && (
                <p data-testid="auth-email-error" className="text-xs text-[#F0805F]">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="auth-password" className="sr-only">
                Senha
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  data-testid="auth-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  className="w-full h-10 pl-3.5 pr-10 rounded-[5px] bg-[#140D0A] border border-[#55321F] text-sm text-[#F5F1EB] placeholder-[#B39463] focus:border-[#D28A4C] focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#CFB28C] hover:text-[#F5F1EB]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p data-testid="auth-password-error" className="text-xs text-[#F0805F]">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {isRegister && (
              <div className="space-y-1">
                <label htmlFor="auth-password-confirm" className="sr-only">
                  Confirmar senha
                </label>
                <input
                  id="auth-password-confirm"
                  data-testid="auth-password-confirm-input"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="Confirmar senha"
                  className="w-full h-10 px-3.5 rounded-[5px] bg-[#140D0A] border border-[#55321F] text-sm text-[#F5F1EB] placeholder-[#B39463] focus:border-[#D28A4C] focus:outline-none"
                />
                {fieldErrors.passwordConfirmation && (
                  <p data-testid="auth-password-confirm-error" className="text-xs text-[#F0805F]">
                    {fieldErrors.passwordConfirmation}
                  </p>
                )}
              </div>
            )}

            {!isRegister && (
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  data-testid="fill-demo-credentials-btn"
                  onClick={fillDemoCredentials}
                  className="text-[#CFB28C] hover:text-[#E89B55] underline"
                >
                  Usar conta demo (ana@nft.test)
                </button>
                <span className="text-[#E89B55]">Esqueceu a senha?</span>
              </div>
            )}

            <button
              type="submit"
              data-testid="auth-submit-btn"
              disabled={isSubmitting}
              className="w-full h-[45px] rounded-[5px] bg-[#D28A4C] hover:bg-[#E89B55] disabled:opacity-50 text-[#140D0A] font-bold text-base flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <span>{isRegister ? 'Criar conta' : 'Entrar'}</span>
              )}
            </button>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#55321F] w-full" />
            <span className="bg-[#241612] px-3 text-xs text-[#CFB28C] whitespace-nowrap">
              {isRegister ? 'Ou cadastre-se com' : 'Ou continue com'}
            </span>
            <div className="border-t border-[#55321F] w-full" />
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="w-full h-10 rounded-[5px] bg-[#140D0A] border border-[#55321F] hover:border-[#D28A4C] text-xs sm:text-sm font-medium text-[#CFB28C] hover:text-[#F5F1EB] flex items-center justify-center gap-2 transition-colors"
            >
              <span>Continuar com Google</span>
            </button>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="w-full h-10 rounded-[5px] bg-[#140D0A] border border-[#55321F] hover:border-[#D28A4C] text-xs sm:text-sm font-medium text-[#CFB28C] hover:text-[#F5F1EB] flex items-center justify-center gap-2 transition-colors"
            >
              <span>Continuar com Facebook</span>
            </button>
          </div>
        </div>

        <div className="h-[10px] w-full bg-[#D28A4C]" />
      </div>
    </div>
  )
}

