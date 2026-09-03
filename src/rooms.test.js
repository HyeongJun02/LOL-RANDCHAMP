import fs from 'fs';
import path from 'path';

/* Data API 클라이언트를 가짜로 세운다. 실제 요청 대신 어떤 표에 무엇을
   보냈는지만 모아둔다 — 여기서 보고 싶은 건 네트워크가 아니라
   '경기를 id로 남기는가'다 */
const calls = [];
let responses = {};

const builder = (table) => {
  const state = { table, op: 'select' };
  const self = {
    insert(payload) {
      state.op = 'insert';
      state.payload = payload;
      return self;
    },
    update(payload) {
      state.op = 'update';
      state.payload = payload;
      return self;
    },
    delete() {
      state.op = 'delete';
      return self;
    },
    select() {
      return self;
    },
    eq(col, val) {
      state.eq = [col, val];
      return self;
    },
    maybeSingle() {
      return self;
    },
    then(onOk, onErr) {
      calls.push(state);
      const canned = responses[`${state.table}.${state.op}`];
      const data = typeof canned === 'function' ? canned(state) : (canned ?? null);
      return Promise.resolve({ data, error: null }).then(onOk, onErr);
    },
  };
  return self;
};

jest.mock('./neon', () => ({
  neon: { from: (t) => builder(t), rpc: jest.fn() },
  isNeonConfigured: true,
}));

const { toMatches, addScrimByNames, feedLine } = require('./rooms');

beforeEach(() => {
  calls.length = 0;
  responses = {};
});

const players = [
  { id: 1, name: '철수' },
  { id: 2, name: '영희' },
  { id: 3, name: '민수' },
];

describe('toMatches', () => {
  test('참가자 id를 이름으로 바꿔서 집계가 그대로 먹게 만든다', () => {
    const out = toMatches(
      [
        {
          id: 10,
          mode: 'normal',
          team_a: [1, 3],
          team_b: [2],
          winner: 'A',
          played_at: '2026-09-01T12:00:00Z',
        },
      ],
      players
    );

    expect(out).toHaveLength(1);
    expect(out[0].teamA).toEqual(['철수', '민수']);
    expect(out[0].teamB).toEqual(['영희']);
    expect(out[0].playedAt).toBe(Date.parse('2026-09-01T12:00:00Z'));
  });

  /* 명단에서 지운 참가자의 id는 경기에 그대로 남아 있다.
     이름을 못 찾은 자리는 버려야 undefined가 집계로 새어 들어가지 않는다 */
  test('명단에서 지워진 참가자 자리는 버린다', () => {
    const out = toMatches(
      [{ id: 10, mode: 'normal', team_a: [1, 99], team_b: [2], winner: 'A', played_at: 0 }],
      players
    );
    expect(out[0].teamA).toEqual(['철수']);
  });

  test('시간순으로 정렬한다 (Elo가 순서를 타기 때문)', () => {
    const g = (id, at) => ({
      id,
      mode: 'normal',
      team_a: [1],
      team_b: [2],
      winner: 'A',
      played_at: at,
    });
    const out = toMatches([g(2, 2000), g(1, 1000), g(3, 3000)], players);
    expect(out.map((m) => m.id)).toEqual([1, 2, 3]);
  });
});

describe('addScrimByNames', () => {
  test('명단에 있는 이름은 그대로 id로 바꿔 저장한다', async () => {
    await addScrimByNames({
      roomId: 7,
      mode: 'aram',
      teamA: ['철수'],
      teamB: ['영희'],
      winner: 'B',
      players,
    });

    expect(calls.filter((c) => c.table === 'room_players')).toHaveLength(0);
    const [scrim] = calls.filter((c) => c.table === 'scrims');
    expect(scrim.payload).toEqual({
      room_id: 7,
      mode: 'aram',
      team_a: [1],
      team_b: [2],
      winner: 'B',
    });
  });

  /* 손님으로 한 판 뛴 사람도 참가자로 등록해야 다음부터 전적이 한 사람으로 모인다 */
  test('명단에 없는 이름은 참가자로 먼저 등록하고 그 id를 쓴다', async () => {
    responses['room_players.insert'] = [{ id: 50, name: '지훈' }];

    await addScrimByNames({
      roomId: 7,
      mode: 'normal',
      teamA: ['철수', '지훈'],
      teamB: ['영희'],
      winner: 'A',
      players,
    });

    const [added] = calls.filter((c) => c.table === 'room_players');
    expect(added.payload).toEqual([{ room_id: 7, name: '지훈' }]);

    const [scrim] = calls.filter((c) => c.table === 'scrims');
    expect(scrim.payload.team_a).toEqual([1, 50]);
  });

  test('같은 새 이름이 양쪽에 여러 번 나와도 한 번만 등록한다', async () => {
    responses['room_players.insert'] = (s) =>
      s.payload.map((r, i) => ({ id: 60 + i, name: r.name }));

    await addScrimByNames({
      roomId: 7,
      mode: 'normal',
      teamA: ['지훈', '지훈'],
      teamB: ['영희'],
      winner: 'A',
      players,
    });

    const [added] = calls.filter((c) => c.table === 'room_players');
    expect(added.payload).toHaveLength(1);
  });
});

