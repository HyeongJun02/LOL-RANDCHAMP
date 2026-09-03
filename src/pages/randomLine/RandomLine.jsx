import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useRoster } from '../../roster';
import { FaThLarge, FaListUl } from 'react-icons/fa';
import PlayerCard from './components/PlayerCard';
import PlayerRow from './components/PlayerRow';
import PageHeader from '../../components/common/PageHeader';
import RosterLoader from '../../components/common/RosterLoader';
import RosterLoadButton from '../../components/common/RosterLoadButton';
import { LINE_NAMES, randomQuote } from '../../lines';
import { usePageMeta, PAGE_META } from '../../seo';
import styles from './RandomLine.module.css';

const SUBTITLES = [
  '가기 싫은 라인은 미리 밴 때려두자. 억울함 방지 차원에서.',
  '여기서 정해지면 무를 수 없습니다. 신중하게 밴하세요.',
  '탑차이, 정글탓, 원딜캐리 다 필요없고 일단 뽑고 봅시다.',
];

/* 좁은 화면에서는 카드 5장이 세로로 한없이 늘어져서 목록이 낫다.
   jsdom에는 matchMedia가 없으므로 방어한다 */
const prefersCompact = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 780px)').matches;

const makeEmptyPlayers = () =>
  Array.from({ length: 5 }, () => ({ name: '', disabled: [] }));

