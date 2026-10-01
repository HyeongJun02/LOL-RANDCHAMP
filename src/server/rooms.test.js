import fs from 'fs';
import { defaultTierOf } from '../rules/games';
import { KILLS_ODDS, KILLS_SHADE, KILLS_ODDS_RANGE } from '../rules/tuning';
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
    in(col, vals) {
      state.in = [col, vals];
      return self;
    },
    not(col, op, val) {
      state.not = [col, op, val];
      return self;
    },
    limit() {
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
  firstBloodRates,
  openBettingByNames,
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
  /* 최근 기록 카드가 퍼블과 총 킬을 보여주려면 여기서 같이 넘어와야 한다.
     퍼블은 참가자 id로 저장되니 이름으로 바꿔서 준다 */
  test('퍼블과 총 킬을 이름까지 붙여 넘긴다', () => {
    const [out] = toMatches(
      [
        {
          id: 10,
          mode: 'normal',
          team_a: [1],
          team_b: [2],
          winner: 'A',
          played_at: 0,
          total_kills: 47,
          first_blood_player_id: 2,
        },
      ],
      players
    );
    expect(out.totalKills).toBe(47);
    expect(out.firstBlood).toBe('영희');
  });

  /* 또또 없이 남긴 기록에는 결과가 없다. 0이나 빈 문자열로 채우면
     화면이 '0킬'이라고 우긴다 */
  test('결과를 안 넣은 판은 비어서 온다', () => {
    const [out] = toMatches(
      [{ id: 11, mode: 'normal', team_a: [1], team_b: [2], winner: 'B', played_at: 0 }],
      players
    );
    expect(out.totalKills).toBeNull();
    expect(out.firstBlood).toBeNull();
  });

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

    const [added] = calls.filter((c) => c.table === 'room_players' && c.op === 'insert');
    /* 기본 티어는 게임에 맞춰 붙는다 (게임을 안 넘기면 롤) */
    expect(added.payload).toEqual([
      { room_id: 7, name: '지훈', ...defaultTierOf('lol') },
    ]);
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

    const [added] = calls.filter((c) => c.table === 'room_players' && c.op === 'insert');
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

  expect(tag.label).toBe('끼꼬');
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

const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'sql', 'setup.sql'), 'utf8');
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
test('송금은 잔액 확인과 차감을 한 문장으로 한다 (방 지갑에서)', () => {
  const body = sql.slice(
    sql.indexOf('function public.transfer_points'),
    sql.indexOf('$fn$;', sql.indexOf('function public.transfer_points'))
  );
  expect(body).toMatch(
    /update room_wallets set points = points - p_amount\s+where room_id = p_room and user_id = me and points >= p_amount;/
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

/* 마켓 이름은 SQL의 split_part(market, '_', 2)가 기준선을 떼어낼 수 있는
   모양이어야 한다. 상한 값 자체는 아래 BET_CAP 대조 테스트가 본다 */
test('킬 마켓 이름에 기준선이 그대로 들어간다', () => {
  expect(killMarket(53.5)).toBe('kills_53.5');
  expect(fnBody('place_bets')).toContain("like 'kills%'");
});

test('배팅도 잔액 확인과 차감을 한 문장으로 한다 (방 지갑에서)', () => {
  const body = fnBody('place_bets');
  expect(body).toMatch(
    /update room_wallets set points = points - total\s+where room_id = s\.room_id and user_id = me and points >= total;/
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

test('퍼블은 인원 × 0.85', () => {
  expect(fnBody('fb_odds')).toContain('n * 0.85');
  /* 명단에서 지워진 참가자는 fb_odds가 못 찾는다. 배당이 비지 않게 채운다 */
  expect(fnBody('lock_betting')).toContain('round(n * 0.85, 2)');
});

/* 화면과 정산이 따로 계산하면 '걸 때 본 배당'과 '받은 배당'이 조용히
   달라진다. 퍼블은 고정 배당이라 마감 전에 보여줘도 눈치싸움이 안 생기고,
   그래서 같은 함수를 양쪽이 쓴다 */
test('퍼블 배당은 화면과 정산이 같은 함수를 쓴다', () => {
  expect(fnBody('lock_betting')).toContain('from public.fb_odds(p_scrim) f');
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  expect(src).toContain("rpc('fb_odds'");
  /* 남의 방 명단을 배당으로 떠볼 수 없어야 한다 */
  expect(fnBody('fb_odds')).toContain('if not public.is_room_member(s.room_id) then');
});

/* 퍼블은 한 판에 한 번뿐이라 표본이 아주 느리게 쌓인다. 몇 판 안 한
   사람의 비율은 사실상 우연이라, 보정이 세면 엉뚱한 사람에게 돈이 몰린다 */
test('퍼블 비율 보정은 아주 작고, 위아래로 묶여 있다', () => {
  const tuning = require('../rules/tuning');
  const body = fnBody('fb_odds');
  expect(body).toContain(`1 - ${tuning.FIRST_BLOOD_RATE_TILT} * (`);
  expect(body).toContain(
    `greatest(${tuning.FIRST_BLOOD_TILT_CLAMP.min}, least(${tuning.FIRST_BLOOD_TILT_CLAMP.max},`
  );
  /* 판수 보정을 먼저 건다 (순위표와 같은 PRIOR_GAMES) */
  expect(body).toContain(`st.got + ${tuning.PRIOR_GAMES} * (st.expected / st.games)`);
  expect(body).toContain(`/ (st.games + ${tuning.PRIOR_GAMES})`);
  /* 한 판도 안 뛴 사람은 보정 없이 기본값 */
  expect(body).toContain('when st.games = 0 then 1.0');

  /* 티어 보정(칸당 2%)보다 크면 '조금'이 아니다 */
  expect(tuning.FIRST_BLOOD_RATE_TILT).toBeLessThanOrEqual(0.05);
  expect(tuning.FIRST_BLOOD_TILT_CLAMP.max - 1).toBeLessThanOrEqual(0.06);
});

/* 굴려보면 이렇게 나온다. 수식을 고치면 여기가 먼저 깨진다 */
test('평균대로 따면 그대로, 많이 따면 아주 조금만 낮아진다', () => {
  const t = require('../rules/tuning');
  /* fb_odds의 보정 항과 같은 식 */
  const tilt = (rate, n) =>
    Math.min(
      t.FIRST_BLOOD_TILT_CLAMP.max,
      Math.max(t.FIRST_BLOOD_TILT_CLAMP.min, 1 - t.FIRST_BLOOD_RATE_TILT * (rate * n - 1))
    );

  /* 6명 방. 평균은 1/6 */
  expect(tilt(1 / 6, 6)).toBeCloseTo(1, 5);
  /* 평균의 2배 → 3%만 내려간다 */
  expect(tilt(2 / 6, 6)).toBeCloseTo(1 - t.FIRST_BLOOD_RATE_TILT, 5);
  /* 아무리 많이 따도 하한 아래로는 안 간다 (6명 방에서 전부 다 딴 사람) */
  expect(tilt(1, 6)).toBe(t.FIRST_BLOOD_TILT_CLAMP.min);
  /* 반대쪽은 상한에 닿지도 않는다. 평균보다 적게 따 봐야 0까지라,
     한 번도 못 딴 사람이어야 겨우 +3%다 */
  expect(tilt(0, 6)).toBeCloseTo(1 + t.FIRST_BLOOD_RATE_TILT, 5);
  expect(tilt(0, 6)).toBeLessThan(t.FIRST_BLOOD_TILT_CLAMP.max);
});

/* 기준·지수·상하한이 tuning.js와 어긋나면 화면은 '1.98배쯤'이라고 적고
   서버는 다른 값을 지급한다. 숫자를 한쪽만 고치는 걸 여기서 잡는다 */
test('언더오버는 기준 배당에서 몰린 만큼만 움직인다', () => {
  const body = fnBody('lock_betting');
  expect(body).toContain(
    `round(${KILLS_ODDS} * power(0.5 / (bp.total_amount::numeric / t.pool), ${KILLS_SHADE}), 2)`
  );
  expect(body).toContain(
    `greatest(${KILLS_ODDS_RANGE.min.toFixed(2)}, least(${KILLS_ODDS_RANGE.max.toFixed(2)},`
  );
  /* 아무도 안 걸린 쪽은 기준값 그대로 (0으로 나누면 터진다) */
  expect(body).toContain(`when t.pool = 0 or bp.total_amount = 0 then ${KILLS_ODDS}`);
  /* 두 갈래 마켓이 여럿이다 (언더오버·짝홀·어느 팀). 다 합쳐서 비중을
     재면 짝홀에 몰린 돈이 언더오버 배당을 흔든다 */
  expect(body).toContain('group by bp.market');
});

/* 굴려보면 이렇게 나온다. 수식을 고치면 여기가 먼저 깨진다 */
test('반반이면 기준값, 몰리면 내려가고 반대쪽은 올라간다', () => {
  const odds = (share) =>
    Math.min(
      KILLS_ODDS_RANGE.max,
      Math.max(KILLS_ODDS_RANGE.min, Math.round(KILLS_ODDS * (0.5 / share) ** KILLS_SHADE * 100) / 100)
    );
  expect(odds(0.5)).toBe(KILLS_ODDS);
  expect(odds(0.8)).toBeCloseTo(1.55, 2);
  expect(odds(0.2)).toBe(KILLS_ODDS_RANGE.max);
  /* 한쪽에만 걸렸어도 상한·하한 안에 있다 */
  expect(odds(1)).toBeCloseTo(1.39, 2);
  expect(odds(0.5)).toBeLessThan(odds(0.35));
  expect(odds(0.65)).toBeLessThan(odds(0.5));
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

test('되돌리기는 되돌리기 권한이 있어야 한다 (기본은 방장만)', () => {
  const body = fnBody('unsettle_scrim');
  expect(body).toContain("room_can(s.room_id, 'undo')");
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
  expect(sql).toContain('create unique index room_players_one_account');
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
/* 인당 7.5킬(6명 45.5)로 잡았더니 매번 오버만 떴다. 실제로는 그보다
   훨씬 많이 나온다는 뜻이라 인당 8.9킬로 올렸다 */

test('인원에 따라 기준선이 올라간다 (6명 53.5 · 8명 71.5)', () => {
  expect(killLineFor(6)).toBe(53.5);
  expect(killLineFor(8)).toBe(71.5);
  expect(killLineFor(10)).toBe(89.5);
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
  expect(killLineOfScrim(scrim)).toBe(53.5);
  /* 팀이 비어 있어도 터지지 않는다 */
  expect(killLineOfScrim({})).toBe(53.5);
  expect(killLineOfScrim(null)).toBe(53.5);
});

test('기준선이 그대로 마켓 이름이 되고, 다시 읽어도 같은 값이다', () => {
  const line = killLineFor(8);
  expect(killMarket(line)).toBe('kills_71.5');
  const scrim = {
    status: 'settled',
    team_a: [1, 2, 3, 4],
    team_b: [5, 6, 7, 8],
    total_kills: 72,
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
  expect(body).toContain("if not expired and not public.room_can(s.room_id, 'bet')");
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
  const body = fnBody('fb_odds') + fnBody('lock_betting');
  /* 골드(인덱스 3)를 1.00으로 두고 한 칸당 2% */
  expect(body).toContain('(3 - coalesce(t.idx, 3)) * 0.02');
  /* 조인에서 빠진 선택지도 배당이 비지 않게 채운다 */
  expect(body).toContain("market = 'first_blood' and odds is null");
});

/* ---------- 방별 지갑 (SQL 계약) ---------- */
/* 계정 하나에 잔액 하나면, 방을 새로 만들어 친구와 몰아주기만 해도
   본방 잔액이 불어난다. 이 규칙이 무너지면 조용히 인플레가 난다 */

test('끼꼬가 오가는 모든 곳이 방 지갑을 본다 (계정 잔액을 건드리지 않는다)', () => {
  /* profiles.points를 쓰는 UPDATE가 하나도 남아 있으면 안 된다 */
  expect(sql).not.toMatch(/update profiles\s+set points/);
  expect(sql).not.toMatch(/update profiles pr set points/);
});

test('지급·회수는 그 경기가 속한 방의 지갑에만 닿는다', () => {
  /* room_id 조건 없이 user_id만 보고 더하면 다른 방 잔액까지 오른다 */
  const updates = [...sql.matchAll(/update room_wallets w set points[\s\S]{0,200}?;/g)].map(
    (m) => m[0]
  );
  expect(updates.length).toBeGreaterThan(0);
  updates.forEach((u) => {
    expect(u).toContain('w.room_id = s.room_id');
    expect(u).toContain('w.user_id = x.user_id');
  });
});

test('방에 들어오면 지갑이 생긴다 (만들 때도, 코드로 들어올 때도)', () => {
  const create = fnBody('create_room');
  const join = fnBody('join_room');
  expect(create).toContain('ensure_wallet');
  expect(join).toContain('ensure_wallet');
});

test('지갑은 방마다 하나뿐이고, 다시 들어와도 초기화되지 않는다', () => {
  expect(sql).toContain('primary key (room_id, user_id)');
  expect(fnBody('ensure_wallet')).toContain('on conflict (room_id, user_id) do nothing');
});

test('잔액은 같은 방 사람만 보고, 아무도 직접 못 고친다', () => {
  expect(sql).toContain('grant select on public.room_wallets to authenticated');
  /* insert/update/delete 권한을 주면 콘솔 한 줄로 자기 잔액을 고칠 수 있다 */
  expect(sql).not.toMatch(/grant[^;]*(insert|update|delete)[^;]*on public\.room_wallets/);
  expect(sql).toContain('create policy wallets_read on public.room_wallets');
});

test('시즌 초기화도 방 지갑 기준이다', () => {
  const body = fnBody('roll_season');
  expect(body).toContain('update room_wallets set points = 10000');
  expect(body).toContain('from room_wallets w');
});

/* ---------- 멤버 ↔ 참가자 연결 ---------- */

test('연결은 방장·부방장만, 그리고 그 방 멤버에게만 걸 수 있다', () => {
  const body = fnBody('link_room_player');
  expect(body).toContain("room_can(p_room, 'member')");
  /* 남의 방 사람을 참가자에 묶으면 참여 포인트가 방 밖으로 샌다 */
  expect(body).toMatch(/room_members where room_id = p_room and user_id = p_user/);
});

test('연결을 옮길 때 옛 연결을 먼저 푼다 (한 사람이 두 참가자가 되면 포인트를 두 번 받는다)', () => {
  const body = fnBody('link_room_player');
  const clear = body.indexOf('set linked_user_id = null');
  const set = body.indexOf('set linked_user_id = p_user');
  expect(clear).toBeGreaterThan(-1);
  expect(set).toBeGreaterThan(clear);
  /* DB 쪽 잠금장치도 그대로 있어야 한다 */
  expect(sql).toContain('create unique index room_players_one_account');
});

test('이미 다른 사람이 가져간 참가자는 뺏을 수 없다', () => {
  expect(fnBody('link_room_player')).toContain(
    "raise exception '그 참가자는 이미 다른 멤버와 연결돼 있어요.'"
  );
});

test('방을 떠나면 참가자 연결도 같이 풀린다', () => {
  ['kick_member', 'leave_room'].forEach((fn) => {
    expect(fnBody(fn)).toMatch(/update room_players set linked_user_id = null/);
  });
});

test('유령 멤버는 실제 계정과 겹치지 않는 id를 받는다', () => {
  const body = fnBody('add_ghost_member');
  expect(body).toContain("'ghost:' || gen_random_uuid()");
  expect(body).toContain("room_can(p_room, 'member')");
  /* 방 인원 제한은 유령에게도 그대로 걸린다 */
  expect(body).toContain('>= 50');
});

test('유령 멤버 삭제는 유령에게만 듣는다 (진짜 계정을 지우면 안 된다)', () => {
  const body = fnBody('remove_ghost_member');
  expect(body).toMatch(/where room_id = p_room and user_id = p_user and is_ghost/);
  expect(body).toContain('delete from room_members');
  expect(body).toContain('delete from room_wallets');
});

test('유령 멤버 컬럼이 기존 방에도 추가된다', () => {
  expect(sql).toContain('alter table public.room_members add column if not exists is_ghost');
});

test('연결 함수들은 로그인한 사람에게만 열려 있다', () => {
  ['link_room_player(bigint, text, bigint)', 'add_ghost_member(bigint, text)',
   'remove_ghost_member(bigint, text)'].forEach((sig) => {
    expect(sql).toContain(`public.${sig}`);
  });
});

/* ---------- 방장의 끼꼬 조정 ---------- */

test('끼꼬 조정은 조정 권한이 있어야 한다 (기본은 방장만)', () => {
  expect(fnBody('adjust_points')).toContain("room_can(p_room, 'adjust')");
});

test('조정하면 반드시 로그가 남는다 (조용히 자기 잔액만 올릴 수 없게)', () => {
  const body = fnBody('adjust_points');
  expect(body).toMatch(/log_room\(p_room, 'adjust'/);
  /* 원장에도 남아야 '내 끼꼬 내역'에서 본인이 확인할 수 있다 */
  expect(body).toMatch(/insert into point_ledger[\s\S]*'adjust'/);
});

test('조정은 방 지갑만 건드리고 잔액이 음수가 되지 않는다', () => {
  const body = fnBody('adjust_points');
  /* 0에서 멈추되, 멈춘 만큼은 원장에도 그대로 반영된다 (아래 테스트) */
  expect(body).toContain('greatest(0, before_ + p_delta)');
  expect(body).toContain('where room_id = p_room and user_id = p_user');
});

test('한 번에 움직일 수 있는 폭에 상한이 있다 (0 하나 더 붙는 오타)', () => {
  expect(fnBody('adjust_points')).toContain('abs(p_delta) > 100000');
});

test('조정 로그는 누구를 얼마나 왜 만졌는지 다 보여준다', () => {
  const { tag, parts } = feedParts({
    type: 'adjust',
    payload: { who: '영희', delta: -1500, after: 8500, reason: '벌칙' },
  });
  expect(tag.label).toBe('조정');
  const line = parts.map((x) => x.v).join('');
  expect(line).toContain('영희');
  /* 부호(-) 대신 '올렸어요/내렸어요'로 읽는다. 훑을 때 부호는 잘 안 보인다 */
  expect(line).toContain('1,500');
  expect(line).toContain('내렸어요');
  expect(line).toContain('8,500');
  expect(line).toContain('벌칙');

  const up = feedParts({
    type: 'adjust',
    payload: { who: '철수', delta: 2000, after: 12000, reason: null },
  });
  expect(up.parts.map((x) => x.v).join('')).toContain('올렸어요');
});

/* 로그는 훑는 물건이다. 조각만 늘어놓으면 읽을 때마다 문장을 다시 만들어야 한다 */
test('로그가 문장으로 읽힌다', () => {
  const line = (log) =>
    feedParts(log)
      .parts.map((x) => x.v)
      .join('');

  expect(
    line({
      type: 'betting_open',
      created_at: '2026-09-04T12:00:00Z',
      payload: { size: 6, closes_at: '2026-09-04T12:02:00Z' },
    })
  ).toBe('6인 내전에 또또가 열렸어요 · 2분 뒤 자동 마감');

  expect(line({ type: 'betting_locked', payload: { people: 8, total: 3500 } })).toBe(
    '또또 마감 · 8명이 3,500 끼꼬를 걸었어요'
  );

  expect(line({ type: 'settle_undone', payload: { count: 2 } })).toBe(
    '방장이 정산을 되돌렸어요 (2번째)'
  );
});

/* ---------- 방 상세 조회 ---------- */

/* 여기서 컬럼을 빼먹으면 화면이 조용히 틀린 값을 보여준다. 오류도 안 난다.
   실제로 kill_line을 빼먹어서, 방장이 직접 정한 기준선이 저장은 되는데
   화면은 인원으로 계산한 값을 계속 쓰고 있었다 */
test('방을 읽을 때 화면이 쓰는 컬럼을 다 읽는다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  const select = src.slice(src.indexOf('const ROOM_SELECT'), src.indexOf('const POLL_MS'));
  [
    'status',
    'bet_count',
    /* 없으면 마감 타이머가 아예 안 그려진다 */
    'betting_closes_at',
    /* 없으면 방장이 정한 기준선이 무시된다 */
    'kill_line',
    /* 없으면 유령 멤버 표시가 안 뜬다 */
    'is_ghost',
    /* 없으면 지운 참가자의 지난 경기 이름이 빠진다 */
    'deleted_at',
    /* 없으면 방 색·엠블럼·게임이 기본값으로 보인다 */
    'accent',
    'emblem',
    'game',
  ].forEach((col) => {
    expect(select).toContain(col);
  });
});

/* 렌더 함수 안에서 컴포넌트를 정의하면 렌더마다 타입이 달라져서 React가
   그 아래를 통째로 다시 마운트한다. 스크롤이 맨 위로 튀고 입력 포커스가
   날아간다. 두 번 겪었으니 소스에서 못 들어오게 막아둔다 */
test('BetTab은 렌더 안에서 컴포넌트를 정의하지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'rooms', 'BetTab.jsx'), 'utf8');
  const body = src.slice(src.indexOf('const BetTab = ('));
  const inner = [...body.matchAll(/^ {2}const ([A-Z]\w*) = \(/gm)].map((m) => m[1]);
  expect(inner).toEqual([]);
});

/* ---------- 방 탭 ---------- */

/* useState에만 담아두면 새로고침할 때마다 첫 탭으로 돌아간다.
   또또를 보다 새로고침하면 게임 시작 탭이 뜨던 버그 */
test('방 탭은 주소에 남는다 (새로고침해도 보던 탭)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'rooms', 'Room.jsx'), 'utf8');
  expect(src).not.toMatch(/const \[tab, setTab\] = useState/);
  expect(src).toContain('location.hash');
  /* 뒤로 가기가 탭을 되짚으면 방을 빠져나가는 데 일곱 번 눌러야 한다 */
  expect(src).toMatch(/navigate\([^)]*\{ replace: true \}\)/);
});

/* ---------- 방 목록 ---------- */

test('방 목록은 필요한 만큼만 읽는다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  const body = src.slice(src.indexOf('export const useMyRooms'), src.indexOf('export const useRoom'));
  /* 끝난 경기까지 다 읽어오면 방 목록 한 번 여는 데 수백 줄이 딸려온다 */
  expect(body).toMatch(/\.in\('status', \['betting', 'locked'\]\)/);
  /* '최근 플레이순'에 쓸 마지막 판도 방마다 묻지 않고 한 묶음만 */
  expect(body).toContain('.limit(200)');
  expect(body).toContain('lastPlayed');
});

/* 핀·진행 중·고른 순서가 섞이는 자리라 한 곳에서만 정한다 */
describe('방 목록 순서', () => {
  const { sortRooms } = require('../lib/roomPrefs');
  const room = (over) => ({
    id: 1, name: '가', memberCount: 1, myPoints: 0, live: null, lastPlayed: 0, ...over,
  });

  test('핀이 제일 위, 그 다음이 또또 진행 중', () => {
    const rows = [
      room({ id: 1, name: '가' }),
      room({ id: 2, name: '나', live: 'betting' }),
      room({ id: 3, name: '다' }),
    ];
    expect(sortRooms(rows, 'name', [3]).map((r) => r.id)).toEqual([3, 2, 1]);
  });

  test('고른 기준으로 센다', () => {
    const rows = [
      room({ id: 1, name: '가', myPoints: 100, memberCount: 9, lastPlayed: 10 }),
      room({ id: 2, name: '나', myPoints: 900, memberCount: 2, lastPlayed: 30 }),
      room({ id: 3, name: '다', myPoints: 500, memberCount: 5, lastPlayed: 20 }),
    ];
    expect(sortRooms(rows, 'kkiko', []).map((r) => r.id)).toEqual([2, 3, 1]);
    expect(sortRooms(rows, 'members', []).map((r) => r.id)).toEqual([1, 3, 2]);
    expect(sortRooms(rows, 'played', []).map((r) => r.id)).toEqual([2, 3, 1]);
    expect(sortRooms(rows, 'name', []).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  /* 한 판도 안 한 방은 맨 뒤로. 0으로 두면 이름순에 섞인다 */
  test('모르는 기준이 오면 기본 순서로 센다', () => {
    const rows = [room({ id: 1, lastPlayed: 5 }), room({ id: 2, name: '나', lastPlayed: 9 })];
    expect(sortRooms(rows, '없는기준', []).map((r) => r.id)).toEqual([2, 1]);
  });
});

/* ---------- 끼꼬 내역 ---------- */

test('끼꼬 내역도 한 쪽씩 끊어서 본다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  const body = src.slice(src.indexOf('export const fetchLedger'));
  expect(body.slice(0, 400)).toContain("q.lt('id', beforeId)");
  expect(src).toMatch(/export const LEDGER_PAGE = \d+/);
});

/* ---------- 새로고침 실패 ---------- */

/* 정산 직후처럼 요청이 몰릴 때 하나만 어긋나도 방이 통째로 사라져서,
   목록으로 나갔다 다시 들어와야 했다 */
test('한 번 못 읽었다고 들고 있던 방을 버리지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  const body = src.slice(src.indexOf('const useFetch ='), src.indexOf('export const useMe'));

  /* 예전엔 catch에서 data를 통째로 null로 밀어버렸다 */
  expect(body).not.toMatch(/catch[\s\S]{0,200}setState\(\{ loading: false, data: null/);
  expect(body).toContain('if (s.data !== null)');
  /* 잠시 뒤 다시 시도하고, 무한히 두드리지는 않는다 */
  expect(body).toContain('fails.current <= MAX_RETRIES');
});

test('방 코드는 눌러서 복사한다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'rooms', 'Room.jsx'), 'utf8');
  expect(src).toContain('copyText');
  /* 아직 안 열어본 상태에서 눌러도 받아와서 복사해야 한다 */
  expect(src).toMatch(/code \|\| \(await getJoinCode\(room\.id\)\)/);
});

/* Neon 무료 플랜은 놀고 있으면 컴퓨트를 재운다. 깨어나는 첫 요청이 끊기면
   '아직 들어간 방이 없어요'가 떠서, 새로고침해야만 방이 보였다 */
test('첫 조회가 실패하면 다시 시도하는 동안 계속 읽는 중이다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  const body = src.slice(src.indexOf('const useFetch ='), src.indexOf('export const useMe'));

  /* 다시 시도할 참이면 loading을 내리지 않는다 = 빈 목록으로 보이지 않는다 */
  expect(body).toContain('loading: again');
  expect(body).toContain('error: again ? null : e.message');
  /* 로그인 확인이 끝나 enabled가 켜지는 한 렌더 동안에도 빈 화면이 보였다 */
  expect(body).toMatch(/enabled && state\.data === null && state\.error === null/);
});

test("방 목록은 '못 읽었음'과 '방이 없음'을 다르게 보여준다", () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'rooms', 'RoomList.jsx'), 'utf8');
  expect(src).toContain('방 목록을 불러오지 못했어요');
  /* 오류일 때 빈 상태 문구가 같이 뜨면 방을 다 잃은 것처럼 보인다 */
  const empty = src.indexOf('아직 들어간 방이 없어요');
  const err = src.indexOf('방 목록을 불러오지 못했어요');
  expect(err).toBeGreaterThan(-1);
  expect(err).toBeLessThan(empty);
});

/* ---------- 방 색·엠블럼 ---------- */

test('방 색은 정해둔 목록에서만 고를 수 있다 (DB가 막는다)', () => {
  /* 화면에서만 막으면 콘솔 한 줄로 아무 CSS 값이나 넣을 수 있다 */
  expect(sql).toContain('rooms_accent_chk');
  expect(sql).toMatch(/check \(accent in \('gold', 'blue', 'green', 'purple', 'red', 'cyan'\)\)/);
  expect(sql).toContain('rooms_emblem_chk');
});

test('색과 엠블럼은 읽고 쓸 수 있게 열려 있다', () => {
  const grant = sql.match(/grant select \(([^)]+)\) on public\.rooms/);
  expect(grant[1]).toContain('accent');
  expect(grant[1]).toContain('emblem');
  expect(sql).toContain('grant update (name, accent, emblem) on public.rooms');
});

/* ---------- 방 기록 경신 ---------- */

test('기록이 깨지면 로그에 남는다', () => {
  const body = fnBody('settle_scrim');
  expect(body).toMatch(/log_room\(s\.room_id, 'record'/);
  /* 방금 넣은 경기를 빼고 견줘야 자기 자신을 이길 수 없다 */
  expect(body).toMatch(/id <> p_scrim/);
});

test('신기록 로그가 문장으로 읽힌다', () => {
  const { tag, parts } = feedParts({
    type: 'record',
    payload: { kind: 'kills', value: 81, prev: 74 },
  });
  expect(tag.label).toBe('신기록');
  const line = parts.map((x) => x.v).join('');
  expect(line).toContain('한 판 최다 킬');
  expect(line).toContain('81');
  expect(line).toContain('74');

  const first = feedParts({ type: 'record', payload: { kind: 'bet', value: 5000, prev: null } });
  expect(first.parts.map((x) => x.v).join('')).toContain('첫 기록');
});

/* ---------- 경기 취소 / 삭제 ---------- */

/* 예전엔 배팅이 걸리면 아예 못 지웠다. 잘못 연 또또를 취소할 길이 없어서
   가짜 결과를 넣어 정산해야만 다음 판으로 넘어갈 수 있었다 */
test('배팅이 걸린 경기도 방장이면 취소할 수 있다', () => {
  const body = fnBody('delete_scrim');
  expect(body).not.toContain('배팅이 걸린 경기는 지울 수 없어요');
  expect(body).toContain('배팅이 걸린 경기는 방장만 취소할 수 있어요');
  /* 돈이 안 걸린 기록은 부방장도 그대로 지운다 */
  expect(body).toContain('기록을 지울 권한이 없어요');
});

/* 되돌리는 몸통은 rollback_scrim으로 옮겼다. 방장 취소와 관리자 취소가
   같은 길을 써야 한쪽만 고쳐서 끼꼬가 어긋나는 일이 없다 */
test('취소하면 건 돈·지급·참여 포인트를 전부 되돌린다', () => {
  const body = fnBody('rollback_scrim');
  expect(body).toMatch(/reason in \('bet', 'payout', 'scrim'\)/);
  /* 이미 뒤집힌 줄을 또 뒤집으면 두 배로 돌아간다 */
  expect(body).toContain('reversed_at is null');
});

test('취소는 로그에 남는다 (남의 돈이 오간 일이다)', () => {
  expect(fnBody('delete_scrim')).toMatch(/log_room\(s\.room_id, 'scrim_cancelled'/);

  const { tag, parts } = feedParts({
    type: 'scrim_cancelled',
    payload: { people: 8, refund: 3500, status: 'betting' },
  });
  expect(tag.label).toBe('취소');
  const line = parts.map((x) => x.v).join('');
  expect(line).toContain('8명');
  expect(line).toContain('3,500');
  expect(line).toContain('환불');
});

/* ---------- 화면과 DB가 같은 숫자를 보는가 ---------- */

/* 굴려보고 정하는 값은 tuning.js에 모아뒀는데, 그중 몇 개는 DB에도
   같은 숫자가 박혀 있다. 한쪽만 고치면 "3,000까지 걸 수 있어요"라고
   해놓고 서버가 거절하는 꼴이 된다 */
/* 한쪽만 바꾸면 화면에서는 "3,000까지" 라고 해놓고 서버가 거절한다.
   BET_CAP에 마켓을 추가하면 여기서 DB 쪽도 같이 고쳤는지 본다 */
test('배팅 상한이 tuning.js와 DB에서 같다', () => {
  const { BET_CAP } = require('../rules/tuning');
  const body = fnBody('place_bets');
  const sqlOf = {
    winner: "= 'winner' then",
    first_blood: "= 'first_blood' then",
    kills: "like 'kills%' then",
    /* 일반 게임 또또 */
    kills_parity: "like 'kills%' then",
    fb_side: "= 'fb_side' then",
    dragon: "= 'dragon' then",
    team_kills: "like 'ourkills%' then",
  };
  /* 상대 팀 킬도 같은 상한 */
  expect(body).toContain(`like 'oppkills%' then ${BET_CAP.team_kills}`);

  Object.entries(BET_CAP).forEach(([market, cap]) => {
    expect(sqlOf[market]).toBeDefined();
    expect(body).toContain(`${sqlOf[market]} ${cap === null ? 'null' : cap}`);
  });
});

test('상한 없는 마켓은 capOf가 null을 준다', () => {
  const { capOf, killMarket } = require('./rooms');
  const { BET_CAP } = require('../rules/tuning');
  expect(capOf('winner')).toBe(BET_CAP.winner);
  expect(capOf('first_blood')).toBe(BET_CAP.first_blood);
  expect(capOf(killMarket(45.5))).toBe(BET_CAP.kills);
  expect(capOf('없는마켓')).toBeNull();
});

test('배당이 tuning.js와 DB에서 같다', () => {
  const tuning = require('../rules/tuning');
  expect(fnBody('fb_odds')).toContain(`n * ${tuning.FIRST_BLOOD_RATE}`);
  expect(fnBody('fb_odds')).toContain(`* ${tuning.FIRST_BLOOD_TIER_BONUS}`);
  const body = fnBody('lock_betting');
  /* 언더오버 쪽은 바로 위 '몰린 만큼만 움직인다' 테스트가 대조한다 */
  expect(body).toContain(`then ${tuning.KILLS_ODDS}`);
});

test('참여 보상과 시즌 초기화 값이 tuning.js와 DB에서 같다', () => {
  const tuning = require('../rules/tuning');
  expect(fnBody('award_participation')).toContain(
    `then ${tuning.SCRIM_REWARD.win} else ${tuning.SCRIM_REWARD.lose}`
  );
  expect(fnBody('roll_season')).toContain(`points = ${tuning.MONTHLY_KKIKO}`);
  expect(fnBody('adjust_points')).toContain(`> ${tuning.ADJUST_CAP}`);
});

test('setup.sql 첫머리가 고칠 만한 숫자들이 어디 있는지 알려준다', () => {
  const head = sql.slice(0, 2000);
  expect(head).toContain('src/tuning.js');
  ['place_bets', 'lock_betting', 'award_participation', 'roll_season'].forEach((fn) => {
    expect(head).toContain(fn);
  });
});

/* 명단에서 지웠던 사람을 다시 넣으면 새 사람이 되어버려서, 지난 경기에서
   그 사람이 사라지고 전적도 갈렸다. 그 행을 되살려 써야 한다 */
test('지웠던 참가자는 새로 만들지 않고 되살려 쓴다', async () => {
  responses['room_players.select'] = (s) => (s.not ? [{ id: 42, name: '지훈' }] : null);

  await addScrimByNames({
    roomId: 7,
    mode: 'normal',
    teamA: ['철수', '지훈'],
    teamB: ['영희'],
    winner: 'A',
    players,
  });

  /* 새로 넣지 않는다 */
  expect(calls.filter((c) => c.table === 'room_players' && c.op === 'insert')).toHaveLength(0);
  /* 지운 표시만 지운다 */
  const [revived] = calls.filter((c) => c.table === 'room_players' && c.op === 'update');
  expect(revived.payload).toEqual({ deleted_at: null });
  /* 그리고 옛 id를 그대로 쓴다 */
  expect(rpcCalls[0].args.p_team_a).toEqual([1, 42]);
});

test('참가자 삭제는 행을 지우지 않고 표시만 남긴다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  const body = src.slice(src.indexOf('export const removeRoomPlayer'), src.indexOf('/* ---------- 경기'));
  expect(body).not.toContain('.delete()');
  expect(body).toContain('deleted_at');
});

test('경기 이름표는 지운 참가자까지 보고 붙인다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  /* 명단(players)에는 안 보여도, 지난 경기의 이름은 붙어야 한다 */
  expect(src).toContain('toMatches(room?.scrims, allPlayers, room?.game)');
  expect(src).toMatch(/const players = allPlayers\.filter\(\(p\) => !p\.deleted_at\)/);
});

test('총 킬 기준선은 방장이 정했으면 그 값을 쓴다', () => {
  expect(killLineOfScrim({ kill_line: '61.5', team_a: [1, 2, 3], team_b: [4, 5, 6] })).toBe(61.5);
  /* 안 정했으면 인원으로 계산한다 */
  expect(killLineOfScrim({ team_a: [1, 2, 3], team_b: [4, 5, 6] })).toBe(53.5);
});

test('직접 정한 기준선은 경기에 박아둔다 (나중에 명단이 바뀌어도 안 흔들리게)', () => {
  expect(sql).toContain('alter table public.scrims add column if not exists kill_line');
  const body = fnBody('open_betting');
  expect(body).toContain('p_kill_line');
  /* .5로 안 끝나면 무승부가 생긴다 */
  expect(body).toContain("raise exception '총 킬 기준선은 53.5처럼 .5로 끝나야 해요.'");
});

/* ---------- 관리자 ---------- */
/* 방을 넘나드는 값이라 RLS로는 막을 수 없다. 함수 안의 검사가 유일한 문이고,
   함수를 하나 더 만들면서 그 줄을 빼먹는 게 가장 그럴듯한 사고다 */

test('admin_ 으로 시작하는 함수는 전부 관리자인지 먼저 확인한다', () => {
  const names = [...sql.matchAll(/create or replace function public\.(admin_\w+)/g)]
    .map((m) => m[1])
    /* admin_id()는 상수를 돌려주는 것뿐이라 지킬 게 없다 */
    .filter((n) => n !== 'admin_id');
  expect(names.length).toBeGreaterThan(0);
  names.forEach((n) => {
    expect(fnBody(n)).toContain('require_site_admin()');
  });
});

test('관리자 여부는 DB의 profiles.role만 본다', () => {
  const body = fnBody('is_site_admin');
  expect(body).toContain("role = 'admin'");
  expect(body).toContain('auth.user_id()');
});

/* 마지막 관리자가 자기를 내리면 앱에서는 되돌릴 방법이 없다 */
test('자기 권한은 앱에서 못 바꾼다', () => {
  expect(fnBody('set_site_role')).toContain('p_user = auth.user_id()');
});

test('시즌 강제 초기화는 없다 (달 확인만 밀어준다)', () => {
  const body = fnBody('admin_roll_season');
  expect(body).toContain('roll_season()');
  /* 여기서 직접 points를 만지면 모두의 끼꼬가 한 번에 날아간다 */
  expect(body).not.toMatch(/update\s+(public\.)?(profiles|room_wallets)/);
});

/* rollback_scrim은 권한 검사가 없다. 돈을 움직이는 함수를 열어두는 셈이라,
   아무도 직접 못 부르는지와 부르는 쪽이 전부 검사하는지를 같이 본다 */
test('환불 몸통은 직접 부를 수 없고, 부르는 쪽이 권한을 본다', () => {
  expect(sql).toContain('revoke execute on function public.rollback_scrim(bigint) from public;');
  expect(sql).not.toMatch(/grant execute on function[^;]*rollback_scrim/);

  expect(fnBody('delete_scrim')).toContain('is_room_owner');
  expect(fnBody('admin_cancel_scrim')).toContain('require_site_admin()');
});

/* 관리자는 그 게임을 안 봤다. 승패를 대신 정하면 또또가 통째로 뒤집힌다 */
test('관리자 취소는 환불만 한다 (결과를 넣지 않는다)', () => {
  const body = fnBody('admin_cancel_scrim');
  expect(body).toContain("if s.status = 'settled' then");
  expect(body).not.toMatch(/set\s+winner\s*=/);
});

/* 시즌 초기화는 지연 실행이라 5일에 돌 수도 있다. 달의 1일로 자르면
   1~5일 기록이 초기화 이전 것인데 이번 시즌으로 세어버린다 */
test('정합성 검사는 마지막 초기화 시각을 기준으로 자른다', () => {
  const body = fnBody('admin_audit_wallets');
  expect(body).toContain('rolled_at into cut');
  expect(body).toContain('created_at > cut');
});

/* 지갑이 0에서 멈췄는데 원장에는 전액이 적히면 둘이 영영 어긋나고,
   정합성 검사가 그 방을 계속 빨갛게 띄운다 */
test('끼꼬 조정은 실제로 깎인 만큼만 원장에 적는다', () => {
  const body = fnBody('adjust_points');
  expect(body).toContain('applied := greatest(0, before_ + p_delta) - before_;');
  /* 원장에 p_delta를 그대로 적으면 안 된다 */
  expect(body).toMatch(/values \(p_user, p_room, applied, 'adjust'/);
  expect(body).not.toMatch(/values \(p_user, p_room, p_delta, 'adjust'/);
});

/* ---------- 게임 (롤 / 발로란트) ---------- */

test('방은 게임을 하나 들고 있고, 정해둔 것만 받는다', () => {
  expect(sql).toContain('alter table public.rooms add column if not exists game');
  expect(sql).toMatch(/check \(game in \('lol', 'valorant'\)\)/);
  /* 예전에 만든 방은 전부 롤이다 */
  expect(sql).toMatch(/game text not null default 'lol'/);
});

test('방을 만들 때 게임을 고른다', () => {
  const body = fnBody('create_room');
  expect(body).toContain('p_game');
  expect(body).toContain("raise exception '그런 게임은 없어요.'");
  /* 인자가 늘면 옛 함수가 남아 PostgREST가 못 고른다 */
  expect(sql).toContain('drop function if exists public.create_room(text);');
  expect(sql).toContain('public.create_room(text, text)');
});

test('게임을 읽을 수 있게 컬럼이 열려 있다', () => {
  const grant = sql.match(/grant select \(([^)]+)\) on public\.rooms/);
  expect(grant[1]).toContain('game');
});

/* 퍼블 배당 보정은 '골드보다 몇 칸 아래인가'를 센다.
   두 게임의 티어 이름이 달라서 사다리도 갈라야 한다 */
test('퍼블 배당 보정이 게임별 티어 사다리를 본다', () => {
  expect(fnBody('fb_odds')).toContain('public.tier_ladder(rm.game)');
  expect(fnBody('tier_ladder')).toContain('ASCENDANT');
  expect(fnBody('tier_ladder')).toContain('EMERALD');
  /* 사다리를 보는 건 이제 fb_odds 하나뿐이다 */
});

test('두 사다리 모두 골드가 네 번째다 (보정식이 공용이라)', () => {
  const body = fnBody('tier_ladder');
  const arrays = [...body.matchAll(/array\[([^\]]+)\]/g)].map((m) =>
    m[1].split(',').map((x) => x.trim().replace(/'/g, ''))
  );
  expect(arrays.length).toBe(2);
  arrays.forEach((a) => expect(a.indexOf('GOLD')).toBe(3));
});

/* 어느 게임이 더 많이 나오는지는 굴려보고 정하는 값이라 박지 않는다.
   처음엔 '발로란트는 라운드제라 적다'고 적어뒀는데, 재보니 13선승까지
   가는 판은 롤보다 총 킬이 많았다. 가정이 아니라 값이 기준이다 */
test('킬 기준선은 게임마다 다르다', () => {
  expect(killLineFor(10, 'lol')).not.toBe(killLineFor(10, 'valorant'));
  /* 게임을 안 넘기면 롤로 본다 */
  expect(killLineFor(10)).toBe(killLineFor(10, 'lol'));
  /* 무승부가 없게 .5로 끊는 건 양쪽 다 */
  expect(killLineFor(10, 'lol') % 1).toBe(0.5);
  expect(killLineFor(10, 'valorant') % 1).toBe(0.5);
});

/* ---------- 모드 ---------- */

test('모드는 게임에 있는 것만 받는다', () => {
  expect(sql).toContain("check (mode in ('normal', 'aram', 'standard', 'swift', 'brawl'))");
  const v = fnBody('valid_mode');
  expect(v).toContain("p_mode in ('standard', 'swift', 'brawl')");
  /* 옛 칼바람 기록은 그대로 받아준다 */
  expect(v).toContain("p_mode in ('normal', 'aram')");
});

test('표를 만들 때 붙은 옛 mode 제약을 찾아서 뗀다', () => {
  /* 인라인 CHECK라 이름을 모른다. 이름으로 drop하면 안 지워진다 */
  expect(sql).toContain("pg_get_constraintdef(oid) ilike '%mode%'");
});

test('경기를 남기거나 또또를 열 때 모드를 검사한다', () => {
  ['record_scrim', 'open_betting'].forEach((fn) => {
    expect(fnBody(fn)).toContain('public.valid_mode((select game from rooms where id = p_room)');
  });
});

test('킬 기준선이 모드마다 다르다', () => {
  /* 난투는 킬만 주고받아 제일 많고, 신속은 5선취라 제일 적다 */
  /* 어느 모드가 더 많이 나오는지는 굴려보고 정하는 값이라 박지 않는다.
     짧은 판이 긴 판보다 적다는 것만 지킨다 */
  expect(killLineFor(10, 'valorant', 'swift')).toBeLessThan(
    killLineFor(10, 'valorant', 'standard')
  );
  /* 모드마다 다른 기준선이 나와야 나누는 뜻이 있다 */
  const lines = ['standard', 'swift', 'brawl'].map((m) => killLineFor(6, 'valorant', m));
  expect(new Set(lines).size).toBe(lines.length);
  /* 어느 조합이든 무승부가 없게 .5로 끊는다 */
  ['standard', 'swift', 'brawl'].forEach((m) => {
    expect(killLineFor(6, 'valorant', m) % 1).toBe(0.5);
  });
});

test('경기에 박아둔 기준선이 있으면 모드보다 그게 먼저다', () => {
  const scrim = { kill_line: '30.5', mode: 'brawl', team_a: [1], team_b: [2] };
  expect(killLineOfScrim(scrim, 'valorant')).toBe(30.5);
  /* 안 박아뒀으면 그 경기의 모드로 계산한다 */
  expect(killLineOfScrim({ mode: 'swift', team_a: [1, 2, 3, 4, 5], team_b: [6, 7, 8, 9, 10] }, 'valorant')).toBe(
    killLineFor(10, 'valorant', 'swift')
  );
});

/* 전부 초록으로 두면 취소 로그가 축하처럼 보인다 */
describe('로그 색', () => {
  const kinds = (log) => feedParts(log).parts.map((x) => x.k);

  test('되돌리기·취소는 빨강으로 세운다', () => {
    expect(kinds({ type: 'settle_undone', payload: { count: 1 } })).toContain('bad');
    expect(
      kinds({ type: 'scrim_cancelled', payload: { people: 3, refund: 900, status: 'betting' } })
    ).toContain('bad');
  });

  test('끼꼬 조정은 방향에 따라 색이 갈린다', () => {
    const up = { type: 'adjust', payload: { who: '철수', delta: 1000, after: 11000 } };
    const down = { type: 'adjust', payload: { who: '철수', delta: -1000, after: 9000 } };
    expect(kinds(up)).toContain('hot');
    expect(kinds(up)).not.toContain('bad');
    expect(kinds(down)).toContain('bad');
    expect(kinds(down)).not.toContain('hot');
  });

  test('경기 결과와 신기록은 초록·금색 그대로다', () => {
    expect(kinds({ type: 'settled', payload: { winner: 'A' } })).toContain('hot');
    expect(kinds({ type: 'record', payload: { kind: 'kills', value: 50 } })).toContain('hot');
  });
});

/* 계산에 쓰는 숫자(KILLS_PER_PLAYER)는 굴려보고 고치는 값이다.
   지난 기록의 기준선을 그걸로 다시 계산하면, 53.5로 걸었던 판이
   62.5로 보이면서 오버가 언더로 뒤집힌다 */
test('지난 기록의 기준선은 저장된 값만 쓴다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  const body = src.slice(src.indexOf('export const toMatches'));
  expect(body).toContain('s.kill_line == null ? null : Number(s.kill_line)');
  /* 여기서 다시 계산하면 안 된다 */
  expect(body.slice(0, body.indexOf('};'))).not.toContain('killLineOfScrim');
});

test('마감할 때 그 판에 쓴 기준선을 박아둔다', () => {
  const body = fnBody('lock_betting');
  expect(body).toContain('if s.kill_line is null then');
  /* 실제로 쓴 값은 마켓 이름에 들어 있다 (kills_53.5) */
  expect(body).toContain("split_part(bp.market, '_', 2)::numeric");
});

test('이미 지나간 판도 마켓 이름에서 되살린다', () => {
  expect(sql).toContain('update public.scrims s');
  expect(sql).toMatch(/set kill_line = x\.line[\s\S]*where s\.id = x\.scrim_id and s\.kill_line is null;/);
});

/* 한참 내려보다 다른 탭으로 넘어가면 새 화면의 중간에 떨어진다.
   주소를 #으로 바꾸므로 브라우저가 알아서 올려주지 않는다 */
test('탭을 옮기면 맨 위부터 본다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'rooms', 'Room.jsx'), 'utf8');
  const body = src.slice(src.indexOf('const setTab'), src.indexOf('const editable'));
  expect(body).toContain('window.scrollTo');
});

/* ---------- 퍼블 확률 ---------- */

const fbGame = (roster, fb, status = 'settled') => ({
  status,
  team_a: roster.slice(0, roster.length / 2),
  team_b: roster.slice(roster.length / 2),
  first_blood_player_id: fb,
});

test('퍼블을 안 적은 판은 분모에서 뺀다', () => {
  /* 넣어두면 모두의 확률이 실제보다 낮게 나온다 */
  const rates = firstBloodRates([
    fbGame([1, 2], 1),
    fbGame([1, 2], null),
    fbGame([1, 2], 1, 'betting'),
  ]);
  expect(rates.get(1).games).toBe(1);
  expect(rates.get(1).got).toBe(1);
});

test('한 판 1퍼블을 100%라고 하지 않는다 (판수 보정)', () => {
  const one = firstBloodRates([fbGame([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1)]).get(1);
  expect(one.rate).toBeLessThan(0.5);
  /* 아무나 딸 확률(10%)보다는 높아야 한다 - 땄으니까 */
  expect(one.rate).toBeGreaterThan(0.1);
});

test('판이 쌓이면 실제 비율로 다가간다', () => {
  const roster = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const many = Array.from({ length: 40 }, (_, i) => fbGame(roster, i % 2 === 0 ? 1 : 2));
  const r = firstBloodRates(many).get(1);
  expect(r.games).toBe(40);
  expect(r.got).toBe(20);
  expect(r.rate).toBeGreaterThan(0.4);
  expect(r.rate).toBeLessThan(0.5);
});

test('한 번도 못 딴 사람은 0보다 낮게 내려가지 않는다', () => {
  const roster = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = firstBloodRates(Array.from({ length: 30 }, () => fbGame(roster, 1))).get(5);
  expect(r.got).toBe(0);
  expect(r.rate).toBeGreaterThan(0);
  expect(r.rate).toBeLessThan(0.05);
});

/* ---------- 같은 사람 합치기 ---------- */

test('합치기는 경기가 들고 있는 id까지 갈아끼운다', () => {
  const body = fnBody('merge_room_players');
  /* 이름만 고치면 지난 경기는 여전히 옛 줄을 가리킨다 */
  expect(body).toContain('set team_a = public.merge_ids(team_a, p_drop, p_keep)');
  expect(body).toContain('team_b = public.merge_ids(team_b, p_drop, p_keep)');
  expect(body).toContain('set first_blood_player_id = p_keep');
  /* 지우지 않고 감춘다 - 다른 데서 아직 id를 본다 */
  expect(body).toContain('update room_players set deleted_at = now()');
});

test('서로 맞붙은 적이 있으면 합치기를 막는다 (같은 사람이 아니다)', () => {
  const body = fnBody('merge_room_players');
  expect(body).toContain(
    'public.has_player(team_a, p_keep) and public.has_player(team_b, p_drop)'
  );
  expect(body).toMatch(/if clash > 0 then[\s\S]{0,40}raise exception/);
});

test('합치기는 방장·부방장만', () => {
  expect(fnBody('merge_room_players')).toContain("if not public.room_can(r, 'roster') then");
});

/* 배당을 실시간으로 보여주면 마감 직전에 유리한 쪽으로 몰린다.
   그래서 마감 전에는 남의 배팅 줄 자체가 안 보이는데, '누가 걸었는지'는
   알아야 방장이 마감할 때를 안다. 이름만 나가야 한다 */
test('마감 전에 나가는 건 이름뿐이다 (무엇에 얼마는 빼고)', () => {
  const body = fnBody('scrim_bettors');
  expect(body).toContain('array_agg(distinct b.user_id) from bets b');
  /* setof 스칼라를 PostgREST가 어떻게 감싸는지에 기대면 이름이 조용히
     '알 수 없음'이 된다. 배열 하나로 돌려준다 */
  expect(body).toContain('returns text[]');
  expect(body).not.toMatch(/selection|amount/);
  expect(body).toContain('if not public.is_room_member(r) then');
});

/* setup.sql은 여기서 실행해볼 수가 없다. 그래서 구문 오류 하나가
   "DB에 이 기능이 아직 없어요"로만 보이고, 원인을 찾는 데 왕복이 한 번 든다.
   실제로 있었던 일: 변수를 both로 이름 지었는데 그게 예약어라
   (trim(both ...)) 함수가 생성되지 않았고, 스크립트가 거기서 멈춰서
   맨 끝의 grant와 notify pgrst까지 못 돌았다 - 뒤에 붙인 기능이 전부
   조용히 없는 상태가 됐다. 적어도 이 부류는 여기서 잡는다 */
const PG_RESERVED = new Set(
  `all analyse analyze and any array as asc asymmetric both case cast check collate
   column constraint create current_catalog current_date current_role current_time
   current_timestamp current_user default deferrable desc distinct do else end except
   false fetch for foreign from grant group having in initially intersect into lateral
   leading limit localtime localtimestamp not null offset on only or order placing
   primary references returning select session_user some symmetric table then to
   trailing true union unique user using variadic when where window with`.split(/\s+/)
);

test('plpgsql 변수 이름에 예약어를 쓰지 않는다', () => {
  const bad = [];
  /* 함수 본문은 $fn$ ... $fn$ 사이에 있다 */
  const bodies = sql.split('$fn$').filter((_, i) => i % 2 === 1);
  bodies.forEach((body) => {
    const d = body.search(/\bdeclare\b/i);
    if (d === -1) return;
    const b = body.toLowerCase().indexOf('begin', d);
    if (b === -1) return;
    body
      .slice(d + 'declare'.length, b)
      .replace(/--[^\n]*/g, '')
      .split(';')
      .forEach((line) => {
        const name = (line.trim().match(/^([a-z_][\w]*)/i) || [])[1];
        if (name && PG_RESERVED.has(name.toLowerCase())) bad.push(name);
      });
  });
  expect(bad).toEqual([]);
});

/* scrims.team_a/team_b는 jsonb 배열이다. bigint[]로 착각해서 = any(team_a)를
   쓰면 실행할 때 "op ANY/ALL (array) requires array on right side"가 난다.
   파일만 봐서는 멀쩡해 보이고, 합치기를 눌러야 알 수 있었다 */
test('jsonb 컬럼에 배열 연산자를 쓰지 않는다', () => {
  const bare = sql.replace(/--[^\n]*/g, '');
  expect(bare).not.toMatch(/any\s*\(\s*team_[ab]\s*\)/i);
  /* 꺼내 쓰는 방식은 이 둘뿐이다 */
  expect(bare).toMatch(/jsonb_array_elements_text\(\s*(coalesce\(a|s\.team_a)/);
});

/* ---------- 내보내면서 끼꼬 넘기기 ---------- */
/* 남의 돈이 오가는 길이다. 여기가 틀리면 끼꼬가 사라지거나 늘어난다 */

/* 지갑을 옮기는 규칙은 내보내기와 계정 옮기기가 같이 쓴다 (move_surplus).
   두 벌로 두면 한쪽만 고쳐서 끼꼬가 새거나 늘어난다 */
test('처음 받은 몫은 넘기지 않는다 (계정을 새로 만들어 찍어내는 길이 된다)', () => {
  const tuning = require('../rules/tuning');
  expect(fnBody('move_surplus')).toContain(`greatest(0, points - ${tuning.MONTHLY_KKIKO})`);
});

test('잔액을 잠그고 읽는다 (안 잠그면 같은 잔액을 두 번 보고 두 번 넘긴다)', () => {
  expect(fnBody('move_surplus')).toMatch(
    /from room_wallets where room_id = p_room and user_id = p_from for update/
  );
});

test('넘긴 끼꼬는 양쪽 원장에 남는다', () => {
  const body = fnBody('move_surplus');
  expect(body).toContain("(p_from, p_room, -moved, 'transfer_out', p_to)");
  /* 위쪽 sql은 공백을 한 칸으로 줄여 읽는다 (SQL의 줄맞춤에 안 매이게) */
  expect(body).toContain("(p_to, p_room, moved, 'transfer_in', p_from)");
  /* 피드에도 남는다 - 방장이 조용히 남의 끼꼬를 옮길 수 있으면 안 된다 */
  expect(fnBody('kick_member')).toContain("log_room(p_room, 'member_kicked'");
  expect(fnBody('transfer_account')).toContain("log_room(p_room, 'account_moved'");
});

test('받을 사람이 이 방 멤버인지, 자기 자신이 아닌지 본다', () => {
  const body = fnBody('kick_member');
  expect(body).toContain('if p_to = p_user then');
  expect(body).toMatch(/where room_id = p_room and user_id = p_to\) then\s*\n\s*raise exception/);
});

test('끼꼬를 안 넘겨도 내보내진다 (p_to는 없어도 된다)', () => {
  expect(sql).toContain('p_room bigint, p_user text, p_to text default null');
  /* 인자를 늘리면 옛 함수가 남아 PostgREST가 어느 쪽을 부를지 못 고른다 */
  expect(sql).toContain('drop function if exists public.kick_member(bigint, text);');
  expect(sql).toContain('public.kick_member(bigint, text, text),');
});

/* 목록 줄에 참가자 셀렉트와 버튼 셋을 늘어놓으니 열 명이면 설정 탭이
   가로로도 세로로도 늘어졌다. 손대는 건 팝업 하나로 모았다 */
test('멤버 줄에는 손대는 칸을 두지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'rooms', 'Room.jsx'), 'utf8');
  const list = src.slice(src.indexOf('<ul className="room-members">'), src.indexOf('</ul>', src.indexOf('<ul className="room-members">')));
  expect(list).not.toContain('<select');
  expect(list).toContain('mem-more');
});

/* ---------- 로그 탭 ---------- */

test('걸러내기 단추는 줄에 붙는 라벨에서 그대로 만들어진다', () => {
  const { FEED_FILTERS, LOG_TAGS } = require('./rooms');
  expect(FEED_FILTERS[0]).toEqual({ label: '전체', types: null });
  /* 라벨 하나에 종류가 여러 개 묶인 것은 한 단추로 모인다 (또또) */
  const bet = FEED_FILTERS.find((f) => f.label === '또또');
  /* 일반 게임 또또도 같은 단추로 거른다 */
  expect(bet.types).toEqual(['betting_open', 'casual_open', 'casual_settled', 'betting_locked']);
  /* 종류를 하나 더하면 단추도 저절로 생긴다 - 빠진 게 없어야 한다 */
  const covered = FEED_FILTERS.flatMap((f) => f.types || []);
  expect(covered.sort()).toEqual(Object.keys(LOG_TAGS).sort());
});

test('걸러내기는 서버에서 한다 (화면에서 골라내면 빈 쪽이 나온다)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  const body = src.slice(src.indexOf('export const fetchLogs'), src.indexOf('const num ='));
  expect(body).toContain("q.filter('type', 'in'");
  /* 커서는 그대로. 종류를 걸러도 (room_id, id desc) 인덱스를 탄다 */
  expect(body).toContain("q.lt('id', beforeId)");
});

/* 화면 폭을 브라우저가 그리는 것에 맡기면 우리 화면만 검고 펼친 목록은
   하얗다. 실제로 그랬다 */
test('브라우저가 그리는 것들도 어둡게 그린다', () => {
  const theme = fs.readFileSync(path.join(__dirname, '..', 'styles', 'theme.css'), 'utf8');
  expect(theme).toMatch(/:root\s*\{[^}]*color-scheme:\s*dark/);
});

/* select.rooms-input에 화살표를 background-image로 그려뒀다. 그 칸 배경을
   background 단축으로 덮으면 화살표가 지워진다. 화면만 봐서는 '화살표가
   왜 없지' 정도로만 보여서 한참 못 찾는다 */
test('select 배경은 background-color로만 준다', () => {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return e.name.endsWith('.css') ? [full] : [];
    });

  const bad = [];
  walk(path.join(__dirname, '..')).forEach((file) => {
    /* user-select에도 'select'가 들어 있어서, 그 선언이 있는 규칙이
       전부 select 규칙으로 잡혔다 */
    const text = fs
      .readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/[-\w]*user-select\s*:[^;}]*;?/g, '');
    /* select가 걸린 규칙 안에서 background 단축을 쓰는지 본다 */
    (text.match(/[^}]*select[^{]*\{[^}]*\}/g) || []).forEach((rule) => {
      if (/\n\s*background:\s/.test(rule)) {
        bad.push(`${path.basename(file)} ${rule.split('{')[0].trim()}`);
      }
    });
  });
  expect(bad).toEqual([]);
});

/* select 전체에 화살표 padding(1.7rem)을 걸었다가 화면이 깨졌다.
   디비전 칸은 3rem(48px)뿐이어서 숫자 자리가 12px밖에 안 남고, 티어 칸은
   6.6rem이어서 '그랜드마스터'가 잘렸다. padding을 직접 정해둔 칸은 전역
   규칙이 져서 화살표 자리가 아예 안 생겨 글자 위에 겹쳤다.
   폭이 넉넉한 칸(.rooms-input)에만 건다 */
test('화살표는 폭이 넉넉한 칸에만 건다', () => {
  const theme = fs.readFileSync(path.join(__dirname, '..', 'styles', 'theme.css'), 'utf8');
  const rooms = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'rooms', 'Rooms.css'),
    'utf8'
  );
  /* 맨 select에 걸면 좁은 칸까지 다 따라온다 */
  expect(theme).not.toMatch(/\nselect\s*\{/);
  expect(theme).not.toMatch(/\nselect:hover/);
  expect(rooms).toContain('select.rooms-input {');
  expect(rooms).toMatch(/select\.rooms-input \{[^}]*padding-right/);
});

