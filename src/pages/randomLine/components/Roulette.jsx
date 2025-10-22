import React, { useState, useEffect, useRef } from 'react';
import { LINES } from './lines';
import styles from './Roulette.module.css';

const ITEM_WIDTH = 80;
const VISIBLE_COUNT = 3;

// 한정된 길이를 없애고, 아주 긴 리스트로 반복
const LOOP_COUNT = 40; // 안전하게 40세트 (5라인 × 40 = 200 아이콘)

const Roulette = ({ options, selectedOption, trigger }) => {
  const [offset, setOffset] = useState(0);
  const prevTrigger = useRef(trigger);

  useEffect(() => {
    if (trigger === prevTrigger.current) return;
    prevTrigger.current = trigger;
    if (!selectedOption) return;

    const finalIdx = options.findIndex((l) => l === selectedOption);
    if (finalIdx < 0) return;

    // 매번 다른 속도와 회전 거리
    const spinRounds = 4 + Math.floor(Math.random() * 4); // 4~7바퀴
    const totalItems = spinRounds * options.length + finalIdx;
    const mid = Math.floor(VISIBLE_COUNT / 2);

    // Noise & 감속
    const noise = (Math.random() - 0.5) * ITEM_WIDTH * 0.5;
    const targetOffset = (mid - totalItems) * ITEM_WIDTH + noise;

    // 초기화 → 부드럽게 이동
    setOffset(0);
    requestAnimationFrame(() => setOffset(targetOffset));
  }, [trigger, selectedOption, options]);

  // ✅ 아이콘 무한 반복 (길게 늘림)
  const items = Array.from({ length: LOOP_COUNT })
    .map(() => options)
    .flat();

  return (
    <div className={styles.viewport}>
      <div
        className={styles.list}
        style={{
          transform: `translateX(${offset}px)`,
          transition: 'transform 3s cubic-bezier(0.08, 0.82, 0.17, 1)',
        }}
      >
        {items.map((name, i) => {
          const icon = LINES.find((l) => l.name === name)?.icon || '';
          return (
            <div key={`${name}-${i}`} className={styles.item}>
              <img src={icon} alt={name} />
              <span>{name}</span>
            </div>
          );
        })}
      </div>
      <div className={styles.centerLight}></div>
    </div>
  );
};

export default Roulette;
