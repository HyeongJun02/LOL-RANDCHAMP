import fs from 'fs';
import path from 'path';
import {
  withinLimit,
  isAdmin,
  ADMIN_USER_ID,
  MAX_ROSTER,
  MAX_ROOMS,
  MAX_MEMBERS,
  MAX_ROOM_PLAYERS,
  MAX_SCRIMS,
} from './limits';

const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'setup.sql'), 'utf8');

test('로그인 안 한 사람은 한도가 없다 (서버를 안 쓰니까)', () => {
  expect(withinLimit('roster', 9999, null)).toBe(true);
});

test('관리자는 한도가 없다', () => {
  expect(isAdmin(ADMIN_USER_ID)).toBe(true);
  expect(withinLimit('roster', 9999, ADMIN_USER_ID)).toBe(true);
});

test('일반 사용자는 한도까지만', () => {
  const me = 'someone-else';
  expect(withinLimit('roster', MAX_ROSTER, me)).toBe(true);
  expect(withinLimit('roster', MAX_ROSTER + 1, me)).toBe(false);
});

/* 화면과 DB의 숫자가 어긋나면, 화면에서는 저장되는데 서버가 거절하는
   상황이 된다. 한쪽만 고치는 실수를 여기서 잡는다. */
test('DB의 숫자가 앱과 같다', () => {
  expect(sql).toContain(`> ${MAX_ROSTER} then`);
  expect(sql).toContain(`n >= ${MAX_ROOM_PLAYERS} then`);
  expect(sql).toContain(`n >= ${MAX_SCRIMS} then`);
  expect(sql).toContain(`n >= ${MAX_ROOMS} then raise`);
  expect(sql).toContain(`n >= ${MAX_MEMBERS} then raise`);
});

test('DB 트리거의 관리자 id가 앱과 같다', () => {
  expect(sql).toContain(ADMIN_USER_ID);
});

test('트리거가 실제로 걸려 있다', () => {
  expect(sql).toMatch(/create trigger app_state_limits[\s\S]*before insert or update on public\.app_state/);
});
