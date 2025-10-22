import React, { useState } from 'react';
import { FaDice } from 'react-icons/fa';
import './RandomSelector.css';

const ROLE_ICONS = [
  { role: 'Assassin', icon: '/role_icon/Slayer.png', label: '암살자' },
  { role: 'Fighter', icon: '/role_icon/Fighter.png', label: '전사' },
  { role: 'Support', icon: '/role_icon/Controller.png', label: '서포터' },
  { role: 'Mage', icon: '/role_icon/Mage.png', label: '마법사' },
  { role: 'Marksman', icon: '/role_icon/Marksman.png', label: '원거리' },
  { role: 'Tank', icon: '/role_icon/Tank.png', label: '탱커' },
];

const RandomSelector = ({ filteredChampions }) => {
  const [selectedChampion, setSelectedChampion] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const selectRandomChampion = () => {
    if (filteredChampions.length === 0) {
      alert('선택 가능한 챔피언이 없습니다.');
      return;
    }

    setIsDrawing(true);
    setSelectedChampion(null);

    // 애니메이션 후 결과 표시
    setTimeout(() => {
      const randomChampion =
        filteredChampions[Math.floor(Math.random() * filteredChampions.length)];
      setSelectedChampion(randomChampion);
      setIsDrawing(false);
    }, 1500);
  };

  const openOPGG = (championId) => {
    window.open(
      `https://www.op.gg/champions/${championId.toLowerCase()}/build`,
      '_blank'
    );
  };

  const renderRoles = (tags) =>
    tags.map((tag) => {
      const role = ROLE_ICONS.find((r) => r.role === tag);
      return (
        <div key={tag} className="role-icon-container">
          <img src={role.icon} alt={role.label} className="role-icon" />
          <span>{role.label}</span>
        </div>
      );
    });

  return (
    <div className="random-selector">
      <button className="random-btn" onClick={selectRandomChampion}>
        <FaDice className="dice-icon" />
        랜덤 챔피언 선택
      </button>

      {/* 카드 뽑기 효과 */}
      {isDrawing && (
        <div className="flip-card">
          <div className="flip-inner">
            <div className="flip-front">✨ 뽑는 중...</div>
          </div>
        </div>
      )}

      {/* 선택 결과 */}
      {selectedChampion && !isDrawing && (
        <div className="champion-card">
          <div className="champion-img-box">
            <img
              src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${selectedChampion.id}_0.jpg`}
              alt={selectedChampion.name}
              className="champion-img"
            />
          </div>
          <div className="champion-info">
            <h2>{selectedChampion.name}</h2>
            <p className="title">{selectedChampion.title}</p>
            <div className="roles">{renderRoles(selectedChampion.tags)}</div>
            <button
              className="opgg-btn"
              onClick={() => openOPGG(selectedChampion.id)}
            >
              <img
                src="/site_icon/opgg_icon.png"
                alt="OPGG"
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
