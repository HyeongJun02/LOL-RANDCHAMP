import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FaArrowLeft,
  FaKey,
  FaPlus,
  FaSync,
  FaTimes,
  FaHome,
  FaPlay,
  FaDice,
  FaChartBar,
  FaCoins,
  FaListUl,
  FaCog,
  FaGhost,
  FaLink,
  FaExclamationTriangle,
  FaRegCopy,
  FaPalette,
  FaExchangeAlt,
  FaUserCheck,
  FaLock,
  FaUserShield,
  FaUserPlus,
  FaEllipsisH,
  FaUsers,
} from 'react-icons/fa';
import { useAuth } from '../../auth/AuthContext';
import {
  useRoom,
  useHallOfFame,
  canEdit as canEditRole,
  ROLE_LABEL,
  addRoomPlayer,
  updateRoomPlayer,
  removeRoomPlayer,
  mergeRoomPlayers,
  addScrimByNames,
  openBettingByNames,
  removeScrim,
  renameRoom,
  getJoinCode,
  resetJoinCode,
  setMemberRole,
  transferRoom,
  kickMember,
  transferAccount,
  setAdminCap,
  setRoomStyle,
  linkRoomPlayer,
  addGhostMember,
  removeGhostMember,
  leaveRoom,
  deleteRoom,
} from '../../server/rooms';
import { getGame, getTier } from '../../rules/games';
import { GameProvider, useGame, useGameKey } from '../../lib/GameContext';
import { ACCENTS, EMBLEMS, accentVars } from '../../lib/roomStyle';
import { titlesOf } from '../../rules/titles';
import { MAX_ROOM_PLAYERS } from '../../server/limits';
import { ROLES, CAPS, DEFAULT_CAPS, allows } from '../../rules/permissions';
import ScrimRecord from '../scrimRecord/ScrimRecord';
import Season from '../season/Season';
import MatchHistory from './MatchHistory';
import RoomSwitch from './RoomSwitch';
import HallOfFame from './HallOfFame';
import MemberModal from './MemberModal';
import BetTab from './BetTab';
import KkikoTab from './KkikoTab';
import FeedTab from './FeedTab';
import RoomHome from './RoomHome';
import { useDialog } from '../../components/common/Dialog';
import { copyText } from '../../lib/clipboard';
import RosterLoader from '../../components/common/RosterLoader';
import RosterLoadButton from '../../components/common/RosterLoadButton';
import { useRoster, mergeMembers } from '../../server/roster';
import NicknameGate from '../../components/rooms/NicknameGate';
import { SkelLine, SkelRows } from '../../components/common/Skeleton';
import { usePageMeta, PAGE_META } from '../../lib/seo';
import './Rooms.css';

/* 탭 순서 = 실제로 쓰는 순서. 방에 들어와서 게임을 시작하고, 또또를 열고,
   끝나면 기록을 본다. 홈은 이 전부로 가는 갈림길이라 맨 앞이다.

   group은 성격이 다른 탭 사이에 선을 긋기 위한 것이다. 일곱 개가
   나란히 붙어 있으면 게임 얘기와 돈 얘기가 구분이 안 된다.
   홈 | 게임·기록 | 또또·포인트 | 로그 | 설정 */
const TABS = [
  { key: 'home', group: 0, label: '홈', icon: <FaHome />, desc: '이 방에서 할 수 있는 것들' },
  { key: 'record', group: 1, label: '게임 시작', icon: <FaPlay />, desc: '팀을 넣고 승패를 기록합니다' },
  /* 팀을 넣는 화면과 지난 판을 훑는 화면은 하는 일이 다르다.
     한 판 기록하려고 들어왔다가 목록을 지나쳐야 했고, 지난 판을 보려면
     입력칸부터 스크롤해야 했다 */
  { key: 'history', group: 1, label: '내전 기록', icon: <FaListUl />, desc: '지난 판과 또또 결과' },
  { key: 'stats', group: 1, label: '통계', icon: <FaChartBar />, desc: '순위·시즌 정산·명예의 전당' },
  { key: 'bet', group: 2, label: '또또', icon: <FaDice />, desc: '끼꼬를 걸고 결과를 맞힙니다' },
  { key: 'kkiko', group: 2, label: '포인트', icon: <FaCoins />, desc: '끼꼬 잔액과 주고받기' },
  { key: 'feed', group: 3, label: '로그', icon: <FaListUl />, desc: '방에서 일어난 일들' },
  { key: 'settings', group: 4, label: '설정', icon: <FaCog />, desc: '참가자·멤버·입장 코드' },
];

/* 이름은 타이핑마다 저장하면 안 된다. 키 하나마다 UPDATE 한 번에
   방 전체 재조회까지 붙는다. 초안을 들고 있다가 입력을 끝냈을 때 한 번만 보낸다.
   티어/디비전은 선택 한 번이 곧 확정이라 바로 보낸다 */
const PlayerRow = ({ player, onPatch, onDrop }) => {
  const game = useGame();
  const gameKey = useGameKey();
  const [draft, setDraft] = useState(player.name);
  const tier = getTier(gameKey, player.tier);

  const commit = () => {
    const name = draft.trim();
    if (!name || name === player.name) {
      setDraft(player.name);
      return;
    }
    onPatch(player.id, { name });
  };

  return (
    <div className="room-player">
      <input
        className="rooms-input"
        value={draft}
        maxLength={16}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <select
        value={player.tier}
        style={{ color: tier.color }}
        onChange={(e) => onPatch(player.id, { tier: e.target.value })}
      >
        {/* 색은 항목마다 스스로 정한다. select에만 주면 펼친 목록 전체가
            그 색으로 물든다 - 마스터를 고르면 모든 줄이 보라색이 됐다 */}
        {game.tiers.map((t) => (
          <option key={t.key} value={t.key} style={{ color: t.color }}>
            {t.label}
          </option>
        ))}
      </select>
      <select
        value={player.division}
        disabled={!tier.divisions}
        onChange={(e) => onPatch(player.id, { division: Number(e.target.value) })}
      >
        {tier.divisions ? (
          game.divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))
        ) : (
          <option value={player.division}>-</option>
        )}
      </select>
      <button className="row-del" onClick={() => onDrop(player)} aria-label={`${player.name} 삭제`}>
        <FaTimes />
      </button>
    </div>
  );
};

