/* 정산 결과를 카톡·디스코드에 그대로 붙일 수 있는 글로 만든다.

   이미지 대신 글로 뽑는 이유: 어디에나 붙고, 검색되고, 인용된다.
   이미지는 라이브러리(html2canvas 등)를 물거나 캔버스를 손으로 그려야
   해서 비용이 큰데, 순위표는 글로도 충분히 읽힌다. */
const MEDALS = ['🥇', '🥈', '🥉'];

const pct = (rate) => `${Math.round(rate * 100)}%`;
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

export const formatReport = ({ periodLabel, played, ranking, insights = [] }) => {
  const lines = [
    `[롤랜챔] ${periodLabel} 내전 정산`,
    `${played}경기 · ${ranking.length}명`,
    '',
  ];

  if (ranking.length === 0) {
    lines.push('기록 없음');
  } else {
    ranking.forEach((r, i) => {
      const rate = r.games ? ` (${pct(r.wins / r.games)})` : '';
      lines.push(
        `${MEDALS[i] || `${i + 1}.`} ${r.name} ${r.wins}승 ${r.losses}패${rate} ${signed(
          r.points
        )}`
      );
    });
  }

  const shown = insights.filter((i) => i && i.value);
  if (shown.length > 0) {
    lines.push('', '— 숨은 기록 —');
    shown.forEach((i) => lines.push(`${i.label}: ${i.value}`));
  }

  return lines.join('\n');
};

/* 클립보드는 https나 localhost에서만 열린다. 실패하면 알려줘야 한다 */
export const copyText = async (text) => {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
