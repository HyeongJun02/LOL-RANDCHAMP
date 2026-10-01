import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FaDice, FaTimes, FaRedo, FaRandom, FaExternalLinkAlt } from 'react-icons/fa';
import { loadLastLines } from '../../lib/lastLines';
import Modal from '../../components/common/Modal';
import KillLinePicker from './KillLinePicker';
import LaneTag from './LaneTag';
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
const CasualOpenModal = ({ players, recent = null, onClose, onOpen }) => {
  const [mode, setMode] = useState('normal');
  /* 고른 순서대로. [{ id, lane }] */
  const [team, setTeam] = useState([]);
  const [seconds, setSeconds] = useState(null);
  const [line, setLine] = useState(casualKillLine('normal'));
  const [busy, setBusy] = useState(false);

  const auto = casualKillLine(mode);
  const full = team.length >= CASUAL_TEAM_SIZE;
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const tierOf = (id) => players.find((p) => p.id === id)?.tier;

  /* 모드를 바꾸면 기준선도 그 모드의 자동값으로. 손으로 고쳐둔 값이 있어도
     일반(29.5)에서 고친 값을 칼바람(59.5)에 그대로 들고 가면 말이 안 된다 */
  const pickMode = (m) => {
    setMode(m);
    setLine(casualKillLine(m));
  };

  /* 라인은 미정으로 시작한다. 큐를 돌리기 전엔 라인이 안 정해진 경우가
     많다. 미정이면 첫 킬 배당은 다섯 중 하나(평균)로 본다 */
  const toggle = (id) =>
    setTeam((prev) => {
      if (prev.some((x) => x.id === id)) return prev.filter((x) => x.id !== id);
      if (prev.length >= CASUAL_TEAM_SIZE) return prev;
      return [...prev, { id, lane: null }];
    });

  /* 라인을 고르면 그 라인을 쓰던 사람과 자리를 맞바꾼다 (상대가 미정이었으면
     그쪽이 미정이 된다). 두 사람이 같은 라인이면 첫 킬 배당이 어긋난다.
     같은 라인을 다시 누르면 미정으로 돌아간다 */
  const setLane = (id, lane) =>
    setTeam((prev) => {
      const mine = prev.find((x) => x.id === id)?.lane ?? null;
      if (mine === lane) return prev.map((x) => (x.id === id ? { ...x, lane: null } : x));
      return prev.map((x) => {
        if (x.id === id) return { ...x, lane };
        if (x.lane === lane) return { ...x, lane: mine };
        return x;
      });
    });

  /* 매번 다섯 명과 포지션을 손으로 넣는 게 제일 번거로웠다 */
  const alive = new Set(players.map((p) => p.id));

  /* 직전 일반 게임을 그대로. 같은 사람들끼리 연달아 돌리는 게 보통이다 */
  const fillRecent = () => {
    if (!recent) return;
    const ids = (recent.team_a || []).map(Number).filter((id) => alive.has(id));
    setTeam(ids.slice(0, CASUAL_TEAM_SIZE).map((id) => ({ id, lane: recent.lanes?.[id] || null })));
    if (recent.mode && recent.mode !== mode) pickMode(recent.mode);
  };

  /* 라인 정하기에서 마지막으로 뽑은 결과. 이름이 명단과 같아야 들어온다 */
  const lastLines = loadLastLines();
  const fillFromLines = () => {
    if (!lastLines) return;
    const byName = new Map(players.map((p) => [p.name.trim(), p.id]));
    const keyOf = (label) => LANES.find((l) => l.label === label)?.key || null;
    const rows = lastLines.rows.filter((r) => byName.has(r.name));
    const missed = lastLines.rows.filter((r) => r.name && !byName.has(r.name));
    setTeam(rows.slice(0, CASUAL_TEAM_SIZE).map((r) => ({ id: byName.get(r.name), lane: keyOf(r.lane) })));
    if (mode !== 'normal') pickMode('normal');
    if (missed.length) toast.error(`명단에 없는 이름은 뺐어요: ${missed.map((r) => r.name).join(', ')}`);
  };

  /* 아직 라인이 없는 사람에게 남은 라인을 무작위로 */
  const randomRest = () =>
    setTeam((prev) => {
      const free = LANES.map((l) => l.key).filter((k) => !prev.some((x) => x.lane === k));
      for (let i = free.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [free[i], free[j]] = [free[j], free[i]];
      }
      return prev.map((x) => (x.lane ? x : { ...x, lane: free.shift() || null }));
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

      <div className="casual-quick">
        {recent && (
          <button className="ghost-btn" onClick={fillRecent}>
            <FaRedo /> 직전 일반 게임 그대로
          </button>
        )}
        {lastLines && (
          <button className="ghost-btn" onClick={fillFromLines}>
            <FaDice /> 라인 정하기 결과
          </button>
        )}
        {hasLanes(mode) && team.some((x) => !x.lane) && (
          <button className="ghost-btn" onClick={randomRest}>
            <FaRandom /> 남은 라인 랜덤
          </button>
        )}
        {/* 새 탭으로 연다. 여기서 뽑고 돌아오면 '라인 정하기 결과'가 생긴다 */}
        <a className="ghost-btn" href="/random-line" target="_blank" rel="noreferrer">
          라인 정하기 열기 <FaExternalLinkAlt />
        </a>
      </div>

      {/* 사람 칩은 고른 뒤에도 그 자리에 남는다. 고른 사람을 칩 목록에서
          빼거나 위에 쌓으면, 누를 때마다 남은 칩들이 밀려서 다음 사람을
          다시 찾아야 했다 */}
      <div className="casual-pool">
        {players.map((p) => {
          const on = team.some((x) => x.id === p.id);
          return (
            <button
              key={p.id}
              className={`casual-chip ${on ? 'is-on' : ''}`}
              onClick={() => toggle(p.id)}
              disabled={!on && full}
              aria-pressed={on}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* 고른 사람. 라인은 칼바람이면 안 그린다 */}
      {team.length > 0 && (
        <ul className="casual-team" style={{ marginTop: '0.6rem' }}>
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
                      title={`첫 킬 ${firstBloodOdds(l.key, mode, tierOf(x.id))}배`}
                    >
                      <LaneTag lane={l.key} />
                    </button>
                  ))}
                </div>
              )}
              <em className="casual-odds">
                {hasLanes(mode) && !x.lane && <span className="casual-undecided">미정 · </span>}
                첫 킬 {firstBloodOdds(x.lane, mode, tierOf(x.id)).toFixed(2)}배
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

      {hasLanes(mode) && (
        <p className="rooms-hint">
          라인은 몰라도 됩니다 — 미정이면 다섯 중 하나로 보고 {firstBloodOdds(null, mode)}배.
          정하면 서포터가 제일 높고({firstBloodOdds('SUPPORT', mode)}배),{' '}
          {laneLabel('MID')}·{laneLabel('ADC')}가 제일 낮습니다({firstBloodOdds('MID', mode)}배).
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
