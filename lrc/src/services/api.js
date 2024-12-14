import axios from 'axios';

const VERSION_URL = 'https://ddragon.leagueoflegends.com/api/versions.json';
const getChampionDataUrl = (version) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/champion.json`;

export const fetchChampionData = async () => {
  try {
    const versionResponse = await axios.get(VERSION_URL);
    const latestVersion = versionResponse.data[0];

    const championResponse = await axios.get(getChampionDataUrl(latestVersion));
    return championResponse.data.data; // 챔피언 데이터 반환
  } catch (error) {
    console.error('Error fetching champion data:', error);
    throw error;
  }
};