test('피드는 로그에 박아둔 그때 이름으로 문장을 만든다', () => {
  expect(
    feedLine({ type: 'transfer', payload: { from: '철수', to: '영희', amount: 2000 } })
  ).toBe('철수 → 영희 에게 2,000 끼꼬를 보냈습니다');
});

/* ---------- SQL 쪽 ---------- */
/* 실행해볼 수 없으니, 무너지면 조용히 잘못되는 부분만 눈으로 못 지나치게 잡아둔다 */

const raw = fs.readFileSync(path.join(__dirname, '..', 'sql', 'setup.sql'), 'utf8');
/* 정렬용 여백 때문에 테스트가 깨지지 않도록 공백을 하나로 눌러서 본다 */
const sql = raw.replace(/[ 	]+/g, ' ');

test('시즌 롤은 잠근 뒤에 달을 다시 확인한다 (동시에 두 번 돌면 끼꼬가 두 번 초기화된다)', () => {
  const body = sql.slice(sql.indexOf('function public.roll_season'));
  const lock = body.indexOf('for update');
  const recheck = body.indexOf('if cur >= m then', lock);
  expect(lock).toBeGreaterThan(-1);
  expect(recheck).toBeGreaterThan(lock);
});

/* 잔액 확인과 차감이 갈라져 있으면, 두 요청이 같은 잔액을 보고 둘 다 통과해
   가진 것보다 많이 보낼 수 있다. 한 문장이어야 한다 */
test('송금은 잔액 확인과 차감을 한 문장으로 한다', () => {
  const body = sql.slice(
    sql.indexOf('function public.transfer_points'),
    sql.indexOf('$fn$;', sql.indexOf('function public.transfer_points'))
  );
  expect(body).toMatch(
    /update profiles set points = points - p_amount\s+where user_id = me and points >= p_amount;/
  );
  expect(body).toContain('if not found then');
});

test('포인트 원장과 피드는 클라이언트가 못 쓴다 (읽기만)', () => {
  expect(sql).toContain('grant select on public.point_ledger to authenticated;');
  expect(sql).toContain('grant select on public.room_logs to authenticated;');
  expect(sql).not.toMatch(/grant [^;]*insert[^;]*on public\.(point_ledger|room_logs)/);
});

test('끼꼬 잔액은 클라이언트가 직접 못 쓴다 (닉네임 컬럼만 열려 있다)', () => {
  expect(sql).toContain('grant update (nickname) on public.profiles to authenticated;');
  /* 컬럼 목록 없는 update GRANT가 하나라도 있으면 points까지 열린다 */
  expect(sql).not.toMatch(/grant [^;(]*update(?!\s*\()[^;(]*on public\.profiles/);
});

test('입장 코드는 방장·부방장만 본다 (rooms SELECT 컬럼에서 빠져 있다)', () => {
  const grant = sql.match(/grant select \(([^)]+)\) on public\.rooms/);
  expect(grant).not.toBeNull();
  expect(grant[1]).not.toContain('join_code');
});

test('돈이 걸린 표는 RLS가 켜져 있다', () => {
  ['profiles', 'rooms', 'room_members', 'room_players', 'scrims', 'hall_of_fame'].forEach((t) => {
    expect(sql).toContain(`alter table public.${t} enable row level security;`);
  });
});
