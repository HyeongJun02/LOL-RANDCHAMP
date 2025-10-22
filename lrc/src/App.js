import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/common/Header/Header';
import HomePage from './pages/home/HomePage';
import RandomChampion from './pages/randomChampion/RandomChampion';
import RandomLinePage from './pages/randomLine/pages/RandomLinePage';
import './App.css';

const App = () => {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/random-champion" element={<RandomChampion />} />
        <Route path="/random-line" element={<RandomLinePage />} />
      </Routes>
    </Router>
  );
};

export default App;
