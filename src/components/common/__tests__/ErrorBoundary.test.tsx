import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from '../ErrorBoundary'

const ThrowingChild = () => {
  throw new Error('Test error')
}

const GoodChild = () => <div>All good</div>

describe('ErrorBoundary', () => {
  // Suppress console.error for expected errors
  const originalError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })
  afterEach(() => {
    console.error = originalError
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders fallback UI on error', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )
    // i18n: "문제가 발생했습니다" (ko) or "Something went wrong" (en)
    expect(screen.getByText(/문제가 발생|something went wrong/i)).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowingChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
  })

  it('recovers when "Try Again" is clicked', async () => {
    let shouldThrow = true
    const MaybeThrow = () => {
      if (shouldThrow) throw new Error('Boom')
      return <div>Recovered</div>
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    )

    shouldThrow = false
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /try again|다시 시도/i }))
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })

  it('resets error state when resetKey prop changes', () => {
    let shouldThrow = true
    const MaybeThrow = () => {
      if (shouldThrow) throw new Error('Boom')
      return <div>Recovered</div>
    }

    const { rerender } = render(
      <ErrorBoundary resetKey="/old">
        <MaybeThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/문제가 발생|something went wrong/i)).toBeInTheDocument()

    shouldThrow = false
    rerender(
      <ErrorBoundary resetKey="/new">
        <MaybeThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })

  it('keeps error state when resetKey does not change', () => {
    let shouldThrow = true
    const MaybeThrow = () => {
      if (shouldThrow) throw new Error('Boom')
      return <div>Recovered</div>
    }

    const { rerender } = render(
      <ErrorBoundary resetKey="/same">
        <MaybeThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/문제가 발생|something went wrong/i)).toBeInTheDocument()

    shouldThrow = false
    rerender(
      <ErrorBoundary resetKey="/same">
        <MaybeThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/문제가 발생|something went wrong/i)).toBeInTheDocument()
  })
})
