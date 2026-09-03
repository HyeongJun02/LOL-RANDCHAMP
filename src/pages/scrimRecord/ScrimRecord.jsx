import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FaArrowRight, FaPlus, FaTimes, FaTrophy, FaClipboardList } from 'react-icons/fa';
import { useRoster } from '../../roster';
import { getTier, tierName } from '../../tiers';
import { useMatches, addMatch, removeMatch, statsFor, statOf } from '../../matches';
import { loadLastSplit } from '../../lastSplit';
import RosterPicker from '../../components/common/RosterPicker';
import ScrimBadge from '../../components/common/ScrimBadge';
import ScrimPointsHelp from '../../components/common/ScrimPointsHelp';
import PageHeader from '../../components/common/PageHeader';
import { usePageMeta, PAGE_META } from '../../seo';
import './ScrimRecord.css';

const MODES = [
  { value: 'normal', label: '일반 내전' },
  { value: 'aram', label: '칼바람 내전' },
];

const TEAM_SIZE = 5;
const blankTeam = () => Array.from({ length: TEAM_SIZE }, () => '');

/* 컴포넌트 함수 안에서 매 렌더마다 새로 만들면 리액트가 다른 컴포넌트로 보고
   통째로 재마운트한다 (인풋 포커스가 키 입력마다 날아가는 버그로 이어짐).
   그래서 모듈 스코프에 한 번만 선언하고 필요한 값은 전부 props로 받는다. */
const TeamPanel = ({ label, team, otherTeam, onChangeAt, onRemoveAt, onAdd, accent }) => (
  <div className={`sr-team ${accent}`}>
    <div className="sr-team-head">
      <h3>{label}</h3>
      <span className="sr-team-count">{team.filter((n) => n.trim()).length}명</span>
    </div>
    {team.map((name, i) => (
      <div className="sr-row" key={i}>
        <span className="row-no">{i + 1}</span>
        <input
          value={name}
          placeholder="이름"
          onChange={(e) => onChangeAt(i, e.target.value)}
        />
        <RosterPicker
          taken={[...team.filter((_, idx) => idx !== i), ...otherTeam]}
          onPick={(m) => onChangeAt(i, m.name)}
        />
        <button className="row-del" onClick={() => onRemoveAt(i)} aria-label="자리 삭제">
          <FaTimes />
        </button>
      </div>
    ))}
    <button className="ghost-btn sr-add-slot" onClick={onAdd}>
      <FaPlus /> 자리 추가
    </button>
  </div>
);

/* 1분 미만은 '방금 전', 그 다음은 분/시간/일 단위로 대충 뭉뚱그린다.
   전적 기록지라 초 단위 정밀도는 필요 없다 */
const formatRelative = (ts) => {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
};