/* 탭 네 개만 폭을 좁혀놨다가, 탭을 옮길 때마다 내용 폭이 들쭉날쭉해서
   그게 더 눈에 걸렸다. 전부 헤더·탭 막대와 같은 폭을 쓴다 */
test('탭마다 폭을 달리 두지 않는다', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'pages', 'rooms', 'Rooms.css'), 'utf8');
  expect(css).not.toContain('is-narrow');
  const jsx = fs.readFileSync(path.join(__dirname, '..', 'pages', 'rooms', 'Room.jsx'), 'utf8');
  expect(jsx).not.toContain('is-narrow');
  /* 방 페이지에 폭을 따로 박아두면 헤더까지 같이 줄어든다 */
  expect(css).not.toMatch(/\.room-page\s*\{[^}]*--page-width/);
});

/* 로그·내전 기록 탭만 패널 없이 맨몸이라, 탭을 옮기면 그 둘만 허전해
   보였다. 다른 탭은 전부 제목줄 달린 .room-panel 안에 들어 있다 */
test('모든 방 탭이 같은 틀(.room-panel)을 쓴다', () => {
  const dir = path.join(__dirname, '..', 'pages', 'rooms');
  ['MatchHistory', 'FeedTab', 'BetTab', 'KkikoTab'].forEach((name) => {
    const src = fs.readFileSync(path.join(dir, `${name}.jsx`), 'utf8');
    expect(src).toContain('room-panel');
  });
});

