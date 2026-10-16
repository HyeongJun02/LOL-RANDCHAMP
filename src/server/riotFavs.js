import { neon, isNeonConfigured } from './neon';

/* 전적 · 정보 즐겨찾기. 사용자마다 한 줄 (sql/setup.sql의 riot_favorites).
   목록을 통째로 갈아 끼운다 - 순서 바꾸기 · 별명 고치기가 전부 이것 하나 */
const TABLE = 'riot_favorites';

export const loadFavs = async (userId) => {
  if (!isNeonConfigured || !userId) return [];
  const { data, error } = await neon.from(TABLE).select('list').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return Array.isArray(data?.list) ? data.list : [];
};

export const saveFavs = async (userId, list) => {
  if (!isNeonConfigured || !userId) throw new Error('로그인이 필요해요.');
  const { error } = await neon.from(TABLE).upsert({ user_id: userId, list });
  if (error) throw new Error(error.message);
};
