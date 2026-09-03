import { formatReport } from './report';

/* 정산 결과를 PNG로 그린다.

   html2canvas 같은 라이브러리를 물지 않는다. 번들이 이미 250kB인데
   순위표 하나 그리자고 50kB를 더할 이유가 없다. 어차피 글 리포트와
   같은 줄을 쓰므로, 그 줄을 캔버스에 옮겨 그리기만 하면 된다.
   덕분에 글과 이미지의 내용이 어긋날 일도 없다. */
const W = 720;
const PAD = 40;
const LINE = 34;
const TITLE = 30;

const FONT = "'Noto Sans KR', 'Malgun Gothic', sans-serif";

const styleOf = (line, i) => {
  if (i === 0) return { size: 22, color: '#f0d99a', weight: 800, gap: TITLE };
  if (line.startsWith('—')) return { size: 15, color: '#c8aa6e', weight: 800, gap: LINE };
  if (/^[🥇🥈🥉]|^\d+\./.test(line)) return { size: 17, color: '#e6ecf7', weight: 700, gap: LINE };
  if (line === '') return { size: 0, color: '', weight: 400, gap: 14 };
  return { size: 14, color: '#93a5c4', weight: 500, gap: LINE - 6 };
};

/* 캔버스가 없는 환경(jsdom 등)에서는 조용히 null을 준다 */
export const drawReport = (data) => {
  const lines = formatReport(data).split('\n');
  const styles = lines.map(styleOf);
  const height = PAD * 2 + styles.reduce((sum, s) => sum + s.gap, 0) + 30;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;

  canvas.width = W;
  canvas.height = height;

  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, W, height);
  ctx.strokeStyle = 'rgba(200, 170, 110, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, height - 2);

  let y = PAD + 10;
  lines.forEach((line, i) => {
    const s = styles[i];
    if (line) {
      ctx.fillStyle = s.color;
      ctx.font = `${s.weight} ${s.size}px ${FONT}`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(line, PAD, y);
    }
    y += s.gap;
  });

  ctx.fillStyle = '#4d5b73';
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText('lol-randchamp.vercel.app', PAD, height - PAD + 12);

  return canvas;
};

export const downloadReport = (data, fileName) =>
  new Promise((resolve) => {
    const canvas = drawReport(data);
    if (!canvas) {
      resolve(false);
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      /* 클릭 직후 지우면 저장이 취소되는 브라우저가 있어 한 틱 뒤에 */
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve(true);
    }, 'image/png');
  });
