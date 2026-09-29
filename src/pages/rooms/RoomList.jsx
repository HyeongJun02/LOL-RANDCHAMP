import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaPlus, FaSignInAlt, FaPen, FaCoins, FaDoorOpen, FaSyncAlt, FaThumbtack } from 'react-icons/fa';
import { useAuth } from '../../auth/AuthContext';
import { useMe, useMyRooms, createRoom, joinRoom, setNickname, ROLE_LABEL } from '../../server/rooms';
import { MAX_ROOMS } from '../../server/limits';
import { accentVars } from '../../lib/roomStyle';
import { GAMES, DEFAULT_GAME, getGame } from '../../rules/games';
import PageHeader from '../../components/common/PageHeader';
import Empty from '../../components/common/Empty';
import Modal from '../../components/common/Modal';
import {
  SORTS,
  getSort,
  setSort,
  getPinned,
  togglePin,
  sortRooms,
} from '../../lib/roomPrefs';
import NicknameGate from '../../components/rooms/NicknameGate';
import { SkelList } from '../../components/common/Skeleton';
import { usePageMeta, PAGE_META } from '../../lib/seo';
import './Rooms.css';

const RoomList = () => {
  const { user, loading: authLoading } = useAuth();
  usePageMeta(PAGE_META.rooms);

  const { me, reload: reloadMe } = useMe(user?.id);
  /* me가 온 뒤에 읽는다 - 그때가 토큰이 확실히 붙은 시점이다 */
  const { rooms, loading, error, reload } = useMyRooms(user?.id, Boolean(me));

  /* me가 아직이면 방 목록도 못 읽는다. 둘 다 다시 읽어야 확실히 풀린다 */
  const refreshAll = () => {
    reloadMe();
    reload();
  };

  /* 한 번에 하나만 펼친다. 둘 다 열어두면 무엇을 하려던 건지 흐려진다 */
  const [form, setForm] = useState(null);
  /* 한 번 고른 순서는 다음에 와도 그대로다. 매번 다시 고르게 하면
     '정렬이 있다'는 사실 자체가 짐이 된다 */
  const [sort, setSortState] = useState(getSort);
  const [pinned, setPinned] = useState(getPinned);

  const pickSort = (key) => {
    setSortState(key);
    setSort(key);
  };

  const pin = (e, id) => {
    /* 카드 전체가 링크라 핀만 눌러도 방으로 들어가 버린다 */
    e.preventDefault();
    e.stopPropagation();
    setPinned(togglePin(id));
  };

  const shown = sortRooms(rooms, sort, pinned);
  const [name, setName] = useState('');
  const [game, setGame] = useState(DEFAULT_GAME);
  const [code, setCode] = useState('');
  const [nick, setNick] = useState(null);
  /* 더블클릭으로 방이 두 개 만들어지는 걸 막는다.
     상태로 잡으면 렌더 클로저의 옛 값을 읽어서 두 번 통과한다 */
  const busy = useRef(false);

  const guard = async (fn) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await fn();
    } catch (e) {
      toast.error(e.message);
    } finally {
      busy.current = false;
    }
  };

  const make = () =>
    guard(async () => {
      if (!name.trim()) {
        toast.error('방 이름을 적어주세요.');
        return;
      }
      await createRoom(name, game);
      setName('');
      setForm(null);
      toast.success(`${getGame(game).label} 내전 방을 만들었어요.`);
      reload();
    });

  const enter = () =>
    guard(async () => {
      if (!code.trim()) {
        toast.error('입장 코드를 적어주세요.');
        return;
      }
      await joinRoom(code);
      setCode('');
      setForm(null);
      toast.success('방에 들어왔어요. 이제 코드 없이 다시 올 수 있어요.');
      reload();
    });

  const saveNick = () =>
    guard(async () => {
      await setNickname(nick);
      setNick(null);
      toast.success('이름을 바꿨어요.');
      reloadMe();
    });

  if (authLoading) return <div className="page" />;

  if (!user) {
    return (
      <div className="page">
        {/* 할 일은 제목과 같은 줄에. 목록 아래에 두면 방이 많을수록
          아래로 밀려서, 방을 만들려고 스크롤을 내려야 했다 */}
      <PageHeader bar title="내전 방" sub="같이 하는 사람들과 기록을 한곳에 모읍니다.">
        <div className="page-head-actions">
          <button
            className="icon-btn"
            onClick={refreshAll}
            disabled={loading}
            title="목록 다시 읽기"
            aria-label="목록 다시 읽기"
          >
            <FaSyncAlt className={loading ? 'spin' : ''} />
          </button>
          <button className="ghost-btn" onClick={() => setForm('join')}>
            <FaSignInAlt /> 코드로 참가
          </button>
          <button className="primary-btn" onClick={() => setForm('make')}>
            <FaPlus /> 방 만들기
          </button>
        </div>
      </PageHeader>
        <p className="rooms-blank">
          내전 방은 여러 명이 같이 보는 공간이라 로그인이 필요합니다.
          <br />
          오른쪽 위에서 구글 계정으로 들어와 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="내전 방" sub="같이 하는 사람들과 기록을 한곳에 모읍니다.">
        {/* 목록만 다시 읽는다. 페이지를 통째로 새로고침하지 않아도 되게 */}
        <button className="ghost-btn rooms-refresh" onClick={refreshAll} disabled={loading}>
          <FaSyncAlt className={loading ? 'spin' : ''} /> 새로고침
        </button>
      </PageHeader>

      {/* 이름을 안 정했으면 여기서 막는다 */}
      {me && !me.nickname && <NicknameGate onSaved={reloadMe} />}

      <div className="rooms-me">
        <span className="rooms-me-label">방에서 쓰는 이름</span>
        {nick === null ? (
          <>
            <span className="rooms-me-name">{me?.nickname || '이름 없음'}</span>
            <button
              className="rooms-me-edit"
              onClick={() => setNick(me?.nickname || '')}
              aria-label="이름 바꾸기"
            >
              <FaPen />
            </button>
          </>
        ) : (
          <>
            <input
              className="rooms-input"
              value={nick}
              maxLength={12}
              placeholder="방에서 쓸 이름"
              onChange={(e) => setNick(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveNick()}
            />
            <button className="ghost-btn" onClick={saveNick}>
              저장
            </button>
            <button className="ghost-btn" onClick={() => setNick(null)}>
              취소
            </button>
          </>
        )}
        <span className="rooms-me-note">
          {rooms.length > 0 ? `${rooms.length}개 방` : '아직 방 없음'} · 끼꼬는 방마다 따로 쌓입니다
        </span>
      </div>

      {/* 방 목록이 먼저다. 여기 오는 이유의 대부분은 '내 방에 들어가기'인데
          만들기·입장 폼이 위를 차지하면 정작 방이 화면 밖으로 밀린다.

          '못 읽었음'과 '방이 없음'은 다른 이야기다. 둘을 같이 두면
          잠깐 끊겼을 뿐인데 방을 다 잃은 것처럼 보인다 */}
      {loading ? (
        <SkelList count={3} h={56} />
      ) : error ? (
        <Empty
          icon={<FaDoorOpen />}
          title="방 목록을 불러오지 못했어요"
          desc={error}
          action={
            <button className="ghost-btn" onClick={reload}>
              다시 시도
            </button>
          }
        />
      ) : rooms.length === 0 ? (
        <Empty
          icon={<FaDoorOpen />}
          title="아직 들어간 방이 없어요"
          desc="아래에서 방을 만들거나, 받은 입장 코드를 넣어보세요."
          action={
            /* 분명히 방이 있는데 비어 보이는 경우를 위한 출구 */
            <button className="ghost-btn" onClick={refreshAll}>
              <FaSyncAlt /> 다시 읽기
            </button>
          }
        />
      ) : (
        <>
        {/* 방이 둘뿐이면 고를 일이 없다. 셋부터 보여준다 */}
        {rooms.length > 2 && (
          <div className="rooms-sort">
            {SORTS.map((o) => (
              <button
                key={o.key}
                className={`rooms-sort-opt ${sort === o.key ? 'is-on' : ''}`}
                onClick={() => pickSort(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        <ul className="rooms-grid">
          {shown.map((r) => (
            <li key={r.id}>
              {/* 한 줄에 한 방. 네 줄짜리 카드로 두니 방 셋만 있어도
                  화면이 꽉 차서, 정작 어느 방에 들어갈지가 안 보였다 */}
              <Link
                className={`room-card ${r.live ? 'is-live' : ''}`}
                style={accentVars(r.accent)}
                to={`/rooms/${r.id}`}
              >
                {/* 자주 가는 방은 위로. 핀은 이 기기에만 남는다 */}
                <button
                  className={`room-pin ${pinned.includes(Number(r.id)) ? 'is-on' : ''}`}
                  onClick={(e) => pin(e, r.id)}
                  title={pinned.includes(Number(r.id)) ? '고정 풀기' : '위로 고정'}
                  aria-label={pinned.includes(Number(r.id)) ? '고정 풀기' : '위로 고정'}
                >
                  <FaThumbtack />
                </button>

                <span className="room-card-emblem">{r.emblem}</span>

                <span className="room-card-main">
                  <span className="room-card-top">
                    <strong className="room-card-name">{r.name}</strong>
                    <span className={`rooms-role role-${r.myRole}`}>{ROLE_LABEL[r.myRole]}</span>
                  </span>
                  <span className="room-card-sub">
                    <img className="game-logo is-tiny" src={getGame(r.game).logo} alt="" />
                    {getGame(r.game).label} · {r.memberCount}명
                  </span>
                </span>

                {/* 지금 걸 수 있는 판이 돌고 있으면 그게 제일 급한 정보다 */}
                {r.live && (
                  <span className="room-card-live">
                    <i />
                    {r.live === 'betting' ? '배팅 중' : '경기 중'}
                  </span>
                )}

                <span className="room-card-kkiko">
                  <FaCoins /> {(r.myPoints ?? 0).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        </>
      )}

      {form === 'make' && (
        <Modal
          title="새 방 만들기"
          desc="만든 사람이 방장이 됩니다"
          size="modal-sm"
          onClose={() => setForm(null)}
        >
          {/* 게임은 만들 때 정하면 끝이다. 티어 체계와 전적이 게임에 묶여
              있어서 나중에 바꾸면 쌓인 게 전부 의미를 잃는다 */}
          <div className="game-pick">
            {GAMES.map((g) => (
              <button
                key={g.key}
                className={`game-opt ${game === g.key ? 'is-on' : ''}`}
                style={{ '--game': g.color }}
                onClick={() => setGame(g.key)}
              >
                <img className="game-logo" src={g.logo} alt="" />
                <strong>{g.label}</strong>
              </button>
            ))}
          </div>

          <input
            className="rooms-input rooms-solo"
            value={name}
            maxLength={20}
            placeholder="방 이름 (예: 목요일 내전)"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && make()}
            autoFocus
          />
          <p className="rooms-hint">
            최대 {MAX_ROOMS}개. <b>게임은 나중에 못 바꿉니다.</b> 티어와 전적이 게임에
            묶여 있어요.
          </p>

          <div className="modal-actions">
            <button className="ghost-btn" onClick={() => setForm(null)}>
              취소
            </button>
            <button className="primary-btn" onClick={make}>
              만들기
            </button>
          </div>
        </Modal>
      )}

      {form === 'join' && (
        <Modal
          title="코드로 참가"
          desc="방장이 알려준 여섯 자리를 넣으세요"
          size="modal-sm"
          onClose={() => setForm(null)}
        >
          <input
            className="rooms-input rooms-code-input rooms-solo"
            value={code}
            maxLength={6}
            placeholder="ABC234"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && enter()}
            autoFocus
          />
          <p className="rooms-hint">한 번 들어오면 다음부터는 코드가 필요 없어요.</p>

          <div className="modal-actions">
            <button className="ghost-btn" onClick={() => setForm(null)}>
              취소
            </button>
            <button className="primary-btn" onClick={enter}>
              입장
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default RoomList;
