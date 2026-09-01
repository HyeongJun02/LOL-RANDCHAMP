global.IS_REACT_ACT_ENVIRONMENT = true;

const MEMBER = { id: 'm1', name: '철수', tier: 'DIAMOND', division: 2 };

let act;

/* roster.js가 적재 시점에 localStorage를 읽으므로, 시드를 심은 뒤 새로 require한다.
   React도 같은 레지스트리에서 가져와야 훅 디스패처가 갈리지 않는다. */
const render = () => {
  jest.resetModules();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const TeamBalance = require('./TeamBalance').default;
  ({ act } = React);

  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => createRoot(container).render(React.createElement(TeamBalance)));
  return container;
};

const click = (el) =>
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('lrc.roster', JSON.stringify([MEMBER]));
  document.body.innerHTML = '';
});

test('명단에서 불러오면 이름과 함께 티어·디비전도 적용된다', () => {
  const el = render();

  click(el.querySelector('.picker-toggle'));
  click(el.querySelector('.picker-item'));

  const row = el.querySelector('.player-row');
  expect(row.querySelector('.row-name input').value).toBe('철수');
  expect(row.querySelector('.row-tier').value).toBe('DIAMOND');
  expect(row.querySelector('.row-div').value).toBe('2');
});

test('이미 들어간 팀원은 다른 칸의 목록에서 빠진다', () => {
  const el = render();

  click(el.querySelector('.picker-toggle'));
  click(el.querySelector('.picker-item'));

  click(el.querySelectorAll('.picker-toggle')[1]);
  expect(el.querySelector('.picker-item')).toBeNull();
  expect(el.querySelector('.picker-empty')).not.toBeNull();
});

/* React 값 추적기 우회 */
const setValue = (el, value) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  return act(() => el.dispatchEvent(new Event('change', { bubbles: true })));
};

const byText = (el, text) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent.includes(text));

const buildWith = (names) => {
  const el = render();
  const inputs = el.querySelectorAll('.row-name input');
  names.forEach((n, i) => setValue(inputs[i], n));
  click(el.querySelector('.build-btn'));
  return el;
};

test('후보 버튼을 누르면 모든 조합이 팝업으로 뜬다', () => {
  const el = buildWith(['가', '나', '다', '라']);

  expect(el.querySelector('.modal-backdrop')).toBeNull();
  click(el.querySelector('.result-cands'));

  // 서로 다른 4명을 2:2로 나누는 방법 3가지
  expect(el.querySelectorAll('.cand-card')).toHaveLength(3);
  expect(el.querySelectorAll('.cand-card.is-current')).toHaveLength(1);
});

test('팝업에서 다른 조합을 고르면 결과가 그 조합으로 바뀐다', () => {
  const el = buildWith(['가', '나', '다', '라']);
  click(el.querySelector('.result-cands'));

  const other = [...el.querySelectorAll('.cand-card')].find(
    (c) => !c.classList.contains('is-current')
  );
  const expected = [...other.querySelectorAll('.cand-team.blue li')].map((li) =>
    li.textContent.trim()
  );

  click(other);

  expect(el.querySelector('.modal-backdrop')).toBeNull();
  const team1 = [...el.querySelectorAll('.team-card:not(.team-red) .team-player')].map(
    (s) => s.textContent
  );
  expect(team1).toEqual(expected);
});

const seedRoster = (members) =>
  localStorage.setItem('lrc.roster', JSON.stringify(members));

test('불러오기로 여러 명을 한 번에 참가자로 넣는다', () => {
  seedRoster([
    { id: 'a', name: '철수', tier: 'DIAMOND', division: 2 },
    { id: 'b', name: '영희', tier: 'SILVER', division: 1 },
  ]);
  const el = render();

  click(byText(el, '불러오기'));
  el.querySelectorAll('.loader-list input').forEach((box) => click(box));
  click(byText(el, '완료'));

  expect(el.querySelector('.modal-backdrop')).toBeNull();

  const rows = [...el.querySelectorAll('.player-row')];
  expect(rows[0].querySelector('.row-name input').value).toBe('철수');
  expect(rows[0].querySelector('.row-tier').value).toBe('DIAMOND');
  expect(rows[1].querySelector('.row-name input').value).toBe('영희');
  expect(rows[1].querySelector('.row-div').value).toBe('1');
});

test('이미 들어간 팀원은 다시 고를 수 없다', () => {
  seedRoster([{ id: 'a', name: '철수', tier: 'GOLD', division: 4 }]);
  const el = render();

  click(byText(el, '불러오기'));
  click(el.querySelector('.loader-list input'));
  click(byText(el, '완료'));

  click(byText(el, '불러오기'));
  expect(el.querySelector('.loader-list input').disabled).toBe(true);
  expect(el.querySelector('.loader-added')).not.toBeNull();
});
