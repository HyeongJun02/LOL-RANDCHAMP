import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaTimes,
  FaCrosshairs,
  FaCoins,
  FaTint,
  FaChevronRight,
  FaClipboardList,
} from 'react-icons/fa';
import { useDialog } from '../../components/common/Dialog';
import Modal from '../../components/common/Modal';
import Empty from '../../components/common/Empty';
import BetTab from './BetTab';
import { timeAgo } from '../../lib/timeAgo';
import { getMode, hasModeChoice } from '../../rules/games';
import { useGameKey } from '../../lib/GameContext';

/* 방의 '내전 기록' 탭.

   전에는 '게임 시작' 탭 밑에 붙어 있었는데, 팀을 넣는 화면과 지난 판을
   훑는 화면은 하는 일이 다르다. 한 판 기록하려고 들어왔다가 목록을
   지나쳐야 했고, 지난 판을 보려면 입력칸부터 스크롤해야 했다.

   이 탭만 패널(.room-panel) 없이 맨몸이었다. 다른 탭은 전부 제목줄이
   달린 패널 안에 들어 있어서, 탭을 옮기면 이 탭만 허전해 보였다.
   같은 틀에 넣고, 날짜 구분선도 로그 탭과 같은 것(.day-sep)을 쓴다. */

const num = (n) => Number(n || 0).toLocaleString();

/* 몇 시에 한 판인지. timeAgo('3일 전')는 날짜 구분선이 이미 말해주는 데다
   길이가 줄마다 달라서, 그 칸 폭이 흔들리면 오른쪽의 VS까지 같이 밀린다.
   시계 시간은 늘 다섯 글자다 */
const hhmm = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/* 시간만 죽 나열하면 언제 몰아서 했는지가 안 보인다. 내전은 하루에
   여러 판을 붙어서 하는 놀이라 '그날'이 묶음의 단위다 */
const dayLabel = (ts) => {
  const d = new Date(ts);
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86400000);
  if (dayKey(ts) === today) return '오늘';
  if (dayKey(ts) === yesterday) return '어제';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
};

