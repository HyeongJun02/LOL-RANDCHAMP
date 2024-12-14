import React, { useEffect, useState } from 'react';
import { fetchChampionData } from '../../../services/api';
import ChampionCard from '../ChampionCard/ChampionCard';
import './RoleFilter.css';

const ROLE_ICONS = [
  { role: 'Assassin', icon: '/role_icon/Slayer.png', label: '암살자' },
  { role: 'Fighter', icon: '/role_icon/Fighter.png', label: '전사' },
  { role: 'Support', icon: '/role_icon/Controller.png', label: '서포터' },
  { role: 'Mage', icon: '/role_icon/Mage.png', label: '마법사' },
  { role: 'Marksman', icon: '/role_icon/Marksman.png', label: '원거리 딜러' },
  { role: 'Tank', icon: '/role_icon/Tank.png', label: '탱커' },
];

const RoleFilter = () => {
  const [champions, setChampions] = useState([]); // 전체 챔피언 목록
  const [filteredChampions, setFilteredChampions] = useState([]); // 필터링된 챔피언 목록
  const [excludedChampions, setExcludedChampions] = useState([]); // 제외된 챔피언 목록
  const [selectedRoles, setSelectedRoles] = useState([]); // 선택된 역할군
  const [randomChampion, setRandomChampion] = useState(null); // 랜덤 선택된 챔피언
  const [searchQuery, setSearchQuery] = useState(''); // 검색어

  // API 호출로 챔피언 데이터 가져오기
  useEffect(() => {
    const loadChampions = async () => {
      try {
        const data = await fetchChampionData();
        const championArray = Object.values(data); // 객체를 배열로 변환
        setChampions(championArray);
        setFilteredChampions(championArray); // 초기값은 전체 챔피언
      } catch (error) {
        console.error('Failed to fetch champions:', error);
      }
    };
    loadChampions();
  }, []);

  // 역할 필터링 및 검색 로직
  useEffect(() => {
    let filtered = champions.filter(
      (champion) => !excludedChampions.includes(champion.id)
    );

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
  }, [selectedRoles, champions, excludedChampions, searchQuery]);

  // 역할 선택/해제
  const toggleRole = (role) => {
    setSelectedRoles(
      (prev) =>
        prev.includes(role)
          ? prev.filter((r) => r !== role) // 이미 선택된 경우 제거
          : [...prev, role] // 선택되지 않은 경우 추가
    );
  };

  // 챔피언 제외/포함 토글
  const toggleChampionExclusion = (championId) => {
    setExcludedChampions(
      (prev) =>
        prev.includes(championId)
          ? prev.filter((id) => id !== championId) // 이미 제외된 경우 포함
          : [...prev, championId] // 제외 리스트에 추가
    );
  };

  // 랜덤 챔피언 선택
  const selectRandomChampion = () => {
    const selectableChampions = filteredChampions.filter(
      (champion) => !excludedChampions.includes(champion.id)
    );
    if (selectableChampions.length > 0) {
      const randomIndex = Math.floor(
        Math.random() * selectableChampions.length
      );
      setRandomChampion(selectableChampions[randomIndex]);
    } else {
      setRandomChampion(null);
      alert('선택 가능한 챔피언이 없습니다.');
    }
  };

  return (
    <div>
      <h2>역할군 필터링</h2>
      <div className="role-icons">
        {ROLE_ICONS.map(({ role, icon, label }) => (
          <div
            key={role}
            className={`role-icon-container ${
              selectedRoles.includes(role) ? 'selected' : ''
            }`}
            onClick={() => toggleRole(role)}
          >
            <img src={icon} alt={role} className="role-icon" />
            <p className="role-label">{label}</p>
          </div>
        ))}
      </div>

      <input
        type="text"
        className="search-bar"
        placeholder="챔피언 검색..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

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

      <button className="random-button" onClick={selectRandomChampion}>
        랜덤 선택하기
      </button>

      {randomChampion && (
        <div className="random-result">
          <h3>랜덤 선택된 챔피언</h3>
          <ChampionCard champion={randomChampion} />
        </div>
      )}
    </div>
  );
};

export default RoleFilter;
