import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { LINES, getLine } from './lines';
import styles from './Roulette.module.css';

const VISIBLE_COUNT = 3;
const LOOP_COUNT = 40; // 5라인 × 40 = 200 아이콘, 무한 루프처럼 보이게

const Roulette = ({ options, selectedOption, trigger, resetTrigger }) => {
  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [itemWidth, setItemWidth] = useState(80);
  const viewportRef = useRef(null);
  const prevTrigger = useRef(trigger);
  const prevReset = useRef(resetTrigger);

  // 실제 렌더링된 폭을 측정해서 반응형 화면에서도 정렬이 어긋나지 않게 함
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth / VISIBLE_COUNT;
      if (w > 0) setItemWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (resetTrigger === undefined) return;
    if (resetTrigger === prevReset.current) return;
    prevReset.current = resetTrigger;
    setSpinning(false);
    setOffset(0);
  }, [resetTrigger]);

  useEffect(() => {
    if (trigger === prevTrigger.current) return;
    prevTrigger.current = trigger;
    if (!selectedOption) return;

    const finalIdx = options.findIndex((l) => l === selectedOption);
    if (finalIdx < 0) return;

    const spinRounds = 4 + Math.floor(Math.random() * 4); // 4~7바퀴
    const totalItems = spinRounds * options.length + finalIdx;
    const mid = Math.floor(VISIBLE_COUNT / 2);

    const noise = (Math.random() - 0.5) * itemWidth * 0.5;
    const targetOffset = (mid - totalItems) * itemWidth + noise;

    setSpinning(true);
    setOffset(0);
    requestAnimationFrame(() => setOffset(targetOffset));
    const stopTimer = setTimeout(() => setSpinning(false), 3050);
    return () => clearTimeout(stopTimer);
  }, [trigger, selectedOption, options, itemWidth]);

  const items = Array.from({ length: LOOP_COUNT })
    .map(() => options)
    .flat();

  const winner = selectedOption ? getLine(selectedOption) : null;

  return (
    <div
      ref={viewportRef}
      className={`${styles.viewport} ${spinning ? styles.spinning : ''}`}
      style={
        winner && !spinning
          ? { boxShadow: `0 0 25px ${winner.glow}`, borderColor: winner.color }
          : undefined
      }
    >
      <div
        className={styles.list}
        style={{
          transform: `translateX(${offset}px)`,
          transition: 'transform 3s cubic-bezier(0.08, 0.82, 0.17, 1)',
        }}
      >
        {items.map((name, i) => {
          const l = LINES.find((line) => line.name === name);
          return (
            <div
              key={`${name}-${i}`}
              className={styles.item}
              style={{ flex: `0 0 ${itemWidth}px` }}
            >
              <img src={l?.icon || ''} alt={name} />
              <span style={{ color: l?.color }}>{name}</span>
            </div>
          );
        })}
      </div>
      <div
        className={styles.centerLight}
        style={{
          left: itemWidth,
          width: itemWidth,
          ...(winner ? { borderColor: winner.color, boxShadow: `0 0 30px ${winner.glow}` } : null),
        }}
      />
    </div>
  );
};

export default Roulette;
