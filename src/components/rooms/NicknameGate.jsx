import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { setNickname } from '../../rooms';
import Modal from '../common/Modal';

/* 방에서 쓸 이름을 정하기 전에는 아무것도 못 하게 막는다.

   이름 없이 들어오면 방 안의 모든 목록에 '이름 없음'이 여러 개 뜬다.
   누구한테 끼꼬를 보내는지, 누가 배팅했는지 구분이 안 되는 순간
   방 자체가 무의미해진다. 그래서 닫을 수 없는 창으로 막는다. */
const NicknameGate = ({ onSaved }) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('이름을 적어주세요.');
      return;
    }
    setBusy(true);
    try {
      await setNickname(trimmed);
      toast.success(`${trimmed} 님, 반가워요.`);
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="방에서 쓸 이름을 정해주세요"
      desc="같이 있는 사람들에게 이 이름으로 보입니다. 나중에 바꿀 수 있어요."
      size="modal-sm"
      /* 닫기를 눌러도 그대로 둔다. 이름 없이 들어가면 아무도 누가 누군지 모른다 */
      onClose={() => toast.error('이름을 정해야 방을 쓸 수 있어요.')}
      footer={
        <button className="dialog-ok" onClick={save} disabled={busy}>
          {busy ? '저장 중…' : '이 이름으로 시작'}
        </button>
      }
    >
      <input
        className="rooms-input"
        style={{ width: '100%' }}
        value={name}
        maxLength={12}
        autoFocus
        placeholder="예) 철수"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
    </Modal>
  );
};

export default NicknameGate;
