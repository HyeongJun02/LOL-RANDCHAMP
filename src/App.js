import React, { useEffect } from 'react';
import { Toaster, useToasterStore, toast } from 'react-hot-toast';
import { setSyncErrorHandler } from './store';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Backdrop from './components/common/Backdrop';
import RosterModal from './components/roster/RosterModal';
import Header from './components/common/Header/Header';
import { DialogProvider } from './components/common/Dialog';
import { AuthProvider } from './auth/AuthContext';
import HomePage from './pages/home/HomePage';
import RandomChampion from './pages/randomChampion/RandomChampion';
import RandomLinePage from './pages/randomLine/RandomLine';
import TeamBalance from './pages/teamBalance/TeamBalance';
import RandomPick from './pages/pick/RandomPick';
import RoomList from './pages/rooms/RoomList';
import Room from './pages/rooms/Room';
import NotFound from './pages/NotFound';

/* 저장소 모듈은 UI를 몰라야 해서 알림 통로만 여기서 꽂아준다.
   문구는 저장 실패든 한도 초과든 부르는 쪽이 정한다 */
setSyncErrorHandler((message) => toast.error(message));

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
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/random-champion" element={<RandomChampion />} />
              <Route path="/random-line" element={<RandomLinePage />} />
              <Route path="/team-balance" element={<TeamBalance />} />
              <Route path="/pick" element={<RandomPick />} />
              <Route path="/rooms" element={<RoomList />} />
              <Route path="/rooms/:id" element={<Room />} />
              {/* 없는 주소는 전부 여기로. 새로고침 시 서버가 index.html을
                  돌려주므로(vercel.json) 라우팅은 여기서 끝난다 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
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
