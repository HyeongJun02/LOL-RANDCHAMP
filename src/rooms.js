import { useCallback, useEffect, useRef, useState } from 'react';
import { neon, isNeonConfigured } from './neon';

/* 내전 방. 여기부터는 localStorage가 없다.

   방은 계정이 아니라 서버에 있고 여러 명이 같이 본다. 그래서 한 사람의
   기기에 캐시를 두면 그 순간부터 사람마다 다른 화면을 보게 된다.
   항상 서버에서 읽는다.

   포인트/권한을 바꾸는 건 전부 DB 함수(rpc)로만 한다. 브라우저가 DB를
   직접 찌르는 구조라, 테이블 쓰기를 열어주면 콘솔 한 줄로 방장이 될 수 있다.
   테이블 직접 쓰기는 RLS로 막히는 것들(참가자 명단, 경기 기록)만 남겼다. */

const NOT_READY = '서버에 연결되어 있지 않아요.';

const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

/* RETURNS <테이블타입> 함수는 단일 객체로 오지만, 드라이버에 따라
   한 칸짜리 배열로 오기도 한다. 양쪽 다 받는다 */
const first = (d) => (Array.isArray(d) ? d[0] : d) || null;

const rpc = async (fn, args) => {
  if (!isNeonConfigured) throw new Error(NOT_READY);
  return unwrap(await neon.rpc(fn, args));
};

/* ---------- 프로필 ---------- */

/* 로그인 직후 딱 한 번. 프로필을 만들고, 달이 넘어갔으면 시즌도 여기서 롤린다 */
export const fetchMe = () => rpc('get_me').then(first);

export const setNickname = async (nickname) => {
  const name = nickname.trim();
  if (name.length > 12) throw new Error('닉네임은 12자까지예요.');
  if (!isNeonConfigured) throw new Error(NOT_READY);
  /* points/role은 컬럼 GRANT에서 막혀 있다. 여기서 뭘 더 보내도 거절된다 */
  return unwrap(await neon.from('profiles').update({ nickname: name || null }));
};

/* ---------- 방 만들기 / 입장 ---------- */

export const createRoom = (name) => rpc('create_room', { p_name: name }).then(first);
export const joinRoom = (code) => rpc('join_room', { p_code: code });

export const getJoinCode = (roomId) => rpc('get_join_code', { p_room: roomId });
export const resetJoinCode = (roomId) => rpc('reset_join_code', { p_room: roomId });

export const setMemberRole = (roomId, userId, role) =>
  rpc('set_member_role', { p_room: roomId, p_user: userId, p_role: role });
export const transferRoom = (roomId, userId) =>
  rpc('transfer_room', { p_room: roomId, p_user: userId });
export const kickMember = (roomId, userId) =>
  rpc('kick_member', { p_room: roomId, p_user: userId });
export const leaveRoom = (roomId) => rpc('leave_room', { p_room: roomId });
export const deleteRoom = (roomId) => rpc('delete_room', { p_room: roomId });

export const renameRoom = async (roomId, name) => {
  if (!isNeonConfigured) throw new Error(NOT_READY);
  return unwrap(await neon.from('rooms').update({ name: name.trim() }).eq('id', roomId));
};

/* ---------- 참가자 명단 ---------- */
/* RLS가 방장·부방장만 쓰게 막는다. 돈이 안 걸린 데이터라 함수까지는 필요 없다 */

export const addRoomPlayer = async (roomId, player) => {
  if (!isNeonConfigured) throw new Error(NOT_READY);
  return unwrap(
    await neon
      .from('room_players')
      .insert({ room_id: roomId, tier: 'GOLD', division: 4, ...player })
  );
};

/* 이름만 바꾸면 끝이다. 경기는 이 행의 id를 보고 있어서 손댈 게 없다 */
export const updateRoomPlayer = async (id, patch) => {
  if (!isNeonConfigured) throw new Error(NOT_READY);
  return unwrap(await neon.from('room_players').update(patch).eq('id', id));
};

