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

/* ---------- 킬 언더오버 · 첫 킬 표 · 배팅 묶기 ---------- */

const picked = (el) => [...el.querySelectorAll('.bet-opt.picked')];

test('킬 언더오버는 우리 팀 · 총 킬 · 상대 팀 세 칸이고 하나만 담긴다', async () => {
  const el = await render({ active: casual() });
  const cols = [...el.querySelectorAll('.kill-trio .kill-col')];
  expect(cols.map((c) => c.querySelector('.kill-col-line em').textContent)).toEqual([
    '우리 팀',
    '총 킬',
    '상대 팀',
  ]);
  expect(cols[0].querySelector('.kill-col-line strong').textContent).toBe('14.5');

  /* 위에서부터 오버 · 기준선 · 언더 */
  const kids = [...cols[1].children].map((n) => n.textContent);
  expect(kids[0]).toContain('오버');
  expect(kids[1]).toContain('29.5');
  expect(kids[2]).toContain('언더');

  await click(cols[0].querySelector('.bet-opt.is-over'));
  await click(cols[1].querySelector('.bet-opt.is-under'));
  /* 우리 팀 오버는 빠지고 총 킬 언더만 남는다 */
  expect(picked(el)).toHaveLength(1);
  expect(cols[1].querySelector('.bet-opt.is-under').className).toContain('picked');
});

test('첫 킬은 우리와 상대가 라인끼리 마주 본다', async () => {
  const el = await render({ active: casual() });
  const cells = [...el.querySelectorAll('.fb-table > *')].map((n) => n.textContent);
  /* 맨 윗줄은 어느 팀 */
  expect(cells[0]).toContain('우리 팀');
  expect(cells[1]).toContain('상대 팀');
  /* 탑 줄: 우리 쪽은 라인이 정해진 사람이 없으니 비어 있다 */
  expect(cells[3]).toContain('상대 탑');
  /* 서폿 줄: 영희(서폿)와 상대 서폿 */
  const supRow = cells.indexOf(cells.find((c) => c.includes('상대 서폿')));
  expect(cells[supRow - 1]).toContain('영희');
});

test('라인이 미정이면 남은 줄에 앉고 미정이라 적힌다', async () => {
  const el = await render({ active: casual({ lanes: { 2: 'SUPPORT' } }) });
  const mine = optionFor(el, '철수');
  expect(mine.textContent).toContain('미정');
});

test('칼바람에는 상대를 고를 칸이 없다', async () => {
  const el = await render({ active: casual({ mode: 'aram', kill_line: 59.5, lanes: {} }) });
  expect(el.textContent).not.toContain('상대 탑');
  expect(optionFor(el, '철수')).toBeDefined();
});

test('배팅 묶기를 켜면 배당이 곱해지고 한 칸에만 적는다', async () => {
  const el = await render({ active: casual() });
  await click(optionFor(el, '홀'));
  await click(el.querySelector('.casual-dragons .bet-opt'));
  await click(el.querySelector('.parlay-toggle'));

  /* 1.98 × 5.5 = 10.89 */
  expect(el.querySelector('.parlay-sum strong').textContent).toBe('10.89배');
  /* 버는 끼꼬 35000을 넘지 않게: floor(35000 / 9.89) = 3538 */
  expect(el.querySelector('.parlay-sum em').textContent).toContain('3,538');
  /* 금액 칸은 하나뿐 */
  expect(el.querySelectorAll('.bet-cart .bet-amount')).toHaveLength(1);
});

test('하나만 담으면 묶을 수 없다고 말해준다', async () => {
  const el = await render({ active: casual() });
  await click(optionFor(el, '홀'));
  await click(el.querySelector('.parlay-toggle'));
  expect(el.querySelector('.bet-cart').textContent).toContain('두 개 이상');
  expect([...el.querySelectorAll('.bet-cart button')].find((b) => b.textContent === '묶어서 걸기').disabled).toBe(true);
});

/* 내전도 같은 언더오버 칸을 쓴다. 승리팀은 마감 때까지 배당을 모르니 못 묶는다 */
test('내전: 총 킬 한 칸, 승리팀은 묶을 수 없다', async () => {
  const scrim = casual({ kind: 'scrim', team_b: [], lanes: {}, kill_line: 53.5 });
  const el = await render({ active: scrim });
  expect(el.querySelectorAll('.kill-trio.is-single .kill-col')).toHaveLength(1);

  await click(optionFor(el, '1팀 승리'));
  await click(el.querySelector('.kill-col .bet-opt.is-over'));
  await click(el.querySelector('.parlay-toggle'));
  expect(el.querySelector('.bet-cart').textContent).toContain('승리팀은 묶을 수 없어요');
});

/* 묶지 않을 때도 배당이 보여야 '얼마를 걸지'를 정할 수 있다 */
test('낱개로 담아도 배당과 적중 금액이 보인다', async () => {
  const el = await render({ active: casual() });
  await click(optionFor(el, '홀'));
  await click(el.querySelector('.casual-dragons .bet-opt'));

  const rates = [...el.querySelectorAll('.bet-cart-rate')].map((n) => n.textContent);
  /* 짝홀은 몰리면 움직여서 '약', 첫 용은 고정 */
  expect(rates).toEqual(['약 1.98배', '5.50배']);

  const input = el.querySelectorAll('.bet-cart .bet-amount')[1];
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '1000');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(el.querySelector('.bet-if').textContent.replace(/\s/g, '')).toBe('적중시+4,500');
});

/* 낮은 배당으로 묶고 '최대'를 누른 뒤, 높은 배당으로 바꾸면 상한을 넘는다.
   단추만 잠기면 왜 안 되는지 모른다 */
test('묶음이 상한을 넘으면 적중 금액이 빨개지고 이유를 말한다', async () => {
  const el = await render({ active: casual() });
  await click(optionFor(el, '홀'));
  await click(optionFor(el, '우리 팀'));
  await click(el.querySelector('.parlay-toggle'));
  await click([...el.querySelectorAll('.bet-chip')].find((b) => b.textContent === '최대'));
  expect(el.querySelector('.bet-cart-total').className).not.toContain('is-too-much');

  /* 우리 팀 → 철수(미드 7.08배). 같은 무리라 우리 팀은 빠지고 배당이 뛴다 */
  await click(optionFor(el, '철수'));
  expect(el.querySelector('.bet-cart-total').className).toContain('is-too-much');
  expect(el.querySelector('.bet-over-msg').textContent).toContain('35,000');
  expect(el.querySelector('.bet-over-msg').textContent).toContain('초기화');
  expect(
    [...el.querySelectorAll('.bet-cart button')].find((b) => b.textContent === '묶어서 걸기').disabled
  ).toBe(true);
});
