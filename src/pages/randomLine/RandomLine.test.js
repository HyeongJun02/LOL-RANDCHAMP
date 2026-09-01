global.IS_REACT_ACT_ENVIRONMENT = true;

/* jsdom에는 ResizeObserver가 없다. 룰렛이 폭 측정에만 쓰므로 빈 구현으로 충분 */
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let act;

const render = () => {
  jest.resetModules();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const RandomLine = require('./RandomLine').default;
  ({ act } = React);

  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => createRoot(container).render(React.createElement(RandomLine)));
  return container;
};

const click = (el) =>
  act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));

const setValue = (el, value) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  return act(() => el.dispatchEvent(new Event('change', { bubbles: true })));
};

const byText = (el, text) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent.includes(text));

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

test('한눈에 보기로 바꾸면 카드 대신 한 줄짜리 목록이 나온다', () => {
  const el = render();
  expect(el.querySelectorAll('.rowWrapper .row')).toHaveLength(0);

  click(byText(el, '한눈에'));

  expect(el.querySelectorAll('.rowWrapper .row')).toHaveLength(5);
  expect(el.querySelector('.cardWrapper')).toBeNull();
});

test('뷰를 바꿔도 입력한 이름과 밴이 유지된다', () => {
  const el = render();

  setValue(el.querySelector('.nameInput'), '철수');
  click(el.querySelector('.selector .option')); // 첫 라인 밴

  click(byText(el, '한눈에'));
  expect(el.querySelector('.rowWrapper .nameInput').value).toBe('철수');
  expect(el.querySelectorAll('.banned')).toHaveLength(1);

  click(byText(el, '카드'));
  expect(el.querySelector('.nameInput').value).toBe('철수');
  expect(el.querySelectorAll('.banned')).toHaveLength(1);
});

test('목록 뷰에서도 라인을 뽑을 수 있다', () => {
  const el = render();
  click(byText(el, '한눈에'));

  const row = el.querySelector('.rowWrapper .row');
  expect(row.querySelector('.lineTag')).toBeNull();

  click(row.querySelector('.assign'));
  expect(row.querySelector('.lineTag')).not.toBeNull();
});

test('모든 라인을 밴하면 뽑기 버튼이 잠긴다', () => {
  const el = render();
  click(byText(el, '한눈에'));

  const row = el.querySelector('.rowWrapper .row');
  row.querySelectorAll('.option').forEach((o) => click(o));

  expect(row.querySelector('.assign').disabled).toBe(true);
});

test('전체 초기화는 이름과 밴을 남기고 배정만 되돌린다', () => {
  const el = render();
  click(byText(el, '한눈에'));

  const row = el.querySelector('.rowWrapper .row');
  setValue(row.querySelector('.nameInput'), '철수');
  click(row.querySelector('.option')); // 라인 하나 밴
  click(row.querySelector('.assign')); // 배정

  expect(row.querySelector('.lineTag')).not.toBeNull();

  click(byText(el, '전체 초기화'));

  const after = el.querySelector('.rowWrapper .row');
  expect(after.querySelector('.nameInput').value).toBe('철수');
  expect(el.querySelectorAll('.banned')).toHaveLength(1); // 밴은 유지
  expect(after.querySelector('.lineTag')).toBeNull();     // 배정만 해제
});

test('명단에서 팀원을 고르면 저장된 못 가는 라인이 자동으로 밴된다', () => {
  localStorage.setItem(
    'lrc.roster',
    JSON.stringify([{ id: 'm1', name: '철수', tier: 'GOLD', division: 4, lines: ['탑', '정글'] }])
  );

  const el = render();
  click(byText(el, '한눈에'));

  const row = el.querySelector('.rowWrapper .row');
  expect(row.querySelectorAll('.banned')).toHaveLength(0);

  click(row.querySelector('.picker-toggle'));
  click(row.querySelector('.picker-item'));

  expect(row.querySelector('.nameInput').value).toBe('철수');
  expect(row.querySelectorAll('.banned')).toHaveLength(2);
});

test('이미 뽑은 사람의 버튼은 회색 처리된다', () => {
  const el = render();
  click(byText(el, '한눈에'));

  const row = el.querySelector('.rowWrapper .row');
  expect(row.querySelector('.assign').classList.contains('assignDone')).toBe(false);

  click(row.querySelector('.assign'));
  expect(row.querySelector('.assign').classList.contains('assignDone')).toBe(true);
});
