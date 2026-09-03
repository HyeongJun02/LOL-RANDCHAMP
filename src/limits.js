/* 저장 한도.

   진짜 방어선은 DB 트리거와 함수다(sql/setup.sql). Data API는 브라우저가
   DB를 직접 찌르는 구조라, 여기 숫자는 우회하면 그만이다.
   이 파일의 역할은 "한도를 넘기 전에 곱게 알려주기"까지다.
   숫자를 바꾸면 sql/setup.sql도 같이 바꿔야 한다. */

/* 관리자는 한도 없음 */
export const ADMIN_USER_ID = '56a0f45a-26de-46f6-8edf-38b592a6caf7';

export const MAX_ROSTER = 60;

/* 방 (명세서 F) */
export const MAX_ROOMS = 5;
export const MAX_MEMBERS = 50;
export const MAX_ROOM_PLAYERS = 50;
export const MAX_SCRIMS = 1000;
export const MAX_LOGS = 500;

export const isAdmin = (userId) => userId === ADMIN_USER_ID;

export const LIMIT_MESSAGE = {
  roster: `팀원은 최대 ${MAX_ROSTER}명까지 저장할 수 있어요.`,
};

/* 로그인 안 한 사람은 localStorage만 쓰므로 서버 용량과 무관하다 */
export const withinLimit = (kind, count, userId) => {
  if (!userId || isAdmin(userId)) return true;
  return kind === 'roster' ? count <= MAX_ROSTER : true;
};
