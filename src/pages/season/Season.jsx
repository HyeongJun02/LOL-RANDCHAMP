import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FaTrophy, FaCopy, FaImage, FaCrown } from 'react-icons/fa';
import {
  statsFor,
  monthsOf,
  inMonth,
  monthKeyOf,
  monthLabel,
} from '../../rules/matches';
import { getTier, tierName, modeGroupOf, modeGroupsOf, ALL_GROUPS } from '../../rules/games';
import { useGameKey } from '../../lib/GameContext';
import ScrimBadge from '../../components/common/ScrimBadge';
import RankList from '../../components/common/RankList';
import ScrimPointsHelp from '../../components/common/ScrimPointsHelp';
import Insights from './Insights';
import { buildInsights } from './insightData';
import { formatReport, copyText } from './report';
import { downloadReport } from './reportImage';
import './Season.css';


/* 달 탭과 같은 자리에 놓는 '전체 시즌' */
const ALL = 'all';

/* 방의 '정산' 탭.
   matches: rooms.js가 이름을 붙여 넘겨준 경기 목록
   players: 방 참가자 명단 (티어 배지용)
   hofRows: 달이 넘어갈 때 박제해둔 달별 끼꼬 (hall_of_fame)
   members: 이 방 계정들. 이번 달은 아직 박제 전이라 지갑을 그대로 본다 */
