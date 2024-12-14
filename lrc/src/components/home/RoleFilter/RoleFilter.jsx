import React, { useEffect, useState } from 'react';
import { fetchChampionData } from '../../../services/api';
import ChampionCard from '../ChampionCard/ChampionCard';

const RoleFilter = () => {
  const [champions, setChampions] = useState([]); // 전체 챔피언 목록
  const [filteredChampions, setFilteredChampions] = useState([]); // 필터링된 챔피언 목록
  const [selectedRole, setSelectedRole] = useState(''); // 선택된 역할

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

  // 역할 변경 시 필터링
  const handleRoleChange = (role) => {
    setSelectedRole(role);
    if (role === '') {
      setFilteredChampions(champions); // 전체 챔피언
    } else {
      setFilteredChampions(
        champions.filter((champion) => champion.tags.includes(role))
      );
    }
  };

  return (
    <div>
      <h2>역할군 필터링</h2>
      {/* 역할 선택 드롭다운 */}
      <select
        value={selectedRole}
        onChange={(e) => handleRoleChange(e.target.value)}
      >
        <option value="">전체</option>
        <option value="Fighter">탑/전사</option>
        <option value="Tank">탱커</option>
        <option value="Mage">마법사</option>
        <option value="Assassin">암살자</option>
        <option value="Marksman">원거리 딜러</option>
        <option value="Support">서포터</option>
      </select>

      {/* 필터링된 챔피언 카드 */}
      <div className="champion-grid">
        {filteredChampions.map((champion) => (
          <ChampionCard key={champion.id} champion={champion} />
        ))}
      </div>
    </div>
  );
};

export default RoleFilter;