/* 같은 방 안에서 날짜 구분선이 두 가지로 보이면 안 된다 */
test('날짜 구분선은 로그·내전 기록이 같은 것을 쓴다', () => {
  const dir = path.join(__dirname, '..', 'pages', 'rooms');
  ['MatchHistory', 'FeedTab'].forEach((name) => {
    expect(fs.readFileSync(path.join(dir, `${name}.jsx`), 'utf8')).toContain('"day-sep"');
  });
  /* .room-feed li / .history-list li가 알약 배경을 주므로 li로 못을 박아야
     specificity에서 이긴다 */
  const css = fs.readFileSync(path.join(dir, 'Rooms.css'), 'utf8');
  expect(css).toContain('li.day-sep {');
  expect(css.indexOf('li.day-sep {')).toBeGreaterThan(css.indexOf('.history-list li {'));
  expect(css.indexOf('li.day-sep {')).toBeGreaterThan(css.indexOf('.room-feed li {'));
});

/* 포인트 탭도 좌우 두 칸. 왼쪽은 현황(순위·내 내역), 오른쪽은 조작
   (보내기·조정). 오른쪽에 max-height를 걸면 안쪽 스크롤이 페이지
   스크롤과 겹친다 - sticky만 쓴다 */
test('포인트 탭은 좌우 두 칸이고, 안쪽 스크롤을 만들지 않는다', () => {
  const dir = path.join(__dirname, '..', 'pages', 'rooms');
  const jsx = fs.readFileSync(path.join(dir, 'KkikoTab.jsx'), 'utf8');
  expect(jsx).toContain('kkiko-cols');
  expect(jsx).toContain('kkiko-col is-side');

  const css = fs.readFileSync(path.join(dir, 'Rooms.css'), 'utf8');
  const side = css.slice(css.indexOf('.kkiko-col.is-side {'));
  const body = side.slice(0, side.indexOf('}'));
  expect(body).toContain('position: sticky');
  expect(body).not.toContain('max-height');
  expect(body).not.toContain('overflow');
});

