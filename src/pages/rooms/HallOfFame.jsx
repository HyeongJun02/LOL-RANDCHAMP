import React, { useMemo } from 'react';
import { FaCrown, FaCoins, FaTrophy } from 'react-icons/fa';
import { statsFor, inMonth, monthKeyOf } from '../../matches';
import { HOF_MIN_GAMES, HOF_MIN_SHARE } from '../../tuning';

/* 명예의 전당.

   매달 1일 roll_season이 방마다 끼꼬 순위를 박제해 왔는데, 지금까지
   보여주는 화면이 없어서 아무도 몰랐다. 박제되는 걸 알아야 이번 달을
   다르게 뛴다. 그래서 지난 달만 걸어두는 게 아니라, '이대로 끝나면
   네가 박제된다'까지 같이 보여준다.

   왕관은 둘이다. 끼꼬는 또또 운이 섞여 있어서 '돈을 제일 잘 번 사람'이고,
   내전 포인트는 '제일 잘한 사람'이다. 둘을 하나로 합치면 어느 쪽도
   아닌 숫자가 나와서 아무도 납득하지 않는다.

   ----------------------------------------------------------------
   내전 쪽은 박제하지 않고 그때그때 다시 센다.

   끼꼬는 매달 초기화되니 그 순간을 붙잡아 두지 않으면 영영 사라진다.
   반면 경기 기록은 지워지지 않고 남아서, 그 달만 떼어 언제든 다시
   계산할 수 있다. 같은 값을 DB에 한 벌 더 두면 Elo 계산을 SQL로
   옮겨 적어야 하고, 두 벌이 어긋나는 날이 온다.

   대신 지난 달 경기를 나중에 지우면 그 달 왕이 바뀐다. 실제로 그 판이
   없던 게 된 거라 틀린 결과는 아니다.
   ---------------------------------------------------------------- */

const num = (n) => Number(n || 0).toLocaleString();
const MEDALS = ['🥇', '🥈', '🥉'];

const monthText = (m) => {
  const [y, mm] = String(m).split('-');
  return `${y}년 ${Number(mm)}월`;
};

const rate = (s) => (s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0);

/* 그 달 기록으로 순위를 매기고, 왕관을 씌울 자격이 되는 사람만 남긴다.
   문턱은 tuning.js에 있다 (몇 판 안 뛰고 전승한 사람 걸러내기) */
export const scrimKingOf = (matches, month) => {
  const played = inMonth(matches || [], month);
  if (played.length === 0) return null;

  const ranked = [...statsFor(played).entries()]
    .map(([name, v]) => ({ name, ...v, rate: rate(v) }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins);
  if (ranked.length === 0) return null;

  const need = Math.max(HOF_MIN_GAMES, Math.ceil(played.length * HOF_MIN_SHARE));
  /* 아무도 문턱을 못 넘으면 절대 최소만 적용한다. 빈 왕좌보다는 낫다 */
  return (
    ranked.find((r) => r.games >= need) ||
    ranked.find((r) => r.games >= HOF_MIN_GAMES) ||
    null
  );
};

/* 두 왕을 같은 모양으로 세운다. 한쪽만 크면 그쪽만 진짜처럼 보인다 */
const Throne = ({ kind, icon, label, name, value, sub, blank }) => (
  <div className={`hof-throne hof-${kind}`}>
    <span className="hof-throne-label">
      {icon} {label}
    </span>
    {name ? (
      <>
        <strong className="hof-throne-name">{name}</strong>
        <em className="hof-throne-value">{value}</em>
        {sub && <span className="hof-throne-sub">{sub}</span>}
      </>
    ) : (
      <span className="hof-throne-blank">{blank}</span>
    )}
  </div>
);

const HallOfFame = ({ rows = [], matches = [], members = [] }) => {
  const month = monthKeyOf(Date.now());

  /* 달마다 묶는다. 최신 달이 맨 위 */
  const seasons = useMemo(() => {
    const byMonth = new Map();
    (rows || []).forEach((r) => {
      if (!byMonth.has(r.month)) byMonth.set(r.month, []);
      byMonth.get(r.month).push(r);
    });
    return [...byMonth.entries()]
      .map(([m, list]) => ({
        month: m,
        list: [...list].sort((a, b) => b.kkiko_points - a.kkiko_points),
        king: scrimKingOf(matches, m),
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [rows, matches]);

  /* 이번 달 잠정 1위. 아직 아무것도 확정이 아니라는 게 요점이다 */
  /* 전원이 0이면 1위랄 게 없다. '0 끼꼬 1위'가 서 있으면 우습다 */
  const runningKkiko = useMemo(() => {
    const top = [...members].sort((a, b) => b.points - a.points)[0];
    return top && top.points > 0 ? top : null;
  }, [members]);
  const runningKing = useMemo(() => scrimKingOf(matches, month), [matches, month]);

  /* 이번 달 왕좌를 그대로 세우면 바로 위 순위표와 같은 말을 두 번 한다.
     진행 중은 '이대로면 누가 박제되는지' 한 줄이면 족하다 */
  const running = [
    runningKkiko && { label: '끼꼬', name: runningKkiko.nickname },
    runningKing && { label: '내전', name: runningKing.name },
  ].filter(Boolean);

  return (
    <section className="hof">
      <div className="hof-head">
        <h3>
          <FaCrown /> 명예의 전당
        </h3>
        <span className="hof-note">
          {seasons.length === 0
            ? '매월 1일에 박제됩니다. 첫 박제는 다음 달 1일이에요'
            : '매월 1일, 그 달의 끼꼬와 내전 성적이 박제됩니다'}
        </span>
      </div>

      {/* 이번 달은 아직 안 끝났다. 지금 1등을 걸어두면 남은 날이 달라진다 */}
      <p className="hof-running">
        {running.length === 0 ? (
          <>{monthText(month)}는 아직 박제할 기록이 없어요.</>
        ) : (
          <>
            이대로 끝나면{' '}
            {running.map((r, i) => (
              <React.Fragment key={r.label}>
                {i > 0 && ', '}
                <b>{r.name}</b>
                <span className="hof-running-tag">{r.label} 1위</span>
              </React.Fragment>
            ))}
            {' 로 박제됩니다.'}
          </>
        )}
      </p>

      {seasons.length > 0 &&
        seasons.map((s) => (
          <div className="hof-season" key={s.month}>
            <div className="hof-season-head">
              <strong>{monthText(s.month)}</strong>
            </div>

            <div className="hof-thrones">
              <Throne
                kind="kkiko"
                icon={<FaCoins />}
                label="끼꼬 1위"
                name={s.list[0]?.display_name}
                value={`${num(s.list[0]?.kkiko_points)} 끼꼬`}
                blank="기록 없음"
              />
              <Throne
                kind="scrim"
                icon={<FaTrophy />}
                label="내전 1위"
                name={s.king?.name}
                value={s.king && `${num(s.king.points)}점`}
                sub={s.king && `${s.king.wins}승 ${s.king.losses}패 · 승률 ${s.king.rate}%`}
                blank="자격자 없음"
              />
            </div>

            {s.list.length > 1 && (
              <ol className="hof-podium">
                {s.list.slice(0, 3).map((r, i) => (
                  <li key={r.user_id} className={`rank-${i + 1}`}>
                    <span className="hof-medal">{MEDALS[i]}</span>
                    <strong>{r.display_name}</strong>
                    <em>{num(r.kkiko_points)} 끼꼬</em>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
    </section>
  );
};

export default HallOfFame;
