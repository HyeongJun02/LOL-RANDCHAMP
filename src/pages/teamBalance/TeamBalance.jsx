import React, { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FaPlus, FaTimes, FaUsers, FaBookmark, FaRandom, FaDownload } from 'react-icons/fa';
import { TIERS, DIVISIONS, getTier, ratingOf, tierName } from '../../tiers';
import { splitTeams, MAX_PLAYERS, winChance, IGNORE_RATING } from './balance';
import { mergeMembers, useRoster } from '../../roster';
import { useMatches, statsFor, pointsOf, POINTS } from '../../matches';
import { saveLastSplit } from '../../lastSplit';
import RosterPicker from '../../components/common/RosterPicker';
import ScrimBadge from '../../components/common/ScrimBadge';
import CandidateModal from './CandidateModal';
import PageHeader from '../../components/common/PageHeader';
import RosterLoader from '../../components/common/RosterLoader';
import { usePageMeta, PAGE_META } from '../../seo';
import './TeamBalance.css';

const RATING_MODES = [
  { value: 'tier', label: '티어만' },
  { value: 'both', label: '티어 + 내전 포인트' },
  { value: 'points', label: '내전 포인트만' },
];

const SCRIM_MODES = [
  { value: 'normal', label: '일반 내전' },
  { value: 'aram', label: '칼바람 내전' },
];

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
  const [showLoader, setShowLoader] = useState(false);
  const [ratingMode, setRatingMode] = useState('tier');
  const [scrimMode, setScrimMode] = useState('normal');
  usePageMeta(PAGE_META.teamBalance);
  const roster = useRoster();
  const matches = useMatches();

  const scrimStats = useMemo(() => statsFor(matches, scrimMode), [matches, scrimMode]);
  const showScrim = ratingMode !== 'tier';

  /* 평점 기준에 따라 실제로 팀을 나눌 때 쓸 값을 만든다.
     both는 티어 평점에 그대로 더한다 — tiers.js 눈금(디비전 1~2점)에
     맞춰 승/패 1회를 ±2점으로 잡아뒀기 때문에 스케일을 따로 맞출 필요가 없다 */
  const ratingFor = (p) => {
    const scrim = pointsOf(scrimStats, p.name);
    if (ratingMode === 'points') return scrim;
    if (ratingMode === 'both') return ratingOf(p) + scrim;
    return ratingOf(p);
  };

  /* 결과가 나올 때마다(직접 짜기/후보 고르기 공통) 내전 기록지가 이어받을 수 있게 남겨둔다 */
  useEffect(() => {
    if (!result) return;
    saveLastSplit(result.teamA.map((p) => p.name), result.teamB.map((p) => p.name));
  }, [result]);

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

  /* 명단에서 직접 입력한 이름(= 명단에 없는 이름)은 팝업이 건드리지 않는다 */
  const manualCount = entered.filter(
    (p) => !roster.some((m) => m.name.trim() === p.name.trim())
  ).length;

  /* 팝업에서 고른 대로 맞춘다. 체크가 풀린 사람은 자리를 비우고,
     새로 체크된 사람은 빈 자리부터 채운다 */
  const syncMembers = (members) => {
    const wanted = new Set(members.map((m) => m.name.trim()));
    const rosterNames = new Set(roster.map((m) => m.name.trim()));

    const next = players.map((p) => {
      const name = p.name.trim();
      const dropped = name !== '' && rosterNames.has(name) && !wanted.has(name);
      return dropped ? { ...p, name: '', lock: 0 } : p;
    });

    const already = new Set(next.map((p) => p.name.trim()));
    const queue = members.filter((m) => !already.has(m.name.trim()));

    for (let i = 0; i < next.length && queue.length > 0; i += 1) {
      if (next[i].name.trim() === '') {
        const m = queue.shift();
        next[i] = { ...next[i], name: m.name, tier: m.tier, division: m.division };
      }
    }
    while (queue.length > 0 && next.length < MAX_PLAYERS) {
      const m = queue.shift();
      next.push({ ...blankPlayer(), name: m.name, tier: m.tier, division: m.division });
    }

    setPlayers(next);
    if (queue.length > 0) {
      toast.error(`자리가 모자라 ${queue.length}명은 넣지 못했습니다.`);
    }
  };

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

  const build = (ignoreRating = false) => {
    if (entered.length < 2) {
      toast.error('이름을 2명 이상 입력해 주세요.');
      return;
    }
    const split = splitTeams(
      entered.map((p) => ({ ...p, rating: ratingFor(p) })),
      ignoreRating ? IGNORE_RATING : randomness
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
              <span className="li-badges">
                <TierBadge player={p} />
                {showScrim && <ScrimBadge points={pointsOf(scrimStats, p.name)} />}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );

  return (
    <div className="page tb-page">
      <PageHeader
        title="내전 팀 짜기"
        sub="티어로 평점을 매겨 양 팀이 최대한 비슷해지게 나눕니다. 10명 안 채워도 됩니다."
      />

      <div className="tb-layout">
        <section className="tb-panel">
          <div className="panel-head">
            <h2>
              <FaUsers /> 참가자
              <span className="panel-count">{entered.length}명</span>
            </h2>
            <div className="panel-head-actions">
              <button className="ghost-btn" onClick={() => setShowLoader(true)}>
                <FaDownload /> 불러오기
              </button>
              <button className="ghost-btn" onClick={saveToRoster}>
                <FaBookmark /> 명단에 저장
              </button>
            </div>
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
                    {showScrim && p.name.trim() !== '' && (
                      <ScrimBadge points={pointsOf(scrimStats, p.name)} />
                    )}
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
            <span className="range-label">평점 기준</span>
            <div className="seg-tabs">
              {RATING_MODES.map((m) => (
                <button
                  key={m.value}
                  className={`seg-tab ${ratingMode === m.value ? 'active' : ''}`}
                  onClick={() => setRatingMode(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {showScrim && (
              <>
                <div className="seg-tabs" style={{ marginTop: '0.5rem' }}>
                  {SCRIM_MODES.map((m) => (
                    <button
                      key={m.value}
                      className={`seg-tab ${scrimMode === m.value ? 'active' : ''}`}
                      onClick={() => setScrimMode(m.value)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="range-hint">
                  내전 기록지에 쌓인 {scrimMode === 'aram' ? '칼바람' : '일반'} 내전 승패를
                  {ratingMode === 'points' ? ' 평점 대신' : ' 티어 평점에 더해'} 반영합니다.
                  승 1회당 {`+${POINTS.WIN}`}점, 패 1회당 {POINTS.LOSS}점.
                </p>
              </>
            )}
          </div>

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
            <button className="build-btn" onClick={() => build()}>
              <FaRandom /> 팀 짜기
            </button>
            <button className="shuffle-btn" onClick={() => build(true)}>
              완전 무작위
            </button>
            <p className="shuffle-hint">
              평점을 무시하고 뽑습니다. 인원 수와 팀 고정은 그대로 지켜져요.
            </p>
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
              {(() => {
                const win = winChance(
                  result.sumA,
                  result.teamA.length,
                  result.sumB,
                  result.teamB.length
                );
                return (
                  <div className="win-odds">
                    <div className="win-bar">
                      <span className="win-fill" style={{ width: `${win}%` }} />
                    </div>
                    <div className="win-legend">
                      <span className="win-blue">1팀 {win}%</span>
                      <span className="win-red">{100 - win}% 2팀</span>
                    </div>
                    <p className="win-note">
                      티어 평점과 인원 수만 넣고 계산한 재미용 수치입니다. 실제 승패와는 관계 없어요.
                    </p>
                  </div>
                );
              })()}

              {renderTeam(result.teamA, '1팀', result.sumA, 'team-blue')}
              {renderTeam(result.teamB, '2팀', result.sumB, 'team-red')}
            </div>
          )}
        </aside>
      </div>

      {showLoader && (
        <RosterLoader
          present={players.map((p) => p.name)}
          limit={MAX_PLAYERS - manualCount}
          onConfirm={syncMembers}
          onClose={() => setShowLoader(false)}
        />
      )}

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