/* 한 판 = 한 줄. 위아래 두 줄로 두면 어느 칩이 어느 팀 것인지 헷갈리고,
   칩 유무에 따라 줄 높이가 달라져 훑을 때 눈이 튄다 */
test('내전 기록은 한 판을 한 줄로 읽는다', () => {
  const dir = path.join(__dirname, '..', 'pages', 'rooms');
  const jsx = fs.readFileSync(path.join(dir, 'MatchHistory.jsx'), 'utf8');
  /* 시간 │ 1팀 │ VS │ 2팀 │ 칩 │ ✕ */
  expect(jsx).toContain('hist-row');
  expect(jsx).toContain('hist-vs');
  /* 위/아래로 갈라놨던 껍데기는 없어졌다 */
  expect(jsx).not.toContain('hist-head');
  expect(jsx).not.toContain('hist-teams');
  /* 금색 띠만으로는 '이겼다'가 아니라 '강조됐다'로만 읽힌다 */
  expect(jsx).toContain('<b>승</b>');
});

/* 시간·칩 칸을 auto로 뒀더니 칩이 없는 판과 둘 다 있는 판의 폭이 달라서
   가운데 VS가 줄마다 들쭉날쭉 움직였다. 양쪽 끝 칸은 폭을 박아야 한다 */
