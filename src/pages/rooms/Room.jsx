import React, { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaArrowLeft, FaKey, FaPlus, FaSync, FaTimes } from 'react-icons/fa';
import { useAuth } from '../../auth/AuthContext';
import {
  useRoom,
  canEdit as canEditRole,
  ROLE_LABEL,
  addRoomPlayer,
  updateRoomPlayer,
  removeRoomPlayer,
  addScrimByNames,
  removeScrim,
  renameRoom,
  getJoinCode,
  resetJoinCode,
  setMemberRole,
  transferRoom,
  kickMember,
  leaveRoom,
  deleteRoom,
} from '../../rooms';
import { TIERS, DIVISIONS, getTier } from '../../tiers';
import { MAX_ROOM_PLAYERS } from '../../limits';
import ScrimRecord from '../scrimRecord/ScrimRecord';
import Season from '../season/Season';
import PageHeader from '../../components/common/PageHeader';
import { usePageMeta, PAGE_META } from '../../seo';
import './Rooms.css';

const TABS = [
  { key: 'record', label: '기록' },
  { key: 'season', label: '정산' },
  { key: 'settings', label: '설정' },
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
  const busy = useRef(false);

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
    if (!window.confirm('코드를 새로 뽑으면 예전 코드는 못 씁니다. 이미 들어온 사람은 그대로예요.'))
      return;
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

  const patchPlayer = guard(async (id, patch) => {
    await updateRoomPlayer(id, patch);
    reload();
  });

  const dropPlayer = guard(async (p) => {
    if (!window.confirm(`'${p.name}' 님을 명단에서 지울까요? 지난 경기 기록은 남습니다.`)) return;
    await removeRoomPlayer(p.id);
    reload();
  });

  const changeRole = guard(async (m, role) => {
    await setMemberRole(room.id, m.user_id, role);
    reload();
  });

  const handOver = guard(async (m) => {
    if (!window.confirm(`'${m.nickname}' 님에게 방장을 넘길까요? 되돌리려면 그쪽이 다시 넘겨줘야 해요.`))
      return;
    await transferRoom(room.id, m.user_id);
    toast.success('방장을 넘겼어요.');
    reload();
  });

  const kick = guard(async (m) => {
    if (!window.confirm(`'${m.nickname}' 님을 내보낼까요?`)) return;
    await kickMember(room.id, m.user_id);
    reload();
  });

  const leave = guard(async () => {
    if (!window.confirm('이 방에서 나갈까요? 다시 들어오려면 입장 코드가 필요해요.')) return;
    await leaveRoom(room.id);
    onGone();
  });

  const remove = guard(async () => {
    if (!window.confirm(`'${room.name}' 방을 삭제할까요? 경기 기록까지 전부 사라지고 되돌릴 수 없어요.`))
      return;
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
          <h3>
            참가자 명단<span className="panel-count">{players.length}명</span>
          </h3>
          <p className="rooms-hint">
            기록지에서 새 이름을 적으면 여기에 자동으로 추가됩니다. 이름을 고쳐도 지난 전적은
            그대로 따라옵니다.
          </p>
          {players.map((p) => (
            <PlayerRow key={p.id} player={p} onPatch={patchPlayer} onDrop={dropPlayer} />
          ))}
          <div className="rooms-form-row">
            <input
              className="rooms-input"
              value={newName}
              maxLength={16}
              placeholder="참가자 이름"
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
        </section>
      )}

      <section className="room-panel">
        <h3>
          멤버<span className="panel-count">{members.length}명</span>
        </h3>
        <ul className="room-members">
          {members.map((m) => (
            <li key={m.user_id}>
              <span className="rooms-name">
                {m.nickname}
                {m.user_id === myId && <em> (나)</em>}
              </span>
              <span className={`rooms-role role-${m.role}`}>{ROLE_LABEL[m.role]}</span>
              <span className="room-member-points">{m.points.toLocaleString()} 끼꼬</span>
              {isOwner && m.user_id !== myId && (
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

  const { room, players, matches, members, myRole, loading, error, reload } = useRoom(
    roomId,
    user?.id
  );
  const [tab, setTab] = useState('record');

  const editable = canEditRole(myRole);

  const record = async (m) => {
    await addScrimByNames({ ...m, roomId, players });
    reload();
  };

  const unrecord = async (scrimId) => {
    await removeScrim(scrimId);
    reload();
  };

  if (authLoading || loading) return <div className="page" />;

  if (!user || error || !room) {
    return (
      <div className="page">
        <p className="rooms-blank">{error || '방을 볼 수 없어요.'}</p>
        <Link className="ghost-btn" to="/rooms">
          <FaArrowLeft /> 방 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title={room.name} sub={`${members.length}명 · 내 권한 ${ROLE_LABEL[myRole]}`}>
        <Link className="room-back" to="/rooms">
          <FaArrowLeft /> 방 목록
        </Link>
      </PageHeader>

      <div className="seg-tabs lg room-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`seg-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!editable && tab === 'record' && (
        <p className="rooms-hint room-readonly">
          이 방에서는 보기만 할 수 있어요. 기록은 방장과 부방장이 남깁니다.
        </p>
      )}

      {tab === 'record' && (
        <ScrimRecord
          matches={matches}
          players={players}
          canEdit={editable}
          onAdd={record}
          onRemove={unrecord}
        />
      )}
      {tab === 'season' && <Season matches={matches} players={players} />}
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
  );
};

export default Room;
