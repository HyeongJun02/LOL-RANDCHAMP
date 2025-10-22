import React from 'react';
import './ChampionList.css';
import ChampionCard from '../../components/championCard/ChampionCard';

const ChampionList = ({ filteredChampions }) => {
  return (
    <div className="champion-grid">
      {filteredChampions.map((champion) => (
        <ChampionCard key={champion.id} champion={champion} />
      ))}
    </div>
  );
};

export default ChampionList;
