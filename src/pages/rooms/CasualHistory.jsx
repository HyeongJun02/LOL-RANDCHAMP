import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FaTimes, FaCoins, FaChevronRight, FaGamepad, FaBolt, FaDragon } from 'react-icons/fa';
import { useDialog } from '../../components/common/Dialog';
import Modal from '../../components/common/Modal';
import Empty from '../../components/common/Empty';
import BetTab from './BetTab';
import LaneTag from './LaneTag';
import { timeAgo } from '../../lib/timeAgo';
import {
  CASUAL_MODES,
  hasLanes,
  hasDragon,
  byLane,
  dragonIcon,
  dragonLabel,
  ALLY_ANY,
} from '../../rules/casual';

/* 대전 기록 탭의 '일반 게임'.

   우리끼리 일반·칼바람 큐를 돌리고 또또를 건 판들. 내전과는 섞지 않는다 -
   상대가 누군지 모르고 팀을 짠 것도 아니라 승패·전적·칭호 어디에도
   안 들어간다. 그래서 탭도 따로, 줄 모양도 따로다. 이긴 팀 대신
   우리 킬 : 상대 킬과 첫 킬·첫 용을 적는다. */

const num = (n) => Number(n || 0).toLocaleString();
const hhmm = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const dayLabel = (ts) => {
  const d = new Date(ts);
  if (dayKey(ts) === dayKey(Date.now())) return '오늘';
  if (dayKey(ts) === dayKey(Date.now() - 86400000)) return '어제';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
};

