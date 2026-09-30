global.IS_REACT_ACT_ENVIRONMENT = true;

let act;
let React;

/* ScrimRecord는 이제 방이 넘겨주는 목록을 그리는 화면이다.
   저장은 방(rooms.js)이 하므로, 여기서는 부모 역할만 하는 껍데기를 씌워
   '기록을 남기면 화면이 따라오는가'만 본다.

   lastSplit.js가 적재 시점에 localStorage를 읽으므로 시드를 심은 뒤 require한다 */
/* 기록은 부모(방)가 맡는다. 여기서는 넘긴 값만 붙잡아 본다 */
let added;

const render = ({ initial = [], canEdit = true, players = [] } = {}) => {
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
      players,
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

/* 대기 칸에 이름을 적어 넣는다. 사람이 적은 팀으로 들어가므로
   a는 1팀, 그 다음 b는 2팀으로 간다 */
const put = async (el, name) => {
  setValue(el.querySelector('.sr-pool-add input'), name);
  await click(byText(el, 'button', '넣기'));
};

const fill = async (el, a, b) => {
  await put(el, a);
  await put(el, b);
};

const namesIn = (panel) =>
  [...panel.querySelectorAll('.sr-card-name')].map((n) => n.textContent);

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

test('양 팀에 이름을 넣고 승리 팀을 고르면 기록이 남는다', async () => {
  const el = render();
  await fill(el, '철수', '영희');

  await click(byText(el, 'button', '1팀 승리'));

  expect(added).toHaveBeenCalledTimes(1);
  expect(added.mock.calls[0][0]).toMatchObject({
    teamA: ['철수'],
    teamB: ['영희'],
    winner: 'A',
  });
});

/* 예전에는 양 팀에 같은 이름을 적을 수 있어서 저장 직전에 막아야 했다.
   이제 한 사람은 카드 하나라, 다른 팀에 넣으면 원래 있던 데서 빠진다 */
test('같은 사람을 다른 팀에 넣으면 원래 팀에서 빠진다', async () => {
  const el = render();
  await fill(el, '철수', '영희');

  const [teamA, teamB] = el.querySelectorAll('.sr-team');
  expect(namesIn(teamA)).toEqual(['철수']);

  /* 1팀의 철수 카드에서 ⇄를 누르면 2팀으로 건너간다 */
  await click(teamA.querySelector('.sr-card-act'));
  expect(namesIn(el.querySelectorAll('.sr-team')[0])).toEqual([]);
  expect(namesIn(el.querySelectorAll('.sr-team')[1])).toEqual(
    expect.arrayContaining(['철수', '영희'])
  );
  expect(teamB).toBeDefined();
});

test('양 팀 중 한쪽이 비면 기록하지 않는다', async () => {
  const el = render();
  await put(el, '철수');

  await click(byText(el, 'button', '1팀 승리'));

  expect(added).not.toHaveBeenCalled();
});




test('짜둔 팀이 없으면 가져오기 버튼 자체를 안 보여준다', () => {
  /* 눌러봐야 '없어요' 소리만 듣는 버튼은 안 띄우는 편이 낫다 */
  const el = render();
  expect(byText(el, 'button', '방금 짠 팀')).toBeUndefined();
  expect(byText(el, 'button', '팀 짜기')).toBeDefined();
});

test('내전 팀 짜기 결과를 불러오면 두 팀에 채워진다', async () => {
  localStorage.setItem(
    'lrc.lastSplit',
    JSON.stringify({ teamA: ['가', '나'], teamB: ['다', '라'], at: Date.now() })
  );
  const el = render();

  await click(byText(el, 'button', '방금 짠 팀'));

  const [teamAPanel, teamBPanel] = el.querySelectorAll('.sr-team');
  expect(namesIn(teamAPanel)).toEqual(['가', '나']);
  expect(namesIn(teamBPanel)).toEqual(['다', '라']);
});

/* 게임 시작 탭은 '게임을 시작하는' 화면이다. 전적을 보는 곳이 아니다.
   순위표를 여기와 내전 기록 탭에 둘 다 두니 같은 걸 두 번 보게 됐다 */
test('게임 시작 화면에는 순위표를 두지 않는다', () => {
  const el = render({
    initial: [
      { id: 'g1', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 },
    ],
  });
  expect(el.querySelector('.sr-winrate')).toBeNull();
  expect(el.querySelector('.rank-list')).toBeNull();
  /* 지난 판 목록도 여기 없다. '내전 기록' 탭이 맡는다 */
  expect(el.querySelector('.history-list')).toBeNull();
});


/* poop으로 40판 뛴 사람이 한 번 '푸푸'로 적히면, 서버가 조용히 새 참가자로
   등록해서 전적이 두 줄로 갈린다. 나중에 이름만 고쳐도 안 붙는다 -
   지난 경기가 옛 줄의 id를 들고 있기 때문이다.
   기계는 둘이 같은 사람인지 알 수 없으니, 사람에게 한 번 물어본다 */
const roster = [{ id: 1, name: 'poop' }, { id: 2, name: '영희' }];

test('명단에 없는 이름이면 물어보고, 취소하면 기록하지 않는다', async () => {
  const el = render({ players: roster });
  await fill(el, '푸푸', '영희');

  await click(byText(el, 'button', '1팀 승리'));

  /* 확인창이 떴고 아직 아무것도 안 보냈다 */
  expect(document.querySelector('.dialog-message').textContent).toContain('푸푸');
  /* 헷갈릴 상대를 같이 보여줘야 '아 poop인데'를 그 자리에서 안다 */
  expect(document.querySelector('.dialog-detail').textContent).toContain('poop');
  expect(added).not.toHaveBeenCalled();

  await click(byText(document.body, 'button', '취소'));
  expect(added).not.toHaveBeenCalled();
});

test('넣고 진행을 누르면 그대로 기록한다', async () => {
  const el = render({ players: roster });
  await fill(el, '푸푸', '영희');

  await click(byText(el, 'button', '1팀 승리'));
  await click(byText(document.body, 'button', '넣고 진행'));

  expect(added).toHaveBeenCalledTimes(1);
  expect(added.mock.calls[0][0]).toMatchObject({ teamA: ['푸푸'], teamB: ['영희'] });
});

test('명단에 있는 이름만 쓰면 묻지 않는다', async () => {
  const el = render({ players: roster });
  await fill(el, 'poop', '영희');

  await click(byText(el, 'button', '1팀 승리'));

  expect(document.querySelector('.dialog-message')).toBeNull();
  expect(added).toHaveBeenCalledTimes(1);
});

test('방금 만든 방(명단이 빈 방)에서는 묻지 않는다', async () => {
  const el = render({ players: [] });
  await fill(el, '철수', '영희');

  await click(byText(el, 'button', '1팀 승리'));

  expect(document.querySelector('.dialog-message')).toBeNull();
  expect(added).toHaveBeenCalledTimes(1);
});
