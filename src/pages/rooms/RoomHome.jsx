import React, { useMemo } from 'react';
import { FaTrophy, FaFire, FaDice, FaCrown } from 'react-icons/fa';
import { statsFor, streaksOf } from '../../matches';
import { titlesOf } from '../../titles';
import { timeAgo } from '../../timeAgo';
import './RoomHome.css';

/* 방의 대문.

   여기는 원래 탭으로 가는 버튼 일곱 개가 전부였다. 매일 들어오는 화면인데
   이 방에 대한 이야기가 한 줄도 없었다. 도구는 아래로 내리고, 위에는
   '우리가 누구인지'를 둔다 - 전부 이미 쌓여 있던 값이다. */

const num = (n) => Number(n || 0).toLocaleString();

const dateText = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/* 우리 방 기록. 깨질 때 로그에 금색 줄이 뜨는 그 기록들이다 */
const recordsOf = (matches, scrims) => {
  const settled = scrims.filter((s) => s.status === 'settled');
  const kills = settled.filter((s) => s.total_kills != null);
  const bestKills = kills.length
    ? kills.reduce((a, b) => (b.total_kills > a.total_kills ? b : a))
    : null;
  const bets = settled.filter((s) => s.bet_total > 0);
  const bestBet = bets.length ? bets.reduce((a, b) => (b.bet_total > a.bet_total ? b : a)) : null;

  const best = [...streaksOf(matches).entries()]
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.bestWin - a.bestWin)[0];

  return [
    { key: 'games', label: '함께한 판수', value: `${num(matches.length)}판` },
    {
      key: 'streak',
      label: '최다 연승',
      value: best && best.bestWin > 1 ? `${best.name} ${best.bestWin}연승` : null,
    },
    {
      key: 'kills',
      label: '한 판 최다 킬',
      value: bestKills ? `${bestKills.total_kills}킬` : null,
    },
    {
      key: 'bet',
      label: '한 판 최다 판돈',
      value: bestBet ? `${num(bestBet.bet_total)} 끼꼬` : null,
    },
  ];
};

const RoomHome = ({
  room,
  matches,
  scrims,
  players,
  members,
  activeScrim,
  champion,
  tabs,
  onGo,
}) => {
  const stats = useMemo(() => statsFor(matches), [matches]);
  const titles = useMemo(
    () => titlesOf({ matches, scrims, players }),
    [matches, scrims, players]
  );
  const records = useMemo(() => recordsOf(matches, scrims), [matches, scrims]);

  const last = matches[0];
  const firstDay = matches.length ? matches[matches.length - 1].playedAt : null;

  /* 이 방에서 제일 잘하고 있는 사람. 내전 포인트 기준 */
  const leader = [...stats.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.points - a.points)[0];

  /* 별명이 붙은 사람들. 방에 들어오면 제일 먼저 읽히는 줄이다 */
  const crew = players
    .map((p) => ({ name: p.name, title: titles.get(p.name) }))
    .filter((x) => x.title);

  return (
    <div className="room-home fade-in">
      {/* 지금 걸 수 있는 판이 있으면 그게 제일 급하다 */}
      {activeScrim && (
        <button className="rh-live" onClick={() => onGo('bet')}>
          <span className="rh-live-dot" />
          <strong>
            {activeScrim.status === 'betting' ? '또또 배팅 중' : '경기 진행 중'}
          </strong>
          <em>눌러서 보러 가기</em>
          <FaDice />
        </button>
      )}

      <section className="rh-hero">
        <span className="rh-emblem">{room.emblem}</span>
        <div className="rh-hero-text">
          <h2>{room.name}</h2>
          <p>
            {firstDay ? (
              <>
                {dateText(firstDay)}에 처음 붙어서, 지금까지{' '}
                <b>{num(matches.length)}판</b>
              </>
            ) : (
              <>아직 첫 판을 안 했어요. 게임 시작 탭에서 팀을 넣어보세요.</>
            )}
          </p>
        </div>
      </section>

      <div className="rh-row">
        {/* 지난 달 챔피언 - 오르고 싶게 만드는 자리 */}
        <button className="rh-card rh-champ" onClick={() => onGo('season')}>
          <span className="rh-card-label">
            <FaCrown /> 지난 달 챔피언
          </span>
          {champion ? (
            <>
              <strong>{champion.display_name}</strong>
              <em>{num(champion.kkiko_points)} 끼꼬</em>
            </>
          ) : (
            <>
              <strong className="is-empty">아직 없음</strong>
              <em>이번 달이 끝나면 1등이 박제됩니다</em>
            </>
          )}
        </button>

        <button className="rh-card" onClick={() => onGo('season')}>
          <span className="rh-card-label">
            <FaTrophy /> 내전 1위
          </span>
          {leader && leader.games > 0 ? (
            <>
              <strong>{leader.name}</strong>
              <em>
                {leader.wins}승 {leader.losses}패 · {leader.points > 0 ? '+' : ''}
                {leader.points}
              </em>
            </>
          ) : (
            <>
              <strong className="is-empty">아직 없음</strong>
              <em>한 판만 해도 순위가 생겨요</em>
            </>
          )}
        </button>

        <button className="rh-card" onClick={() => onGo('record')}>
          <span className="rh-card-label">
            <FaFire /> 마지막 내전
          </span>
          {last ? (
            <>
              <strong>{last.winner === 'A' ? '1팀' : '2팀'} 승리</strong>
              <em>{timeAgo(last.playedAt)}</em>
            </>
          ) : (
            <>
              <strong className="is-empty">아직 없음</strong>
              <em>첫 판을 남겨보세요</em>
            </>
          )}
        </button>
      </div>

      {crew.length > 0 && (
        <section className="rh-panel">
          <h3>지금 우리</h3>
          <ul className="rh-crew">
            {crew.map((c) => (
              <li key={c.name} className={`tone-${c.title.tone}`}>
                <span className="rh-crew-icon">{c.title.icon}</span>
                <strong>{c.name}</strong>
                <em>{c.title.label}</em>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rh-panel">
        <h3>우리 방 기록</h3>
        <ul className="rh-records">
          {records.map((r) => (
            <li key={r.key}>
              <span>{r.label}</span>
              <strong className={r.value ? '' : 'is-empty'}>{r.value || '아직 없음'}</strong>
            </li>
          ))}
        </ul>
        <p className="rooms-hint">기록이 깨지면 로그에 금색으로 남습니다.</p>
      </section>

      <section className="rh-panel">
        <h3>
          할 일<span className="panel-count">{members.length}명이 함께</span>
        </h3>
        <div className="rh-tools">
          {tabs.map((t) => (
            <button key={t.key} className="room-home-card" onClick={() => onGo(t.key)}>
              <span className="room-home-icon">{t.icon}</span>
              <strong>{t.label}</strong>
              <em>{t.desc}</em>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default RoomHome;