export const removeRoomPlayer = async (id) => {
  if (!isNeonConfigured) throw new Error(NOT_READY);
  return unwrap(await neon.from('room_players').delete().eq('id', id));
};

/* ---------- 경기 ---------- */

export const addScrim = async ({ roomId, mode, teamA, teamB, winner }) => {
  if (!isNeonConfigured) throw new Error(NOT_READY);
  return unwrap(
    await neon
      .from('scrims')
      .insert({ room_id: roomId, mode, team_a: teamA, team_b: teamB, winner })
  );
};

export const removeScrim = async (id) => {
  if (!isNeonConfigured) throw new Error(NOT_READY);
  return unwrap(await neon.from('scrims').delete().eq('id', id));
};

/* 기록지는 이름을 손으로 친다. 명단에 없는 이름이 나오면 참가자로 먼저
   등록하고 그 id로 경기를 남긴다. 그래야 손님으로 한 판 뛴 사람도
   다음부터 이름을 골라 쓸 수 있고, 전적이 한 사람으로 모인다 */
export const addScrimByNames = async ({ roomId, mode, teamA, teamB, winner, players }) => {
  if (!isNeonConfigured) throw new Error(NOT_READY);

  const idOf = new Map(players.map((p) => [p.name, p.id]));
  const missing = [...new Set([...teamA, ...teamB])].filter((n) => !idOf.has(n));

  if (missing.length > 0) {
    const rows = unwrap(
      await neon
        .from('room_players')
        .insert(missing.map((name) => ({ room_id: roomId, name })))
        .select()
    );
    (rows || []).forEach((r) => idOf.set(r.name, r.id));
  }

  return addScrim({
    roomId,
    mode,
    teamA: teamA.map((n) => idOf.get(n)),
    teamB: teamB.map((n) => idOf.get(n)),
    winner,
  });
};

/* scrims는 이름 대신 room_players.id를 담는다. 이름은 여기서 붙인다.
   참가자가 50명뿐이라 맵 한 번이면 되고, 그 대가로 matches.js의 집계를
   한 줄도 안 고치고 그대로 쓴다.

   명단에서 지워진 참가자의 id는 남아 있을 수 있다. 그 자리는 버린다 */
export const toMatches = (scrims = [], players = []) => {
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const names = (ids) => (ids || []).map((id) => nameOf.get(id)).filter(Boolean);
  return scrims
    .map((s) => ({
      id: s.id,
      mode: s.mode,
      teamA: names(s.team_a),
      teamB: names(s.team_b),
      winner: s.winner,
      playedAt: new Date(s.played_at).getTime(),
    }))
    .sort((a, b) => a.playedAt - b.playedAt);
};

/* ---------- 읽기 ---------- */

/* 로딩/에러/재조회를 매번 손으로 쓰지 않으려고 한 겹만 둔다.
   fetcher는 호출하는 쪽에서 useCallback으로 묶어서 넘길 것 */
const useFetch = (fetcher, enabled = true) => {
  const [state, setState] = useState({ loading: enabled, data: null, error: null });
  /* 응답이 늦게 도착한 옛 요청이 새 화면을 덮어쓰지 않게 한다 */
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled) {
      setState({ loading: false, data: null, error: null });
      return;
    }
    const mine = (seq.current += 1);
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fetcher();
      if (seq.current === mine) setState({ loading: false, data, error: null });
    } catch (e) {
      if (seq.current === mine) setState({ loading: false, data: null, error: e.message });
    }
  }, [fetcher, enabled]);

  useEffect(() => {
    reload();
    return () => {
      seq.current += 1;
    };
  }, [reload]);

  return { ...state, reload };
};

export const useMe = (userId) => {
  const fetcher = useCallback(() => fetchMe(), []);
  const { data, loading, error, reload } = useFetch(
    fetcher,
    Boolean(userId) && isNeonConfigured
  );
  return { me: data, loading, error, reload };
};

