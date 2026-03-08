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
const Contributors = React.lazy(() => import('./pages/Contributors'));
const Events = React.lazy(() => import('./pages/Events'));
const Contents = React.lazy(() => import('./pages/Contents'));
const ContentsDetail = React.lazy(() => import('./pages/ContentsDetail'));
const WriteResearch = React.lazy(() => import('./pages/WriteResearch'));
const Ecosystem = React.lazy(() => import('./pages/Ecosystem'));
const AdminLogin = React.lazy(() => import('./pages/AdminLogin'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Claim = React.lazy(() => import('./pages/Claim'));
const AdminRewards = React.lazy(() => import('./pages/AdminRewards'));
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

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Toaster theme="dark" position="bottom-right" richColors />
      <MainLayout>
        <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/team" element={<Team />} />
              <Route path="/team/:id" element={<MemberDetail />} />
              <Route path="/contributors" element={<Contributors />} />
              <Route path="/contributors/:id" element={<MemberDetail />} />
              <Route path="/ecosystem" element={<Ecosystem />} />
              <Route path="/events" element={<Events />} />
              <Route path="/contents" element={<Contents />} />
              <Route path="/contents/:id" element={<ContentsDetail />} />
              <Route path="/contents/write" element={<WriteResearch />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/claim" element={<Claim />} />
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin/rewards" element={<AdminRewards />} />
              {/* Backward-compatible redirects */}
              <Route path="/research" element={<Navigate to="/contents" replace />} />
              <Route path="/research/write" element={<Navigate to="/contents/write" replace />} />
              <Route path="/research/:id" element={<RedirectWithParams base="/contents" />} />
              <Route path="/news" element={<Navigate to="/contents" replace />} />
              <Route path="/news/:id" element={<RedirectWithParams base="/contents" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </MainLayout>
    </Router>
  );
}

export default App;
