import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'sonner';
import MainLayout from './layouts/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import { PageSkeleton } from './components/common/Skeleton';
const Home = React.lazy(() => import('./pages/Home'));
const About = React.lazy(() => import('./pages/About'));
const Team = React.lazy(() => import('./pages/Team'));
const MemberDetail = React.lazy(() => import('./pages/MemberDetail'));
const Events = React.lazy(() => import('./pages/Events'));
const EventGenesis = React.lazy(() => import('./pages/EventGenesis'));
const Contents = React.lazy(() => import('./pages/Contents'));
const ContentsDetail = React.lazy(() => import('./pages/ContentsDetail'));
const VideoDetail = React.lazy(() => import('./pages/VideoDetail'));
const Ecosystem = React.lazy(() => import('./pages/Ecosystem'));
const News = React.lazy(() => import('./pages/News'));
const Debates = React.lazy(() => import('./pages/Debates'));
const DebateDetail = React.lazy(() => import('./pages/DebateDetail'));
const Calls = React.lazy(() => import('./pages/Calls'));
const CallDetail = React.lazy(() => import('./pages/CallDetail'));
const AdminLogin = React.lazy(() => import('./pages/AdminLogin'));
const AdminWrite = React.lazy(() => import('./pages/AdminWrite'));
const AdminStats = React.lazy(() => import('./pages/AdminStats'));
const Profile = React.lazy(() => import('./pages/Profile'));
// Privy SDK (~630 KB gz) mounts only on the routes that actually use login.
const PrivyWrapper = React.lazy(() => import('./providers/PrivyWrapper'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const RedirectWithParams: React.FC<{ base: string }> = ({ base }) => {
  const { id } = useParams();
  return <Navigate to={id ? `${base}/${id}` : base} replace />;
};

const AppRoutes: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/team" element={<Team />} />
          <Route path="/team/:id" element={<MemberDetail />} />
          <Route path="/contributors" element={<Navigate to="/team" replace />} />
          <Route path="/contributors/:id" element={<MemberDetail />} />
          <Route path="/ecosystem" element={<Ecosystem />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/ek1-genesis" element={<EventGenesis />} />
          <Route path="/contents" element={<Contents />} />
          <Route path="/contents/:id" element={<ContentsDetail />} />
          <Route path="/contents/videos" element={<Navigate to="/contents?category=Video" replace />} />
          <Route path="/contents/videos/:videoId" element={<VideoDetail />} />
          <Route path="/contents/write" element={<Navigate to="/admin/write" replace />} />
          <Route path="/profile" element={<PrivyWrapper><Profile /></PrivyWrapper>} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/stats" element={<AdminStats />} />
          <Route path="/admin/write" element={<AdminWrite />} />
          {/* Backward-compatible redirects */}
          <Route path="/research" element={<Navigate to="/contents" replace />} />
          <Route path="/research/write" element={<Navigate to="/admin/write" replace />} />
          <Route path="/research/:id" element={<RedirectWithParams base="/contents" />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:id" element={<RedirectWithParams base="/contents" />} />
          <Route path="/debates" element={<Debates />} />
          <Route path="/debates/:id" element={<DebateDetail />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/calls/:id" element={<CallDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

/** 관리자 화면(성과·콘텐츠 작성)은 자체 사이드바가 있어 사이트 내비게이션·푸터 없이 띄운다 */
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  /^\/admin\/(stats|write)/.test(useLocation().pathname) ? <>{children}</> : <MainLayout>{children}</MainLayout>;

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Toaster theme="dark" position="bottom-right" richColors />
      <Shell>
        <AppRoutes />
      </Shell>
    </Router>
  );
}

export default App;
