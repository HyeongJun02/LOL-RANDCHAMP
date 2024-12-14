// services/api.js
import axios from 'axios';

// Data Dragon 버전 URL
const VERSION_URL = 'https://ddragon.leagueoflegends.com/api/versions.json';

// 챔피언 데이터 URL
const getChampionDataUrl = (version) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`;

// 버전 및 챔피언 데이터 가져오기
export const fetchChampionData = async () => {
  try {
    // 최신 버전 가져오기
    const versionResponse = await axios.get(VERSION_URL);
    const latestVersion = versionResponse.data[0];

    // 챔피언 데이터 가져오기
    const championResponse = await axios.get(getChampionDataUrl(latestVersion));
    return championResponse.data.data; // 챔피언 데이터 반환
  } catch (error) {
    console.error('Error fetching champion data:', error);
    throw error;
  }
};
