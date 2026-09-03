global.IS_REACT_ACT_ENVIRONMENT = true;

let act;
let React;

/* ScrimRecord는 이제 방이 넘겨주는 목록을 그리는 화면이다.
   저장은 방(rooms.js)이 하므로, 여기서는 부모 역할만 하는 껍데기를 씌워
   '기록을 남기면 화면이 따라오는가'만 본다.

   lastSplit.js가 적재 시점에 localStorage를 읽으므로 시드를 심은 뒤 require한다 */
const render = ({ initial = [], canEdit = true } = {}) => {
  jest.resetModules();
  React = require('react');
  const { createRoot } = require('react-dom/client');
  const ScrimRecord = require('./ScrimRecord').default;
  ({ act } = React);

  let seq = 0;
  const Harness = () => {
    const [matches, setMatches] = React.useState(initial);
    return React.createElement(ScrimRecord, {
      matches,
      players: [],
      canEdit,
      onAdd: (m) =>
        setMatches((prev) => [...prev, { ...m, id: `g${++seq}`, playedAt: Date.now() }]),
      onRemove: (id) => setMatches((prev) => prev.filter((m) => m.id !== id)),
    });
  };

  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => createRoot(container).render(React.createElement(Harness)));
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

  expect(el.querySelector('.board-blank')).toBeNull();
  expect([...el.querySelectorAll('.board-list li')]).toHaveLength(2);
  expect(byText(el, 'span', '철수').closest('li').textContent).toContain('1승 0패');
  expect(byText(el, 'span', '영희').closest('li').textContent).toContain('0승 1패');

  const history = el.querySelector('.history-list li');
  expect(history.textContent).toContain('철수');
  expect(history.textContent).toContain('영희');
});

test('양 팀에 같은 이름이 있으면 기록하지 않는다', async () => {
  const el = render();
  fill(el, '철수', '철수');

  await click(byText(el, 'button', '1팀 승리'));

  expect(el.querySelector('.board-blank')).not.toBeNull();
});

test('칼바람/일반 탭을 바꾸면 그 모드의 기록만 보인다', async () => {
  const el = render();
  fill(el, '철수', '영희');
  await click(byText(el, 'button', '1팀 승리')); // 기본값 '일반'에 기록됨

  await click(byText(el, 'button', '칼바람 내전'));
  expect(el.querySelector('.board-blank')).not.toBeNull();

  await click(byText(el, 'button', '일반 내전'));
  expect(el.querySelector('.board-blank')).toBeNull();
});

test('기록 삭제 버튼을 누르면 전적에서 사라진다', async () => {
  const el = render();
  fill(el, '철수', '영희');
  await click(byText(el, 'button', '1팀 승리'));

  await click(el.querySelector('.history-list .row-del'));

  expect(el.querySelector('.board-blank')).not.toBeNull();
  expect(el.querySelector('.history-list')).toBeNull();
});

/* 입장 코드로 들어온 사람은 보기만 한다 */
test('수정 권한이 없으면 입력과 삭제가 아예 안 보인다', async () => {
  const el = render({
    canEdit: false,
    initial: [
      { id: 'g1', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 },
    ],
  });

  expect(el.querySelector('.sr-team')).toBeNull();
  expect(byText(el, 'button', '1팀 승리')).toBeUndefined();
  expect(el.querySelector('.history-list .row-del')).toBeNull();
  // 기록 자체는 보인다
  expect(el.querySelector('.board-list li').textContent).toContain('철수');
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

test('입력 칸에는 승률을 안 보여준다 (리더보드에만)', () => {
  const el = render({
    initial: [
      { id: 'g1', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 },
    ],
  });
  setValue(el.querySelectorAll('.sr-row input')[0], '철수');

  expect(el.querySelector('.sr-row .sr-winrate')).toBeNull();
  // 순위표에는 그대로 있다
  expect(el.querySelector('.board-record').textContent).toContain('%');
});
