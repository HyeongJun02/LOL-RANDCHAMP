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
