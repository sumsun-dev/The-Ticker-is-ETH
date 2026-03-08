import React, { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'

const PrivyWrapper = React.lazy(() => import('./providers/PrivyWrapper'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="min-h-screen bg-[#050508]" />}>
      <PrivyWrapper>
        <App />
      </PrivyWrapper>
    </Suspense>
  </StrictMode>,
)