export default function RandomLinePage() {
  const [players, setPlayers] = useState(makeEmptyPlayers());
  const [assigned, setAssigned] = useState(Array(5).fill(null));
  const [quotes, setQuotes] = useState(Array(5).fill(''));
  const [triggers, setTriggers] = useState(Array(5).fill(0));
  const [resetTriggers, setResetTriggers] = useState(Array(5).fill(0));
  const [celebrate, setCelebrate] = useState(false);
  const [compact, setCompact] = useState(prefersCompact);
  const [showLoader, setShowLoader] = useState(false);
  const roster = useRoster();
  usePageMeta(PAGE_META.randomLine);
  const [subtitle] = useState(
    () => SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)]
  );

  const onNameChange = (i, newName) => {
    const cp = [...players];
    cp[i].name = newName;
    setPlayers(cp);
  };

  /* 저장된 팀원을 고르면 못 가는 라인까지 같이 채운다 */
  const onPickMember = (i, member) => {
    setPlayers((prev) =>
      prev.map((p, j) =>
        j === i ? { ...p, name: member.name, disabled: [...(member.lines || [])] } : p
      )
    );
  };

  /* 팝업에서 고른 대로 맞춘다. 체크가 풀린 사람은 자리를 비운다. 자리는 5개 고정 */
  const syncMembers = (members) => {
    const wanted = new Set(members.map((m) => m.name.trim()));
    const rosterNames = new Set(roster.map((m) => m.name.trim()));

    const cleared = players.map((p) => {
      const name = p.name.trim();
      const dropped = name !== '' && rosterNames.has(name) && !wanted.has(name);
      return dropped ? { ...p, name: '', disabled: [] } : p;
    });

    const already = new Set(cleared.map((p) => p.name.trim()));
    const queue = members.filter((m) => !already.has(m.name.trim()));

    const next = cleared.map((p) =>
      p.name.trim() === '' && queue.length > 0
        ? { ...p, name: queue[0].name, disabled: [...(queue.shift().lines || [])] }
        : p
    );

    setPlayers(next);
    if (queue.length > 0) {
      toast.error(`자리가 모자라 ${queue.length}명은 넣지 못했습니다.`);
    }
  };

  /* 이 사람 배정만 되돌린다. 이름과 밴은 그대로 */
  const resetOne = (i) => {
    setAssigned((prev) => prev.map((v, j) => (j === i ? null : v)));
    setQuotes((prev) => prev.map((v, j) => (j === i ? '' : v)));
    setResetTriggers((prev) => prev.map((v, j) => (j === i ? v + 1 : v)));
    setCelebrate(false);
  };

  const onToggleLine = (i, line) => {
    const cp = [...players];
    const arr = cp[i].disabled;
    cp[i].disabled = arr.includes(line)
      ? arr.filter((l) => l !== line)
      : [...arr, line];
    setPlayers(cp);
  };

  const checkCelebrate = (arr) => {
    if (arr.every(Boolean)) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 3200);
    }
  };

  const assignOne = (i) => {
    const used = assigned.filter((_, idx) => idx !== i);
    const allow = LINE_NAMES.filter(
      (l) => !players[i].disabled.includes(l) && !used.includes(l)
    );
    if (!allow.length) {
      toast.error('갈 수 있는 라인이 없습니다. 밴을 풀어주세요.');
      return;
    }
    const pick = allow[Math.floor(Math.random() * allow.length)];
    const asg = [...assigned];
    asg[i] = pick;
    setAssigned(asg);

    const qt = [...quotes];
    qt[i] = randomQuote(pick);
    setQuotes(qt);

    const tg = [...triggers];
    tg[i] += 1;
    setTriggers(tg);

    checkCelebrate(asg);
  };

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const assignAll = () => {
    const allowed = players.map((p) =>
      LINE_NAMES.filter((l) => !p.disabled.includes(l))
    );

    for (let i = 0; i < allowed.length; i++) {
      if (allowed[i].length === 0) {
        toast.error(`${i + 1}번 플레이어가 갈 수 있는 라인이 없습니다.`);
        return;
      }
    }

    const order = Array.from({ length: players.length }, (_, i) => i).sort(
      (a, b) => allowed[a].length - allowed[b].length
    );

    const choices = allowed.map((list) => shuffle([...list]));
    const result = Array(players.length).fill(null);
    const used = new Set();

    const dfs = (k) => {
      if (k === order.length) return true;
      const i = order[k];
      for (const line of choices[i]) {
        if (used.has(line)) continue;
        result[i] = line;
        used.add(line);
        if (dfs(k + 1)) return true;
        used.delete(line);
        result[i] = null;
      }
      return false;
    };

    if (!dfs(0)) {
      toast.error('이 밴 조합으로는 다섯 명을 모두 배정할 수 없습니다.');
      return;
    }

    setAssigned(result);
    setQuotes(result.map((line) => randomQuote(line)));
    setTriggers((trigs) => trigs.map((v) => v + 1));
    checkCelebrate(result);
  };

  /* 이름과 밴은 그대로 두고 배정 결과만 되돌린다 */
  const resetAll = () => {
    setAssigned(Array(5).fill(null));
    setQuotes(Array(5).fill(''));
    setTriggers(Array(5).fill(0));
    setResetTriggers((r) => r.map((x) => x + 1));
    setCelebrate(false);
  };

  return (
    <div className={`page ${styles.container}`}>
      <PageHeader title="라인 랜덤 분배" sub={subtitle}>
        <div className={styles.headActions}>
          <RosterLoadButton onClick={() => setShowLoader(true)} />

          <div className={styles.viewToggle} role="group" aria-label="보기 방식">
            <button
              className={compact ? '' : styles.viewActive}
              aria-pressed={!compact}
              onClick={() => setCompact(false)}
            >
              <FaThLarge /> 카드
            </button>
            <button
              className={compact ? styles.viewActive : ''}
              aria-pressed={compact}
              onClick={() => setCompact(true)}
            >
              <FaListUl /> 한눈에
            </button>
          </div>
        </div>
      </PageHeader>

      <div className={compact ? styles.rowWrapper : styles.cardWrapper}>
        {players.map((p, i) => {
          const shared = {
            index: i,
            name: p.name,
            takenNames: players.filter((_, j) => j !== i).map((x) => x.name),
            disabledLines: p.disabled,
            assignedLine: assigned[i],
            quote: quotes[i],
            onNameChange,
            onPickMember,
            onToggleLine,
            onAssign: assignOne,
            onResetOne: resetOne,
          };
          return compact ? (
            <PlayerRow key={i} {...shared} />
          ) : (
            <PlayerCard
              key={i}
              {...shared}
              spinTrigger={triggers[i]}
              resetTrigger={resetTriggers[i]}
            />
          );
        })}
      </div>

      <div className={styles.buttonGroup}>
        <button className={styles.resetAll} onClick={resetAll}>
          전체 초기화
        </button>
        <button className={styles.assignAll} onClick={assignAll}>
          한 방에 정하기
        </button>
      </div>

      {showLoader && (
        <RosterLoader
          present={players.map((p) => p.name)}
          limit={
            players.length -
            players.filter(
              (p) =>
                p.name.trim() !== '' &&
                !roster.some((m) => m.name.trim() === p.name.trim())
            ).length
          }
          onConfirm={syncMembers}
          onClose={() => setShowLoader(false)}
        />
      )}

      {celebrate && (
        <div className={styles.confettiLayer} aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className={styles.confetti}
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.6}s`,
                animationDuration: `${2 + Math.random() * 1.5}s`,
              }}
            >
              {['🎉', '⚔️', '🔥', '✨', '🍀'][i % 5]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
