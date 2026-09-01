import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { FaPlus, FaTimes, FaUsers, FaBookmark, FaRandom } from 'react-icons/fa';
import { TIERS, DIVISIONS, getTier, ratingOf, tierName } from '../../tiers';
import { splitTeams, MAX_PLAYERS } from './balance';
import { mergeMembers } from '../../roster';
import RosterPicker from '../../components/common/RosterPicker';
import CandidateModal from './CandidateModal';
import './TeamBalance.css';

const LOCKS = [
  { value: 0, label: '자동' },
  { value: 1, label: '1팀' },
  { value: 2, label: '2팀' },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const blankPlayer = () => ({ id: uid(), name: '', tier: 'GOLD', division: 4, lock: 0 });

const TierBadge = ({ player }) => {
  const tier = getTier(player.tier);
  return (
    <span className="tier-badge" style={{ '--tier': tier.color }}>
      {tierName(player)}
    </span>
  );
};

const TeamBalance = () => {
  const [players, setPlayers] = useState(() =>
    Array.from({ length: 10 }, blankPlayer)
  );
  const [randomness, setRandomness] = useState(0);
  const [result, setResult] = useState(null);
  const [showCandidates, setShowCandidates] = useState(false);

  const update = (id, patch) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const entered = useMemo(
    () => players.filter((p) => p.name.trim() !== ''),
    [players]
  );

  const addPlayer = (preset) =>
    setPlayers((prev) =>
      prev.length >= MAX_PLAYERS
        ? prev
        : [...prev, { ...blankPlayer(), ...preset, id: uid() }]
    );

  const saveToRoster = () => {
    if (entered.length === 0) {
      toast.error('저장할 이름이 없어요.');
      return;
    }
    const added = mergeMembers(entered);
    toast.success(
      added > 0
        ? `명단에 ${added}명 추가했어요.`
        : '이미 저장된 팀원의 티어를 갱신했어요.'
    );
  };

  const build = () => {
    if (entered.length < 2) {
      toast.error('이름을 2명 이상 입력해 주세요.');
      return;
    }
    const split = splitTeams(
      entered.map((p) => ({ ...p, rating: ratingOf(p) })),
      randomness
    );
    if (!split) {
      toast.error('팀 고정 조건이 서로 맞지 않아요.');
      return;
    }
    setResult(split);
    setShowCandidates(false);
  };

  const renderTeam = (team, label, sum, accent) => (
    <div className={`team-card ${accent}`}>
      <div className="team-head">
        <h3>{label}</h3>
        <span className="team-sum">
          평점 <strong>{sum}</strong> · {team.length}명
        </span>
      </div>
      <ul className="team-list">
        {[...team]
          .sort((a, b) => b.rating - a.rating)
          .map((p, i) => (
            <li key={p.id} style={{ animationDelay: `${i * 90}ms` }}>
              <span className="team-player">{p.name}</span>
              <TierBadge player={p} />
            </li>
          ))}
      </ul>
    </div>
  );

  return (
    <div className="tb-page">
      <header className="tb-head">
        <h1 className="tb-title">내전 팀 짜기</h1>
        <p className="tb-sub">
          티어로 평점을 매겨 양 팀이 최대한 비슷해지게 나눕니다. 10명 안 채워도 됩니다.
        </p>
      </header>

      <div className="tb-layout">
        <section className="tb-panel">
          <div className="panel-head">
            <h2>
              <FaUsers /> 참가자
              <span className="panel-count">{entered.length}명</span>
            </h2>
            <button className="ghost-btn" onClick={saveToRoster}>
              <FaBookmark /> 명단에 저장
            </button>
          </div>

          <div className="player-rows">
            {players.map((p, i) => {
              const tier = getTier(p.tier);
              return (
                <div className="player-row" key={p.id}>
                  <span className="row-no">{i + 1}</span>
                  <div className="row-name">
                    <input
                      value={p.name}
                      placeholder="이름"
                      onChange={(e) => update(p.id, { name: e.target.value })}
                    />
                    <RosterPicker
                      taken={players.filter((x) => x.id !== p.id).map((x) => x.name)}
                      onPick={(m) =>
                        update(p.id, {
                          name: m.name,
                          tier: m.tier,
                          division: m.division,
                        })
                      }
                    />
                  </div>
                  <select
                    className="row-tier"
                    value={p.tier}
                    style={{ color: tier.color }}
                    onChange={(e) => update(p.id, { tier: e.target.value })}
                  >
                    {TIERS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="row-div"
                    value={p.division}
                    disabled={!tier.divisions}
                    onChange={(e) => update(p.id, { division: Number(e.target.value) })}
                  >
                    {tier.divisions ? (
                      DIVISIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))
                    ) : (
                      <option value={p.division}>-</option>
                    )}
                  </select>
                  <div className="row-lock">
                    {LOCKS.map((l) => (
                      <button
                        key={l.value}
                        className={p.lock === l.value ? 'active' : ''}
                        onClick={() => update(p.id, { lock: l.value })}
                        title="같은 팀/다른 팀으로 묶을 사람을 고정"
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="row-del"
                    onClick={() => setPlayers((prev) => prev.filter((x) => x.id !== p.id))}
                    aria-label="삭제"
                  >
                    <FaTimes />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="panel-actions">
            <button
              className="ghost-btn"
              onClick={() => addPlayer()}
              disabled={players.length >= MAX_PLAYERS}
            >
              <FaPlus /> 참가자 추가
            </button>
            <button
              className="ghost-btn"
              onClick={() => setPlayers(Array.from({ length: 10 }, blankPlayer))}
            >
              전체 비우기
            </button>
          </div>

        </section>

        <aside className="tb-side">
          <div className="tb-panel">
            <label className="range-label" htmlFor="randomness">
              랜덤성
              <strong>{randomness === 0 ? '없음 (최적 밸런스)' : `평점 ±${randomness}`}</strong>
            </label>
            <input
              id="randomness"
              type="range"
              min="0"
              max="10"
              value={randomness}
              onChange={(e) => setRandomness(Number(e.target.value))}
            />
            <p className="range-hint">
              최적 조합보다 평점 차이가 이 값만큼 더 나는 조합까지 후보에 넣고 그 중에서 뽑습니다.
              0이면 항상 가장 균형 잡힌 팀이 나옵니다.
            </p>
            <button className="build-btn" onClick={build}>
              <FaRandom /> 팀 짜기
            </button>
          </div>

          {result && (
            <div className="tb-result">
              <div className="result-summary">
                평점 차이 <strong>{result.diff}</strong>
                {result.diff !== result.bestDiff && (
                  <span> (최적 {result.bestDiff})</span>
                )}
                <button
                  className="result-cands"
                  onClick={() => setShowCandidates(true)}
                  disabled={result.count < 2}
                  title="가능한 조합 모두 보기"
                >
                  후보 {result.count}가지
                </button>
              </div>
              {renderTeam(result.teamA, '1팀', result.sumA, 'team-blue')}
              {renderTeam(result.teamB, '2팀', result.sumB, 'team-red')}
            </div>
          )}
        </aside>
      </div>

      {showCandidates && result && (
        <CandidateModal
          result={result}
          onClose={() => setShowCandidates(false)}
          onSelect={(o) => {
            setResult((prev) => ({ ...prev, ...o, chosenId: o.id }));
            setShowCandidates(false);
          }}
        />
      )}
    </div>
  );
};

export default TeamBalance;
