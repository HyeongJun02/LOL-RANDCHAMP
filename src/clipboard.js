/* 클립보드 복사.

   navigator.clipboard는 https나 localhost에서만 열린다. 안 열리는 자리도
   있으니(사내망 http, 오래된 웹뷰) 되든 안 되든 결과를 돌려주고,
   부르는 쪽에서 '복사됐어요' 또는 '직접 복사해 주세요'를 고른다. */
export const copyText = async (text) => {
  const value = String(text ?? '');
  if (!value) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* 권한이 막혔거나 http다. 아래 방법으로 한 번 더 */
    }
  }

  /* 옛 방법. execCommand는 폐기 예정이지만 아직 이쪽만 되는 데가 있다 */
  try {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
};

export default copyText;
