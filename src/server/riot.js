import { fetchChampionData } from '../services/api';

/* 라이엇 API는 우리 서버 함수(/api/riot)를 거쳐서만 부른다 - api/_riot.js 참고.
   실패는 { error }로 돌려준다. 던지면 화면 일곱 칸이 한꺼번에 무너진다 */

const cache = new Map();

/* 끝난 판(match·timeline)은 안 바뀌니 탭을 오가도 다시 안 부른다.
   프로필·첫 화면은 '새로고침'을 누르면 다시 받는다 */
export const riotGet = async (params, { fresh = false } = {}) => {
  const qs = new URLSearchParams(params).toString();
  if (!fresh && cache.has(qs)) return cache.get(qs);
  const p = fetch(`/api/riot?${qs}`)
    .then(async (r) => {
      const body = await r.json().catch(() => ({}));
      return r.ok ? { data: body } : { error: body.error ?? r.status };
    })
    .catch(() => ({ error: 'network' }));
  cache.set(qs, p);
  const out = await p;
  // 실패는 기억하지 않는다. 다시 누르면 다시 가야 한다
  if (out.error) cache.delete(qs);
  return out;
};

/* 챔피언 번호 → 이름·그림. 숙련도·로테이션·관전은 번호만 준다.
   데이터 드래곤은 한 번만 받는다 */
let champs = null;
export const loadChampions = () => {
  if (!champs) {
    champs = fetchChampionData()
      .then(({ version, champions }) => ({
        version,
        byKey: new Map(champions.map((c) => [Number(c.key), c])),
        byId: new Map(champions.map((c) => [c.id, c])),
      }))
      .catch(() => {
        champs = null;
        return { version: null, byKey: new Map(), byId: new Map() };
      });
  }
  return champs;
};

const DDRAGON = 'https://ddragon.leagueoflegends.com/cdn';
export const champIconUrl = (version, id) =>
  version && id ? `${DDRAGON}/${version}/img/champion/${id}.png` : null;
export const profileIconUrl = (version, icon) =>
  version && icon != null ? `${DDRAGON}/${version}/img/profileicon/${icon}.png` : null;
export const itemIconUrl = (version, item) =>
  version && item ? `${DDRAGON}/${version}/img/item/${item}.png` : null;
