global.IS_REACT_ACT_ENVIRONMENT = true;

let act;

const render = () => {
  jest.resetModules();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const RandomPick = require('./RandomPick').default;
  ({ act } = React);

  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => createRoot(container).render(React.createElement(RandomPick)));
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

const texts = (el, sel) => [...el.querySelectorAll(sel)].map((n) => n.textContent.trim());

/* 뽑기 애니메이션이 끝날 때까지 타이머를 돌린다 */
const finishRoll = () => act(() => jest.advanceTimersByTime(2000));

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  jest.useFakeTimers();
});

afterEach(() => jest.useRealTimers());

const addItems = (el, text) => {
  setValue(el.querySelector('.pick-input input'), text);
  click(byText(el, '추가'));
};

test('쉼표로 여러 항목을 한 번에 넣는다', () => {
  const el = render();
  addItems(el, '롤, 옵치, 발로란트');

  expect(texts(el, '.pick-items li')).toEqual(['롤', '옵치', '발로란트']);
});

test('동전 프리셋은 항목을 앞/뒤 두 개로 바꾼다', () => {
  const el = render();
  addItems(el, '롤');
  click(byText(el, '동전'));

  expect(texts(el, '.pick-items li')).toEqual(['앞', '뒤']);
});

test('저장된 팀원 명단을 통째로 불러온다', () => {
  localStorage.setItem(
    'lrc.roster',
    JSON.stringify([
      { id: 'a', name: '철수' },
      { id: 'b', name: '영희' },
    ])
  );
  const el = render();
  click(byText(el, '명단 불러오기'));

  expect(texts(el, '.pick-items li')).toEqual(['철수', '영희']);
});

test('뽑으면 항목 중 하나가 결과로 나오고 기록에 남는다', () => {
  const el = render();
  addItems(el, '가, 나, 다');

  click(byText(el, '뽑기'));
  finishRoll();

  const result = el.querySelector('.pick-result').textContent;
  expect(['가', '나', '다']).toContain(result);
  expect(texts(el, '.pick-history li')).toEqual([result]);
});

test('뽑은 항목 제외를 켜면 같은 게 다시 안 나오고, 다 뽑으면 후보가 0이 된다', () => {
  const el = render();
  addItems(el, '가, 나, 다');
  act(() => {
    el.querySelector('.pick-toggle input').click();
  });

  for (let i = 0; i < 3; i += 1) {
    click(byText(el, '뽑기'));
    finishRoll();
  }

  expect(texts(el, '.pick-history li').sort()).toEqual(['가', '나', '다']);
  expect(el.querySelector('.draw-pool').textContent).toBe('0개 중');
});

test('항목이 없으면 뽑아도 결과가 안 나온다', () => {
  const el = render();
  click(byText(el, '뽑기'));
  finishRoll();

  expect(el.querySelector('.pick-result')).toBeNull();
});
