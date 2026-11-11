import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import LanguageToggle from '../LanguageToggle'
import { otherLangHref } from '../../../utils/lang'
import { renderWithProviders } from '../../../test/helpers/render'

describe('LanguageToggle', () => {
  it('renders KO and EN labels', () => {
    renderWithProviders(<LanguageToggle />)
    expect(screen.getByText('KO')).toBeInTheDocument()
    expect(screen.getByText('EN')).toBeInTheDocument()
  })

  it('links to the English address of the same page', () => {
    renderWithProviders(<LanguageToggle />)
    expect(screen.getByRole('link', { name: /switch to english/i })).toHaveAttribute('href', '/en')
  })

  it('builds the other language address', () => {
    expect(otherLangHref('/', '', false)).toBe('/en')
    expect(otherLangHref('/eips/7702', '?tab=deep', false)).toBe('/en/eips/7702?tab=deep')
    // 영어판에서는 라우터 basename 이 /en 이라 pathname 이 곧 한국어 주소다
    expect(otherLangHref('/eips/7702', '', true)).toBe('/eips/7702')
    expect(otherLangHref('/', '', true)).toBe('/')
  })
})
