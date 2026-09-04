import React, { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
} from 'react-icons/fa';
import { useAuth } from '../../auth/AuthContext';
import {
  useRoom,
  canEdit as canEditRole,
  ROLE_LABEL,
  addRoomPlayer,
  updateRoomPlayer,
  removeRoomPlayer,
  addScrimByNames,
  openBettingByNames,
  removeScrim,
  renameRoom,
  getJoinCode,
  resetJoinCode,
  setMemberRole,
  transferRoom,
  kickMember,
  linkRoomPlayer,
  addGhostMember,
  removeGhostMember,
  leaveRoom,
  deleteRoom,
} from '../../rooms';
import { TIERS, DIVISIONS, getTier } from '../../tiers';
import { MAX_ROOM_PLAYERS } from '../../limits';
import ScrimRecord from '../scrimRecord/ScrimRecord';
import Season from '../season/Season';
import BetTab from './BetTab';
import KkikoTab from './KkikoTab';
import FeedTab from './FeedTab';
import { useDialog } from '../../components/common/Dialog';
import RosterLoader from '../../components/common/RosterLoader';
import RosterLoadButton from '../../components/common/RosterLoadButton';
import NicknameGate from '../../components/rooms/NicknameGate';
import { SkelLine, SkelRows } from '../../components/common/Skeleton';
import { usePageMeta, PAGE_META } from '../../seo';
import './Rooms.css';

/* 탭 순서 = 실제로 쓰는 순서. 방에 들어와서 게임을 시작하고, 또또를 열고,
   끝나면 기록을 본다. 홈은 이 전부로 가는 갈림길이라 맨 앞이다.

   group은 성격이 다른 탭 사이에 선을 긋기 위한 것이다. 일곱 개가
   나란히 붙어 있으면 게임 얘기와 돈 얘기가 구분이 안 된다.
   홈 | 게임·기록 | 또또·포인트 | 로그 | 설정 */
const TABS = [
  { key: 'home', group: 0, label: '홈', icon: <FaHome />, desc: '이 방에서 할 수 있는 것들' },
  { key: 'record', group: 1, label: '게임 시작', icon: <FaPlay />, desc: '팀을 넣고 승패를 기록합니다' },
  { key: 'season', group: 1, label: '내전 기록', icon: <FaChartBar />, desc: '전적·순위·시즌 정산' },
  { key: 'bet', group: 2, label: '또또', icon: <FaDice />, desc: '끼꼬를 걸고 결과를 맞힙니다' },
  { key: 'kkiko', group: 2, label: '포인트', icon: <FaCoins />, desc: '끼꼬 잔액과 주고받기' },
  { key: 'feed', group: 3, label: '로그', icon: <FaListUl />, desc: '방에서 일어난 일들' },
  { key: 'settings', group: 4, label: '설정', icon: <FaCog />, desc: '참가자·멤버·입장 코드' },
];

/* 이름은 타이핑마다 저장하면 안 된다. 키 하나마다 UPDATE 한 번에
   방 전체 재조회까지 붙는다. 초안을 들고 있다가 입력을 끝냈을 때 한 번만 보낸다.
   티어/디비전은 선택 한 번이 곧 확정이라 바로 보낸다 */
