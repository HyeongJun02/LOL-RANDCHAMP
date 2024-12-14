// components/MainContent.jsx
import React from 'react';
import ChampionCard from '../ChampionCard/ChampionCard';
import RoleFilter from '../RoleFilter/RoleFilter';
import './MainContent.css';

const MainContent = ({ champions }) => {
  return (
    <main className="main-content">
      <RoleFilter />
    </main>
  );
};

export default MainContent;