export const useMyRooms = (userId) => {
  const fetcher = useCallback(async () => {
    /* RLS가 내가 멤버인 방만 돌려준다. 따로 걸 조건이 없다 */
    const rooms = unwrap(
      await neon.from('rooms').select('id,name,owner_id,version,created_at')
    );
    const members = unwrap(await neon.from('room_members').select('room_id,user_id,role'));
    const countOf = new Map();
    members.forEach((m) => countOf.set(m.room_id, (countOf.get(m.room_id) || 0) + 1));
    const roleOf = new Map(
      members.filter((m) => m.user_id === userId).map((m) => [m.room_id, m.role])
    );
    return (rooms || [])
      .map((r) => ({ ...r, memberCount: countOf.get(r.id) || 0, myRole: roleOf.get(r.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [userId]);

  const { data, loading, error, reload } = useFetch(
    fetcher,
    Boolean(userId) && isNeonConfigured
  );
  return { rooms: data || [], loading, error, reload };
};

/* 방 상세를 몇 번에 나눠 받을지가 곧 DB 부하다.
   PostgREST가 FK를 따라 한 번에 묶어주므로 방+멤버+참가자+경기는 한 요청이다.
   프로필만 FK가 없어 따로 받는다 (RLS가 같은 방 사람으로 이미 좁혀준다) */
const ROOM_SELECT =
  'id,name,owner_id,version,created_at,' +
  'room_members(user_id,role,joined_at),' +
  'room_players(id,name,tier,division,linked_user_id),' +
  'scrims(id,mode,team_a,team_b,winner,played_at)';

/* 탭이 보일 때만, 30초마다. 실시간 구독이 없어 폴링이 불가피한데
   방 전체를 매번 읽으면 그게 곧 부하다. version 한 컬럼만 보고
   값이 달라졌을 때만 상세를 다시 받는다 */
const POLL_MS = 30000;

export const useRoom = (roomId, userId) => {
  const fetcher = useCallback(async () => {
    const room = unwrap(
      await neon.from('rooms').select(ROOM_SELECT).eq('id', roomId).maybeSingle()
    );
    if (!room) throw new Error('방을 찾을 수 없어요. 나갔거나 삭제된 방입니다.');
    const profiles = unwrap(await neon.from('profiles').select('user_id,nickname,points'));
    return { room, profiles: profiles || [] };
  }, [roomId]);

  const enabled = Boolean(roomId) && Boolean(userId) && isNeonConfigured;
  const { data, loading, error, reload } = useFetch(fetcher, enabled);

  const version = data?.room?.version;
  useEffect(() => {
    if (!enabled || version === undefined) return undefined;
    let timer;
    /* 무슨 일이 있어도 다음 차례를 다시 잡는다.
       reload 뒤에 그냥 return하면, 실패하거나 값이 그대로일 때
       타이머가 끊겨 폴링이 조용히 죽는다 */
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const row = unwrap(
            await neon.from('rooms').select('version').eq('id', roomId).maybeSingle()
          );
          if (row && row.version !== version) reload();
        } catch {
          /* 잠깐 끊긴 것뿐이다. 다음 차례에 다시 본다 */
        }
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => clearTimeout(timer);
  }, [enabled, roomId, version, reload]);

  const room = data?.room || null;
  const members = room?.room_members || [];
  const players = room?.room_players || [];
  const profileOf = new Map((data?.profiles || []).map((p) => [p.user_id, p]));

  return {
    room,
    loading,
    error,
    reload,
    players: [...players].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    matches: toMatches(room?.scrims, players),
    members: members
      .map((m) => ({
        ...m,
        nickname: profileOf.get(m.user_id)?.nickname || '이름 없음',
        points: profileOf.get(m.user_id)?.points ?? 0,
      }))
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]),
    myRole: members.find((m) => m.user_id === userId)?.role || null,
  };
};

const ROLE_ORDER = { owner: 0, admin: 1, member: 2 };

export const ROLE_LABEL = { owner: '방장', admin: '부방장', member: '멤버' };

export const canEdit = (role) => role === 'owner' || role === 'admin';
