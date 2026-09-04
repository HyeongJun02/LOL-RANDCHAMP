import {
  streaksOf,
  duosOf,
  rivalsOf,
  underdogsOf,
  streakBreakersOf,
  busiestDayOf,
  lastSeenOf,
  gameCountsOf,
  MIN_PAIR_GAMES,
  BREAK_MIN,
} from '../../matches';

/* 손으로 세기 힘든 것만 모은다. 단순 승패는 순위표가 이미 보여준다.
   화면과 공유용 글이 같은 결과를 쓰도록 값 계산은 여기 한 곳에서만 한다.
   value가 null이면 아직 보여줄 게 없다는 뜻. */

const pct = (rate) => `${Math.round(rate * 100)}%`;
const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0];
const DAY = 24 * 60 * 60 * 1000;

export const buildInsights = (matches, now = Date.now()) => {
  const streaks = [...streaksOf(matches).entries()].map(([name, s]) => ({ name, ...s }));
  const duos = duosOf(matches);
  const rivals = rivalsOf(matches);
  const played = matches;
  const counts = gameCountsOf(played);

  const hot = [...streaks].sort((a, b) => b.current - a.current)[0];
  const cold = [...streaks].sort((a, b) => a.current - b.current)[0];
  const best = [...streaks].sort((a, b) => b.bestWin - a.bestWin)[0];
  const worstDuo = duos.length > 1 ? duos[duos.length - 1] : null;
  const mostPlayedDuo = [...duos].sort((a, b) => b.games - a.games)[0];
  /* rivalsOf의 rate는 이긴 쪽 기준이라 항상 0.5 이상. 0.5에 가까울수록 팽팽하다 */
  const evenRival = [...rivals].sort(
    (a, b) => Math.abs(a.rate - 0.5) - Math.abs(b.rate - 0.5) || b.games - a.games
  )[0];
  const mostMet = [...rivals].sort((a, b) => b.games - a.games)[0];
  const underdog = top(underdogsOf(matches));
  const breaker = top(streakBreakersOf(matches));
  const iron = top(counts);
  const busiest = busiestDayOf(matches);

  const seen = lastSeenOf(matches);
  const ghost = [...seen.entries()].sort((a, b) => a[1] - b[1])[0];
  const ghostDays = ghost ? Math.floor((now - ghost[1]) / DAY) : 0;

  return [
    {
      key: 'hot',
      group: 'streak',
      label: '지금 연승 중',
      value: hot && hot.current > 1 ? `${hot.name} ${hot.current}연승` : null,
    },
    {
      key: 'cold',
      group: 'streak',
      label: '지금 연패 중',
      value: cold && cold.current < -1 ? `${cold.name} ${-cold.current}연패` : null,
    },
    {
      key: 'best',
      group: 'streak',
      label: '역대 최고 연승',
      value: best && best.bestWin > 1 ? `${best.name} ${best.bestWin}연승` : null,
    },
    {
      key: 'duo',
      group: 'pair',
      label: '찰떡 궁합',
      value: duos[0] ? `${duos[0].a} · ${duos[0].b} ${pct(duos[0].rate)}` : null,
      hint: duos[0] && `같은 팀 ${duos[0].games}판`,
    },
    {
      key: 'worstDuo',
      group: 'pair',
      label: '같이 가면 지는 조합',
      value:
        worstDuo && worstDuo.rate < 0.5
          ? `${worstDuo.a} · ${worstDuo.b} ${pct(worstDuo.rate)}`
          : null,
      hint: worstDuo && `같은 팀 ${worstDuo.games}판`,
    },
    {
      key: 'mostDuo',
      group: 'pair',
      label: '가장 많이 같은 팀',
      value: mostPlayedDuo ? `${mostPlayedDuo.a} · ${mostPlayedDuo.b} ${mostPlayedDuo.games}판` : null,
    },
    {
      key: 'rival',
      group: 'versus',
      label: '천적',
      value: rivals[0] ? `${rivals[0].winner} → ${rivals[0].loser} ${pct(rivals[0].rate)}` : null,
      hint: rivals[0] && `맞붙은 ${rivals[0].games}판`,
    },
    {
      key: 'even',
      group: 'versus',
      label: '팽팽한 맞수',
      value: evenRival ? `${evenRival.winner} · ${evenRival.loser} ${pct(evenRival.rate)}` : null,
      hint: evenRival && `맞붙은 ${evenRival.games}판`,
    },
    {
      key: 'mostMet',
      group: 'versus',
      label: '최다 맞대결',
      value: mostMet ? `${mostMet.winner} · ${mostMet.loser} ${mostMet.games}판` : null,
    },
    {
      key: 'underdog',
      group: 'streak',
      label: '언더독',
      value: underdog ? `${underdog[0]} ${underdog[1]}번` : null,
      hint: '열세로 봤는데 이긴 판',
    },
    {
      key: 'breaker',
      group: 'streak',
      label: '연승 저격수',
      value: breaker ? `${breaker[0]} ${breaker[1]}번` : null,
      hint: `${BREAK_MIN}연승 이상을 끊은 횟수`,
    },
    {
      key: 'iron',
      group: 'attend',
      label: '개근왕',
      value: iron ? `${iron[0]} ${iron[1]}판` : null,
    },
    {
      key: 'busiest',
      group: 'attend',
      label: '가장 뜨거웠던 날',
      value: busiest ? `${busiest.day} ${busiest.games}판` : null,
    },
    {
      key: 'ghost',
      group: 'attend',
      label: '가장 오래 안 온 사람',
      value: ghost && ghostDays >= 1 ? `${ghost[0]} ${ghostDays}일째` : null,
    },
  ];
};

export const PAIR_MIN = MIN_PAIR_GAMES;

/* 14개를 한 덩어리로 쏟으면 뭐가 뭔지 안 보인다. 성격별로 나눈다 */
export const INSIGHT_GROUPS = [
  { key: 'streak', label: '기세' },
  { key: 'pair', label: '궁합' },
  { key: 'versus', label: '맞대결' },
  { key: 'attend', label: '출석' },
];
