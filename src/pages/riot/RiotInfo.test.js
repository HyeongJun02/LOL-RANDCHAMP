global.IS_REACT_ACT_ENVIRONMENT = true;

/* 전적 · 정보 화면. /api/riot 응답을 가짜로 주고 그려지는지만 본다 */

/* react-router-dom v7은 ESM 전용이라 jest가 못 읽는다 (Header.test.js와 같은 사정).
   이 화면이 쓰는 건 주소의 ?id= 하나라 그것만 흉내 낸다 */
let mockSearch = '';
jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    useSearchParams: () => {
      const [p, setP] = React.useState(() => new URLSearchParams(mockSearch));
      return [p, (o) => setP(new URLSearchParams(o))];
    },
  };
}, { virtual: true });

/* 로그인 상태는 테스트마다 바꾼다 (즐겨찾기는 로그인해야 쓴다) */
let mockUser = null;
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));

/* 즐겨찾기 저장소. 서버 대신 메모리 */
let mockFavs = [];
jest.mock('../../server/riotFavs', () => ({
  loadFavs: () => Promise.resolve(mockFavs),
  saveFavs: (uid, list) => {
    mockFavs = list;
    return Promise.resolve();
  },
}));

jest.mock('../../services/api', () => ({
  fetchChampionData: () =>
    Promise.resolve({
      version: '14.1.1',
      champions: [{ id: 'Ahri', key: '103', name: '아리', title: '구미호' }],
    }),
}));

const HOME = {
  rotation: { data: { ids: [103], newbie: [], newbieLevel: 10 } },
  status: { lol: { data: [] }, tft: { data: [{ kind: 'maintenance', title: '점검', at: null }] }, val: { error: 403 } },
  challenger: { data: [{ name: 'Faker', tag: 'KR1', lp: 1500, wins: 100, losses: 50 }] },
  tftChallenger: { error: 403 },
  valorant: { content: { error: 403 }, leaderboard: { error: 403 } },
};

const PROFILE = {
  account: { puuid: 'P1', name: 'Faker', tag: 'KR1' },
  summoner: { data: { level: 700, icon: 6 } },
  leagues: { data: [{ queue: 'RANKED_SOLO_5x5', tier: 'CHALLENGER', rank: 'I', lp: 1500, wins: 100, losses: 50 }] },
  mastery: { data: [{ champId: 103, level: 10, points: 123456 }] },
  live: { data: null },
  challenges: { error: 403 },
  matches: { data: [] },
  tftLeagues: { data: [] },
  /* 롤 키라 TFT는 403 - 탭 없이 롤만 */
  tftMatches: { error: 403 },
};

const player = (puuid, team, name, champ, win) => ({
  puuid, name, tag: 'KR1', team, win, champ, level: 18, pos: 'MIDDLE',
  k: 5, d: 2, a: 7, cs: 250, gold: 15000, dmg: 30000, taken: 20000, vision: 30,
  wards: 12, wardsKilled: 4, pinks: 3, items: [3089, 0, 0, 0, 0, 0, 3340], fb: false, multi: 1,
});
const MATCH = {
  id: 'KR_100001', queue: 420, mode: 'CLASSIC', duration: 1884, start: 1, end: 2, patch: '16.20',
  players: [player('P1', 100, 'Faker', 'Ahri', true), player('P2', 200, 'Chovy', 'Ahri', false)],
  teams: [
    { id: 100, win: true, kills: 30, dragon: 1, baron: 1, tower: 9, inhib: 2, herald: 1, grubs: 3, atakhan: 0, bans: [103] },
    { id: 200, win: false, kills: 12, dragon: 0, baron: 0, tower: 2, inhib: 0, herald: 0, grubs: 3, atakhan: 0, bans: [] },
  ],
};
const TIMELINE = {
  goldDiff: [0, 300, 900],
  firstKill: null,
  objectives: [],
  events: [
    { t: 95000, kind: 'kill', killer: 'P1', victim: 'P2', assists: [], team: 100 },
    { t: 600000, kind: 'monster', monster: 'DRAGON', sub: 'FIRE_DRAGON', killer: 'P1', team: 100 },
    { t: 700000, kind: 'building', building: 'TOWER_BUILDING', tower: 'OUTER_TURRET', lane: 'MID_LANE', killer: null, team: 100 },
  ],
};
const BODIES = {
  home: HOME,
  profile: PROFILE,
  matchIds: { ids: ['KR_100001'], more: false },
  match: MATCH,
  timeline: TIMELINE,
};

