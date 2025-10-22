import React from 'react';
import './ChampionCard.css';

const ChampionCard = ({ champion }) => {
  return (
    <div className="champion-card">
      <div className="champion-image-wrapper">
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champion.id}_0.jpg`}
          alt={champion.name}
          className="champion-image"
        />
        <div className="champion-overlay">
          <h3>{champion.name}</h3>
          <p>{champion.title}</p>
        </div>
      </div>
    </div>
  );
};

export default ChampionCard;