const Season = ({ matches = [], players = [], hofRows = [], members = [] }) => {
  const gameKey = useGameKey();
  /* 순위를 무엇으로 볼지. 승률이 기본 */
  const [view, setView] = useState('rate');

  /* 난투(1대1·2대2)를 5대5 전적과 한 표에 올리면 둘 다 못 읽는다.
     게임에 묶음이 둘 이상일 때만 고르는 칸이 뜬다 */
  const groups = useMemo(() => modeGroupsOf(gameKey), [gameKey]);
  const [group, setGroup] = useState(ALL_GROUPS);

  const scoped = useMemo(
    () =>
      group === ALL_GROUPS
        ? matches
        : matches.filter((m) => modeGroupOf(gameKey, m.mode) === group),
    [matches, group, gameKey]
  );

  const months = useMemo(() => monthsOf(scoped), [scoped]);
  const [month, setMonth] = useState(null);

  /* 기록이 들어오면 가장 최근 달이 기본. 고른 달의 기록을 다 지우면 되돌린다 */
  const active =
    month === ALL || (month && months.includes(month))
      ? month
      : months[0] || monthKeyOf(Date.now());
  const isAll = active === ALL;

  const monthMatches = useMemo(
    () => (isAll ? scoped : inMonth(scoped, active)),
    [scoped, active, isAll]
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

  const top = ranking[0] || null;
  const played = monthMatches.length;

  const insights = useMemo(() => buildInsights(monthMatches), [monthMatches]);

  /* 그 달을 몇 끼꼬로 마무리했나.

     지난 달은 시즌이 넘어갈 때 박제해둔 값을 본다 (roll_season이
     초기화 직전에 hall_of_fame에 넣는다). 이번 달은 아직 진행 중이라
     박제된 게 없으니 지갑의 지금 잔액을 본다.

     끼꼬는 계정에 붙고 승률은 참가자 이름에 붙는다. 그래서 두 목록에
     서로 없는 사람이 있다 - 계정 없이 뛴 손님은 끼꼬가 없고, 한 판도
     안 뛴 사람도 끼꼬는 있다. 섞지 않고 각자 자기 목록을 보여준다. */
  const thisMonth = monthKeyOf(Date.now());
  const kkiko = useMemo(() => {
    if (isAll) return [];
    const rows =
      active === thisMonth
        ? members.map((m) => ({ key: m.user_id, name: m.nickname, points: m.points }))
        : hofRows
            .filter((r) => r.month === active)
            .map((r) => ({
              key: r.user_id,
              /* 그때 쓰던 이름 그대로. 나중에 바꿔도 기록은 안 흔들린다 */
              name: r.display_name,
              points: r.kkiko_points,
            }));
    return rows.sort((a, b) => b.points - a.points);
  }, [isAll, active, thisMonth, members, hofRows]);

  /* 달을 옮기다 보면 끼꼬가 없는 달에 닿는다. 그때 빈 목록을 보여주는
     대신 조용히 승률로 돌아간다 */
  const canKkiko = !isAll && kkiko.length > 0;
  const mode = view === 'kkiko' && canKkiko ? 'kkiko' : 'rate';
  const topKkiko = kkiko[0]?.points || 0;

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

          {groups.length > 1 && (
            <div className="seg-tabs season-groups">
              <button
                className={`seg-tab ${group === ALL_GROUPS ? 'active' : ''}`}
                onClick={() => setGroup(ALL_GROUPS)}
              >
                전체
              </button>
              {groups.map((g) => (
                <button
                  key={g.key}
                  className={`seg-tab ${group === g.key ? 'active' : ''}`}
                  onClick={() => setGroup(g.key)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          {/* 한 줄 문장으로 두면 숫자가 글자에 묻힌다. 훑는 화면이니
              숫자를 세워 먼저 눈에 들어오게 한다 */}
          <div className="season-summary">
            <div className="season-nums">
              <span>
                <b>{played}</b>경기
              </span>
              <span>
                <b>{ranking.length}</b>명
              </span>
              {top && (
                <span className="is-top" title={`${top.wins}승 ${top.losses}패`}>
                  <FaCrown />
                  {top.name}
                </span>
              )}
            </div>
            <span className="season-actions">
              <button className="ghost-btn" onClick={share} disabled={played === 0}>
                <FaCopy /> 결과 복사
              </button>
              <button className="ghost-btn" onClick={saveImage} disabled={played === 0}>
                <FaImage /> 이미지 저장
              </button>
            </span>
          </div>

          <div className="season-cols">
          <div className="season-col">
          {/* 승률 / 끼꼬. 전체 기간에는 안 띄운다 - 끼꼬는 달마다 0에서
              다시 시작해서 여러 달을 합치면 아무 뜻이 없다 */}
          {canKkiko && (
            <div className="seg-tabs season-view">
              <button
                className={`seg-tab ${mode === 'rate' ? 'active' : ''}`}
                onClick={() => setView('rate')}
              >
                승률
              </button>
              <button
                className={`seg-tab ${mode === 'kkiko' ? 'active' : ''}`}
                onClick={() => setView('kkiko')}
              >
                끼꼬
              </button>
            </div>
          )}

          {mode === 'kkiko' ? (
            <>
              <RankList
                empty="이 달의 끼꼬 기록이 없습니다."
                rows={kkiko.map((r) => ({
                  key: r.key,
                  name: r.name,
                  value: (
                    <>
                      {r.points.toLocaleString()}
                      <i className="rank-unit">끼꼬</i>
                    </>
                  ),
                  ratio: topKkiko > 0 ? r.points / topKkiko : 0,
                }))}
              />
              <p className="rooms-hint season-kkiko-note">
                {active === thisMonth
                  ? '이번 달은 아직 진행 중이라 지금 잔액입니다. 매월 1일 모두 10,000으로 돌아갑니다.'
                  : `${monthLabel(active)}을 마칠 때의 잔액입니다.`}
              </p>
            </>
          ) : (
          <RankList
            empty={`${isAll ? '전체 기간에' : `${monthLabel(active)}에는`} 내전 기록이 없습니다.`}
            rows={ranking.map((r) => {
              const member = players.find((m) => m.name === r.name);
              return {
                key: r.name,
                name: r.name,
                badge: member && (
                  <span className="tier-badge" style={{ '--tier': getTier(gameKey, member.tier).color }}>
                    {tierName(gameKey, member)}
                  </span>
                ),
                stat: (
                  <>
                    {r.wins}승 {r.losses}패 <b>{Math.round((r.wins / r.games) * 100)}%</b>
                  </>
                ),
                value: <ScrimBadge points={r.points} stat={r} />,
                ratio: r.wins / r.games,
              };
            })}
          />
          )}

          {mode === 'rate' && <ScrimPointsHelp />}
          </div>

          {/* 넓은 화면에서는 순위 옆에 붙인다. 세로로만 쌓으면 순위를
              다 지나야 숨은 기록에 닿는다 */}
          <section className="season-insights season-col">
            <h2>숨은 기록</h2>
            <Insights items={insights} />
          </section>
          </div>
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