let act;
const render = async (url) => {
  mockSearch = url.split('?')[1] || '';
  jest.resetModules();
  const React = require('react');
  ({ act } = React);
  const { createRoot } = require('react-dom/client');
  const RiotInfo = require('./RiotInfo').default;
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () =>
    createRoot(el).render(
      React.createElement(RiotInfo)
    )
  );
  /* 받아오기가 끝날 때까지 */
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return el;
};

beforeEach(() => {
  mockUser = null;
  mockFavs = [];
  document.body.innerHTML = '';
  localStorage.clear();
  global.fetch = jest.fn((url) => {
    const fn = new URL(url, 'http://x').searchParams.get('fn');
    const body = BODIES[fn] || {};
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  });
});

test('첫 화면: 로테이션 · 챌린저가 보이고, 권한 없는 칸(403)은 아예 안 그린다', async () => {
  const el = await render('/info');
  expect(el.textContent).toContain('아리');
  expect(el.textContent).toContain('Faker');
  expect(el.textContent).toContain('1,500 LP');
  /* TFT는 점검 알림. 발로 서버 상태 · TFT 챌린저 · 발로 칸은 403이라 없다 */
  expect(el.textContent).toContain('알림 1건');
  expect(el.textContent).not.toContain('발로란트 리더보드');
  expect(el.textContent).not.toContain('요원 · 맵');
  expect(el.textContent).not.toContain('TFT 챌린저');
  expect(el.textContent).not.toContain('이 API 키로는 볼 수 없는 정보예요.');
  /* 라이엇 API를 쓰면 달아야 하는 문구 */
  expect(el.querySelector('.riot-legal')).not.toBeNull();
});

test('주소에 라이엇 ID가 있으면 그 사람 프로필, 최근 검색에 남긴다', async () => {
  const el = await render('/info?id=Faker%23KR1');
  const call = global.fetch.mock.calls.find(([u]) => u.includes('fn=profile'));
  expect(call[0]).toContain('name=Faker');
  expect(call[0]).toContain('tag=KR1');
  expect(el.textContent).toContain('레벨 700');
  expect(el.textContent).toContain('챌린저');
  expect(el.textContent).toContain('123,456');
  expect(el.textContent).not.toContain('TFT 최근 매치');
  expect(el.textContent).toContain('최근 매치');
  expect(JSON.parse(localStorage.getItem('lrc.riotRecent'))).toEqual(['Faker#KR1']);
});

test('키가 아직 없으면 그렇게 말한다', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({ error: 'no_key' }) })
  );
  const el = await render('/info');
  expect(el.textContent).toContain('API 키가 아직 설정되지 않았어요.');
});

