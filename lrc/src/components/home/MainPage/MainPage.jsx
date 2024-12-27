import React, { useState, useEffect } from 'react';
import RoleIcons from './RoleIcons';
import SearchBar from './SearchBar';
import ChampionList from './ChampionList';
import RandomSelector from './RandomSelector';
import { fetchChampionData } from '../../../services/api';
import './MainPage.css';

const MainPage = () => {
  const [champions, setChampions] = useState([]);
  const [filteredChampions, setFilteredChampions] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadChampions = async () => {
      const data = await fetchChampionData();
      const championArray = Object.values(data);
      setChampions(championArray);
      setFilteredChampions(championArray);
    };
    loadChampions();
  }, []);

  useEffect(() => {
    let filtered = champions;

    if (selectedRoles.length > 0) {
      filtered = filtered.filter((champion) =>
        champion.tags.some((tag) => selectedRoles.includes(tag))
      );
    }

    if (searchQuery) {
      filtered = filtered.filter((champion) =>
        champion.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredChampions(filtered);
  }, [selectedRoles, searchQuery, champions]);

  return (
    <div className="main-page">
      <div className="content-container">
        <div className="left-content">
          <RoleIcons
            selectedRoles={selectedRoles}
            toggleRole={setSelectedRoles}
          />
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          <ChampionList filteredChampions={filteredChampions} />
        </div>
        <div className="right-content">
          <RandomSelector filteredChampions={filteredChampions} />
        </div>
      </div>
    </div>
  );
};

export default MainPage;
