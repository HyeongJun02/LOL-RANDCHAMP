import React, { useEffect } from 'react';
import { Toaster, useToasterStore, toast } from 'react-hot-toast';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Backdrop from './components/common/Backdrop';
import Header from './components/common/Header/Header';
import HomePage from './pages/home/HomePage';
import RandomChampion from './pages/randomChampion/RandomChampion';
import RandomLinePage from './pages/randomLine/RandomLine';
import TeamBalance from './pages/teamBalance/TeamBalance';
import RandomPick from './pages/pick/RandomPick';

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
      <Router>
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/random-champion" element={<RandomChampion />} />
          <Route path="/random-line" element={<RandomLinePage />} />
          <Route path="/team-balance" element={<TeamBalance />} />
          <Route path="/pick" element={<RandomPick />} />
        </Routes>
      </Router>
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
