import { fetchChampionData } from '../services/api';

/* 라이엇 API는 우리 서버 함수(/api/riot)를 거쳐서만 부른다 - api/_riot.js 참고.
   실패는 { error }로 돌려준다. 던지면 화면 일곱 칸이 한꺼번에 무너진다 */

const cache = new Map();

/* 서버 응답 모양(api/_riot.js)을 바꾸면 이 숫자를 올린다. 주소가 달라져서
   브라우저 · CDN에 남은 옛 응답(하루 캐시)을 안 쓴다. 안 올리면 새 칸이 없는
   옛 매치가 와서 화면이 죽는다 (받은 피해 칸이 그랬다) */
const API_VERSION = '2';

/* 한 번에 나가는 요청 수. 매치 20판을 한꺼번에 부르면 라이엇 한도(1초 20번)에
   바로 닿는다 - 서버 캐시를 못 탄 판이 많을수록. 다섯씩 줄 세운다 */
const MAX_INFLIGHT = 5;
let inflight = 0;
const waiting = [];
const slot = () =>
  inflight < MAX_INFLIGHT
    ? Promise.resolve(inflight++)
    : new Promise((resolve) => waiting.push(resolve));
const release = () => {
  const next = waiting.shift();
  if (next) next();
  else inflight -= 1;
};

/* 끝난 판(match·timeline)은 안 바뀌니 탭을 오가도 다시 안 부른다.
   프로필·첫 화면은 '새로고침'을 누르면 다시 받는다 */
export const riotGet = async (params, { fresh = false } = {}) => {
  const qs = new URLSearchParams({ ...params, v: API_VERSION }).toString();
  if (!fresh && cache.has(qs)) return cache.get(qs);
  const p = slot()
    .then(() => fetch(`/api/riot?${qs}`))
    .then(async (r) => {
      const body = await r.json().catch(() => ({}));
      return r.ok ? { data: body } : { error: body.error ?? r.status };
    })
    .catch(() => ({ error: 'network' }))
    .finally(release);
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
