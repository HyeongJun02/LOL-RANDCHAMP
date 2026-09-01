import React, { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

/* 팝업 껍데기. Esc/배경클릭/스크롤잠금을 여기서만 처리한다 */
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

  return (
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
    </div>
  );
};

export default Modal;