const PlayerRow = ({ player, onPatch, onDrop }) => {
  const [draft, setDraft] = useState(player.name);
  const tier = getTier(player.tier);

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
        {TIERS.map((t) => (
          <option key={t.key} value={t.key}>
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
          DIVISIONS.map((d) => (
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

/* 방장·부방장만 보이는 설정 묶음. 멤버에게는 멤버 목록과 나가기만 남는다 */
const Settings = ({ room, members, players, myRole, myId, reload, onGone }) => {
  const isOwner = myRole === 'owner';
  const isAdmin = canEditRole(myRole);
  const [name, setName] = useState(room.name);
  const [code, setCode] = useState(null);
  const [newName, setNewName] = useState('');
  const [ghostName, setGhostName] = useState('');
  const [showLoader, setShowLoader] = useState(false);
  const busy = useRef(false);
  const { confirm } = useDialog();

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

  const saveName = guard(async () => {
    await renameRoom(room.id, name);
    toast.success('방 이름을 바꿨어요.');
    reload();
  });

  const addPlayer = guard(async () => {
    if (!newName.trim()) return;
    await addRoomPlayer(room.id, { name: newName.trim() });
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
      await addRoomPlayer(room.id, { name: m.name.trim(), tier: m.tier, division: m.division });
    }
    if (take.length < fresh.length) {
      toast.error(`자리가 모자라 ${fresh.length - take.length}명은 못 넣었어요.`);
    } else {
      toast.success(`${take.length}명을 명단에 넣었어요.`);
    }
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

  /* 멤버 한 명당 참가자 하나. 이미 다른 멤버가 가져간 참가자는 아래에서
     못 고르게 막아두므로 여기서는 그대로 보낸다 */
  const link = guard(async (m, playerId) => {
    await linkRoomPlayer(room.id, m.user_id, playerId);
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

  const kick = guard(async (m) => {
    const ok = await confirm({
      title: '멤버 내보내기',
      message: `'${m.nickname}' 님을 내보낼까요?`,
      detail: '입장 코드를 알면 다시 들어올 수 있어요.',
      confirmText: '내보내기',
      danger: true,
    });
    if (!ok) return;
    await kickMember(room.id, m.user_id);
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
      {isAdmin && (
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
            {isOwner && (
              <button className="ghost-btn" onClick={rerollCode}>
                <FaSync /> 새로 뽑기
              </button>
            )}
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="room-panel">
          <h3>방 이름</h3>
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
        </section>
      )}

      {isAdmin && (
        <section className="room-panel">
          <div className="room-panel-head">
            <h3>
              참가자 명단<span className="panel-count">{players.length}명</span>
            </h3>
            <RosterLoadButton
              onClick={() => setShowLoader(true)}
              disabled={players.length >= MAX_ROOM_PLAYERS}
            />
          </div>
          <p className="rooms-hint">
            게임 시작 탭에서 새 이름을 적으면 여기에 자동으로 추가됩니다. 이름을 고쳐도 지난
            전적은 그대로 따라옵니다.
          </p>

          <div className="room-player-list">
            {players.map((p) => (
              <PlayerRow key={p.id} player={p} onPatch={patchPlayer} onDrop={dropPlayer} />
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

          {showLoader && (
            <RosterLoader
              addOnly
              present={players.map((p) => p.name)}
              limit={MAX_ROOM_PLAYERS - players.length}
              onConfirm={addFromRoster}
              onClose={() => setShowLoader(false)}
            />
          )}
        </section>
      )}

      <section className="room-panel">
        <h3>
          멤버<span className="panel-count">{members.length}명</span>
        </h3>
        {isAdmin && (
          <p className="rooms-hint">
            멤버를 참가자 명단의 이름과 이어두면, 그 사람이 뛴 경기의 참여 포인트가
            자동으로 들어갑니다. 사이트를 안 쓰는 친구는 <b>유령 멤버</b>로 만들어
            이어주면 됩니다.
          </p>
        )}
        <ul className="room-members">
          {members.map((m) => (
            <li key={m.user_id}>
              <span className="rooms-name">
                {m.is_ghost && <FaGhost className="member-ghost-icon" title="유령 멤버" />}
                {m.nickname}
                {m.user_id === myId && <em> (나)</em>}
              </span>
              <span className={`rooms-role role-${m.role}`}>
                {m.is_ghost ? '유령' : ROLE_LABEL[m.role]}
              </span>
              <span className="room-member-points">{m.points.toLocaleString()} 끼꼬</span>

              {/* 연결은 방장·부방장만 건드린다. 멤버에게는 결과만 보인다 */}
              {isAdmin ? (
                <label className="member-link">
                  <FaLink />
                  <select
                    value={m.player?.id ?? ''}
                    onChange={(e) => link(m, e.target.value ? Number(e.target.value) : null)}
                    aria-label={`${m.nickname} 참가자 연결`}
                  >
                    <option value="">연결 안 함</option>
                    {players.map((p) => {
                      const taken = p.linked_user_id && p.linked_user_id !== m.user_id;
                      return (
                        <option key={p.id} value={p.id} disabled={taken}>
                          {p.name}
                          {taken ? ' (연결됨)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
              ) : (
                m.player && (
                  <span className="member-linked">
                    <FaLink /> {m.player.name}
                  </span>
                )
              )}

              {isAdmin && m.is_ghost && (
                <span className="room-member-acts">
                  <button className="ghost-btn" onClick={() => dropGhost(m)}>
                    삭제
                  </button>
                </span>
              )}
              {isOwner && !m.is_ghost && m.user_id !== myId && (
                <span className="room-member-acts">
                  <button
                    className="ghost-btn"
                    onClick={() => changeRole(m, m.role === 'admin' ? 'member' : 'admin')}
                  >
                    {m.role === 'admin' ? '부방장 해제' : '부방장'}
                  </button>
                  <button className="ghost-btn" onClick={() => handOver(m)}>
                    방장 넘기기
                  </button>
                  <button className="ghost-btn" onClick={() => kick(m)}>
                    내보내기
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>

        {isAdmin && (
          <div className="rooms-form-row">
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
  } = useRoom(roomId, user?.id);
  const [tab, setTab] = useState('record');

  const editable = canEditRole(myRole);

  const record = async (m) => {
    await addScrimByNames({ ...m, roomId, players });
    reload();
  };

  const openBet = async (m) => {
    await openBettingByNames({ ...m, roomId, players });
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

  if (!user || error || !room) {
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

  return (
    <div className="page room-page">
      {/* 링크로 바로 들어온 사람도 여기서 걸린다 */}
      {!myNickname && <NicknameGate onSaved={reload} />}

      <header className="room-hero">
        <div className="room-hero-left">
          <Link className="room-back" to="/rooms" title="방 목록으로">
            <FaArrowLeft />
          </Link>
          <div>
            <h1 className="room-name">{room.name}</h1>
            <p className="room-meta">
              {members.length}명 · {ROLE_LABEL[myRole]}
            </p>
          </div>
        </div>

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
            </button>
          </React.Fragment>
        ))}
      </div>

      {tab === 'home' && (
        <div className="room-home fade-in">
          {TABS.filter((t) => t.key !== 'home').map((t) => (
            <button key={t.key} className="room-home-card" onClick={() => setTab(t.key)}>
              <span className="room-home-icon">{t.icon}</span>
              <strong>{t.label}</strong>
              <em>{t.desc}</em>
            </button>
          ))}
        </div>
      )}

      {!editable && tab === 'record' && (
        <p className="rooms-hint room-readonly">
          이 방에서는 보기만 할 수 있어요. 기록은 방장과 부방장이 남깁니다.
        </p>
      )}

      {/* key를 탭으로 주면 탭을 옮길 때마다 새로 마운트되어 fade-in이 다시 돈다 */}
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
        {tab === 'season' && <Season matches={matches} players={players} />}
        {tab === 'bet' && (
          <BetTab
            scrims={scrims}
            activeScrim={activeScrim}
            players={players}
            members={members}
            myId={user.id}
            canEdit={editable}
            isOwner={myRole === 'owner'}
            version={room.version}
            onChanged={reload}
          />
        )}
        {tab === 'kkiko' && (
          <KkikoTab roomId={roomId} members={members} myId={user.id} onChanged={reload} />
        )}
        {tab === 'feed' && <FeedTab roomId={roomId} version={room.version} />}
        {tab === 'settings' && (
          <Settings
            room={room}
            members={members}
            players={players}
            myRole={myRole}
            myId={user.id}
            reload={reload}
            onGone={() => navigate('/rooms')}
          />
        )}
      </div>
    </div>
  );
};

export default Room;
