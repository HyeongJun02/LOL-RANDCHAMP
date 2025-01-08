import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/common/Header/Header';
import HomePage from './components/home/HomePage';
import RandomChampion from './components/home/RandomChampion/RandomChampion';
import RandomLine from './components/home/RandomLine/RandomLine';
import './App.css';

const App = () => {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/random-champion" element={<RandomChampion />} />
        <Route path="/random-line" element={<RandomLine />} />
      </Routes>
    </Router>
  );
};

export default App;
