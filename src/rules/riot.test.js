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

test('즐겨찾기: 별명이 같으면 한 묶음(부계정), 순서는 첫 계정 기준', () => {
  const { groupFavs, sameId } = require('./riot');
  const groups = groupFavs([
    { id: 'A#KR1', alias: '철수' },
    { id: 'B#KR1', alias: '' },
    { id: 'C#KR1', alias: ' 철수 ' },
    { id: 'D#KR1' },
    { id: 'E#KR1', alias: '영희' },
  ]);
  expect(groups).toEqual([
    { alias: '철수', ids: ['A#KR1', 'C#KR1'] },
    { alias: '', ids: ['B#KR1'] },
    { alias: '', ids: ['D#KR1'] },
    { alias: '영희', ids: ['E#KR1'] },
  ]);
  expect(sameId('Faker#KR1', 'faker#kr1')).toBe(true);
});

test('즐겨찾기 상한이 DB와 같다', () => {
  const fs = require('fs');
  const path = require('path');
  const { FAV_MAX, ALIAS_MAX } = require('./riot');
  const sql = fs.readFileSync(path.join(__dirname, '../../sql/setup.sql'), 'utf8');
  expect(sql).toContain(`jsonb_array_length(new.list) > ${FAV_MAX}`);
  expect(sql).toContain(`length(coalesce(x ->> 'alias', '')) > ${ALIAS_MAX}`);
});

test('큐 이름: 번호를 모르면 게임 모드를 한국어로', () => {
  const { queueName } = require('./riot');
  expect(queueName(480, 'SWIFTPLAY')).toBe('신속 플레이');
  expect(queueName(1700, 'CHERRY')).toBe('아레나');
  /* 처음 보는 번호여도 모드로 알아본다 */
  expect(queueName(99999, 'SWIFTPLAY')).toBe('신속 플레이');
  expect(queueName(99999, 'CHERRY')).toBe('아레나');
  expect(queueName(99999, 'NEWMODE')).toBe('NEWMODE');
});

test('관전 팀 평균 티어', () => {
  const { tierScore, tierFromScore } = require('./riot');
  expect(tierScore('IRON', 'IV')).toBe(0);
  expect(tierScore('GOLD', 'II')).toBe(14);
  expect(tierScore('MASTER', 'I')).toBe(28);
  expect(tierScore(null)).toBeNull();
  /* 골드 II(14)와 플래티넘 IV(16)의 평균 15 → 골드 I */
  expect(tierFromScore((14 + 16) / 2)).toBe('골드 I');
  expect(tierFromScore(28)).toBe('마스터');
  expect(tierFromScore(null)).toBeNull();
});

test('OP.GG 주소: 이름#태그 → 이름-태그', () => {
  const { opggUrl } = require('./riot');
  expect(opggUrl({ name: '행복한 돌잔치', tag: 'KR1' })).toBe(
    'https://op.gg/ko/lol/summoners/kr/%ED%96%89%EB%B3%B5%ED%95%9C%20%EB%8F%8C%EC%9E%94%EC%B9%98-KR1'
  );
});
