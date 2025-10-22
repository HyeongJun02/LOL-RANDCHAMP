import React, { useState } from 'react';
import toast from 'react-hot-toast';
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
      toast.error(`남은 라인이 없습니다.`);
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

  // 유틸: 제자리 섞기
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const assignAll = () => {
    // 각 플레이어가 가능한(금지되지 않은) 라인 목록
    const allowed = players.map((p) =>
      LINE_NAMES.filter((l) => !p.disabled.includes(l))
    );

    // 먼저 "불가능한 플레이어" 빠르게 체크
    for (let i = 0; i < allowed.length; i++) {
      if (allowed[i].length === 0) {
        toast.error(`플레이어 ${i + 1}에게 가능한 라인이 없습니다.`);
        return;
      }
    }

    // 허용 라인 수가 적은 플레이어부터 배정하면 실패 확률 ↓
    const order = Array.from({ length: players.length }, (_, i) => i).sort(
      (a, b) => allowed[a].length - allowed[b].length
    );

    // 약간의 랜덤성을 위해 각 플레이어의 선택지 섞기
    const choices = allowed.map((list) => shuffle([...list]));

    const result = Array(players.length).fill(null);
    const used = new Set();

    const dfs = (k) => {
      if (k === order.length) return true; // 모두 배정 완료
      const i = order[k]; // 실제 플레이어 인덱스
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
      // 이 경우는 제약 자체가 모순일 때 (예: 두 명이 모두 한 라인만 허용)
      toast.error(
        '현재 설정으로는 모든 플레이어에게 라인을 배정할 수 없습니다.'
      );
      return;
    }

    setAssigned(result);
    // 룰렛 스핀 트리거 증가 (기존 동작 유지)
    setTriggers((trigs) => trigs.map((v) => v + 1));

    toast.success('라인 배정이 완료되었습니다!');
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
