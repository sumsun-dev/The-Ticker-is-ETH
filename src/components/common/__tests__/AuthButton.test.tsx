import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthButton from '../AuthButton'
import { renderWithProviders } from '../../../test/helpers/render'

const mockLogin = vi.fn()
const mockLogout = vi.fn()

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    ready: true,
    authenticated: false,
    login: mockLogin,
    logout: mockLogout,
    user: null,
  })),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { usePrivy } = await import('@privy-io/react-auth')
const mockUsePrivy = vi.mocked(usePrivy)

describe('AuthButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: false,
      login: mockLogin,
      logout: mockLogout,
      user: null,
    } as unknown as ReturnType<typeof usePrivy>)
  })

  it('renders nothing when not ready', () => {
    mockUsePrivy.mockReturnValue({
      ready: false,
      authenticated: false,
      login: mockLogin,
      logout: mockLogout,
      user: null,
    } as unknown as ReturnType<typeof usePrivy>)

    const { container } = renderWithProviders(<AuthButton />)
    expect(container.firstChild).toBeNull()
  })

  it('renders connect button when not authenticated', () => {
    renderWithProviders(<AuthButton />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('calls login when connect button clicked', async () => {
    renderWithProviders(<AuthButton />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button'))
    expect(mockLogin).toHaveBeenCalledOnce()
  })

  it('shows dropdown with profile and logout when authenticated', async () => {
    mockUsePrivy.mockReturnValue({
      ready: true,
      authenticated: true,
      login: mockLogin,
      logout: mockLogout,
      user: {
        linkedAccounts: [
          { type: 'wallet', address: '0x1234567890abcdef1234567890abcdef12345678' },
        ],
      },
    } as unknown as ReturnType<typeof usePrivy>)

    renderWithProviders(<AuthButton />)
    const user = userEvent.setup()

    // Truncated address should be shown
    const trigger = screen.getByText('0x1234...5678')
    await user.click(trigger)

    // i18n may show Korean "로그아웃" or English "Logout"
    const logoutButton = screen.getByRole('button', { name: /logout|로그아웃/i })
    expect(logoutButton).toBeInTheDocument()
  })
})
