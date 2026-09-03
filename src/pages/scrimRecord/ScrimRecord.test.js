global.IS_REACT_ACT_ENVIRONMENT = true;

let act;

/* matches.js/lastSplit.js가 적재 시점에 localStorage를 읽으므로,
   시드를 심은 뒤 새로 require한다 (TeamBalance.test.js와 같은 패턴) */
const render = () => {
  jest.resetModules();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const ScrimRecord = require('./ScrimRecord').default;
  ({ act } = React);

  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => createRoot(container).render(React.createElement(ScrimRecord)));
  return container;
};

const click = (el) =>
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

const setValue = (el, value) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  return act(() => el.dispatchEvent(new Event('change', { bubbles: true })));
};

const byText = (el, tag, text) =>
  [...el.querySelectorAll(tag)].find((b) => b.textContent.includes(text));

/* 기록은 모듈 적재 때 읽으므로 render() 전에 심어야 한다 */
const seedMatches = (list) =>
  localStorage.setItem('lrc.matches', JSON.stringify(list));

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

test('양 팀에 이름을 넣고 승리 팀을 고르면 기록이 남는다', () => {
  const el = render();

  const [teamAPanel, teamBPanel] = el.querySelectorAll('.sr-team');
  setValue(teamAPanel.querySelectorAll('.sr-row input')[0], '철수');
  setValue(teamBPanel.querySelectorAll('.sr-row input')[0], '영희');

  click(byText(el, 'button', '1팀 승리'));

  expect(el.querySelector('.board-blank')).toBeNull();
  const rows = [...el.querySelectorAll('.board-list li')];
  expect(rows).toHaveLength(2);
  expect(byText(el, 'span', '철수').closest('li').textContent).toContain('1승 0패');
  expect(byText(el, 'span', '영희').closest('li').textContent).toContain('0승 1패');

  const history = el.querySelector('.history-list li');
  expect(history.textContent).toContain('철수');
  expect(history.textContent).toContain('영희');
});

test('양 팀에 같은 이름이 있으면 기록하지 않는다', () => {
  const el = render();
  const [teamAPanel, teamBPanel] = el.querySelectorAll('.sr-team');
  setValue(teamAPanel.querySelectorAll('.sr-row input')[0], '철수');
  setValue(teamBPanel.querySelectorAll('.sr-row input')[0], '철수');

  click(byText(el, 'button', '1팀 승리'));

  expect(el.querySelector('.board-blank')).not.toBeNull();
});

test('칼바람/일반 탭을 바꾸면 그 모드의 기록만 보인다', () => {
  const el = render();
  const [teamAPanel, teamBPanel] = el.querySelectorAll('.sr-team');
  setValue(teamAPanel.querySelectorAll('.sr-row input')[0], '철수');
  setValue(teamBPanel.querySelectorAll('.sr-row input')[0], '영희');
  click(byText(el, 'button', '1팀 승리')); // 기본값 '일반'에 기록됨

  click(byText(el, 'button', '칼바람 내전'));
  expect(el.querySelector('.board-blank')).not.toBeNull();

  click(byText(el, 'button', '일반 내전'));
  expect(el.querySelector('.board-blank')).toBeNull();
});

test('기록 삭제 버튼을 누르면 전적에서 사라진다', () => {
  const el = render();
  const [teamAPanel, teamBPanel] = el.querySelectorAll('.sr-team');
  setValue(teamAPanel.querySelectorAll('.sr-row input')[0], '철수');
  setValue(teamBPanel.querySelectorAll('.sr-row input')[0], '영희');
  click(byText(el, 'button', '1팀 승리'));

  click(el.querySelector('.history-list .row-del'));

  expect(el.querySelector('.board-blank')).not.toBeNull();
  expect(el.querySelector('.history-list')).toBeNull();
});

test('내전 팀 짜기 결과가 없으면 안내만 하고 팀을 바꾸지 않는다', () => {
  const el = render();
  click(byText(el, 'button', '방금 짠 팀 가져오기'));

  const filled = [...el.querySelectorAll('.sr-row input')].filter((i) => i.value !== '');
  expect(filled).toHaveLength(0);
});

test('내전 팀 짜기 결과를 불러오면 두 팀에 채워진다', () => {
  localStorage.setItem(
    'lrc.lastSplit',
    JSON.stringify({ teamA: ['가', '나'], teamB: ['다', '라'], at: Date.now() })
  );
  const el = render();

  click(byText(el, 'button', '방금 짠 팀 가져오기'));

  const [teamAPanel, teamBPanel] = el.querySelectorAll('.sr-team');
  const aNames = [...teamAPanel.querySelectorAll('.sr-row input')].map((i) => i.value);
  const bNames = [...teamBPanel.querySelectorAll('.sr-row input')].map((i) => i.value);
  expect(aNames).toEqual(expect.arrayContaining(['가', '나']));
  expect(bNames).toEqual(expect.arrayContaining(['다', '라']));
});

test('팀 패널의 이름 옆에 그 사람 승률이 뜬다', () => {
  seedMatches([
    { id: 'm1', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 },
    { id: 'm2', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 2 },
    { id: 'm3', mode: 'normal', teamA: ['영희'], teamB: ['철수'], winner: 'A', playedAt: 3 },
  ]);
  const el = render();

  const firstInput = el.querySelectorAll('.sr-row input')[0];
  setValue(firstInput, '철수');

  const row = firstInput.closest('.sr-row');
  const rate = row.querySelector('.sr-winrate');
  expect(rate.textContent).toBe('67%'); // 3판 2승
  expect(rate.getAttribute('title')).toBe('3판 2승 1패');
  expect(rate.classList.contains('hot')).toBe(true);
});

test('기록이 없는 이름에는 승률을 안 보여준다', () => {
  seedMatches([]);
  const el = render();

  const firstInput = el.querySelectorAll('.sr-row input')[0];
  setValue(firstInput, '처음온사람');

  expect(firstInput.closest('.sr-row').querySelector('.sr-winrate')).toBeNull();
});
