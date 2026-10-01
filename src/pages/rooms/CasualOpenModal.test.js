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

test('고르는 순서대로 빈 라인이 하나씩 채워진다', async () => {
  await render();
  await click(byText('.casual-chip', '철수'));
  await click(byText('.casual-chip', '영희'));
  expect(laneOf('철수')).toBe('탑');
  expect(laneOf('영희')).toBe('정글');
});

/* 같은 라인이 둘이면 첫 킬 배당이 어긋난다. 고른 라인을 쓰던 사람과
   자리를 맞바꾼다 */
test('이미 쓰는 라인을 고르면 서로 맞바꾼다', async () => {
  await render();
  await click(byText('.casual-chip', '철수')); // 탑
  await click(byText('.casual-chip', '영희')); // 정글

  const mid = [...rowOf('영희').querySelectorAll('.casual-lane')].find(
    (b) => b.textContent === '탑'
  );
  await click(mid);

  expect(laneOf('영희')).toBe('탑');
  expect(laneOf('철수')).toBe('정글');
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

test('일반이면 라인을 같이 보낸다', async () => {
  await render();
  await click(byText('.casual-chip', '철수'));
  await click(byText('.casual-chip', '영희'));
  await click(document.querySelector('.dialog-ok'));

  expect(opened.mode).toBe('normal');
  expect(opened.lanes).toEqual({ 1: 'TOP', 2: 'JUNGLE' });
  expect(opened.killLine).toBe(29.5);
});
