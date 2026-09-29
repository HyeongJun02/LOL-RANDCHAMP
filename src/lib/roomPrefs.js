/* 방 목록을 어떻게 볼지. 이 기기에만 남는다.

   서버에 둘 수도 있지만 그러면 목록을 읽을 때마다 한 번 더 왕복한다.
   '어떤 순서로 볼지'는 남들과 나눌 값도 아니고, 기기마다 달라도
   이상하지 않다. localStorage면 충분하다. */

const KEY = 'lrc.roomPrefs';

export const SORTS = [
  { key: 'played', label: '최근 플레이' },
  { key: 'kkiko', label: '끼꼬' },
  { key: 'members', label: '인원' },
  { key: 'name', label: '가나다' },
];

export const DEFAULT_SORT = 'played';

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

const write = (next) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 사파리 프라이빗 모드 등. 이번 세션에서만 유지된다 */
  }
};

export const getSort = () => {
  const s = read().sort;
  return SORTS.some((x) => x.key === s) ? s : DEFAULT_SORT;
};

export const setSort = (sort) => write({ ...read(), sort });

/* 핀은 id 목록. 방을 나가도 남지만, 목록에 없는 id는 그냥 안 쓰인다 */
export const getPinned = () => {
  const p = read().pinned;
  return Array.isArray(p) ? p.map(Number) : [];
};

export const togglePin = (id) => {
  const pinned = getPinned();
  const next = pinned.includes(Number(id))
    ? pinned.filter((x) => x !== Number(id))
    : [...pinned, Number(id)];
  write({ ...read(), pinned: next });
  return next;
};

/* 핀 → 또또 진행 중 → 고른 순서.
   핀은 '내가 자주 가는 방'이고 진행 중은 '지금 급한 방'이라, 둘 다
   고른 정렬보다 위다. 셋을 한 줄로 쓰면 어느 게 먼저인지 헷갈리니
   여기 한 곳에서만 정한다 */
export const sortRooms = (rooms, sort, pinned) => {
  const pin = new Set(pinned.map(Number));
  const rank = (r) => (pin.has(Number(r.id)) ? 0 : 1);

  const by = {
    name: (a, b) => a.name.localeCompare(b.name, 'ko'),
    kkiko: (a, b) => (b.myPoints ?? 0) - (a.myPoints ?? 0),
    members: (a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0),
    /* 한 판도 안 한 방은 맨 뒤로. 0으로 두면 이름순에 섞여 버린다 */
    played: (a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0),
  };
  const cmp = by[sort] || by[DEFAULT_SORT];

  return [...rooms].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (Boolean(b.live) ? 1 : 0) - (Boolean(a.live) ? 1 : 0) ||
      cmp(a, b) ||
      a.name.localeCompare(b.name, 'ko')
  );
};
