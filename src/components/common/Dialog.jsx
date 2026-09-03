import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import './Dialog.css';

/* window.confirm / alert을 대체한다.
   브라우저 기본 창은 스타일을 못 입히고, 모바일에선 주소창 밑에 붙어
   무슨 앱인지도 안 보인다. 여기서 우리 모달로 갈음한다.

   호출부는 그대로 async/await로 쓴다:
     if (!(await confirm({ message: '지울까요?', danger: true }))) return;

   resolve를 ref에 들고 있다가 버튼이 눌릴 때 값을 넣어준다. */
const DialogContext = createContext(null);

export const DialogProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const close = useCallback((result) => {
    setDialog(null);
    const resolve = resolver.current;
    resolver.current = null;
    if (resolve) resolve(result);
  }, []);

  const open = useCallback((opts) => {
    /* 앞의 창이 떠 있는데 또 부르면, 앞 약속을 취소로 닫고 새 창을 띄운다.
       안 그러면 먼저 걸린 await가 영영 안 끝난다 */
    if (resolver.current) {
      resolver.current(false);
      resolver.current = null;
    }
    setDialog(opts);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const api = useMemo(
    () => ({
      confirm: (opts) => open({ kind: 'confirm', ...opts }),
      alert: (opts) => open({ kind: 'alert', ...opts }),
    }),
    [open]
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog && (
        <Modal
          title={dialog.title || (dialog.kind === 'alert' ? '알림' : '확인')}
          onClose={() => close(false)}
          size="modal-sm"
          footer={
            <>
              {dialog.kind === 'confirm' && (
                <button className="ghost-btn" onClick={() => close(false)}>
                  {dialog.cancelText || '취소'}
                </button>
              )}
              <button
                className={`dialog-ok ${dialog.danger ? 'is-danger' : ''}`}
                onClick={() => close(true)}
                autoFocus
              >
                {dialog.confirmText || (dialog.kind === 'alert' ? '확인' : '진행')}
              </button>
            </>
          }
        >
          <p className="dialog-message">{dialog.message}</p>
          {dialog.detail && <p className="dialog-detail">{dialog.detail}</p>}
        </Modal>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog는 DialogProvider 안에서만 쓸 수 있어요.');
  return ctx;
};
