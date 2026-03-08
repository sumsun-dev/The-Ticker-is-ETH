/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    dark: '#050508',
                    surface: '#0a0a12',
                    'surface-light': '#1a1a2e',
                    primary: '#2D5FBF',
                    accent: '#629FFF',
                },
                eth: {
                    purple: '#A086FC',
                },
                social: {
                    telegram: '#26A5E4',
                },
                theme: {
                    bg: 'var(--bg-primary)',
                    'bg-secondary': 'var(--bg-secondary)',
                    surface: 'var(--bg-surface)',
                    'surface-hover': 'var(--bg-surface-hover)',
                    text: 'var(--text-primary)',
                    'text-secondary': 'var(--text-secondary)',
                    'text-muted': 'var(--text-muted)',
                    border: 'var(--border-primary)',
                    'border-secondary': 'var(--border-secondary)',
                },
            },
            typography: {
                brand: {
                    css: {
                        '--tw-prose-body': 'var(--text-secondary)',
                        '--tw-prose-headings': 'var(--text-primary)',
                        '--tw-prose-links': '#629FFF',
                        '--tw-prose-bold': 'var(--text-primary)',
                        '--tw-prose-code': '#629FFF',
                        '--tw-prose-quotes': 'var(--text-muted)',
                        '--tw-prose-quote-borders': 'var(--border-primary)',
                        '--tw-prose-hr': 'var(--border-primary)',
                        '--tw-prose-th-borders': 'var(--border-primary)',
                        '--tw-prose-td-borders': 'var(--border-secondary)',
                        '--tw-prose-counters': 'var(--text-muted)',
                        '--tw-prose-bullets': 'var(--text-muted)',
                        '--tw-prose-pre-bg': 'rgba(255, 255, 255, 0.05)',
                        '--tw-prose-pre-code': 'var(--text-secondary)',
                        'a': {
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                        },
                        'code': {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem',
                            fontWeight: '400',
                        },
                        'code::before': { content: 'none' },
                        'code::after': { content: 'none' },
                        'table': {
                            fontSize: '0.875rem',
                            display: 'block',
                            overflowX: 'auto',
                            '-webkit-overflow-scrolling': 'touch',
                        },
                        'thead tr': {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        },
                        'th': {
                            whiteSpace: 'nowrap',
                        },
                        'tbody tr': {
                            transition: 'background-color 0.15s',
                            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
                        },
                        'blockquote': {
                            borderLeftColor: '#629FFF',
                        },
                    },
                },
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
