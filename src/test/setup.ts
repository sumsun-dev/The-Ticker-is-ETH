import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Node 22+ injects its own localStorage/sessionStorage globals (methodless
// unless --localstorage-file is set), shadowing jsdom's working Storage.
// Replace both with a functional in-memory implementation.
function memoryStorage(): Storage {
  let store = new Map<string, string>()
  return {
    get length() { return store.size },
    clear: () => { store = new Map() },
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    key: (i: number) => [...store.keys()][i] ?? null,
  }
}
for (const name of ['localStorage', 'sessionStorage'] as const) {
  const value = memoryStorage()
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true })
  Object.defineProperty(window, name, { value, writable: true, configurable: true })
}

afterEach(() => {
  cleanup()
})
