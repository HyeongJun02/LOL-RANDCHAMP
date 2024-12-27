import React, { useState } from 'react';
import { FaDice } from 'react-icons/fa'; // 주사위 아이콘
import './RandomSelector.css';

const ROLE_ICONS = [
  { role: 'Assassin', icon: '/role_icon/Slayer.png', label: '암살자' },
  { role: 'Fighter', icon: '/role_icon/Fighter.png', label: '전사' },
  { role: 'Support', icon: '/role_icon/Controller.png', label: '서포터' },
  { role: 'Mage', icon: '/role_icon/Mage.png', label: '마법사' },
  { role: 'Marksman', icon: '/role_icon/Marksman.png', label: '원거리 딜러' },
  { role: 'Tank', icon: '/role_icon/Tank.png', label: '탱커' },
];

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

  const renderRoles = (tags) => {
    return tags.map((tag) => {
      const role = ROLE_ICONS.find((r) => r.role === tag);
      return (
        <div key={tag} className="role-icon-container">
          <img src={role.icon} alt={role.label} className="role-icon" />
          <p>{role.label}</p>
        </div>
      );
    });
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
            <div className="role-container">
              {renderRoles(selectedChampion.tags)}
            </div>
            <button
              className="opgg-button"
              onClick={() => openOPGG(selectedChampion.id)}
            >
              <img
                src="/site_icon/opgg_icon.png"
                alt="OPGG Icon"
                className="opgg-icon"
              />
              공략 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RandomSelector;
