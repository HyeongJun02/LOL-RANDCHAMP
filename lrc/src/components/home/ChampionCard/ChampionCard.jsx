import React from 'react';
import './ChampionCard.css';

const ChampionCard = ({ champion }) => {
  return (
    <div className="champion-card">
      <img
        src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champion.id}_0.jpg`}
        alt={champion.name}
      />
      <h3>{champion.name}</h3>
      <p>{champion.title}</p>
    </div>
  );
};

export default ChampionCard;
