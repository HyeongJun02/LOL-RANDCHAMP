global.IS_REACT_ACT_ENVIRONMENT = true;

/* 일반 게임 또또 화면.

   내전과 마켓이 다르다 - 승리팀이 없고 짝홀·어느 팀·첫 용이 있다.
   한 화면에 두 종류가 섞여 그려지므로, 엉뚱한 쪽 마켓이 새어 나오지
   않는지를 본다 */

/* 배팅 기록을 받아오는 건 네트워크다. 화면 그리기만 볼 것이라 비워둔다 */
jest.mock('../../server/neon', () => ({ neon: null, isNeonConfigured: false }));

let React;
let act;

const PLAYERS = [
  { id: 1, name: '철수', tier: 'GOLD', division: 4 },
  { id: 2, name: '영희', tier: 'GOLD', division: 4 },
  { id: 3, name: '민수', tier: 'GOLD', division: 4 },
];

const casual = (over = {}) => ({
  id: 77,
  kind: 'casual',
  mode: 'normal',
  status: 'betting',
  team_a: [1, 2, 3],
  team_b: [],
  lanes: { 1: 'MID', 2: 'SUPPORT', 3: 'JUNGLE' },
  kill_line: 29.5,
  bet_count: 0,
  bet_total: 0,
  played_at: new Date().toISOString(),
  ...over,
});

const render = async ({ active = null, canEdit = true, game = 'lol' } = {}) => {
  jest.resetModules();
  React = require('react');
  ({ act } = React);
  const { createRoot } = require('react-dom/client');
  const BetTab = require('./BetTab').default;
  const { DialogProvider } = require('../../components/common/Dialog');
  const { GameProvider } = require('../../lib/GameContext');

  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () =>
    createRoot(container).render(
      React.createElement(
        GameProvider,
        { game },
        React.createElement(
          DialogProvider,
          null,
          React.createElement(BetTab, {
            roomId: 1,
            scrims: active ? [active] : [],
            activeScrim: active,
            players: PLAYERS,
            /* 동의를 해둬야 마켓이 그려진다 */
            members: [{ user_id: 'me', nickname: '나', points: 50000, agreed: true }],
            myId: 'me',
            canEdit,
            isOwner: true,
            version: 1,
            onChanged: () => {},
          })
        )
      )
    )
  );
  return container;
};

const headings = (el) => [...el.querySelectorAll('.bet-market h4')].map((h) => h.textContent);

const click = (el) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

const optionFor = (el, text) =>
  [...el.querySelectorAll('.bet-opt')].find((b) => b.textContent.includes(text));

beforeEach(() => {
  document.body.innerHTML = '';
});

test('또또가 없으면 일반 게임 또또를 여는 단추가 있다', async () => {
  const el = await render();
  expect(el.textContent).toContain('일반 게임 또또 열기');
});

/* 발로란트는 용도 라인도 없다. 서버도 막지만 단추부터 안 보여야 한다 */
test('롤 방이 아니면 그 단추가 없다', async () => {
  const el = await render({ game: 'valorant' });
  expect(el.textContent).not.toContain('일반 게임 또또 열기');
});

test('권한이 없으면 그 단추가 없다', async () => {
  const el = await render({ canEdit: false });
  expect(el.textContent).not.toContain('일반 게임 또또 열기');
});

test('일반 게임에는 승리팀이 없고 짝홀·첫 킬·첫 용이 있다', async () => {
  const el = await render({ active: casual() });
  const h = headings(el).join(' | ');
  expect(h).not.toContain('승리팀');
  expect(h).toContain('킬 짝/홀');
  expect(h).toContain('첫 킬');
  expect(h).toContain('첫 용');
  /* 내전이 아니라는 게 머리에서 보여야 한다 */
  expect(el.querySelector('.casual-badge').textContent).toBe('일반');
  /* 첫 용은 여섯 종류다 */
  expect(el.querySelectorAll('.casual-dragons .bet-opt')).toHaveLength(6);
});

test('칼바람에는 첫 용이 없다', async () => {
  const el = await render({ active: casual({ mode: 'aram', kill_line: 59.5 }) });
  expect(headings(el).join(' | ')).not.toContain('첫 용');
});

/* 라인으로 정해지는 고정 배당이라 마감 전에도 보인다. 서포터가 제일 높다 */
test('첫 킬 사람마다 라인 배당이 미리 보인다', async () => {
  const el = await render({ active: casual() });
  const oddsOf = (name) =>
    Number(optionFor(el, name).querySelector('.bet-odds').textContent.replace('배', ''));
  expect(oddsOf('영희')).toBeGreaterThan(oddsOf('민수')); // 서폿 > 정글
  expect(oddsOf('민수')).toBeGreaterThan(oddsOf('철수')); // 정글 > 미드
});

/* '우리 팀'과 '누구'는 둘 중 하나만 건다 */
test('첫 킬은 팀과 사람 중 하나만 담긴다', async () => {
  const el = await render({ active: casual() });

  await click(optionFor(el, '우리 팀'));
  expect(optionFor(el, '우리 팀').className).toContain('picked');

  await click(optionFor(el, '철수'));
  expect(optionFor(el, '철수').className).toContain('picked');
  /* 사람을 고르는 순간 팀 쪽은 빠진다 */
  expect(optionFor(el, '우리 팀').className).not.toContain('picked');
});
