import React, { useState } from 'react';
import './RoleFilter.css';

const RandomSelector = ({ filteredChampions, excludedChampions }) => {
  const [selectedChampion, setSelectedChampion] = useState(null);

  const selectRandomChampion = () => {
    const selectableChampions = filteredChampions.filter(
      (champion) => !excludedChampions.includes(champion.id)
    );
    if (selectableChampions.length > 0) {
      const randomChampion =
        selectableChampions[
          Math.floor(Math.random() * selectableChampions.length)
        ];
      setSelectedChampion(randomChampion);
    } else {
      setSelectedChampion(null);
      alert('선택 가능한 챔피언이 없습니다.');
    }
  };

  const openOPGG = (championId) => {
    const url = `https://www.op.gg/champions/${championId.toLowerCase()}/build?`;
    window.open(url, '_blank');
  };

  return (
    <div className="random-selector-container">
      <button className="random-button" onClick={selectRandomChampion}>
        랜덤 선택하기
      </button>

      {selectedChampion && (
        <div className="random-champion-display">
          <img
            src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${selectedChampion.id}_0.jpg`}
            alt={selectedChampion.name}
            className="random-champion-image"
          />
          <div className="random-champion-info">
            <h3>{selectedChampion.name}</h3>
            <p>{selectedChampion.title}</p>

            <button
              className="opgg-button"
              onClick={() => openOPGG(selectedChampion.id)}
            >
              <img
                src="/site_icon/opgg_icon.png"
                alt="OPGG Icon"
                className="opgg-icon"
              />
              OPGG 챔피언 분석 바로가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RandomSelector;