test('내전 기록의 VS가 줄마다 같은 자리에 선다', () => {
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'rooms', 'Rooms.css'),
    'utf8'
  );
  const rule = css.slice(css.indexOf('.history-list li.hist-row {'));
  const cols = rule.slice(0, rule.indexOf('}')).match(/grid-template-columns:([^;]+)/)[1];
  /* 두 팀 칸만 1fr */
  expect((cols.match(/1fr/g) || [])).toHaveLength(2);
  /* 시간과 칩 칸은 폭을 박아둔다. 여기가 auto면 줄마다 VS가 밀린다.
     (모드 칸만 auto다 - 방 안에서 늘 붙거나 아예 없다) */
  expect(cols.trim().split(/\s+(?![^(]*\))/)[0]).toMatch(/rem$/);
  expect(cols).toMatch(/11\.5rem/);

  /* 시간은 시계 시간이라 늘 다섯 글자. timeAgo는 '방금 전'~'12일 전'으로
     길이가 줄마다 달라서 그 칸이 흔들린다 */
  const jsx = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'rooms', 'MatchHistory.jsx'),
    'utf8'
  );
  expect(jsx).toContain('<span className="hist-time" title={timeAgo(m.playedAt)}>');
  expect(jsx).toContain('{hhmm(m.playedAt)}');
});

