import React, { useState } from 'react';
import toast from 'react-hot-toast';
import PlayerCard from './components/PlayerCard';
import { LINE_NAMES, randomQuote } from './components/lines';
import styles from './RandomLine.module.css';

const SUBTITLES = [
  '가기 싫은 라인은 미리 밴 때려두자. 억울함 방지 차원에서.',
  '여기서 정해지면 무를 수 없습니다. 신중하게 밴하세요.',
  '탑차이, 정글탓, 원딜캐리 다 필요없고 일단 뽑고 봅시다.',
];

const makeEmptyPlayers = () =>
  Array.from({ length: 5 }, () => ({ name: '', disabled: [] }));

export default function RandomLinePage() {
  const [players, setPlayers] = useState(makeEmptyPlayers());
  const [assigned, setAssigned] = useState(Array(5).fill(null));
  const [quotes, setQuotes] = useState(Array(5).fill(''));
  const [triggers, setTriggers] = useState(Array(5).fill(0));
  const [resetTriggers, setResetTriggers] = useState(Array(5).fill(0));
  const [celebrate, setCelebrate] = useState(false);
  const [subtitle] = useState(
    () => SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)]
  );

  const onNameChange = (i, newName) => {
    const cp = [...players];
    cp[i].name = newName;
    setPlayers(cp);
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
      toast.success('구성 완료! GL HF 🍀', { duration: 4000 });
      setTimeout(() => setCelebrate(false), 3200);
    }
  };

  const assignOne = (i) => {
    const used = assigned.filter((_, idx) => idx !== i);
    const allow = LINE_NAMES.filter(
      (l) => !players[i].disabled.includes(l) && !used.includes(l)
    );
    if (!allow.length) {
      toast.error('갈 라인이 없습니다... 밴을 너무 세게 때렸네요 😱');
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
        toast.error(`플레이어 ${i + 1}, 밴을 너무 많이 해서 갈 곳이 없어요 🙈`);
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
      toast.error('이 조합으로는 다섯 명을 다 배정할 수 없어요. 밴 좀 풀어주세요 🥲');
      return;
    }

    setAssigned(result);
    setQuotes(result.map((line) => randomQuote(line)));
    setTriggers((trigs) => trigs.map((v) => v + 1));
    checkCelebrate(result);
  };

  const resetAll = () => {
    setPlayers(makeEmptyPlayers());
    setAssigned(Array(5).fill(null));
    setQuotes(Array(5).fill(''));
    setTriggers(Array(5).fill(0));
    setResetTriggers((r) => r.map((x) => x + 1));
    setCelebrate(false);
    toast('판 갈아엎었습니다. 원한 관계 리셋 🔄', { icon: '🧹' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.auroraLayer} aria-hidden="true">
        <span className={`${styles.blob} ${styles.blob1}`} />
        <span className={`${styles.blob} ${styles.blob2}`} />
        <span className={`${styles.blob} ${styles.blob3}`} />
      </div>
      <div className={styles.hexBg} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />

      <div className={styles.headerBlock}>
        <span className={styles.kicker}>🎮 협곡 친선전 · 5v5</span>
        <h1 className={styles.title}>
          <span className={styles.dice}>🎲</span>
          오늘의 라인 결정전
        </h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      <div className={styles.cardWrapper}>
        {players.map((p, i) => (
          <PlayerCard
            key={i}
            index={i}
            name={p.name}
            disabledLines={p.disabled}
            assignedLine={assigned[i]}
            quote={quotes[i]}
            spinTrigger={triggers[i]}
            resetTrigger={resetTriggers[i]}
            onNameChange={onNameChange}
            onToggleLine={onToggleLine}
            onAssign={assignOne}
          />
        ))}
      </div>

      <div className={styles.buttonGroup}>
        <button className={styles.resetAll} onClick={resetAll}>
          전체 초기화 🔄
        </button>
        <button className={styles.assignAll} onClick={assignAll}>
          한 방에 정하기 🚀
        </button>
      </div>

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
