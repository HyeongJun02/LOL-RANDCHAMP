import {
  firstBloodOdds,
  casualMarkets,
  casualAnswer,
  casualKillLine,
  hasDragon,
  hasLanes,
  DRAGONS,
  LANES,
} from './casual';
import { FIRST_BLOOD_LANE_SHARE, FIRST_DRAGON_ODDS } from './tuning';

/* 일반 게임 또또. 배당이 틀리면 방 전체의 끼꼬가 조용히 새거나 불어난다 */

test('서포터가 제일 어렵고 탑·미드·원딜이 제일 쉽다', () => {
  const odds = LANES.map((l) => ({ lane: l.key, o: firstBloodOdds(l.key, 'normal') }));
  const by = Object.fromEntries(odds.map(({ lane, o }) => [lane, o]));
  /* 어려울수록 배당이 높다 */
  expect(by.SUPPORT).toBeGreaterThan(by.JUNGLE);
  expect(by.JUNGLE).toBeGreaterThan(by.TOP);
  expect(by.TOP).toBeGreaterThan(by.MID);
  expect(by.MID).toBe(by.ADC);
});

/* 몫의 합이 1이 아니면 어느 라인은 공짜 돈이 되고 어느 라인은 바가지가 된다 */
test('라인 몫을 다 더하면 1이다', () => {
  const sum = Object.values(FIRST_BLOOD_LANE_SHARE).reduce((a, b) => a + b, 0);
  expect(sum).toBeCloseTo(1, 10);
  expect(Object.keys(FIRST_BLOOD_LANE_SHARE).sort()).toEqual(
    LANES.map((l) => l.key).sort()
  );
});

/* 미정·칼바람은 다섯 중 하나(0.2). 0.7 / (0.5 × 0.2) = 7배.
   서포터가 14배를 넘던 걸 내린 값이다 */
test('라인 미정은 7배, 서포터도 10배를 안 넘는다', () => {
  expect(firstBloodOdds('ANY', 'aram')).toBeCloseTo(7, 2);
  expect(firstBloodOdds('SUPPORT', 'normal')).toBeLessThan(10);
});

test('칼바람은 라인도 용도 없다', () => {
  expect(hasLanes('aram')).toBe(false);
  expect(hasDragon('aram')).toBe(false);
  /* 다섯이 똑같이 나눈다 - 라인 이름을 줘도 무시한다 */
  expect(firstBloodOdds('SUPPORT', 'aram')).toBe(firstBloodOdds('MID', 'aram'));

  const keys = casualMarkets('aram', 59.5).map((m) => m.key);
  expect(keys).not.toContain('dragon');
  expect(casualMarkets('normal', 29.5).map((m) => m.key)).toContain('dragon');
});

test('승리팀 마켓은 열지 않는다 (우리 다섯이 한 팀이다)', () => {
  expect(casualMarkets('normal', 29.5).map((m) => m.key)).not.toContain('winner');
});

test('모드마다 기준선이 다르다', () => {
  expect(casualKillLine('aram')).toBeGreaterThan(casualKillLine('normal'));
  /* 반 칼이 붙어 있어야 동점이 안 난다 */
  expect(casualKillLine('normal') % 1).toBe(0.5);
  expect(casualKillLine('aram') % 1).toBe(0.5);
});

test('첫 용은 여섯 종류고 본전보다 조금 낮다', () => {
  expect(DRAGONS).toHaveLength(6);
  expect(FIRST_DRAGON_ODDS).toBeLessThan(DRAGONS.length);
  expect(new Set(DRAGONS.map((d) => d.key)).size).toBe(6);
});

describe('정답 판정', () => {
  const settled = (over) => ({ status: 'settled', ...over });

  test('짝홀은 총 킬에서 나온다 (따로 입력받지 않는다)', () => {
    expect(casualAnswer(settled({ total_kills: 30 }), 'kills_parity')).toBe('even');
    expect(casualAnswer(settled({ total_kills: 31 }), 'kills_parity')).toBe('odd');
  });

  /* 결과를 안 넣은 마켓은 null이어야 전액 환불된다 */
  test('결과를 안 넣으면 null이다', () => {
    expect(casualAnswer(settled({ total_kills: null }), 'kills_parity')).toBeNull();
    expect(casualAnswer(settled({}), 'fb_side')).toBeNull();
    expect(casualAnswer(settled({}), 'dragon')).toBeNull();
  });

  test('아직 안 끝난 판은 정답이 없다', () => {
    expect(casualAnswer({ status: 'betting', total_kills: 30 }, 'kills_parity')).toBeNull();
  });
});

/* 상대가 첫 킬을 땄을 때 우리 쪽에 건 사람을 환불해주면, 배당이 이미
   '상대가 딸 확률 절반'을 값에 넣고 있으므로 걸기만 해도 이득인 마켓이
   된다. 방 끼꼬가 조용히 불어난다 */
describe('첫 킬 - 누구', () => {
  const settled = (over) => ({ status: 'settled', ...over });

  test('상대가 땄으면 우리 쪽은 전부 낙첨 (환불 아님)', () => {
    const answer = casualAnswer(settled({ fb_side: 'them' }), 'first_blood');
    /* 환불은 null이다. null이 아니면서 어느 참가자 id와도 안 맞아야 한다 */
    expect(answer).not.toBeNull();
    expect(answer).toBe('them');
    expect(Number.isFinite(Number(answer))).toBe(false);
  });

  test('우리가 땄으면 그 사람만 적중', () => {
    const answer = casualAnswer(
      settled({ fb_side: 'us', first_blood_player_id: 12 }),
      'first_blood'
    );
    expect(answer).toBe('12');
  });

  test('어느 팀인지조차 안 넣었으면 환불', () => {
    expect(casualAnswer(settled({}), 'first_blood')).toBeNull();
  });
});

