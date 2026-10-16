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
  document.body.innerHTML = '';
  localStorage.clear();
  global.fetch = jest.fn((url) => {
    const fn = new URL(url, 'http://x').searchParams.get('fn');
    const body = fn === 'home' ? HOME : fn === 'profile' ? PROFILE : {};
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
