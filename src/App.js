import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster, useToasterStore, toast } from 'react-hot-toast';
import { setSyncErrorHandler } from './server/store';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Backdrop from './components/common/Backdrop';
import RosterModal from './components/roster/RosterModal';
import Header from './components/common/Header/Header';
import { DialogProvider } from './components/common/Dialog';
import { AuthProvider } from './auth/AuthContext';
import HomePage from './pages/home/HomePage';
import NotFound from './pages/NotFound';

/* 저장소 모듈은 UI를 몰라야 해서 알림 통로만 여기서 꽂아준다.
   문구는 저장 실패든 한도 초과든 부르는 쪽이 정한다 */
setSyncErrorHandler((message) => toast.error(message));

/* 첫 화면(홈)에 들어온 사람이 방·또또·팀 짜기 코드까지 한꺼번에 받을
   이유가 없다. 메인 번들이 gzip 312KB였다 - 페이지마다 들어갈 때 받는다.
   홈과 없는 주소 화면만 처음부터 싣는다 */
const RandomChampion = lazy(() => import('./pages/randomChampion/RandomChampion'));
const RandomLinePage = lazy(() => import('./pages/randomLine/RandomLine'));
const TeamBalance = lazy(() => import('./pages/teamBalance/TeamBalance'));
const RandomPick = lazy(() => import('./pages/pick/RandomPick'));
const RoomList = lazy(() => import('./pages/rooms/RoomList'));
const Room = lazy(() => import('./pages/rooms/Room'));
/* 관리자 한 사람 때문에 모든 방문자가 이 화면을 내려받을 이유가 없다 */
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));

const TOAST_LIMIT = 3;

/* react-hot-toast에는 개수 제한이 없다. 넘치는 것부터 직접 닫는다 */
const ToastLimiter = () => {
  const { toasts } = useToasterStore();

  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .slice(TOAST_LIMIT)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);

  return null;
};

const App = () => {
  return (
    <>
      <Backdrop />
      <DialogProvider>
        <AuthProvider>
          <Router>
            <Header />
            {/* 페이지 코드를 받는 동안 빈 틀을 보여준다. 헤더는 밖에 있어서
                그대로 남는다 */}
            <Suspense fallback={<div className="page" />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/random-champion" element={<RandomChampion />} />
              <Route path="/random-line" element={<RandomLinePage />} />
              <Route path="/team-balance" element={<TeamBalance />} />
              <Route path="/pick" element={<RandomPick />} />
              <Route path="/rooms" element={<RoomList />} />
              <Route path="/rooms/:id" element={<Room />} />
              {/* 헤더 nav에는 없다. 관리자만 프로필 메뉴에서 보이고,
                  주소를 직접 쳐도 DB 함수가 거절한다 */}
              <Route path="/admin" element={<AdminPage />} />
              {/* 없는 주소는 전부 여기로. 새로고침 시 서버가 index.html을
                  돌려주므로(vercel.json) 라우팅은 여기서 끝난다 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </Router>
        </AuthProvider>
      </DialogProvider>
      <RosterModal />
      <ToastLimiter />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'rgba(15, 23, 42, 0.9)', // dark glass
            color: '#e2e8f0',
            border: '1px solid rgba(56,189,248,0.4)',
            boxShadow: '0 0 20px rgba(56,189,248,0.15)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
          },
          success: {
            iconTheme: {
              primary: '#38bdf8',
              secondary: '#0f172a',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#0f172a',
            },
          },
        }}
      />
    </>
  );
};

export default App;