const ScrimRecord = () => {
  const [mode, setMode] = useState('normal');
  const [teamA, setTeamA] = useState(blankTeam);
  const [teamB, setTeamB] = useState(blankTeam);
  usePageMeta(PAGE_META.scrimRecord);
  const roster = useRoster();
  const matches = useMatches();

  const stats = useMemo(() => statsFor(matches, mode), [matches, mode]);
  const history = useMemo(
    () =>
      matches
        .filter((m) => m.mode === mode)
        .sort((a, b) => b.playedAt - a.playedAt),
    [matches, mode]
  );

  const board = useMemo(
    () =>
      [...stats.entries()]
        .map(([name, s]) => ({ name, ...s, games: s.wins + s.losses }))
        .sort((a, b) => b.points - a.points || b.wins / b.games - a.wins / a.games),
    [stats]
  );

  const tierOf = (name) => roster.find((m) => m.name.trim() === name.trim());

  const setAt = (setter) => (i, name) =>
    setter((prev) => prev.map((n, idx) => (idx === i ? name : n)));
  const setAAt = setAt(setTeamA);
  const setBAt = setAt(setTeamB);

  const addSlot = (setter) => () => setter((prev) => [...prev, '']);
  const removeSlot = (setter) => (i) => setter((prev) => prev.filter((_, idx) => idx !== i));

  const importSplit = () => {
    const split = loadLastSplit();
    if (!split) {
      toast.error('내전 팀 짜기에서 만든 팀이 없어요. 먼저 그쪽에서 팀을 짜 주세요.');
      return;
    }
    setTeamA(split.teamA);
    setTeamB(split.teamB);
    toast.success(`내전 팀 짜기 결과를 불러왔어요. (${formatRelative(split.at)} 생성)`);
  };

  const clearTeams = () => {
    setTeamA(blankTeam());
    setTeamB(blankTeam());
  };

  const recordWin = (winner) => {
    const a = teamA.map((n) => n.trim()).filter(Boolean);
    const b = teamB.map((n) => n.trim()).filter(Boolean);
    if (a.length === 0 || b.length === 0) {
      toast.error('양 팀 모두 최소 1명은 있어야 해요.');
      return;
    }
    const overlap = a.find((n) => b.includes(n));
    if (overlap) {
      toast.error(`'${overlap}' 님이 양 팀에 모두 있어요.`);
      return;
    }
    addMatch({ mode, teamA: a, teamB: b, winner });
    toast.success(`${winner === 'A' ? '1팀' : '2팀'} 승리! 기록했어요.`);
  };

  return (
    <div className="page sr-page">
      <PageHeader
        title="내전 기록지"
        sub="팀을 채우고 승리한 팀을 고르면 승패와 내전 포인트가 쌓입니다."
      />

      <div className="seg-tabs lg sr-mode-tabs">
        {MODES.map((m) => (
          <button
            key={m.value}
            className={`seg-tab ${mode === m.value ? 'active' : ''}`}
            onClick={() => setMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="sr-toolbar">
        <button className="ghost-btn" onClick={importSplit}>
          <FaArrowRight /> 방금 짠 팀 가져오기
        </button>
        <button className="ghost-btn" onClick={clearTeams}>
          팀 비우기
        </button>
      </div>

      <div className="sr-teams">
        <TeamPanel
          label="1팀"
          team={teamA}
          otherTeam={teamB}
          onChangeAt={setAAt}
          onRemoveAt={removeSlot(setTeamA)}
          onAdd={addSlot(setTeamA)}
          accent="team-blue"
        />
        <TeamPanel
          label="2팀"
          team={teamB}
          otherTeam={teamA}
          onChangeAt={setBAt}
          onRemoveAt={removeSlot(setTeamB)}
          onAdd={addSlot(setTeamB)}
          accent="team-red"
        />
      </div>

      <div className="win-buttons">
        <button className="win-btn team-blue" onClick={() => recordWin('A')}>
          <FaTrophy /> 1팀 승리
        </button>
        <button className="win-btn team-red" onClick={() => recordWin('B')}>
          <FaTrophy /> 2팀 승리
        </button>
      </div>

      <section className="sr-board">
        <h2>
          <FaClipboardList /> {mode === 'aram' ? '칼바람' : '일반'} 전적 리더보드
          <span className="panel-count">{board.length}명</span>
        </h2>
        {board.length === 0 ? (
          <p className="board-blank">아직 기록된 경기가 없어요.</p>
        ) : (
          <ul className="board-list">
            {board.map((r, i) => {
              const member = tierOf(r.name);
              return (
                <li key={r.name}>
                  <span className="board-rank">{i + 1}</span>
                  <div className="board-main">
                    <div className="board-top">
                      <span className="board-name">{r.name}</span>
                      {member && (
                        <span
                          className="tier-badge"
                          style={{ '--tier': getTier(member.tier).color }}
                        >
                          {tierName(member)}
                        </span>
                      )}
                      <ScrimBadge points={r.points} stat={statOf(stats, r.name)} />
                    </div>
                    <span className="board-record">
                      {r.wins}승 {r.losses}패 · {Math.round((r.wins / r.games) * 100)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <ScrimPointsHelp />
      </section>

      <section className="sr-history">
        <h2>
          최근 기록<span className="panel-count">{history.length}경기</span>
        </h2>
        {history.length === 0 ? (
          <p className="board-blank">아직 기록된 경기가 없어요.</p>
        ) : (
          <ul className="history-list">
            {history.map((m) => (
              <li key={m.id}>
                <span className="hist-time">{formatRelative(m.playedAt)}</span>
                <span className="hist-teams">
                  <span className={m.winner === 'A' ? 'hist-winner' : ''}>
                    {m.teamA.join(', ')}
                  </span>
                  <span className="hist-vs">vs</span>
                  <span className={m.winner === 'B' ? 'hist-winner' : ''}>
                    {m.teamB.join(', ')}
                  </span>
                </span>
                <button
                  className="row-del"
                  onClick={() => removeMatch(m.id)}
                  aria-label="기록 삭제"
                >
                  <FaTimes />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ScrimRecord;
