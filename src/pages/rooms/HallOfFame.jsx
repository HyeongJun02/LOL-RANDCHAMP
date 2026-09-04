import React, { useMemo } from 'react';
import { FaCrown } from 'react-icons/fa';
import { statsFor } from '../../matches';

/* 명예의 전당.

   매달 1일 roll_season이 방마다 끼꼬 순위를 박제해 왔는데, 지금까지
   보여주는 화면이 없어서 아무도 몰랐다. 박제되는 걸 알아야 이번 달을
   다르게 뛴다. 그래서 지난 달만 걸어두는 게 아니라, '이대로 끝나면
   네가 박제된다'까지 같이 보여준다. */

const num = (n) => Number(n || 0).toLocaleString();
const MEDALS = ['🥇', '🥈', '🥉'];

const monthText = (m) => {
  const [y, mm] = String(m).split('-');
  return `${y}년 ${Number(mm)}월`;
};

/* 그 달에 치른 경기만 떼어 내전 1위를 낸다.
   박제된 건 끼꼬뿐인데, 끼꼬는 또또 운도 섞여 있어서 '진짜 잘한 사람'과
   다를 수 있다. 둘을 같이 걸어야 시비가 안 붙는다 */
const scrimKingOf = (matches, month) => {
  const inMonth = matches.filter((m) => {
    const d = new Date(m.playedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return key === month;
  });
  if (inMonth.length === 0) return null;
  const ranked = [...statsFor(inMonth).entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.points - a.points);
  return ranked[0] || null;
};

const nowMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const HallOfFame = ({ rows = [], matches = [], members = [] }) => {
  /* 달마다 묶는다. 최신 달이 맨 위 */
  const seasons = useMemo(() => {
    const byMonth = new Map();
    (rows || []).forEach((r) => {
      if (!byMonth.has(r.month)) byMonth.set(r.month, []);
      byMonth.get(r.month).push(r);
    });
    return [...byMonth.entries()]
      .map(([month, list]) => ({
        month,
        list: [...list].sort((a, b) => b.kkiko_points - a.kkiko_points).slice(0, 3),
        king: scrimKingOf(matches, month),
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [rows, matches]);

  /* 이번 달 잠정 1위. 아직 아무것도 확정이 아니라는 게 요점이다 */
  const running = useMemo(() => {
    const ranked = [...members].sort((a, b) => b.points - a.points);
    return ranked[0] || null;
  }, [members]);

  const month = nowMonth();

  return (
    <section className="hof">
      <div className="hof-head">
        <h3>
          <FaCrown /> 명예의 전당
        </h3>
        <span className="hof-note">매월 1일, 그 달의 끼꼬가 그대로 박제됩니다</span>
      </div>

      {/* 이번 달은 아직 안 끝났다. 지금 1등을 걸어두면 남은 날이 달라진다 */}
      <div className="hof-running">
        <span className="hof-running-label">{monthText(month)} · 진행 중</span>
        {running ? (
          <p>
            지금 이대로면 <b>{running.nickname}</b> 님이 <b>{num(running.points)} 끼꼬</b>로
            박제됩니다.
          </p>
        ) : (
          <p>아직 아무도 없어요.</p>
        )}
      </div>

      {seasons.length === 0 ? (
        <p className="hof-blank">
          아직 끝난 달이 없어요.
          <br />첫 박제는 다음 달 1일입니다.
        </p>
      ) : (
        seasons.map((s) => (
          <div className="hof-season" key={s.month}>
            <div className="hof-season-head">
              <strong>{monthText(s.month)}</strong>
              {s.king && (
                <span className="hof-king">
                  내전 1위 {s.king.name} ({s.king.wins}승 {s.king.losses}패)
                </span>
              )}
            </div>
            <ol className="hof-podium">
              {s.list.map((r, i) => (
                <li key={r.user_id} className={`rank-${i + 1}`}>
                  <span className="hof-medal">{MEDALS[i]}</span>
                  <strong>{r.display_name}</strong>
                  <em>{num(r.kkiko_points)} 끼꼬</em>
                </li>
              ))}
            </ol>
          </div>
        ))
      )}
    </section>
  );
};

export default HallOfFame;
