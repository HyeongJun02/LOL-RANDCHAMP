import { fetchChampionData } from '../services/api';

/* 라이엇 API는 우리 서버 함수(/api/riot)를 거쳐서만 부른다 - api/_riot.js 참고.
   실패는 { error }로 돌려준다. 던지면 화면 일곱 칸이 한꺼번에 무너진다 */

const cache = new Map();

/* 서버 응답 모양(api/_riot.js)을 바꾸면 이 숫자를 올린다. 주소가 달라져서
   브라우저 · CDN에 남은 옛 응답(하루 캐시)을 안 쓴다. 안 올리면 새 칸이 없는
   옛 매치가 와서 화면이 죽는다 (받은 피해 칸이 그랬다) */
const API_VERSION = '4';

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

/* 소환사 주문 · 룬 이름과 그림. 관전 화면에서만 쓰여서 그때 한 번 받는다 */
let gameData = null;
export const loadGameData = (version) => {
  if (!version) return Promise.resolve({ spells: new Map(), runes: new Map() });
  if (!gameData) {
    gameData = Promise.all([
      fetch(`${DDRAGON}/${version}/data/ko_KR/summoner.json`).then((r) => r.json()),
      fetch(`${DDRAGON}/${version}/data/ko_KR/runesReforged.json`).then((r) => r.json()),
    ])
      .then(([sum, runes]) => {
        const spells = new Map(
          Object.values(sum.data || {}).map((x) => [
            Number(x.key),
            { name: x.name, icon: `${DDRAGON}/${version}/img/spell/${x.image.full}` },
          ])
        );
        const byId = new Map();
        (runes || []).forEach((style) => {
          byId.set(style.id, { name: style.name, icon: `${DDRAGON}/img/${style.icon}` });
          style.slots.forEach((slot) =>
            slot.runes.forEach((r) => byId.set(r.id, { name: r.name, icon: `${DDRAGON}/img/${r.icon}` }))
          );
        });
        return { spells, runes: byId };
      })
      .catch(() => {
        gameData = null;
        return { spells: new Map(), runes: new Map() };
      });
  }
  return gameData;
};

/* 솔로 랭크를 사람별로 기억해 둔다. 펼친 판마다 열 명을 다시 부르면
   같이 자주 나오는 사람(나 자신 포함)을 매번 또 묻는다. 모르는 사람만 묻는다.
   값: puuid → 랭크 줄 또는 null(언랭) */
const soloRanks = new Map();
export const loadSoloRanks = async (puuids) => {
  const missing = [...new Set(puuids)].filter((p) => p && !soloRanks.has(p));
  for (let i = 0; i < missing.length; i += 10) {
    const chunk = missing.slice(i, i + 10);
    // eslint-disable-next-line no-await-in-loop
    const r = await riotGet({ fn: 'liveRanks', puuids: chunk.join(','), only: 'solo' });
    if (r.data) chunk.forEach((p) => soloRanks.set(p, r.data[p] ?? null));
  }
  return new Map(puuids.map((p) => [p, soloRanks.get(p)]));
};

/* TFT 유닛 · 특성 · 아이템 · 증강의 이름과 그림. TFT 탭을 열 때 한 번.
   라이엇 매치는 영어 키(TFT16_Tristana)만 주고, 이름 · 그림은 여기서 붙인다.
   키는 대소문자를 안 가린다 (매치와 데이터의 표기가 가끔 다르다) */
let tftData = null;
export const loadTftData = (version) => {
  if (!version) return Promise.resolve(null);
  if (!tftData) {
    const get = (file) =>
      fetch(`${DDRAGON}/${version}/data/ko_KR/${file}.json`)
        .then((r) => r.json())
        .then((j) => Object.values(j.data || {}));
    const index = (list, folder) =>
      new Map(
        list.map((x) => [
          String(x.id).toLowerCase(),
          { name: x.name, cost: x.cost ?? null, icon: `${DDRAGON}/${version}/img/${folder}/${x.image?.full}` },
        ])
      );
    tftData = Promise.all([get('tft-champion'), get('tft-trait'), get('tft-item'), get('tft-augments')])
      .then(([units, traits, items, augments]) => ({
        units: index(units, 'tft-champion'),
        traits: index(traits, 'tft-trait'),
        items: index(items, 'tft-item'),
        augments: index(augments, 'tft-augment'),
      }))
      .catch(() => {
        tftData = null;
        return null;
      });
  }
  return tftData;
};

export const tftLookup = (map, id) => (map && id ? map.get(String(id).toLowerCase()) : null);
