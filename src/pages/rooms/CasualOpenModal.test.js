global.IS_REACT_ACT_ENVIRONMENT = true;

/* 일반 게임 또또를 여는 팝업. 라인이 첫 킬 배당을 정하므로, 두 사람이
   같은 라인이 되거나 칼바람에 라인이 실려 가면 배당이 어긋난다 */

let React;
let act;
let opened;

const PLAYERS = [
  { id: 1, name: '철수' },
  { id: 2, name: '영희' },
  { id: 3, name: '민수' },
  { id: 4, name: '지수' },
  { id: 5, name: '태현' },
  { id: 6, name: '수진' },
];

const render = async () => {
  jest.resetModules();
  React = require('react');
  ({ act } = React);
  const { createRoot } = require('react-dom/client');
  const CasualOpenModal = require('./CasualOpenModal').default;
  opened = null;

  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () =>
    createRoot(container).render(
      React.createElement(CasualOpenModal, {
        players: PLAYERS,
        onClose: () => {},
        onOpen: async (opts) => {
          opened = opts;
        },
      })
    )
  );
  return container;
};

const click = (el) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

/* 팝업은 body로 포탈된다 */
const byText = (sel, text) =>
  [...document.querySelectorAll(sel)].find((b) => b.textContent.trim() === text);

const rowOf = (name) =>
  [...document.querySelectorAll('.casual-team li')].find((li) =>
    li.querySelector('.casual-name').textContent === name
  );

const laneOf = (name) => rowOf(name).querySelector('.casual-lane.is-on')?.textContent;

beforeEach(() => {
  document.body.innerHTML = '';
});

/* 큐를 돌리기 전엔 라인이 안 정해진 경우가 많다 */
test('라인은 미정으로 시작한다', async () => {
  await render();
  await click(byText('.casual-chip', '철수'));
  expect(laneOf('철수')).toBeUndefined();
  expect(rowOf('철수').textContent).toContain('미정');
});

/* 고른 칩을 목록에서 빼면 남은 칩이 밀려서 다음 사람을 다시 찾아야 했다 */
test('칩은 눌러도 자리를 안 옮긴다', async () => {
  await render();
  const before = [...document.querySelectorAll('.casual-chip')].map((c) => c.textContent);
  await click(byText('.casual-chip', '철수'));
  await click(byText('.casual-chip', '민수'));
  const after = [...document.querySelectorAll('.casual-chip')].map((c) => c.textContent);
  expect(after).toEqual(before);
  expect(byText('.casual-chip', '철수').className).toContain('is-on');
});

const pickLane = (name, label) =>
  click([...rowOf(name).querySelectorAll('.casual-lane')].find((b) => b.textContent === label));

/* 같은 라인이 둘이면 첫 킬 배당이 어긋난다. 고른 라인을 쓰던 사람과
   자리를 맞바꾼다 - 그쪽이 미정이었으면 미정이 된다 */
test('이미 쓰는 라인을 고르면 서로 맞바꾼다', async () => {
  await render();
  await click(byText('.casual-chip', '철수'));
  await click(byText('.casual-chip', '영희'));
  await pickLane('철수', '탑');
  await pickLane('영희', '정글');

  await pickLane('영희', '탑');
  expect(laneOf('영희')).toBe('탑');
  expect(laneOf('철수')).toBe('정글');

  /* 미정인 사람이 가져가면 원래 주인은 미정이 된다 */
  await click(byText('.casual-chip', '민수'));
  await pickLane('민수', '탑');
  expect(laneOf('민수')).toBe('탑');
  expect(laneOf('영희')).toBeUndefined();
});

test('같은 라인을 다시 누르면 미정으로 돌아간다', async () => {
  await render();
  await click(byText('.casual-chip', '철수'));
  await pickLane('철수', '미드');
  await pickLane('철수', '미드');
  expect(laneOf('철수')).toBeUndefined();
});

test('다섯 명이 차면 더 못 고른다', async () => {
  await render();
  for (const n of ['철수', '영희', '민수', '지수', '태현']) {
    // eslint-disable-next-line no-await-in-loop
    await click(byText('.casual-chip', n));
  }
  expect(byText('.casual-chip', '수진').disabled).toBe(true);
});

/* 칼바람은 라인이 없다. 라인을 실어 보내면 서버가 그걸로 배당을 매긴다 */
test('칼바람은 라인을 보내지 않는다', async () => {
  await render();
  await click(byText('.casual-chip', '철수'));
  await click(byText('.seg-tab', '칼바람무작위 총력전'));
  expect(document.querySelector('.casual-lanes')).toBeNull();

  await click(document.querySelector('.dialog-ok'));
  expect(opened.mode).toBe('aram');
  expect(opened.lanes).toEqual({});
  expect(opened.playerIds).toEqual([1]);
  /* 모드를 바꾸면 기준선도 그 모드의 기본값으로 */
  expect(opened.killLine).toBe(59.5);
});

test('일반이면 정한 라인만 보낸다 (미정은 안 보낸다)', async () => {
  await render();
  await click(byText('.casual-chip', '철수'));
  await click(byText('.casual-chip', '영희'));
  await pickLane('철수', '서폿');
  await click(document.querySelector('.dialog-ok'));

  expect(opened.mode).toBe('normal');
  expect(opened.lanes).toEqual({ 1: 'SUPPORT' });
  expect(opened.killLine).toBe(44.5);
});

/* 매번 다섯 명과 포지션을 손으로 넣는 게 제일 번거로웠다 */
test('라인 정하기 결과를 한 번에 불러온다', async () => {
  localStorage.setItem(
    'lrc.lastLines',
    JSON.stringify({ rows: [{ name: '철수', lane: '서폿' }, { name: '모르는사람', lane: '탑' }] })
  );
  await render();
  await click(byText('.ghost-btn', '라인 정하기 결과'));
  expect(laneOf('철수')).toBe('서폿');
  /* 명단에 없는 이름은 빠진다 */
  expect(document.querySelectorAll('.casual-team li')).toHaveLength(1);
  localStorage.clear();
});

test('남은 라인 랜덤은 비어 있는 라인만 채운다', async () => {
  await render();
  await click(byText('.casual-chip', '철수'));
  await click(byText('.casual-chip', '영희'));
  await pickLane('철수', '탑');
  await click(byText('.ghost-btn', '남은 라인 랜덤'));
  expect(laneOf('철수')).toBe('탑');
  expect(laneOf('영희')).toBeDefined();
  expect(laneOf('영희')).not.toBe('탑');
});
