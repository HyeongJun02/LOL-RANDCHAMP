import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FaTimes, FaCrosshairs, FaCoins, FaTint, FaChevronRight } from 'react-icons/fa';
import { useDialog } from '../../components/common/Dialog';
import Modal from '../../components/common/Modal';
import BetTab from './BetTab';
import { timeAgo } from '../../lib/timeAgo';
import '../scrimRecord/ScrimRecord.css';

/* 방의 '내전 기록' 탭.

   전에는 '게임 시작' 탭 밑에 붙어 있었는데, 팀을 넣는 화면과 지난 판을
   훑는 화면은 하는 일이 다르다. 한 판 기록하려고 들어왔다가 목록을
   지나쳐야 했고, 지난 판을 보려면 입력칸부터 스크롤해야 했다. */

const num = (n) => Number(n || 0).toLocaleString();

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
    return <p className="rooms-blank">아직 기록된 경기가 없어요.</p>;
  }

  const card = (m) => {
    const hasBets = m.betCount > 0;
    return (
      <li key={m.id} className={hasBets ? 'has-bets' : ''}>
              <div className="hist-head">
                <span className="hist-time">{timeAgo(m.playedAt)}</span>

                {/* 한 판에서 알아둘 만한 것들. 없는 건 아예 안 그린다 -
                    '-'로 채우면 빈 칸이 정보인 척한다 */}
                <span className="hist-facts">
                  {/* 총 킬만 적으면 그게 많은 건지 적은 건지 알 수가 없다.
                      그 판의 기준선과 결과를 같이 붙인다 */}
                  {m.totalKills != null && (
                    <span
                      className={`hist-fact ${
                        m.killLine == null
                          ? ''
                          : m.totalKills > m.killLine
                            ? 'is-over'
                            : 'is-under'
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
                  {hasBets && (
                    <button
                      className="hist-fact is-bet"
                      onClick={() => setOpen(m)}
                      title="또또 결과 보기"
                    >
                      <FaCoins />
                      {num(m.betTotal)}
                      <FaChevronRight className="hist-more" />
                    </button>
                  )}
                </span>

                {canEdit && (
                  <button className="row-del" onClick={() => remove(m)} aria-label="기록 삭제">
                    <FaTimes />
                  </button>
                )}
              </div>

              {/* 1팀은 늘 왼쪽, 2팀은 늘 오른쪽. 이긴 쪽을 위로 올리면
                  카드마다 자리가 바뀌어서 여러 판을 훑을 때 매번 다시
                  읽어야 한다. 자리는 고정하고 이긴 쪽에 금색 띠를 준다 */}
              <div className="hist-teams">
                {[
                  { side: 'A', label: '1팀', names: m.teamA },
                  { side: 'B', label: '2팀', names: m.teamB },
                ].map(({ side, label, names }) => (
                  <div
                    key={side}
                    className={`hist-side ${side === m.winner ? 'is-win' : 'is-lose'}`}
                  >
                    <span className="hist-tag">{label}</span>
                    {/* 퍼블은 위에 따로 적는 것보다 그 사람 이름에 붙는 편이
                        바로 읽힌다. '누가 땄나'를 이름에서 찾게 된다 */}
                    <span className="hist-names">
                      {names.map((n, i) => (
                        <span
                          key={n}
                          className={`hist-name ${n === m.firstBlood ? 'is-fb' : ''}`}
                          title={n === m.firstBlood ? '퍼스트 블러드' : undefined}
                        >
                          {n === m.firstBlood && <FaTint />}
                          {n}
                          {i < names.length - 1 && <i className="hist-comma">,</i>}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
      </li>
    );
  };

  return (
    <>
      {/* 며칠에 걸쳐 몇 판 했는지가 먼저 보이면 아래 목록이 읽히기 시작한다 */}
      <div className="hist-summary">
        <span>
          <b>{history.length}</b>판
        </span>
        <span>
          <b>{days.size}</b>일
        </span>
        {betGames > 0 && (
          <span className="is-bet">
            또또 <b>{betGames}</b>판
          </span>
        )}
      </div>

      {[...days.entries()].map(([key, list]) => (
        <section className="hist-day" key={key}>
          <h3 className="hist-day-label">
            {dayLabel(list[0].playedAt)}
            <em>{list.length}판</em>
          </h3>
          {/* 넓은 화면에서는 두 열. 한 열로만 두면 좌우가 통째로 비어 있다 */}
          <ul className="history-list">{list.map(card)}</ul>
        </section>
      ))}

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
    </>
  );
};

export default MatchHistory;
