import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaPlus, FaSignInAlt, FaUsers, FaPen, FaCoins, FaDoorOpen, FaSyncAlt } from 'react-icons/fa';
import { useAuth } from '../../auth/AuthContext';
import { useMe, useMyRooms, createRoom, joinRoom, setNickname, ROLE_LABEL } from '../../server/rooms';
import { MAX_ROOMS } from '../../server/limits';
import { accentVars } from '../../lib/roomStyle';
import { GAMES, DEFAULT_GAME, getGame } from '../../rules/games';
import PageHeader from '../../components/common/PageHeader';
import NicknameGate from '../../components/rooms/NicknameGate';
import { SkelRows } from '../../components/common/Skeleton';
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
        <PageHeader title="내전 방" sub="같이 하는 사람들과 기록을 한곳에 모읍니다.">
        {/* 목록만 다시 읽는다. 페이지를 통째로 새로고침하지 않아도 되게 */}
        <button className="ghost-btn rooms-refresh" onClick={refreshAll} disabled={loading}>
          <FaSyncAlt className={loading ? 'spin' : ''} /> 새로고침
        </button>
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
        <SkelRows count={3} h={92} />
      ) : error ? (
        <div className="rooms-empty">
          <FaDoorOpen />
          <strong>방 목록을 불러오지 못했어요</strong>
          <span>{error}</span>
          <button className="ghost-btn" style={{ marginTop: '0.5rem' }} onClick={reload}>
            다시 시도
          </button>
        </div>
      ) : rooms.length === 0 ? (
        <div className="rooms-empty">
          <FaDoorOpen />
          <strong>아직 들어간 방이 없어요</strong>
          <span>
            같이 하는 사람 중 한 명이 방을 만들고 입장 코드를 나눠주면 됩니다.
            <br />
            아래에서 방을 만들거나 코드를 넣어보세요.
          </span>
          {/* 분명히 방이 있는데 비어 보이는 경우를 위한 출구 */}
          <button className="ghost-btn" style={{ marginTop: '0.5rem' }} onClick={refreshAll}>
            <FaSyncAlt /> 다시 읽기
          </button>
        </div>
      ) : (
        <ul className="rooms-grid">
          {rooms.map((r) => (
            <li key={r.id}>
              {/* 방마다 고른 색과 엠블럼. 목록에서도 우리 방이 바로 눈에 띈다 */}
              <Link
                className={`room-card ${r.live ? 'is-live' : ''}`}
                style={accentVars(r.accent)}
                to={`/rooms/${r.id}`}
              >
                {/* 게임 이름은 방 이름 위에 한 줄로. 아래 통계 줄에 끼워 넣으면
                    '리그 오브 레전드'가 길어서 인원·끼꼬가 줄을 넘긴다 */}
                <span className="room-card-game">
                  <img className="game-logo is-tiny" src={getGame(r.game).logo} alt="" />
                  {getGame(r.game).label}
                </span>

                <span className="room-card-head">
                  <span className="room-card-emblem">{r.emblem}</span>
                  <strong className="room-card-name">{r.name}</strong>
                  <span className={`rooms-role role-${r.myRole}`}>{ROLE_LABEL[r.myRole]}</span>
                </span>

                {/* 지금 걸 수 있는 판이 돌고 있으면 그게 제일 급한 정보다 */}
                {r.live && (
                  <span className="room-card-live">
                    <i />
                    {r.live === 'betting' ? '또또 배팅 중' : '경기 진행 중'}
                  </span>
                )}

                <span className="room-card-foot">
                  <span className="room-card-stat">
                    <FaUsers /> {r.memberCount}명
                  </span>
                  <span className="room-card-stat is-kkiko">
                    <FaCoins /> {(r.myPoints ?? 0).toLocaleString()}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="rooms-forms">
        <div className="rooms-form">
          <label htmlFor="room-name">새 방 만들기</label>

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

          <div className="rooms-form-row">
            <input
              id="room-name"
              className="rooms-input"
              value={name}
              maxLength={20}
              placeholder="예) 목요일 내전"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && make()}
            />
            <button className="ghost-btn" onClick={make}>
              <FaPlus /> 만들기
            </button>
          </div>
          <p className="rooms-hint">
            방은 최대 {MAX_ROOMS}개까지. 만든 사람이 방장이 되고, 입장 코드는 설정 탭에 있어요.
            <br />
            <b>게임은 나중에 못 바꿉니다.</b> 티어와 전적이 게임에 묶여 있어요.
          </p>
        </div>

        <div className="rooms-form">
          <label htmlFor="room-code">입장 코드로 들어가기</label>
          <div className="rooms-form-row">
            <input
              id="room-code"
              className="rooms-input rooms-code-input"
              value={code}
              maxLength={6}
              placeholder="ABC234"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && enter()}
            />
            <button className="ghost-btn" onClick={enter}>
              <FaSignInAlt /> 입장
            </button>
          </div>
          <p className="rooms-hint">한 번 들어오면 다음부터는 코드가 필요 없어요.</p>
        </div>
      </div>
    </div>
  );
};

export default RoomList;
