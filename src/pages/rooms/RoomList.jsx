import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaPlus, FaSignInAlt, FaUsers, FaPen, FaCoins, FaDoorOpen } from 'react-icons/fa';
import { useAuth } from '../../auth/AuthContext';
import { useMe, useMyRooms, createRoom, joinRoom, setNickname, ROLE_LABEL } from '../../rooms';
import { MAX_ROOMS } from '../../limits';
import PageHeader from '../../components/common/PageHeader';
import NicknameGate from '../../components/rooms/NicknameGate';
import { SkelRows } from '../../components/common/Skeleton';
import { usePageMeta, PAGE_META } from '../../seo';
import './Rooms.css';

const RoomList = () => {
  const { user, loading: authLoading } = useAuth();
  usePageMeta(PAGE_META.rooms);

  const { me, reload: reloadMe } = useMe(user?.id);
  const { rooms, loading, error, reload } = useMyRooms(user?.id);

  const [name, setName] = useState('');
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
      await createRoom(name);
      setName('');
      toast.success('방을 만들었어요.');
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
        <PageHeader title="내전 방" sub="같이 하는 사람들과 기록을 한곳에 모읍니다." />
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
      <PageHeader title="내전 방" sub="같이 하는 사람들과 기록을 한곳에 모읍니다." />

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

      {error && <p className="rooms-blank">{error}</p>}

      {/* 방 목록이 먼저다. 여기 오는 이유의 대부분은 '내 방에 들어가기'인데
          만들기·입장 폼이 위를 차지하면 정작 방이 화면 밖으로 밀린다 */}
      {loading ? (
        <SkelRows count={3} h={92} />
      ) : rooms.length === 0 ? (
        <div className="rooms-empty">
          <FaDoorOpen />
          <strong>아직 들어간 방이 없어요</strong>
          <span>
            같이 하는 사람 중 한 명이 방을 만들고 입장 코드를 나눠주면 됩니다.
            <br />
            아래에서 방을 만들거나 코드를 넣어보세요.
          </span>
        </div>
      ) : (
        <ul className="rooms-grid">
          {rooms.map((r) => (
            <li key={r.id}>
              <Link className={`room-card ${r.live ? 'is-live' : ''}`} to={`/rooms/${r.id}`}>
                <span className="room-card-head">
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
