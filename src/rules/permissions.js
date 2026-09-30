/* 무슨 역할이 무엇을 할 수 있는가.

   여기 적힌 건 화면에 보여주는 표일 뿐이고, 실제로 막는 건 서버다
   (sql/setup.sql의 room_can). 한쪽만 고치면 화면은 된다고 적어두고
   서버가 거절하므로, 테스트가 두 쪽의 기능 이름을 대조한다.

   방장은 목록과 상관없이 전부 된다. 나머지 셋은 방마다 켜고 끈다. */

export const ROLES = [
  { key: 'owner', label: '방장' },
  { key: 'admin', label: '부방장' },
  { key: 'staff', label: '운영진' },
  { key: 'member', label: '멤버' },
];

/* 켜고 끌 수 있는 역할. 방장은 언제나 전부라 목록 밖이다 */
export const SET_ROLES = ROLES.filter((r) => r.key !== 'owner');

/* fixed: 넘길 수 없는 것. 부방장이 방을 지우거나 방장을 끌어내릴 수 있으면
   방장이라는 자리가 뜻이 없어진다.
   everyone: 멤버까지 되는 것 */
export const CAPS = [
  { key: 'record', label: '경기 기록', desc: '팀을 넣고 이긴 쪽을 남깁니다' },
  { key: 'bet', label: '또또 진행', desc: '열고 마감하고 결과를 넣습니다' },
  { key: 'roster', label: '참가자 명단', desc: '뛰는 사람과 티어를 고칩니다' },
  { key: 'member', label: '멤버 연결', desc: '계정을 참가자와 잇습니다' },
  { key: 'style', label: '방 이름·꾸미기', desc: '이름과 색을 바꿉니다' },
  { key: 'account', label: '계정 옮기기', desc: '계정을 바꿨을 때 기록을 옮깁니다' },
  { key: 'adjust', label: '끼꼬 조정', desc: '남의 끼꼬를 직접 올리고 내립니다' },
  { key: 'undo', label: '또또 되돌리기', desc: '오간 끼꼬를 전부 되돌립니다' },
  { key: 'code_reset', label: '입장 코드 재발급', desc: '예전 코드를 못 쓰게 합니다' },
  { key: 'code', label: '입장 코드 보기', desc: '멤버면 누구나 봅니다', everyone: true },
  { key: 'role', label: '역할 주기·내보내기', desc: '방장만 할 수 있습니다', fixed: true },
  { key: 'room', label: '방장 넘기기·방 삭제', desc: '방장만 할 수 있습니다', fixed: true },
];

/* 새 방이 시작하는 자리. setup.sql의 rooms.role_caps 기본값과 같아야 한다.
   부방장은 예전 그대로, 운영진은 방 살림만, 멤버는 없음 */
export const DEFAULT_ROLE_CAPS = {
  admin: ['record', 'bet', 'roster', 'member', 'style', 'account'],
  staff: ['roster', 'member', 'style', 'account'],
  member: [],
};

/* 이 역할이 이 기능을 할 수 있나. caps는 방의 role_caps.
   cap은 CAPS의 한 줄이거나 그 key 문자열 */
export const allows = (role, cap, caps = DEFAULT_ROLE_CAPS) => {
  const c = typeof cap === 'string' ? CAPS.find((x) => x.key === cap) : cap;
  if (!c) return false;
  if (c.everyone) return true;
  if (role === 'owner') return true;
  if (c.fixed) return false;
  const list = (caps || DEFAULT_ROLE_CAPS)[role] || DEFAULT_ROLE_CAPS[role];
  return Boolean(list && list.includes(c.key));
};
