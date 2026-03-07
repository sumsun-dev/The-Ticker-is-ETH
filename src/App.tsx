import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import { PageSkeleton } from './components/common/Skeleton';

const Home = React.lazy(() => import('./pages/Home'));
const About = React.lazy(() => import('./pages/About'));
const Team = React.lazy(() => import('./pages/Team'));
const MemberDetail = React.lazy(() => import('./pages/MemberDetail'));
const Contributors = React.lazy(() => import('./pages/Contributors'));
const Events = React.lazy(() => import('./pages/Events'));
const News = React.lazy(() => import('./pages/News'));
const NewsDetail = React.lazy(() => import('./pages/NewsDetail'));
const Research = React.lazy(() => import('./pages/Research'));
const ResearchDetail = React.lazy(() => import('./pages/ResearchDetail'));
const WriteResearch = React.lazy(() => import('./pages/WriteResearch'));
const Ecosystem = React.lazy(() => import('./pages/Ecosystem'));
const AdminLogin = React.lazy(() => import('./pages/AdminLogin'));
const Profile = React.lazy(() => import('./pages/Profile'));

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

function App() {
  return (
    <Router>
      <ScrollToTop />
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
              <Route path="/news" element={<News />} />
              <Route path="/news/:id" element={<NewsDetail />} />
              <Route path="/research" element={<Research />} />
              <Route path="/research/:id" element={<ResearchDetail />} />
              <Route path="/research/write" element={<WriteResearch />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<AdminLogin />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </MainLayout>
    </Router>
  );
}

export default App;
