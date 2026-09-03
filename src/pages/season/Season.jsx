import React, { useMemo, useState } from 'react';
import { FaTrophy } from 'react-icons/fa';
import {
  useMatches,
  statsFor,
  monthsOf,
  inMonth,
  monthKeyOf,
  monthLabel,
} from '../../matches';
import { useRoster } from '../../roster';
import { getTier, tierName } from '../../tiers';
import ScrimBadge from '../../components/common/ScrimBadge';
import ScrimPointsHelp from '../../components/common/ScrimPointsHelp';
import PageHeader from '../../components/common/PageHeader';
import { usePageMeta, PAGE_META } from '../../seo';
import './Season.css';

const MODES = [
  { value: 'normal', label: '일반 내전' },
  { value: 'aram', label: '칼바람 내전' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

const Season = () => {
  const matches = useMatches();
  const roster = useRoster();
  usePageMeta(PAGE_META.season);

  const months = useMemo(() => monthsOf(matches), [matches]);
  const [month, setMonth] = useState(null);
  const [mode, setMode] = useState('normal');

  /* 기록이 들어오면 가장 최근 달이 기본. 고른 달의 기록을 다 지우면 되돌린다 */
  const active =
    month && months.includes(month) ? month : months[0] || monthKeyOf(Date.now());

  const monthMatches = useMemo(() => inMonth(matches, active), [matches, active]);

  /* 그 달만 떼어 처음부터 다시 계산한다. 달마다 0에서 시작하는 시즌 개념 */
  const stats = useMemo(() => statsFor(monthMatches, mode), [monthMatches, mode]);

  const ranking = useMemo(
    () =>
      [...stats.entries()]
        .map(([name, s]) => ({ name, ...s }))
        .sort(
          (a, b) =>
            b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name, 'ko')
        ),
    [stats]
  );

  const played = monthMatches.filter((m) => m.mode === mode).length;

  return (
    <div className="page season-page">
      <PageHeader
        title="내전 시즌 정산"
        sub="달마다 0에서 다시 시작한다. 이번 달 1등이 누구인지."
      />

      {months.length === 0 ? (
        <p className="season-blank">
          아직 기록이 없습니다. 내전 기록지에서 경기를 남기면 여기에 쌓입니다.
        </p>
      ) : (
        <>
          <div className="season-bar">
            <div className="season-months">
              {months.map((m) => (
                <button
                  key={m}
                  className={`season-month ${m === active ? 'active' : ''}`}
                  onClick={() => setMonth(m)}
                >
                  {monthLabel(m)}
                </button>
              ))}
            </div>

            <div className="seg-tabs">
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
          </div>

          <p className="season-summary">
            {monthLabel(active)} · <strong>{played}</strong>경기 · {ranking.length}명 참여
          </p>

          {ranking.length === 0 ? (
            <p className="season-blank">
              {monthLabel(active)}에는 {mode === 'aram' ? '칼바람' : '일반'} 내전 기록이
              없습니다.
            </p>
          ) : (
            <ol className="season-board">
              {ranking.map((r, i) => {
                const member = roster.find((m) => m.name === r.name);
                return (
                  <li key={r.name} className={i < 3 ? `top top-${i + 1}` : ''}>
                    <span className="season-rank">{MEDALS[i] || i + 1}</span>
                    <span className="season-name">{r.name}</span>
                    {member && (
                      <span
                        className="tier-badge"
                        style={{ '--tier': getTier(member.tier).color }}
                      >
                        {tierName(member)}
                      </span>
                    )}
                    <span className="season-record">
                      {r.wins}승 {r.losses}패
                      <em>{Math.round((r.wins / r.games) * 100)}%</em>
                    </span>
                    <ScrimBadge points={r.points} stat={r} />
                  </li>
                );
              })}
            </ol>
          )}

          <ScrimPointsHelp />
        </>
      )}

      <p className="season-note">
        <FaTrophy /> 포인트는 그 달 기록만으로 매번 다시 계산합니다. 지난달 성적은 넘어오지
        않습니다.
      </p>
    </div>
  );
};

export default Season;