const click = (node) =>
  act(async () => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
const buttonWith = (el, text) => [...el.querySelectorAll('button')].find((b) => b.textContent.includes(text));

test('판을 펼쳐 "게임 상세 보기"를 누르면 상세 탭: 용 그림 · 이벤트 · 선수 표', async () => {
  const el = await render('/info?id=Faker%23KR1');
  /* 큐 탭이 있고 목록이 왔다 */
  expect(buttonWith(el, '솔로 랭크')).toBeDefined();
  await click(el.querySelector('.riot-match-row'));
  await click(buttonWith(el, '게임 상세 보기'));

  expect(el.textContent).toContain('16.20 패치');
  expect(el.textContent).toContain('31분 24초');
  /* 용은 public/dragon_icon 그림으로 */
  expect(el.querySelector('.riot-board-dragon img').getAttribute('src')).toContain('dragon_icon');
  /* 이벤트: 초 단위 시각과 무슨 일 */
  const evs = [...el.querySelectorAll('.riot-ev')].map((n) => n.textContent);
  expect(evs[0]).toContain('1:35');
  expect(evs[1]).toContain('화염 용');
  expect(evs[2]).toContain('미드 1차 포탑 파괴');
  /* 건물만 걸러 보기 */
  await click([...el.querySelectorAll('.riot-ev-filters button')].find((b) => b.textContent.startsWith('건물')));
  expect(el.querySelectorAll('.riot-ev')).toHaveLength(1);
  /* 선수 표 */
  expect(el.querySelectorAll('.riot-table tbody tr')).toHaveLength(2);
  expect(el.querySelector('.riot-table').textContent).toContain('30,000');
});

test('최근 검색은 10개까지, 한 번에 지우기', async () => {
  localStorage.setItem('lrc.riotRecent', JSON.stringify(Array.from({ length: 12 }, (_, i) => `n${i}#KR1`)));
  const el = await render('/info?id=Faker%23KR1');
  const saved = JSON.parse(localStorage.getItem('lrc.riotRecent'));
  expect(saved).toHaveLength(10);
  expect(saved[0]).toBe('Faker#KR1');
  await click(buttonWith(el, '기록 지우기'));
  expect(JSON.parse(localStorage.getItem('lrc.riotRecent'))).toEqual([]);
  expect(el.querySelectorAll('.riot-recent .riot-chip:not(.is-home)')).toHaveLength(0);
});

test('로그인 안 하면 즐겨찾기 대신 안내', async () => {
  const el = await render('/info');
  expect(el.textContent).toContain('로그인하면 자주 보는 사람을 즐겨찾기');
});

test('즐겨찾기: 별로 넣고, 별명이 같으면 본 · 부계정으로 묶이고, 매치 표에 별명이 붙는다', async () => {
  mockUser = { id: 'u1' };
  mockFavs = [{ id: 'Chovy#KR1', alias: '상혁' }];
  const el = await render('/info?id=Faker%23KR1');
  await click(el.querySelector('.riot-star'));
  expect(mockFavs.map((f) => f.id)).toEqual(['Chovy#KR1', 'Faker#KR1']);

  /* 프로필 머리의 별명 칸에 적으면 저장된다 */
  const input = el.querySelector('.riot-alias-input.is-head');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '상혁');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(mockFavs.find((f) => f.id === 'Faker#KR1').alias).toBe('상혁');

  /* 별명이 같은 둘은 한 칸 */
  const groups = [...el.querySelectorAll('.riot-fav-group')];
  expect(groups).toHaveLength(1);
  expect(groups[0].textContent).toContain('상혁');
  expect(groups[0].querySelectorAll('.riot-fav-id-btn')).toHaveLength(2);

  /* 펼친 판의 팀 표에 별명 꼬리표 */
  await click(el.querySelector('.riot-match-row'));
  expect([...el.querySelectorAll('.riot-team .riot-alias')].map((n) => n.textContent)).toContain('상혁');
});

test('즐겨찾기 편집: 순서 바꾸기 · 빼기', async () => {
  mockUser = { id: 'u1' };
  mockFavs = [
    { id: 'A#KR1', alias: '' },
    { id: 'B#KR1', alias: '' },
  ];
  const el = await render('/info');
  await click(buttonWith(el, '편집'));
  await click(el.querySelector('[aria-label="B#KR1 위로"]'));
  expect(mockFavs.map((f) => f.id)).toEqual(['B#KR1', 'A#KR1']);
  await click(el.querySelector('[aria-label="A#KR1 즐겨찾기에서 빼기"]'));
  expect(mockFavs.map((f) => f.id)).toEqual(['B#KR1']);
});