const CasualHistory = ({
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
  const nameOf = new Map(players.map((p) => [p.id, p.name]));

  const games = scrims
    .filter((s) => s.kind === 'casual' && s.status === 'settled')
    .sort((a, b) => new Date(b.played_at) - new Date(a.played_at));

  const remove = async (s) => {
    const had = s.bet_count > 0;
    const ok = await confirm({
      title: had ? '또또까지 되돌리기' : '기록 삭제',
      message: '이 일반 게임 기록을 지울까요?',
      detail: had
        ? `${s.bet_count}명이 건 ${num(s.bet_total)} 끼꼬가 전부 돌아가고, 지급도 취소됩니다. 되돌릴 수 없어요.`
        : '되돌릴 수 없어요.',
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await onRemove(s.id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (games.length === 0) {
    return (
      <div className="room-settings">
        <section className="room-panel">
          <h3>
            <FaGamepad /> 일반 게임
          </h3>
          <Empty
            icon={<FaGamepad />}
            title="아직 남은 일반 게임이 없어요"
            desc="또또 탭에서 '일반 게임 또또 열기'로 연 판이 정산되면 여기에 쌓입니다. 내전 전적에는 안 들어가요."
          />
        </section>
      </div>
    );
  }

  const days = new Map();
  games.forEach((s) => {
    const k = dayKey(s.played_at);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(s);
  });

  /* 첫 킬을 누가 땄나. 우리 쪽이 땄어도 라인 아이콘을 붙인다 - 상대만
     아이콘이 있으면 같은 칸인데 모양이 달라 보인다 */
  const firstKill = (s) => {
    const laned = hasLanes(s.mode);
    if (s.fb_side === 'them') {
      return s.fb_enemy_lane ? <LaneTag lane={s.fb_enemy_lane} prefix="상대 " /> : '상대 팀';
    }
    /* 우리 명단에 없는 우리 팀원 (3인큐면 나머지 둘) */
    if (s.fb_ally_lane) {
      return s.fb_ally_lane === ALLY_ANY ? (
        '우리 팀 (명단 밖)'
      ) : (
        <LaneTag lane={s.fb_ally_lane} prefix="우리 " />
      );
    }
    if (!s.first_blood_player_id) return null;
    return (
      <>
        {laned && s.lanes?.[s.first_blood_player_id] && (
          <LaneTag lane={s.lanes[s.first_blood_player_id]} className="is-icon-only" />
        )}
        {nameOf.get(s.first_blood_player_id) || '?'}
      </>
    );
  };

  /* 한 판 = 작은 카드 하나. 예전에는 한 줄 격자에 첫 킬 · 첫 용 칩을 고정
     폭 칸에 욱여넣어서, '화학공학 드래곤'처럼 긴 값이 오면 칩이 접히거나
     칸을 뚫고 나갔다. 윗줄에 '언제 · 결과', 아래에 '누가 · 무슨 일'을 둔다 */
  const row = (s) => {
    const laned = hasLanes(s.mode);
    const fb = firstKill(s);
    return (
      <li key={s.id} className="casual-card">
        <div className="casual-head">
          <span className="hist-time" title={timeAgo(new Date(s.played_at).getTime())}>
            {hhmm(s.played_at)}
          </span>
          <span className="casual-badge">
            {CASUAL_MODES.find((m) => m.key === s.mode)?.label || ''}
          </span>
          {s.our_win != null && (
            <span className={`casual-result ${s.our_win ? 'is-win' : 'is-lose'}`}>
              {s.our_win ? '승리' : '패배'}
            </span>
          )}
          {/* 이긴 팀보다 킬 수가 먼저 보이는 판이다 */}
          <span className="casual-row-score">
            <b>{s.our_kills ?? '-'}</b>
            <i>:</i>
            <b>{s.opp_kills ?? '-'}</b>
            {s.total_kills != null && <em>총 {s.total_kills}</em>}
          </span>
          <span className="casual-head-end">
            {s.bet_count > 0 && (
              <button className="hist-fact is-bet" onClick={() => setOpen(s)} title="또또 결과 보기">
                <FaCoins />
                {num(s.bet_total)}
                <FaChevronRight className="hist-more" />
              </button>
            )}
            {canEdit && (
              <button className="icon-btn hist-del" onClick={() => remove(s)} aria-label="기록 삭제">
                <FaTimes />
              </button>
            )}
          </span>
        </div>

        {/* 탑 · 정글 · 미드 · 원딜 · 서폿 순서로 한 줄에 한 명 */}
        <span className="casual-row-team">
          {byLane(s.team_a || [], s.lanes).map((id) => (
            <span key={id} className="casual-member">
              {laned && s.lanes?.[id] ? (
                <LaneTag lane={s.lanes[id]} className="is-icon-only" />
              ) : (
                laned && <i className="casual-member-blank" />
              )}
              {nameOf.get(Number(id)) || '?'}
            </span>
          ))}
        </span>

        {/* 이름표 | 값. 없는 값은 '-'로 둔다 - 칸이 사라지면 판마다 줄이 어긋난다 */}
        <dl className="casual-facts">
          <dt>
            <FaBolt /> 첫 킬
          </dt>
          <dd>{fb || '-'}</dd>
          {hasDragon(s.mode) && (
            <>
              <dt>
                <FaDragon /> 첫 용
              </dt>
              <dd>
                {s.first_dragon ? (
                  <>
                    <img className="bet-opt-icon" src={dragonIcon(s.first_dragon)} alt="" />
                    {dragonLabel(s.first_dragon)}
                  </>
                ) : (
                  '-'
                )}
              </dd>
            </>
          )}
        </dl>
      </li>
    );
  };

  return (
    <div className="room-settings">
      <section className="room-panel">
        <h3>
          <FaGamepad /> 일반 게임
          <span className="panel-count">{games.length}판</span>
          <span className="hist-sub">내전 전적과 따로</span>
        </h3>
        <ul className="history-list">
          {[...days.entries()].flatMap(([key, list]) => [
            <li className="day-sep" key={`d-${key}`} aria-hidden="true">
              <span>
                {dayLabel(list[0].played_at)}
                <em>{list.length}판</em>
              </span>
            </li>,
            ...list.map(row),
          ])}
        </ul>
      </section>

      {open && (
        <Modal
          title={`일반 게임 ${open.our_kills ?? '-'} : ${open.opp_kills ?? '-'}`}
          desc={`${timeAgo(new Date(open.played_at).getTime())} · 또또 결과`}
          onClose={() => setOpen(null)}
        >
          <BetTab
            single={open}
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

export default CasualHistory;
