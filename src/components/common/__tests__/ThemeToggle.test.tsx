import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import ThemeToggle from '../ThemeToggle'
import { renderWithProviders } from '../../../test/helpers/render'

describe('ThemeToggle', () => {
  it('renders a toggle button', () => {
    renderWithProviders(<ThemeToggle />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('has accessible aria-label', () => {
    renderWithProviders(<ThemeToggle />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-label')
  })
})
