import React, { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'

// 재배포로 청크 해시가 바뀌어 캐시된 옛 index.html이 사라진 청크를 요청하면
// "Failed to fetch dynamically imported module"가 발생한다. 이 경우 새 index.html을
// 받도록 한 번만 자동 새로고침한다. (세션당 1회 가드로 무한 루프 방지)
window.addEventListener('vite:preloadError', () => {
    if (!sessionStorage.getItem('chunk-reload')) {
        sessionStorage.setItem('chunk-reload', '1');
        window.location.reload();
    }
});

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
