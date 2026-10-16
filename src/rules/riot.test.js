import { parseRiotId, tierText, kdaRatio, clock, errorText, tftName, monsterName, winRate } from './riot';

test('라이엇 ID: 이름#태그, 태그를 안 쓰면 KR1', () => {
  expect(parseRiotId('Hide on bush#KR1')).toEqual({ name: 'Hide on bush', tag: 'KR1' });
  expect(parseRiotId('  페이커  ')).toEqual({ name: '페이커', tag: 'KR1' });
  /* 이름에 #이 들어갈 수는 없지만, 마지막 # 뒤를 태그로 본다 */
  expect(parseRiotId('a#b#KR2')).toEqual({ name: 'a#b', tag: 'KR2' });
  expect(parseRiotId('#KR1')).toBeNull();
  expect(parseRiotId('')).toBeNull();
});

test('마스터 이상은 디비전이 없다', () => {
  expect(tierText('GOLD', 'II')).toBe('골드 II');
  expect(tierText('CHALLENGER', 'I')).toBe('챌린저');
  expect(tierText(null)).toBe('언랭');
});

test('데스 0이면 KDA는 Perfect (0으로 나누지 않는다)', () => {
  expect(kdaRatio(5, 0, 3)).toBe('Perfect');
  expect(kdaRatio(5, 2, 3)).toBe('4.00');
  expect(winRate(0, 0)).toBeNull();
  expect(winRate(3, 1)).toBe(75);
});

test('글자 바꾸기', () => {
  expect(clock(1804)).toBe('30:04');
  expect(tftName('TFT13_Jinx')).toBe('Jinx');
  expect(monsterName('DRAGON', 'FIRE_DRAGON')).toBe('화염 용');
  expect(monsterName('BARON_NASHOR')).toBe('바론');
  expect(errorText(403)).toMatch(/API 키/);
  expect(errorText('no_key')).toMatch(/설정/);
});

test('매치 상세 글자 · 아이콘', () => {
  const r = require('./riot');
  expect(r.buildingName('TOWER_BUILDING', 'INNER_TURRET', 'MID_LANE')).toBe('미드 2차 포탑');
  expect(r.buildingName('INHIBITOR_BUILDING', null, 'BOT_LANE')).toBe('바텀 억제기');
  expect(r.buildingName('TOWER_BUILDING', 'NEXUS_TURRET', 'MID_LANE')).toBe('쌍둥이 포탑');
  expect(r.dragonIconOf('FIRE_DRAGON')).toMatch(/dragon_icon\/화염\.svg$/);
  expect(r.dragonIconOf('ELDER_DRAGON')).toBeNull();
  expect(r.tierIconOf('GRANDMASTER')).toMatch(/lol_tier_icon\/grandmaster_icon\.webp$/);
  expect(r.tierIconOf(null)).toBeNull();
  expect(r.laneIconOf('UTILITY')).toMatch(/support_gold\.svg$/);
  expect(r.clockMs(754000)).toBe('12:34');
  expect(r.durationText(1884)).toBe('31분 24초');
  expect(r.kilo(61234)).toBe('61.2k');
});

test('숫자 칸은 값이 없어도 죽지 않는다 (옛 응답)', () => {
  const { num } = require('./riot');
  expect(num(30000)).toBe('30,000');
  expect(num(undefined)).toBe('-');
  expect(num(null)).toBe('-');
});
