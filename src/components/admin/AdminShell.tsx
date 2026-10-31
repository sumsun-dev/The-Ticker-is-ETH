/** 관리자 화면 틀: ECK 남색 사이드바(모바일은 상단 바)와 밝은 본문. 성과·콘텐츠 작성이 같이 쓴다 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ExternalLink, Loader2, PenLine } from 'lucide-react';

/** 로고 워드마크 남색. 로고의 빨강을 선택 표시에 쓴다 */
const NAVY = '#10163A';
const RED = '#E45C59';

const NAV = [
  { key: 'stats', to: '/admin/stats', label: '성과', icon: BarChart3 },
  { key: 'write', to: '/admin/write', label: '콘텐츠 작성', icon: PenLine },
] as const;
export type AdminPage = (typeof NAV)[number]['key'];

const NavLinks: React.FC<{ active: AdminPage; compact?: boolean }> = ({ active, compact }) => (
  <>
    {NAV.map(({ key, to, label, icon: Icon }) => {
      const on = key === active;
      return (
        <Link
          key={key}
          to={to}
          aria-current={on ? 'page' : undefined}
          className={`relative flex items-center gap-2.5 rounded-md text-sm transition-colors ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} ${on ? 'bg-white/10 font-semibold text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
        >
          {on && !compact && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full" style={{ background: RED }} aria-hidden="true" />}
          <Icon size={15} aria-hidden="true" />
          {label}
        </Link>
      );
    })}
  </>
);

const AdminShell: React.FC<{ active: AdminPage; footnote?: React.ReactNode; children: React.ReactNode }> = ({ active, footnote, children }) => {
  // 페이지 스크롤바·바운스 배경도 밝게. 다른 페이지로 나가면 되돌린다
  useEffect(() => {
    document.documentElement.classList.add('admin-light');
    return () => document.documentElement.classList.remove('admin-light');
  }, []);

  return (
    <div className="admin-light min-h-screen text-sm md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col px-4 py-6 md:flex" style={{ background: NAVY }}>
        <Link to="/" className="mb-1 block px-2" aria-label="ECK 홈">
          <img src="/assets/eck-lockup-on-dark.svg" alt="ECK" className="h-8 w-auto" />
        </Link>
        <p className="mb-8 px-2 text-[11px] font-medium tracking-wide text-white/40">Admin</p>
        <nav className="space-y-1" aria-label="관리자 메뉴">
          <NavLinks active={active} />
        </nav>
        <div className="mt-auto space-y-4 px-2">
          {footnote && <div className="text-xs leading-relaxed text-white/45">{footnote}</div>}
          <Link to="/" className="flex items-center gap-1.5 text-xs text-white/55 hover:text-white">
            <ExternalLink size={12} aria-hidden="true" />
            사이트로 돌아가기
          </Link>
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2.5 md:hidden" style={{ background: NAVY }}>
        <Link to="/" aria-label="ECK 홈">
          <img src="/assets/eck-lockup-on-dark.svg" alt="ECK" className="h-6 w-auto" />
        </Link>
        <nav className="ml-auto flex gap-1" aria-label="관리자 메뉴">
          <NavLinks active={active} compact />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-6 md:px-10 md:pt-8">{children}</main>
    </div>
  );
};

export default AdminShell;

/** 관리자 비밀번호 입력. check가 실패하면 throw한 메시지를 보여 준다 */
export const AdminLogin: React.FC<{ title: string; check: (pw: string) => Promise<void> }> = ({ title, check }) => {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pw || loading) return;
        setLoading(true);
        setError('');
        check(pw)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : '확인 실패'))
          .finally(() => setLoading(false));
      }}
      className="mx-auto mt-[14vh] w-full max-w-xs"
    >
      <h1 className="mb-1 text-lg font-semibold text-theme-text">{title}</h1>
      <p className="mb-5 text-sm text-theme-text-muted">관리자 비밀번호를 입력하세요.</p>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="관리자 비밀번호"
        aria-label="관리자 비밀번호"
        autoFocus
        className="mb-2 w-full rounded-md border border-theme-border bg-theme-bg px-3 py-2 text-sm text-theme-text focus:border-zinc-400 focus:outline-none"
      />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60" style={{ background: NAVY }}>
        {loading && <Loader2 className="animate-spin" size={14} />}
        들어가기
      </button>
    </form>
  );
};
