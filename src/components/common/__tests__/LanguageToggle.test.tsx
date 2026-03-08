import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageToggle from '../LanguageToggle'
import { renderWithProviders } from '../../../test/helpers/render'
import i18n from '../../../i18n'

describe('LanguageToggle', () => {
  it('renders KO and EN labels', () => {
    renderWithProviders(<LanguageToggle />)
    expect(screen.getByText('KO')).toBeInTheDocument()
    expect(screen.getByText('EN')).toBeInTheDocument()
  })

  it('toggles language from ko to en', async () => {
    await i18n.changeLanguage('ko')
    renderWithProviders(<LanguageToggle />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /switch to english|한국어로 변경/i }))
    expect(i18n.language).toBe('en')
  })

  it('toggles language from en to ko', async () => {
    await i18n.changeLanguage('en')
    renderWithProviders(<LanguageToggle />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /switch to english|한국어로 변경/i }))
    expect(i18n.language).toBe('ko')
  })
})
