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

const rpcCalls = [];
jest.mock('./neon', () => ({
  neon: {
    from: (t) => builder(t),
    rpc: (fn, args) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: null, error: null });
    },
  },
  isNeonConfigured: true,
}));

const {
  toMatches,
  addScrimByNames,
  feedLine,
  feedParts,
  killMarket,
  capOf,
  winningSelection,
  killLineFor,
  killLineOfScrim,
} = require('./rooms');

beforeEach(() => {
  calls.length = 0;
  rpcCalls.length = 0;
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
    /* 경기는 테이블 직접 쓰기가 아니라 함수로만 들어간다.
       열어두면 경기를 찍어내는 것만으로 참여 포인트를 무한히 만들 수 있다 */
    expect(calls.filter((c) => c.table === 'scrims')).toHaveLength(0);
    expect(rpcCalls).toEqual([
      {
        fn: 'record_scrim',
        args: { p_room: 7, p_mode: 'aram', p_team_a: [1], p_team_b: [2], p_winner: 'B' },
      },
    ]);
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
    expect(rpcCalls[0].args.p_team_a).toEqual([1, 50]);
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

test('로그는 그때 박아둔 이름으로 문장을 만든다 (닉네임을 바꿔도 그대로)', () => {
  const line = feedLine({
    type: 'transfer',
    payload: { from: '철수', to: '영희', amount: 2000 },
  });
  expect(line).toContain('철수');
  expect(line).toContain('영희');
  expect(line).toContain('2,000');
});

test('로그 조각은 이름과 금액을 따로 표시해 색을 입힐 수 있게 준다', () => {
  const { tag, parts } = feedParts({
    type: 'transfer',
    payload: { from: '철수', to: '영희', amount: 2000 },
  });

  expect(tag.label).toBe('이체');
  expect(parts.filter((p) => p.k === 'name').map((p) => p.v)).toEqual(['철수', '영희']);
  expect(parts.find((p) => p.k === 'amount').v).toContain('2,000');
});

test('모르는 종류의 로그도 태그를 달아 그냥 지나가게 둔다', () => {
  const { tag, parts } = feedParts({ type: '새로운거', payload: {} });
  expect(tag.label).toBe('기타');
  expect(parts).toHaveLength(1);
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

/* ---------- 또또 ---------- */
/* 여기가 시스템에서 제일 복잡하다. 트랜잭션이 깨지면 끼꼬가 사라지거나
   두 배로 생긴다. 실행해볼 수 없으니 무너지면 조용히 잘못되는 것들을 잡아둔다 */

const fnBody = (name) => {
  const from = sql.indexOf(`function public.${name}`);
  return sql.slice(from, sql.indexOf('$fn$;', from));
};

test('마켓 이름과 상한이 앱과 DB에서 같다', () => {
  expect(killMarket(45.5)).toBe('kills_45.5');
  expect(capOf('first_blood')).toBe(2000);
  expect(capOf(killMarket(45.5))).toBe(3000);
  expect(capOf('winner')).toBeNull();

  const body = fnBody('place_bets');
  expect(body).toContain("when b->>'market' = 'first_blood' then 2000");
  expect(body).toContain("when b->>'market' like 'kills%' then 3000");
});

test('배팅도 잔액 확인과 차감을 한 문장으로 한다', () => {
  const body = fnBody('place_bets');
  expect(body).toMatch(
    /update profiles set points = points - total\s+where user_id = me and points >= total;/
  );
  expect(body).toContain('if not found then');
});

test('승부 조작 동의 없이는 못 건다', () => {
  expect(fnBody('place_bets')).toContain('agreed_fairplay_at from profiles');
});

/* 배당은 총 풀 ÷ 적중 쪽 풀. 많이 걸린 쪽이 낮은 배당을 가져가고,
   나간 만큼만 들어오는 제로섬이라 끼꼬가 늘지 않는다 */
test('승리팀 배당은 패리뮤추얼이다', () => {
  const body = fnBody('lock_betting');
  expect(body).toContain('round(pool::numeric / total_amount, 2)');
  /* 아무도 안 건 선택지는 나누기가 안 된다. null로 두고 정산 때 환불한다 */
  expect(body).toContain('case when total_amount = 0 then null');
});

test('퍼블은 인원 × 0.85, 언더오버는 1.98 고정', () => {
  const body = fnBody('lock_betting');
  expect(body).toContain('round(n * 0.85, 2)');
  expect(body).toContain('set odds = 1.98');
});

/* 네트워크 재시도로 두 번 불려도 두 번 지급되면 안 된다 */
test('이미 정산된 경기에 다시 불러도 아무 일이 없다', () => {
  expect(fnBody('settle_scrim')).toContain("if s.status = 'settled' then return; end if;");
});

test('적중한 쪽에 아무도 안 걸었으면 그 마켓은 통째로 환불한다', () => {
  const body = fnBody('settle_scrim');
  expect(body).toContain('winner_void := not exists');
  expect(body).toContain('when b.market = \'winner\' and winner_void then b.amount');
  expect(body).toContain('when b.market = \'first_blood\' and fb_void then b.amount');
});

/* 두 번째 되돌리기가 첫 번째로 이미 취소한 지급까지 또 뒤집으면
   그만큼 끼꼬가 사라진다 */
test('되돌리기는 아직 안 뒤집은 줄만 고른다', () => {
  const body = fnBody('unsettle_scrim');
  expect(body).toContain('reversed_at is null');
  expect(body).toContain('set reversed_at = now()');
});

test('되돌리기는 방장만, 되돌린 사실은 피드에 남는다', () => {
  const body = fnBody('unsettle_scrim');
  expect(body).toContain('is_room_owner');
  expect(body).toContain("'settle_undone'");
});

test('같은 마켓에 두 선택지를 걸 수 없다', () => {
  expect(sql).toContain('unique (scrim_id, user_id, market)');
});

test('배당은 마감 전에는 안 보인다', () => {
  const from = sql.indexOf('create policy pools_read');
  expect(sql.slice(from, sql.indexOf(';', from))).toContain("s.status <> 'betting'");
});

test('남의 배팅은 정산된 뒤에만 보인다', () => {
  const from = sql.indexOf('create policy bets_read');
  expect(sql.slice(from, sql.indexOf('));', from))).toContain("s.status = 'settled'");
});

/* 경기 직접 insert를 열어두면 찍어내는 것만으로 참여 포인트가 무한히 생긴다 */
test('경기 테이블 쓰기는 회수돼 있다', () => {
  expect(sql).toContain('revoke insert, update, delete on public.scrims from authenticated;');
});

test('한 사람이 한 방에서 두 참가자에 묶일 수 없다 (참여 포인트 이중 수령)', () => {
  expect(sql).toContain('create unique index if not exists room_players_one_account');
});


/* ---------- 또또 정답 판정 ---------- */
/* 화면 세 군데(선택지 색·내 배팅·참여자 목록)가 이 함수 하나를 본다.
   여기가 틀리면 '적중'이라고 초록으로 칠해놓고 돈은 반대쪽에 준다 */

const settled = (extra) => ({ status: 'settled', winner: 'A', ...extra });

test('정산 전에는 정답이 없다', () => {
  expect(winningSelection({ status: 'betting', winner: 'A' }, 'winner')).toBeNull();
  expect(winningSelection({ status: 'locked', winner: 'A' }, 'winner')).toBeNull();
});

test('승리팀은 winner 그대로', () => {
  expect(winningSelection(settled({ winner: 'B' }), 'winner')).toBe('B');
});

test('퍼블은 참가자 id를 문자열로 (선택지 값과 같은 타입이어야 비교된다)', () => {
  expect(winningSelection(settled({ first_blood_player_id: 42 }), 'first_blood')).toBe('42');
});

test('총 킬은 기준선보다 크면 오버, 작으면 언더', () => {
  const line = killLineFor(6);
  const market = killMarket(line);
  expect(winningSelection(settled({ total_kills: line + 1 }), market)).toBe('over');
  expect(winningSelection(settled({ total_kills: line - 1 }), market)).toBe('under');
});

test('결과를 안 넣은 마켓은 정답이 없다 (전액 환불되는 경우)', () => {
  const market = killMarket(killLineFor(6));
  expect(winningSelection(settled({ total_kills: null }), market)).toBeNull();
  expect(winningSelection(settled({ first_blood_player_id: null }), 'first_blood')).toBeNull();
});

/* ---------- 킬 기준선 ---------- */
/* 칼바람 6명에서 45.5가 반반이었다. 8명이면 킬도 그만큼 더 나오니
   같은 값을 쓰면 오버가 거의 확정이 된다 */

test('인원에 따라 기준선이 올라간다 (6명 45.5 · 8명 60.5)', () => {
  expect(killLineFor(6)).toBe(45.5);
  expect(killLineFor(8)).toBe(60.5);
  expect(killLineFor(10)).toBe(75.5);
});

test('기준선은 항상 .5로 끊긴다 (무승부가 없어야 한다)', () => {
  for (let n = 2; n <= 20; n += 1) {
    expect(killLineFor(n) % 1).toBe(0.5);
  }
});

test('인원이 늘면 기준선도 반드시 같이 오른다', () => {
  for (let n = 2; n < 20; n += 1) {
    expect(killLineFor(n + 1)).toBeGreaterThan(killLineFor(n));
  }
});

test('경기의 기준선은 배팅을 열 때 박힌 팀에서 계산한다', () => {
  const scrim = { team_a: [1, 2, 3], team_b: [4, 5, 6] };
  expect(killLineOfScrim(scrim)).toBe(45.5);
  /* 팀이 비어 있어도 터지지 않는다 */
  expect(killLineOfScrim({})).toBe(45.5);
  expect(killLineOfScrim(null)).toBe(45.5);
});

test('기준선이 그대로 마켓 이름이 되고, 다시 읽어도 같은 값이다', () => {
  const line = killLineFor(8);
  expect(killMarket(line)).toBe('kills_60.5');
  const scrim = {
    status: 'settled',
    team_a: [1, 2, 3, 4],
    team_b: [5, 6, 7, 8],
    total_kills: 61,
  };
  expect(winningSelection(scrim, killMarket(killLineOfScrim(scrim)))).toBe('over');
});


/* ---------- 배팅 마감 시각 · 퍼블 배당 (SQL 계약) ---------- */

test('마감 시각은 서버가 정한다 (브라우저 시계를 믿으면 사람마다 마감이 달라진다)', () => {
  const body = sql.slice(sql.indexOf('function public.open_betting'));
  expect(body).toContain('now() + make_interval');
});

test('시간이 지나면 status가 betting이어도 더 못 건다', () => {
  const body = sql.slice(
    sql.indexOf('function public.place_bets'),
    sql.indexOf('function public.lock_betting')
  );
  expect(body).toContain('betting_closes_at is not null and now() >= s.betting_closes_at');
});

test('시간이 지난 뒤에는 방장이 아니어도 마감할 수 있다 (방장이 자리를 비워도 배당이 열려야 한다)', () => {
  const body = sql.slice(sql.indexOf('function public.lock_betting'));
  expect(body).toContain('if not expired and not public.is_room_admin');
  /* 대신 시간이 안 됐으면 여전히 방장만 */
  expect(body).toContain('expired and not public.is_room_member');
});

test('인자를 늘린 open_betting은 옛 4인자 버전을 먼저 지운다 (안 지우면 호출이 모호해진다)', () => {
  const drop = sql.indexOf('drop function if exists public.open_betting(bigint, text, jsonb, jsonb)');
  expect(drop).toBeGreaterThan(-1);
  expect(drop).toBeLessThan(sql.indexOf('create or replace function public.open_betting'));
  expect(sql).toContain('public.open_betting(bigint, text, jsonb, jsonb, int)');
});

test('퍼블 배당은 티어가 낮을수록 높다 (전원 같으면 낮은 티어에 걸 이유가 없다)', () => {
  const body = sql.slice(sql.indexOf('function public.lock_betting'));
  /* 골드(인덱스 3)를 1.00으로 두고 한 칸당 2% */
  expect(body).toContain('(3 - coalesce(t.idx, 3)) * 0.02');
  /* 조인에서 빠진 선택지도 배당이 비지 않게 채운다 */
  expect(body).toContain("market = 'first_blood' and odds is null");
});
