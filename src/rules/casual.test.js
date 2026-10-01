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

/* 평균 몫(0.2)이면 내전의 10인 첫 킬 배당(10 × 0.85)과 같은 자리여야 한다.
   상대팀이 딸 절반을 떼고 남은 절반을 다섯이 나누니 결국 10분의 1이다 */
test('평균 라인은 내전 10인 첫 킬과 같은 배당이다', () => {
  expect(firstBloodOdds('ANY', 'aram')).toBeCloseTo(8.5, 2);
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