const MatchHistory = ({
  matches = [],
  scrims = [],
  players = [],
  members = [],
  myId,
  canEdit = false,
  isOwner = false,
  version,
  onRemove,
  onChanged,
}) => {
  const { confirm } = useDialog();
  const gameKey = useGameKey();
  /* 롤은 모드가 하나뿐이라 줄마다 '일반'이 붙으면 그냥 소음이다.
     발로란트는 일반·신속·난투가 팀 인원까지 다르니 꼭 보여야 한다 */
  const showMode = hasModeChoice(gameKey);
  const [open, setOpen] = useState(null);

  const history = [...matches].sort((a, b) => b.playedAt - a.playedAt);

  /* 날짜별로 묶는다. Map은 넣은 순서를 지키므로 최신 날이 먼저 온다 */
  const days = new Map();
  history.forEach((m) => {
    const k = dayKey(m.playedAt);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(m);
  });

  const betGames = history.filter((m) => m.betCount > 0).length;

  /* 지우면 그 경기가 지갑에 한 일까지 전부 되돌아간다.
     또또가 걸렸던 판이면 남의 돈이 오가므로 무슨 일이 일어나는지 적어준다 */
  const remove = async (m) => {
    const had = m.betCount > 0;
    const ok = await confirm({
      title: had ? '또또까지 되돌리기' : '기록 삭제',
      message: had ? '이 경기를 없던 걸로 할까요?' : '이 기록을 지울까요?',
      detail: had
        ? `${m.betCount}명이 건 ${num(m.betTotal)} 끼꼬가 전부 돌아가고, 지급도 취소됩니다. 되돌릴 수 없어요.`
        : '전적에서 빠지고, 참여 포인트도 함께 되돌아갑니다.',
      confirmText: had ? '되돌리고 삭제' : '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await onRemove(m.id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (history.length === 0) {
    return (
      <div className="room-settings">
        <section className="room-panel">
          <h3>
            <FaClipboardList /> 지난 판
          </h3>
          <Empty
            icon={<FaClipboardList />}
            title="아직 남긴 판이 없어요"
            desc="게임 시작 탭에서 팀을 채우고 이긴 팀을 고르면 여기에 쌓입니다."
          />
        </section>
      </div>
    );
  }

  /* 한 판 = 한 줄. 왼쪽부터 순서대로 읽으면 끝난다.

       19:42 │ 1팀 승 철수,민수 │ VS │ 2팀 영희,준호 │ 53킬 언더 · 또또 1.2만 │ ✕

     전에는 위에 '시간 + 칩', 아래에 '두 팀'으로 두 줄이었다. 그러면 어느
     칩이 어느 팀 것인지 헷갈리고(둘 다 아닌 판 전체 것이다), 줄 높이가
     칩 유무에 따라 달라져서 여러 판을 훑을 때 눈이 계속 튀었다.
     1팀은 늘 왼쪽, 2팀은 늘 오른쪽 - 이긴 쪽을 위로 올리지 않는다. */
  const card = (m) => (
    <li key={m.id} className={`hist-row ${m.betCount > 0 ? 'has-bets' : ''}`}>
      {/* 시간과 모드를 한 칸에 담는다. 모드를 따로 칸으로 두면 모드가 없는
          방(롤)에서는 요소가 하나 적어져서 뒤의 것들이 전부 한 칸씩
          밀린다 - 2팀이 1.6rem 칸에 들어가 이름이 세 줄로 접혔다 */}
      <span className="hist-meta">
        <span className="hist-time" title={timeAgo(m.playedAt)}>
          {hhmm(m.playedAt)}
        </span>
        {showMode && <span className="hist-mode">{getMode(gameKey, m.mode).label}</span>}
      </span>

      {[
        { side: 'A', label: '1팀', names: m.teamA },
        { side: 'B', label: '2팀', names: m.teamB },
      ].flatMap(({ side, label, names }) => [
        side === 'B' ? (
          <span className="hist-vs" key="vs" aria-hidden="true">
            VS
          </span>
        ) : null,
        <div key={side} className={`hist-side ${side === m.winner ? 'is-win' : 'is-lose'}`}>
          <span className="hist-tag">
            {label}
            {/* 금색 띠만으로는 '이겼다'가 아니라 '강조됐다'로만 읽힌다.
                말로 한 번 더 적어준다 */}
            {side === m.winner && <b>승</b>}
          </span>
          {/* 퍼블은 위에 따로 적는 것보다 그 사람 이름에 붙는 편이 바로
              읽힌다. '누가 땄나'를 이름에서 찾게 된다 */}
          <span className="hist-names">
            {names.map((n) => (
              <span
                key={n}
                className={`hist-name ${n === m.firstBlood ? 'is-fb' : ''}`}
                title={n === m.firstBlood ? '퍼스트 블러드' : undefined}
              >
                {n}
                {n === m.firstBlood && <FaTint />}
              </span>
            ))}
          </span>
        </div>,
      ])}

      {/* 판 전체에 딸린 것들. 없는 건 아예 안 그린다 - '-'로 채우면
          빈 칸이 정보인 척한다 */}
      <span className="hist-facts">
        {m.totalKills != null && (
          <span
            className={`hist-fact ${
              m.killLine == null ? '' : m.totalKills > m.killLine ? 'is-over' : 'is-under'
            }`}
            title="총 킬"
          >
            <FaCrosshairs />
            {m.totalKills}킬
            {m.killLine != null && (
              <em>
                {m.killLine} {m.totalKills > m.killLine ? '오버' : '언더'}
              </em>
            )}
          </span>
        )}
        {m.betCount > 0 && (
          <button className="hist-fact is-bet" onClick={() => setOpen(m)} title="또또 결과 보기">
            <FaCoins />
            {num(m.betTotal)}
            <FaChevronRight className="hist-more" />
          </button>
        )}
      </span>

      {canEdit && (
        <button className="icon-btn hist-del" onClick={() => remove(m)} aria-label="기록 삭제">
          <FaTimes />
        </button>
      )}
    </li>
  );

  return (
    <div className="room-settings">
      {/* 다른 탭과 같은 틀. 제목줄 왼쪽의 강조 막대까지 그대로 따라온다.
          날짜마다 패널을 하나씩 두면 한두 판만 한 날이 우스워지므로,
          패널 하나 안에서 날짜로만 끊는다 */}
      <section className="room-panel">
        <h3>
          <FaClipboardList /> 지난 판
          <span className="panel-count">{history.length}판</span>
          <span className="hist-sub">
            <b>{days.size}</b>일
            {betGames > 0 && (
              <>
                {' · '}
                <span className="is-bet">
                  또또 <b>{betGames}</b>판
                </span>
              </>
            )}
          </span>
        </h3>

        <ul className="history-list">
          {[...days.entries()].flatMap(([key, list]) => [
            <li className="day-sep" key={`d-${key}`} aria-hidden="true">
              <span>
                {dayLabel(list[0].playedAt)}
                <em>{list.length}판</em>
              </span>
            </li>,
            ...list.map(card),
          ])}
        </ul>
      </section>

      {/* 또또 탭과 같은 화면을 그대로 띄운다. 결과를 두 벌로 그리면
          둘이 조금씩 달라지고, 어느 쪽이 맞는지 아무도 모르게 된다 */}
      {open && (
        <Modal
          title={`${open.winner === 'A' ? '1팀' : '2팀'} 승리`}
          desc={`${timeAgo(open.playedAt)} · 또또 결과`}
          onClose={() => setOpen(null)}
        >
          <BetTab
            single={scrims.find((s) => s.id === open.id) || null}
            scrims={scrims}
            activeScrim={null}
            players={players}
            members={members}
            myId={myId}
            canEdit={canEdit}
            isOwner={isOwner}
            version={version}
            onChanged={onChanged}
          />
        </Modal>
      )}
    </div>
  );
};

export default MatchHistory;
