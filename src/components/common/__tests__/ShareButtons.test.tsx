import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import ShareButtons from '../ShareButtons'
import i18n from '../../../i18n'

const writeTextMock = vi.fn().mockResolvedValue(undefined)

function renderShareButtons(props = { url: 'https://example.com/article/1', title: 'Test Article' }) {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <ShareButtons {...props} />
      </I18nextProvider>
    </MemoryRouter>,
  )
}

describe('ShareButtons', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.stubGlobal('open', vi.fn())
    writeTextMock.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    })
  })

  const defaultProps = {
    url: 'https://example.com/article/1',
    title: 'Test Article',
  }

  it('renders 3 share buttons', () => {
    renderShareButtons(defaultProps)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
  })

  it('opens Twitter share URL on click', () => {
    renderShareButtons(defaultProps)
    const twitterBtn = screen.getByLabelText(/twitter/i)
    fireEvent.click(twitterBtn)

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('twitter.com/intent/tweet'),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('opens Telegram share URL on click', () => {
    renderShareButtons(defaultProps)
    const telegramBtn = screen.getByLabelText(/telegram/i)
    fireEvent.click(telegramBtn)

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('t.me/share/url'),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('copies link to clipboard on click', async () => {
    renderShareButtons(defaultProps)
    const copyBtn = screen.getByLabelText(/copy link/i)
    fireEvent.click(copyBtn)

    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(defaultProps.url)
    })
  })
})
