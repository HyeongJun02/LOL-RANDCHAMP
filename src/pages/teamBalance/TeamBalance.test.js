global.IS_REACT_ACT_ENVIRONMENT = true;

const MEMBER = { id: 'm1', name: '철수', tier: 'DIAMOND', division: 2 };

let act;

/* roster.js가 적재 시점에 localStorage를 읽으므로, 시드를 심은 뒤 새로 require한다.
   React도 같은 레지스트리에서 가져와야 훅 디스패처가 갈리지 않는다. */
const render = (matches = []) => {
  jest.resetModules();
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const TeamBalance = require('./TeamBalance').default;
  ({ act } = React);

  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => createRoot(container).render(React.createElement(TeamBalance, { matches })));
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

/* 팝업은 이제 document.body로 포탈되어 el 밖에 그려지므로 document 전체에서 찾는다 */
const byText = (el, text) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));

const buildWith = (names, matches = []) => {
  const el = render(matches);
  const inputs = el.querySelectorAll('.row-name input');
  names.forEach((n, i) => setValue(inputs[i], n));
  click(el.querySelector('.build-btn'));
  return el;
};

test('후보 버튼을 누르면 모든 조합이 팝업으로 뜬다', () => {
  const el = buildWith(['가', '나', '다', '라']);

  expect(document.querySelector('.modal-backdrop')).toBeNull();
  click(el.querySelector('.result-cands'));

  // 서로 다른 4명을 2:2로 나누는 방법 3가지
  expect(document.querySelectorAll('.cand-card')).toHaveLength(3);
  expect(document.querySelectorAll('.cand-card.is-current')).toHaveLength(1);
});

test('팝업에서 다른 조합을 고르면 결과가 그 조합으로 바뀐다', () => {
  const el = buildWith(['가', '나', '다', '라']);
  click(el.querySelector('.result-cands'));

  const other = [...document.querySelectorAll('.cand-card')].find(
    (c) => !c.classList.contains('is-current')
  );
  const expected = [...other.querySelectorAll('.cand-team.blue li')].map((li) =>
    li.textContent.trim()
  );

  click(other);

  expect(document.querySelector('.modal-backdrop')).toBeNull();
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
  document.querySelectorAll('.loader-list input').forEach((box) => click(box));
  click(byText(el, '완료'));

  expect(document.querySelector('.modal-backdrop')).toBeNull();

  const rows = [...el.querySelectorAll('.player-row')];
  expect(rows[0].querySelector('.row-name input').value).toBe('철수');
  expect(rows[0].querySelector('.row-tier').value).toBe('DIAMOND');
  expect(rows[1].querySelector('.row-name input').value).toBe('영희');
  expect(rows[1].querySelector('.row-div').value).toBe('1');
});

test('이미 들어간 팀원은 체크된 채로 뜨고, 풀면 참가자에서 빠진다', () => {
  seedRoster([
    { id: 'a', name: '철수', tier: 'GOLD', division: 4 },
    { id: 'b', name: '영희', tier: 'GOLD', division: 4 },
  ]);
  const el = render();

  click(byText(el, '불러오기'));
  document.querySelectorAll('.loader-list input').forEach((box) => click(box));
  click(byText(el, '완료'));

  // 다시 열면 둘 다 체크되어 있다
  click(byText(el, '불러오기'));
  const boxes = [...document.querySelectorAll('.loader-list input')];
  expect(boxes.map((b) => b.checked)).toEqual([true, true]);
  expect(boxes.every((b) => b.disabled)).toBe(false);

  // 하나를 풀고 완료하면 그 사람만 빠진다 (정렬 순서에 기대지 않고 이름으로 찾는다)
  const rowOf = (name) =>
    [...document.querySelectorAll('.loader-list li')].find((li) =>
      li.textContent.includes(name)
    );
  click(rowOf('철수').querySelector('input'));
  click(byText(el, '완료'));

  const names = [...el.querySelectorAll('.row-name input')].map((i) => i.value);
  expect(names).not.toContain('철수');
  expect(names).toContain('영희');
});

describe('내전 포인트 반영', () => {
  /* 전적은 방이 들고 있다. 넘겨주지 않으면 평점 기준을 고를 것 자체가 없다 */
  test('전적을 안 넘기면 평점 기준 자체가 안 뜬다', () => {
    const el = buildWith(['철수', '영희']);
    expect(byText(el, '티어 + 내전 포인트')).toBeUndefined();
  });

  test('평점 기준을 티어만이 아닌 걸로 바꾸면 내전 포인트 배지가 보인다', () => {
    const el = buildWith(['철수', '영희'], [
      { id: 'm1', mode: 'normal', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 },
    ]);

    expect(el.querySelector('.scrim-badge')).toBeNull();

    click(byText(el, '티어 + 내전 포인트'));
    expect(el.querySelectorAll('.scrim-badge').length).toBeGreaterThan(0);
  });

  test('내전 포인트만 기준으로 짜면 평점 합이 내전 포인트 합과 같아진다', () => {
    const el = buildWith(['가', '나', '다', '라'], [
      { id: 'm1', mode: 'normal', teamA: ['가'], teamB: ['나'], winner: 'A', playedAt: 1 },
      { id: 'm2', mode: 'normal', teamA: ['다'], teamB: ['라'], winner: 'A', playedAt: 2 },
    ]);
    click(byText(el, '내전 포인트만'));
    click(el.querySelector('.build-btn'));

    // 티어 기준이면 전원 골드라 합이 0일 수 없다 — 실제로 바뀌었는지 확인
    const sums = [...el.querySelectorAll('.team-sum strong')].map((s) => Number(s.textContent));
    expect(sums[0] + sums[1]).toBe(0); // 가·다 +2, 나·라 -2
  });

  /* 모드를 나누지 않으므로 칼바람 승리도 그대로 내전 포인트가 된다 */
  test('칼바람 기록도 내전 포인트에 함께 반영된다', () => {
    const el = buildWith(['철수', '영희'], [
      { id: 'm1', mode: 'aram', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 1 },
      { id: 'm2', mode: 'aram', teamA: ['철수'], teamB: ['영희'], winner: 'A', playedAt: 2 },
    ]);
    click(byText(el, '내전 포인트만'));
    click(el.querySelector('.build-btn'));

    const badgeFor = (name) =>
      [...el.querySelectorAll('.team-list li')]
        .find((li) => li.textContent.includes(name))
        .querySelector('.scrim-badge').textContent;

    expect(badgeFor('철수').startsWith('+')).toBe(true);
    expect(badgeFor('영희').startsWith('-')).toBe(true);
  });
});

test('직접 입력한 이름은 팝업이 건드리지 않는다', () => {
  seedRoster([{ id: 'a', name: '철수', tier: 'GOLD', division: 4 }]);
  const el = render();

  setValue(el.querySelectorAll('.row-name input')[0], '지나가던행인');

  click(byText(el, '불러오기'));
  click(document.querySelector('.loader-list input'));
  click(byText(el, '완료'));

  const names = [...el.querySelectorAll('.row-name input')].map((i) => i.value);
  expect(names).toContain('지나가던행인');
  expect(names).toContain('철수');
});
