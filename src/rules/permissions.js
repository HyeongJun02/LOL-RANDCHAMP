/* 무슨 역할이 무엇을 할 수 있는가.

   여기 적힌 건 화면에 보여주는 표일 뿐이고, 실제로 막는 건 서버다
   (sql/setup.sql의 room_can). 한쪽만 고치면 화면은 된다고 적어두고
   서버가 거절하므로, 테스트가 두 쪽의 기능 이름을 대조한다.

   방장은 목록과 상관없이 전부 된다. 부방장만 방마다 켜고 끈다. */

export const ROLES = [
  { key: 'owner', label: '방장' },
  { key: 'admin', label: '부방장' },
  { key: 'member', label: '멤버' },
];

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
  { key: 'role', label: '부방장 임명·내보내기', desc: '방장만 할 수 있습니다', fixed: true },
  { key: 'room', label: '방장 넘기기·방 삭제', desc: '방장만 할 수 있습니다', fixed: true },
];

/* 예전 '부방장'이 하던 그대로. 새 방은 여기서 시작한다 */
export const DEFAULT_CAPS = ['record', 'bet', 'roster', 'member', 'style', 'account'];

/* 이 역할이 이 기능을 할 수 있나. caps는 방의 admin_caps */
export const allows = (role, cap, caps = DEFAULT_CAPS) => {
  if (cap.everyone) return true;
  if (role === 'owner') return true;
  if (role !== 'admin') return false;
  if (cap.fixed) return false;
  return (caps || DEFAULT_CAPS).includes(cap.key);
};
