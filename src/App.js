import React from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/common/Header/Header';
import HomePage from './pages/home/HomePage';
import RandomChampion from './pages/randomChampion/RandomChampion';
import RandomLinePage from './pages/randomLine/RandomLine';
import './App.css';

const App = () => {
  return (
    <>
      <Router>
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/random-champion" element={<RandomChampion />} />
          <Route path="/random-line" element={<RandomLinePage />} />
        </Routes>
      </Router>
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
