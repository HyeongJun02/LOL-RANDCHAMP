import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';

/* 팝업 껍데기. Esc/배경클릭/스크롤잠금을 여기서만 처리한다.
   body에 포탈로 그린다 — 호출부가 backdrop-filter/transform이 걸린
   조상(예: 블러 낀 헤더) 안에 있으면 그게 fixed의 containing block이
   되어버려서 화면 전체를 못 덮고 그 조상 박스 안에 갇힌다 */
const Modal = ({ title, desc, onClose, children, footer, size = '' }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal ${size}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal-head">
          <h2>{title}</h2>
          {desc && <p>{desc}</p>}
          <button className="modal-close" onClick={onClose} aria-label="닫기">
            <FaTimes />
          </button>
        </header>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
