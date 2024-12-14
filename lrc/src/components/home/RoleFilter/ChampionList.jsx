import React from 'react';
import ChampionCard from '../ChampionCard/ChampionCard';
import './RoleFilter.css';

const ChampionList = ({
  filteredChampions,
  toggleChampionExclusion,
  excludedChampions,
}) => {
  return (
    <div className="champion-grid">
      {filteredChampions.map((champion) => (
        <ChampionCard
          key={champion.id}
          champion={champion}
          onClick={() => toggleChampionExclusion(champion.id)}
          excluded={excludedChampions.includes(champion.id)}
        />
      ))}
    </div>
  );
};

export default ChampionList;
