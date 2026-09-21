import {
  streaksOf,
  duosOf,
  rivalsOf,
  underdogsOf,
  streakBreakersOf,
  gameCountsOf,
} from './matches';
import {
  TITLE_MIN_PAIR as MIN_PAIR,
  TITLE_MIN_STREAK as MIN_STREAK,
  TITLE_GHOST_DAYS as GHOST_DAYS,
} from './tuning';

/* 데이터가 붙여주는 별명.

   내전 기록 탭에만 있던 계산을 사람 옆에 상시로 붙인다. 이름을 부를 때
   별명이 따라붙는 게 결속의 절반이다.

   한 사람에 하나만 준다. 여러 개를 달면 그냥 배지 더미가 되고, 무엇이
   대단한 건지도 흐려진다. 그래서 위에서부터 먼저 걸리는 것 하나로 끝낸다.
   순서 = 자랑스러운 순서가 아니라 '희소한 순서'다. 아무나 못 받는 걸
   위에 둬야 배지가 값이 있다. */

const DAY = 24 * 60 * 60 * 1000;

/* 퍼스트 블러드는 경기 원본(scrims)에만 있다. matches는 승패만 들고 있다 */
const firstBloodsOf = (scrims, players) => {
  const nameOf = new Map((players || []).map((p) => [p.id, p.name]));
  const count = new Map();
  (scrims || []).forEach((s) => {
    const name = nameOf.get(s.first_blood_player_id);
    if (name) count.set(name, (count.get(name) || 0) + 1);
  });
  return count;
};

const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0];

/* 이름 → { icon, label, tone } */
export const titlesOf = ({ matches = [], scrims = [], players = [] } = {}) => {
  const out = new Map();
  const give = (name, title) => {
    if (name && !out.has(name)) out.set(name, title);
  };

  const streaks = [...streaksOf(matches).entries()].map(([name, s]) => ({ name, ...s }));
  const counts = gameCountsOf(matches);
  const totalGames = matches.length;

  /* 지금 연승 중 - 오늘의 주인공. 제일 먼저 붙는다 */
  const hot = [...streaks].sort((a, b) => b.current - a.current)[0];
  if (hot && hot.current >= MIN_STREAK) {
    give(hot.name, { icon: '🔥', label: `${hot.current}연승 중`, tone: 'hot' });
  }

  /* 지금 연패 중 - 놀리라고 있는 자리다 */
  const cold = [...streaks].sort((a, b) => a.current - b.current)[0];
  if (cold && cold.current <= -MIN_STREAK) {
    give(cold.name, { icon: '🧊', label: `${-cold.current}연패 중`, tone: 'cold' });
  }

  /* 천적 - 특정인에게 유독 강한 사람 */
  const rival = rivalsOf(matches, MIN_PAIR)[0];
  if (rival && rival.rate >= 0.7) {
    give(rival.winner, { icon: '😈', label: `${rival.loser}의 천적`, tone: 'rival' });
  }

  /* 짝꿍 - 같은 팀일 때 유독 잘 되는 둘. 둘 다 받는다 */
  const duo = duosOf(matches, MIN_PAIR)[0];
  if (duo && duo.rate >= 0.65) {
    give(duo.a, { icon: '🤝', label: `${duo.b}와 짝꿍`, tone: 'duo' });
    give(duo.b, { icon: '🤝', label: `${duo.a}와 짝꿍`, tone: 'duo' });
  }

  /* 퍼블 사냥꾼 - 첫 피를 제일 많이 본 사람 */
  const fb = top(firstBloodsOf(scrims, players));
  if (fb && fb[1] >= 2) {
    give(fb[0], { icon: '🎯', label: `퍼블 ${fb[1]}회`, tone: 'fb' });
  }

  /* 연승 저격수 - 남의 연승을 끊고 다니는 사람 */
  const breaker = top(streakBreakersOf(matches));
  if (breaker && breaker[1] >= 2) {
    give(breaker[0], { icon: '✂️', label: '연승 저격수', tone: 'breaker' });
  }

  /* 언더독 - 센 팀을 이겨본 사람 */
  const under = top(underdogsOf(matches));
  if (under && under[1] >= 2) {
    give(under[0], { icon: '🐺', label: '언더독', tone: 'under' });
  }

  /* 개근 - 판수가 제일 많은 사람. 절반은 나와야 준다 */
  const iron = top(counts);
  if (iron && totalGames >= 6 && iron[1] >= totalGames / 2) {
    give(iron[0], { icon: '📅', label: `${iron[1]}판 개근`, tone: 'iron' });
  }

  /* 유령 - 남들은 뛰는데 안 나오는 사람. 불러내라는 뜻이다.

     기준을 '오늘'로 잡으면 방이 통째로 한 달 쉬었을 때 전원이 유령이 된다.
     방의 마지막 경기와 견줘야 '너만 안 나온다'가 된다 */
  const last = new Map();
  matches.forEach((m) => {
    [...m.teamA, ...m.teamB].forEach((n) => {
      const at = m.playedAt || 0;
      if (!last.has(n) || last.get(n) < at) last.set(n, at);
    });
  });
  const roomLast = Math.max(0, ...last.values());
  last.forEach((at, name) => {
    const days = Math.floor((roomLast - at) / DAY);
    if (days >= GHOST_DAYS) give(name, { icon: '👻', label: `${days}일째 안 보임`, tone: 'ghost' });
  });

  return out;
};

export default titlesOf;
