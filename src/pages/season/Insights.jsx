import React, { useMemo } from 'react';
import { FaFire, FaSnowflake, FaHandshake, FaSkull, FaMedal } from 'react-icons/fa';
import { streaksOf, duosOf, rivalsOf, MIN_PAIR_GAMES } from '../../matches';

const pct = (rate) => `${Math.round(rate * 100)}%`;

const Card = ({ icon, label, children, hint }) => (
  <div className="insight">
    <span className="insight-head">
      {icon} {label}
    </span>
    {children}
    {hint && <em className="insight-hint">{hint}</em>}
  </div>
);

const Empty = () => <span className="insight-empty">아직 없음</span>;

/* 손으로 세기 힘든 것들만 모은다. 단순 승패는 순위표가 이미 보여준다. */
const Insights = ({ matches, mode }) => {
  const { hot, cold, best, duo, worstDuo, rival, iron } = useMemo(() => {
    const streaks = [...streaksOf(matches, mode).entries()].map(([name, s]) => ({
      name,
      ...s,
    }));
    const duos = duosOf(matches, mode);
    const rivals = rivalsOf(matches, mode);
    const played = matches.filter((m) => m.mode === mode);

    const counts = new Map();
    played.forEach((m) =>
      [...(m.teamA || []), ...(m.teamB || [])].forEach((n) => {
        const key = String(n).trim();
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
      })
    );

    return {
      hot: [...streaks].sort((a, b) => b.current - a.current)[0],
      cold: [...streaks].sort((a, b) => a.current - b.current)[0],
      best: [...streaks].sort((a, b) => b.bestWin - a.bestWin)[0],
      duo: duos[0],
      worstDuo: duos.length > 1 ? duos[duos.length - 1] : null,
      rival: rivals[0],
      iron: [...counts.entries()].sort((a, b) => b[1] - a[1])[0],
    };
  }, [matches, mode]);

  return (
    <div className="insight-grid">
      <Card icon={<FaFire />} label="지금 연승 중">
        {hot && hot.current > 1 ? (
          <span className="insight-main">
            {hot.name} <strong>{hot.current}연승</strong>
          </span>
        ) : (
          <Empty />
        )}
      </Card>

      <Card icon={<FaSnowflake />} label="지금 연패 중">
        {cold && cold.current < -1 ? (
          <span className="insight-main">
            {cold.name} <strong>{-cold.current}연패</strong>
          </span>
        ) : (
          <Empty />
        )}
      </Card>

      <Card icon={<FaMedal />} label="역대 최고 연승">
        {best && best.bestWin > 1 ? (
          <span className="insight-main">
            {best.name} <strong>{best.bestWin}연승</strong>
          </span>
        ) : (
          <Empty />
        )}
      </Card>

      <Card
        icon={<FaHandshake />}
        label="찰떡 궁합"
        hint={duo && `같은 팀 ${duo.games}판`}
      >
        {duo ? (
          <span className="insight-main">
            {duo.a} · {duo.b} <strong>{pct(duo.rate)}</strong>
          </span>
        ) : (
          <Empty />
        )}
      </Card>

      <Card
        icon={<FaHandshake />}
        label="같이 가면 지는 조합"
        hint={worstDuo && `같은 팀 ${worstDuo.games}판`}
      >
        {worstDuo && worstDuo.rate < 0.5 ? (
          <span className="insight-main">
            {worstDuo.a} · {worstDuo.b} <strong>{pct(worstDuo.rate)}</strong>
          </span>
        ) : (
          <Empty />
        )}
      </Card>

      <Card icon={<FaSkull />} label="천적" hint={rival && `맞붙은 ${rival.games}판`}>
        {rival ? (
          <span className="insight-main">
            {rival.winner} → {rival.loser} <strong>{pct(rival.rate)}</strong>
          </span>
        ) : (
          <Empty />
        )}
      </Card>

      <Card icon={<FaMedal />} label="개근왕">
        {iron ? (
          <span className="insight-main">
            {iron[0]} <strong>{iron[1]}판</strong>
          </span>
        ) : (
          <Empty />
        )}
      </Card>

      <p className="insight-note">
        짝 통계는 {MIN_PAIR_GAMES}판 이상 함께한 경우만 셉니다. 한두 판으로 100%가 뜨면
        의미가 없어서요.
      </p>
    </div>
  );
};

export default Insights;