/* ---------- 또또 열 때 방장이 정한 기준선 ---------- */

/* openBettingByNames는 killLine을 넘기는데 openBetting이 그걸 안 받고
   있었다. 서버는 null을 받으면 인원으로 다시 계산해서 넣어버리므로,
   화면은 방장이 정한 값을 보여주는 줄 알지만 실제로는 다른 기준선으로
   정산됐다. 오류도 안 나고 조용히 틀린다 */
test('방장이 정한 킬 기준선이 서버까지 간다', async () => {
  await openBettingByNames({
    roomId: 7,
    mode: 'normal',
    teamA: ['철수'],
    teamB: ['영희'],
    players,
    closeSeconds: 180,
    killLine: 71.5,
  });

  const call = rpcCalls.find((c) => c.fn === 'open_betting');
  expect(call.args.p_kill_line).toBe(71.5);
  expect(call.args.p_close_seconds).toBe(180);
});

test('안 정했으면 null로 보낸다 (서버가 인원으로 계산한다)', async () => {
  await openBettingByNames({
    roomId: 7,
    mode: 'normal',
    teamA: ['철수'],
    teamB: ['영희'],
    players,
  });
  expect(rpcCalls.find((c) => c.fn === 'open_betting').args.p_kill_line).toBeNull();
});

/* 보내는 이름이 하나라도 틀리면 PostgREST는 그 인자를 조용히 버린다.
   함수가 default를 갖고 있으면 오류조차 안 난다 */
test('rpc로 보내는 인자 이름이 전부 SQL 함수에 있다', () => {
  const declared = {};
  const re = /create or replace function public\.(\w+)\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(sql))) {
    declared[m[1]] = (declared[m[1]] || []).concat(
      (m[2].match(/\bp_\w+/g) || [])
    );
  }

  const bad = [];
  ['rooms.js', 'admin.js'].forEach((file) => {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const calls = src.matchAll(/rpc\(\s*'(\w+)'\s*,\s*\{([^}]*)\}/g);
    for (const c of calls) {
      const params = declared[c[1]];
      if (!params) continue;
      (c[2].match(/\bp_\w+(?=\s*:)/g) || []).forEach((key) => {
        if (!params.includes(key)) bad.push(`${c[1]}(${key})`);
      });
    }
  });
  expect(bad).toEqual([]);
});

/* 담은 배팅 칸에서 눈이 가야 할 곳은 금액이다. 마켓 이름이 본문 크기
   700이라 제일 크고 굵었는데, 정작 금액은 그보다 작았다 */
test('담은 배팅은 금액이 제일 크다', () => {
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'rooms', 'Rooms.css'),
    'utf8'
  );
  const size = (sel) => {
    const rule = css.slice(css.indexOf(`${sel} {`));
    const m = rule.slice(0, rule.indexOf('}')).match(/font-size:\s*([\d.]+)rem/);
    return m ? Number(m[1]) : null;
  };
  expect(size('.bet-amount')).toBeGreaterThan(size('.bet-cart-what'));
  expect(size('.bet-cart-total strong')).toBeGreaterThan(size('.bet-cart-foot'));
});

/* 담은 것을 빼려면 위로 올라가 같은 칸을 다시 눌러야 했다 */
test('담은 배팅은 그 자리에서 뺄 수 있다', () => {
  const jsx = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'rooms', 'BetTab.jsx'),
    'utf8'
  );
  expect(jsx).toContain('bet-cart-drop');
  expect(jsx).toContain('onClick={() => pick(market, v.selection)}');
});

/* ---------- 기록에만 남고 명단에 없는 자리 ---------- */

/* 참가자를 지워도 행을 남기는 장치(deleted_at)가 생기기 전에는 진짜로
   지웠다. 그 시절 기록이 가리키는 id는 행이 없어서 화면에서 '?'가 되거나
   아예 빠져 5명이 4명으로 보인다 */
