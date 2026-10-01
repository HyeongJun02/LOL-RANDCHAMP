import React, { useState } from 'react';
import { FaDice, FaTimes } from 'react-icons/fa';
import Modal from '../../components/common/Modal';
import KillLinePicker from './KillLinePicker';
import { ClosePresets, LINE_HINT } from './BetOpenModal';
import {
  CASUAL_MODES,
  CASUAL_TEAM_SIZE,
  LANES,
  casualKillLine,
  hasLanes,
  laneLabel,
  firstBloodOdds,
} from '../../rules/casual';

/* 일반 게임 또또를 열기 전에 정하는 것들.

   내전과 달리 팀을 짜지 않는다. 우리 다섯이 한 팀으로 큐를 돌리고, 상대는
   모른다. 그래서 '누가 뛰나'와 '어느 라인인가'만 고른다.
   라인을 받는 건 첫 킬 배당 때문이다 - 서포터가 따기 제일 어렵다.
   칼바람은 라인이 없어서 사람만 고른다. */
const CasualOpenModal = ({ players, onClose, onOpen }) => {
  const [mode, setMode] = useState('normal');
  /* 고른 순서대로. [{ id, lane }] */
  const [team, setTeam] = useState([]);
  const [seconds, setSeconds] = useState(null);
  const [line, setLine] = useState(casualKillLine('normal'));
  const [busy, setBusy] = useState(false);

  const auto = casualKillLine(mode);
  const full = team.length >= CASUAL_TEAM_SIZE;
  const nameOf = new Map(players.map((p) => [p.id, p.name]));

  /* 모드를 바꾸면 기준선도 그 모드의 자동값으로. 손으로 고쳐둔 값이 있어도
     일반(29.5)에서 고친 값을 칼바람(59.5)에 그대로 들고 가면 말이 안 된다 */
  const pickMode = (m) => {
    setMode(m);
    setLine(casualKillLine(m));
  };

  /* 비어 있는 라인 중 첫 번째를 준다. 다섯이 다 다른 라인이어야 하니,
     하나씩 고를 때마다 남는 자리를 채워 넣는다 */
  const freeLane = (taken) => LANES.find((l) => !taken.includes(l.key))?.key || null;

  const toggle = (id) =>
    setTeam((prev) => {
      if (prev.some((x) => x.id === id)) return prev.filter((x) => x.id !== id);
      if (prev.length >= CASUAL_TEAM_SIZE) return prev;
      return [...prev, { id, lane: freeLane(prev.map((x) => x.lane)) }];
    });

  /* 라인을 바꾸면 그 라인을 쓰던 사람과 자리를 맞바꾼다. 두 사람이 같은
     라인이면 첫 킬 배당이 어긋난다 */
  const setLane = (id, lane) =>
    setTeam((prev) => {
      const mine = prev.find((x) => x.id === id)?.lane ?? null;
      return prev.map((x) => {
        if (x.id === id) return { ...x, lane };
        if (x.lane === lane) return { ...x, lane: mine };
        return x;
      });
    });

  const start = async () => {
    setBusy(true);
    try {
      await onOpen({
        mode,
        playerIds: team.map((x) => x.id),
        /* 칼바람은 라인이 없다. 넘기지 않는다 */
        lanes: hasLanes(mode)
          ? Object.fromEntries(team.filter((x) => x.lane).map((x) => [x.id, x.lane]))
          : {},
        closeSeconds: seconds,
        killLine: line,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="일반 게임 또또"
      desc="내전이 아니라 우리끼리 큐를 돌릴 때 겁니다. 전적에는 안 남고 끼꼬만 오갑니다."
      onClose={onClose}
      footer={
        <button className="dialog-ok" onClick={start} disabled={busy || team.length === 0}>
          <FaDice /> {busy ? '여는 중…' : '또또 열기'}
        </button>
      }
    >
      <p className="bet-open-label">무슨 게임</p>
      <div className="seg-tabs casual-modes">
        {CASUAL_MODES.map((m) => (
          <button
            key={m.key}
            className={`seg-tab ${mode === m.key ? 'active' : ''}`}
            onClick={() => pickMode(m.key)}
          >
            {m.label}
            <em>{m.desc}</em>
          </button>
        ))}
      </div>

      <p className="bet-open-label" style={{ marginTop: '1rem' }}>
        뛰는 사람 <b>{team.length}</b>/{CASUAL_TEAM_SIZE}
      </p>

      {/* 고른 사람. 라인은 칼바람이면 안 그린다 */}
      {team.length > 0 && (
        <ul className="casual-team">
          {team.map((x) => (
            <li key={x.id}>
              <span className="casual-name">{nameOf.get(x.id) || '?'}</span>
              {hasLanes(mode) && (
                <div className="casual-lanes">
                  {LANES.map((l) => (
                    <button
                      key={l.key}
                      className={`casual-lane ${x.lane === l.key ? 'is-on' : ''}`}
                      onClick={() => setLane(x.id, l.key)}
                      title={`첫 킬 ${firstBloodOdds(l.key, mode)}배`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
              <em className="casual-odds">
                {x.lane || !hasLanes(mode)
                  ? `첫 킬 ${firstBloodOdds(x.lane, mode)}배`
                  : '라인을 골라주세요'}
              </em>
              <button
                className="icon-btn"
                onClick={() => toggle(x.id)}
                aria-label={`${nameOf.get(x.id)} 빼기`}
              >
                <FaTimes />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 아직 안 고른 사람. 다 찼으면 더 못 누른다 */}
      <div className="casual-pool">
        {players
          .filter((p) => !team.some((x) => x.id === p.id))
          .map((p) => (
            <button
              key={p.id}
              className="casual-chip"
              onClick={() => toggle(p.id)}
              disabled={full}
            >
              {p.name}
            </button>
          ))}
      </div>
      {hasLanes(mode) && (
        <p className="rooms-hint">
          라인마다 첫 킬 배당이 다릅니다. 서포터가 제일 높고(
          {firstBloodOdds('SUPPORT', mode)}배), {laneLabel('MID')}·{laneLabel('ADC')}가 제일
          낮습니다({firstBloodOdds('MID', mode)}배).
        </p>
      )}

      <div style={{ marginTop: '1rem' }}>
        <ClosePresets seconds={seconds} onChange={setSeconds} />
      </div>

      <p className="bet-open-label" style={{ marginTop: '1rem' }}>
        총 킬 기준선 (양 팀 합계)
      </p>
      <KillLinePicker
        value={line}
        auto={auto}
        autoLabel={`${CASUAL_MODES.find((m) => m.key === mode).label} 기본값`}
        onChange={setLine}
      />
      {LINE_HINT}
    </Modal>
  );
};

export default CasualOpenModal;
