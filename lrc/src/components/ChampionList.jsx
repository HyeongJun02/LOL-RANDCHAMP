// components/ChampionList.jsx
import React, { useEffect, useState } from 'react';
import { fetchChampionData } from '../services/api';

const ChampionList = () => {
  const [champions, setChampions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchChampionData();
        setChampions(Object.values(data)); // 챔피언 객체를 배열로 변환
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch champions:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>롤 챔피언 목록</h1>
      <ul>
        {champions.map((champion) => (
          <li key={champion.id}>
            <h2>{champion.name}</h2>
            <p>{champion.title}</p>
            <img
              src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champion.id}_0.jpg`}
              alt={champion.name}
              width="100"
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChampionList;
