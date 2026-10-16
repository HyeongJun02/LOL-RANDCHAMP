import { neon, isNeonConfigured } from './neon';

/* 전적 · 정보 즐겨찾기. 사용자마다 한 줄 (sql/setup.sql의 riot_favorites).
   목록을 통째로 갈아 끼운다 - 순서 바꾸기 · 별명 고치기가 전부 이것 하나 */
const TABLE = 'riot_favorites';

/* 표가 아직 없으면(setup.sql을 안 돌렸거나 Data API가 표 목록을 아직 안 읽었으면)
   PostgREST가 'Could not find the table ... in the schema cache'를 준다.
   영어 원문 대신 무엇을 해야 하는지 말한다 */
const explain = (error) => {
  /* 안내 문구로 덮으면 진짜 이유가 안 보인다. 원문은 콘솔에 남긴다 */
  // eslint-disable-next-line no-console
  console.error('[riot_favorites]', error);
  return new Error(
    /schema cache|does not exist/i.test(error.message)
      ? `즐겨찾기 저장소가 아직 준비되지 않았어요. (${error.message})`
      : error.message
  );
};

export const loadFavs = async (userId) => {
  if (!isNeonConfigured || !userId) return [];
  const { data, error } = await neon.from(TABLE).select('list').eq('user_id', userId).maybeSingle();
  if (error) throw explain(error);
  return Array.isArray(data?.list) ? data.list : [];
};

export const saveFavs = async (userId, list) => {
  if (!isNeonConfigured || !userId) throw new Error('로그인이 필요해요.');
  const { error } = await neon.from(TABLE).upsert({ user_id: userId, list });
  if (error) throw explain(error);
};
