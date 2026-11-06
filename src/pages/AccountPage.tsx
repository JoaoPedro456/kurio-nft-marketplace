import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  Camera,
  Heart,
  LogOut,
  Plus,
  ShoppingBag,
  User as UserIcon,
  Wallet as WalletIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, AppApiError } from '@/lib/api/client'
import type { Network, WalletProvider } from '@/lib/api/contracts'
import {
  useFavoritesQuery,
  useOrdersListQuery,
  useWalletMutations,
  useWalletsQuery,
} from '@/lib/hooks'
import { clearUserScopedCache, queryClient } from '@/lib/query'
import { reconnectRealtimeNow } from '@/lib/realtime'
import { sessionStore, useAuthSnapshot } from '@/lib/session'

export function AccountPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useAuthSnapshot()

  const isWalletsTab = location.pathname.startsWith('/account/wallets')

  useEffect(() => {
    if (!session) {
      navigate({
        to: '/login',
        search: { redirect: location.pathname },
        replace: true,
      })
    }
  }, [session, location.pathname, navigate])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('11 99876-5432')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const { data: wallets } = useWalletsQuery()
  const { createWallet, updateWallet } = useWalletMutations()
  const { data: favorites } = useFavoritesQuery()
  const { data: orders } = useOrdersListQuery(Boolean(session))

  const [walletLabel, setWalletLabel] = useState('Carteira Principal Kurio')
  const [walletAddress, setWalletAddress] = useState('0x71C000000000000000000000000000000008976F')
  const [walletNetwork, setWalletNetwork] = useState<Network>('ethereum')
  const [walletProvider, setWalletProvider] = useState<WalletProvider>('metamask')
  const [walletEns, setWalletEns] = useState('ana.kurio.eth')
  const [walletEmail, setWalletEmail] = useState('')

  const [showAddSecondary, setShowAddSecondary] = useState(false)
  const [secLabel, setSecLabel] = useState('')
  const [secAddress, setSecAddress] = useState('')
  const [secNetwork, setSecNetwork] = useState<Network>('polygon')
  const [sameAsPrimary, setSameAsPrimary] = useState(true)

  useEffect(() => {
    if (!session) return
    const parts = session.user.name.trim().split(' ')
    setFirstName(parts[0] ?? '')
    setLastName(parts.slice(1).join(' '))
    setEmail(session.user.email)
    setUsername(session.user.username || session.user.email.split('@')[0])
    setBio(session.user.bio || 'Colecionador(a) de arte generativa e edições raras na Kurio.')
    setWalletEmail(session.user.email)
  }, [session])

  const primaryWallet = wallets?.find((w) => w.kind === 'primary') ?? wallets?.[0]
  const secondaryWallets = wallets?.filter((w) => w.id !== primaryWallet?.id) ?? []

  useEffect(() => {
    if (primaryWallet) {
      setWalletLabel(primaryWallet.label)
      setWalletAddress(primaryWallet.address)
      setWalletNetwork(primaryWallet.networks[0] ?? 'ethereum')
      setWalletProvider(primaryWallet.provider)
    }
  }, [primaryWallet])

  if (!session) return null

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    if (fullName.length < 2) {
      toast.error('O nome completo deve ter ao menos 2 caracteres.')
      return
    }
    setSavingProfile(true)
    try {
      const updatedUser = await api.updateProfile({
        name: fullName,
        email: email.trim(),
        username: username.trim(),
        bio: bio.trim(),
      })
      sessionStore.updateUser(updatedUser)
      toast.success('Dados do perfil atualizados com sucesso!')
    } catch (err) {
      const msg = err instanceof AppApiError ? err.message : 'Erro ao salvar perfil.'
      toast.error(msg)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangeAvatar = async () => {
    const avatars = [
      '/images/avatars/user-1.svg',
      '/images/avatars/user-2.svg',
      '/images/avatars/creator-1.svg',
      '/images/avatars/creator-2.svg',
    ]
    const currentIdx = avatars.indexOf(session.user.avatarUrl ?? '')
    const nextAvatar = avatars[(currentIdx + 1) % avatars.length]
    try {
      const updated = await api.updateAvatar(nextAvatar)
      sessionStore.updateUser(updated)
      toast.success('Foto do perfil atualizada!')
    } catch {
      toast.error('Não foi possível atualizar o avatar.')
    }
  }

  const handleRemoveAvatar = async () => {
    try {
      const updated = await api.updateAvatar(null)
      sessionStore.updateUser(updated)
      toast.info('Foto do perfil removida.')
    } catch {
      toast.error('Não foi possível remover o avatar.')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword) {
      toast.error('Preencha a senha atual e a nova senha.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('A confirmação da nova senha não confere.')
      return
    }
    setSavingPassword(true)
    try {
      await api.changePassword({
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      toast.success('Senha alterada com sucesso!')
    } catch (err) {
      const msg = err instanceof AppApiError ? err.message : 'Erro ao alterar a senha.'
      toast.error(msg)
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSavePrimaryWallet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walletAddress || walletAddress.trim().length < 8) {
      toast.error('Informe um endereço de carteira válido.')
      return
    }
    try {
      if (primaryWallet) {
        await updateWallet.mutateAsync({
          id: primaryWallet.id,
          input: {
            kind: 'primary',
            label: walletLabel.trim(),
            provider: walletProvider,
            address: walletAddress.trim(),
            networks: [walletNetwork],
          },
        })
        toast.success('Carteira principal atualizada!')
      } else {
        await createWallet.mutateAsync({
          kind: 'primary',
          label: walletLabel.trim(),
          provider: walletProvider,
          address: walletAddress.trim(),
          networks: [walletNetwork],
        })
        toast.success('Carteira principal cadastrada!')
      }
    } catch (err) {
      const msg = err instanceof AppApiError ? err.message : 'Erro ao salvar carteira.'
      toast.error(msg)
    }
  }

  const handleCreateSecondaryWallet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!secLabel.trim() || secAddress.trim().length < 8) {
      toast.error('Preencha o nome e um endereço válido para a carteira secundária.')
      return
    }
    try {
      await createWallet.mutateAsync({
        kind: 'secondary',
        label: secLabel.trim(),
        provider: 'metamask',
        address: secAddress.trim(),
        networks: [secNetwork],
      })
      setSecLabel('')
      setSecAddress('')
      setShowAddSecondary(false)
      toast.success('Carteira secundária adicionada com sucesso!')
    } catch (err) {
      const msg =
        err instanceof AppApiError ? err.message : 'Erro ao adicionar carteira secundária.'
      toast.error(msg)
    }
  }

  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {
      /* ignore */
    }
    sessionStore.setSession(null)
    sessionStore.rotateGuestCartId()
    clearUserScopedCache(queryClient)
    queryClient.invalidateQueries({ queryKey: ['cart'] })
    reconnectRealtimeNow()
    navigate({ to: '/' })
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-3 rounded-[6px] bg-[#241612] border border-[#3F2319] py-5">
          <h1 className="px-5 text-lg font-bold text-[#F5F1EB] mb-4">Meu perfil</h1>

          <nav aria-label="Menu da conta" className="space-y-1">
            <Link
              to="/account/profile"
              data-testid="account-nav-profile"
              className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                !isWalletsTab
                  ? 'bg-[#140D0A] border-l-[5px] border-[#D28A4C] text-[#E89B55] font-bold'
                  : 'text-[#CFB28C] hover:text-[#F5F1EB]'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>Dados do perfil</span>
            </Link>

            <Link
              to="/account/wallets"
              data-testid="account-nav-wallets"
              className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isWalletsTab
                  ? 'bg-[#140D0A] border-l-[5px] border-[#D28A4C] text-[#E89B55] font-bold'
                  : 'text-[#CFB28C] hover:text-[#F5F1EB]'
              }`}
            >
              <WalletIcon className="w-4 h-4" />
              <span>Carteiras</span>
            </Link>

            <div className="flex items-center justify-between px-5 py-2.5 text-sm text-[#CFB28C]">
              <span className="flex items-center gap-3">
                <ShoppingBag className="w-4 h-4" />
                <span>Transações ({orders?.length ?? 0})</span>
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-2.5 text-sm text-[#CFB28C]">
              <span className="flex items-center gap-3">
                <Heart className="w-4 h-4" />
                <span>Favoritos ({favorites?.nftIds.length ?? 0})</span>
              </span>
            </div>
          </nav>

          <div className="mt-6 pt-5 border-t border-[#3F2319] px-5">
            <button
              type="button"
              data-testid="account-logout-btn"
              onClick={handleLogout}
              className="flex items-center gap-2.5 text-sm font-bold text-[#E89B55] hover:text-[#F0805F] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </aside>

        <div className="lg:col-span-9 space-y-10">
          {!isWalletsTab ? (
            <>
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <h2 className="text-base font-medium text-[#F5F1EB]">Informações do colecionador</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label htmlFor="profile-firstname" className="block text-sm text-[#F5F1EB]">
                      Nome <span className="text-[#F0805F]">*</span>
                    </label>
                    <input
                      id="profile-firstname"
                      data-testid="profile-firstname-input"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="profile-lastname" className="block text-sm text-[#F5F1EB]">
                      Sobrenome <span className="text-[#F0805F]">*</span>
                    </label>
                    <input
                      id="profile-lastname"
                      data-testid="profile-lastname-input"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="profile-email" className="block text-sm text-[#F5F1EB]">
                      Endereço de e-mail <span className="text-[#F0805F]">*</span>
                    </label>
                    <input
                      id="profile-email"
                      data-testid="profile-email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="profile-phone" className="block text-sm text-[#F5F1EB]">
                      Telefone
                    </label>
                    <div className="flex gap-2">
                      <span className="h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] inline-flex items-center">
                        +55
                      </span>
                      <input
                        id="profile-phone"
                        data-testid="profile-phone-input"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="profile-username" className="block text-sm text-[#F5F1EB]">
                      Nome de usuário <span className="text-[#F0805F]">*</span>
                    </label>
                    <input
                      id="profile-username"
                      data-testid="profile-username-input"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-sm text-[#F5F1EB]">Foto</span>
                    <div className="flex items-center gap-3">
                      <div className="w-[50px] h-[50px] rounded-full bg-[#241612] border border-[#3F2319] flex items-center justify-center overflow-hidden shrink-0">
                        {session.user.avatarUrl ? (
                          <img
                            src={session.user.avatarUrl}
                            alt={session.user.name}
                            width={50}
                            height={50}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Camera className="w-5 h-5 text-[#E89B55]" />
                        )}
                      </div>
                      <button
                        type="button"
                        data-testid="change-avatar-btn"
                        onClick={handleChangeAvatar}
                        className="h-10 px-5 rounded-[3px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-sm transition-colors"
                      >
                        Alterar
                      </button>
                      <button
                        type="button"
                        data-testid="remove-avatar-btn"
                        onClick={handleRemoveAvatar}
                        className="h-10 px-3 text-sm text-[#F5F1EB] hover:text-[#F0805F] transition-colors"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="profile-bio" className="block text-sm text-[#F5F1EB]">
                    Biografia
                  </label>
                  <textarea
                    id="profile-bio"
                    data-testid="profile-bio-input"
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full p-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  data-testid="save-profile-btn"
                  disabled={savingProfile}
                  className="h-10 px-6 rounded-[3px] bg-[#D28A4C] hover:bg-[#E89B55] disabled:opacity-50 text-[#140D0A] font-bold text-sm transition-colors"
                >
                  {savingProfile ? 'Salvando...' : 'Salvar perfil'}
                </button>
              </form>

              <form
                onSubmit={handleChangePassword}
                className="space-y-5 border-t border-[#3F2319] pt-8 max-w-md"
              >
                <h2 className="text-base font-medium text-[#F5F1EB]">Alterar senha</h2>

                <div className="space-y-1.5">
                  <label htmlFor="current-password" className="block text-sm text-[#F5F1EB]">
                    Senha atual
                  </label>
                  <input
                    id="current-password"
                    data-testid="current-password-input"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="block text-sm text-[#F5F1EB]">
                    Nova senha
                  </label>
                  <input
                    id="new-password"
                    data-testid="new-password-input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirm-new-password" className="block text-sm text-[#F5F1EB]">
                    Confirmar nova senha
                  </label>
                  <input
                    id="confirm-new-password"
                    data-testid="confirm-new-password-input"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] focus:border-[#D28A4C] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  data-testid="save-password-btn"
                  disabled={savingPassword}
                  className="h-10 px-6 rounded-[3px] bg-[#D28A4C] hover:bg-[#E89B55] disabled:opacity-50 text-[#140D0A] font-bold text-sm transition-colors"
                >
                  {savingPassword ? 'Atualizando...' : 'Salvar alterações'}
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-10">
              <form onSubmit={handleSavePrimaryWallet} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-medium text-[#F5F1EB]">Carteira principal</h2>
                    <p className="text-xs text-[#CFB28C] mt-1">
                      A carteira a seguir será usada por padrão para compras e transferências.
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[#E89B55]">Adicionar</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label htmlFor="wallet-firstname" className="block text-sm text-[#F5F1EB]">
                      Nome <span className="text-[#F0805F]">*</span>
                    </label>
                    <input
                      id="wallet-firstname"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wallet-lastname" className="block text-sm text-[#F5F1EB]">
                      Sobrenome <span className="text-[#F0805F]">*</span>
                    </label>
                    <input
                      id="wallet-lastname"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wallet-network" className="block text-sm text-[#F5F1EB]">
                      Rede <span className="text-[#F0805F]">*</span>
                    </label>
                    <select
                      id="wallet-network"
                      data-testid="primary-wallet-network"
                      value={walletNetwork}
                      onChange={(e) => setWalletNetwork(e.target.value as Network)}
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB]"
                    >
                      <option value="ethereum">Ethereum Mainnet</option>
                      <option value="polygon">Polygon</option>
                      <option value="arbitrum">Arbitrum</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wallet-label" className="block text-sm text-[#F5F1EB]">
                      Nome da carteira <span className="text-[#F0805F]">*</span>
                    </label>
                    <input
                      id="wallet-label"
                      data-testid="primary-wallet-label"
                      type="text"
                      value={walletLabel}
                      onChange={(e) => setWalletLabel(e.target.value)}
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wallet-address" className="block text-sm text-[#F5F1EB]">
                      Endereço da carteira <span className="text-[#F0805F]">*</span>
                    </label>
                    <input
                      id="wallet-address"
                      data-testid="primary-wallet-address"
                      type="text"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder="0x... ou nome ENS"
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wallet-backup" className="block text-sm text-[#F5F1EB]">
                      Carteira secundária
                    </label>
                    <input
                      id="wallet-backup"
                      type="text"
                      placeholder="Endereço de backup ou cofre (opcional)"
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB] placeholder-[#B39463]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wallet-provider" className="block text-sm text-[#F5F1EB]">
                      Tipo de carteira <span className="text-[#F0805F]">*</span>
                    </label>
                    <select
                      id="wallet-provider"
                      value={walletProvider}
                      onChange={(e) => setWalletProvider(e.target.value as WalletProvider)}
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB]"
                    >
                      <option value="metamask">MetaMask</option>
                      <option value="walletconnect">WalletConnect</option>
                      <option value="coinbase">Coinbase Wallet</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wallet-ens" className="block text-sm text-[#F5F1EB]">
                      Domínio ENS <span className="text-[#F0805F]">*</span>
                    </label>
                    <input
                      id="wallet-ens"
                      type="text"
                      value={walletEns}
                      onChange={(e) => setWalletEns(e.target.value)}
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wallet-email" className="block text-sm text-[#F5F1EB]">
                      Endereço de e-mail <span className="text-[#F0805F]">*</span>
                    </label>
                    <input
                      id="wallet-email"
                      type="email"
                      value={walletEmail}
                      onChange={(e) => setWalletEmail(e.target.value)}
                      className="w-full h-10 px-3 rounded-[3px] bg-[#241612] border border-[#3F2319] text-sm text-[#F5F1EB]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  data-testid="save-primary-wallet-btn"
                  disabled={updateWallet.isPending || createWallet.isPending}
                  className="h-10 px-6 rounded-[3px] bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-sm transition-colors"
                >
                  Salvar carteira
                </button>
              </form>

              <div className="space-y-4 border-t border-[#3F2319] pt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-medium text-[#F5F1EB]">Carteira secundária</h3>
                    <p className="text-xs text-[#CFB28C] mt-1">
                      {secondaryWallets.length === 0
                        ? 'Você ainda não configurou uma carteira secundária.'
                        : `${secondaryWallets.length} carteira(s) adicional(is) cadastrada(s).`}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-sm text-[#CFB28C] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sameAsPrimary}
                        onChange={(e) => setSameAsPrimary(e.target.checked)}
                        className="w-4 h-4 accent-[#D28A4C]"
                      />
                      <span>Igual à carteira principal</span>
                    </label>

                    <button
                      type="button"
                      data-testid="toggle-add-secondary-wallet-btn"
                      onClick={() => setShowAddSecondary((v) => !v)}
                      className="text-sm font-medium text-[#E89B55] hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>

                {showAddSecondary && (
                  <form
                    onSubmit={handleCreateSecondaryWallet}
                    data-testid="secondary-wallet-form"
                    className="p-4 rounded-[6px] bg-[#241612] border border-[#3F2319] grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
                  >
                    <div className="space-y-1">
                      <label htmlFor="sec-wallet-label" className="block text-xs text-[#F5F1EB]">
                        Identificação
                      </label>
                      <input
                        id="sec-wallet-label"
                        data-testid="sec-wallet-label-input"
                        type="text"
                        placeholder="Ex: Ledger Vault"
                        value={secLabel}
                        onChange={(e) => setSecLabel(e.target.value)}
                        className="w-full h-9 px-3 rounded bg-[#140D0A] border border-[#3F2319] text-xs text-[#F5F1EB]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="sec-wallet-address" className="block text-xs text-[#F5F1EB]">
                        Endereço on-chain
                      </label>
                      <input
                        id="sec-wallet-address"
                        data-testid="sec-wallet-address-input"
                        type="text"
                        placeholder="0x99A8B7C6D5E4..."
                        value={secAddress}
                        onChange={(e) => setSecAddress(e.target.value)}
                        className="w-full h-9 px-3 rounded bg-[#140D0A] border border-[#3F2319] text-xs text-[#F5F1EB]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <select
                        aria-label="Rede da carteira secundária"
                        value={secNetwork}
                        onChange={(e) => setSecNetwork(e.target.value as Network)}
                        className="h-9 px-2.5 rounded bg-[#140D0A] border border-[#3F2319] text-xs text-[#F5F1EB]"
                      >
                        <option value="polygon">Polygon</option>
                        <option value="ethereum">Ethereum</option>
                        <option value="arbitrum">Arbitrum</option>
                      </select>
                      <button
                        type="submit"
                        data-testid="save-sec-wallet-btn"
                        className="flex-1 h-9 px-4 rounded bg-[#D28A4C] hover:bg-[#E89B55] text-[#140D0A] font-bold text-xs uppercase"
                      >
                        Adicionar
                      </button>
                    </div>
                  </form>
                )}

                {secondaryWallets.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {secondaryWallets.map((w) => (
                      <div
                        key={w.id}
                        data-testid={`wallet-card-${w.id}`}
                        className="p-4 rounded-[6px] bg-[#241612] border border-[#3F2319] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#F5F1EB]">{w.label}</p>
                          <p className="text-xs text-[#CFB28C] truncate">{w.address}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[#140D0A] text-[10px] text-[#E89B55] uppercase">
                            {w.networks.join(', ')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateWallet.mutate(
                              { id: w.id, input: { kind: 'primary' } },
                              {
                                onSuccess: () =>
                                  toast.success(`${w.label} definida como carteira principal.`),
                              },
                            )
                          }
                          className="text-xs text-[#E89B55] hover:underline shrink-0"
                        >
                          Tornar principal
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

