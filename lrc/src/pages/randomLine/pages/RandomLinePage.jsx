import React, { useState } from 'react';
import PlayerCard from '../components/PlayerCard';
import { LINE_NAMES } from '../components/lines';
import styles from '../styles/randomLine.module.css';

export default function RandomLinePage() {
  const [players, setPlayers] = useState(
    Array.from({ length: 5 }, () => ({ name: '', disabled: [] }))
  );
  const [assigned, setAssigned] = useState(Array(5).fill(null));
  const [triggers, setTriggers] = useState(Array(5).fill(0));

  // 이름 변경
  const onNameChange = (i, newName) => {
    const cp = [...players];
    cp[i].name = newName;
    setPlayers(cp);
  };

  // 라인 금지/허용
  const onToggleLine = (i, line) => {
    const cp = [...players];
    const arr = cp[i].disabled;
    cp[i].disabled = arr.includes(line)
      ? arr.filter((l) => l !== line)
      : [...arr, line];
    setPlayers(cp);
  };

  // 개별 배정
  const assignOne = (i) => {
    const used = assigned.filter((_, idx) => idx !== i);
    const allow = LINE_NAMES.filter(
      (l) => !players[i].disabled.includes(l) && !used.includes(l)
    );
    if (!allow.length) {
      alert('남은 라인이 없습니다.');
      return;
    }
    const pick = allow[Math.floor(Math.random() * allow.length)];
    const asg = [...assigned];
    asg[i] = pick;
    setAssigned(asg);

    const tg = [...triggers];
    tg[i] += 1;
    setTriggers(tg);
  };

  // 전체 배정
  const assignAll = () => {
    const newAsg = [];
    const avail = [...LINE_NAMES];
    for (let i = 0; i < players.length; i++) {
      const allow = avail.filter((l) => !players[i].disabled.includes(l));
      if (!allow.length) {
        alert(`플레이어 ${i + 1}에게 할당할 라인이 없습니다.`);
        return;
      }
      const pick = allow[Math.floor(Math.random() * allow.length)];
      newAsg[i] = pick;
      avail.splice(avail.indexOf(pick), 1);
    }
    setAssigned(newAsg);
    setTriggers((trigs) => trigs.map((v) => v + 1));
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🎯 라인 랜덤 분배</h1>
      <div className={styles.cardWrapper}>
        {players.map((p, i) => (
          <PlayerCard
            key={i}
            index={i}
            name={p.name}
            disabledLines={p.disabled}
            assignedLine={assigned[i]}
            spinTrigger={triggers[i]}
            onNameChange={onNameChange}
            onToggleLine={onToggleLine}
            onAssign={assignOne}
          />
        ))}
      </div>
      <button className={styles.assignAll} onClick={assignAll}>
        전체 라인 배정 🚀
      </button>
    </div>
  );
}