test('합치기는 행이 없는 id도 받되, 이 방 기록이 가리키는 것만 받는다', () => {
  const body = fnBody('merge_room_players');
  /* 남길 쪽은 반드시 있어야 한다 */
  expect(body).toContain("if r is null then raise exception '남길 참가자를 찾을 수 없어요.'");
  /* 없앨 쪽은 행이 없어도 된다 - 대신 이 방의 경기가 가리켜야 한다 */
  expect(body).toContain('if r2 is not null then');
  expect(body).toMatch(/public\.has_player\(x\.team_a, p_drop\)[\s\S]{0,80}이 방의 기록에 없는/);
  /* 아무 숫자나 넣어 남의 방 기록을 건드릴 수 없어야 한다 */
  expect(body).toContain('where x.room_id = r');
});

/* 지운 사람은 행이 남아 있으니 이름도 남아 있다. 또또 화면이 산 사람만
   받아보고 있어서 그 사람만 '?'로 나왔다 */
test('또또 화면은 지운 사람 이름까지 받아본다', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'rooms', 'Room.jsx'),
    'utf8'
  );
  const bet = src.slice(src.indexOf('<BetTab'), src.indexOf('members={members}', src.indexOf('<BetTab')));
  expect(bet).toContain('players={allPlayers}');
});

/* '#23' 하나만 보여주면 그게 누구였는지 알 길이 없다. 언제 몇 판 뛰었고
   누구와 같은 팀이었는지가 있어야 사람이 기억해낸다 */
test('이름 없는 자리는 단서까지 모아서 넘긴다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  const body = src.slice(src.indexOf('const knownIds'), src.indexOf('return {', src.indexOf('const knownIds')));
  /* 지운 사람은 행이 남아 있으므로 '없는 id'가 아니다 */
  expect(body).toContain('allPlayers.map((p) => Number(p.id))');
  /* 몇 판 · 언제부터 언제까지 · 같은 팀이었던 사람 */
  expect(body).toContain('cur.games += 1');
  expect(body).toContain('cur.first = Math.min');
  expect(body).toContain('cur.last = Math.max');
  expect(body).toContain('cur.mates.set(nm');
  /* 같이 뛴 사람도 이름이 없으면 단서가 못 된다 */
  expect(body).toContain('if (nm)');
  /* 많이 뛴 자리부터 - 그쪽이 알아보기 쉽다 */
  expect(body).toContain('b.games - a.games');
});

/* ---------- 통계: 승률 / 끼꼬 ---------- */

/* 끼꼬는 달마다 0에서 다시 시작한다. 여러 달을 합치면 아무 뜻이 없어서
   '전체 기간'에는 토글 자체를 안 띄운다 */
test('달별 끼꼬는 박제해둔 값과 이번 달 지갑을 갈라 본다', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'season', 'Season.jsx'),
    'utf8'
  );
  const body = src.slice(src.indexOf('const kkiko = useMemo'), src.indexOf('const canKkiko'));
  /* 이번 달은 아직 박제 전이라 지갑을 본다 */
  expect(body).toContain('active === thisMonth');
  expect(body).toContain('members.map');
  /* 지난 달은 시즌이 넘어갈 때 박제한 값 */
  expect(body).toContain('r.kkiko_points');
  /* 그때 쓰던 이름 그대로. 나중에 바꿔도 기록이 안 흔들린다 */
  expect(body).toContain('r.display_name');

  expect(src).toContain("const canKkiko = !isAll && kkiko.length > 0;");
});

/* roll_season이 초기화 직전에 박제하지 않으면 달별 끼꼬가 전부 10000이 된다 */
test('시즌이 넘어갈 때 끼꼬를 초기화 전에 박제한다', () => {
  const body = fnBody('roll_season');
  const snap = body.indexOf('insert into hall_of_fame');
  const reset = body.indexOf('update room_wallets set points =');
  expect(snap).toBeGreaterThan(-1);
  expect(snap).toBeLessThan(reset);
});

/* ---------- 역할별 권한 ---------- */

/* 화면의 권한 표(rules/permissions.js)와 서버가 부르는 기능 이름이
   어긋나면, 화면은 된다고 적어두고 서버가 거절한다 */
test('권한 이름이 화면과 서버에서 같다', () => {
  const { CAPS, DEFAULT_ROLE_CAPS } = require('../rules/permissions');
  const inSql = new Set(
    [...sql.matchAll(/room_can\([^,]+,\s*'(\w+)'\)/g)].map((m) => m[1])
  );
  /* 켜고 끌 수 있는 권한은 전부 서버 관문이 있어야 한다. 없으면 화면에서
     껐는데도 서버가 그냥 통과시킨다.
     (code는 멤버면 누구나, room은 방장 자리 자체라 room_can 밖이다) */
  CAPS.filter((c) => !c.everyone && !c.fixed).forEach((c) => {
    expect([c.key, [...inSql]]).toEqual([c.key, expect.arrayContaining([c.key])]);
  });
  /* 서버가 쓰는데 표에 없는 이름이 있으면 화면이 그 권한을 못 보여준다 */
  const known = new Set(CAPS.map((c) => c.key));
  [...inSql].forEach((k) => expect(known.has(k)).toBe(true));

  /* 새 방이 시작하는 자리가 화면과 서버에서 같아야 한다. 어긋나면 방을
     만든 직후의 표가 실제와 다른 말을 한다 */
  const dflt = sql.match(/role_caps jsonb not null\s+default '([^']+)'/)[1];
  expect(JSON.parse(dflt)).toEqual(DEFAULT_ROLE_CAPS);
  /* 기본값은 예전 '부방장' 그대로 */
  expect(DEFAULT_ROLE_CAPS.admin.slice().sort()).toEqual(
    ['account', 'bet', 'member', 'record', 'roster', 'style']
  );
  /* 운영진은 방 살림만. 경기·또또·끼꼬는 안 준다 */
  expect(DEFAULT_ROLE_CAPS.staff).not.toContain('record');
  expect(DEFAULT_ROLE_CAPS.staff).not.toContain('bet');
  expect(DEFAULT_ROLE_CAPS.member).toEqual([]);
});

/* 역할 이름이 화면·제약·함수 셋에서 같아야 한다. 하나라도 빠지면
   그 자리를 줄 수는 있는데 아무것도 못 하거나, 아예 저장이 거절된다 */
test('역할 이름이 화면과 서버에서 같다', () => {
  const { SET_ROLES } = require('../rules/permissions');
  expect(SET_ROLES.map((r) => r.key)).toEqual(['admin', 'staff', 'member']);
  expect(sql).toContain("check (role in ('owner','admin','staff','member'))");
  expect(fnBody('set_member_role')).toContain("p_role not in ('admin', 'staff', 'member')");
  expect(fnBody('set_role_cap')).toContain("p_role not in ('admin','staff','member')");
});

/* 부방장이 방을 지우거나 방장을 끌어내릴 수 있으면 방장이라는 자리가
   뜻이 없어진다. 화면에서 못 누르게 막는 것만으로는 부족하다 */
test('넘길 수 없는 권한은 서버가 거절한다', () => {
  const { CAPS } = require('../rules/permissions');
  const body = fnBody('set_role_cap');
  const allowed = body.match(/p_cap not in \(([^)]+)\)/)[1];
  CAPS.filter((c) => c.fixed || c.everyone).forEach((c) => {
    expect(allowed).not.toContain(`'${c.key}'`);
  });
  CAPS.filter((c) => !c.fixed && !c.everyone).forEach((c) => {
    expect(allowed).toContain(`'${c.key}'`);
  });
  expect(body).toContain('public.is_room_owner(p_room)');
});

/* 방장은 목록과 상관없이 전부 된다 */
test('권한 관문은 한 군데뿐이다', () => {
  const body = fnBody('room_can');
  expect(body).toContain("m.role = 'owner'");
  expect(body).toContain("jsonb_exists(r.role_caps -> m.role, cap)");
  /* 옛 관문이 남아 있으면 '이걸 쓰면 되나' 싶어진다 */
  expect(sql).not.toContain('function public.is_room_admin(');
  expect(sql).not.toContain('function public.is_room_recorder(');
});

/* 방장 자리 자체를 건드리는 것만 room_can 밖에 둔다 */
test('방장 자리는 권한 목록 밖이다', () => {
  ['set_member_role', 'transfer_room', 'delete_room', 'set_role_cap'].forEach((name) => {
    expect(fnBody(name)).toContain('public.is_room_owner(');
  });
});

/* 입장 코드는 멤버면 본다. 새로 뽑는 건 넘길 수 있는 권한이다 */
test('입장 코드는 멤버면 볼 수 있다', () => {
  expect(fnBody('get_join_code')).toContain('if not public.is_room_member(p_room) then');
  expect(fnBody('reset_join_code')).toContain("room_can(p_room, 'code_reset')");
});

/* ---------- 계정 옮기기 ---------- */

/* 내보내기는 끼꼬만 넘기면 되지만, 계정 옮기기는 그 계정이 남긴 것이
   전부 따라와야 한다. 안 따라오면 지난 또또가 '알 수 없음'으로 뜬다 */
test('계정을 옮기면 그 계정이 남긴 기록이 전부 따라간다', () => {
  const body = fnBody('transfer_account');
  expect(body).toContain('update bets set user_id = p_to');
  expect(body).toContain('update point_ledger set user_id = p_to');
  expect(body).toContain('update point_ledger set counterpart_user_id = p_to');
  expect(body).toContain('update hall_of_fame set user_id = p_to');
  expect(body).toContain('update room_players set linked_user_id = p_to');
});

test('같은 판 같은 항목에 둘 다 걸었으면 막는다 (조용히 지우면 안 된다)', () => {
  const body = fnBody('transfer_account');
  /* bets에 (scrim_id, user_id, market) 유니크가 걸려 있다 */
  expect(body).toContain('a.scrim_id = b.scrim_id and a.market = b.market');
  expect(body).toMatch(/if clash > 0 then[\s\S]{0,60}raise exception/);
});

/* 처음 받은 10000까지 옮기면 계정을 새로 만들어 들어왔다 넘기는 것만으로
   끼꼬를 찍어낼 수 있다. 내보내기와 같은 규칙을 같은 함수로 쓴다 */
test('끼꼬는 벌어들인 몫만 옮긴다 (내보내기와 같은 함수)', () => {
  const tuning = require('../rules/tuning');
  expect(fnBody('move_surplus')).toContain(`greatest(0, points - ${tuning.MONTHLY_KKIKO})`);
  expect(fnBody('move_surplus')).toContain('for update');
  expect(fnBody('transfer_account')).toContain('public.move_surplus(p_room, p_from, p_to)');
  expect(fnBody('kick_member')).toContain('public.move_surplus(p_room, p_user, p_to)');
  /* 남의 지갑을 직접 옮기는 함수다. 클라이언트가 부를 이유가 없다 */
  expect(sql).toContain('revoke execute on function public.move_surplus(bigint, text, text) from public;');
});

/* ---------- 폴링 ---------- */

/* Data API에 실시간 구독이 없어 폴링이 불가피하다. 두 가지를 같이
   지켜야 한다 - 화면이 멈춘 것처럼 보이지 않을 것, DB를 두들기지 않을 것 */
describe('방 폴링', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');

  test('또또가 열려 있을 때만 자주 본다', () => {
    const idle = Number(src.match(/const POLL_MS = (\d+);/)[1]);
    const hot = Number(src.match(/const HOT_MS = (\d+);/)[1]);
    /* 평소는 느긋하게, 또또 중에는 사람이 기다릴 만한 간격으로 */
    expect(idle).toBeGreaterThanOrEqual(20000);
    expect(hot).toBeLessThanOrEqual(5000);
    expect(hot).toBeGreaterThanOrEqual(3000);
    /* '자주 보는' 조건은 진행 중인 또또가 있을 때뿐이다.
       늘 5초로 돌면 아무 일도 없는 방이 DB를 계속 두들긴다 */
    expect(src).toMatch(/const hot = Boolean\(/);
    expect(src).toMatch(/s\.status === 'betting' \|\| s\.status === 'locked'/);
    expect(src).toContain('hot ? HOT_MS : POLL_MS');
  });

  test('한 컬럼만 보고, 달라졌을 때만 상세를 받는다', () => {
    /* 방 전체를 매번 읽으면 그게 곧 부하다 */
    expect(src).toContain("from('rooms').select('version')");
    expect(src).toContain('row.version !== version) reload()');
  });

  test('안 보이는 탭에서는 묻지 않고, 돌아오면 바로 묻는다', () => {
    expect(src).toContain("document.visibilityState !== 'visible'");
    expect(src).toContain("addEventListener('visibilitychange', check)");
    /* 치우지 않으면 방을 드나들 때마다 리스너가 쌓인다 */
    expect(src).toContain("removeEventListener('visibilitychange', check)");
  });
});

