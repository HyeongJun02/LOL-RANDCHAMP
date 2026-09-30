/* 무슨 역할이 무엇을 할 수 있는가.

   여기 적힌 건 화면에 보여주는 표일 뿐이고, 실제로 막는 건 서버다
   (sql/setup.sql의 is_room_owner / is_room_admin / is_room_recorder).
   한쪽만 고치면 화면은 된다고 적어두고 서버가 거절하므로, 테스트가
   두 쪽을 대조한다.

   서버의 세 관문이 곧 이 표의 세 단계다.
     owner    … 방장만
     admin    … 방장 + 부방장 (방의 admin_scope가 full일 때)
     recorder … 방장 + 부방장 (범위와 상관없이) */

export const ROLES = [
  { key: 'owner', label: '방장' },
  { key: 'admin', label: '부방장' },
  { key: 'member', label: '멤버' },
];

/* need: 이 기능을 지키는 서버 관문 */
export const CAPS = [
  {
    key: 'record',
    need: 'recorder',
    label: '경기 기록',
    desc: '팀을 넣고 이긴 쪽을 남깁니다.',
  },
  {
    key: 'bet',
    need: 'recorder',
    label: '또또 열기·마감·정산',
    desc: '배팅을 열고 닫고, 결과를 넣어 끼꼬를 나눕니다.',
  },
  {
    key: 'roster',
    need: 'admin',
    label: '참가자 명단',
    desc: '뛰는 사람을 넣고 빼고, 티어를 고칩니다.',
  },
  {
    key: 'member',
    need: 'admin',
    label: '멤버 연결·유령 멤버',
    desc: '계정을 참가자와 잇고, 가입 안 한 친구 자리를 만듭니다.',
  },
  {
    key: 'style',
    need: 'admin',
    label: '방 이름·꾸미기',
    desc: '방 이름과 색·엠블럼을 바꿉니다.',
  },
  {
    key: 'account',
    need: 'admin',
    label: '계정 옮기기',
    desc: '구글 계정을 바꿨을 때 기록을 통째로 옮깁니다.',
  },
  {
    key: 'code',
    need: 'member',
    label: '입장 코드 보기',
    desc: '친구를 부를 때 쓰는 코드입니다. 멤버면 누구나 볼 수 있어요.',
  },
  {
    key: 'code_reset',
    need: 'owner',
    label: '입장 코드 새로 뽑기',
    desc: '예전 코드를 못 쓰게 막습니다.',
  },
  {
    key: 'adjust',
    need: 'owner',
    label: '끼꼬 조정',
    desc: '남의 끼꼬를 직접 올리고 내립니다. 로그에 반드시 남습니다.',
  },
  {
    key: 'undo',
    need: 'owner',
    label: '또또 취소·정산 되돌리기',
    desc: '오간 끼꼬를 전부 되돌립니다.',
  },
  {
    key: 'role',
    need: 'owner',
    label: '부방장 임명·내보내기',
    desc: '누가 무엇을 할 수 있는지 정하고, 사람을 내보냅니다.',
  },
  {
    key: 'room',
    need: 'owner',
    label: '방장 넘기기·방 삭제',
    desc: '되돌릴 수 없는 것들입니다.',
  },
];

export const SCOPES = [
  {
    key: 'full',
    label: '전체',
    desc: '방장이 하는 것 대부분을 부방장도 합니다. 돈을 되돌리거나 사람을 내보내는 것만 방장 몫입니다.',
  },
  {
    key: 'record',
    label: '기록까지',
    desc: '경기와 또또만 남깁니다. 명단·멤버·방 설정은 못 건드립니다.',
  },
];

/* 이 역할이 이 기능을 할 수 있나. scope는 방의 admin_scope */
export const allows = (role, cap, scope = 'full') => {
  if (cap.need === 'member') return true;
  if (role === 'owner') return true;
  if (role !== 'admin') return false;
  if (cap.need === 'recorder') return true;
  return cap.need === 'admin' && scope === 'full';
};
