// App.jsx
import React, { useEffect, useState } from 'react';
import Header from './components/common/Header/Header';
import MainContent from './components/home/MainContent/MainContent';
import { fetchChampionData } from './services/api';
import './App.css';

const App = () => {
  const [champions, setChampions] = useState([]);

  useEffect(() => {
    const loadChampions = async () => {
      const data = await fetchChampionData();
      setChampions(Object.values(data));
    };
    loadChampions();
  }, []);

  return (
    <div className="app">
      <Header />
      <MainContent champions={champions} />
    </div>
  );
};

export default App;