/* ---------- 달 경계 ---------- */

/* 9월 30일 밤에 또또를 열고 10월 1일에 정산하면, 건 끼꼬는 9월 지갑에서
   빠지는데 번 끼꼬는 초기화된 10월 지갑으로 들어갔다. 9월은 건 만큼
   손해로 박제되고 10월은 공짜 돈이 얹힌다 - 한 판이 두 달로 쪼개진다 */
test('진행 중인 판이 있으면 계절을 넘기지 않는다', () => {
  const body = fnBody('roll_season');
  /* 박제(hall_of_fame)보다 먼저 막아야 한다. 박제한 뒤에 막으면 이미
     어긋난 값이 남는다 */
  const guard = body.indexOf("status in ('betting', 'locked')");
  const snap = body.indexOf('insert into hall_of_fame');
  expect(guard).toBeGreaterThan(-1);
  expect(snap).toBeGreaterThan(guard);
  /* 잊고 안 끝낸 판이 계절을 영원히 붙들면 아무도 초기화되지 않는다 */
  expect(body).toMatch(/played_at > now\(\) - interval '\d+ hours'/);
});

/* ---------- 일반 게임 또또 ---------- */

/* 돈이 오가는 길이라, 한 줄만 어긋나도 방 끼꼬가 조용히 새거나 불어난다 */
describe('일반 게임 또또 (SQL)', () => {
  const settle = fnBody('settle_casual');
  const lock = fnBody('lock_betting');
  const open = fnBody('open_casual_bet');
  const leg = fnBody('leg_result');
  const pick = fnBody('check_bet_pick');

  /* 맞았나 틀렸나를 두 군데서 따로 판단하면 언젠가 어긋난다.
     낱개 정산과 묶음 정산이 같은 함수를 본다 */
  test('맞았나는 leg_result 한 군데서만 판단한다', () => {
    expect(settle).toContain('case public.leg_result(s, b.market, b.selection)');
    expect(fnBody('settle_parlays')).toContain('public.leg_result(s,');
  });

  /* 상대가 첫 킬을 땄을 때 '누구' 마켓을 환불하면, 배당(8.5배 언저리)이
     이미 '상대가 딸 절반'을 값에 넣고 있어서 걸기만 해도 이득이 된다 */
  test('첫 킬(사람)은 상대가 땄을 때 환불이 아니라 낙첨이다', () => {
    /* 환불은 '어느 팀인지조차 안 넣었을 때'뿐 */
    expect(leg).toContain("if s.fb_side is null then return 'void'; end if;");
    /* 상대 라인을 모를 때는 상대 라인에 건 것만 돌려준다 */
    expect(leg).toContain(
      "if s.fb_side = 'them' and s.fb_enemy_lane is null and sel like 'them\\_%' then"
    );
  });

  /* 전적에 안 들어가는 판에 참여 끼꼬를 주면, 일반 큐만 돌려도 끼꼬가 생긴다 */
  test('참여 끼꼬를 주지 않는다', () => {
    expect(settle).not.toMatch(/perform public\.award_participation/);
  });

  /* 'kills_parity'가 언더오버 가지에 먼저 걸리면 'parity'::numeric에서 터진다 */
  test('짝홀은 언더오버 가지에 안 걸린다', () => {
    expect(leg.indexOf("if m = 'kills_parity' then")).toBeLessThan(
      leg.indexOf("if m like 'kills\\_%'")
    );
    /* 마감 때 기준선을 박는 자리도 같은 함정이 있다 */
    expect(lock).toContain("bp.market like 'kills%' and bp.market <> 'kills_parity'");
  });

  /* 총 킬을 따로 받으면 우리 12 · 상대 17 · 총 30처럼 서로 안 맞는 숫자가
     들어올 수 있다. 총 킬은 둘의 합이다 */
  test('총 킬은 팀 킬의 합이다', () => {
    expect(settle).toContain('then p_our_kills + p_opp_kills end');
  });

  /* 화면에 '7.08배'라고 해놓고 서버가 다른 배당으로 주면 안 된다 */
  test('라인 몫과 첫 용 배당이 tuning.js와 같다', () => {
    const { FIRST_BLOOD_LANE_SHARE, FIRST_DRAGON_ODDS } = require('../rules/tuning');
    const fb = fnBody('casual_fb_odds');
    Object.entries(FIRST_BLOOD_LANE_SHARE).forEach(([lane, share]) => {
      expect(fb).toContain(`when '${lane}' then ${share}`);
    });
    expect(lock).toContain(`set odds = ${FIRST_DRAGON_ODDS}`);
    expect(fnBody('base_odds')).toContain(`return ${FIRST_DRAGON_ODDS};`);
    /* 마감 배당과 묶음 배당이 같은 함수를 본다 */
    expect(lock).toContain('public.casual_fb_odds(s, bp.selection)');
    expect(fnBody('base_odds')).toContain('public.casual_fb_odds(s, sel)');
  });

  test('팀 킬 기준선이 화면과 같다', () => {
    const { teamKillLine } = require('../rules/casual');
    expect(fnBody('team_kill_line')).toContain('floor(total / 2) + 0.5');
    expect(teamKillLine(29.5)).toBe(14.5);
    expect(teamKillLine(59.5)).toBe(29.5);
    expect(teamKillLine(53.5)).toBe(26.5);
  });

  /* 아무 id나 받으면 남의 방 사람에게 배당이 걸린다 */
  test('이 방 참가자만 고를 수 있고 다섯 명까지다', () => {
    expect(open).toContain('rp.room_id = p_room and rp.deleted_at is null');
    expect(open).toContain('jsonb_array_length(p_players) > 5');
  });

  test('일반 게임만 이쪽으로 정산한다', () => {
    expect(settle).toContain("if s.kind <> 'casual' then");
  });

  test('없는 마켓이나 엉뚱한 쪽 마켓은 받지 않는다', () => {
    expect(fnBody('place_bets')).toContain(
      "perform public.check_bet_pick(s, b->>'market', b->>'selection');"
    );
    expect(pick).toContain("raise exception '없는 항목이에요.'");
    expect(pick).toContain("raise exception '일반 게임에는 승리팀이 없어요.'");
    expect(pick).toContain("raise exception '칼바람에는 용이 없어요.'");
    /* 기준선을 다른 숫자로 바꿔 거는 길 */
    expect(pick).toContain('line <> s.kill_line');
    expect(pick).toContain('line <> public.team_kill_line(s.kill_line)');
  });

  /* 일반 게임은 배당이 고정이다. 걸 때 본 배당이 곧 받는 배당 */
  test('일반 게임은 두 갈래 항목도 1.98 고정', () => {
    const { KILLS_ODDS } = require('../rules/tuning');
    /* 몰린 만큼 움직이는 셈에서 일반 게임을 뺀다 */
    expect(lock).toContain("and s.kind <> 'casual'");
    expect(lock).toContain(`update bet_pools set odds = ${KILLS_ODDS}`);
  });

  /* 우리 팀 오버와 총 오버는 거의 같이 움직인다. 둘 다 걸면 같은 걸 두 번 */
  test('킬 언더오버는 셋 중 하나만', () => {
    expect(fnBody('place_bets')).toContain(
      "킬 언더오버는 우리 팀·총·상대 팀 중 하나만 걸 수 있어요."
    );
  });
});

/* ---------- 배팅 묶기 ---------- */

describe('배팅 묶기 (SQL)', () => {
  const place = fnBody('place_parlay');

  /* 버는 끼꼬(지급 - 건 돈)가 상한을 넘지 않게, 상한을 배당에서 거꾸로 구한다 */
  test('버는 끼꼬 상한이 tuning.js와 같다', () => {
    const { PARLAY_MAX_WIN } = require('../rules/tuning');
    expect(place).toContain(`cap := floor(${PARLAY_MAX_WIN} / (o - 1));`);
  });

  /* 낱개와 같은 표에 한 줄로 넣어야 취소·되돌리기·계정 옮기기가 따라온다 */
  test('bets에 parlay 한 줄로 들어간다', () => {
    expect(place).toContain("values (p_scrim, s.room_id, me, 'parlay',");
    expect(place).toContain("'bet', p_scrim");
  });

  /* 승리팀은 마감 때까지 배당을 모르니 곱할 수가 없다 */
  test('승리팀은 못 묶는다', () => {
    expect(fnBody('base_odds')).toContain('승리팀은 묶을 수 없어요');
  });

  test('묶기 전에 다리마다 낱개와 같은 검사를 거친다', () => {
    expect(place).toContain("perform public.check_bet_pick(s, l->>'market', l->>'selection');");
    expect(place).toContain('두 개 이상 담아야 묶을 수 있어요.');
    expect(place).toContain('첫 킬은 어느 팀이나 누구 중 하나만 묶을 수 있어요.');
    expect(place).toContain('킬 언더오버는 하나만 묶을 수 있어요.');
  });

  /* 묶음에 건 끼꼬가 낱개 배당 집계(bet_pools)에 들어가면, 묶음이 걸린
     쪽의 반대 배당이 올라가서 그쪽에 낱개로 건 사람이 득을 본다.
     묶음은 배당을 걸 때 박으므로 집계에 들어갈 이유가 없다 */
  test('묶음은 낱개 배당 집계에 안 섞인다', () => {
    expect(place).not.toContain('bet_pools');
  });

  /* 정산 되돌리기가 배당을 지우면 다시 정산할 때 곱할 게 없다 */
  test('되돌려도 묶음 배당은 남는다', () => {
    expect(fnBody('unsettle_scrim')).toContain("odds = case when market = 'parlay' then odds end");
  });

  /* 지급을 지갑에 넣기 전에 묶음 지급이 정해져 있어야 한다 */
  test('내전·일반 정산 둘 다 묶음을 지갑에 넣기 전에 정산한다', () => {
    ['settle_scrim', 'settle_casual'].forEach((fn) => {
      const body = fnBody(fn);
      expect(body.indexOf('perform public.settle_parlays(s);')).toBeGreaterThan(-1);
      expect(body.indexOf('perform public.settle_parlays(s);')).toBeLessThan(
        body.indexOf('with paid as')
      );
    });
  });

  /* exp(sum(ln))으로 곱하면 3.9204가 3.92039999가 되어 지급이 1씩 모자란다 */
  test('배당 곱은 numeric으로 차례대로 곱한다', () => {
    const body = fnBody('settle_parlays');
    expect(body).toContain("mult := mult * (l->>'odds')::numeric;");
    expect(body).not.toMatch(/exp\(|ln\(/);
  });
});

/* 팀 킬·상대 라인을 안 받아와서 결과 화면에 우리 팀·상대 팀 언더오버
   적중이 안 칠해졌다 (저장은 되는데 안 읽는 것) */
test('일반 게임 결과 컬럼을 전부 받아온다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'rooms.js'), 'utf8');
  const sel = src.slice(src.indexOf('const ROOM_SELECT'), src.indexOf(';', src.indexOf('const ROOM_SELECT')));
  ['our_kills', 'opp_kills', 'fb_enemy_lane', 'fb_side', 'first_dragon', 'lanes'].forEach((c) =>
    expect(sel).toContain(c)
  );
  const { CASUAL_FB_RATE } = require('../rules/tuning');
  expect(fnBody('casual_fb_odds')).toContain(`round(${CASUAL_FB_RATE} / (0.5 *`);
});

test('일반 게임 첫 킬 티어 보정이 tuning.js와 같다', () => {
  const { CASUAL_FB_TIER_BONUS } = require('../rules/tuning');
  expect(fnBody('casual_fb_odds')).toContain(`(1 + (3 - coalesce(idx, 3)) * ${CASUAL_FB_TIER_BONUS})`);
});
