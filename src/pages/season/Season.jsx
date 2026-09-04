import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FaTrophy, FaCopy, FaImage } from 'react-icons/fa';
import {
  statsFor,
  monthsOf,
  inMonth,
  monthKeyOf,
  monthLabel,
} from '../../matches';
import { getTier, tierName } from '../../tiers';
import ScrimBadge from '../../components/common/ScrimBadge';
import ScrimPointsHelp from '../../components/common/ScrimPointsHelp';
import Insights from './Insights';
import { buildInsights } from './insightData';
import { formatReport, copyText } from './report';
import { downloadReport } from './reportImage';
import './Season.css';


const MEDALS = ['🥇', '🥈', '🥉'];
/* 달 탭과 같은 자리에 놓는 '전체 시즌' */
const ALL = 'all';

/* 방의 '정산' 탭.
   matches: rooms.js가 이름을 붙여 넘겨준 경기 목록
   players: 방 참가자 명단 (티어 배지용) */
const Season = ({ matches = [], players = [] }) => {

  const months = useMemo(() => monthsOf(matches), [matches]);
  const [month, setMonth] = useState(null);

  /* 기록이 들어오면 가장 최근 달이 기본. 고른 달의 기록을 다 지우면 되돌린다 */
  const active =
    month === ALL || (month && months.includes(month))
      ? month
      : months[0] || monthKeyOf(Date.now());
  const isAll = active === ALL;

  const monthMatches = useMemo(
    () => (isAll ? matches : inMonth(matches, active)),
    [matches, active, isAll]
  );

  /* 그 달만 떼어 처음부터 다시 계산한다. 달마다 0에서 시작하는 시즌 개념 */
  const stats = useMemo(() => statsFor(monthMatches), [monthMatches]);

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

  const played = monthMatches.length;

  const insights = useMemo(() => buildInsights(monthMatches), [monthMatches]);

  const periodLabel = isAll ? '전체 기간' : monthLabel(active);

  const reportData = { periodLabel, played, ranking, insights };

  const share = async () => {
    if (await copyText(formatReport(reportData))) {
      toast.success('정산 결과를 복사했어요. 붙여넣기 하세요.');
    } else {
      toast.error('복사에 실패했어요. 주소가 https인지 확인해 주세요.');
    }
  };

  const saveImage = async () => {
    const name = `롤랜챔_${periodLabel}_내전정산.png`.replace(/\s+/g, '');
    if (await downloadReport(reportData, name)) {
      toast.success('이미지로 저장했어요.');
    } else {
      toast.error('이미지를 만들지 못했어요.');
    }
  };

  return (
    <div className="season-page">
      {months.length === 0 ? (
        <p className="season-blank">
          아직 기록이 없습니다. 기록 탭에서 경기를 남기면 여기에 쌓입니다.
        </p>
      ) : (
        <>
          <div className="season-bar">
            <div className="season-months">
              <button
                className={`season-month ${isAll ? 'active' : ''}`}
                onClick={() => setMonth(ALL)}
              >
                전체 시즌
              </button>
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

          </div>

          <div className="season-summary">
            <span>
              {periodLabel} · <strong>{played}</strong>경기 · {ranking.length}명 참여
            </span>
            <span className="season-actions">
              <button className="ghost-btn" onClick={share} disabled={played === 0}>
                <FaCopy /> 결과 복사
              </button>
              <button className="ghost-btn" onClick={saveImage} disabled={played === 0}>
                <FaImage /> 이미지 저장
              </button>
            </span>
          </div>

          {ranking.length === 0 ? (
            <p className="season-blank">
              {isAll ? '전체 기간에' : `${monthLabel(active)}에는`} 내전 기록이 없습니다.
            </p>
          ) : (
            <ol className="season-board">
              {ranking.map((r, i) => {
                const member = players.find((m) => m.name === r.name);
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

          <section className="season-insights">
            <h2>숨은 기록</h2>
            <Insights items={insights} />
          </section>
        </>
      )}

      <p className="season-note">
        <FaTrophy />{' '}
        {isAll
          ? '전체 기간 기록을 모두 합쳐 계산합니다.'
          : '포인트는 그 달 기록만으로 매번 다시 계산합니다. 지난달 성적은 넘어오지 않습니다.'}
      </p>
    </div>
  );
};

export default Season;
