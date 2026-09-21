global.IS_REACT_ACT_ENVIRONMENT = true;

let act;
let React;

/* '내전 기록' 탭. 지난 판을 훑고, 판돈을 누르면 또또 결과가 열린다.
   저장은 방(rooms.js)이 하므로 여기서는 부모 역할만 하는 껍데기를 씌운다 */
const render = ({ initial = [], canEdit = true } = {}) => {
  jest.resetModules();
  React = require('react');
  const { createRoot } = require('react-dom/client');
  const MatchHistory = require('./MatchHistory').default;
  /* 삭제는 확인창을 거친다. 실제 앱처럼 Provider로 감싸야 그린다 */
  const { DialogProvider } = require('../../components/common/Dialog');
  ({ act } = React);

  const Harness = () => {
    const [matches, setMatches] = React.useState(initial);
    return React.createElement(MatchHistory, {
      matches,
      scrims: [],
      players: [],
      members: [],
      canEdit,
      onRemove: (id) => setMatches((prev) => prev.filter((m) => m.id !== id)),
    });
  };

  const Wrapped = () =>
    React.createElement(DialogProvider, null, React.createElement(Harness));

  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => createRoot(container).render(React.createElement(Wrapped)));
  return container;
};

/* onRemove가 async라 상태 반영이 마이크로태스크 뒤로 밀린다 */
const click = async (el) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const byText = (el, tag, text) =>
  [...el.querySelectorAll(tag)].find((b) => b.textContent.includes(text));

const game = (over = {}) => ({
  id: 'g1',
  mode: 'normal',
  teamA: ['철수', '민수'],
  teamB: ['영희'],
  winner: 'A',
  playedAt: Date.now(),
  betCount: 0,
  betTotal: 0,
  totalKills: null,
  firstBlood: null,
  killLine: null,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

test('기록이 없으면 안내만 보여준다', () => {
  const el = render();
  expect(el.querySelector('.history-list')).toBeNull();
  expect(el.querySelector('.rooms-blank')).not.toBeNull();
});

test('양 팀과 이긴 쪽을 보여준다', () => {
  const el = render({ initial: [game()] });
  const rows = [...el.querySelectorAll('.history-list li')];
  expect(rows).toHaveLength(1);
  expect(rows[0].textContent).toContain('철수');
  expect(rows[0].textContent).toContain('영희');
});

/* 이긴 쪽을 위로 올리면 카드마다 자리가 바뀌어 훑기가 어렵다.
   자리는 고정하고 이긴 쪽에 띠를 준다 */
test('1팀이 늘 왼쪽, 2팀이 늘 오른쪽이고 이긴 쪽에 표시가 붙는다', () => {
  const el = render({ initial: [game({ winner: 'B' })] });

  const sides = [...el.querySelectorAll('.hist-side')];
  expect(sides[0].textContent).toContain('1팀');
  expect(sides[1].textContent).toContain('2팀');
  /* 2팀이 이겼어도 자리는 그대로고 표시만 옮겨간다 */
  expect(sides[0].className).toContain('is-lose');
  expect(sides[1].className).toContain('is-win');
});

test('퍼블은 그 사람 이름에 붙는다', () => {
  const el = render({ initial: [game({ firstBlood: '민수' })] });
  const marked = [...el.querySelectorAll('.hist-name.is-fb')];
  expect(marked).toHaveLength(1);
  expect(marked[0].textContent).toContain('민수');
});

/* 총 킬만 적으면 그게 많은 건지 적은 건지 알 수가 없다 */
test('총 킬은 기준선·오버언더와 함께 보여준다', () => {
  const over = render({ initial: [game({ totalKills: 52, killLine: 45.5 })] });
  const chip = over.querySelector('.hist-fact');
  expect(chip.textContent).toContain('52킬');
  expect(chip.textContent).toContain('45.5');
  expect(chip.textContent).toContain('오버');
  expect(chip.className).toContain('is-over');

  document.body.innerHTML = '';
  const under = render({ initial: [game({ totalKills: 31, killLine: 45.5 })] });
  const chip2 = under.querySelector('.hist-fact');
  expect(chip2.textContent).toContain('언더');
  expect(chip2.className).toContain('is-under');
});

/* 없는 값을 '-'로 채우면 빈 칸이 정보인 척한다 */
test('결과를 안 넣은 판은 그 칸을 아예 안 그린다', () => {
  const el = render({ initial: [game()] });
  expect(el.querySelectorAll('.hist-fact')).toHaveLength(0);
});

test('또또가 걸린 판만 결과를 열 수 있다', () => {
  const plain = render({ initial: [game()] });
  expect(plain.querySelector('.hist-fact.is-bet')).toBeNull();

  document.body.innerHTML = '';
  const bet = render({ initial: [game({ betCount: 4, betTotal: 3500 })] });
  const open = bet.querySelector('.hist-fact.is-bet');
  expect(open).not.toBeNull();
  expect(open.textContent).toContain('3,500');
});

test('삭제는 확인창을 거친다', async () => {
  const el = render({ initial: [game()] });

  await click(el.querySelector('.row-del'));
  await click(byText(document, 'button', '취소'));
  expect(el.querySelector('.history-list')).not.toBeNull();

  await click(el.querySelector('.row-del'));
  await click(document.querySelector('.dialog-ok'));
  expect(el.querySelector('.history-list')).toBeNull();
});

/* 입장 코드로 들어온 사람은 보기만 한다 */
test('수정 권한이 없으면 삭제 버튼이 안 보인다', () => {
  const el = render({ canEdit: false, initial: [game()] });
  expect(el.querySelector('.row-del')).toBeNull();
  /* 기록 자체는 보인다 */
  expect(el.querySelector('.history-list li').textContent).toContain('철수');
});
