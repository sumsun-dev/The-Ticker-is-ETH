export function useTheme() {
  return { theme: 'dark' as const, toggleTheme: () => {}, isDark: true } as const
}