/* '9/12' 정도면 충분하다. 해가 넘어간 기록이면 연도까지 */
const dayText = (ts) => {
  const d = new Date(ts);
  const y = d.getFullYear() === new Date().getFullYear() ? '' : `${d.getFullYear()}. `;
  return `${y}${d.getMonth() + 1}/${d.getDate()}`;
};

/* 권한이 없어도 보이긴 한다. 아예 감춰두면 이 방에서 무엇을 할 수 있는
   방인지 알 수가 없고, 방장에게 무엇을 부탁해야 하는지도 모른다.
   fieldset 하나면 안쪽 입력칸·단추를 브라우저가 전부 잠가준다 */
const Panel = ({ head, locked, children }) => (
  <section className={`room-panel ${locked ? 'is-locked' : ''}`}>
    <h3>
      {head}
      {locked && (
        <span className="panel-lock">
          <FaLock /> 방장만
        </span>
      )}
    </h3>
    <fieldset disabled={locked}>{children}</fieldset>
  </section>
);

/* 설정 묶음. 권한이 없으면 잠긴 채로 보인다 */
const Settings = ({ room, members, players, lostPlayers, titles, myRole, myId, reload, onGone }) => {
  const gameKey = useGameKey();
  const isOwner = myRole === 'owner';
  const isAdmin = canEditRole(myRole);
  const [name, setName] = useState(room.name);
  const [code, setCode] = useState(null);
  const [newName, setNewName] = useState('');
  /* 같은 사람인데 이름을 바꿔 가며 두 줄로 쌓인 경우. 자주 있는 일이 아니라
     줄마다 버튼을 달지 않고 아래에 한 줄만 둔다 */
  const [mergeKeep, setMergeKeep] = useState('');
  const [mergeDrop, setMergeDrop] = useState('');
  /* 기록에만 남은 자리마다 '누구인가' 고른 값. id → 참가자 id */
  const [lostPick, setLostPick] = useState({});
  const [ghostName, setGhostName] = useState('');
  const [showLoader, setShowLoader] = useState(false);
  /* 관리 팝업을 띄운 멤버의 user_id. 객체로 들고 있으면 폴링이 한 번 돌 때
     옛 값이 화면에 남아 끼꼬가 갱신되지 않는다 */
  const [openMem, setOpenMem] = useState(null);
  const busy = useRef(false);
  const { confirm } = useDialog();
  const roster = useRoster(gameKey);

  /* 내 팀원 명단에 있는 사람과 없는 사람. 내전에 매번 오는 사람은 내
     명단에 들어 있고, 어쩌다 한 번 낀 사람은 없다. 섞어두면 '이 사람 내
     명단에 넣어뒀나'를 매번 헷갈린다 */
  const inRoster = (p) => roster.some((m) => m.name.trim() === p.name.trim());
  const known = players.filter(inRoster);
  const guests = players.filter((p) => !inRoster(p));

  /* 같은 사람인데 방 명단과 내 팀원 명단의 티어가 다른 경우.
     한쪽만 고치고 잊으면 팀 짜기가 엉뚱한 평점으로 돌아간다 */
  const tierGap = players
    .map((p) => ({ p, mine: roster.find((m) => m.name.trim() === p.name.trim()) }))
    .filter(
      ({ p, mine }) => mine && (mine.tier !== p.tier || Number(mine.division) !== Number(p.division))
    );

  const guard = (fn) => async (...args) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await fn(...args);
    } catch (e) {
      toast.error(e.message);
    } finally {
      busy.current = false;
    }
  };

  const showCode = guard(async () => setCode(await getJoinCode(room.id)));

  /* 코드를 눈으로 읽어 카톡에 옮겨 적는 게 제일 흔한 실수 자리다.
     아직 안 열어봤으면 여기서 받아와서 바로 복사한다 */
  const copyCode = guard(async () => {
    const value = code || (await getJoinCode(room.id));
    setCode(value);
    if (await copyText(value)) toast.success(`입장 코드 ${value} 를 복사했어요.`);
    else toast.error('복사가 막혀 있어요. 코드를 직접 눌러 복사해 주세요.');
  });
  const rerollCode = guard(async () => {
    const ok = await confirm({
      title: '입장 코드 새로 뽑기',
      message: '코드를 새로 뽑을까요?',
      detail: '예전 코드는 더 이상 못 씁니다. 이미 들어온 사람은 그대로 남아요.',
      confirmText: '새로 뽑기',
    });
    if (!ok) return;
    setCode(await resetJoinCode(room.id));
    toast.success('새 코드를 뽑았어요.');
  });

  const saveStyle = guard(async (patch) => {
    await setRoomStyle(room.id, patch);
    reload();
  });

  const saveName = guard(async () => {
    await renameRoom(room.id, name);
    toast.success('방 이름을 바꿨어요.');
    reload();
  });

  const addPlayer = guard(async () => {
    if (!newName.trim()) return;
    await addRoomPlayer(room.id, { name: newName.trim() }, gameKey);
    setNewName('');
    reload();
  });

  /* 내 팀원 명단에서 한 번에 데려온다. 방 참가자는 지난 경기가 물려 있어
     빼면 안 되므로, 이미 있는 사람은 잠그고 새로 고른 사람만 넣는다 */
  const addFromRoster = guard(async (members_) => {
    const have = new Set(players.map((p) => p.name.trim()));
    const fresh = members_.filter((m) => m.name.trim() && !have.has(m.name.trim()));
    if (fresh.length === 0) return;
    const room_ = MAX_ROOM_PLAYERS - players.length;
    const take = fresh.slice(0, Math.max(0, room_));
    for (const m of take) {
      await addRoomPlayer(room.id, { name: m.name.trim(), tier: m.tier, division: m.division }, gameKey);
    }
    if (take.length < fresh.length) {
      toast.error(`자리가 모자라 ${fresh.length - take.length}명은 못 넣었어요.`);
    } else {
      toast.success(`${take.length}명을 명단에 넣었어요.`);
    }
    reload();
  });

  /* 방 명단 → 내 팀원 명단. 방 참가자는 방장이 관리하니 그쪽이 기준이다 */
  const pullTiers = guard(async () => {
    mergeMembers(
      gameKey,
      tierGap.map(({ p }) => ({ name: p.name, tier: p.tier, division: p.division }))
    );
    toast.success(`${tierGap.length}명의 티어를 내 팀원 명단에 맞췄어요.`);
  });

  /* 내 팀원 명단 → 방 명단 */
  const pushTiers = guard(async () => {
    for (const { p, mine } of tierGap) {
      await updateRoomPlayer(p.id, { tier: mine.tier, division: mine.division });
    }
    toast.success(`${tierGap.length}명의 티어를 방 명단에 반영했어요.`);
    reload();
  });

  const patchPlayer = guard(async (id, patch) => {
    await updateRoomPlayer(id, patch);
    reload();
  });

  const dropPlayer = guard(async (p) => {
    const ok = await confirm({
      title: '참가자 삭제',
      message: `'${p.name}' 님을 명단에서 지울까요?`,
      detail: '지난 경기 기록은 그대로 남습니다.',
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    await removeRoomPlayer(p.id);
    reload();
  });

  /* 이름만 고치면 지난 경기는 여전히 옛 줄을 가리킨다 (경기가 id를 들고
     있다). 전적을 붙이려면 경기 쪽 id까지 갈아끼워야 해서 서버가 한다 */
  const mergePlayers = guard(async () => {
    const keep = players.find((p) => String(p.id) === mergeKeep);
    const drop = players.find((p) => String(p.id) === mergeDrop);
    if (!keep || !drop || keep.id === drop.id) {
      toast.error('합칠 두 사람을 서로 다르게 골라주세요.');
      return;
    }
    const ok = await confirm({
      title: '같은 사람 합치기',
      message: `'${drop.name}' 님의 전적을 '${keep.name}' 님에게 넘길까요?`,
      detail: `'${drop.name}'은(는) 명단에서 사라지고, 그 이름으로 뛴 지난 경기가 전부 '${keep.name}'의 기록이 됩니다. 되돌릴 수 없어요.`,
      confirmText: '합치기',
      danger: true,
    });
    if (!ok) return;
    const moved = await mergeRoomPlayers(keep.id, drop.id);
    setMergeKeep('');
    setMergeDrop('');
    toast.success(`합쳤어요. '${keep.name}' 님 경기가 ${moved}판입니다.`);
    reload();
  });

  /* 기록에만 남은 자리가 누구였는지 지정한다. 합치기와 같은 함수를 쓴다 -
     '그 id로 뛴 경기를 이 사람 것으로 옮긴다'로 하는 일이 똑같다 */
  const assignLost = guard(async (x) => {
    const keep = players.find((p) => String(p.id) === lostPick[x.id]);
    if (!keep) return;
    const ok = await confirm({
      title: '이 자리가 누구인지 지정',
      message: `#${x.id} 자리(${x.games}판)가 '${keep.name}' 님인가요?`,
      detail: `그 자리로 뛴 지난 경기 ${x.games}판이 전부 '${keep.name}'의 기록이 됩니다. 되돌릴 수 없어요.`,
      confirmText: '지정',
      danger: true,
    });
    if (!ok) return;
    await mergeRoomPlayers(keep.id, x.id);
    setLostPick({ ...lostPick, [x.id]: '' });
    toast.success(`'${keep.name}' 님의 기록으로 합쳤어요.`);
    reload();
  });

  /* 멤버 한 명당 참가자 하나. 이미 다른 멤버가 가져간 참가자는 아래에서
     못 고르게 막아두므로 여기서는 그대로 보낸다 */
  /* 유령은 뛰라고 만든 자리표시자라 같이 센다. 이어져야 포인트가 간다 */
  const unlinked = members.filter((m) => !m.player);

  const link = guard(async (m, playerId) => {
    await linkRoomPlayer(room.id, m.user_id, playerId);
    reload();
  });

  /* 연결은 이 방에서 제일 중요한 설정인데(안 하면 참여 포인트가 아무에게도
     안 들어간다) 멤버마다 셀렉트를 하나씩 고르게 되어 있었다. 열 명이면
     열 번이다. 이름이 같은 짝은 기계가 찾아준다 */
  const autoLink = guard(async () => {
    const free = players.filter((p) => !p.linked_user_id);
    const pairs = members
      .filter((m) => !m.player)
      .map((m) => ({
        member: m,
        player: free.find((p) => p.name.trim() === m.nickname.trim()),
      }))
      .filter((x) => x.player);

    /* 같은 참가자를 두 멤버가 집는 일은 없다 - 이름이 방 안에서 유일하다 */
    if (pairs.length === 0) {
      toast('이름이 똑같은 짝을 못 찾았어요. 아래에서 직접 골라주세요.');
      return;
    }
    for (const { member, player } of pairs) {
      await linkRoomPlayer(room.id, member.user_id, player.id);
    }
    toast.success(`${pairs.length}명을 이어줬어요.`);
    reload();
  });

  const addGhost = guard(async () => {
    if (!ghostName.trim()) return;
    await addGhostMember(room.id, ghostName.trim());
    setGhostName('');
    toast.success('유령 멤버를 만들었어요.');
    reload();
  });

  const dropGhost = guard(async (m) => {
    const ok = await confirm({
      title: '유령 멤버 삭제',
      message: `'${m.nickname}' 유령 멤버를 지울까요?`,
      detail: '참가자 연결이 풀리고 이 멤버 몫의 끼꼬도 사라집니다.',
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    await removeGhostMember(room.id, m.user_id);
    reload();
  });

  const changeRole = guard(async (m, role) => {
    await setMemberRole(room.id, m.user_id, role);
    reload();
  });

  const handOver = guard(async (m) => {
    const ok = await confirm({
      title: '방장 넘기기',
      message: `'${m.nickname}' 님에게 방장을 넘길까요?`,
      detail: '되돌리려면 그쪽에서 다시 넘겨줘야 합니다.',
      confirmText: '넘기기',
      danger: true,
    });
    if (!ok) return;
    await transferRoom(room.id, m.user_id);
    toast.success('방장을 넘겼어요.');
    reload();
  });

  /* 같은 사람인데 계정이 바뀐 경우. 내보내기와 달리 그 계정이 남긴 것이
     전부 따라온다 - 안 따라오면 지난 또또 기록이 '알 수 없음'이 된다 */
  const moveAccount = guard(async (m, toId) => {
    const to = members.find((x) => x.user_id === toId);
    if (!to) return;
    const ok = await confirm({
      title: '계정 옮기기',
      message: `'${m.nickname}' 님의 기록을 '${to.nickname}' 계정으로 옮길까요?`,
      detail: `배팅 기록·끼꼬 내역·참가자 연결·지난 달 끼꼬가 전부 따라갑니다. '${m.nickname}' 계정은 이 방에서 빠집니다. 되돌릴 수 없어요.`,
      confirmText: '옮기기',
      danger: true,
    });
    if (!ok) return;
    const moved = await transferAccount(room.id, m.user_id, toId);
    toast.success(
      moved > 0
        ? `옮겼어요. 끼꼬 ${Number(moved).toLocaleString()}도 같이 갔습니다.`
        : '옮겼어요.'
    );
    reload();
  });

  const toggleCap = guard(async (cap, on) => {
    await setAdminCap(room.id, cap.key, on);
    reload();
  });

  /* to를 주면 그 사람에게 끼꼬를 넘기고 내보낸다. 처음 받은 몫은
     서버가 빼고 넘긴다 - 여기서 계산해서 보내면 두 숫자가 어긋난다 */
  const kick = guard(async (m, to = null) => {
    const toName = to ? members.find((x) => x.user_id === to)?.nickname : null;
    const ok = await confirm({
      title: '멤버 내보내기',
      message: `'${m.nickname}' 님을 내보낼까요?`,
      detail: toName
        ? `남은 끼꼬는 '${toName}' 님에게 넘어갑니다 (처음 받은 몫은 빠집니다). 입장 코드를 알면 다시 들어올 수 있어요.`
        : '이 계정 몫의 끼꼬는 그대로 남습니다. 입장 코드를 알면 다시 들어올 수 있어요.',
      confirmText: '내보내기',
      danger: true,
    });
    if (!ok) return;
    const moved = await kickMember(room.id, m.user_id, to);
    toast.success(
      moved > 0
        ? `내보냈어요. ${Number(moved).toLocaleString()} 끼꼬를 ${toName} 님에게 넘겼습니다.`
        : '내보냈어요.'
    );
    reload();
  });

  const leave = guard(async () => {
    const ok = await confirm({
      title: '방 나가기',
      message: '이 방에서 나갈까요?',
      detail: '다시 들어오려면 입장 코드가 필요해요.',
      confirmText: '나가기',
      danger: true,
    });
    if (!ok) return;
    await leaveRoom(room.id);
    onGone();
  });

  const remove = guard(async () => {
    const ok = await confirm({
      title: '방 삭제',
      message: `'${room.name}' 방을 삭제할까요?`,
      detail: '경기 기록과 포인트까지 전부 사라지고 되돌릴 수 없습니다.',
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    await deleteRoom(room.id);
    onGone();
  });

  return (
    <div className="room-settings">
      <section className="room-panel">
          <h3>
            <FaKey /> 입장 코드
          </h3>
          <p className="rooms-hint">
            코드를 아는 사람은 방에 들어와 기록을 볼 수 있어요. 기록을 남기는 건 방장과 부방장만
            할 수 있습니다.
          </p>
          <div className="room-code-row">
            <span className="room-code">{code || '••••••'}</span>
            <button className="ghost-btn" onClick={showCode}>
              코드 보기
            </button>
            <button className="ghost-btn" onClick={copyCode}>
              <FaRegCopy /> 복사
            </button>
            {isOwner && (
              <button className="ghost-btn" onClick={rerollCode}>
                <FaSync /> 새로 뽑기
              </button>
            )}
          </div>
      </section>

      <Panel locked={!isAdmin} head={<><FaPalette /> 방 꾸미기</>}>
          <p className="rooms-hint">
            고른 색이 이 방 전체에 돕니다. 방 목록에서도 이 색으로 보여요.
          </p>
          <div className="style-row">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                className={`style-swatch ${room.accent === a.key ? 'is-on' : ''}`}
                style={{ '--sw': a.main }}
                onClick={() => saveStyle({ accent: a.key })}
                aria-label={a.label}
                title={a.label}
              />
            ))}
          </div>
          <div className="style-row style-emblems">
            {EMBLEMS.map((e) => (
              <button
                key={e}
                className={`style-emblem ${room.emblem === e ? 'is-on' : ''}`}
                onClick={() => saveStyle({ emblem: e })}
              >
                {e}
              </button>
            ))}
          </div>
      </Panel>

      <Panel locked={!isAdmin} head={<>방 이름</>}>
          <div className="rooms-form-row">
            <input
              className="rooms-input"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="ghost-btn" onClick={saveName} disabled={name.trim() === room.name}>
              저장
            </button>
          </div>
      </Panel>

      <section className={`room-panel ${!isAdmin ? 'is-locked' : ''}`}>
          <div className="room-panel-head">
            <h3>
              <FaUsers /> 참가자<span className="panel-count">{players.length}명</span>
            </h3>
            <RosterLoadButton
              onClick={() => setShowLoader(true)}
              disabled={players.length >= MAX_ROOM_PLAYERS}
            />
          </div>
        <fieldset disabled={!isAdmin}>
          {/* 아래 '멤버'와 생긴 게 비슷해서 뭐가 뭔지 헷갈렸다.
              '경기에 뛰는 이름'과 '방에 들어온 계정'이라고 못 박아둔다 */}
          <p className="rooms-hint">
            <b>경기에 뛰는 이름</b>입니다. 계정과는 상관없어요 — 사이트를 안 쓰는 친구도
            여기 있습니다. 게임 시작 탭에서 새 이름을 적으면 자동으로 추가되고, 이름을
            고쳐도 지웠다 다시 넣어도 지난 전적은 그대로 따라옵니다.
          </p>

          {/* 같은 사람인데 두 명단의 티어가 다르면 팀 짜기가 엉뚱한 평점으로 돈다 */}
          {tierGap.length > 0 && (
            <div className="tier-gap">
              <span>
                <FaExchangeAlt /> 내 팀원 명단과 티어가 다른 사람 <b>{tierGap.length}명</b>
                <em>{tierGap.map(({ p }) => p.name).join(', ')}</em>
              </span>
              <span className="tier-gap-acts">
                <button className="ghost-btn" onClick={pullTiers}>
                  내 명단에 반영
                </button>
                <button className="ghost-btn" onClick={pushTiers}>
                  방 명단에 반영
                </button>
              </span>
            </div>
          )}

          <div className="player-cols">
            {[
              { key: 'known', icon: <FaUserCheck />, label: '내 명단에 있는 사람', list: known },
              { key: 'guests', icon: <FaUserPlus />, label: '내 명단에 없는 사람', list: guests },
            ].map((col) => (
              <div className="player-col" key={col.key}>
                <span className="player-col-head">
                  {col.icon} {col.label}
                  <b>{col.list.length}</b>
                </span>
                {col.list.length === 0 ? (
                  <p className="player-col-empty">없음</p>
                ) : (
                  <div className="room-player-list">
                    {col.list.map((p) => (
                      <PlayerRow key={p.id} player={p} onPatch={patchPlayer} onDrop={dropPlayer} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="rooms-form-row">
            <input
              className="rooms-input"
              value={newName}
              maxLength={16}
              placeholder="참가자 이름을 직접 적어도 됩니다"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            />
            <button
              className="ghost-btn"
              onClick={addPlayer}
              disabled={players.length >= MAX_ROOM_PLAYERS}
            >
              <FaPlus /> 추가
            </button>
          </div>

          {/* 이름을 고치는 것만으로는 안 되는 경우. 'poop'으로 몇 판 뛰고
              '푸푸'로 다시 들어오면 줄이 둘이 되어 전적이 갈린다 */}
          {/* 옛날에 참가자를 진짜로 지우던 시절의 기록이 가리키는 자리.
              화면에서 '?'가 되거나 아예 빠져서 5명이 4명으로 보인다.
              '#23'만 보여주면 그게 누구였는지 알 길이 없으니, 언제 몇 판
              뛰었고 누구와 같은 팀이었는지를 같이 보여준다 */}
          {lostPlayers.length > 0 && (
            <div className="player-lost">
              <span className="player-merge-head">
                <FaExclamationTriangle /> 기록에만 남고 이름이 없는 자리
                <b>{lostPlayers.length}개</b>
              </span>
              <p className="rooms-hint">
                예전에 참가자를 지우면 기록에서 그 자리가 비었습니다. 누구였는지 고르면
                그 전적이 그 사람에게 합쳐집니다.
              </p>
              {lostPlayers.map((x) => (
                <div className="lost-row" key={x.id}>
                  <span className="lost-who">
                    <b>#{x.id}</b>
                    <em>{x.games}판</em>
                  </span>
                  <span className="lost-when">
                    {dayText(x.first)}
                    {x.last !== x.first && ` ~ ${dayText(x.last)}`}
                  </span>
                  <span className="lost-mates">
                    {x.mates.length === 0 ? (
                      '같이 뛴 사람 없음'
                    ) : (
                      <>
                        같은 팀{' '}
                        {x.mates.slice(0, 4).map((m) => (
                          <i key={m.name}>
                            {m.name}
                            <u>{m.n}</u>
                          </i>
                        ))}
                      </>
                    )}
                  </span>
                  <select
                    className="rooms-input lost-pick"
                    value={lostPick[x.id] || ''}
                    onChange={(e) => setLostPick({ ...lostPick, [x.id]: e.target.value })}
                    aria-label={`#${x.id}이 누구인지`}
                  >
                    <option value="">누구인가요?</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="ghost-btn"
                    onClick={() => assignLost(x)}
                    disabled={!lostPick[x.id]}
                  >
                    지정
                  </button>
                </div>
              ))}
            </div>
          )}

          {players.length >= 2 && (
            <div className="player-merge">
              <span className="player-merge-head">
                <FaExchangeAlt /> 같은 사람이 두 줄로 나뉘었을 때
              </span>
              <div className="rooms-form-row">
                <select
                  className="rooms-input"
                  value={mergeKeep}
                  onChange={(e) => setMergeKeep(e.target.value)}
                  aria-label="남길 이름"
                >
                  <option value="">남길 이름</option>
                  {players
                    .filter((p) => String(p.id) !== mergeDrop)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
                <span className="player-merge-arrow">←</span>
                <select
                  className="rooms-input"
                  value={mergeDrop}
                  onChange={(e) => setMergeDrop(e.target.value)}
                  aria-label="없앨 이름"
                >
                  <option value="">없앨 이름</option>
                  {players
                    .filter((p) => String(p.id) !== mergeKeep)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
                <button
                  className="ghost-btn"
                  onClick={mergePlayers}
                  disabled={!mergeKeep || !mergeDrop}
                >
                  합치기
                </button>
              </div>
              <p className="rooms-hint">
                없앨 이름으로 뛴 지난 경기가 남길 이름의 기록이 됩니다. 서로 맞붙은 적이
                있으면 같은 사람일 수 없어서 막힙니다.
              </p>
            </div>
          )}

          {showLoader && (
            <RosterLoader
              addOnly
              present={players.map((p) => p.name)}
              limit={MAX_ROOM_PLAYERS - players.length}
              onConfirm={addFromRoster}
              onClose={() => setShowLoader(false)}
            />
          )}
        </fieldset>
      </section>

      {/* 무엇을 할 수 있는 자리인지 표로 보여준다. 권한이 없는 사람도
          보게 두는 편이 낫다 - 방장에게 무엇을 부탁해야 하는지 알아야 한다.
          실제로 막는 건 서버다 (rules/permissions.js 머리말 참고) */}
      <section className="room-panel">
        <h3>
          <FaUserShield /> 역할별 권한
        </h3>
        <p className="rooms-hint">
          {isOwner
            ? '부방장 칸을 눌러 켜고 끕니다. 방장은 언제나 전부 할 수 있어요.'
            : '방장이 부방장에게 무엇을 맡겼는지 보여줍니다.'}
        </p>

        <ul className="perm-table">
          <li className="perm-head">
            <span />
            {ROLES.map((r) => (
              <span key={r.key}>{r.label}</span>
            ))}
          </li>
          {CAPS.map((c) => (
            <li key={c.key}>
              <span className="perm-what">
                <b>{c.label}</b>
                <em>{c.desc}</em>
              </span>
              {ROLES.map((r) => {
                const on = allows(r.key, c, room.admin_caps || DEFAULT_CAPS);
                /* 방장·멤버 칸은 규칙이지 설정이 아니다. 부방장 칸만 누른다 */
                const canToggle = isOwner && r.key === 'admin' && !c.fixed && !c.everyone;
                return canToggle ? (
                  <button
                    key={r.key}
                    className={`perm-cell is-btn ${on ? 'is-on' : ''}`}
                    onClick={() => toggleCap(c, !on)}
                    aria-pressed={on}
                    aria-label={`부방장 ${c.label} ${on ? '끄기' : '켜기'}`}
                  >
                    {on ? '○' : '✕'}
                  </button>
                ) : (
                  <span key={r.key} className={`perm-cell ${on ? 'is-on' : ''}`}>
                    {on ? '○' : '✕'}
                  </span>
                );
              })}
            </li>
          ))}
        </ul>
      </section>

      <section className="room-panel">
        <h3>
          <FaLink /> 멤버<span className="panel-count">{members.length}명</span>
        </h3>
        <p className="rooms-hint">
          <b>이 방에 들어온 구글 계정</b>입니다. 끼꼬 지갑과 권한이 계정에 붙어요.
          위 참가자 이름과 이어두면 그 이름으로 뛴 경기의 참여 끼꼬가 이 계정으로
          들어갑니다.
        </p>

        {/* 조용히 안 되고 있으면 아무도 모른다. 끼꼬가 전부 0인데
            이유를 못 찾는 일이 실제로 있었다 */}
        {isAdmin && unlinked.length > 0 && (
          <div className="member-warn">
            <span>
              <FaExclamationTriangle /> <b>{unlinked.length}명</b>이 참가자와 이어지지 않아
              내전 참여 포인트를 못 받고 있어요.
            </span>
            <button className="ghost-btn" onClick={autoLink}>
              <FaLink /> 이름이 같은 사람 한 번에 잇기
            </button>
          </div>
        )}
        {/* 줄에는 '누구인가'만 남긴다. 손대는 건 [관리] 팝업으로 모았다 -
            참가자 셀렉트와 버튼 셋이 줄마다 붙어 있어서 열 명이면 설정
            탭이 가로로도 세로로도 늘어졌다 */}
        <ul className="room-members">
          {members.map((m) => {
            const title = m.player && titles.get(m.player.name);
            const mine = m.user_id === myId;
            return (
              <li key={m.user_id} className={m.player ? '' : 'is-unlinked'}>
                <div className="mem-top">
                  <span className="mem-name">
                    {m.is_ghost && <FaGhost className="member-ghost-icon" title="유령 멤버" />}
                    {m.nickname}
                    {mine && <em>(나)</em>}
                  </span>
                  <span className={`rooms-role role-${m.role}`}>
                    {m.is_ghost ? '유령' : ROLE_LABEL[m.role]}
                  </span>
                  {title && (
                    <span className={`title-badge tone-${title.tone}`}>
                      {title.icon} {title.label}
                    </span>
                  )}
                </div>

                <div className="mem-bottom">
                  <span className={`mem-linked ${m.player ? '' : 'is-none'}`}>
                    <FaLink />
                    {/* 카드가 좁아지면 이름이 잘려야 한다. 텍스트를 그냥 두면
                        flex 안에서 잘리지 않고 끼꼬와 버튼을 밀어낸다 */}
                    <b>{m.player ? m.player.name : '참가자 안 이어짐'}</b>
                  </span>
                  <span className="mem-points">{m.points.toLocaleString()} 끼꼬</span>
                  {/* 멤버도 남의 연결은 볼 수 있어야 하니 팝업 자체는 열어준다.
                      안에서 고칠 수 있는 건 권한에 따라 갈린다 */}
                  <button
                    className="icon-btn mem-more"
                    onClick={() => setOpenMem(m.user_id)}
                    aria-label={`${m.nickname} 관리`}
                    title="관리"
                  >
                    <FaEllipsisH />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {/* 폴링이 돌아도 열린 팝업이 최신 끼꼬를 보게, id로 다시 찾는다 */}
        {openMem && members.some((m) => m.user_id === openMem) && (
          <MemberModal
            member={members.find((m) => m.user_id === openMem)}
            members={members}
            players={players}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isMe={openMem === myId}
            onClose={() => setOpenMem(null)}
            onLink={link}
            onRole={changeRole}
            onHandOver={async (m) => {
              await handOver(m);
              setOpenMem(null);
            }}
            onKick={async (m, to) => {
              await kick(m, to);
              setOpenMem(null);
            }}
            onDropGhost={async (m) => {
              await dropGhost(m);
              setOpenMem(null);
            }}
            onMoveAccount={async (m, toId) => {
              await moveAccount(m, toId);
              setOpenMem(null);
            }}
          />
        )}

        {isAdmin && (
          <div className="rooms-form-row member-add">
            <input
              className="rooms-input"
              value={ghostName}
              maxLength={16}
              placeholder="유령 멤버 이름 (가입 안 하는 친구)"
              onChange={(e) => setGhostName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGhost()}
            />
            <button className="ghost-btn" onClick={addGhost}>
              <FaGhost /> 만들기
            </button>
          </div>
        )}
      </section>

      <section className="room-panel room-danger">
        {isOwner ? (
          <>
            <p className="rooms-hint">
              방장은 방을 나갈 수 없어요. 다른 사람에게 넘기거나 방을 삭제해 주세요.
            </p>
            <button className="ghost-btn" onClick={remove}>
              방 삭제
            </button>
          </>
        ) : (
          <button className="ghost-btn" onClick={leave}>
            방 나가기
          </button>
        )}
      </section>
    </div>
  );
};

const Room = () => {
  const { id } = useParams();
  const roomId = Number(id);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  usePageMeta(PAGE_META.rooms);

  const {
    room,
    players,
    matches,
    scrims,
    activeScrim,
    members,
    myRole,
    myNickname,
    loading,
    error,
    reload,
    allPlayers,
    lostPlayers,
  } = useRoom(roomId, user?.id);
  const { hofRows } = useHallOfFame(roomId);
  /* 탭을 주소(#bet)에 둔다. useState에만 담아두면 새로고침하거나
     링크를 공유했을 때 항상 첫 탭으로 돌아간다.
     replace라 뒤로 가기는 탭을 되짚지 않고 방 목록으로 나간다.

     들어오면 대문(홈)이 먼저다. 바로 기록 화면을 들이밀면
     '오늘 뭐가 있었나'를 볼 자리가 없다 */
  const location = useLocation();
  const fromHash = location.hash.replace('#', '');
  const tab = TABS.some((t) => t.key === fromHash) ? fromHash : 'home';
  /* 탭을 옮기면 맨 위부터 본다. 한참 내려보다 다른 탭으로 넘어가면
     새 화면의 중간에 떨어져서, 매번 위로 올려야 했다.
     주소를 #으로 바꾸므로 브라우저가 알아서 올려주지는 않는다 */
  const setTab = (key) => {
    navigate(`${location.pathname}${key === 'home' ? '' : `#${key}`}`, { replace: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const editable = canEditRole(myRole);

  const record = async (m) => {
    await addScrimByNames({ ...m, roomId, players, game: room?.game });
    reload();
  };

  const openBet = async (m) => {
    await openBettingByNames({ ...m, roomId, players, game: room?.game });
    reload();
  };

  const unrecord = async (scrimId) => {
    await removeScrim(scrimId);
    reload();
  };

  /* 로딩 중에도 방 껍데기는 그려두고 안쪽만 스켈레톤으로. 화면이 통째로
     비었다가 튀어나오면 그게 곧 '랙 걸린 느낌'이다 */
  if (authLoading || loading) {
    return (
      <div className="page room-page">
        <div className="room-hero">
          <SkelLine w="9rem" h={26} />
          <SkelLine w="13rem" h={13} style={{ marginTop: 10 }} />
        </div>
        <SkelRows count={5} h={52} />
      </div>
    );
  }

  /* 새로고침 한 번 실패했다고 방을 통째로 버리지 않는다.
     정산 직후처럼 요청이 몰릴 때 하나만 어긋나도 '방을 볼 수 없어요'가
     떠서, 목록으로 나갔다 다시 들어와야 했다 */
  if (!user || !room) {
    return (
      <div className="page room-page">
        <p className="rooms-blank">{error || '방을 볼 수 없어요.'}</p>
        <Link className="ghost-btn" to="/rooms">
          <FaArrowLeft /> 방 목록으로
        </Link>
      </div>
    );
  }

  const myPoints = members.find((m) => m.user_id === user.id)?.points ?? 0;

  /* 별명은 방 여기저기서 같은 값을 써야 한다. 한 번만 계산해서 나눠 준다 */
  const titles = titlesOf({ matches, scrims, players });

  return (
    /* 방 색을 여기 한 번만 얹으면 안쪽 배지·버튼·테두리가 전부 따라온다.
       게임도 마찬가지다 - 티어 목록·라인 유무가 이 아래 전부에 걸린다 */
    <GameProvider game={room.game}>
    <div className="page room-page" style={accentVars(room.accent)}>
      {/* 링크로 바로 들어온 사람도 여기서 걸린다 */}
      {!myNickname && <NicknameGate onSaved={reload} />}

      <header className="room-hero">
        {/* 방 이름을 눌러 다른 방으로 바로 넘어간다. 전에는 뒤로 →
            방 목록 → 다른 방, 세 번을 거쳐야 했다 */}
        <RoomSwitch room={room} userId={user.id}>
          <span className="room-emblem">{room.emblem}</span>
          <span className="room-hero-text">
            <span className="room-name">{room.name}</span>
            <span className="room-meta">
              <span className="room-game" title={getGame(room.game).label}>
                <img className="game-logo is-tiny" src={getGame(room.game).logo} alt="" />
                {getGame(room.game).label}
              </span>
              {members.length}명 · {ROLE_LABEL[myRole]}
            </span>
          </span>
        </RoomSwitch>

        {/* 내 끼꼬는 어느 탭에 있든 보여야 한다. 배팅하다 잔액 보러
            탭을 옮겨다니게 만들면 안 된다 */}
        <button
          className="room-mypoints"
          onClick={() => setTab('kkiko')}
          title="포인트 탭으로"
        >
          <FaCoins />
          <strong>{myPoints.toLocaleString()}</strong>
          <span>끼꼬</span>
        </button>
      </header>

      <div className="room-tabs no-rise">
        {TABS.map((t, i) => (
          <React.Fragment key={t.key}>
            {i > 0 && TABS[i - 1].group !== t.group && (
              <span className="room-tab-sep" aria-hidden="true" />
            )}
            <button
              className={`room-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span className="room-tab-icon">{t.icon}</span>
              {t.label}
              {/* 또또가 열려 있으면 탭에서 바로 보여야 한다. 다른 탭을
                  보고 있는 동안 배팅이 열렸다 닫히면 그만이다 */}
              {t.key === 'bet' && activeScrim && (
                <span
                  className={`room-tab-live ${activeScrim.status === 'betting' ? 'is-open' : ''}`}
                >
                  {activeScrim.status === 'betting' ? 'LIVE' : '경기 중'}
                </span>
              )}
            </button>
          </React.Fragment>
        ))}
      </div>

      {tab === 'home' && (
        <RoomHome
          room={room}
          matches={matches}
          scrims={scrims}
          players={players}
          members={members}
          activeScrim={activeScrim}
          canEdit={editable}
          tabs={TABS.filter((t) => t.key !== 'home')}
          onGo={setTab}
        />
      )}

      {!editable && tab === 'record' && (
        <p className="rooms-hint room-readonly">
          이 방에서는 보기만 할 수 있어요. 기록은 방장과 부방장이 남깁니다.
        </p>
      )}

      {/* key를 탭으로 주면 탭을 옮길 때마다 새로 마운트되어 fade-in이 다시 돈다 */}
      {/* 탭마다 폭을 달리 두지 않는다. 몇 개만 좁혀놨더니 탭을 옮길 때마다
          내용 폭이 들쭉날쭉해서 그게 더 눈에 걸렸다. 전부 헤더와 같은 폭 */}
      <div className="room-panel-wrap fade-in" key={tab}>
        {tab === 'record' && (
          <ScrimRecord
            matches={matches}
            players={players}
            canEdit={editable}
            onAdd={record}
            onRemove={unrecord}
            onOpenBetting={editable ? openBet : undefined}
          />
        )}
        {tab === 'history' && (
          <MatchHistory
            matches={matches}
            scrims={scrims}
            players={players}
            members={members}
            myId={user.id}
            canEdit={editable}
            isOwner={myRole === 'owner'}
            version={room.version}
            onRemove={unrecord}
            onChanged={reload}
          />
        )}
        {tab === 'stats' && (
          <>
            <HallOfFame rows={hofRows} matches={matches} members={members} />
            {/* 달별 끼꼬는 시즌이 넘어갈 때 박제해둔 값(hofRows)에 있고,
                이번 달은 아직 박제 전이라 지갑(members)을 봐야 한다 */}
            <Season
              matches={matches}
              players={players}
              hofRows={hofRows}
              members={members}
            />
          </>
        )}
        {/* BetTab의 players는 이름을 붙이는 데만 쓴다. 지운 사람까지
            넘겨야 지난 판에서 그 사람이 '?'로 남지 않는다 */}
        {tab === 'bet' && (
          <BetTab
            scrims={scrims}
            activeScrim={activeScrim}
            players={allPlayers}
            members={members}
            myId={user.id}
            canEdit={editable}
            isOwner={myRole === 'owner'}
            version={room.version}
            onChanged={reload}
          />
        )}
        {tab === 'kkiko' && (
          <KkikoTab
            roomId={roomId}
            members={members}
            myId={user.id}
            isOwner={myRole === 'owner'}
            onChanged={reload}
          />
        )}
        {tab === 'feed' && <FeedTab roomId={roomId} version={room.version} />}
        {tab === 'settings' && (
          <Settings
            room={room}
            lostPlayers={lostPlayers}
            members={members}
            players={players}
            titles={titles}
            myRole={myRole}
            myId={user.id}
            reload={reload}
            onGone={() => navigate('/rooms')}
          />
        )}
      </div>
    </div>
    </GameProvider>
  );
};

export default Room;
