/* 로그인 시 병합/업로드 동작 검증.
   neon 모듈을 통째로 목킹해서 네트워크 없이 호출만 들여다본다. */
const mockUpsert = jest.fn();
const mockRows = { current: null };
const mockError = { select: null, upsert: null };

jest.mock('./neon', () => ({
  isNeonConfigured: true,
  neon: {
    from: () => ({
      upsert: (row) => {
        mockUpsert(row);
        return Promise.resolve({ error: mockError.upsert });
      },
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: mockRows.current, error: mockError.select }),
        }),
      }),
    }),
  },
}));

let store;
let roster;

/* roster.js가 적재될 때 store를 만들므로 둘을 같이 새로 받아야 한다 */
const load = () => {
  jest.resetModules();
  store = require('./store');
  roster = require('./roster');
};

const stored = () => JSON.parse(localStorage.getItem('lrc.roster'));
const names = (list) => list.map((m) => m.name).sort();

beforeEach(() => {
  localStorage.clear();
  mockUpsert.mockReset();
  mockRows.current = null;
  mockError.select = null;
  mockError.upsert = null;
});

test('로그인 전에는 서버를 건드리지 않는다', () => {
  load();
  roster.addMember({ name: '철수' });

  expect(mockUpsert).not.toHaveBeenCalled();
  expect(stored()).toHaveLength(1);
});

test('로그인하면 서버 값과 이 기기 값을 합친다', async () => {
  localStorage.setItem(
    'lrc.roster',
    JSON.stringify([{ id: 'l1', name: '로컬만있는사람', tier: 'GOLD', division: 4 }])
  );
  load();

  mockRows.current = {
    user_id: 'u1',
    roster: [{ id: 'r1', name: '서버에있는사람', tier: 'DIAMOND', division: 2 }],
  };
  await store.setCloudUser('u1');

  expect(names(stored())).toEqual(['로컬만있는사람', '서버에있는사람'].sort());
  /* 합친 결과를 서버에도 한 번 밀어 넣는다 */
  const pushed = mockUpsert.mock.calls.at(-1)[0];
  expect(pushed.user_id).toBe('u1');
  expect(names(pushed.roster)).toEqual(['로컬만있는사람', '서버에있는사람'].sort());
});

test('이름이 겹치면 서버 쪽을 남긴다 (중복 생성 안 함)', async () => {
  localStorage.setItem(
    'lrc.roster',
    JSON.stringify([{ id: 'l1', name: '철수', tier: 'IRON', division: 4 }])
  );
  load();

  mockRows.current = {
    roster: [{ id: 'r1', name: '철수', tier: 'DIAMOND', division: 2 }],
  };
  await store.setCloudUser('u1');

  expect(stored()).toHaveLength(1);
  expect(stored()[0]).toMatchObject({ name: '철수', tier: 'DIAMOND' });
});

test('로그인 후 수정하면 서버로 올라간다', async () => {
  load();
  await store.setCloudUser('u1');
  mockUpsert.mockClear();

  roster.addMember({ name: '영희' });
  await Promise.resolve();

  expect(mockUpsert).toHaveBeenCalledTimes(1);
  expect(names(mockUpsert.mock.calls[0][0].roster)).toEqual(['영희']);
});

test('로그아웃하면 이 기기 값으로 돌아가고 서버를 안 건드린다', async () => {
  load();
  mockRows.current = { roster: [{ id: 'r1', name: '서버사람' }] };
  await store.setCloudUser('u1');
  expect(stored()).toHaveLength(1);

  await store.setCloudUser(null);
  mockUpsert.mockClear();

  roster.addMember({ name: '로그아웃후추가' });
  await Promise.resolve();
  expect(mockUpsert).not.toHaveBeenCalled();
});

test('서버 저장에 실패해도 화면 값은 남고 알림만 간다', async () => {
  load();
  const onError = jest.fn();
  store.setSyncErrorHandler(onError);
  await store.setCloudUser('u1');

  mockError.upsert = { message: 'permission denied' };
  roster.addMember({ name: '철수' });
  await Promise.resolve();
  await Promise.resolve();

  expect(stored()).toHaveLength(1); // 로컬에는 남아 있다
  expect(onError).toHaveBeenCalled();
});

test('서버 읽기가 실패해도 앱이 죽지 않고 로컬 값을 유지한다', async () => {
  localStorage.setItem('lrc.roster', JSON.stringify([{ id: 'l1', name: '철수' }]));
  load();
  const onError = jest.fn();
  store.setSyncErrorHandler(onError);

  mockError.select = { message: 'network down' };
  await store.setCloudUser('u1');

  expect(onError).toHaveBeenCalled();
  expect(stored()).toHaveLength(1);
});

describe('계정당 한도', () => {
  const many = (n, prefix) =>
    Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix}${i}` }));

  test('한도를 넘기면 화면 값도 안 바뀌고 알림만 간다', async () => {
    const { MAX_ROSTER } = require('./limits');
    localStorage.setItem('lrc.roster', JSON.stringify(many(MAX_ROSTER, 'p')));
    load();

    const onError = jest.fn();
    store.setSyncErrorHandler(onError);
    await store.setCloudUser('보통사람');
    mockUpsert.mockClear();

    roster.addMember({ name: '한명더' });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('최대'));
    expect(stored()).toHaveLength(MAX_ROSTER); // 안 늘었다
    expect(mockUpsert).not.toHaveBeenCalled(); // 서버도 안 건드린다
  });

  test('관리자는 한도를 안 받는다', async () => {
    const { MAX_ROSTER, ADMIN_USER_ID } = require('./limits');
    localStorage.setItem('lrc.roster', JSON.stringify(many(MAX_ROSTER, 'p')));
    load();

    const onError = jest.fn();
    store.setSyncErrorHandler(onError);
    await store.setCloudUser(ADMIN_USER_ID);

    roster.addMember({ name: '한명더' });

    expect(onError).not.toHaveBeenCalled();
    expect(stored()).toHaveLength(MAX_ROSTER + 1);
  });

  test('로그인 안 했으면 한도가 없다', () => {
    const { MAX_ROSTER } = require('./limits');
    localStorage.setItem('lrc.roster', JSON.stringify(many(MAX_ROSTER, 'p')));
    load();

    roster.addMember({ name: '한명더' });
    expect(stored()).toHaveLength(MAX_ROSTER + 1);
  });
});
