import React, { useState } from 'react';
import { FaDice } from 'react-icons/fa'; // 주사위 아이콘
import './RandomSelector.css';

const RandomSelector = ({ filteredChampions }) => {
  const [selectedChampion, setSelectedChampion] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false); // 카드 뽑기 애니메이션 상태

  const selectRandomChampion = () => {
    if (filteredChampions.length > 0) {
      setIsDrawing(true); // 애니메이션 시작
      setTimeout(() => {
        const randomChampion =
          filteredChampions[
            Math.floor(Math.random() * filteredChampions.length)
          ];
        setSelectedChampion(randomChampion);
        setIsDrawing(false); // 애니메이션 종료
      }); // 애니메이션 지속 시간
    } else {
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
        <FaDice className="dice-icon" />
        랜덤 선택하기
      </button>
      {isDrawing && (
        <div className="card-drawing-animation">카드 뽑는 중...</div>
      )}
      {selectedChampion && !isDrawing && (
        <div className="random-champion-card">
          <div className="champion-image-container">
            <img
              src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${selectedChampion.id}_0.jpg`}
              alt={selectedChampion.name}
              className="champion-image"
            />
          </div>
          <div className="champion-info-container">
            <h3>{selectedChampion.name}</h3>
            <p>{selectedChampion.title}</p>
            <p className="champion-role">
              역할군: {selectedChampion.tags.join(', ')}
            </p>
            <button
              className="opgg-button"
              onClick={() => openOPGG(selectedChampion.id)}
            >
              OPGG 챔피언 공략 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RandomSelector;
