global.IS_REACT_ACT_ENVIRONMENT = true;

let act;
let React;

/* ScrimRecord는 이제 방이 넘겨주는 목록을 그리는 화면이다.
   저장은 방(rooms.js)이 하므로, 여기서는 부모 역할만 하는 껍데기를 씌워
   '기록을 남기면 화면이 따라오는가'만 본다.

   lastSplit.js가 적재 시점에 localStorage를 읽으므로 시드를 심은 뒤 require한다 */
/* 기록은 부모(방)가 맡는다. 여기서는 넘긴 값만 붙잡아 본다 */
let added;

const render = ({ initial = [], canEdit = true } = {}) => {
  added = jest.fn();
  jest.resetModules();
  React = require('react');
  const { createRoot } = require('react-dom/client');
  const ScrimRecord = require('./ScrimRecord').default;
  /* 삭제는 확인창을 거친다. 실제 앱처럼 Provider로 감싸야 그린다 */
  const { DialogProvider } = require('../../components/common/Dialog');
  ({ act } = React);

  const Harness = () =>
    React.createElement(ScrimRecord, {
      matches: initial,
      players: [],
      canEdit,
      onAdd: added,
    });

  const Wrapped = () =>
    React.createElement(DialogProvider, null, React.createElement(Harness));

  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => createRoot(container).render(React.createElement(Wrapped)));
  return container;
};

/* onAdd/onRemove가 async라 상태 반영이 마이크로태스크 뒤로 밀린다.
   act(async)로 감싸야 그것까지 흘려보내고 화면을 본다 */
const click = async (el) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const setValue = (el, value) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  return act(() => el.dispatchEvent(new Event('change', { bubbles: true })));
};

const byText = (el, tag, text) =>
  [...el.querySelectorAll(tag)].find((b) => b.textContent.includes(text));

const fill = (el, a, b) => {
  const [teamAPanel, teamBPanel] = el.querySelectorAll('.sr-team');
  setValue(teamAPanel.querySelectorAll('.sr-row input')[0], a);
  setValue(teamBPanel.querySelectorAll('.sr-row input')[0], b);
};

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

test('양 팀에 이름을 넣고 승리 팀을 고르면 기록이 남는다', async () => {
  const el = render();
  fill(el, '철수', '영희');

  await click(byText(el, 'button', '1팀 승리'));

  expect(added).toHaveBeenCalledTimes(1);
  expect(added.mock.calls[0][0]).toMatchObject({
    teamA: ['철수'],
    teamB: ['영희'],
    winner: 'A',
  });
});

test('양 팀에 같은 이름이 있으면 기록하지 않는다', async () => {
  const el = render();
  fill(el, '철수', '철수');

  await click(byText(el, 'button', '1팀 승리'));

  expect(added).not.toHaveBeenCalled();
});




test('짜둔 팀이 없으면 가져오기 버튼 자체를 안 보여준다', () => {
  /* 눌러봐야 '없어요' 소리만 듣는 버튼은 안 띄우는 편이 낫다 */
  const el = render();
  expect(byText(el, 'button', '방금 짠 팀')).toBeUndefined();
  expect(byText(el, 'button', '내전 팀 짜기')).toBeDefined();
});

test('내전 팀 짜기 결과를 불러오면 두 팀에 채워진다', async () => {
  localStorage.setItem(
    'lrc.lastSplit',
    JSON.stringify({ teamA: ['가', '나'], teamB: ['다', '라'], at: Date.now() })
  );
  const el = render();

  await click(byText(el, 'button', '방금 짠 팀'));

  const [teamAPanel, teamBPanel] = el.querySelectorAll('.sr-team');
  const aNames = [...teamAPanel.querySelectorAll('.sr-row input')].map((i) => i.value);
  const bNames = [...teamBPanel.querySelectorAll('.sr-row input')].map((i) => i.value);
  expect(aNames).toEqual(expect.arrayContaining(['가', '나']));
  expect(bNames).toEqual(expect.arrayContaining(['다', '라']));
});

/* 게임 시작 탭은 '게임을 시작하는' 화면이다. 전적을 보는 곳이 아니다.
   순위표를 여기와 내전 기록 탭에 둘 다 두니 같은 걸 두 번 보게 됐다 */
test('게임 시작 화면에는 순위표를 두지 않는다', () => {
  const el = render({
    initial: [
      { id: 'g1', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 },
    ],
  });
  setValue(el.querySelectorAll('.sr-row input')[0], '철수');

  expect(el.querySelector('.sr-row .sr-winrate')).toBeNull();
  expect(el.querySelector('.rank-list')).toBeNull();
  /* 지난 판 목록도 여기 없다. '내전 기록' 탭이 맡는다 */
  expect(el.querySelector('.history-list')).toBeNull();
});
