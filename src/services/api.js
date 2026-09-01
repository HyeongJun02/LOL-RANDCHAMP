import axios from 'axios';

const DDRAGON = 'https://ddragon.leagueoflegends.com';

/* 정사각 초상화. 그리드용(약 24KB) */
export const championIcon = (version, id) =>
  `${DDRAGON}/cdn/${version}/img/champion/${id}.png`;

/* 세로 로딩 일러스트. 결과 패널용(약 37KB) */
export const championPortrait = (id) =>
  `${DDRAGON}/cdn/img/champion/loading/${id}_0.jpg`;

export const fetchChampionData = async () => {
  const { data: versions } = await axios.get(`${DDRAGON}/api/versions.json`);
  const version = versions[0];
  const { data } = await axios.get(
    `${DDRAGON}/cdn/${version}/data/ko_KR/champion.json`
  );
  const champions = Object.values(data.data).sort((a, b) =>
    a.name.localeCompare(b.name, 'ko')
  );
  return { version, champions };
};