/* kills_parity가 'kills_' 가지에 먼저 걸리면 'parity'를 숫자로 읽어
   NaN과 비교하고, 총 킬이 몇이든 '언더'가 되어 버린다 */
test('짝홀이 언더오버 가지에 먼저 걸리지 않는다', () => {
  const s = { status: 'settled', total_kills: 31 };
  expect(casualAnswer(s, 'kills_parity')).toBe('odd');
  expect(casualAnswer(s, 'kills_29.5')).toBe('over');
  expect(casualAnswer({ ...s, total_kills: 20 }, 'kills_29.5')).toBe('under');
});

describe('팀 킬 · 상대 라인 · 묶음', () => {
  const {
    killTrio,
    isKillTrio,
    fbRows,
    parlayCap,
    parlayOdds,
    casualOutcome,
  } = require('./casual');
  const { PARLAY_MAX_WIN } = require('./tuning');

  test('킬 언더오버 셋은 우리 팀 · 총 · 상대 팀 순서다', () => {
    expect(killTrio(29.5).map((k) => k.key)).toEqual([
      'ourkills_14.5',
      'kills_29.5',
      'oppkills_14.5',
    ]);
    /* 짝홀은 이름이 kills_로 시작하지만 언더오버가 아니다 */
    expect(isKillTrio('kills_parity')).toBe(false);
    expect(isKillTrio('ourkills_14.5')).toBe(true);
    expect(isKillTrio('kills_29.5')).toBe(true);
  });

  /* 첫 킬 표: 탑 · 정글 · 미드 · 서폿 · 원딜. 라인이 있으면 그 줄에,
     미정이면 남은 줄에 차례로 */
  test('정한 라인은 그 줄에, 미정은 남은 줄에', () => {
    const rows = fbRows([1, 2, 3], { 2: 'SUPPORT' }, 'normal');
    expect(rows.map((r) => r.lane)).toEqual(['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']);
    expect(rows.find((r) => r.lane === 'SUPPORT').id).toBe(2);
    expect(rows.find((r) => r.lane === 'TOP').id).toBe(1);
    expect(rows.find((r) => r.lane === 'JUNGLE').id).toBe(3);
    expect(rows.find((r) => r.lane === 'ADC').id).toBeNull();
  });

  /* 버는 끼꼬(지급 - 건 돈)가 상한을 안 넘는다 */
  test('묶음 상한으로 걸면 버는 끼꼬가 상한 안이다', () => {
    [3.92, 9.44, 46.75, 611.3].forEach((odds) => {
      const cap = parlayCap(odds);
      expect(Math.floor(cap * odds) - cap).toBeLessThanOrEqual(PARLAY_MAX_WIN);
      /* 한 끼꼬만 더 걸면 넘어야 상한이 너무 짜지 않은 것이다 */
      expect(Math.floor((cap + 1) * odds) - (cap + 1)).toBeGreaterThan(PARLAY_MAX_WIN - odds);
    });
  });

  /* 곱한 뒤에 한 번만 반올림한다. 다리마다 반올림하면 서버와 1~2씩 어긋난다 */
  test('묶음 배당은 곱한 뒤 한 번만 반올림한다', () => {
    expect(parlayOdds([1.98, 1.98])).toBe(3.92);
    expect(parlayOdds([1.98])).toBeNull();
    expect(parlayOdds([1.98, null])).toBeNull();
  });

  /* 상대가 땄는데 라인을 모르면 상대 라인에 건 것만 돌려준다 */
  test('상대 라인을 모르면 상대 라인 배팅만 환불', () => {
    const s = { status: 'settled', fb_side: 'them' };
    expect(casualOutcome(s, 'first_blood', 'them_TOP')).toBe('void');
    expect(casualOutcome(s, 'first_blood', '12')).toBe('lose');

    const known = { ...s, fb_enemy_lane: 'TOP' };
    expect(casualOutcome(known, 'first_blood', 'them_TOP')).toBe('win');
    expect(casualOutcome(known, 'first_blood', 'them_MID')).toBe('lose');
  });

  test('팀 킬은 각자 기준선과 견준다', () => {
    const s = { status: 'settled', our_kills: 16, opp_kills: 9, total_kills: 25 };
    expect(casualOutcome(s, 'ourkills_14.5', 'over')).toBe('win');
    expect(casualOutcome(s, 'oppkills_14.5', 'under')).toBe('win');
    expect(casualOutcome(s, 'kills_29.5', 'under')).toBe('win');
    /* 한쪽을 모르면 그 팀 것만 환불 */
    expect(casualOutcome({ ...s, opp_kills: null }, 'oppkills_14.5', 'over')).toBe('void');
  });
});

/* 랭크가 낮으면 첫 킬을 딸 확률도 낮다. 배당이 올라가야 한다 */
test('첫 킬 배당은 티어가 낮을수록 높다', () => {
  const { tierFactor } = require('./casual');
  expect(firstBloodOdds('MID', 'normal', 'IRON')).toBeGreaterThan(firstBloodOdds('MID', 'normal', 'GOLD'));
  expect(firstBloodOdds('MID', 'normal', 'GOLD')).toBeGreaterThan(firstBloodOdds('MID', 'normal', 'MASTER'));
  /* 티어를 모르면(상대 라인) 골드로 본다 */
  expect(firstBloodOdds('MID', 'normal')).toBe(firstBloodOdds('MID', 'normal', 'GOLD'));
  expect(tierFactor('IRON')).toBeCloseTo(1.12, 5);
});
