// components/MainContent.jsx
import React from 'react';
import MainPage from '../MainPage/MainPage';
import './MainContent.css';

const MainContent = ({ champions }) => {
  return (
    <main className="main-content">
      <MainPage />
    </main>
  );
};

export default MainContent;
