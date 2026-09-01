import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { LINES, getLine } from '../../../lines';
import styles from './Roulette.module.css';

const VISIBLE_COUNT = 3;
const LOOP_COUNT = 40; // 5라인 × 40 = 200칸, 무한 루프처럼 보이게
const MID = Math.floor(VISIBLE_COUNT / 2);
const SPIN_MS = 3000;

const Roulette = ({ options, selectedOption, trigger, resetTrigger }) => {
  /* 위치를 px가 아니라 '가운데 칸에 놓일 아이템 번호'로 들고 있는다.
     그래야 칸 폭이 바뀌어도(반응형) 항상 아이콘 정중앙에 맞는다 */
  const [landed, setLanded] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [itemWidth, setItemWidth] = useState(80);
  const viewportRef = useRef(null);
  const prevTrigger = useRef(trigger);
  const prevReset = useRef(resetTrigger);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
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
    if (resetTrigger === undefined || resetTrigger === prevReset.current) return;
    prevReset.current = resetTrigger;
    setAnimating(false);
    setSpinning(false);
    setLanded(0);
  }, [resetTrigger]);

  useEffect(() => {
    if (trigger === prevTrigger.current) return;
    prevTrigger.current = trigger;
    if (!selectedOption) return;

    const finalIdx = options.indexOf(selectedOption);
    if (finalIdx < 0) return;

    /* 전환 없이 처음으로 되감은 뒤, 다음 프레임부터 목표 칸까지 돌린다 */
    setAnimating(false);
    setLanded(0);
    setSpinning(true);

    const rounds = 4 + Math.floor(Math.random() * 4);
    const target = rounds * options.length + finalIdx;

    let inner;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setAnimating(true);
        setLanded(target);
      });
    });
    const stop = setTimeout(() => {
      setSpinning(false);
      setAnimating(false);
    }, SPIN_MS + 60);

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      clearTimeout(stop);
    };
  }, [trigger, selectedOption, options]);

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
          transform: `translateX(${(MID - landed) * itemWidth}px)`,
          transition: animating
            ? `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.82, 0.17, 1)`
            : 'none',
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
